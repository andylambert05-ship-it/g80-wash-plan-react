import { useState } from 'react'
import { getBrand, getShortName, CAT_ORDER } from '../constants'
import { EditChemicalForm, SyncStatus } from './SyncForm'
import { getConfig, deleteChemical, toggleChemicalStatus, cycleChemicalMode } from '../utils/GitHubSync'

// ── Ratio parser ─────────────────────────────────────────────────────────────
function parseRatio(ratio) {
  if (!ratio) return null
  const r = ratio.trim()
  if (['RTU', 'Direct', 'Neat to 100%'].includes(r)) return { type: 'rtu' }
  const fixedMatch = r.match(/^([\d.\u20133-]+)ml\s*:\s*([\d.]+)\s*(L|ml)/i)
  if (fixedMatch) {
    const raw = fixedMatch[1].replace('\u2013', '-')
    const productMl = raw.includes('-') ? raw.split('-').map(Number) : [parseFloat(raw), parseFloat(raw)]
    const waterMl = fixedMatch[3].toLowerCase() === 'l' ? parseFloat(fixedMatch[2]) * 1000 : parseFloat(fixedMatch[2])
    return { type: 'fixed', productMl, waterMl }
  }
  const pirMatch = r.match(/([\d.]+)%(?:[\u2013-]([\d.]+)%)?/)
  if (pirMatch && (r.includes('PIR') || r.includes('%'))) {
    return { type: 'pir', lo: parseFloat(pirMatch[1]), hi: pirMatch[2] ? parseFloat(pirMatch[2]) : parseFloat(pirMatch[1]) }
  }
  const xto1 = r.match(/^([\d.]+):1(?:[\u2013-]([\d.]+):1)?$/)
  if (xto1) return { type: 'xto1', lo: parseFloat(xto1[1]), hi: xto1[2] ? parseFloat(xto1[2]) : parseFloat(xto1[1]) }
  const oto1 = r.match(/^1:([\d.]+)$/)
  if (oto1) return { type: '1tox', x: parseFloat(oto1[1]) }
  const pctMatch = r.match(/^([\d.]+)%(?:[\u2013-]([\d.]+)%)?$/)
  if (pctMatch) return { type: 'pct', lo: parseFloat(pctMatch[1]), hi: pctMatch[2] ? parseFloat(pctMatch[2]) : parseFloat(pctMatch[1]) }
  return null
}

function calcProduct(parsed, containerMl) {
  if (!parsed || !containerMl || containerMl <= 0) return null
  switch (parsed.type) {
    case 'rtu': return { type: 'rtu' }
    case 'pir':
    case 'pct': return { lo: (parsed.lo / 100) * containerMl, hi: (parsed.hi / 100) * containerMl }
    case 'xto1': {
      const lo = containerMl / (parsed.lo + 1), hi = containerMl / (parsed.hi + 1)
      return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) }
    }
    case '1tox': { const p = containerMl / (parsed.x + 1); return { lo: p, hi: p } }
    case 'fixed': {
      const scale = containerMl / parsed.waterMl
      return { lo: parsed.productMl[0] * scale, hi: parsed.productMl[parsed.productMl.length - 1] * scale }
    }
    default: return null
  }
}

function fmtMl(n) {
  if (n >= 1000) return (n / 1000).toFixed(2).replace(/\.?0+$/, '') + 'L'
  return n < 10 ? n.toFixed(1) + 'ml' : Math.round(n) + 'ml'
}

function ratioLabel(type) {
  switch (type) {
    case 'rtu': return 'Ready to use — no dilution needed'
    case 'pir': return 'PIR = product-in-ratio (% of total solution)'
    case 'pct': return '% = product as percentage of total'
    case 'xto1': return 'X:1 = X parts water to 1 part product'
    case '1tox': return '1:X = 1 part product to X parts water'
    case 'fixed': return 'Fixed reference amount'
    default: return ''
  }
}

