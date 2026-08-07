// Plan storage via the m3care Cloudflare Worker (D1-backed).
//
// Plan reads and writes go through the m3care Worker, which owns the D1 binding.
// (Historical note: this replaced a GitHub Contents API layer that base64-encoded the
// whole plan on every save, which silently corrupted it (asymmetric atob/btoa
// doubled every non-ASCII char per round-trip), capped out at GitHub's 1 MiB
// inline limit, needed SHA-conflict retries, and triggered a full CI deploy per
// checkbox. None of that applies here: the Worker holds the D1 binding, the
// browser just sends JSON, and reads are consistent immediately after write.
//
// Export names were kept stable during that migration so no component changed.

const API = 'https://m3care-anthropic-proxy.andy-lambert05.workers.dev/api/plan'
const TOKEN_KEY = 'gwp_plan_token'

// ── Config ───────────────────────────────────────────────────────────────────

export function getConfig() {
  let token = ''
  try { token = localStorage.getItem(TOKEN_KEY) || '' } catch {}
  return { token }
}

export function saveConfig(config) {
  const failed = []
  try {
    localStorage.setItem(TOKEN_KEY, config.token || '')
    if (localStorage.getItem(TOKEN_KEY) !== (config.token || '')) {
      failed.push({ key: TOKEN_KEY, reason: 'Value did not persist (write-read mismatch)' })
    }
  } catch (e) {
    failed.push({ key: TOKEN_KEY, reason: e.message || 'Storage write failed' })
  }
  return { ok: failed.length === 0, failed }
}

function hasPlanToken() {
  try { return !!localStorage.getItem(TOKEN_KEY) } catch { return false }
}


export async function testConnection(token) {
  const res = await fetch(API, { headers: { Authorization: `Bearer ${token || ''}` } })
  if (!res.ok) throw new Error(`Worker returned ${res.status}`)
  const body = await res.json()
  if (!body.data) throw new Error('Worker returned no plan data')
  return 'connected'
}

// ── Core read / write ────────────────────────────────────────────────────────

export async function fetchFile() {
  const res = await fetch(API, { cache: 'no-store' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Plan read failed (${res.status})`)
  }
  const body = await res.json()
  // `sha` keeps the old call shape; it carries updated_at for optimistic writes.
  return { content: body.data, sha: body.updated_at }
}

async function writeFile(config, content, sha) {
  const { token } = config && config.token ? config : getConfig()
  const res = await fetch(API, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(sha ? { 'If-Match': sha } : {}),
    },
    body: JSON.stringify({ data: content }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Plan write failed (${res.status})`)
  }
  return res.json()
}

// read -> mutate -> write. `fn` edits in place or returns a replacement;
// returning false/null means "nothing to do".
async function mutate(config, fn) {
  const { content, sha } = await fetchFile()
  const result = await fn(content)
  if (result === false || result === null) return false
  const final = (result && typeof result === 'object') ? result : content
  await writeFile(config, final, sha)
  // Every mutation funnels through here, so this one event keeps the UI in sync
  // with the database for all of them. The new document is carried in `detail`,
  // so listeners update instantly with no extra round trip.
  try { window.dispatchEvent(new CustomEvent('plan-saved', { detail: final })) } catch {}
  return true
}

// ── Upgrades ─────────────────────────────────────────────────────────────────

export async function addUpgrade(config, upgrade) {
  return mutate(config, content => {
    const items = content.upgrades?.items || []
    const nums = items.map(i => Number(i.priority) || 0)
    const samePhase = items.filter(i => i.phase === upgrade.phase).map(i => Number(i.priority) || 0)
    const after = samePhase.length ? Math.max(...samePhase) : (nums.length ? Math.max(...nums) : 0)
    const next = nums.filter(p => p > after).sort((a, b) => a - b)[0]
    upgrade.priority = next === undefined ? after + 1 : (after + next) / 2

    const lastOfPhase = items.map(i => i.phase).lastIndexOf(upgrade.phase)
    if (lastOfPhase === -1) items.push(upgrade)
    else items.splice(lastOfPhase + 1, 0, upgrade)
    content.upgrades.items = items
  })
}

export async function deleteUpgrade(config, id) {
  return mutate(config, content => {
    content.upgrades.items = content.upgrades.items.filter(u => u.id !== id)
  })
}

