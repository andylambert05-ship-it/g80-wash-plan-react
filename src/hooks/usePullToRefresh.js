import { useState, useRef, useCallback, useEffect } from 'react'

const THRESHOLD = 80   // px to pull before triggering refresh
const MAX_PULL = 120   // max visual pull distance

export function usePullToRefresh(onRefresh) {
  const [pullState, setPullState] = useState({ pulling: false, pullDistance: 0, refreshing: false })
  const startY = useRef(0)
  const pulling = useRef(false)

  const handleTouchStart = useCallback((e) => {
    // Only activate when scrolled to the very top
    if (window.scrollY > 0) return
    startY.current = e.touches[0].clientY
    pulling.current = false
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (window.scrollY > 0) return
    const delta = e.touches[0].clientY - startY.current
    if (delta > 10) {
      pulling.current = true
      const distance = Math.min(delta * 0.5, MAX_PULL)
      setPullState(s => ({ ...s, pulling: true, pullDistance: distance }))
      if (delta > 30) e.preventDefault()
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!pulling.current) return
    pulling.current = false

    setPullState(s => {
      if (s.pullDistance >= THRESHOLD) {
        // Trigger refresh — show spinner for minimum 2 seconds
        setPullState({ pulling: false, pullDistance: 40, refreshing: true })
        const start = Date.now()
        onRefresh().finally(() => {
          const elapsed = Date.now() - start
          const remaining = Math.max(0, 2000 - elapsed)
          setTimeout(() => {
            setPullState({ pulling: false, pullDistance: 0, refreshing: false })
          }, remaining)
        })
      } else {
        return { pulling: false, pullDistance: 0, refreshing: false }
      }
      return s
    })
  }, [onRefresh])

  useEffect(() => {
    const opts = { passive: false }
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, opts)
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return pullState
}
