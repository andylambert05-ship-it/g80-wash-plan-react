export const PHASE_ICONS = {
  'Wheels & Tires': '🔵',
  'Pre-treatment': '🔴',
  'Prewash': '🟣',
  '2-Bucket Method Wash': '🟡',
  'Dry & Protect': '🟢',
  'Finish': '⚪',
}

export const PHASE_COLORS = {
  'Wheels & Tires': '#1358d4',
  'Pre-treatment': '#c0282a',
  'Prewash': '#7a3db0',
  '2-Bucket Method Wash': '#b07000',
  'Dry & Protect': '#0a7a4a',
  'Finish': '#505068',
}

export const SEASON_COLORS = {
  'Winter (Nov-Mar)': '#1358d4',
  'Spring (Mar-May)': '#0a7a4a',
  'Summer (Jun-Sep)': '#b07000',
  'Fall (Sep-Nov)': '#c0282a',
}

export function fmtTime(sec) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export function getBrand(name) {
  if (name.startsWith('CarPro')) return 'CarPro'
  if (name.startsWith('Bilt Hamber')) return 'Bilt Hamber'
  if (name.startsWith('Koch Chemie')) return 'Koch Chemie'
  if (name.startsWith('Autofinesse')) return 'Autofinesse'
  if (name.startsWith('Colourlock')) return 'Colourlock'
  if (name.startsWith("McKee's")) return "McKee's 37"
  if (name.startsWith('P21S')) return 'P21S'
  if (name.startsWith('DIY Detail')) return 'DIY Detail'
  if (name.startsWith('Brake Buster')) return 'Brake Buster'
  if (name.startsWith('303')) return '303 Products'
  return 'Other'
}

export function getShortName(name) {
  return name
    .replace(/^CarPro /, '').replace(/^Bilt Hamber /, '').replace(/^Koch Chemie /, '')
    .replace(/^Autofinesse /, '').replace(/^McKee's 37 /, '').replace(/^P21S /, '')
    .replace(/^DIY Detail /, '').replace(/^Colourlock /, '').replace(/^303 Products /, '')
}

export function getVisibleSteps(data, mode) {
  const normal = data.washSteps.normal.filter(s => mode === 'normal' || !s.normalOnly)
  if (mode === 'normal') return normal
  const combined = [...normal]
  data.washSteps.maintOnly.forEach(ms => {
    const idx = combined.findIndex(s => s.id === ms.insertAfter)
    const entry = { ...ms, isMaint: true }
    if (idx >= 0) combined.splice(idx + 1, 0, entry)
    else combined.push(entry)
  })
  return combined
}

export const CAT_ORDER = [
  'Spot pre-treatment', 'Wheel cleaner', 'Wheel cleaner (option)', 'Wheel cleaner — iron-reactive',
  'Tire cleaner', 'All-purpose cleaner', 'All-purpose cleaner / degreaser (APC)', 'Iron / fallout decon',
  'Iron / fallout remover — paint', 'Ceramic maintenance pre-wash — step 1', 'Ceramic maintenance pre-wash — step 2',
  'Main wash shampoo', 'Tire dressing', 'Paint sealant / coating topper — both modes', 'Exhaust & metal cleaning',
  'Glass cleaner', 'Glass cleaner — alternative to BH Trace-Less', 'Screen cleaner — interior',
  'Quick detailer / rinseless wash', 'Trim & finishing', 'Finishing', 'Ceramic coating topper / paint protection',
  'Interior APC / surface cleaner',
]
