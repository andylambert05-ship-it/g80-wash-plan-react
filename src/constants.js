export const PHASE_ICONS = {
  'Wheels & Tires': '🔵',
  'Pre-treatment': '🔴',
  'Prewash': '🟣',
  '2-Bucket Method Wash': '🟡',
  'Dry & Protect': '🟢',
  'Finish': '⚪',
}

export const PHASE_COLORS = {
  'Wheels & Tires': '#0066b1',
  'Pre-treatment': '#cc1e1e',
  'Prewash': '#9b4fd4',
  '2-Bucket Method Wash': '#c8860a',
  'Dry & Protect': '#1a9e62',
  'Finish': '#666680',
}

export const SEASON_COLORS = {
  'Winter (Nov-Mar)': '#0066b1',
  'Spring (Mar-May)': '#1a9e62',
  'Summer (Jun-Sep)': '#c8860a',
  'Fall (Sep-Nov)': '#cc1e1e',
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
  if (name.startsWith('Garage Therapy')) return 'Garage Therapy'
  return 'Other'
}

export function getShortName(name) {
  return name
    .replace(/^CarPro /, '').replace(/^Bilt Hamber /, '').replace(/^Koch Chemie /, '')
    .replace(/^Autofinesse /, '').replace(/^McKee's 37 /, '').replace(/^P21S /, '')
    .replace(/^DIY Detail /, '').replace(/^Colourlock /, '').replace(/^303 Products /, '')
    .replace(/^Garage Therapy /, '')
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
  'Wheel shampoo', 'Tire cleaner', 'All-purpose cleaner', 'All-purpose cleaner / degreaser (APC)', 'Iron / fallout decon',
  'Iron / fallout remover — paint', 'Decon shampoo',
  'Ceramic maintenance pre-wash — step 1', 'Ceramic maintenance pre-wash — step 2',
  'Main wash shampoo', 'Tire dressing', 'Paint sealant / coating topper — both modes',
  'Spray sealant / paint protection', 'Exhaust & metal cleaning',
  'Glass cleaner', 'Glass cleaner — alternative to BH Trace-Less', 'Screen cleaner — interior',
  'Quick detailer / rinseless wash', 'Trim & finishing', 'Finishing', 'Ceramic coating topper / paint protection',
  'Interior APC / surface cleaner',
]
