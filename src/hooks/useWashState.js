import { useState, useEffect } from 'react'

function loadSet(key) {
  try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')) } catch { return new Set() }
}
function saveSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set])) } catch {}
}
function checkAutoReset() {
  const today = new Date().toDateString()
  const last = localStorage.getItem('gwp_date')
  if (last && last !== today) {
    localStorage.removeItem('gwp_done')
    localStorage.removeItem('gwp_eng')
  }
  localStorage.setItem('gwp_date', today)
}

export function useWashState() {
  const [mode, setModeState] = useState(() => localStorage.getItem('gwp_mode') || 'normal')
  const [done, setDone] = useState(() => { checkAutoReset(); return loadSet('gwp_done') })
  const [engDone, setEngDone] = useState(() => loadSet('gwp_eng'))
  const [intDone, setIntDone] = useState(() => loadSet('gwp_int'))

  const setMode = (m) => { setModeState(m); localStorage.setItem('gwp_mode', m) }

  const toggleStep = (id) => setDone(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    saveSet('gwp_done', next)
    return next
  })

  const toggleEng = (id) => setEngDone(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    saveSet('gwp_eng', next)
    return next
  })

  const toggleInt = (id) => setIntDone(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    saveSet('gwp_int', next)
    return next
  })

  const resetSteps = () => { setDone(new Set()); localStorage.removeItem('gwp_done') }
  const resetEng = () => { setEngDone(new Set()); localStorage.removeItem('gwp_eng') }
  const resetInt = () => { setIntDone(new Set()); localStorage.removeItem('gwp_int') }

  return { mode, setMode, done, toggleStep, resetSteps, engDone, toggleEng, resetEng, intDone, toggleInt, resetInt }
}
