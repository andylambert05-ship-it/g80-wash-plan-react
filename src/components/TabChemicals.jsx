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
