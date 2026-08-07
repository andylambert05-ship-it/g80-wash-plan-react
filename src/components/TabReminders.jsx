import { useState } from 'react'
import { EditReminderForm, SyncStatus } from './SyncForm'
import { getConfig, deleteReminder } from '../utils/PlanStore'

const STORAGE_KEY = 'gwp_reminders'

const DEFAULT_REMINDERS = [
  { id: 'reload', name: 'CarPro Reload 2.0', interval: 21, intervalLabel: '2–3 weeks', lastDone: null, notes: 'Apply to clean dry paint. Do not apply below 50°F.' },
  { id: 'p303', name: '303 Aerospace Protectant', interval: 21, intervalLabel: '3 weeks (Colorado altitude UV)', lastDone: null, notes: 'Exterior trim and rubber seals. Wipe completely dry — does not air dry.' },
  { id: 'coating', name: 'Ceramic Coating Inspection', interval: 30, intervalLabel: 'Monthly', lastDone: null, notes: 'Water bead test on hood and roof. If beading degrades significantly, consider Reload 2.0 layer or Angelwax consult.' },
  { id: 'decon', name: 'Full Decontamination Wash', interval: 90, intervalLabel: 'Every 3 months', lastDone: null, notes: 'BH Touchless → Iron X → CarPro Descale. Run before winter and after spring.' },
  { id: 'ikbatt', name: 'IK E Foam Pro 12 Battery Check', interval: 90, intervalLabel: 'Seasonal', lastDone: null, notes: 'Check charge level before winter storage. Battery loses capacity in sub-freezing temps — store indoors.' },
  { id: 'darkside', name: 'CarPro Darkside Reapplication', interval: 60, intervalLabel: 'Every 6–8 weeks', lastDone: null, notes: 'Apply to clean dry sidewalls only. Min 1–2 hrs dry before driving.' },
]

function loadReminders() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!stored) return DEFAULT_REMINDERS
    // Merge stored with defaults — add any new defaults not in stored
    const storedIds = new Set(stored.map(r => r.id))
    const newDefaults = DEFAULT_REMINDERS.filter(r => !storedIds.has(r.id))
    return [...stored, ...newDefaults]
  } catch { return DEFAULT_REMINDERS }
}

function saveReminders(reminders) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders)) } catch {}
}

