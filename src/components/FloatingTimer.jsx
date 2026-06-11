import { fmtTime } from '../constants'

const CIRC = 113.1

export default function FloatingTimer({ timer, onStop, onExtend }) {
  if (!timer) return null

  const pct = timer.total > 0 ? timer.remaining / timer.total : 0
  const offset = CIRC * (1 - pct)
  const isWarning = timer.remaining <= 30 && !timer.done
  const isDone = timer.done
  const ringClass = `timer-fg${isWarning ? ' warning' : ''}${isDone ? ' expired' : ''}`

  return (
    <div className={`float-timer${isDone ? ' done' : ''}${isWarning ? ' warning' : ''}`}>
      <div className="ft-main">
        <div className="timer-ring-wrap">
          <svg className="timer-svg" viewBox="0 0 44 44">
            <circle className="timer-bg" cx="22" cy="22" r="18" />
            <circle className={ringClass} cx="22" cy="22" r="18" style={{ strokeDashoffset: offset }} />
          </svg>
          <div className="timer-time">
            {isDone ? <i className="ti ti-check" aria-hidden="true" /> : fmtTime(timer.remaining)}
          </div>
        </div>
        <div className="ft-info">
          <div className="timer-label">{timer.label}</div>
          <div className="ft-actions">
            <button
              className="ft-extend"
              onClick={() => onExtend && onExtend(30)}
              title="Add 30 seconds"
            >+30s</button>
            <button
              className="ft-extend"
              onClick={() => onExtend && onExtend(60)}
              title="Add 1 minute"
            >+1m</button>
            <button className="ft-dismiss" onClick={onStop} aria-label="Dismiss timer">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      {isDone && (
        <div className="ft-done-banner">
          <i className="ti ti-droplet" aria-hidden="true" /> Dwell complete — rinse now
        </div>
      )}
    </div>
  )
}
