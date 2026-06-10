import { SEASON_COLORS } from '../constants'
import StepCard from './StepCard'
import ResetButton from './ResetButton'
import { useState } from 'react'
import { EditToolForm, SyncStatus } from './SyncForm'
import { getConfig, deleteTool } from '../utils/GitHubSync'

// ── ShortList ────────────────────────────────────────────────────────────────
const SL_NORMAL = [
  { n: 1, t: 'Koch Chemie MWC — wheels', note: 'dwell 2–5 min' },
  { n: 2, t: 'CarPro ReTyre — tire sidewalls', note: 'dwell 30 sec' },
  { n: 3, t: 'AllClean or Surfex HD — wheel wells' },
  { n: 4, t: 'CarPro Bug Out', note: 'dwell 5–30 sec' },
  { n: 5, t: 'CarPro Tar X', note: 'dwell 2–3 min' },
  { n: 6, t: 'CarPro Reset — IK E Foam Pro 12 pre-foam', note: '12–15ml / 6L — dwell 5 min, rinse' },
  { n: 7, t: 'CarPro Iron X', note: 'dwell 3–5 min, rinse' },
  { n: 8, t: 'CarPro Reset — 2-bucket wash', note: '30ml per 15L' },
  { n: 9, t: 'CarPro Reload 2.0' },
  { n: 10, t: 'P21S Polishing Soap — exhaust tips' },
  { n: 11, t: 'BH Trace-Less or Koch Chemie Glass Cleaner — exterior & interior glass' },
  { n: 12, t: 'CarPro Darkside — tire sidewalls' },
  { n: 13, t: '303 Aerospace Protectant — trim & rubber seals', note: 'wipe completely dry' },
  { n: 14, t: "McKee's 37 N-914 — final inspection", note: '60–90ml per 950ml water' },
]

const SL_MAINT = [
  { n: 1, t: 'Koch Chemie MWC — wheels', note: 'dwell 2–5 min' },
  { n: 2, t: 'CarPro ReTyre — tire sidewalls', note: 'dwell 30 sec' },
  { n: 3, t: 'AllClean or Surfex HD — wheel wells & door jambs' },
  { n: 4, t: 'CarPro Bug Out', note: 'dwell 5–30 sec' },
  { n: 5, t: 'CarPro Tar X', note: 'dwell 2–3 min' },
  { n: 6, t: 'BH Touchless — IK E Foam Pro 12', note: '60ml @ 1% PIR to 120ml @ 2% PIR — dwell 1–5 min, rinse' },
  { n: 7, t: 'CarPro Iron X', note: 'dwell 3–5 min, rinse' },
  { n: 8, t: 'CarPro Descale — 2-bucket wash', note: '150ml per 15L' },
  { n: 9, t: 'CarPro Reload 2.0' },
  { n: 10, t: 'P21S Polishing Soap — exhaust tips' },
  { n: 11, t: 'BH Trace-Less or Koch Chemie Glass Cleaner — exterior & interior glass' },
  { n: 12, t: 'CarPro Darkside — tire sidewalls' },
  { n: 13, t: '303 Aerospace Protectant — trim & rubber seals', note: 'wipe completely dry' },
  { n: 14, t: "McKee's 37 N-914 — final inspection", note: '60–90ml per 950ml water' },
]

