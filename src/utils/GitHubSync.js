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
  localStorage.setItem(REPO_OWNER_KEY, config.owner)
  localStorage.setItem(REPO_NAME_KEY, config.repo)
  localStorage.setItem(PAT_KEY, config.pat)
  localStorage.setItem(BRANCH_KEY, config.branch)
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

// High-level: add a chemical to wash-plan.json and commit
export async function addChemical(config, chem) {
  const { content, sha } = await fetchFile(config)
  content.chemicals = content.chemicals || []
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
  content.chemicals = content.chemicals.map(c => c.name === updatedChem.name ? updatedChem : c)
  await writeFile(config, content, sha, `Edit chemical: ${updatedChem.name}`)
}

export async function deleteChemical(config, name) {
  const { content, sha } = await fetchFile(config)
  content.chemicals = content.chemicals.filter(c => c.name !== name)
  await writeFile(config, content, sha, `Remove chemical: ${name}`)
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

export async function toggleChemicalStatus(config, name) {
  const { content, sha } = await fetchFile(config)
  content.chemicals = content.chemicals.map(c => {
    if (c.name !== name) return c
    return { ...c, status: c.status === 'active' ? 'inactive' : 'active' }
  })
  const chem = content.chemicals.find(c => c.name === name)
  await writeFile(config, content, sha, `Toggle ${name} status -> ${chem.status}`)
}

export async function cycleChemicalMode(config, name) {
  const { content, sha } = await fetchFile(config)
  content.chemicals = content.chemicals.map(c => {
    if (c.name !== name) return c
    // Cycle: normal -> both -> maint -> normal
    let modes = c.modes || ['normal', 'maint']
    if (modes.includes('normal') && modes.includes('maint')) modes = ['normal']
    else if (modes.includes('normal')) modes = ['maint']
    else modes = ['normal', 'maint']
    return { ...c, modes }
  })
  const chem = content.chemicals.find(c => c.name === name)
  await writeFile(config, content, sha, `Cycle ${name} modes -> ${chem.modes.join(',')}`)
}
