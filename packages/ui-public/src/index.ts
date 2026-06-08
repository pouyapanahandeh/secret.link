/**
 * Public brand design tokens.
 * Palette: midnight, candle, blush, mint-signal.
 * Typography: Caveat (moments), Inter (chrome).
 * Motion: warm, organic — paper-fold, candle-flicker.
 */
export const publicTokens = {
  colors: {
    midnight: "#0E0B1A",
    candle: "#F7E7C5",
    blush: "#FF6F91",
    mintSignal: "#7CE7C5",
  },
  fonts: {
    chrome: "Inter, system-ui, sans-serif",
    moments: "Caveat, cursive",
  },
  motion: {
    revealHold: "1500ms",
    fadeIn: "300ms",
    easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;
