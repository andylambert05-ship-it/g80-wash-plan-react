import { useState } from 'react'
import { SyncStatus } from './SyncForm'
import { getConfig, addFactoryPart, editFactoryPart, deleteFactoryPart } from '../utils/PlanStore'

const CONDITIONS = ['Mint', 'Excellent', 'Good', 'Fair', 'Damaged']
const CONDITION_COLORS = {
  'Mint': '#3e9b3e', 'Excellent': '#3e9b3e', 'Good': '#0066b1',
  'Fair': '#c8860a', 'Damaged': '#cc1e1e'
}

export default function TabFactoryParts({ data }) {
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const factoryParts = data.factoryParts || { note: '', items: [] }
  const items = factoryParts.items || []

  // Group by replacement mod (so you can see "these parts came off when I did X")
  const byMod = {}
  const order = []
  items.forEach(p => {
    const key = p.replacedBy || 'Stored — not yet replaced'
    if (!byMod[key]) { byMod[key] = []; order.push(key) }
    byMod[key].push(p)
  })

  return (
    <div>
      {factoryParts.note && (
        <div className="notice info" style={{ borderLeftColor: '#0066b1' }}>
          <i className="ti ti-archive" aria-hidden="true" />
          <span>{factoryParts.note}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 10px' }}>
        <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
          {items.length} part{items.length !== 1 ? 's' : ''} tracked
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: '1px solid #0066b1', background: 'transparent', color: '#0066b1', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          <i className="ti ti-plus" style={{ fontSize: 12 }} aria-hidden="true" /> Log part
        </button>
      </div>

      {items.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--t3)', fontSize: 12, border: '1px dashed var(--bd2)', background: 'var(--card)' }}>
          <i className="ti ti-archive" style={{ fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.4 }} aria-hidden="true" />
          No factory parts logged yet. When you remove an OEM component, log it here so you know where to find it for reinstall.
        </div>
      )}

      {order.map(modName => (
        <div key={modName} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '8px 0', borderBottom: '1px solid var(--bd)', marginBottom: 8 }}>
            <i className="ti ti-arrow-right" style={{ fontSize: 10, marginRight: 6 }} aria-hidden="true" />
            {modName}
          </div>
          {byMod[modName].map(part => (
            <PartCard key={part.id} part={part} onEdit={() => setEditing(part)} />
          ))}
        </div>
      ))}

      {showForm && <FactoryPartForm onClose={() => setShowForm(false)} />}
      {editing && <FactoryPartForm part={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function PartCard({ part, onEdit }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--bd)', padding: 12, marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', lineHeight: 1.3 }}>{part.component}</div>
        <button onClick={onEdit} style={{ background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--t3)', padding: '3px 8px', fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>Edit</button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 11, color: 'var(--t2)' }}>
        <i className="ti ti-map-pin" style={{ fontSize: 12, color: '#0066b1' }} aria-hidden="true" />
        <span style={{ fontWeight: 500 }}>{part.location}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 9, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: part.notes ? 8 : 0 }}>
        {part.partNumber && <span style={{ background: 'var(--card2)', padding: '2px 6px', border: '1px solid var(--bd2)' }}>P/N {part.partNumber}</span>}
        {part.condition && <span style={{ background: 'var(--card2)', padding: '2px 6px', border: '1px solid var(--bd2)', color: CONDITION_COLORS[part.condition] || 'var(--t3)' }}>{part.condition}</span>}
        {part.removedDate && <span style={{ background: 'var(--card2)', padding: '2px 6px', border: '1px solid var(--bd2)' }}>Removed {part.removedDate}</span>}
        {part.hardware && <span style={{ background: 'var(--card2)', padding: '2px 6px', border: '1px solid var(--bd2)' }}><i className="ti ti-screw-driver" style={{ fontSize: 9, marginRight: 3 }} />HW saved</span>}
      </div>

      {part.notes && (
        <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 300, lineHeight: 1.45, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--bd)' }}>
          {part.notes}
        </div>
      )}
    </div>
  )
}

