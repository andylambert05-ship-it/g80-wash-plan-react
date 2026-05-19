import { fmtTime } from '../constants'

const CIRC = 113.1

export default function FloatingTimer({ timer, onStop }) {
  if (!timer) return null

  const pct = timer.total > 0 ? timer.remaining / timer.total : 0
  const offset = CIRC * (1 - pct)
  const ringClass = `timer-fg${timer.remaining <= 30 && !timer.done ? ' warning' : ''}${timer.done ? ' expired' : ''}`

  return (
    <div className="float-timer">
      <div className="timer-ring-wrap">
        <svg className="timer-svg" viewBox="0 0 44 44">
          <circle className="timer-bg" cx="22" cy="22" r="18" />
          <circle className={ringClass} cx="22" cy="22" r="18" style={{ strokeDashoffset: offset }} />
        </svg>
        <div className="timer-time">
          {timer.done ? 'DONE' : fmtTime(timer.remaining)}
        </div>
      </div>
      <div className="timer-info">
        <div className="timer-label">{timer.label}</div>
        <div className="timer-status">
          {timer.done ? 'Dwell complete — rinse now' : 'Running…'}
        </div>
      </div>
      <button className="timer-close" onClick={onStop} aria-label="Dismiss timer">✕</button>
    </div>
  )
}
