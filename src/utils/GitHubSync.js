// GitHub Contents API utility for reading and writing wash-plan.json

const REPO_OWNER_KEY = 'gwp_gh_owner'
const REPO_NAME_KEY = 'gwp_gh_repo'
const PAT_KEY = 'gwp_gh_pat'
const BRANCH_KEY = 'gwp_gh_branch'

export function getConfig() {
  return {
    owner: localStorage.getItem(REPO_OWNER_KEY) || 'andylambert05-ship-it',
    repo: localStorage.getItem(REPO_NAME_KEY) || 'g80-wash-plan-react',
    pat: localStorage.getItem(PAT_KEY) || '',
    branch: localStorage.getItem(BRANCH_KEY) || 'main',
  }
}

export function saveConfig(config) {
  // Each setItem can throw QuotaExceededError if localStorage is full.
  // We attempt every write, verify each one by reading it back, and return
  // a structured result so the caller can surface a real error to the user.
  const writes = [
    [REPO_OWNER_KEY, config.owner],
    [REPO_NAME_KEY, config.repo],
    [PAT_KEY, config.pat],
    [BRANCH_KEY, config.branch],
  ]
  const failed = []
  for (const [key, value] of writes) {
    try {
      localStorage.setItem(key, value || '')
      // Verify — iOS PWAs can silently no-op when over quota
      if (localStorage.getItem(key) !== (value || '')) {
        failed.push({ key, reason: 'Value did not persist (write-read mismatch)' })
      }
    } catch (e) {
      failed.push({ key, reason: e.message || 'Storage write failed' })
    }
  }
  return { ok: failed.length === 0, failed }
}

// Quick check used by global banner: is GitHub usable right now?
export function hasGithubConfig() {
  try { return !!localStorage.getItem(PAT_KEY) } catch { return false }
}

const FILE_PATH = 'public/wash-plan.json'

async function apiRequest(url, method, pat, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `GitHub API error ${res.status}`)
  }
  return res.json()
}

// Fetch the current file content + SHA (needed for PUT)
export async function fetchFile(config) {
  const { owner, repo, pat, branch } = config
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${FILE_PATH}?ref=${branch}`
  const data = await apiRequest(url, 'GET', pat)
  const content = JSON.parse(atob(data.content.replace(/\n/g, '')))
  return { content, sha: data.sha }
}

// Poll GitHub Contents API until the JSON reflects expected done/edit state,
// or until maxAttempts is exhausted (3s between each). Returns true if verified.
export async function verifyUpgradeSync(config, doneDiff, editMap, maxAttempts = 6, onProgress = null) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, 10000))
    if (onProgress) onProgress(attempt + 1, maxAttempts)
    try {
      const { content } = await fetchFile(config)
      const items = content.upgrades?.items || []
      let allMatch = true
      // Check done-state
      for (const [id, expectedDone] of Object.entries(doneDiff)) {
        const item = items.find(i => i.id === id)
        if (!item || !!item.done !== expectedDone) { allMatch = false; break }
      }
      // Check deletions
      if (allMatch) {
        for (const [id, edit] of Object.entries(editMap)) {
          if (edit._deleted) {
            const item = items.find(i => i.id === id)
            if (item) { allMatch = false; break }
          }
        }
      }
      // Check field edits
      if (allMatch) {
        for (const [id, edit] of Object.entries(editMap)) {
          if (edit._deleted) continue
          const item = items.find(i => i.id === id)
          if (!item) { allMatch = false; break }
          // Trim both sides — JSON might have trailing whitespace
          if (edit.item && item.item.trim() !== edit.item.trim()) { allMatch = false; break }
          if (edit.notes !== undefined && (item.notes || '').trim() !== (edit.notes || '').trim()) { allMatch = false; break }
        }
      }
      if (allMatch) return true
    } catch (e) {
      // Network blip — keep trying
      console.warn('verifyUpgradeSync poll failed:', e.message)
    }
  }
  return false
}

// Write updated content back to GitHub
export async function writeFile(config, content, sha, message) {
  const { owner, repo, pat, branch } = config
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${FILE_PATH}`
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2))))
  await apiRequest(url, 'PUT', pat, {
    message,
    content: encoded,
    sha,
    branch,
  })
}