function FactoryPartForm({ part, onClose }) {
  const isEdit = !!part
  const [form, setForm] = useState(part || {
    component: '', location: '', partNumber: '', condition: 'Excellent',
    removedDate: new Date().toISOString().slice(0, 10),
    replacedBy: '', hardware: true, notes: ''
  })
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', message: '' })
  const [confirmDelete, setConfirmDelete] = useState(false)

  const f = (k, v) => setForm({ ...form, [k]: v })

  const sync = async (action, label) => {
    const config = getConfig()
    if (!config.token) {
      setSyncStatus({ status: 'error', message: 'No plan token — check Settings.' }); return
    }
    setSyncStatus({ status: 'syncing', message: 'Syncing…' })
    try {
      await action(config)
      setSyncStatus({ status: 'success', message: `${label} — refresh in ~10s` })
      try { navigator.vibrate && navigator.vibrate(20) } catch (e) {}
      setTimeout(onClose, 1200)
    } catch (e) {
      setSyncStatus({ status: 'error', message: e.message })
    }
  }

  const save = () => {
    if (!form.component.trim() || !form.location.trim()) {
      setSyncStatus({ status: 'error', message: 'Component name and location required' }); return
    }
    const payload = {
      ...form,
      id: form.id || 'fp-' + Date.now(),
      component: form.component.trim(),
      location: form.location.trim(),
    }
    sync(
      (config) => isEdit ? editFactoryPart(config, payload) : addFactoryPart(config, payload),
      isEdit ? 'Saved' : 'Added'
    )
  }

  const remove = () => {
    sync((config) => deleteFactoryPart(config, form.id), 'Removed')
  }

  const inp = (label, key, props = {}) => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>{label}</label>
      <input value={form[key] || ''} onChange={e => f(key, e.target.value)} {...props}
        style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none' }} />
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, overflowY: 'auto', padding: 16 }}>
      <div style={{ maxWidth: 600, margin: '0 auto', background: 'var(--card)', border: '1px solid var(--bd2)', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            <i className="ti ti-archive" style={{ marginRight: 6, color: '#0066b1' }} aria-hidden="true" />
            {isEdit ? 'Edit factory part' : 'Log factory part'}
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>

        {inp('Component *', 'component', { placeholder: 'e.g. OEM front kidney grilles (pair)' })}
        {inp('Storage location *', 'location', { placeholder: 'e.g. Garage — Top shelf, Bin 3' })}
        {inp('Replaced by / mod', 'replacedBy', { placeholder: 'e.g. Vorsteiner ABS grilles' })}
        {inp('Part number', 'partNumber', { placeholder: 'e.g. 51138072085' })}

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Condition</label>
          <select value={form.condition} onChange={e => f('condition', e.target.value)}
            style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {inp('Removed date', 'removedDate', { type: 'date' })}

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--t2)' }}>
            <input type="checkbox" checked={form.hardware} onChange={e => f('hardware', e.target.checked)} style={{ width: 16, height: 16 }} />
            Original hardware bagged & labeled
          </label>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Notes</label>
          <textarea value={form.notes || ''} onChange={e => f('notes', e.target.value)}
            placeholder="e.g. Removed 2 clips broke — replacements in same bin. Reinstall: bumper-off recommended."
            rows={3}
            style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif', outline: 'none', resize: 'vertical' }} />
        </div>

        <SyncStatus status={syncStatus} />

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button onClick={save} disabled={syncStatus.status === 'syncing'}
            style={{ flex: 1, padding: '9px 14px', background: '#0066b1', border: 'none', color: '#fff', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: syncStatus.status === 'syncing' ? 0.5 : 1 }}>
            {isEdit ? 'Save changes' : 'Add part'}
          </button>
          <button onClick={onClose}
            style={{ padding: '9px 14px', background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--t3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Cancel
          </button>
        </div>

        {isEdit && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--bd)' }}>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} style={{ fontSize: 10, color: '#cc1e1e', background: 'transparent', border: '1px solid #2a0000', padding: '6px 12px', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'Inter, sans-serif' }}>Remove from log</button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={remove} style={{ flex: 1, padding: '7px 12px', background: '#cc1e1e', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Confirm remove</button>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--t3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>Cancel</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
