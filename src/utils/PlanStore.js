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
const CACHE_PLAN_KEY = 'gwp_plan_cache'   // last-good server copy { content, sha, ts }
const PENDING_KEY = 'gwp_plan_pending'    // unsynced local edits   { data, ops, ts }

function loadJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return null }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

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
//
// Offline behaviour: every successful read caches the plan locally, so a read
// with no network falls back to the last-good copy instead of erroring. Writes
// that fail at the network level are queued (latest full document wins, since
// each queued mutation builds on the previous one) and flushed automatically
// when connectivity returns.

export async function fetchFile() {
  // Unsynced local edits are the newest truth — serve them so the UI doesn't
  // flicker back to the stale server copy while offline.
  const pending = loadJSON(PENDING_KEY)
  try {
    const res = await fetch(API, { cache: 'no-store' })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Plan read failed (${res.status})`)
    }
    const body = await res.json()
    if (pending) {
      // Network is back — kick off a flush, but keep showing local edits until it lands.
      flushPending()
      return { content: pending.data, sha: body.updated_at, offline: true }
    }
    saveJSON(CACHE_PLAN_KEY, { content: body.data, sha: body.updated_at, ts: Date.now() })
    // `sha` keeps the old call shape; it carries updated_at for optimistic writes.
    return { content: body.data, sha: body.updated_at }
  } catch (e) {
    if (pending) return { content: pending.data, sha: null, offline: true }
    const cached = loadJSON(CACHE_PLAN_KEY)
    if (cached) return { content: cached.content, sha: cached.sha, offline: true }
    throw e
  }
}

async function writeFile(config, content, sha) {
  const { token } = config && config.token ? config : getConfig()
  let res
  try {
    res = await fetch(API, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(sha ? { 'If-Match': sha } : {}),
      },
      body: JSON.stringify({ data: content }),
    })
  } catch (e) {
    // fetch() itself threw — no connectivity. Flag it so mutate() can queue
    // instead of surfacing an error. Server rejections (4xx/5xx) fall through
    // below and still throw normally.
    const err = new Error('No connection — change saved locally')
    err.network = true
    throw err
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Plan write failed (${res.status})`)
  }
  return res.json()
}

// ── Offline write queue ──────────────────────────────────────────────────────

export function getPendingOps() {
  return loadJSON(PENDING_KEY)?.ops || 0
}

function notifyPending() {
  try { window.dispatchEvent(new CustomEvent('plan-pending', { detail: { ops: getPendingOps() } })) } catch {}
}

function queuePending(data) {
  const prev = loadJSON(PENDING_KEY)
  saveJSON(PENDING_KEY, { data, ops: (prev?.ops || 0) + 1, ts: Date.now() })
  notifyPending()
}

let flushing = false
export async function flushPending() {
  if (flushing) return false
  const pending = loadJSON(PENDING_KEY)
  if (!pending) return false
  const { token } = getConfig()
  if (!token) return false
  flushing = true
  try {
    // No If-Match: the queued document is the newest truth for a single-user
    // app, and the sha it was built on is long stale by now.
    await writeFile({ token }, pending.data, null)
    try { localStorage.removeItem(PENDING_KEY) } catch {}
    saveJSON(CACHE_PLAN_KEY, { content: pending.data, sha: null, ts: Date.now() })
    notifyPending()
    try { window.dispatchEvent(new CustomEvent('plan-saved', { detail: pending.data })) } catch {}
    return true
  } catch {
    return false
  } finally {
    flushing = false
  }
}

// Flush automatically the moment connectivity returns.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { flushPending() })
}

// read -> mutate -> write. `fn` edits in place or returns a replacement;
// returning false/null means "nothing to do".
// Returns true on a synced write, 'queued' when saved locally for later sync.
async function mutate(config, fn) {
  const { content, sha, offline } = await fetchFile()
  const result = await fn(content)
  if (result === false || result === null) return false
  const final = (result && typeof result === 'object') ? result : content
  let queued = false
  try {
    await writeFile(config, final, offline ? null : sha)
    // Write landed — anything previously queued is superseded by `final`,
    // which was built on top of it.
    try { localStorage.removeItem(PENDING_KEY) } catch {}
    notifyPending()
    saveJSON(CACHE_PLAN_KEY, { content: final, sha: null, ts: Date.now() })
  } catch (e) {
    if (!e.network) throw e // real server rejection (auth, validation) — surface it
    queuePending(final)
    queued = true
  }
  // Every mutation funnels through here, so this one event keeps the UI in sync
  // with the database for all of them. The new document is carried in `detail`,
  // so listeners update instantly with no extra round trip.
  try { window.dispatchEvent(new CustomEvent('plan-saved', { detail: final })) } catch {}
  return queued ? 'queued' : true
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