// Test connection — fetches user info
export async function testConnection(pat) {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
    },
  })
  if (!res.ok) throw new Error('Invalid token or no access')
  const data = await res.json()
  return data.login
}

// Fetch + mutate + write, with automatic retry on SHA conflict.
//
// All retryable writes are queued through a single global promise chain so
// that no two sync operations are in flight on the same device at once. This
// eliminates self-collisions (e.g. catch-up sync racing with a user tap) and
// leaves retry to handle genuine cross-device collisions only.
//
// `mutate(content)` should modify `content` in place (or return a new object)
// and may also return false/null to signal "no change needed". It's called
// fresh on each retry so any sequence-dependent logic re-runs against the
// latest content.
//
// `messageFn()` is called AFTER a successful mutate to produce the commit
// message — this lets callers reference state captured during mutate (e.g.
// the new value of a flipped flag).

let _syncQueue = Promise.resolve()

function _enqueue(operation) {
  // Chain so the next op waits for previous (success OR failure).
  // The queue itself swallows errors so one bad op doesn't poison the chain.
  const result = _syncQueue.then(operation, operation)
  _syncQueue = result.then(() => undefined, () => undefined)
  return result
}

async function syncWithRetry(config, mutate, messageFn, maxAttempts = 5) {
  return _enqueue(async () => {
    let lastError
    let lastFailedSha = null
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const { content, sha } = await fetchFile(config)
        // If we're retrying and the SHA hasn't changed yet, wait longer
        if (lastFailedSha && sha === lastFailedSha) {
          await new Promise(r => setTimeout(r, 1500))
          continue
        }
        const result = await mutate(content)
        if (result === false || result === null) return false
        const finalContent = (result && typeof result === 'object') ? result : content
        await writeFile(config, finalContent, sha, messageFn())
        return true
      } catch (e) {
        lastError = e
        const isConflict =
          /does not match/i.test(e.message || '') ||
          /409/.test(e.message || '') ||
          /conflict/i.test(e.message || '')
        if (isConflict && attempt < maxAttempts - 1) {
          // Extract the SHA from the error message if present so we can
          // detect stale-SHA loops on the next attempt
          const shaMatch = (e.message || '').match(/[0-9a-f]{40}/)
          if (shaMatch) lastFailedSha = shaMatch[0]
          // Escalating backoff: 500ms, 1s, 2s, 3s
          await new Promise(r => setTimeout(r, Math.min(500 * Math.pow(2, attempt), 3000)))
          continue
        }
        throw e
      }
    }
    throw lastError
  })
}

// High-level: add a chemical to wash-plan.json and commit
export async function addChemical(config, chem) {
  const { content, sha } = await fetchFile(config)
  content.chemicals = content.chemicals || []
  // Auto-assign stable id from name if not provided
  if (!chem.id) {
    chem = { id: chem.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), ...chem }
  }
  content.chemicals.push(chem)
  await writeFile(config, content, sha, `Add chemical: ${chem.name}`)
}

// High-level: add a tool
export async function addTool(config, tool) {
  const { content, sha } = await fetchFile(config)
  content.tools = content.tools || []
  content.tools.push(tool)
  await writeFile(config, content, sha, `Add tool: ${tool.name}`)
}

// High-level: add an upgrade
export async function addUpgrade(config, upgrade) {
  const { content, sha } = await fetchFile(config)
  const items = content.upgrades?.items || []
  // Auto-assign priority at end of phase
  const samePhasePriorities = items.filter(i => i.phase === upgrade.phase).map(i => i.priority)
  const maxP = samePhasePriorities.length > 0 ? Math.max(...samePhasePriorities) : (items.length > 0 ? Math.max(...items.map(i => i.priority)) : 0)
  upgrade.priority = maxP + 1
  items.push(upgrade)
  content.upgrades.items = items
  await writeFile(config, content, sha, `Add upgrade: ${upgrade.item}`)
}

