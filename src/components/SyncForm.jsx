// Reusable sync status indicator for GitHub write-back forms
import { useState } from 'react'
import { getConfig, addChemical, addTool, addUpgrade } from '../utils/GitHubSync'

export function SyncStatus({ status }) {
  if (!status) return null
  const map = {
    saving: { color: '#0066b1', bg: 'var(--blue-bg)', bd: 'var(--blue-bd)', icon: 'ti-loader-2', spin: true, text: 'Saving to GitHub…' },
    success: { color: '#1a9e62', bg: 'var(--green-bg)', bd: 'var(--iom-bd)', icon: 'ti-circle-check', text: 'Saved! Deploying in ~60 seconds.' },
    error: { color: '#cc1e1e', bg: 'var(--red-bg)', bd: 'var(--red-bd)', icon: 'ti-alert-circle', text: null },
    nopat: { color: '#c8860a', bg: 'var(--amber-bg)', bd: 'var(--amber-bd)', icon: 'ti-alert-triangle', text: 'No GitHub token configured. Go to Settings tab to set up.' },
  }
  const s = map[status.type]
  if (!s) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: s.bg, border: `1px solid ${s.bd}`, marginTop: 10 }}>
      <i className={`ti ${s.icon}${s.spin ? ' spin' : ''}`} style={{ color: s.color, fontSize: 14, flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
      <div style={{ fontSize: 12, color: s.color, fontWeight: 300 }}>{s.text || status.message}</div>
    </div>
  )
}

// Hook for GitHub sync operations
export function useGitHubSync() {
  const [syncStatus, setSyncStatus] = useState(null)

  const sync = async (operation, ...args) => {
    const config = getConfig()
    if (!config.pat) {
      setSyncStatus({ type: 'nopat' })
      return false
    }
    setSyncStatus({ type: 'saving' })
    try {
      await operation(config, ...args)
      setSyncStatus({ type: 'success' })
      setTimeout(() => setSyncStatus(null), 5000)
      return true
    } catch (e) {
      setSyncStatus({ type: 'error', message: e.message })
      return false
    }
  }

  return { syncStatus, sync, setSyncStatus }
}

