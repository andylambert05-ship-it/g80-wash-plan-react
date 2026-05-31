import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Hide the branded boot splash once the app has painted
requestAnimationFrame(() => {
  const splash = document.getElementById('boot-splash')
  if (splash) {
    splash.classList.add('hide')
    setTimeout(() => splash.remove(), 450)
  }
})