// ── Edit functions ────────────────────────────────────────────────────────────

export async function editChemical(config, updatedChem) {
  const { content, sha } = await fetchFile(config)
  const oldChem = content.chemicals.find(c => c.id === updatedChem.id)
  const nameChanged = oldChem && oldChem.name !== updatedChem.name

  // Update the chemical record
  content.chemicals = content.chemicals.map(c => c.id === updatedChem.id ? updatedChem : c)

  // If name changed, update step titles that embedded the old name in their desc/title
  // The chemId stays stable so chem tags auto-resolve — no step mutation needed for display.
  // However if the id itself would change (shouldn't happen via UI), log a warning.
  if (nameChanged && updatedChem.id !== oldChem.id) {
    console.warn('GitHubSync: chemical id changed — step chems may need manual update', oldChem.id, '->', updatedChem.id)
  }

  await writeFile(config, content, sha, `Edit chemical: ${updatedChem.name}`)
}

export async function deleteChemical(config, nameOrId) {
  const { content, sha } = await fetchFile(config)
  content.chemicals = content.chemicals.filter(c => c.id !== nameOrId && c.name !== nameOrId)
  await writeFile(config, content, sha, `Remove chemical: ${nameOrId}`)
}

export async function editTool(config, updatedTool, originalName) {
  const { content, sha } = await fetchFile(config)
  content.tools = content.tools.map(t => t.name === originalName ? updatedTool : t)
  await writeFile(config, content, sha, `Edit tool: ${updatedTool.name}`)
}

export async function deleteTool(config, name) {
  const { content, sha } = await fetchFile(config)
  content.tools = content.tools.filter(t => t.name !== name)
  await writeFile(config, content, sha, `Remove tool: ${name}`)
}

export async function editUpgrade(config, updatedUpgrade) {
  const { content, sha } = await fetchFile(config)
  content.upgrades.items = content.upgrades.items.map(u => u.id === updatedUpgrade.id ? updatedUpgrade : u)
  await writeFile(config, content, sha, `Edit upgrade: ${updatedUpgrade.item}`)
}

// Toggle a single upgrade's done state (cross-device sync, retries on conflict)
export async function toggleUpgradeDone(config, id) {
  let item
  return syncWithRetry(
    config,
    (content) => {
      content.upgrades.items = content.upgrades.items.map(u => {
        if (u.id !== id) return u
        item = { ...u, done: !u.done, completedDate: !u.done ? new Date().toISOString().slice(0, 10) : null }
        return item
      })
    },
    () => `${item?.done ? 'Complete' : 'Reopen'} upgrade: ${item?.item || id}`
  )
}

// Bulk update — applies done-state changes AND field edits/deletions. Single commit, retries on conflict.
export async function bulkSetUpgradesDone(config, idDoneMap, idEditMap = {}) {
  let changedCount = 0
  return syncWithRetry(
    config,
    (content) => {
      // Apply deletions first
      const deletedIds = Object.keys(idEditMap).filter(id => idEditMap[id]?._deleted)
      if (deletedIds.length) {
        content.upgrades.items = content.upgrades.items.filter(u => !deletedIds.includes(u.id))
      }
      // Apply field edits
      content.upgrades.items = content.upgrades.items.map(u => {
        const edit = idEditMap[u.id]
        if (!edit || edit._deleted) return u
        const { _deleted, ...fields } = edit
        return { ...u, ...fields }
      })
      // Apply done-state changes
      const changed = []
      content.upgrades.items = content.upgrades.items.map(u => {
        if (!(u.id in idDoneMap)) return u
        if (u.done === idDoneMap[u.id]) return u
        changed.push(u.id)
        return { ...u, done: idDoneMap[u.id], completedDate: idDoneMap[u.id] ? new Date().toISOString().slice(0, 10) : null }
      })
      changedCount = changed.length + Object.keys(idEditMap).length
      if (changedCount === 0) return false
    },
    () => {
      const parts = []
      if (Object.keys(idDoneMap).length) parts.push(`${Object.keys(idDoneMap).length} completion(s)`)
      if (Object.keys(idEditMap).length) parts.push(`${Object.keys(idEditMap).length} edit(s)`)
      return `Save upgrades: ${parts.join(', ')}`
    }
  )
}

