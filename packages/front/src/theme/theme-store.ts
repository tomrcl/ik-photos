export type ThemeChoice = "system" | "light" | "dark";
const KEY = "ik_theme";

export function getThemeChoice(): ThemeChoice {
  return (localStorage.getItem(KEY) as ThemeChoice) || "system";
}

export function setThemeChoice(choice: ThemeChoice): void {
  localStorage.setItem(KEY, choice);
  applyTheme(choice);
}

export function applyTheme(choice: ThemeChoice): void {
  const isDark =
    choice === "dark" ||
    (choice === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}
