// Decorative panel for the signup page: a faded Indian block-print pattern behind a
// map grid, with trade routes running from Jaipur to buyer cities. Pure SVG — no photo.
// Cities are placed with an equirectangular projection cropped to lon -100..160, lat 70..-45.

const W = 400
const MAP_TOP = 150
const project = (lon: number, lat: number) => ({
  x: ((lon + 100) * W) / 260,
  y: MAP_TOP + ((70 - lat) * 177) / 115,
})

const ORIGIN = { name: 'Jaipur', ...project(75.8, 26.9) }
const CITIES = [
  { name: 'London', ...project(-0.1, 51.5), lift: 70 },
  { name: 'New York', ...project(-74, 40.7), lift: 110 },
  { name: 'Dubai', ...project(55.3, 25.2), lift: 26, labelAbove: true },
  { name: 'Singapore', ...project(103.8, 1.35), lift: 30 },
  { name: 'Tokyo', ...project(139.7, 35.7), lift: 50 },
  { name: 'Sydney', ...project(147, -33.9), lift: 60 },
]

function arc(to: { x: number; y: number; lift: number }) {
  const mx = (ORIGIN.x + to.x) / 2
  const my = Math.min(ORIGIN.y, to.y) - to.lift
  return `M${ORIGIN.x.toFixed(1)},${ORIGIN.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${to.x.toFixed(1)},${to.y.toFixed(1)}`
}

export function TradeRoutesArt() {
  return (
    <svg viewBox="0 0 400 500" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        {/* Block-print motif: a four-petal flower inside a diamond, tiled. */}
        <pattern id="sb-blockprint" width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M22 2 L42 22 L22 42 L2 22 Z" fill="none" stroke="#fff" strokeWidth="0.8" />
          <g fill="#fff">
            <ellipse cx="22" cy="15" rx="3" ry="6" />
            <ellipse cx="22" cy="29" rx="3" ry="6" />
            <ellipse cx="15" cy="22" rx="6" ry="3" />
            <ellipse cx="29" cy="22" rx="6" ry="3" />
          </g>
          <circle cx="22" cy="22" r="2.2" fill="#183D33" />
          <circle cx="0" cy="0" r="1.6" fill="#fff" />
          <circle cx="44" cy="0" r="1.6" fill="#fff" />
          <circle cx="0" cy="44" r="1.6" fill="#fff" />
          <circle cx="44" cy="44" r="1.6" fill="#fff" />
        </pattern>
        <radialGradient id="sb-fade" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="#183D33" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#0F241D" stopOpacity="0.9" />
        </radialGradient>
        <style>{`
          .sb-route { stroke-dasharray: 3 5; }
          @media (prefers-reduced-motion: no-preference) {
            .sb-route { animation: sb-dash 2.4s linear infinite; }
            .sb-pulse { animation: sb-pulse 2.4s ease-out infinite; transform-box: fill-box; transform-origin: center; }
          }
          @keyframes sb-dash { to { stroke-dashoffset: -16; } }
          @keyframes sb-pulse { 0% { transform: scale(1); opacity: .6 } 100% { transform: scale(3.2); opacity: 0 } }
        `}</style>
      </defs>

      <rect width="400" height="500" fill="#183D33" />
      <rect width="400" height="500" fill="url(#sb-blockprint)" opacity="0.06" />
      <rect width="400" height="500" fill="url(#sb-fade)" />

      {/* Map grid: faded meridians and parallels */}
      <g stroke="#D9E2DA" strokeWidth="0.5" opacity="0.18" fill="none">
        {Array.from({ length: 14 }, (_, i) => (
          <path key={`m${i}`} d={`M${i * 30 + 5},${MAP_TOP - 40} C${i * 30 + 12},${MAP_TOP + 90} ${i * 30 + 12},${MAP_TOP + 180} ${i * 30 + 5},${MAP_TOP + 230}`} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <path key={`p${i}`} d={`M0,${MAP_TOP - 20 + i * 36} Q200,${MAP_TOP - 34 + i * 36} 400,${MAP_TOP - 20 + i * 36}`} />
        ))}
      </g>

      {/* Routes */}
      <g fill="none" stroke="#E9C46A" strokeWidth="1.4" strokeLinecap="round" opacity="0.85">
        {CITIES.map((c) => (
          <path key={c.name} d={arc(c)} className="sb-route" />
        ))}
      </g>

      {/* Destination pins */}
      {CITIES.map((c) => (
        <g key={c.name}>
          <circle cx={c.x} cy={c.y} r="3" fill="#fff" />
          <text
            x={c.x}
            y={'labelAbove' in c && c.labelAbove ? c.y - 8 : c.y + 14}
            textAnchor={c.x > 360 ? 'end' : c.x < 40 ? 'start' : 'labelAbove' in c && c.labelAbove ? 'end' : 'middle'}
            fill="#D9E2DA"
            fontSize="9"
            fontFamily="inherit"
            letterSpacing="0.06em"
          >
            {c.name.toUpperCase()}
          </text>
        </g>
      ))}

      {/* Origin: Jaipur */}
      <circle cx={ORIGIN.x} cy={ORIGIN.y} r="5" fill="#E9C46A" className="sb-pulse" />
      <circle cx={ORIGIN.x} cy={ORIGIN.y} r="5" fill="#E9C46A" />
      <text x={ORIGIN.x} y={ORIGIN.y + 18} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" letterSpacing="0.08em">
        JAIPUR
      </text>

      {/* Copy */}
      <text x="32" y="60" fill="#E9C46A" fontSize="10" fontWeight="700" letterSpacing="0.14em">
        SOLOMON BHARAT
      </text>
      <text x="32" y="92" fill="#fff" fontSize="24" fontFamily="var(--font-playfair), Georgia, serif">
        Handmade in India,
      </text>
      <text x="32" y="122" fill="#fff" fontSize="24" fontFamily="var(--font-playfair), Georgia, serif">
        on shelves worldwide.
      </text>
      <g fill="#D9E2DA" fontSize="11">
        <text x="32" y="430">✓  Quality-checked in Jaipur</text>
        <text x="32" y="450">✓  Delivered duty paid to the UK</text>
        <text x="32" y="470">✓  Pay in your own currency</text>
      </g>
    </svg>
  )
}
