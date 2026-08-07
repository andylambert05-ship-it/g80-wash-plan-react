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
