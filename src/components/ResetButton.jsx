import { useState, useRef, useEffect } from 'react'

export default function ResetButton({ onReset, label = 'Reset all' }) {
  const [confirming, setConfirming] = useState(false)
  const timeoutRef = useRef(null)

  useEffect(() => () => clearTimeout(timeoutRef.current), [])

  const handleClick = () => {
    if (confirming) {
      clearTimeout(timeoutRef.current)
      setConfirming(false)
      onReset()
    } else {
      setConfirming(true)
      // Auto-cancel the confirm prompt after 3s if not tapped again
      timeoutRef.current = setTimeout(() => setConfirming(false), 3000)
    }
  }

  return (
    <button
      className={`rbtn${confirming ? ' confirming' : ''}`}
      onClick={handleClick}
    >
      <i className={`ti ${confirming ? 'ti-alert-triangle' : 'ti-refresh'}`} aria-hidden="true" />
      {confirming ? 'Tap again to confirm' : label}
    </button>
  )
}
