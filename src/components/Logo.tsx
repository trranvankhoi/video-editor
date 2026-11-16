export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="ClipPro logo"
      className="logo-mark"
    >
      <defs>
        <linearGradient id="clippro-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#6d6cff" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="19" fill="url(#clippro-mark)" />
      <path d="M25 20.5 46 32 25 43.5Z" fill="#fff" />
      <circle cx="48" cy="16" r="5.2" fill="#c7f464" stroke="#0a0a10" strokeWidth="2.5" />
      <path d="M12.5 25c1.6-5.4 5.9-9.2 11.2-10.6" stroke="rgba(255,255,255,.45)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function LogoWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo-wordmark">
      <LogoMark size={compact ? 28 : 34} />
      <span className="logo-text">
        Clip<span>Pro</span>
      </span>
    </div>
  )
}
