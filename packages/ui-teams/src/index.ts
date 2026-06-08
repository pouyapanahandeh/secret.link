/**
 * Teams brand design tokens.
 * Palette: ink, porcelain, trust-blue, warm-accent.
 * Typography: Inter (UI), Source Serif 4 (human moments).
 * Motion: 120–200ms ease-out, never bouncy.
 */
export const teamsTokens = {
  colors: {
    ink: "#0B1020",
    porcelain: "#F7F8FB",
    trustBlue: "#3E5BFA",
    warmAccent: "#FF8A65",
  },
  fonts: {
    ui: "Inter, system-ui, sans-serif",
    human: "'Source Serif 4', Georgia, serif",
  },
  motion: {
    fast: "120ms",
    normal: "200ms",
    easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
  },
  spacing: {
    unit: 8,
  },
} as const;
