import { useEffect, useRef } from 'react'

/**
 * Keep the screen awake while `active` is true.
 * Uses the Screen Wake Lock API — silently no-ops on unsupported browsers.
 * Auto-reacquires on visibilitychange (browsers release the lock when the tab is hidden).
 */
export function useWakeLock(active) {
  const lockRef = useRef(null)

  useEffect(() => {
    if (!('wakeLock' in navigator)) return // unsupported (older iOS Safari, etc.)

    let cancelled = false

    async function acquire() {
      if (!active || cancelled) return
      try {
        lockRef.current = await navigator.wakeLock.request('screen')
        // If the browser releases it for any reason, drop our ref
        lockRef.current.addEventListener('release', () => {
          lockRef.current = null
        })
      } catch (e) {
        // Permissions / hardware / etc. — fail silently
        console.warn('Wake lock request failed:', e.message)
      }
    }

    function release() {
      if (lockRef.current) {
        lockRef.current.release().catch(() => {})
        lockRef.current = null
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible' && active && !lockRef.current) {
        acquire()
      }
    }

    if (active) {
      acquire()
      document.addEventListener('visibilitychange', onVisibility)
    }

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
      release()
    }
  }, [active])
}
