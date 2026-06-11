import { useState, useEffect } from 'react'

// Open-Meteo: free, no API key, no CORS issues, no signup required.
// Docs: https://open-meteo.com/en/docs

const CACHE_KEY = 'gwp_weather_cache'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

// Greeley, CO coords — could be made configurable via Settings later
const DEFAULT_LOCATION = { lat: 40.4233, lon: -104.7091, label: 'Greeley, CO' }

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL_MS) return null
    return data
  } catch { return null }
}

function saveCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

/**
 * Returns { loading, error, weather, alerts } where:
 *   weather = { tempF, uvMax, windMax, rainHours, location }
 *   alerts  = array of { id, severity, message } — empty if clear
 */
export function useWeather(location = DEFAULT_LOCATION) {
  const [state, setState] = useState({ loading: true, error: null, weather: null, alerts: [] })

  useEffect(() => {
    let cancelled = false

    async function fetchWeather() {
      // Try cache first
      const cached = loadCache()
      if (cached) {
        if (!cancelled) setState({ loading: false, error: null, weather: cached.weather, alerts: cached.alerts })
        return
      }

      try {
        const url = `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${location.lat}&longitude=${location.lon}` +
          `&current=temperature_2m,wind_speed_10m` +
          `&daily=temperature_2m_max,uv_index_max,wind_speed_10m_max,precipitation_sum,precipitation_probability_max` +
          `&hourly=precipitation_probability` +
          `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=3&timezone=auto`

        const res = await fetch(url)
        if (!res.ok) throw new Error(`Weather API: HTTP ${res.status}`)
        const json = await res.json()

        const tempF = Math.round(json.daily.temperature_2m_max[0])
        const uvMax = Math.round(json.daily.uv_index_max[0])
        const windMax = Math.round(json.daily.wind_speed_10m_max[0])
        // Rain probability in next 48 hours — peak %
        const next48 = (json.hourly?.precipitation_probability || []).slice(0, 48)
        const rainProb = next48.length ? Math.max(...next48) : 0
        // How many hours until first hour with >=50% rain
        const hoursToRain = next48.findIndex(p => p >= 50)

        const weather = { tempF, uvMax, windMax, rainProb, hoursToRain, location: location.label }
        const alerts = buildAlerts(weather)

        saveCache({ weather, alerts })
        if (!cancelled) setState({ loading: false, error: null, weather, alerts })
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: e.message, weather: null, alerts: [] })
      }
    }

    fetchWeather()
    return () => { cancelled = true }
  }, [location.lat, location.lon])

  return state
}

function buildAlerts(w) {
  const alerts = []
  if (w.hoursToRain >= 0 && w.hoursToRain <= 48) {
    alerts.push({
      id: 'rain',
      severity: w.hoursToRain <= 12 ? 'high' : 'med',
      icon: 'ti-cloud-rain',
      message: `Rain in ~${w.hoursToRain}h (${w.rainProb}% prob). Consider skipping LSP or using a faster sealant.`
    })
  }
  if (w.uvMax >= 8) {
    alerts.push({
      id: 'uv',
      severity: w.uvMax >= 10 ? 'high' : 'med',
      icon: 'ti-sun',
      message: `UV index ${w.uvMax} — flash-dry risk. Wash in shade, work small panels.`
    })
  }
  if (w.tempF >= 90) {
    alerts.push({
      id: 'heat',
      severity: w.tempF >= 95 ? 'high' : 'med',
      icon: 'ti-temperature-sun',
      message: `${w.tempF}°F today — panel temps will be high. Cool panels first, work small sections.`
    })
  }
  if (w.windMax >= 20) {
    alerts.push({
      id: 'wind',
      severity: 'med',
      icon: 'ti-wind',
      message: `Winds up to ${w.windMax}mph — airborne dust contamination risk during dry/buff.`
    })
  }
  return alerts
}
