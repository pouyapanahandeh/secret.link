import type { Config } from "tailwindcss";
import baseConfig from "./base.ts";

const publicConfig: Config = {
  ...baseConfig,
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme?.extend,
      colors: {
        midnight: "#0E0B1A",
        candle: "#F7E7C5",
        blush: "#FF6F91",
        "mint-signal": "#7CE7C5",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Caveat", "cursive"],
      },
    },
  },
};

export default publicConfig;
