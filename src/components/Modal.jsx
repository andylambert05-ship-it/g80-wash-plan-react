import { useEffect, useRef } from 'react'

// Shared modal wrapper — backdrop-tap dismiss, Escape to close, focus trap,
// body scroll lock, and focus restore on close. Replaces the raw fixed-div
// overlays that previously wrapped the add forms.
export default function Modal({ onClose, children, maxWidth = 600, label = 'Dialog' }) {
  const boxRef = useRef(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement

    const getFocusables = () => {
      if (!boxRef.current) return []
      return [...boxRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )].filter(el => !el.disabled && el.offsetParent !== null)
    }

    // Move focus into the dialog
    const first = getFocusables()[0]
    if (first) first.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        const els = getFocusables()
        if (!els.length) return
        const firstEl = els[0]
        const lastEl = els[els.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault(); lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault(); firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true)

    // Lock body scroll while open
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = prevOverflow
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus()
    }
  }, [onClose])

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-box" ref={boxRef} style={{ maxWidth }}>
        {children}
      </div>
    </div>
  )
}