function daysSince(dateStr) {
  if (!dateStr) return null
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function daysUntil(dateStr, interval) {
  if (!dateStr) return null
  const due = new Date(dateStr).getTime() + interval * 24 * 60 * 60 * 1000
  return Math.ceil((due - Date.now()) / (1000 * 60 * 60 * 24))
}

function statusInfo(reminder) {
  if (!reminder.lastDone) return { status: 'never', label: 'Never done', color: '#888' }
  const until = daysUntil(reminder.lastDone, reminder.interval)
  if (until < 0) return { status: 'overdue', label: `${Math.abs(until)}d overdue`, color: '#cc1e1e' }
  if (until <= 5) return { status: 'soon', label: `Due in ${until}d`, color: '#c8860a' }
  return { status: 'ok', label: `Due in ${until}d`, color: '#1a9e62' }
}

function formatShortDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function generateICS(reminder) {
  const due = reminder.lastDone
    ? new Date(new Date(reminder.lastDone).getTime() + reminder.interval * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + reminder.interval * 24 * 60 * 60 * 1000)

  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const uid = `${reminder.id}-${Date.now()}@m3care`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//M3 Care Plan//Maintenance Reminder//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${fmt(due)}`,
    `DTEND:${fmt(new Date(due.getTime() + 3600000))}`,
    `SUMMARY:${reminder.name} — M3 Care`,
    `DESCRIPTION:${reminder.notes || ''} Interval: ${reminder.intervalLabel}.`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Reminder: ${reminder.name} due tomorrow`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${reminder.id}-reminder.ics`
  a.click()
  URL.revokeObjectURL(url)
}

const STATUS_ORDER = { overdue: 0, never: 1, soon: 2, ok: 3 }

export default function TabReminders({ data }) {
  // Merge JSON reminders (source of truth for definitions) with localStorage (last done dates)
  const initReminders = () => {
    const jsonReminders = data?.reminders || []
    const stored = loadReminders()
    const storedMap = Object.fromEntries(stored.map(r => [r.id, r]))
    // JSON reminders take precedence for name/interval/notes; localStorage provides lastDone
    const merged = jsonReminders.map(jr => ({ ...jr, lastDone: storedMap[jr.id]?.lastDone || jr.lastDone || null }))
    // Keep any localStorage-only custom reminders not in JSON
    const jsonIds = new Set(jsonReminders.map(r => r.id))
    const localOnly = stored.filter(r => !jsonIds.has(r.id))
    return [...merged, ...localOnly]
  }
  const [reminders, setReminders] = useState(initReminders)
  const [editingReminder, setEditingReminder] = useState(null)
  const [delStatus, setDelStatus] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', interval: '', intervalLabel: '', notes: '' })
  const [confirmDelete, setConfirmDelete] = useState(null)

  const update = (updated) => { setReminders(updated); saveReminders(updated) }

  const markDone = (id) => {
    update(reminders.map(r => r.id === id ? { ...r, lastDone: new Date().toISOString() } : r))
  }

  const handleDelete = async (id) => {
    if (confirmDelete === id) {
      const config = getConfig()
      if (config.pat) {
        setDelStatus(s => ({ ...s, [id]: { type: 'saving' } }))
        try {
          await deleteReminder(config, id)
          setDelStatus(s => ({ ...s, [id]: { type: 'success' } }))
        } catch (e) {
          setDelStatus(s => ({ ...s, [id]: { type: 'error', message: e.message } }))
          return
        }
      }
      update(reminders.filter(r => r.id !== id))
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  const addReminder = () => {
    if (!form.name.trim() || !form.interval) return
    const newR = {
      id: 'custom-' + Date.now(),
      name: form.name.trim(),
      interval: parseInt(form.interval),
      intervalLabel: form.intervalLabel.trim() || `Every ${form.interval} days`,
      notes: form.notes.trim(),
      lastDone: null,
      custom: true,
    }
    update([...reminders, newR])
    setForm({ name: '', interval: '', intervalLabel: '', notes: '' })
    setShowForm(false)
  }

  const sorted = [...reminders].sort((a, b) => {
    const sa = statusInfo(a), sb = statusInfo(b)
    const oa = STATUS_ORDER[sa.status], ob = STATUS_ORDER[sb.status]
    if (oa !== ob) return oa - ob
    // Within same status, sort by days until
    const ua = daysUntil(a.lastDone, a.interval) ?? 999
    const ub = daysUntil(b.lastDone, b.interval) ?? 999
    return ua - ub
  })

  const overdueCount = sorted.filter(r => statusInfo(r).status === 'overdue').length
  const soonCount = sorted.filter(r => statusInfo(r).status === 'soon').length

  return (
    <div className="panel">
      {editingReminder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, overflowY: 'auto', padding: 16 }}>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <EditReminderForm reminder={editingReminder} onClose={() => setEditingReminder(null)} />
          </div>
        </div>
      )}

      {/* Summary notice */}
      {(overdueCount > 0 || soonCount > 0) && (
        <div className="notice warn" style={{ marginBottom: 16 }}>
          <i className="ti ti-alert-triangle" aria-hidden="true" />
          <span>
            {overdueCount > 0 && <><strong>{overdueCount} overdue</strong>{soonCount > 0 ? ' · ' : ''}</>}
            {soonCount > 0 && <><strong>{soonCount} due soon</strong></>}
            {' '}— check reminders below
          </span>
        </div>
      )}
      {overdueCount === 0 && soonCount === 0 && reminders.some(r => r.lastDone) && (
        <div className="notice opt" style={{ marginBottom: 16 }}>
          <i className="ti ti-circle-check" aria-hidden="true" />
          <span>All maintenance up to date.</span>
        </div>
      )}

      {/* Add button */}
      <button className="rbtn" onClick={() => setShowForm(s => !s)} style={{ marginBottom: 14, color: 'var(--t1)' }}>
        <i className="ti ti-plus" aria-hidden="true" /> {showForm ? 'Cancel' : 'Add reminder'}
      </button>

      {/* Add form */}
      {showForm && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--bd2)', padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t3)', marginBottom: 12 }}>New Reminder</div>
          {[
            { label: 'Product / Task *', key: 'name', placeholder: 'e.g. CarPro Reset Stock Check' },
            { label: 'Interval (days) *', key: 'interval', placeholder: 'e.g. 14', type: 'number' },
            { label: 'Interval label', key: 'intervalLabel', placeholder: 'e.g. Every 2 weeks' },
            { label: 'Notes', key: 'notes', placeholder: 'Optional notes' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input
                type={f.type || 'text'}
                value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                style={{ width: '100%', background: 'var(--card2)', border: '1px solid var(--bd2)', color: 'var(--t1)', padding: '7px 10px', fontSize: 12, fontFamily: 'Inter, sans-serif' }}
              />
            </div>
          ))}
          <button
            onClick={addReminder}
            disabled={!form.name.trim() || !form.interval}
            style={{ background: '#0066b1', color: '#fff', border: 'none', padding: '8px 18px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif', opacity: (!form.name.trim() || !form.interval) ? 0.4 : 1 }}
          >
            Add Reminder
          </button>
        </div>
      )}

      {/* Reminder cards */}
      {sorted.map(reminder => {
        const { status, label, color } = statusInfo(reminder)
        const since = daysSince(reminder.lastDone)
        return (
          <div key={reminder.id} style={{ background: 'var(--card)', border: '1px solid var(--bd)', marginBottom: 4, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: color }} />
            <div style={{ padding: '12px 14px 12px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--t1)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{reminder.name}</div>
                    <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 7px', color, background: status === 'overdue' ? 'var(--red-bg)' : status === 'soon' ? 'var(--amber-bg)' : status === 'never' ? 'var(--card2)' : 'var(--iom-bg)', border: `1px solid ${color}` }}>
                      {label}
                    </span>
                    {reminder.custom && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '2px 6px', color: 'var(--t3)', background: 'var(--card2)', border: '1px solid var(--bd2)' }}>Custom</span>}
                  </div>
                  {/* Interval */}
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 5, fontWeight: 500, letterSpacing: '0.04em' }}>
                    {reminder.intervalLabel}
                  </div>
                  {/* Last done */}
                  <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 300, marginBottom: reminder.notes ? 6 : 0 }}>
                    {reminder.lastDone
                      ? `Last done: ${formatShortDate(reminder.lastDone)} (${since === 0 ? 'today' : since === 1 ? 'yesterday' : `${since} days ago`})`
                      : 'Never recorded'}
                  </div>
                  {/* Notes */}
                  {reminder.notes && (
                    <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 300, lineHeight: 1.6, marginBottom: 8 }}>{reminder.notes}</div>
                  )}
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    <button
                      onClick={() => markDone(reminder.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#1a9e62', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                    >
                      <i className="ti ti-check" aria-hidden="true" /> Done today
                    </button>
                    <button
                      onClick={() => generateICS(reminder)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'transparent', color: '#0066b1', border: '1px solid var(--blue-bd)', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                    >
                      <i className="ti ti-calendar" aria-hidden="true" /> Add to Calendar
                    </button>
                  </div>
                </div>
                {/* Delete */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <button onClick={() => setEditingReminder(reminder)} title="Edit"
                    style={{ background: 'transparent', border: '1px solid var(--bd2)', color: 'var(--t3)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}>
                    <i className="ti ti-pencil" aria-hidden="true" />
                  </button>
                  <button onClick={() => handleDelete(reminder.id)}
                    style={{ background: confirmDelete === reminder.id ? '#cc1e1e' : 'transparent', border: `1px solid ${confirmDelete === reminder.id ? '#cc1e1e' : 'var(--bd2)'}`, color: confirmDelete === reminder.id ? '#fff' : 'var(--t3)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}
                    title={confirmDelete === reminder.id ? 'Tap again to delete' : 'Delete reminder'}>
                    <i className={`ti ${confirmDelete === reminder.id ? 'ti-check' : 'ti-trash'}`} aria-hidden="true" />
                  </button>
                </div>
                {delStatus[reminder.id] && <SyncStatus status={delStatus[reminder.id]} />}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
