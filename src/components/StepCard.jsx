import { PHASE_ICONS, PHASE_COLORS, fmtTime } from '../constants'

export function PhaseHeader({ phase }) {
  const color = PHASE_COLORS[phase] || '#505068'
  const icon = PHASE_ICONS[phase] || ''
  return (
    <div
      className="phase-hdr"
      style={{ background: color + '18', color, borderLeftColor: color }}
    >
      {icon}&nbsp;&nbsp;{phase}
    </div>
  )
}

export default function StepCard({ step, index, isDone, onToggle, onStartTimer }) {
  const cls = ['step', step.isMaint ? 'maint' : step.optional ? 'optional' : 'normal', isDone ? 'done' : ''].join(' ')

  return (
    <div className={cls} onClick={() => onToggle(step.id)}>
      <div className="step-n">
        {isDone
          ? <i className="ti ti-check" style={{ fontSize: 12, color: 'var(--green)' }} aria-hidden="true" />
          : index + 1}
      </div>
      <div className="step-b">
        <div className="step-t">
          {step.title}
          {step.isMaint && <span className="pill pm">maint.</span>}
          {step.optional && <span className="pill po">optional</span>}
        </div>

        {step.dwellMin && (
          <div className="step-timing">
            {step.dwellMin && (
              <span className="step-meta step-dwell">
                <i className="ti ti-clock" style={{ fontSize: 10 }} aria-hidden="true" />
                {step.dwellMin === step.dwellMax
                  ? fmtTime(step.dwellMin)
                  : `${fmtTime(step.dwellMin)}–${fmtTime(step.dwellMax)}`} dwell
                {step.dwellMins === 'max per panel' ? ' (max per panel)' : ''}
              </span>
            )}
            {step.dwellMins && !step.dwellMin && (
              <span className="step-meta step-dwell">
                <i className="ti ti-clock" style={{ fontSize: 10 }} aria-hidden="true" />
                {step.dwellMins} dwell
              </span>
            )}
          </div>
        )}

        <div className="step-d">{step.desc}</div>

        {((step.tools?.length || step.chems?.length) && !isDone) ? (
          <div className="tags">
            {(step.tools || []).map(t => (
              <span key={t} className="tag tl">
                <i className="ti ti-tool" style={{ fontSize: 10, marginRight: 2 }} aria-hidden="true" />{t}
              </span>
            ))}
            {(step.chems || []).map(c => (
              <span key={c} className="tag tc">
                <i className="ti ti-flask" style={{ fontSize: 10, marginRight: 2 }} aria-hidden="true" />{c}
              </span>
            ))}
          </div>
        ) : null}

        {step.dwellMin && !isDone && (
          <div className="timer-btns" onClick={e => e.stopPropagation()}>
            {step.dwellMin === step.dwellMax ? (
              <button
                className="timer-btn"
                onClick={() => onStartTimer(step.dwellMin, step.title.substring(0, 30))}
              >
                <i className="ti ti-clock" style={{ fontSize: 11 }} aria-hidden="true" />
                Start {fmtTime(step.dwellMin)}
              </button>
            ) : (
              <>
                <button
                  className="timer-btn"
                  onClick={() => onStartTimer(step.dwellMin, step.title.substring(0, 30))}
                >
                  <i className="ti ti-clock" style={{ fontSize: 11 }} aria-hidden="true" />
                  {fmtTime(step.dwellMin)}
                </button>
                <button
                  className="timer-btn"
                  onClick={() => onStartTimer(step.dwellMax, step.title.substring(0, 30))}
                >
                  <i className="ti ti-clock" style={{ fontSize: 11 }} aria-hidden="true" />
                  {fmtTime(step.dwellMax)}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
