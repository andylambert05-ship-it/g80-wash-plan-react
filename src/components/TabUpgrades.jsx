import { useState } from 'react'

function loadUpgradeState() {
  try { return JSON.parse(localStorage.getItem('gwp_upgrades') || '{}') } catch { return {} }
}
function saveUpgradeState(state) {
  try { localStorage.setItem('gwp_upgrades', JSON.stringify(state)) } catch {}
}
function loadCustomUpgrades() {
  try { return JSON.parse(localStorage.getItem('gwp_custom_upgrades') || '[]') } catch { return [] }
}
function saveCustomUpgrades(items) {
  try { localStorage.setItem('gwp_custom_upgrades', JSON.stringify(items)) } catch {}
}

const SOURCE_COLORS = { Self: '#0066b1', Shop: '#cc1e1e' }
const SOURCE_BG = { Self: '#0d1a2e', Shop: '#1a0000' }
const SOURCE_BD = { Self: '#0d2040', Shop: '#2a0000' }

export default function TabUpgrades({ data }) {
  const [doneState, setDoneState] = useState(loadUpgradeState)
  const [custom, setCustom] = useState(loadCustomUpgrades)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ phase: '', customPhase: '', item: '', source: 'Self', notes: '' })

  if (!data.upgrades) return (
    <div className="panel">
      <div className="notice info">
        <i className="ti ti-info-circle" aria-hidden="true" />
        <span>Upgrades data not found in wash-plan.json.</span>
      </div>
    </div>
  )

  const baseItems = data.upgrades.items || []
  const allItems = [...baseItems, ...custom]

  const toggle = (id) => {
    const next = { ...doneState, [id]: !doneState[id] }
    setDoneState(next)
    saveUpgradeState(next)
    try { navigator.vibrate && navigator.vibrate(12) } catch (e) {}

  }

  const addItem = () => {
    const phase = form.phase === '__custom__' ? form.customPhase.trim() : form.phase
    if (!form.item.trim() || !phase) return
    const newItem = {
      id: 'custom-' + Date.now(),
      phase,
      item: form.item.trim(),
      source: form.source,
      notes: form.notes.trim(),
      custom: true
    }
    const next = [...custom, newItem]
    setCustom(next)
    saveCustomUpgrades(next)
    setForm({ phase: '', customPhase: '', item: '', source: 'Self', notes: '' })
    setShowForm(false)
  }

  const removeCustom = (id) => {
    const next = custom.filter(c => c.id !== id)
    setCustom(next)
    saveCustomUpgrades(next)
  }

  // Group by phase preserving order
  const phaseOrder = []
  const phases = {}
  allItems.forEach(item => {
    if (!phases[item.phase]) { phases[item.phase] = []; phaseOrder.push(item.phase) }
    phases[item.phase].push(item)
  })

  const totalDone = allItems.filter(i => doneState[i.id]).length
  const total = allItems.length
  const pct = total > 0 ? Math.round((totalDone / total) * 100) : 0
  const existingPhases = [...new Set(baseItems.map(i => i.phase))]
  const canSubmit = form.item.trim() && (form.phase !== '' && form.phase !== '__custom__' || form.customPhase.trim())

  return (
    <div className="panel">
      <div className="notice info" style={{ borderLeftColor: '#0066b1' }}>
        <i className="ti ti-car" aria-hidden="true" />
        <span>{data.upgrades.note}</span>
      </div>

      <div className="prog-wrap">
        <div className="prog-meta">
          <span className="prog-lbl">Progress</span>
          <span className="prog-ct">{totalDone} / {total}</span>
        </div>
        <div className="prog-track">
          <div className="prog-bar" style={{ width: `${pct}%`, background: '#0066b1' }} />
        </div>
      </div>

      <button className="rbtn" onClick={() => setShowForm(s => !s)} style={{ marginBottom: 16 }}>
        <i className="ti ti-plus" aria-hidden="true" /> {showForm ? 'Cancel' : 'Add upgrade'}
      </button>

      {showForm && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t3)', marginBottom: 12 }}>New Upgrade</div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Phase</label>
            <select
              value={form.phase}
              onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
            >
              <option value="">— Select phase —</option>
              {existingPhases.map(p => <option key={p} value={p}>{p}</option>)}
              <option value="__custom__">New phase...</option>
            </select>
            {form.phase === '__custom__' && (
              <input
                value={form.customPhase}
                onChange={e => setForm(f => ({ ...f, customPhase: e.target.value }))}
                placeholder="New phase name"
                style={{ width: '100%', marginTop: 6, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
              />
            )}
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Item *</label>
            <input
              value={form.item}
              onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
              placeholder="Upgrade item name"
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
            />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Source</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Self', 'Shop'].map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, source: s }))}
                  style={{ padding: '5px 14px', border: '1px solid', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: form.source === s ? SOURCE_COLORS[s] : 'transparent', color: form.source === s ? '#fff' : 'var(--t3)', borderColor: form.source === s ? SOURCE_COLORS[s] : 'var(--bd2)' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Optional notes"
              rows={2}
              style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', resize: 'vertical' }}
            />
          </div>

          <button onClick={addItem} disabled={!canSubmit}
            style={{ background: '#0066b1', color: '#fff', border: 'none', padding: '8px 18px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'Inter, sans-serif', opacity: canSubmit ? 1 : 0.4 }}>
            Add Item
          </button>
        </div>
      )}

      {phaseOrder.map(phase => {
        const items = phases[phase]
        const phaseDone = items.filter(i => doneState[i.id]).length
        return (
          <div key={phase} style={{ marginBottom: 20 }}>
            <div className="phase-hdr" style={{ borderLeftColor: '#0066b1', color: '#ffffff', fontSize: 13 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#ffffff', flexShrink: 0 }} />
              {phase}
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', marginLeft: 4 }}>({phaseDone}/{items.length})</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {items.map(item => {
                const isDone = !!doneState[item.id]
                return (
                  <div key={item.id} onClick={() => toggle(item.id)}
                    style={{ background: 'var(--card)', border: '1px solid var(--bd)', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', opacity: isDone ? 0.35 : 1, position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: '#0066b1' }} />
                    <div style={{ width: 20, height: 20, border: `1px solid ${isDone ? '#0066b1' : 'var(--bd2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isDone ? '#0066b1' : 'transparent', marginTop: 1 }}>
                      {isDone && <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }} aria-hidden="true" />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {item.item}
                        <span style={{ fontSize: 9, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: SOURCE_BG[item.source] || 'var(--card2)', color: SOURCE_COLORS[item.source] || 'var(--t3)', border: `1px solid ${SOURCE_BD[item.source] || 'var(--bd2)'}` }}>
                          {item.source}
                        </span>
                        {item.custom && (
                          <span style={{ fontSize: 9, padding: '2px 7px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', background: 'var(--card2)', color: 'var(--t3)', border: '1px solid var(--bd2)' }}>Custom</span>
                        )}
                      </div>
                      {item.notes && <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6, fontWeight: 300 }}>{item.notes}</div>}
                    </div>
                    {item.custom && (
                      <button onClick={e => { e.stopPropagation(); removeCustom(item.id) }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 14, padding: '0 4px', flexShrink: 0 }}>
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
