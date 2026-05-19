export default function BMWMLogo({ height = 18 }) {
  const w = height * (220 / 78)
  return (
    <svg
      width={w}
      height={height}
      viewBox="0 0 220 78"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="BMW M"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Blue left M leg */}
      <path d="M0,78 L37,0 L74,78 L60,78 L37,30 L14,78 Z" fill="#0066B1" />
      {/* Dark centre overlap */}
      <path d="M60,78 L74,78 L74,52 Z" fill="#003D78" />
      {/* Dark blue centre M */}
      <path d="M37,0 L74,78 L110,78 L147,0 L134,0 L110,52 L51,0 Z" fill="#003D78" />
      {/* Transition overlap */}
      <path d="M134,0 L110,52 L110,78 L124,78 Z" fill="#003D78" />
      {/* Red right M leg */}
      <path d="M147,0 L183,78 L220,78 L220,0 L206,0 L183,30 L160,0 Z" fill="#E22718" />
      {/* Red inner right */}
      <path d="M160,0 L183,52 L183,78 L170,78 Z" fill="#E22718" />
    </svg>
  )
}
