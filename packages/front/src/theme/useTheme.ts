import { useState, useEffect, useCallback } from "react";
import {
  getThemeChoice,
  setThemeChoice,
  applyTheme,
  type ThemeChoice,
} from "./theme-store.ts";

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(getThemeChoice);
  const [isDark, setIsDark] = useState(
    () => document.documentElement.classList.contains("dark"),
  );

  const updateChoice = useCallback((next: ThemeChoice) => {
    setThemeChoice(next);
    setChoice(next);
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    if (choice !== "system") return;

    const mql = matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      applyTheme("system");
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [choice]);

  return { choice, setChoice: updateChoice, isDark };
}
