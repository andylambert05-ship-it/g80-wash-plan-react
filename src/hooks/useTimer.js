import { useState, useEffect, useRef, useCallback } from 'react'

export function useTimer() {
  const [timer, setTimer] = useState(null) // { label, remaining, total }
  const intervalRef = useRef(null)
  // Wake lock is owned by App.jsx via useWakeLock(!!timer) — single source of truth.

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ;[0, 0.5, 1].forEach(delay => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.frequency.value = 880; osc.type = 'sine'
        gain.gain.setValueAtTime(0.6, ctx.currentTime + delay)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.4)
        osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.4)
      })
    } catch (e) {}
  }

  const start = useCallback((seconds, label, activeId = null) => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    // Stronger haptic on timer start — confirms the action happened
    try { navigator.vibrate && navigator.vibrate(40) } catch (e) {}
    setTimer({ label, remaining: seconds, total: seconds, done: false, activeId })
    intervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (!prev || prev.remaining <= 0) return prev
        const next = prev.remaining - 1
        if (next <= 0) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          playBeep()
          try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]) } catch (e) {}
          return { ...prev, remaining: 0, done: true }
        }
        return { ...prev, remaining: next }
      })
    }, 1000)
  }, [])

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    setTimer(null)
  }, [])

  // Add `seconds` to a running (or finished) timer. Resumes if it was done.
  const extend = useCallback((seconds) => {
    setTimer(prev => {
      if (!prev) return prev
      try { navigator.vibrate && navigator.vibrate(20) } catch (e) {}
      // If finished, kick the interval back on
      if (prev.done && !intervalRef.current) {
        intervalRef.current = setInterval(() => {
          setTimer(p => {
            if (!p || p.remaining <= 0) return p
            const next = p.remaining - 1
            if (next <= 0) {
              clearInterval(intervalRef.current); intervalRef.current = null
              playBeep()
              try { navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]) } catch (e) {}
              return { ...p, remaining: 0, done: true }
            }
            return { ...p, remaining: next }
          })
        }, 1000)
      }
      return {
        ...prev,
        remaining: prev.remaining + seconds,
        total: prev.total + seconds,
        done: false,
      }
    })
  }, [])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return { timer, start, stop, extend }
}
