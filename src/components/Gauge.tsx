import { formatHz } from '../audio/frequencies'

type Props = {
  hz: number | null
  target: number
  confidence: number
  centsFrom440: number
  analyzing: boolean
}

export default function Gauge({ hz, target, confidence, centsFrom440, analyzing }: Props) {
  const shown = hz ?? 440
  const cents = hz ? 1200 * Math.log2(target / hz) : 0
  const needle = Math.max(-45, Math.min(45, cents * 1.1))
  const ring = Math.max(0, Math.min(1, confidence))

  return (
    <div className="gauge">
      <svg viewBox="0 0 280 200" className="gauge-svg" aria-hidden>
        <defs>
          <linearGradient id="g-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e8c96a" />
            <stop offset="100%" stopColor="#8a6a1a" />
          </linearGradient>
        </defs>
        <path
          d="M30 160 A110 110 0 0 1 250 160"
          fill="none"
          stroke="rgba(232,224,208,0.08)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M30 160 A110 110 0 0 1 250 160"
          fill="none"
          stroke="url(#g-gold)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${ring * 346} 346`}
          opacity={hz ? 1 : 0.25}
        />
        {[-40, -20, 0, 20, 40].map((c) => {
          const a = ((c / 45) * Math.PI) / 2 - Math.PI / 2
          const x1 = 140 + Math.cos(a) * 92
          const y1 = 160 + Math.sin(a) * 92
          const x2 = 140 + Math.cos(a) * 104
          const y2 = 160 + Math.sin(a) * 104
          return (
            <line
              key={c}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(232,224,208,0.35)"
              strokeWidth="1.5"
            />
          )
        })}
        <g
          style={{
            transformOrigin: '140px 160px',
            transform: `rotate(${analyzing ? 0 : needle}deg)`,
            transition: 'transform 0.8s cubic-bezier(.2,.8,.2,1)',
          }}
        >
          <line
            x1="140"
            y1="160"
            x2="140"
            y2="58"
            stroke="#e8c96a"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="140" cy="160" r="6" fill="#e8c96a" />
        </g>
      </svg>
      <div className="gauge-readout">
        <div className="hz-big">
          {analyzing ? (
            <span className="pulse">···</span>
          ) : hz ? (
            <>
              {formatHz(shown, 1)}
              <span className="hz-unit">Hz</span>
            </>
          ) : (
            <span className="hz-placeholder">— Hz</span>
          )}
        </div>
        <div className="hz-sub">
          {hz
            ? `${centsFrom440 >= 0 ? '+' : ''}${centsFrom440.toFixed(1)} ct zu 440 · Ziel ${formatHz(target, 2)} Hz (${cents >= 0 ? '+' : ''}${cents.toFixed(1)} ct)`
            : 'Datei laden, um den Kammerton zu erkennen'}
        </div>
      </div>
    </div>
  )
}