export function TabShortList({ mode }) {
  const list = mode === 'normal' ? SL_NORMAL : SL_MAINT
  const title = mode === 'normal' ? 'Bi-weekly Wash' : 'Deep Clean'
  return (
    <div className="panel">
      <div className="sl-header">
        <span className="sl-title">{title}</span>
        <span className="sl-sub">Chemicals in wash sequence · dwell times shown</span>
      </div>
      <div className="sl-list">
        {list.map(item => (
          <div key={item.n} className="sl-item">
            <span className="sl-num">{item.n}</span>
            <span className="sl-text">
              {item.t}
              {item.note && <span className="sl-note"> — {item.note}</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tools ────────────────────────────────────────────────────────────────────
export function TabTools({ data }) {
  const [editingTool, setEditingTool] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [delStatus, setDelStatus] = useState({})

  const handleDeleteTool = async (name) => {
    if (confirmDel !== name) { setConfirmDel(name); setTimeout(() => setConfirmDel(null), 3000); return }
    const config = getConfig()
    if (!config.pat) { setDelStatus(s => ({ ...s, [name]: { type: 'nopat' } })); return }
    setDelStatus(s => ({ ...s, [name]: { type: 'saving' } }))
    try {
      await deleteTool(config, name)
      setDelStatus(s => ({ ...s, [name]: { type: 'success' } }))
    } catch (e) {
      setDelStatus(s => ({ ...s, [name]: { type: 'error', message: e.message } }))
    }
  }

  const cats = {}
  data.tools.forEach(t => {
    if (!cats[t.category]) cats[t.category] = []
    cats[t.category].push(t)
  })
  return (
    <div className="panel">
      {editingTool && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, overflowY: 'auto', padding: 16 }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <EditToolForm tool={editingTool} onClose={() => setEditingTool(null)} />
          </div>
        </div>
      )}
      {Object.entries(cats).map(([cat, tools]) => (
        <div key={cat}>
          <div className="slbl">{cat}</div>
          <div className="tbl">
            <div className="tr tc3 th">
              <div className="td">Tool</div><div className="td">Qty</div><div className="td">Used for</div><div className="td" style={{ width: 60 }}></div>
            </div>
            {tools.map(t => (
              <div key={t.name}>
                <div className="tr tc3">
                  <div className="td">{t.name}</div>
                  <div className="td m">{t.qty}</div>
                  <div className="td m">{t.usedFor}</div>
                  <div className="td" style={{ width: 60, display: 'flex', gap: 4, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <button onClick={() => setEditingTool(t)} title="Edit"
                      style={{ background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--t3)', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                      <i className="ti ti-pencil" aria-hidden="true" />
                    </button>
                    <button onClick={() => handleDeleteTool(t.name)} title={confirmDel === t.name ? 'Confirm' : 'Delete'}
                      style={{ background: confirmDel === t.name ? '#cc1e1e' : 'transparent', border: `1px solid ${confirmDel === t.name ? '#cc1e1e' : 'var(--bd2)'}`, color: confirmDel === t.name ? '#fff' : 'var(--t3)', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                      <i className={`ti ${confirmDel === t.name ? 'ti-check' : 'ti-trash'}`} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {delStatus[t.name] && <SyncStatus status={delStatus[t.name]} />}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="slbl">Version history</div>
      {(data.meta.changelog || []).map((entry, i) => (
        <div key={i} className="changelog-entry">{entry}</div>
      ))}
    </div>
  )
}

// ── Interior ─────────────────────────────────────────────────────────────────
export function TabInterior({ data, intDone, onToggle, onReset, onStartTimer }) {
  const steps = data.interiorDetail.steps
  const n = steps.filter(s => intDone.has(s.id)).length
  const t = steps.length
  const pct = t > 0 ? Math.round((n / t) * 100) : 0
  return (
    <div className="panel">
      <div className="notice opt">
        <i className="ti ti-info-circle" aria-hidden="true" />
        <span><strong>Optional — as needed.</strong> {data.interiorDetail.note}</span>
      </div>
      <div className="prog-wrap">
        <div className="prog-meta">
          <span className="prog-lbl">Progress</span>
          <span className="prog-ct">{n} / {t}</span>
        </div>
        <div className="prog-track"><div className="prog-bar" style={{ width: `${pct}%` }} /></div>
      </div>
      <ResetButton onReset={onReset} label="Reset interior steps" />
      <div className="steps-list">
        {steps.map((s, idx) => (
          <StepCard
            key={s.id}
            step={{ ...s, title: s.title }}
            index={idx}
            isDone={intDone.has(s.id)}
            onToggle={onToggle}
            onStartTimer={onStartTimer}
          />
        ))}
      </div>
      <div className="slbl" style={{ marginTop: 20 }}>Interior chemicals & dilutions</div>
      {data.interiorDetail.chemicals.map(c => (
        <div key={c.name} className="chem-card">
          <div className="chem-hd">
            <div>
              <div className="chem-nm">{c.name}</div>
              <div className="chem-cat">{c.category}</div>
            </div>
          </div>
          <div className="chem-bd">
            <div className="chem-used">{c.usedOn}</div>
            {c.dilutions.map((d, i) => (
              <div key={i} className="dil">
                <div className="dil-ctx">{d.context}</div>
                <div className="dil-ratio">{d.ratio}</div>
                {d.amount && d.amount !== 'No dilution' && <div className="dil-amt">{d.amount}</div>}
                {d.note && <div className="dil-note">{d.note}</div>}
              </div>
            ))}
            {c.tool && <div className="chem-tool"><i className="ti ti-tool" aria-hidden="true" /> {c.tool}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Engine Bay ───────────────────────────────────────────────────────────────
export function TabEngine({ data, engDone, onToggle, onReset }) {
  const steps = data.engineBay.steps
  const n = steps.filter(s => engDone.has(s.id)).length
  const t = steps.length
  const pct = t > 0 ? Math.round((n / t) * 100) : 0
  const { coverBeforeWater } = data.engineBay
  return (
    <div className="panel">
      <div className="notice opt">
        <i className="ti ti-info-circle" aria-hidden="true" />
        <span><strong>Optional — standalone session only.</strong> {data.engineBay.note}</span>
      </div>
      {coverBeforeWater && (
        <div className="notice warn" style={{ flexDirection: 'column', gap: 8 }}>
          <div style={{ fontWeight: 500, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-alert-triangle" aria-hidden="true" />
            Cover before any water contact
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {coverBeforeWater.bagAndTape && (
              <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Bag &amp; tape — critical</div>
                {coverBeforeWater.bagAndTape.map(item => <div key={item}>{item}</div>)}
              </div>
            )}
            {coverBeforeWater.avoidDirectSpray && (
              <div style={{ fontSize: 11, lineHeight: 1.6 }}>
                <div style={{ fontWeight: 600, marginBottom: 3 }}>Avoid direct spray</div>
                {coverBeforeWater.avoidDirectSpray.map(item => <div key={item}>{item}</div>)}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="prog-wrap">
        <div className="prog-meta">
          <span className="prog-lbl">Engine steps</span>
          <span className="prog-ct">{n} / {t}</span>
        </div>
        <div className="prog-track"><div className="prog-bar" style={{ width: `${pct}%` }} /></div>
      </div>
      <ResetButton onReset={onReset} label="Reset engine steps" />
      <div className="steps-list">
        {steps.map((s, idx) => (
          <StepCard
            key={s.id}
            step={{ ...s, title: s.title }}
            index={idx}
            isDone={engDone.has(s.id)}
            onToggle={onToggle}
            onStartTimer={() => {}}
          />
        ))}
      </div>
    </div>
  )
}

// ── Between Washes ───────────────────────────────────────────────────────────
export function TabBetweenWash({ data }) {
  return (
    <div className="panel">
      <div className="notice info">
        <i className="ti ti-info-circle" aria-hidden="true" />
        <span>{data.betweenWash.note}</span>
      </div>
      {data.betweenWash.steps.map((s, idx) => (
        <div key={s.id} className="bw-step">
          <div className="bw-step-t">{idx + 1}. {s.title}</div>
          <div className="bw-step-d">{s.desc}</div>
          {(s.tools?.length || s.chems?.length) && (
            <div className="tags">
              {(s.tools || []).map(t => (
                <span key={t} className="tag tl">
                  <i className="ti ti-tool" style={{ fontSize: 10, marginRight: 2 }} aria-hidden="true" />{t}
                </span>
              ))}
              {(s.chems || []).map(c => (
                <span key={c} className="tag tc">
                  <i className="ti ti-flask" style={{ fontSize: 10, marginRight: 2 }} aria-hidden="true" />{c}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Seasonal ─────────────────────────────────────────────────────────────────
export function TabSeasonal({ data }) {
  return (
    <div className="panel">
      <div className="notice info">
        <i className="ti ti-map-pin" aria-hidden="true" />
        <span><strong>{data.seasonalNotes.location}</strong> — season-specific guidance for washing, chemical application, and coating care.</span>
      </div>
      {data.seasonalNotes.seasons.map(s => {
        const color = SEASON_COLORS[s.season] || '#505068'
        return (
          <div key={s.season} className="season-card">
            <div className="season-hdr" style={{ color }}>{s.icon} {s.season}</div>
            <ul className="season-list">
              {s.notes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
