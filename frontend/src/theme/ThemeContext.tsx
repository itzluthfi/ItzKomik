import React from "react";
import { useColorScheme } from "react-native";
import { getThemeMode, setThemeMode, type ThemeMode } from "../store/theme";

type ThemeCtx = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => Promise<void>;
  toggle: () => Promise<void>;
};

const ThemeContext = React.createContext<ThemeCtx | null>(null);

export function useAppTheme(): ThemeCtx {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
  return ctx;
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme() ?? "light";
  const [mode, setModeState] = React.useState<ThemeMode>("system");

  React.useEffect(() => {
    void (async () => {
      const m = await getThemeMode();
      setModeState(m);
    })();
  }, []);

  const resolved: "light" | "dark" = mode === "system" ? system : mode;

  const setMode = React.useCallback(async (m: ThemeMode) => {
    setModeState(m);
    await setThemeMode(m);
  }, []);

  const toggle = React.useCallback(async () => {
    const next: ThemeMode = resolved === "dark" ? "light" : "dark";
    await setMode(next);
  }, [resolved, setMode]);

  const value = React.useMemo<ThemeCtx>(
    () => ({ mode, resolved, setMode, toggle }),
    [mode, resolved, setMode, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
