const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function Wordmark() {
  return (
    <p className="skin-wordmark flex items-center gap-2 font-display text-3xl text-accent">
      <span className="skin-mark" aria-hidden="true">
        <svg className="mark-mask" viewBox="0 0 16 16" {...stroke}>
          <path d="M2.4 8.6c.2-3.2 2.4-5.4 5.6-5.4s5.4 2.2 5.6 5.4c.1 2.2-1.2 4-5.6 4.6-4.4-.6-5.7-2.4-5.6-4.6z" />
          <circle cx="6.1" cy="8.1" r="0.7" fill="currentColor" stroke="none" />
          <circle cx="9.9" cy="8.1" r="0.7" fill="currentColor" stroke="none" />
        </svg>
        <svg className="mark-card" viewBox="0 0 16 16" {...stroke}>
          <path d="M3 3.2h7.2l2.6 2.6V13H3z" />
          <path d="M10 3.4V6h2.6M5 8.2h4.2M5 10.4h3" />
        </svg>
        <svg className="mark-cup" viewBox="0 0 16 16" {...stroke}>
          <path d="M3.6 5.2h6.4v3.6a2.8 2.8 0 0 1-2.8 2.8H6.4A2.8 2.8 0 0 1 3.6 8.8z" />
          <path d="M10 6.2h1.2a1.6 1.6 0 0 1 0 3.2H10M4.6 13.2h6.2M6.2 3.2c.3.6.3 1 .2 1.6M8.4 2.8c.3.6.3 1 .2 1.6" />
        </svg>
        <svg className="mark-shades" viewBox="0 0 16 16" {...stroke}>
          <path d="M1.8 7.2h5.2v2.2a1.6 1.6 0 0 1-1.6 1.6H3.4A1.6 1.6 0 0 1 1.8 9.4z" />
          <path d="M9 7.2h5.2v2.2a1.6 1.6 0 0 1-1.6 1.6h-2a1.6 1.6 0 0 1-1.6-1.6z" />
          <path d="M7 7.6h2" />
        </svg>
        <svg className="mark-spoon" viewBox="0 0 16 16" {...stroke}>
          <path d="M6.2 2.6h3.6v3.2a1.8 1.8 0 0 1-3.6 0z" />
          <path d="M8 7.6v6" />
        </svg>
        <svg className="mark-skyline" viewBox="0 0 16 16" {...stroke}>
          <path d="M1.6 13.2h12.8M2.4 13.2V8.2h2.4v5M5.6 13.2V4.4h3.2v8.8M9.6 13.2V7h3.2v6.2" />
        </svg>
      </span>
      26
    </p>
  );
}
