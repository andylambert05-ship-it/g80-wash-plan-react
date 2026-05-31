import { useState, useEffect, useRef, useCallback } from 'react'

export function useTimer() {
  const [timer, setTimer] = useState(null) // { label, remaining, total }
  const intervalRef = useRef(null)
  const wakeLockRef = useRef(null)

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch (e) {}
  }

  const releaseWakeLock = () => {
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null }
  }

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
    requestWakeLock()
    setTimer({ label, remaining: seconds, total: seconds, done: false, activeId })
    intervalRef.current = setInterval(() => {
      setTimer(prev => {
        if (!prev || prev.remaining <= 0) return prev
        const next = prev.remaining - 1
        if (next <= 0) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          releaseWakeLock()
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
    releaseWakeLock()
    setTimer(null)
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && intervalRef.current) requestWakeLock()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (intervalRef.current) clearInterval(intervalRef.current)
      releaseWakeLock()
    }
  }, [])

  return { timer, start, stop }
}
