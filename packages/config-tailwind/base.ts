import type { Config } from "tailwindcss";

const baseConfig: Config = {
  content: [],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      spacing: {
        "grid-unit": "8px",
      },
      transitionDuration: {
        fast: "120ms",
        normal: "200ms",
      },
      transitionTimingFunction: {
        default: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      },
    },
  },
};

export default baseConfig;
