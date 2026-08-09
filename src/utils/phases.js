// Shared phase-ordering helpers.
//
// Phase display order follows the number in the label ("Phase 3 - Wheels" -> 3)
// rather than the position of items in the upgrades array. Array position is
// not a reliable ordering: new upgrades are appended to the end, and items with
// fractional priorities get spliced in mid-array, which previously left the
// headers reading 1, 2, 8, 3, 4...
//
// Unnumbered / custom phases sort to the end, keeping their incoming order
// (Array.prototype.sort is stable as of ES2019).
//
// Keep every phase list in the app going through sortPhaseNames - the headers
// and the two phase <select> dropdowns each built their own ordering once, and
// they drifted apart.

export function phaseNum(name) {
  const m = /^\s*phase\s+(\d+(?:\.\d+)?)/i.exec(String(name))
  return m ? parseFloat(m[1]) : Number.POSITIVE_INFINITY
}

export function sortPhaseNames(names) {
  return [...names].sort((a, b) => phaseNum(a) - phaseNum(b))
}

// ── Groups within a phase ────────────────────────────────────────────────────
//
// A phase can optionally split its items into named groups via an item-level
// `group` field ("Front Grille", "Front Splitter", ...). Grouping is opt-in per
// item, so any phase can use it and phases that don't set `group` render exactly
// as before.
//
// Ordering rules, mirroring the phase rules above:
//   - ungrouped items come first, directly under the phase header
//   - groups follow, ordered by the lowest `priority` in each group, so a group
//     sits where its earliest item would have sat in the flat list
//   - items inside a group keep priority order

export const UNGROUPED = '__ungrouped__'

// Normalise: missing / blank / whitespace-only group means "no group".
export function groupKey(item) {
  const g = item && item.group
  if (typeof g !== 'string') return UNGROUPED
  const trimmed = g.trim()
  return trimmed === '' ? UNGROUPED : trimmed
}

function minPriority(items) {
  return items.reduce((min, i) => {
    const p = Number(i.priority)
    return Number.isFinite(p) && p < min ? p : min
  }, Number.POSITIVE_INFINITY)
}

// items -> [{ group, items }], ungrouped bucket first (omitted when empty).
export function groupItems(items) {
  const buckets = new Map()
  items.forEach(item => {
    const key = groupKey(item)
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(item)
  })
  buckets.forEach(list =>
    list.sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0))
  )

  const ungrouped = buckets.get(UNGROUPED) || []
  buckets.delete(UNGROUPED)

  // Stable: equal minimums keep first-seen order (ES2019 sort).
  const named = [...buckets.entries()]
    .map(([group, list]) => ({ group, items: list }))
    .sort((a, b) => minPriority(a.items) - minPriority(b.items))

  return ungrouped.length
    ? [{ group: UNGROUPED, items: ungrouped }, ...named]
    : named
}

// Distinct group names already used in a phase, in display order.
export function groupNamesForPhase(items, phase) {
  return groupItems(items.filter(i => i.phase === phase))
    .map(g => g.group)
    .filter(g => g !== UNGROUPED)
}