// ── Calc Modal ───────────────────────────────────────────────────────────────
// Container presets — Andy's actual tooling
const CONTAINER_PRESETS = [
  { label: 'IK 2',  ml: 1250, sub: 'Foam Pro' },
  { label: 'Marolex', ml: 3000, sub: '3000' },
  { label: 'IK 12', ml: 6000, sub: 'Foam Pro' },
  { label: 'Bucket', ml: 15000, sub: '4 gal' },
]

function CalcModal({ selected, onClose }) {
  const [containerVal, setContainerVal] = useState('')
  const [unit, setUnit] = useState('ml')
  const [manualMode, setManualMode] = useState(false)
  const [manualRatio, setManualRatio] = useState('')

  const activeRatio = manualMode ? manualRatio : (selected?.ratio || '')
  const parsed = parseRatio(activeRatio)
  const containerMl = containerVal
    ? (unit === 'L' ? parseFloat(containerVal) * 1000 : parseFloat(containerVal))
    : 0
  const result = calcProduct(parsed, containerMl)

  const setPreset = (ml) => {
    if (ml >= 1000 && ml % 1000 === 0) {
      setContainerVal(String(ml / 1000)); setUnit('L')
    } else if (ml >= 1000) {
      setContainerVal((ml / 1000).toFixed(2).replace(/\.?0+$/, '')); setUnit('L')
    } else {
      setContainerVal(String(ml)); setUnit('ml')
    }
  }
  const activePreset = CONTAINER_PRESETS.find(p => p.ml === containerMl)

  // Average ml of product for mix-ratio visualization
  const productAvg = result && result.type !== 'rtu' ? (result.lo + result.hi) / 2 : 0
  const productPct = containerMl > 0 ? Math.max(0.5, Math.min(100, (productAvg / containerMl) * 100)) : 0

  return (
    <div className="calc-overlay" onClick={onClose}>
      <div className="calc-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="calc-header">
          <div>
            {selected ? (
              <>
                <div className="calc-chem-name">{selected.name}</div>
                <div className="calc-chem-ctx">{selected.ctx} · <span className="calc-chem-ratio">{selected.ratio}</span></div>
              </>
            ) : (
              <div className="calc-chem-name">Dilution Calculator</div>
            )}
          </div>
          <button onClick={onClose} className="calc-close" aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {/* Manual ratio toggle */}
        <button onClick={() => setManualMode(m => !m)} className={`calc-manual-toggle${manualMode ? ' active' : ''}`}>
          <i className={`ti ${manualMode ? 'ti-chevron-up' : 'ti-edit'}`} aria-hidden="true" />
          {manualMode ? 'Hide manual ratio' : 'Use manual ratio'}
        </button>
        {manualMode && (
          <input value={manualRatio} onChange={e => setManualRatio(e.target.value)}
            placeholder="e.g. 1:10, 5%, 400:1"
            className="calc-manual-input" />
        )}

        {/* Container presets */}
        <div className="calc-section-label">Container</div>
        <div className="calc-presets">
          {CONTAINER_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => setPreset(p.ml)}
              className={`calc-preset${activePreset?.ml === p.ml ? ' active' : ''}`}
            >
              <span className="calc-preset-main">{p.label}</span>
              <span className="calc-preset-sub">{p.ml >= 1000 ? `${p.ml/1000}L` : `${p.ml}ml`}</span>
            </button>
          ))}
        </div>

        {/* Custom container input */}
        <div className="calc-custom-row">
          <input
            type="number" min="0" placeholder="Custom amount"
            value={containerVal}
            onChange={e => setContainerVal(e.target.value)}
            className="calc-custom-input"
          />
          <div className="calc-unit-toggle">
            {['ml', 'L'].map(u => (
              <button key={u} onClick={() => setUnit(u)}
                className={`calc-unit${unit === u ? ' active' : ''}`}>{u}</button>
            ))}
          </div>
        </div>

        {/* Result */}
        {containerMl > 0 && result && result.type !== 'rtu' && (
          <div className="calc-result">
            <div className="calc-result-label">Add product</div>
            <div className="calc-result-value">
              {Math.abs(result.lo - result.hi) < 0.5 ? fmtMl(result.lo) : `${fmtMl(result.lo)}–${fmtMl(result.hi)}`}
              <span className="calc-result-unit">ml</span>
            </div>
            {/* Mix ratio bar */}
            <div className="calc-mix">
              <div className="calc-mix-legend">
                <span><span className="calc-dot calc-dot-product" /> Product</span>
                <span><span className="calc-dot calc-dot-water" /> Water {containerVal}{unit}</span>
              </div>
              <div className="calc-mix-bar">
                <div className="calc-mix-fill" style={{ width: `${productPct}%` }} />
              </div>
            </div>
          </div>
        )}
        {containerMl > 0 && result && result.type === 'rtu' && (
          <div className="calc-result calc-result-rtu">
            <div className="calc-result-label">Ready to use</div>
            <div className="calc-result-rtu-msg">No dilution needed — apply undiluted.</div>
          </div>
        )}
        {containerMl > 0 && !result && (
          <div className="calc-result calc-result-warn">
            <div className="calc-result-warn-msg">
              <i className="ti ti-alert-circle" aria-hidden="true" /> Can't calculate this ratio — try Manual mode.
            </div>
          </div>
        )}
        {!containerMl && parsed && parsed.type !== 'rtu' && (
          <div className="calc-hint">Pick a container or enter custom amount.</div>
        )}
      </div>
    </div>
  )
}

