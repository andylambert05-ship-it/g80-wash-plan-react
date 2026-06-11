import { useState, useEffect } from 'react'
import { useWeather } from '../hooks/useWeather'

const SEVERITY_COLORS = {
  high: { bd: '#cc1e1e', bg: '#1a0000', icon: '#ff5555' },
  med:  { bd: '#c8860a', bg: '#1a1100', icon: '#e8a83c' },
}

const DISMISS_KEY = 'gwp_weather_dismissed_v2'

function loadDismissed() {
  try { return new Set(JSON.parse(sessionStorage.getItem(DISMISS_KEY) || '[]')) } catch { return new Set() }
}
function saveDismissed(set) {
  try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...set])) } catch {}
}

export default function WeatherBanner() {
  const { loading, error, weather, alerts } = useWeather()
  const [dismissed, setDismissed] = useState(loadDismissed)
  const [expanded, setExpanded] = useState(false)

  // Reset dismissal if alert content changes (so new alerts surface)
  const activeId = alerts.map(a => a.id).join(',')
  useEffect(() => {
    // No-op effect — dismissal is per-alert, keyed by id
  }, [activeId])

  if (loading || error || alerts.length === 0) return null

  const visible = alerts.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) {
    // All dismissed — show a tiny reopen pill
    return (
      <div style={{ padding: '14px 20px 0' }}>
        <button
          onClick={() => { setDismissed(new Set()); saveDismissed(new Set()) }}
          className="weather-reopen"
          title="Show weather alerts"
        >
          <i className="ti ti-cloud" aria-hidden="true" />
          {alerts.length} weather alert{alerts.length !== 1 ? 's' : ''}
        </button>
      </div>
    )
  }

  const dismiss = (id) => {
    const next = new Set(dismissed); next.add(id)
    setDismissed(next); saveDismissed(next)
  }

  // Show first alert collapsed, expand reveals all
  const primary = visible[0]
  const rest = visible.slice(1)
  const c = SEVERITY_COLORS[primary.severity]

  return (
    <div style={{ padding: '14px 20px 0' }}>
    <div className="weather-banner" style={{ borderLeftColor: c.bd, background: c.bg }}>
      <div className="wb-row">
        <i className={`ti ${primary.icon} wb-icon`} style={{ color: c.icon }} aria-hidden="true" />
        <div className="wb-body">
          <div className="wb-msg">{primary.message}</div>
          {weather && (
            <div className="wb-meta">
              {weather.location} · {weather.tempF}°F · UV {weather.uvMax} · {weather.windMax}mph
            </div>
          )}
        </div>
        <div className="wb-actions">
          {rest.length > 0 && (
            <button onClick={() => setExpanded(x => !x)} className="wb-more" title={expanded ? 'Hide' : `+${rest.length} more`}>
              <i className={`ti ti-chevron-${expanded ? 'up' : 'down'}`} aria-hidden="true" />
              {!expanded && `+${rest.length}`}
            </button>
          )}
          <button onClick={() => dismiss(primary.id)} className="wb-close" title="Dismiss">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>
      </div>

      {expanded && rest.map(a => {
        const rc = SEVERITY_COLORS[a.severity]
        return (
          <div key={a.id} className="wb-row wb-extra" style={{ borderTopColor: 'var(--bd)' }}>
            <i className={`ti ${a.icon} wb-icon`} style={{ color: rc.icon }} aria-hidden="true" />
            <div className="wb-body">
              <div className="wb-msg">{a.message}</div>
            </div>
            <div className="wb-actions">
              <button onClick={() => dismiss(a.id)} className="wb-close" title="Dismiss">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
    </div>
  )
}