export async function bulkSetUpgradesDone(config, idDoneMap, idEditMap = {}) {
  return mutate(config, content => {
    const deletedIds = Object.keys(idEditMap).filter(id => idEditMap[id]?._deleted)
    if (deletedIds.length) {
      content.upgrades.items = content.upgrades.items.filter(u => !deletedIds.includes(u.id))
    }
    content.upgrades.items = content.upgrades.items.map(u => {
      const edit = idEditMap[u.id]
      if (!edit || edit._deleted) return u
      const { _deleted, ...fields } = edit
      return { ...u, ...fields }
    })
    let changed = 0
    content.upgrades.items = content.upgrades.items.map(u => {
      if (!(u.id in idDoneMap)) return u
      if (u.done === idDoneMap[u.id]) return u
      changed++
      return { ...u, done: idDoneMap[u.id], completedDate: idDoneMap[u.id] ? new Date().toISOString().slice(0, 10) : null }
    })
    if (changed + Object.keys(idEditMap).length === 0) return false
  })
}

// ── Chemicals ────────────────────────────────────────────────────────────────

export async function addChemical(config, chem) {
  return mutate(config, content => {
    content.chemicals = content.chemicals || []
    if (!chem.id) {
      chem = { id: chem.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), ...chem }
    }
    content.chemicals.push(chem)
  })
}

export async function editChemical(config, updated) {
  return mutate(config, content => {
    content.chemicals = content.chemicals.map(c => c.id === updated.id ? updated : c)
  })
}

export async function deleteChemical(config, nameOrId) {
  return mutate(config, content => {
    content.chemicals = content.chemicals.filter(c => c.id !== nameOrId && c.name !== nameOrId)
  })
}

export async function toggleChemicalStatus(config, nameOrId) {
  return mutate(config, content => {
    content.chemicals = content.chemicals.map(c => {
      if (c.id !== nameOrId && c.name !== nameOrId) return c
      return { ...c, status: c.status === 'active' ? 'inactive' : 'active' }
    })
  })
}

export async function cycleChemicalMode(config, nameOrId) {
  return mutate(config, content => {
    content.chemicals = content.chemicals.map(c => {
      if (c.id !== nameOrId && c.name !== nameOrId) return c
      let modes = c.modes || ['normal', 'maint']
      if (modes.includes('normal') && modes.includes('maint')) modes = ['normal']
      else if (modes.includes('normal')) modes = ['maint']
      else modes = ['normal', 'maint']
      return { ...c, modes }
    })
  })
}

// ── Tools ────────────────────────────────────────────────────────────────────

export async function addTool(config, tool) {
  return mutate(config, content => { content.tools = content.tools || []; content.tools.push(tool) })
}

export async function editTool(config, updated, originalName) {
  return mutate(config, content => {
    content.tools = content.tools.map(t => t.name === originalName ? updated : t)
  })
}

export async function deleteTool(config, name) {
  return mutate(config, content => { content.tools = content.tools.filter(t => t.name !== name) })
}

// ── Reminders ────────────────────────────────────────────────────────────────

export async function addReminder(config, reminder) {
  return mutate(config, content => { content.reminders = content.reminders || []; content.reminders.push(reminder) })
}

export async function editReminder(config, updated) {
  return mutate(config, content => {
    content.reminders = content.reminders.map(r => r.id === updated.id ? updated : r)
  })
}

export async function deleteReminder(config, id) {
  return mutate(config, content => { content.reminders = content.reminders.filter(r => r.id !== id) })
}

// ── Factory parts ────────────────────────────────────────────────────────────

export async function addFactoryPart(config, part) {
  return mutate(config, content => {
    if (!content.factoryParts) content.factoryParts = { note: '', items: [] }
    if (!content.factoryParts.items) content.factoryParts.items = []
    content.factoryParts.items.push(part)
  })
}

export async function editFactoryPart(config, part) {
  return mutate(config, content => {
    if (!content.factoryParts?.items) throw new Error('factoryParts not found')
    content.factoryParts.items = content.factoryParts.items.map(p => p.id === part.id ? part : p)
  })
}

export async function deleteFactoryPart(config, id) {
  return mutate(config, content => {
    if (!content.factoryParts?.items) throw new Error('factoryParts not found')
    content.factoryParts.items = content.factoryParts.items.filter(p => p.id !== id)
  })
}
