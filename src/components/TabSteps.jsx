import { useState } from 'react'
import StepCard, { PhaseHeader, ExpandToggle } from './StepCard'
import ResetButton from './ResetButton'
import { getVisibleSteps } from '../constants'

export default function TabSteps({ data, mode, done, activeId, onToggle, onReset, onStartTimer }) {
  const [expandAll, setExpandAll] = useState(false)
  const steps = getVisibleSteps(data, mode)
  const n = steps.filter(s => done.has(s.id)).length
  const t = steps.length
  const pct = t > 0 ? Math.round((n / t) * 100) : 0
  const allDone = t > 0 && n === t

  let lastPhase = ''

  return (
    <div className="panel">
      {allDone && (
        <div className="wash-complete">
          <i className="ti ti-circle-check" aria-hidden="true" />
          <div>
            <div className="wc-title">Wash Complete</div>
            <div className="wc-sub">All {t} steps done — she's ready.</div>
          </div>
        </div>
      )}
      <div className="prog-wrap">
        <div className="prog-meta">
          <span className="prog-lbl">Progress</span>
          <span className="prog-ct">{n} / {t}</span>
        </div>
        <div className="prog-track">
          <div className="prog-bar" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <ResetButton onReset={onReset} label="Reset all" />
        <ExpandToggle expanded={expandAll} onToggle={() => setExpandAll(x => !x)} />
      </div>

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
                isActive={activeId === step.id}
                onToggle={onToggle}
                onStartTimer={onStartTimer}
                chemicals={data.chemicals}
                forceExpand={expandAll}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
