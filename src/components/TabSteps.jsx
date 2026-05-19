import StepCard, { PhaseHeader } from './StepCard'
import { getVisibleSteps } from '../constants'

export default function TabSteps({ data, mode, done, onToggle, onReset, onStartTimer }) {
  const steps = getVisibleSteps(data, mode)
  const n = steps.filter(s => done.has(s.id)).length
  const t = steps.length
  const pct = t > 0 ? Math.round((n / t) * 100) : 0

  let lastPhase = ''

  return (
    <div className="panel">
      <div className="prog-wrap">
        <div className="prog-meta">
          <span className="prog-lbl">Progress</span>
          <span className="prog-ct">{n} / {t}</span>
        </div>
        <div className="prog-track">
          <div className="prog-bar" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <button className="rbtn" onClick={onReset}>
        <i className="ti ti-refresh" aria-hidden="true" /> Reset all
      </button>

      <div className="steps-list">
        {steps.map((step, idx) => {
          const phase = step.phase || ''
          const showPhase = phase && phase !== lastPhase
          if (showPhase) lastPhase = phase
          return (
            <div key={step.id}>
              {showPhase && <PhaseHeader phase={phase} />}
              <StepCard
                step={step}
                index={idx}
                isDone={done.has(step.id)}
                onToggle={onToggle}
                onStartTimer={onStartTimer}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
