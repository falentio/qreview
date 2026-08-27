export function AuthArtwork() {
  return (
    <svg
      viewBox="0 0 560 640"
      className="pointer-events-none absolute inset-0 h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="auth-artwork-background"
          x1="0"
          y1="0"
          x2="560"
          y2="640"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="var(--primary)" />
          <stop offset="1" stopColor="#312E81" />
        </linearGradient>
        <linearGradient
          id="auth-artwork-top"
          x1="0"
          y1="0"
          x2="280"
          y2="170"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#E0F2FE" stopOpacity="0.32" />
          <stop offset="1" stopColor="#C4B5FD" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient
          id="auth-artwork-left"
          x1="0"
          y1="0"
          x2="280"
          y2="240"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="1" stopColor="#38BDF8" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient
          id="auth-artwork-right"
          x1="280"
          y1="0"
          x2="560"
          y2="240"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FDE68A" stopOpacity="0.16" />
          <stop offset="1" stopColor="#F472B6" stopOpacity="0.08" />
        </linearGradient>
        <pattern id="auth-artwork-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" stroke="#FFFFFF" strokeOpacity="0.08" />
        </pattern>
        <filter id="auth-artwork-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#020617" floodOpacity="0.28" />
        </filter>
      </defs>

      <rect width="560" height="640" fill="url(#auth-artwork-background)" />
      <rect width="560" height="640" fill="url(#auth-artwork-grid)" />

      <g opacity="0.6">
        <circle cx="84" cy="108" r="4" fill="#FDE68A" />
        <circle cx="476" cy="154" r="3" fill="#E0F2FE" />
        <circle cx="92" cy="510" r="3" fill="#C4B5FD" />
        <circle cx="478" cy="474" r="4" fill="#A7F3D0" />
      </g>

      <g filter="url(#auth-artwork-shadow)" transform="translate(280 314)">
        <path
          d="M0-148L154-62L0 26L-154-62L0-148Z"
          fill="url(#auth-artwork-top)"
          stroke="#E0F2FE"
          strokeOpacity="0.52"
          strokeWidth="2"
        />
        <path
          d="M-154-62L0 26V202L-154 114V-62Z"
          fill="url(#auth-artwork-left)"
          stroke="#FFFFFF"
          strokeOpacity="0.28"
          strokeWidth="2"
        />
        <path
          d="M0 26L154-62V114L0 202V26Z"
          fill="url(#auth-artwork-right)"
          stroke="#FFFFFF"
          strokeOpacity="0.28"
          strokeWidth="2"
        />
        <path d="M0-148V26M0 26V202" stroke="#FFFFFF" strokeOpacity="0.32" />

        <g transform="translate(0 26)">
          <rect
            x="-52"
            y="-52"
            width="104"
            height="104"
            rx="18"
            transform="rotate(45)"
            fill="#FFFFFF"
            fillOpacity="0.9"
          />
          <rect
            x="-38"
            y="-38"
            width="76"
            height="76"
            rx="12"
            transform="rotate(45)"
            fill="var(--primary)"
          />
          <path
            d="M-20-4H-4V-20M4-20H20V-4M20 4V20H4M-4 20H-20V4"
            stroke="#E0F2FE"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="0" cy="0" r="7" fill="#FDE68A" />
        </g>
      </g>

      <g opacity="0.8">
        <path d="M116 226L130 240L116 254L102 240L116 226Z" fill="#FDE68A" />
        <path d="M438 370L452 384L438 398L424 384L438 370Z" fill="#A7F3D0" />
        <path d="M436 188V220M420 204H452" stroke="#E0F2FE" strokeOpacity="0.7" strokeWidth="2" />
      </g>

      <rect x="24" y="24" width="512" height="592" rx="28" stroke="#FFFFFF" strokeOpacity="0.18" />
    </svg>
  )
}