export async function deleteUpgrade(config, id) {
  const { content, sha } = await fetchFile(config)
  content.upgrades.items = content.upgrades.items.filter(u => u.id !== id)
  await writeFile(config, content, sha, `Remove upgrade: ${id}`)
}

export async function addReminder(config, reminder) {
  const { content, sha } = await fetchFile(config)
  content.reminders = content.reminders || []
  content.reminders.push(reminder)
  await writeFile(config, content, sha, `Add reminder: ${reminder.name}`)
}

export async function editReminder(config, updatedReminder) {
  const { content, sha } = await fetchFile(config)
  content.reminders = content.reminders.map(r => r.id === updatedReminder.id ? updatedReminder : r)
  await writeFile(config, content, sha, `Edit reminder: ${updatedReminder.name}`)
}

export async function deleteReminder(config, id) {
  const { content, sha } = await fetchFile(config)
  content.reminders = content.reminders.filter(r => r.id !== id)
  await writeFile(config, content, sha, `Remove reminder: ${id}`)
}

// ── Chemical status + mode toggles ───────────────────────────────────────────

export async function toggleChemicalStatus(config, nameOrId) {
  const { content, sha } = await fetchFile(config)
  content.chemicals = content.chemicals.map(c => {
    if (c.id !== nameOrId && c.name !== nameOrId) return c
    return { ...c, status: c.status === 'active' ? 'inactive' : 'active' }
  })
  const chem = content.chemicals.find(c => c.id === nameOrId || c.name === nameOrId)
  await writeFile(config, content, sha, `Toggle ${nameOrId} status -> ${chem.status}`)
}

export async function cycleChemicalMode(config, nameOrId) {
  const { content, sha } = await fetchFile(config)
  content.chemicals = content.chemicals.map(c => {
    if (c.id !== nameOrId && c.name !== nameOrId) return c
    let modes = c.modes || ['normal', 'maint']
    if (modes.includes('normal') && modes.includes('maint')) modes = ['normal']
    else if (modes.includes('normal')) modes = ['maint']
    else modes = ['normal', 'maint']
    return { ...c, modes }
  })
  const chem = content.chemicals.find(c => c.id === nameOrId || c.name === nameOrId)
  await writeFile(config, content, sha, `Cycle ${nameOrId} modes -> ${chem.modes.join(',')}`)
}

// ── Factory Parts (OEM+ Reversibility Tracker) ──
export async function addFactoryPart(config, part) {
  const { content, sha } = await fetchFile(config)
  if (!content.factoryParts) content.factoryParts = { note: '', items: [] }
  if (!content.factoryParts.items) content.factoryParts.items = []
  content.factoryParts.items.push(part)
  await writeFile(config, content, sha, `Add factory part: ${part.component}`)
}

export async function editFactoryPart(config, part) {
  const { content, sha } = await fetchFile(config)
  if (!content.factoryParts?.items) throw new Error('factoryParts not found')
  content.factoryParts.items = content.factoryParts.items.map(p => p.id === part.id ? part : p)
  await writeFile(config, content, sha, `Edit factory part: ${part.component}`)
}

export async function deleteFactoryPart(config, id) {
  const { content, sha } = await fetchFile(config)
  if (!content.factoryParts?.items) throw new Error('factoryParts not found')
  const part = content.factoryParts.items.find(p => p.id === id)
  content.factoryParts.items = content.factoryParts.items.filter(p => p.id !== id)
  await writeFile(config, content, sha, `Remove factory part: ${part?.component || id}`)
}
