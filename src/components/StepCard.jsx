import { useState } from 'react'
import { PHASE_ICONS, PHASE_COLORS, fmtTime } from '../constants'

export function PhaseHeader({ phase }) {
  const color = PHASE_COLORS[phase] || '#505068'
  return (
    <div
      className="phase-hdr"
      style={{ '--phase-color': color, borderLeftColor: '#0066b1', borderLeftWidth: '1px' }}
    >
      <span style={{ display:'inline-block', width:10, height:10, borderRadius:'50%', background:'#ffffff', flexShrink:0 }} />
      {phase}
    </div>
  )
}

// Resolve a chem entry — supports both legacy strings and new { chemId, usage } objects
export function resolveChemLabel(chem, chemicals) {
  if (typeof chem === 'string') return chem // legacy fallback
  const { chemId, usage } = chem
  if (!chemId) return usage // no linked chemical (e.g. trim dressing, untracked products)
  const match = (chemicals || []).find(c => c.id === chemId)
  const name = match ? match.name : chemId // fall back to id if chemical was deleted
  return usage ? `${name} — ${usage}` : name
}

// Collapsed by default: number + title + dwell pill.
// Tap number circle  -> toggle done.
// Tap card body      -> expand/collapse.
// Active timer step  -> auto-expands. `forceExpand` prop expands all.
export default function StepCard({ step, index, isDone, isActive, onToggle, onStartTimer, chemicals, forceExpand }) {
  const [expanded, setExpanded] = useState(false)
  const isExpanded = (forceExpand || expanded || isActive) && !isDone
  const cls = ['step', step.isMaint ? 'maint' : step.optional ? 'optional' : 'normal', isDone ? 'done' : '', isActive ? 'active-timer' : ''].join(' ')

  return (
    <div className={cls}>
      <div
        className="step-n step-n-toggle"
        onClick={(e) => { e.stopPropagation(); onToggle(step.id) }}
        title={isDone ? 'Mark not done' : 'Mark done'}
      >
        {isDone
          ? <i className="ti ti-check" style={{ fontSize: 12, color: 'var(--green)' }} aria-hidden="true" />
          : index + 1}
      </div>
      <div className="step-b" onClick={() => setExpanded(x => !x)}>
        <div className="step-t">
          {step.title}
          {step.isMaint && <span className="pill pm">maint.</span>}
          {step.optional && <span className="pill po">optional</span>}
          <i
            className={`ti ti-chevron-down step-chevron${isExpanded ? ' open' : ''}`}
            aria-hidden="true"
          />
        </div>

        {step.dwellMin && (
          <div className="step-timing">
            <span className="step-meta step-dwell">
              <i className="ti ti-clock" style={{ fontSize: 10 }} aria-hidden="true" />
              {step.dwellMin === step.dwellMax
                ? fmtTime(step.dwellMin)
                : `${fmtTime(step.dwellMin)}–${fmtTime(step.dwellMax)}`} dwell
              {step.dwellMins === 'max per panel' ? ' (max per panel)' : ''}
            </span>
          </div>
        )}
        {step.dwellMins && !step.dwellMin && (
          <div className="step-timing">
            <span className="step-meta step-dwell">
              <i className="ti ti-clock" style={{ fontSize: 10 }} aria-hidden="true" />
              {step.dwellMins} dwell
            </span>
          </div>
        )}

        {isExpanded && (
          <>
            <div className="step-d">{step.desc}</div>

            {(step.tools?.length || step.chems?.length) ? (
              <div className="tags">
                {(step.tools || []).map(t => (
                  <span key={t} className="tag tl">
                    <i className="ti ti-tool" style={{ fontSize: 10, marginRight: 2 }} aria-hidden="true" />{t}
                  </span>
                ))}
                {(step.chems || []).map((c, i) => {
                  const label = resolveChemLabel(c, chemicals)
                  const key = typeof c === 'string' ? c : (c.chemId || c.usage || i)
                  return (
                    <span key={key} className="tag tc">
                      <i className="ti ti-flask" style={{ fontSize: 10, marginRight: 2 }} aria-hidden="true" />{label}
                    </span>
                  )
                })}
              </div>
            ) : null}

            {step.dwellMin && (
              <div className="timer-btns" onClick={e => e.stopPropagation()}>
                {step.dwellMin === step.dwellMax ? (
                  <button
                    className="timer-btn"
                    onClick={() => onStartTimer(step.dwellMin, step.title.substring(0, 30), step.id)}
                  >
                    <i className="ti ti-clock" style={{ fontSize: 11 }} aria-hidden="true" />
                    Start {fmtTime(step.dwellMin)}
                  </button>
                ) : (
                  <>
                    <button
                      className="timer-btn"
                      onClick={() => onStartTimer(step.dwellMin, step.title.substring(0, 30), step.id)}
                    >
                      <i className="ti ti-clock" style={{ fontSize: 11 }} aria-hidden="true" />
                      {fmtTime(step.dwellMin)}
                    </button>
                    <button
                      className="timer-btn"
                      onClick={() => onStartTimer(step.dwellMax, step.title.substring(0, 30), step.id)}
                    >
                      <i className="ti ti-clock" style={{ fontSize: 11 }} aria-hidden="true" />
                      {fmtTime(step.dwellMax)}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Small "expand all / collapse all" toggle used above step lists
export function ExpandToggle({ expanded, onToggle }) {
  return (
    <button className="expand-toggle" onClick={onToggle}>
      <i className={`ti ${expanded ? 'ti-arrows-diagonal-minimize-2' : 'ti-arrows-diagonal'}`} style={{ fontSize: 11 }} aria-hidden="true" />
      {expanded ? 'Collapse all' : 'Expand all'}
    </button>
  )
}
