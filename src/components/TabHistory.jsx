import { useState, useEffect } from 'react'

const STORAGE_KEY = 'gwp_history'
const MAX_ENTRIES = 100

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveHistory(entries) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)) } catch {}
}

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
function formatTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
function daysSince(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export function logWash(mode, done, total) {
  const entries = loadHistory()
  const entry = {
    id: Date.now(),
    date: new Date().toISOString(),
    mode,
    modeLabel: mode === 'normal' ? 'Bi-weekly Wash' : 'Deep Clean',
    stepsDone: done,
    stepsTotal: total,
  }
  const updated = [entry, ...entries].slice(0, MAX_ENTRIES)
  saveHistory(updated)
  return updated
}

export default function TabHistory({ data, mode, done }) {
  const [history, setHistory] = useState(loadHistory)
  const [confirmDelete, setConfirmDelete] = useState(null)

  // Listen for wash complete to auto-log
  useEffect(() => {
    const steps = data?.washSteps?.normal?.filter(s => mode === 'normal' || !s.normalOnly) || []
    const maintOnly = data?.washSteps?.maintOnly || []
    const total = mode === 'normal' ? steps.length : steps.length + maintOnly.length
    const doneCount = done?.size || 0

    if (total > 0 && doneCount === total) {
      // Check if we already logged this session (within last 5 min)
      const last = history[0]
      const fiveMin = 5 * 60 * 1000
      if (!last || Date.now() - new Date(last.date).getTime() > fiveMin) {
        const updated = logWash(mode, doneCount, total)
        setHistory(updated)
      }
    }
  }, [done?.size])

  const handleManualLog = () => {
    const steps = data?.washSteps?.normal?.filter(s => mode === 'normal' || !s.normalOnly) || []
    const maintOnly = data?.washSteps?.maintOnly || []
    const total = mode === 'normal' ? steps.length : steps.length + maintOnly.length
    const updated = logWash(mode, done?.size || 0, total)
    setHistory(updated)
  }

  const handleDelete = (id) => {
    if (confirmDelete === id) {
      const updated = history.filter(e => e.id !== id)
      saveHistory(updated)
      setHistory(updated)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  const handleClearAll = () => {
    if (confirmDelete === 'all') {
      saveHistory([])
      setHistory([])
      setConfirmDelete(null)
    } else {
      setConfirmDelete('all')
      setTimeout(() => setConfirmDelete(null), 3000)
    }
  }

  // Stats
  const totalWashes = history.length
  const normalCount = history.filter(e => e.mode === 'normal').length
  const deepCount = history.filter(e => e.mode === 'maint').length
  const lastWash = history[0]
  const avgInterval = history.length > 1
    ? Math.round((new Date(history[0].date) - new Date(history[history.length - 1].date)) / (1000 * 60 * 60 * 24) / (history.length - 1))
    : null

  return (
    <div className="panel">

      {/* Stats row */}
      {totalWashes > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {[
            { label: 'Total washes', value: totalWashes },
            { label: 'Bi-weekly', value: normalCount },
            { label: 'Deep Clean', value: deepCount },
            { label: 'Avg interval', value: avgInterval ? `${avgInterval}d` : '—' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--card)', border: '1px solid var(--bd)', padding: '10px 12px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--t3)', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={handleManualLog}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#0066b1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
        >
          <i className="ti ti-plus" aria-hidden="true" />
          Log wash now
        </button>
        {totalWashes > 0 && (
          <button
            onClick={handleClearAll}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: confirmDelete === 'all' ? '#cc1e1e' : 'transparent', color: confirmDelete === 'all' ? '#fff' : 'var(--t3)', border: '1px solid var(--bd2)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
            <i className="ti ti-trash" aria-hidden="true" />
            {confirmDelete === 'all' ? 'Tap again to clear all' : 'Clear all'}
          </button>
        )}
      </div>

      {/* Empty state */}
      {totalWashes === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: 'var(--card)', border: '1px solid var(--bd)' }}>
          <i className="ti ti-history" style={{ fontSize: 36, color: 'var(--t3)', display: 'block', marginBottom: 12 }} aria-hidden="true" />
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>No wash history yet</div>
          <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 300, lineHeight: 1.6 }}>
            Complete a wash on the Steps tab to auto-log it,<br />or tap "Log wash now" to add a manual entry.
          </div>
        </div>
      )}

      {/* History entries */}
      {history.map((entry, idx) => {
        const isNormal = entry.mode === 'normal'
        const pct = entry.stepsTotal > 0 ? Math.round((entry.stepsDone / entry.stepsTotal) * 100) : 0
        const accentColor = isNormal ? '#0066b1' : '#1a9e62'
        return (
          <div key={entry.id} style={{ background: 'var(--card)', border: '1px solid var(--bd)', marginBottom: 4, position: 'relative', overflow: 'hidden' }}>
            {/* Mode color left spine */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accentColor }} />
            <div style={{ padding: '12px 14px 12px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{entry.modeLabel}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: accentColor, background: isNormal ? 'var(--blue-bg)' : 'var(--iom-bg)', border: `1px solid ${isNormal ? 'var(--blue-bd)' : 'var(--iom-bd)'}`, padding: '2px 7px' }}>
                    {daysSince(entry.date)}
                  </div>
                  {idx === 0 && <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#cc1e1e', background: 'var(--red-bg)', border: '1px solid var(--red-bd)', padding: '2px 7px' }}>Latest</div>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 300, marginBottom: 8 }}>
                  {formatDate(entry.date)} &nbsp;·&nbsp; {formatTime(entry.date)}
                </div>
                {/* Progress bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1, height: 2, background: 'var(--bd2)', borderRadius: 1 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: accentColor, borderRadius: 1, transition: 'width 0.4s ease' }} />
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                    {entry.stepsDone}/{entry.stepsTotal} steps
                  </div>
                </div>
              </div>
              {/* Delete button */}
              <button
                onClick={() => handleDelete(entry.id)}
                style={{ background: confirmDelete === entry.id ? '#cc1e1e' : 'transparent', border: `1px solid ${confirmDelete === entry.id ? '#cc1e1e' : 'var(--bd2)'}`, color: confirmDelete === entry.id ? '#fff' : 'var(--t3)', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, flexShrink: 0, fontFamily: 'Inter, sans-serif' }}
                title={confirmDelete === entry.id ? 'Tap again to delete' : 'Delete entry'}
              >
                {confirmDelete === entry.id ? '✓' : '×'}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
