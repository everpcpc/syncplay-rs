export type ThemePreference = "dark" | "light";
export type TransparencyPreference = "off" | "low" | "high";

export const normalizeTheme = (value?: string): ThemePreference =>
  value === "light" ? "light" : "dark";

export const applyTheme = (value?: string) => {
  const theme = normalizeTheme(value);
  const root = document.documentElement;
  root.classList.toggle("theme-light", theme === "light");
  root.classList.toggle("theme-dark", theme !== "light");
};

export const normalizeTransparency = (value?: string): TransparencyPreference => {
  if (value === "high") return "high";
  if (value === "low") return "low";
  return "off";
};

export const applyTransparency = (value?: string) => {
  const root = document.documentElement;
  const mode = normalizeTransparency(value);
  root.classList.remove("reduced-transparency");
  root.classList.toggle("transparency-off", mode === "off");
  root.classList.toggle("transparency-low", mode === "low");
  root.classList.toggle("transparency-high", mode === "high");
};

export const getAppliedTheme = (): ThemePreference => {
  const root = document.documentElement;
  return root.classList.contains("theme-light") ? "light" : "dark";
};

export const getAppliedTransparency = (): TransparencyPreference => {
  const root = document.documentElement;
  if (root.classList.contains("transparency-high")) return "high";
  if (root.classList.contains("transparency-low")) return "low";
  return "off";
};