// Add Chemical Form
export function AddChemicalForm({ data, onClose }) {
  const { syncStatus, sync } = useGitHubSync()
  const [form, setForm] = useState({
    name: '', category: '', modes: ['normal', 'maint'], usedOn: '',
    shelfLife: '', storageNote: '', tool: '',
    dilutions: [{ context: '', ratio: '', amount: '', note: '' }],
  })

  const categories = [...new Set((data?.chemicals || []).map(c => c.category))].sort()
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))
  const updateDil = (i, key, val) => {
    const next = form.dilutions.map((d, idx) => idx === i ? { ...d, [key]: val } : d)
    f('dilutions', next)
  }
  const addDil = () => f('dilutions', [...form.dilutions, { context: '', ratio: '', amount: '', note: '' }])
  const removeDil = (i) => f('dilutions', form.dilutions.filter((_, idx) => idx !== i))

  const handleSave = async () => {
    if (!form.name.trim() || !form.category.trim()) return
    const chem = {
      name: form.name.trim(),
      category: form.category.trim(),
      modes: form.modes,
      usedOn: form.usedOn.trim(),
      shelfLife: form.shelfLife.trim() || null,
      storageNote: form.storageNote.trim() || null,
      tool: form.tool.trim() || null,
      openedDate: null,
      dilutions: form.dilutions.filter(d => d.ratio.trim()).map(d => ({
        context: d.context.trim(),
        ratio: d.ratio.trim(),
        amount: d.amount.trim() || null,
        note: d.note.trim() || null,
      })),
    }
    const ok = await sync(addChemical, chem)
    if (ok && onClose) setTimeout(onClose, 2000)
  }

  const inp = (label, key, opts = {}) => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input type={opts.type || 'text'} value={form[key]} onChange={e => f(key, e.target.value)} placeholder={opts.placeholder}
        style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
    </div>
  )

  const canSave = form.name.trim() && form.category.trim() && syncStatus?.type !== 'saving'

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        Add Chemical
        {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 16 }}>×</button>}
      </div>
      {inp('Product name *', 'name', { placeholder: 'e.g. CarPro HydrO2 Foam' })}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Category *</label>
        <select value={form.category} onChange={e => f('category', e.target.value)}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
          <option value="">— Select or type below —</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={form.category} onChange={e => f('category', e.target.value)} placeholder="Or type a new category"
          style={{ width: '100%', marginTop: 6, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Wash modes</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['normal', 'Bi-weekly'], ['maint', 'Deep Clean']].map(([val, lbl]) => (
            <button key={val} onClick={() => {
              const has = form.modes.includes(val)
              f('modes', has && form.modes.length > 1 ? form.modes.filter(m => m !== val) : [...new Set([...form.modes, val])])
            }} style={{ padding: '5px 14px', border: '1px solid', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: form.modes.includes(val) ? '#0066b1' : 'transparent', color: form.modes.includes(val) ? '#fff' : 'var(--t3)', borderColor: form.modes.includes(val) ? '#0066b1' : 'var(--bd2)' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>
      {inp('Used on / areas of use', 'usedOn', { placeholder: 'e.g. All painted panels after dry' })}
      {inp('Tool required', 'tool', { placeholder: 'e.g. IK E Foam Pro 2' })}
      {inp('Shelf life', 'shelfLife', { placeholder: 'e.g. 2 years unopened' })}
      {inp('Storage note', 'storageNote', { placeholder: 'e.g. Keep above 40°F' })}

      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t3)', marginBottom: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>Dilutions</div>
      {form.dilutions.map((d, i) => (
        <div key={i} style={{ background: 'var(--card2)', border: '1px solid var(--bd)', padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Dilution {i + 1}</div>
            {form.dilutions.length > 1 && <button onClick={() => removeDil(i)} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 14 }}>×</button>}
          </div>
          {[['Context', 'context', 'e.g. Foam cannon — per CarPro'], ['Ratio', 'ratio', 'e.g. 400–500:1'], ['Amount', 'amount', 'e.g. 12–15ml per 6L'], ['Note', 'note', 'e.g. Do not exceed 3 min dwell']].map(([lbl, key, ph]) => (
            <div key={key} style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--t3)', display: 'block', marginBottom: 3 }}>{lbl}</label>
              <input value={d[key]} onChange={e => updateDil(i, key, e.target.value)} placeholder={ph}
                style={{ width: '100%', background: 'var(--card)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '6px 8px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
            </div>
          ))}
        </div>
      ))}
      <button onClick={addDil} style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', background: 'transparent', border: '1px solid var(--bd2)', padding: '5px 12px', cursor: 'pointer', fontFamily: 'Inter, sans-serif', marginBottom: 14 }}>
        + Add dilution
      </button>

      <SyncStatus status={syncStatus} />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSave} disabled={!canSave}
          style={{ padding: '8px 20px', background: '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSave ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', opacity: canSave ? 1 : 0.4 }}>
          Save to GitHub
        </button>
      </div>
    </div>
  )
}

// Add Tool Form
export function AddToolForm({ data, onClose }) {
  const { syncStatus, sync } = useGitHubSync()
  const [form, setForm] = useState({ name: '', category: '', qty: '1', usedFor: '' })

  const categories = [...new Set((data?.tools || []).map(t => t.category))].sort()
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const handleSave = async () => {
    if (!form.name.trim() || !form.category.trim()) return
    const tool = { name: form.name.trim(), category: form.category.trim(), qty: form.qty.trim() || '1', usedFor: form.usedFor.trim() }
    const ok = await sync(addTool, tool)
    if (ok && onClose) setTimeout(onClose, 2000)
  }

  const canSave = form.name.trim() && form.category.trim() && syncStatus?.type !== 'saving'

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        Add Tool
        {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 16 }}>×</button>}
      </div>
      {[['Tool name *', 'name', 'e.g. Gyeon Bathe Bucket'], ['Qty', 'qty', '1']].map(([lbl, key, ph]) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>{lbl}</label>
          <input value={form[key]} onChange={e => f(key, e.target.value)} placeholder={ph}
            style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        </div>
      ))}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Category *</label>
        <select value={form.category} onChange={e => f('category', e.target.value)}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
          <option value="">— Select or type below —</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={form.category} onChange={e => f('category', e.target.value)} placeholder="Or type a new category"
          style={{ width: '100%', marginTop: 6, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Used for</label>
        <textarea value={form.usedFor} onChange={e => f('usedFor', e.target.value)} placeholder="e.g. Wheels and prewash foam application" rows={2}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none' }} />
      </div>
      <SyncStatus status={syncStatus} />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSave} disabled={!canSave}
          style={{ padding: '8px 20px', background: '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSave ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', opacity: canSave ? 1 : 0.4 }}>
          Save to GitHub
        </button>
      </div>
    </div>
  )
}

