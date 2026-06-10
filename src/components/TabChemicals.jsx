import { useState } from 'react'
import { getBrand, getShortName, CAT_ORDER } from '../constants'
import { EditChemicalForm, SyncStatus } from './SyncForm'
import { getConfig, deleteChemical } from '../utils/GitHubSync'

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

// ── Sticky Calculator Panel ───────────────────────────────────────────────────
function StickyCalc({ selected }) {
  const [containerVal, setContainerVal] = useState('')
  const [unit, setUnit] = useState('ml')
  const [manualMode, setManualMode] = useState(false)
  const [manualRatio, setManualRatio] = useState('')

  const activeRatio = manualMode ? manualRatio : (selected?.ratio || '')
  const parsed = parseRatio(activeRatio)
  const containerMl = containerVal ? (unit === 'L' ? parseFloat(containerVal) * 1000 : parseFloat(containerVal)) : 0
  const result = calcProduct(parsed, containerMl)

  return (
    <div className="calc-panel-wrap"><div className="calc-panel-inner">
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--t3)', marginBottom: 12 }}>
        Dilution Calculator
      </div>

      {/* Selected chemical */}
      <div style={{ marginBottom: 12 }}>
        {selected ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{selected.name}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 6 }}>{selected.ctx}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--blue)', letterSpacing: '-0.5px' }}>{selected.ratio}</div>
            {parsed && parsed.type !== 'rtu' && (
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3, fontWeight: 300 }}>{ratioLabel(parsed.type)}</div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 300, fontStyle: 'italic' }}>
            Click a dilution card to load its ratio
          </div>
        )}
      </div>

      {/* Manual override toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingTop: 10, borderTop: '1px solid var(--bd)' }}>
        <button
          onClick={() => setManualMode(m => !m)}
          style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 10px', border: '1px solid var(--bd2)', background: manualMode ? '#0066b1' : 'transparent', color: manualMode ? '#fff' : 'var(--t3)', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
        >
          Manual ratio
        </button>
        {manualMode && (
          <input
            value={manualRatio}
            onChange={e => setManualRatio(e.target.value)}
            placeholder="e.g. 1:10, 5%, 400:1"
            style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '4px 8px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }}
          />
        )}
      </div>

      {/* Container size input */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', marginBottom: 6 }}>Container size</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number"
            min="0"
            placeholder="e.g. 6000"
            value={containerVal}
            onChange={e => setContainerVal(e.target.value)}
            style={{ flex: 1, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 14, fontFamily: 'Inter, sans-serif', outline: 'none', minWidth: 0 }}
          />
          <div style={{ display: 'flex' }}>
            {['ml', 'L'].map(u => (
              <button key={u} onClick={() => setUnit(u)}
                style={{ padding: '7px 12px', border: '1px solid var(--bd2)', background: unit === u ? '#0066b1' : 'transparent', color: unit === u ? '#fff' : 'var(--t3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Result */}
      {containerMl > 0 && result && (
        <div style={{ background: result.type === 'rtu' ? 'var(--card2)' : 'var(--green-bg)', border: `1px solid ${result.type === 'rtu' ? 'var(--bd2)' : 'var(--iom-bd)'}`, padding: '12px 14px', marginTop: 10 }}>
          {result.type === 'rtu' ? (
            <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 300 }}>RTU — use undiluted. No product calculation needed.</div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, marginBottom: 4 }}>Add to {containerVal}{unit} of water</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--iom)', letterSpacing: '-1px', lineHeight: 1.1 }}>
                {Math.abs(result.lo - result.hi) < 0.5 ? fmtMl(result.lo) : `${fmtMl(result.lo)}–${fmtMl(result.hi)}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4, fontWeight: 300 }}>of product</div>
            </>
          )}
        </div>
      )}
      {containerMl > 0 && !result && (
        <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-bd)', padding: '10px 14px', marginTop: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 300 }}>Cannot calculate this ratio format. Use the manual ratio field above.</div>
        </div>
      )}
      {!containerMl && (parsed && parsed.type !== 'rtu') && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 10, fontWeight: 300, fontStyle: 'italic' }}>Enter a container size above to calculate.</div>
      )}
    </div></div>
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
function ChemCard({ chem, onSelectDil }) {
  const [editing, setEditing] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [delStatus, setDelStatus] = useState(null)

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
              title={calculable ? 'Click to load into calculator' : ''}
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
  const [selectedDil, setSelectedDil] = useState(null)

  const active = data.chemicals.filter(c => c.modes.includes(mode))
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
      <div className="chem-content" style={{ minWidth: 0, maxWidth: 900 }}>
        <div className="notice info" style={{ marginBottom: 14 }}>
          <i className="ti ti-info-circle" aria-hidden="true" />
          <span>Showing chemicals for: <strong>{modeLabel}</strong>. Click any dilution card to load it into the calculator. <span style={{ opacity: 0.7 }}>⌕ Calc</span> indicates calculable ratios.</span>
        </div>
        <ChemChart chemicals={active} onSelectDil={setSelectedDil} />
        <div className="cc-legend">
          <span className="cc-pill cc-pm">M</span> maint. only &nbsp;&nbsp;
          <span className="cc-pill cc-pn">N</span> normal only
        </div>
        {Object.entries(cats).map(([cat, chems]) => (
          <div key={cat}>
            <div className="slbl" style={{ marginTop: 12 }}>{cat}</div>
            {chems.map(c => <ChemCard key={c.name} chem={c} onSelectDil={setSelectedDil} />)}
          </div>
        ))}
      </div>

      <StickyCalc selected={selectedDil} />
    </div>
  )
}
