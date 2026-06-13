import { useColorScheme } from "react-native";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

// ─── Color Tokens (matching web tailwind.css) ───────────────────────────────

const darkColors = {
  surface: "#000000",
  surfaceRaised: "#141414",
  surfaceHover: "#1E1E1E",
  text: "#FFFFFF",
  textMuted: "#9E9E9E",
  accent: "#FFFC00",
  accentSoft: "#FFF176",
  success: "#4ADE80",
  border: "#2A2A2A",
  card: "#141414",
  danger: "#EF4444",
  transparent: "transparent",
} as const;

const lightColors = {
  surface: "#FFFFFF",
  surfaceRaised: "#F5F5F5",
  surfaceHover: "#EEEEEE",
  text: "#1A1A1A",
  textMuted: "#666666",
  accent: "#FFD600",
  accentSoft: "#FFF9C4",
  success: "#22C55E",
  border: "#E5E5E5",
  card: "#FFFFFF",
  danger: "#EF4444",
  transparent: "transparent",
} as const;

export type ThemeColors = typeof darkColors | typeof lightColors;
export type ColorName = keyof typeof darkColors;

// ─── Spacing / Radius / Typography ──────────────────────────────────────────

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
} as const;

// ─── Theme Context ──────────────────────────────────────────────────────────

type ThemeMode = "dark" | "light" | "system";

interface ThemeContextValue {
  colors: ThemeColors;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  mode: "system",
  isDark: true,
  setMode: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>("system");

  const isDark =
    mode === "system" ? systemScheme !== "light" : mode === "dark";
  const colors = isDark ? darkColors : lightColors;

  const toggle = useCallback(() => {
    setMode((prev) => {
      if (prev === "system") return isDark ? "light" : "dark";
      return prev === "dark" ? "light" : "dark";
    });
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ colors, mode, isDark, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
