import React, { useState } from 'react'
import { getBrand, getShortName, CAT_ORDER } from '../constants'

function ChemChart({ chemicals }) {
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
            <div className="cc-cell cc-ratio">{ratio}</div>
          </div>
        )
      })}
    </div>
  )
}


// ── Ratio parser ────────────────────────────────────────────────────────────
function parseRatio(ratio) {
  if (!ratio) return null
  const r = ratio.trim()

  // Non-calculable
  if (['RTU', 'Direct', 'Neat to 100%'].includes(r)) return { type: 'rtu' }

  // Fixed amount : volume  e.g. "30ml : 10L", "60–90ml : 950ml water"
  const fixedMatch = r.match(/^([\d.–]+)ml\s*:\s*([\d.]+)\s*(L|ml)/i)
  if (fixedMatch) {
    const productMl = fixedMatch[1].includes('–')
      ? fixedMatch[1].split('–').map(Number)
      : [parseFloat(fixedMatch[1]), parseFloat(fixedMatch[1])]
    const waterMl = fixedMatch[3].toLowerCase() === 'l'
      ? parseFloat(fixedMatch[2]) * 1000
      : parseFloat(fixedMatch[2])
    return { type: 'fixed', productMl, waterMl }
  }

  // PIR  e.g. "1% PIR", "2% PIR", "1%–2%", "1% PIR or 2% PIR"
  const pirMatch = r.match(/([\d.]+)%(?:–([\d.]+)%)?/)
  if (pirMatch && (r.includes('PIR') || r.includes('%'))) {
    const lo = parseFloat(pirMatch[1])
    const hi = pirMatch[2] ? parseFloat(pirMatch[2]) : lo
    return { type: 'pir', lo, hi }
  }

  // X:1 (concentrate heavy)  e.g. "400–500:1", "3:1", "3:1–5:1", "5:1–10:1"
  const xto1 = r.match(/^([\d.]+):1(?:–([\d.]+):1)?$/)
  if (xto1) {
    const lo = parseFloat(xto1[1])
    const hi = xto1[2] ? parseFloat(xto1[2]) : lo
    return { type: 'xto1', lo, hi }
  }

  // 1:X (dilute light)  e.g. "1:100", "1:20", "1:10"
  const oto1 = r.match(/^1:([\d.]+)$/)
  if (oto1) {
    const x = parseFloat(oto1[1])
    return { type: '1tox', x }
  }

  // Percentage  e.g. "10%", "5%–10%", "2%–3%"
  const pctMatch = r.match(/^([\d.]+)%(?:–([\d.]+)%)?$/)
  if (pctMatch) {
    const lo = parseFloat(pctMatch[1])
    const hi = pctMatch[2] ? parseFloat(pctMatch[2]) : lo
    return { type: 'pct', lo, hi }
  }

  return null
}

function calcProduct(parsed, containerMl) {
  if (!parsed || !containerMl || containerMl <= 0) return null
  switch (parsed.type) {
    case 'rtu': return { type: 'rtu' }
    case 'pir': {
      const lo = (parsed.lo / 100) * containerMl
      const hi = (parsed.hi / 100) * containerMl
      return { lo, hi, same: lo === hi }
    }
    case 'pct': {
      const lo = (parsed.lo / 100) * containerMl
      const hi = (parsed.hi / 100) * containerMl
      return { lo, hi, same: lo === hi }
    }
    case 'xto1': {
      // ratio:1 means ratio parts water : 1 part product
      const lo = containerMl / (parsed.lo + 1)
      const hi = containerMl / (parsed.hi + 1)
      return { lo: Math.min(lo, hi), hi: Math.max(lo, hi), same: lo === hi }
    }
    case '1tox': {
      // 1:X means 1 part product : X parts water
      const product = containerMl / (parsed.x + 1)
      return { lo: product, hi: product, same: true }
    }
    case 'fixed': {
      // Scale from reference volume
      const scale = containerMl / parsed.waterMl
      return {
        lo: parsed.productMl[0] * scale,
        hi: parsed.productMl[parsed.productMl.length - 1] * scale,
        same: parsed.productMl[0] === parsed.productMl[parsed.productMl.length - 1]
      }
    }
    default: return null
  }
}

function fmtMl(n) {
  if (n >= 1000) return (n / 1000).toFixed(2).replace(/\.?0+$/, '') + 'L'
  return n < 10 ? n.toFixed(1) : Math.round(n) + 'ml'
}

