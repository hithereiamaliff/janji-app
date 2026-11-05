export type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
};

// Muted text and accent colours keep at least 4.5:1 contrast on both background and surface (WCAG AA).
export const lightColors: ThemeColors = {
  background: "#F7F7F8",
  surface: "#FFFFFF",
  text: "#111827",
  textMuted: "#4B5563",
  border: "#E5E7EB",
  accent: "#1D4ED8",
};

export const darkColors: ThemeColors = {
  background: "#0B0B0F",
  surface: "#16161D",
  text: "#F3F4F6",
  textMuted: "#9CA3AF",
  border: "#2A2A33",
  accent: "#60A5FA",
};
