import { useState, useEffect } from 'react'
import { PHASE_COLORS, fmtTime } from '../constants'
import { resolveChemLabel } from './StepCard'

// Full-screen one-step-at-a-time wash mode. Built for the wash bay: giant tap
// targets that work with wet gloves, current chemical + dilution inline, dwell
// timers a thumb-width away. The floating timer (z-index 999) stays visible on
// top of this overlay (z-index 350).
export default function FocusMode({ steps, done, onToggle, onStartTimer, chemicals, onClose }) {
  // Start at the first not-done step
  const [idx, setIdx] = useState(() => {
    const first = steps.findIndex(s => !done.has(s.id))
    return first === -1 ? 0 : first
  })

  // Steps list can shrink when the mode toggles — keep the index in range
  const i = Math.min(idx, steps.length - 1)
  const step = steps[i]

  // Escape closes; lock body scroll while open
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  if (!step) return null

  const total = steps.length
  const doneCount = steps.filter(s => done.has(s.id)).length
  const isDone = done.has(step.id)
  const allDone = doneCount === total
  const phaseColor = PHASE_COLORS[step.phase] || '#505068'

  const advance = () => {
    // Jump to the next not-done step after the current one, wrapping once
    for (let k = 1; k <= total; k++) {
      const cand = (i + k) % total
      if (!done.has(steps[cand].id)) { setIdx(cand); return }
    }
    // Everything done — stay put; completion banner takes over
  }

  const handleDone = () => {
    if (!isDone) {
      onToggle(step.id) // haptic lives in useWashState
      // done set updates next render; advance based on what it will contain
      const willBeDone = new Set(done); willBeDone.add(step.id)
      for (let k = 1; k <= total; k++) {
        const cand = (i + k) % total
        if (!willBeDone.has(steps[cand].id)) { setIdx(cand); return }
      }
    } else {
      advance()
    }
  }

  return (
    <div className="focus-mode" role="dialog" aria-modal="true" aria-label="Focus mode">
      {/* Top bar */}
      <div className="fm-top">
        <div className="fm-count">{doneCount} / {total} done</div>
        <div className="fm-phase" style={{ color: phaseColor }}>
          <span className="fm-phase-dot" style={{ background: phaseColor }} />
          {step.phase || 'Wash'}
        </div>
        <button className="fm-close" onClick={onClose} aria-label="Exit focus mode">
          <i className="ti ti-x" aria-hidden="true" />
        </button>
      </div>
      <div className="fm-track">
        <div className="fm-bar" style={{ width: `${Math.round((doneCount / total) * 100)}%` }} />
      </div>

      {/* Step body */}
      <div className="fm-body">
        {allDone ? (
          <div className="fm-complete">
            <i className="ti ti-circle-check" aria-hidden="true" />
            <div className="fm-complete-title">Wash complete</div>
            <div className="fm-complete-sub">All {total} steps done — she's ready.</div>
            <button className="fm-exit-btn" onClick={onClose}>Exit focus mode</button>
          </div>
        ) : (
          <>
            <div className="fm-step-n" style={{ borderColor: isDone ? 'var(--green)' : phaseColor }}>
              {isDone ? <i className="ti ti-check" style={{ color: 'var(--green)' }} aria-hidden="true" /> : i + 1}
            </div>
            <div className="fm-title">
              {step.title}
              {step.isMaint && <span className="pill pm">maint.</span>}
              {step.optional && <span className="pill po">optional</span>}
            </div>
            <div className="fm-desc">{step.desc}</div>

            {(step.chems?.length || step.tools?.length) ? (
              <div className="fm-tags">
                {(step.chems || []).map((c, k) => (
                  <div key={k} className="fm-tag chem">
                    <i className="ti ti-flask" aria-hidden="true" />
                    {resolveChemLabel(c, chemicals)}
                  </div>
                ))}
                {(step.tools || []).map(t => (
                  <div key={t} className="fm-tag tool">
                    <i className="ti ti-tool" aria-hidden="true" />
                    {t}
                  </div>
                ))}
              </div>
            ) : null}

            {step.dwellMin && (
              <div className="fm-timers">
                {(step.dwellMin === step.dwellMax ? [step.dwellMin] : [step.dwellMin, step.dwellMax]).map(sec => (
                  <button key={sec} className="fm-timer-btn" onClick={() => onStartTimer(sec, step.title.substring(0, 30), step.id)}>
                    <i className="ti ti-clock" aria-hidden="true" />
                    Start {fmtTime(sec)} dwell
                  </button>
                ))}
              </div>
            )}
            {step.dwellMins && !step.dwellMin && (
              <div className="fm-dwell-note">
                <i className="ti ti-clock" aria-hidden="true" /> {step.dwellMins} dwell
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom controls */}
      {!allDone && (
        <div className="fm-controls">
          <button className="fm-nav" onClick={() => setIdx((i - 1 + total) % total)} aria-label="Previous step">
            <i className="ti ti-chevron-left" aria-hidden="true" />
          </button>
          <button className={`fm-done${isDone ? ' skip' : ''}`} onClick={handleDone}>
            {isDone
              ? <>Next <i className="ti ti-chevron-right" aria-hidden="true" /></>
              : <><i className="ti ti-check" aria-hidden="true" /> Done — next step</>}
          </button>
          <button className="fm-nav" onClick={() => setIdx((i + 1) % total)} aria-label="Skip to next step">
            <i className="ti ti-chevron-right" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