// ── Dilution Calculator Widget ───────────────────────────────────────────────
function DilutionCalc({ ratio }) {
  const [containerMl, setContainerMl] = useState('')
  const [unit, setUnit] = useState('ml')

  const parsed = parseRatio(ratio)
  if (!parsed || parsed.type === 'rtu') return null

  const inputMl = containerMl
    ? (unit === 'L' ? parseFloat(containerMl) * 1000 : parseFloat(containerMl))
    : 0
  const result = calcProduct(parsed, inputMl)

  return (
    <div style={{ marginTop: 10, background: 'var(--card)', border: '1px solid var(--bd2)', padding: '10px 12px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t3)', marginBottom: 8 }}>
        Dilution Calculator
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="number"
          min="0"
          placeholder="Container size"
          value={containerMl}
          onChange={e => setContainerMl(e.target.value)}
          style={{ width: 120, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '5px 8px', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 0 }}>
          {['ml', 'L'].map(u => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              style={{ padding: '5px 10px', border: '1px solid var(--bd2)', background: unit === u ? '#0066b1' : 'transparent', color: unit === u ? '#fff' : 'var(--t3)', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              {u}
            </button>
          ))}
        </div>
        {result && inputMl > 0 && (
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a9e62', paddingLeft: 4 }}>
            {result.same
              ? `→ ${fmtMl(result.lo)} product`
              : `→ ${fmtMl(result.lo)}–${fmtMl(result.hi)} product`}
          </div>
        )}
      </div>
      {result && inputMl > 0 && (
        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 5, fontWeight: 300 }}>
          Add {result.same ? fmtMl(result.lo) : `${fmtMl(result.lo)}–${fmtMl(result.hi)}`} of product to {containerMl}{unit} of water
        </div>
      )}
    </div>
  )
}

function ChemCard({ chem }) {
  const normalOnly = chem.modes.length === 1 && chem.modes[0] === 'normal'
  const maintOnly = chem.modes.length === 1 && chem.modes[0] === 'maint'
  return (
    <div className="chem-card">
      <div className="chem-hd">
        <div>
          <div className="chem-nm">{chem.name}</div>
          <div className="chem-cat">{chem.category}</div>
        </div>
        {maintOnly && <span className="pill pm">maint. only</span>}
        {normalOnly && <span className="pill po">normal only</span>}
      </div>
      <div className="chem-bd">
        <div className="chem-used">{chem.usedOn}</div>
        {chem.dilutions.map((d, i) => (
          <div key={i} className="dil">
            <div className="dil-ctx">{d.context}</div>
            <div className="dil-ratio">{d.ratio}</div>
            {d.amount && d.amount !== 'No dilution' && <div className="dil-amt">{d.amount}</div>}
            {d.note && <div className="dil-note">{d.note}</div>}
            <DilutionCalc ratio={d.ratio} />
          </div>
        ))}
        {chem.tool && (
          <div className="chem-tool">
            <i className="ti ti-tool" aria-hidden="true" />
            {chem.tool}
          </div>
        )}
        {chem.shelfLife && (
          <div className="chem-shelf">
            <i className="ti ti-clock" aria-hidden="true" />
            <span><strong>Shelf life:</strong> {chem.shelfLife}</span>
          </div>
        )}
        {chem.storageNote && (
          <div className="chem-shelf">
            <i className="ti ti-alert-circle" aria-hidden="true" />
            <span>{chem.storageNote}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TabChemicals({ data, mode }) {
  const active = data.chemicals.filter(c => c.modes.includes(mode))
  const sorted = [...active].sort((a, b) => {
    const ai = CAT_ORDER.indexOf(a.category)
    const bi = CAT_ORDER.indexOf(b.category)
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi)
  })

  const cats = {}
  sorted.forEach(c => {
    if (!cats[c.category]) cats[c.category] = []
    cats[c.category].push(c)
  })

  const modeLabel = mode === 'normal' ? 'Bi-weekly wash' : 'Ceramic maintenance wash'

  return (
    <div className="panel">
      <div className="notice info">
        <i className="ti ti-info-circle" aria-hidden="true" />
        <span>Showing chemicals for: <strong>{modeLabel}</strong>. Ratios are for IK E Foam sprayers — not pressure washer foam cannons.</span>
      </div>

      <ChemChart chemicals={active} />
      <div className="cc-legend">
        <span className="cc-pill cc-pm">M</span> maint. only &nbsp;&nbsp;
        <span className="cc-pill cc-pn">N</span> normal only
      </div>

      <div className="slbl">Full dilution details</div>
      {Object.entries(cats).map(([cat, chems]) => (
        <div key={cat}>
          <div className="slbl" style={{ marginTop: 12 }}>{cat}</div>
          {chems.map(c => <ChemCard key={c.name} chem={c} />)}
        </div>
      ))}
    </div>
  )
}