// ── Chem chart ───────────────────────────────────────────────────────────────
function ChemChart({ chemicals, onSelectDil }) {
  const sorted = [...chemicals].sort((a, b) => {
    const ba = getBrand(a.name), bb = getBrand(b.name)
    return ba < bb ? -1 : ba > bb ? 1 : a.name < b.name ? -1 : 1
  })
  let lastBrand = ''
  return (
    <div className="chem-chart">
      <div className="cc-head">
        <div className="cc-cell">Brand</div>
        <div className="cc-cell cc-name">Product</div>
        <div className="cc-cell cc-use">Areas of use</div>
        <div className="cc-cell cc-ratio">Dilution</div>
      </div>
      {sorted.map(c => {
        const brand = getBrand(c.name)
        const showBrand = brand !== lastBrand
        if (showBrand) lastBrand = brand
        const normalOnly = c.modes.length === 1 && c.modes[0] === 'normal'
        const maintOnly = c.modes.length === 1 && c.modes[0] === 'maint'
        const shortUse = c.usedOn?.split(' — ')[0].split(',')[0].substring(0, 55) || ''
        const ratio = c.dilutions[0]?.ratio || 'RTU'
        return (
          <div key={c.name} className="cc-row">
            <div className="cc-cell cc-brand">{showBrand ? brand : ''}</div>
            <div className="cc-cell cc-name">
              {getShortName(c.name)}
              {maintOnly && <span className="cc-pill cc-pm">M</span>}
              {normalOnly && <span className="cc-pill cc-pn">N</span>}
            </div>
            <div className="cc-cell cc-use">{shortUse}</div>
            <div
              className="cc-cell cc-ratio"
              onClick={() => onSelectDil({ name: c.name, ctx: c.dilutions[0]?.context || '', ratio })}
              style={{ cursor: parseRatio(ratio) && parseRatio(ratio).type !== 'rtu' ? 'pointer' : 'default', textDecoration: parseRatio(ratio) && parseRatio(ratio).type !== 'rtu' ? 'underline' : 'none', textDecorationStyle: 'dotted' }}
              title={parseRatio(ratio) && parseRatio(ratio).type !== 'rtu' ? 'Click to load into calculator' : ''}
            >{ratio}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── Chem card ─────────────────────────────────────────────────────────────────
function ChemCard({ chem, onSelectDil, onToggleStatus, onCycleMode }) {
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [delStatus, setDelStatus] = useState(null)
  const [toggling, setToggling] = useState(false)
  const [cycling, setCycling] = useState(false)

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); return }
    const config = getConfig()
    if (!config.pat) { setDelStatus({ type: 'nopat' }); return }
    setDelStatus({ type: 'saving' })
    try {
      await deleteChemical(config, chem.name)
      setDelStatus({ type: 'success' })
    } catch (e) {
      setDelStatus({ type: 'error', message: e.message })
    }
  }

  if (editing) return <EditChemicalForm chem={chem} onClose={() => setEditing(false)} />

  const normalOnly = chem.modes.length === 1 && chem.modes[0] === 'normal'
  const maintOnly = chem.modes.length === 1 && chem.modes[0] === 'maint'
  return (
    <div className="chem-card">
      <div className="chem-hd">
        <div>
          <div className="chem-nm">{chem.name}</div>
          <div className="chem-cat">{chem.category}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {maintOnly && <span className="pill pm">maint. only</span>}
          {normalOnly && <span className="pill po">normal only</span>}
          {/* Mode cycle button — only for active chemicals */}
          {chem.status !== 'inactive' && (
            <button onClick={() => !cycling && onCycleMode(chem.name, setCycling)} title="Cycle wash mode"
              style={{ padding: '2px 8px', border: '1px solid var(--bd2)', background: 'transparent', color: '#0066b1', cursor: 'pointer', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
              <i className="ti ti-refresh" style={{ fontSize: 10 }} aria-hidden="true" />
              {chem.modes?.includes('normal') && chem.modes?.includes('maint') ? 'Both' : chem.modes?.includes('normal') ? 'Bi-weekly' : 'Deep Clean'}
            </button>
          )}
          {/* Status toggle */}
          <button onClick={() => !toggling && onToggleStatus(chem.name, setToggling)} title={chem.status === 'inactive' ? 'Move to active' : 'Move to library'}
            style={{ padding: '2px 8px', border: `1px solid ${chem.status === 'inactive' ? '#1a9e62' : 'var(--bd2)'}`, background: chem.status === 'inactive' ? '#1a9e62' : 'transparent', color: chem.status === 'inactive' ? '#fff' : 'var(--t3)', cursor: 'pointer', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>
            {toggling ? '...' : chem.status === 'inactive' ? 'Activate' : 'Library'}
          </button>
          <button onClick={() => setEditing(true)} title="Edit"
            style={{ background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--t3)', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
            <i className="ti ti-pencil" aria-hidden="true" />
          </button>
          <button onClick={handleDelete} title={confirmDel ? 'Confirm delete' : 'Delete'}
            style={{ background: confirmDel ? '#cc1e1e' : 'transparent', border: `1px solid ${confirmDel ? '#cc1e1e' : 'var(--bd2)'}`, color: confirmDel ? '#fff' : 'var(--t3)', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, flexShrink: 0 }}>
            <i className={`ti ${confirmDel ? 'ti-check' : 'ti-trash'}`} aria-hidden="true" />
          </button>
        </div>
      </div>
      {delStatus && <SyncStatus status={delStatus} />}
      <div className="chem-bd">
        <div className="chem-used">{chem.usedOn}</div>
        {chem.dilutions.map((d, i) => {
          const calculable = parseRatio(d.ratio) && parseRatio(d.ratio).type !== 'rtu'
          return (
            <div key={i} className="dil"
              onClick={() => onSelectDil({ name: chem.name, ctx: d.context, ratio: d.ratio })}
              style={{ cursor: calculable ? 'pointer' : 'default', transition: 'border-color 0.15s' }}
              onMouseEnter={e => { if (calculable) e.currentTarget.style.borderColor = '#0066b1' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '' }}
              title={calculable ? 'Tap to open calculator' : ''}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="dil-ctx">{d.context}</div>
                {calculable && (
                  <span style={{ fontSize: 9, color: '#0066b1', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0, marginLeft: 8 }}>
                    ⌕ Calc
                  </span>
                )}
              </div>
              <div className="dil-ratio">{d.ratio}</div>
              {d.amount && d.amount !== 'No dilution' && <div className="dil-amt">{d.amount}</div>}
              {d.note && <div className="dil-note">{d.note}</div>}
            </div>
          )
        })}
        {chem.tool && <div className="chem-tool"><i className="ti ti-tool" aria-hidden="true" /> {chem.tool}</div>}
        {chem.shelfLife && <div className="chem-shelf"><i className="ti ti-clock" aria-hidden="true" /><span><strong>Shelf life:</strong> {chem.shelfLife}</span></div>}
        {chem.storageNote && <div className="chem-shelf"><i className="ti ti-alert-circle" aria-hidden="true" /><span>{chem.storageNote}</span></div>}
      </div>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function TabChemicals({ data, mode }) {
  const [calcModal, setCalcModal] = useState(null) // { name, ctx, ratio } or null
  const [localData, setLocalData] = useState(null) // optimistic UI updates

  const chemicals = (localData || data).chemicals || []

  const handleToggleStatus = async (name, setToggling) => {
    setToggling(true)
    // Optimistic update
    const updated = { ...(localData || data), chemicals: (localData || data).chemicals.map(c => c.name === name ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' } : c) }
    setLocalData(updated)
    const config = getConfig()
    if (config.pat) {
      try { await toggleChemicalStatus(config, name) } catch(e) { setLocalData(null) }
    }
    setToggling(false)
  }

  const handleCycleMode = async (name, setCycling) => {
    setCycling(true)
    // Cycle modes optimistically
    const updated = { ...(localData || data), chemicals: (localData || data).chemicals.map(c => {
      if (c.name !== name) return c
      let modes = c.modes || ['normal', 'maint']
      if (modes.includes('normal') && modes.includes('maint')) modes = ['normal']
      else if (modes.includes('normal')) modes = ['maint']
      else modes = ['normal', 'maint']
      return { ...c, modes }
    })}
    setLocalData(updated)
    const config = getConfig()
    if (config.pat) {
      try { await cycleChemicalMode(config, name) } catch(e) { setLocalData(null) }
    }
    setCycling(false)
  }

  const active = chemicals.filter(c => c.status !== 'inactive' && c.modes.includes(mode))
  const library = chemicals.filter(c => c.status === 'inactive')
  const sorted = [...active].sort((a, b) => {
    const ai = CAT_ORDER.indexOf(a.category)
    const bi = CAT_ORDER.indexOf(b.category)
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })
  const cats = {}
  sorted.forEach(c => { if (!cats[c.category]) cats[c.category] = []; cats[c.category].push(c) })

  const modeLabel = mode === 'normal' ? 'Bi-weekly wash' : 'Deep Clean'

  return (
    <div style={{ padding: 16, width: '100%', boxSizing: 'border-box' }}>
      {calcModal && <CalcModal selected={calcModal} onClose={() => setCalcModal(null)} />}
      <div className="chem-content" style={{ minWidth: 0, maxWidth: 900 }}>
        <div className="notice info" style={{ marginBottom: 14 }}>
          <i className="ti ti-info-circle" aria-hidden="true" />
          <span>Showing chemicals for: <strong>{modeLabel}</strong>. Click any dilution card to load it into the calculator. <span style={{ opacity: 0.7 }}>⌕ Calc</span> indicates calculable ratios.</span>
        </div>
        <ChemChart chemicals={active} onSelectDil={setCalcModal} />
        <div className="cc-legend">
          <span className="cc-pill cc-pm">M</span> maint. only &nbsp;&nbsp;
          <span className="cc-pill cc-pn">N</span> normal only
        </div>
        {Object.entries(cats).map(([cat, chems]) => (
          <div key={cat}>
            <div className="slbl" style={{ marginTop: 12 }}>{cat}</div>
            {chems.map(c => <ChemCard key={c.name} chem={c} onSelectDil={setCalcModal} onToggleStatus={handleToggleStatus} onCycleMode={handleCycleMode} />)}
          </div>
        ))}
      </div>

      {/* Library — inactive chemicals */}
      {library.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="slbl" style={{ marginBottom: 8 }}>Chemical library - inactive</div>
          <div className="notice info" style={{ marginBottom: 12 }}>
            <i className="ti ti-archive" aria-hidden="true" />
            <span>{library.length} chemical{library.length !== 1 ? 's' : ''} in library. Tap <strong>Activate</strong> to add to an active wash.</span>
          </div>
          {library.map(c => (
            <ChemCard key={c.name} chem={c} onSelectDil={setCalcModal} onToggleStatus={handleToggleStatus} onCycleMode={handleCycleMode} />
          ))}
        </div>
      )}
    </div>
  )
}
