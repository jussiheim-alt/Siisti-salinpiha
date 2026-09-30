import type { WeatherPayload } from '../api'
import { WeatherIcon } from './WeatherIcon'

function formatTemp(t: number | null | undefined) {
  if (t == null || Number.isNaN(t)) return '–'
  return `${Math.round(t)}°`
}

function formatWind(ms: number | null | undefined) {
  if (ms == null || Number.isNaN(ms)) return null
  return `${Math.round(ms)} m/s`
}

export function WeatherStrip({ weather }: { weather: WeatherPayload }) {
  const wind = formatWind(weather.current.windMs)
  const warnings = weather.warnings || []

  return (
    <section className="weather-strip" aria-label={`Sää, ${weather.place}`}>
      <div className="weather-now">
        <p className="kicker">Sää · {weather.place}</p>
        <div className="weather-now-row">
          <span className="weather-icon-wrap" aria-hidden="true">
            <WeatherIcon symbol={weather.current.symbol} size={40} />
          </span>
          <div className="weather-now-text">
            <p className="weather-temp">{formatTemp(weather.current.temperature)}</p>
            <p className="weather-desc">{weather.current.symbolLabel}</p>
            {wind && <p className="weather-meta">Tuuli {wind}</p>}
          </div>
        </div>
      </div>

      <ul className="weather-days">
        {weather.days.map((d) => (
          <li key={d.date}>
            <span className="weather-day-label">{d.label}</span>
            <span className="weather-day-icon" aria-hidden="true">
              <WeatherIcon symbol={d.symbol} size={22} />
            </span>
            <span className="weather-day-temp">
              {formatTemp(d.tempMax)}
              <span className="weather-day-min">/{formatTemp(d.tempMin)}</span>
            </span>
            <span className="weather-day-precip">
              {d.precipMm > 0 ? `${d.precipMm} mm` : 'kuiva'}
            </span>
          </li>
        ))}
      </ul>

      {warnings.length > 0 && (
        <ul className="weather-warnings">
          {warnings.map((w) => (
            <li key={w.id} className={`sev-${w.severity.toLowerCase()}`}>
              <strong>
                {w.severityLabel} · {w.event}
              </strong>
              <span>{w.headline}</span>
            </li>
          ))}
        </ul>
      )}

      {weather.tips.length > 0 && (
        <ul className="weather-tips">
          {weather.tips.map((tip) => (
            <li key={tip.id}>
              <strong>{tip.title}</strong>
              <span>{tip.body}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="weather-source">
        Ilmatieteen laitos · ennuste + CAP-varoitukset · {weather.place}
      </p>
    </section>
  )
}
