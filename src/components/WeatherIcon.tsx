/** FMI WeatherSymbol3 → simple SVG icons for the home weather strip */

type IconKind = 'clear' | 'partly' | 'cloudy' | 'rain' | 'sleet' | 'snow' | 'thunder' | 'unknown'

function kindFromSymbol(symbol: number | null | undefined): IconKind {
  if (symbol == null || Number.isNaN(symbol)) return 'unknown'
  const s = Math.round(symbol)
  if (s === 1) return 'clear'
  if (s === 2) return 'partly'
  if (s === 3) return 'cloudy'
  if ((s >= 21 && s <= 23) || (s >= 51 && s <= 53) || (s >= 81 && s <= 83)) return 'rain'
  if ((s >= 31 && s <= 33) || (s >= 61 && s <= 63)) return 'sleet'
  if ((s >= 41 && s <= 43) || (s >= 71 && s <= 73)) return 'snow'
  if (s === 91 || s === 92) return 'thunder'
  return 'unknown'
}

function Sun({ size }: { size: number }) {
  return (
    <g>
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x1 = 12 + Math.cos(rad) * 6.2
        const y1 = 12 + Math.sin(rad) * 6.2
        const x2 = 12 + Math.cos(rad) * 9.4
        const y2 = 12 + Math.sin(rad) * 9.4
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth={size < 22 ? 1.5 : 1.7}
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}

function Cloud({ size, dim = false }: { size: number; dim?: boolean }) {
  return (
    <path
      d="M7.2 17.2h10.6c2.1 0 3.7-1.5 3.7-3.4 0-1.8-1.4-3.3-3.2-3.5-.3-2.4-2.4-4.3-5-4.3-2.1 0-3.9 1.2-4.7 3-.8-.5-1.8-.8-2.8-.8-2.7 0-4.8 2-4.8 4.5 0 2.5 2.1 4.5 4.8 4.5z"
      fill="currentColor"
      opacity={dim ? 0.55 : 0.9}
      strokeWidth={size < 22 ? 0 : 0}
    />
  )
}

export function WeatherIcon({
  symbol,
  size = 36,
  className,
}: {
  symbol: number | null | undefined
  size?: number
  className?: string
}) {
  const kind = kindFromSymbol(symbol)
  const stroke = size < 22 ? 1.4 : 1.6

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'clear' && <Sun size={size} />}

      {kind === 'partly' && (
        <g>
          <g transform="translate(-1.5 -2.2) scale(0.72)">
            <Sun size={size} />
          </g>
          <g transform="translate(1 3)">
            <Cloud size={size} />
          </g>
        </g>
      )}

      {kind === 'cloudy' && <Cloud size={size} />}

      {kind === 'rain' && (
        <g>
          <g transform="translate(0 -1.5)">
            <Cloud size={size} />
          </g>
          <g stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">
            <line x1="8" y1="17.2" x2="6.8" y2="20.2" />
            <line x1="12" y1="17.6" x2="10.8" y2="20.6" />
            <line x1="16" y1="17.2" x2="14.8" y2="20.2" />
          </g>
        </g>
      )}

      {kind === 'sleet' && (
        <g>
          <g transform="translate(0 -1.5)">
            <Cloud size={size} />
          </g>
          <g stroke="currentColor" strokeWidth={stroke} strokeLinecap="round">
            <line x1="8" y1="17.2" x2="6.8" y2="19.8" />
            <circle cx="12.2" cy="19.4" r="1" fill="currentColor" />
            <line x1="16" y1="17.2" x2="14.8" y2="19.8" />
          </g>
        </g>
      )}

      {kind === 'snow' && (
        <g>
          <g transform="translate(0 -1.5)">
            <Cloud size={size} />
          </g>
          <g fill="currentColor">
            <circle cx="8.2" cy="19.2" r="1.05" />
            <circle cx="12" cy="20.2" r="1.05" />
            <circle cx="15.8" cy="19.2" r="1.05" />
          </g>
        </g>
      )}

      {kind === 'thunder' && (
        <g>
          <g transform="translate(0 -2)">
            <Cloud size={size} dim />
          </g>
          <path
            d="M11.2 14.2h2.4l-1.5 3.2h1.8L10.8 22l.7-3.4H9.6L11.2 14.2z"
            fill="currentColor"
          />
        </g>
      )}

      {kind === 'unknown' && (
        <g>
          <Cloud size={size} dim />
          <circle cx="12" cy="12.5" r="1.1" fill="currentColor" opacity="0.45" />
        </g>
      )}
    </svg>
  )
}