// Add Upgrade Form
export function AddUpgradeForm({ data, onClose }) {
  const { syncStatus, sync } = useGitHubSync()
  const existingPhases = [...new Set((data?.upgrades?.items || []).map(i => i.phase))]
  const [form, setForm] = useState({ item: '', phase: '', customPhase: '', source: 'Self', notes: '' })
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const handleSave = async () => {
    const phase = form.phase === '__custom__' ? form.customPhase.trim() : form.phase
    if (!form.item.trim() || !phase) return
    const upgrade = {
      id: 'u' + Date.now(),
      phase,
      item: form.item.trim(),
      source: form.source,
      done: false,
      notes: form.notes.trim(),
    }
    const ok = await sync(addUpgrade, upgrade)
    if (ok && onClose) setTimeout(onClose, 2000)
  }

  const phase = form.phase === '__custom__' ? form.customPhase.trim() : form.phase
  const canSave = form.item.trim() && phase && syncStatus?.type !== 'saving'

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 20, marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t1)', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        Add Upgrade
        {onClose && <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 16 }}>×</button>}
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Phase *</label>
        <select value={form.phase} onChange={e => f('phase', e.target.value)}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
          <option value="">— Select phase —</option>
          {existingPhases.map(p => <option key={p} value={p}>{p}</option>)}
          <option value="__custom__">New phase…</option>
        </select>
        {form.phase === '__custom__' && (
          <input value={form.customPhase} onChange={e => f('customPhase', e.target.value)} placeholder="New phase name"
            style={{ width: '100%', marginTop: 6, background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
        )}
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Item *</label>
        <input value={form.item} onChange={e => f('item', e.target.value)} placeholder="e.g. Millway Carbon Mirrors"
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Source</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {['Self', 'Shop'].map(s => (
            <button key={s} onClick={() => f('source', s)}
              style={{ padding: '5px 14px', border: '1px solid', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif', cursor: 'pointer', background: form.source === s ? (s === 'Self' ? '#0066b1' : '#cc1e1e') : 'transparent', color: form.source === s ? '#fff' : 'var(--t3)', borderColor: form.source === s ? (s === 'Self' ? '#0066b1' : '#cc1e1e') : 'var(--bd2)' }}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Notes</label>
        <textarea value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Optional notes" rows={2}
          style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', resize: 'vertical', outline: 'none' }} />
      </div>
      <SyncStatus status={syncStatus} />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSave} disabled={!canSave}
          style={{ padding: '8px 20px', background: '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: canSave ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif', opacity: canSave ? 1 : 0.4 }}>
          Save to GitHub
        </button>
      </div>
    </div>
  )
}
