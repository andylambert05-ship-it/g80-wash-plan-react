import { useState, useEffect } from 'react'

// Open-Meteo: free, no API key, no CORS issues, no signup required.
// Docs: https://open-meteo.com/en/docs

const CACHE_KEY = 'gwp_weather_cache_v2' // v2: shape now includes 7-day forecast
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const LOC_KEY = 'gwp_weather_loc'

const DEFAULT_LOCATION = { lat: 40.4233, lon: -104.7091, label: 'Greeley, CO' }

export function getStoredLocation() {
  try {
    const stored = JSON.parse(localStorage.getItem(LOC_KEY) || 'null')
    if (stored && isFinite(stored.lat) && isFinite(stored.lon)) return stored
  } catch {}
  return DEFAULT_LOCATION
}

export function saveLocation(loc) {
  try {
    localStorage.setItem(LOC_KEY, JSON.stringify(loc))
    localStorage.removeItem(CACHE_KEY) // stale for the new location
  } catch {}
}

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
 * Returns { loading, error, weather, alerts, forecast, bestDay } where:
 *   weather  = { tempF, uvMax, windMax, rainProb, hoursToRain, location }
 *   alerts   = array of { id, severity, message } — empty if clear
 *   forecast = 7 days of { date, dow, tempF, uv, wind, rainProb, score, rating }
 *   bestDay  = the forecast entry with the highest score (null if all poor)
 */
export function useWeather() {
  const [location] = useState(getStoredLocation)
  const [state, setState] = useState({ loading: true, error: null, weather: null, alerts: [], forecast: [], bestDay: null })

  useEffect(() => {
    let cancelled = false

    async function fetchWeather() {
      // Try cache first
      const cached = loadCache()
      if (cached) {
        if (!cancelled) setState({ loading: false, error: null, ...cached })
        return
      }

      try {
        const url = `https://api.open-meteo.com/v1/forecast` +
          `?latitude=${location.lat}&longitude=${location.lon}` +
          `&current=temperature_2m,wind_speed_10m` +
          `&daily=temperature_2m_max,temperature_2m_min,uv_index_max,wind_speed_10m_max,precipitation_sum,precipitation_probability_max` +
          `&hourly=precipitation_probability` +
          `&temperature_unit=fahrenheit&wind_speed_unit=mph&forecast_days=7&timezone=auto`

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
        const forecast = buildForecast(json.daily)
        const bestDay = pickBestDay(forecast)

        const payload = { weather, alerts, forecast, bestDay }
        saveCache(payload)
        if (!cancelled) setState({ loading: false, error: null, ...payload })
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: e.message, weather: null, alerts: [], forecast: [], bestDay: null })
      }
    }

    fetchWeather()
    return () => { cancelled = true }
  }, [location.lat, location.lon])

  return state
}

// ── 7-day wash-day scoring ───────────────────────────────────────────────────
//
// A good wash day: dry that day AND the day after (a wash the day before rain
// is wasted effort), panel temps 50–85°F, low wind (dust during dry/buff), and
// moderate UV (flash-dry risk).
function buildForecast(daily) {
  const n = Math.min(7, daily.time?.length || 0)
  const days = []
  for (let i = 0; i < n; i++) {
    // Parse as local date, not UTC midnight
    const date = new Date(daily.time[i] + 'T12:00:00')
    days.push({
      date: daily.time[i],
      dow: i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' }),
      tempF: Math.round(daily.temperature_2m_max[i]),
      uv: Math.round(daily.uv_index_max[i]),
      wind: Math.round(daily.wind_speed_10m_max[i]),
      rainProb: Math.round(daily.precipitation_probability_max?.[i] ?? 0),
    })
  }
  days.forEach((d, i) => {
    let score = 100
    // Rain that day is the killer; rain the next day wastes the wash
    score -= d.rainProb * 0.6
    const next = days[i + 1]
    if (next) score -= next.rainProb * 0.25
    // Temperature window
    if (d.tempF < 40) score -= 45
    else if (d.tempF < 50) score -= 20
    if (d.tempF > 95) score -= 30
    else if (d.tempF > 88) score -= 10
    // Wind
    if (d.wind >= 25) score -= 30
    else if (d.wind >= 20) score -= 20
    else if (d.wind >= 15) score -= 8
    // UV
    if (d.uv >= 10) score -= 15
    else if (d.uv >= 8) score -= 8
    d.score = Math.max(0, Math.round(score))
    d.rating = d.score >= 75 ? 'good' : d.score >= 50 ? 'ok' : 'poor'
  })
  return days
}

function pickBestDay(forecast) {
  if (!forecast.length) return null
  const best = forecast.reduce((a, b) => (b.score > a.score ? b : a))
  return best.rating === 'poor' ? null : best
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
