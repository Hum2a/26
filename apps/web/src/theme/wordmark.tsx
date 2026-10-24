import { memo } from "react";

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Wordmark = memo(function Wordmark() {
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
        <svg className="mark-terminal" viewBox="0 0 16 16" {...stroke}>
          <path d="M3 4.2 6.4 8 3 11.8M8 11.8h5" />
        </svg>
        <svg className="mark-note" viewBox="0 0 16 16" {...stroke}>
          <path d="M6.2 12.2V3.8l5.4-1.2v6.2" />
          <circle cx="5" cy="12.2" r="1.5" />
          <circle cx="10.4" cy="9.6" r="1.5" />
        </svg>
        <svg className="mark-sun" viewBox="0 0 16 16" {...stroke}>
          <circle cx="8" cy="8" r="2.3" />
          <path d="M8 2.2v1.6M8 12.2v1.6M2.2 8h1.6M12.2 8h1.6M4 4l1.1 1.1M10.9 10.9 12 12M12 4l-1.1 1.1M5.1 10.9 4 12" />
        </svg>
        <svg className="mark-beam" viewBox="0 0 16 16" {...stroke}>
          <path d="M3 13.2h10M5 13.2V6.2M8 13.2V3.4M11 13.2V7.4" />
        </svg>
        <svg className="mark-ring" viewBox="0 0 16 16" {...stroke}>
          <circle cx="8" cy="8" r="5.2" />
          <circle cx="8" cy="8" r="2.1" />
        </svg>
        <svg className="mark-stamp" viewBox="0 0 16 16" {...stroke}>
          <rect x="2.6" y="3.2" width="10.8" height="9.6" rx="1.2" />
          <path d="M5 8h6" />
        </svg>
        <svg className="mark-star" viewBox="0 0 16 16" {...stroke}>
          <path d="M8 2.2 9.3 5.8l3.8.3-2.9 2.4.9 3.6L8 10.2l-3.1 2-1-3.6-2.9-2.4 3.8-.3z" />
        </svg>
        <svg className="mark-mic" viewBox="0 0 16 16" {...stroke}>
          <rect x="6" y="2.2" width="4" height="6.4" rx="2" />
          <path d="M4.2 7.4a3.8 3.8 0 0 0 7.6 0M8 11.2v2.4" />
        </svg>
        <svg className="mark-leaf" viewBox="0 0 16 16" {...stroke}>
          <path d="M8.1 13.6c-3.8-2.1-5.2-5.6-4.5-8.6 2.1.4 3.8 1.7 4.5 3.6.7-1.9 2.4-3.2 4.5-3.6.7 3-.7 6.5-4.5 8.6z" />
          <path d="M8.1 13.2V6.4" />
        </svg>
        <svg className="mark-plus" viewBox="0 0 16 16" {...stroke}>
          <rect x="2.8" y="2.8" width="10.4" height="10.4" rx="2.4" />
          <path d="M8 5.3v5.4M5.3 8h5.4" />
        </svg>
      </span>
      26
    </p>
  );
});
