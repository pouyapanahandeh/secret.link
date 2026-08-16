/** Compact 2D pair sending smoke-signal secrets. Figures stay connected; only smoke moves. */
export function SmokeSignalScene() {
  return (
    <div className="flex flex-col items-center gap-2 py-3">
      <svg
        viewBox="0 0 200 64"
        className="w-[148px] sm:w-[168px] h-auto text-text"
        role="img"
        aria-label="Two people sending disappearing smoke-signal messages"
      >
        <path d="M18 58h164" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />

        {/* Left person — one connected silhouette */}
        <g fill="currentColor">
          <ellipse cx="34" cy="58" rx="10" ry="2.2" opacity="0.1" />
          <path d="M29 36c0-1.5 1.2-3 3-4h4c1.8 1 3 2.5 3 4v12c0 2-1.6 3.5-3.5 3.5h-3C30.6 51.5 29 50 29 48V36Z" fill="var(--color-accent)" />
          <circle cx="34" cy="24" r="7.5" />
          <circle cx="36.4" cy="23" r="1.3" fill="var(--color-surface)" />
          <path d="M37 38c6 1 11-1 14-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M30 51.5c0 4-1.2 7-2 8.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M37 51.5c.4 4 1.6 7 2.4 8.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Right person */}
        <g fill="currentColor">
          <ellipse cx="166" cy="58" rx="10" ry="2.2" opacity="0.1" />
          <path d="M161 36c0-1.5 1.2-3 3-4h4c1.8 1 3 2.5 3 4v12c0 2-1.6 3.5-3.5 3.5h-3c-1.9 0-3.5-1.5-3.5-3.5V36Z" />
          <circle cx="166" cy="24" r="7.5" />
          <circle cx="163.6" cy="23" r="1.3" fill="var(--color-surface)" />
          <path d="M163 38c-6 1-11-1-14-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M170 51.5c0 4 1.2 7 2 8.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="M163 51.5c-.4 4-1.6 7-2.4 8.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* Smoke L → R */}
        <g fill="var(--color-accent)">
          <circle r="2.4">
            <animateMotion dur="2.8s" repeatCount="indefinite" path="M52 28 C 84 16, 116 16, 148 28" />
            <animate attributeName="opacity" values="0;0.95;0.7;0" dur="2.8s" repeatCount="indefinite" />
            <animate attributeName="r" values="1.2;2.6;3.4" dur="2.8s" repeatCount="indefinite" />
          </circle>
          <circle r="2">
            <animateMotion dur="2.8s" begin="0.7s" repeatCount="indefinite" path="M52 30 C 86 20, 118 18, 148 30" />
            <animate attributeName="opacity" values="0;0.85;0.5;0" dur="2.8s" begin="0.7s" repeatCount="indefinite" />
            <animate attributeName="r" values="1;2.2;3.1" dur="2.8s" begin="0.7s" repeatCount="indefinite" />
          </circle>
          <circle r="1.6">
            <animateMotion dur="2.8s" begin="1.4s" repeatCount="indefinite" path="M52 26 C 88 14, 120 18, 148 26" />
            <animate attributeName="opacity" values="0;0.8;0.4;0" dur="2.8s" begin="1.4s" repeatCount="indefinite" />
            <animate attributeName="r" values="0.8;2;2.8" dur="2.8s" begin="1.4s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Smoke R → L */}
        <g fill="var(--color-accent)">
          <circle r="2.2">
            <animateMotion dur="2.8s" begin="1.5s" repeatCount="indefinite" path="M148 32 C 116 22, 84 22, 52 32" />
            <animate attributeName="opacity" values="0;0.9;0.5;0" dur="2.8s" begin="1.5s" repeatCount="indefinite" />
            <animate attributeName="r" values="1.1;2.4;3.2" dur="2.8s" begin="1.5s" repeatCount="indefinite" />
          </circle>
        </g>
      </svg>
    </div>
  );
}
