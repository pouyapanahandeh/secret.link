import type { Config } from "tailwindcss";
import baseConfig from "./base.ts";

const teamsConfig: Config = {
  ...baseConfig,
  theme: {
    ...baseConfig.theme,
    extend: {
      ...baseConfig.theme?.extend,
      colors: {
        ink: "#0B1020",
        porcelain: "#F7F8FB",
        "trust-blue": "#3E5BFA",
        "warm-accent": "#FF8A65",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Source Serif 4", "Georgia", "serif"],
      },
    },
  },
};

export default teamsConfig;
