import { useState } from 'react'
import { useWeather } from '../hooks/useWeather'

const RATING_COLORS = {
  good: '#1a9e62',
  ok: '#c8860a',
  poor: '#cc1e1e',
}

// 7-day "best wash day" strip. Tapping a day shows its details.
export default function WashDayPicker() {
  const { loading, error, forecast, bestDay } = useWeather()
  const [selected, setSelected] = useState(null)

  if (loading || error || !forecast.length) return null

  const detail = forecast.find(d => d.date === selected)

  return (
    <div style={{ padding: '10px 20px 0' }}>
      <div className="wdp">
        <div className="wdp-hdr">
          <i className="ti ti-calendar-star" aria-hidden="true" />
          {bestDay
            ? <>Best wash day: <span className="wdp-best">{bestDay.dow}</span></>
            : <>No great wash day this week</>}
        </div>
        <div className="wdp-strip">
          {forecast.map(d => {
            const isBest = bestDay && d.date === bestDay.date
            const isSel = selected === d.date
            return (
              <button
                key={d.date}
                className={`wdp-day${isBest ? ' best' : ''}${isSel ? ' sel' : ''}`}
                onClick={() => setSelected(isSel ? null : d.date)}
                title={`Score ${d.score}/100`}
              >
                <span className="wdp-dow">{d.dow}</span>
                <span className="wdp-dot" style={{ background: RATING_COLORS[d.rating] }} />
                <span className="wdp-temp">{d.tempF}°</span>
              </button>
            )
          })}
        </div>
        {detail && (
          <div className="wdp-detail">
            <span style={{ color: RATING_COLORS[detail.rating], fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {detail.rating === 'good' ? 'Good' : detail.rating === 'ok' ? 'Fair' : 'Poor'} · {detail.score}/100
            </span>
            {' — '}{detail.tempF}°F · UV {detail.uv} · {detail.wind}mph wind · {detail.rainProb}% rain
          </div>
        )}
      </div>
    </div>
  )
}
