export type ThemeColors = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  /** Dividers and card outlines; decorative, so no contrast minimum. */
  border: string;
  /** Text field outlines, which must stay visible: at least 3:1 against the surface (WCAG 1.4.11). */
  inputBorder: string;
  accent: string;
  /** Text and icons on an accent-coloured background. */
  onAccent: string;
  danger: string;
};

// Text colours (textMuted, accent, onAccent on accent, danger) keep at least 4.5:1 contrast (WCAG AA).
export const lightColors: ThemeColors = {
  background: "#F7F7F8",
  surface: "#FFFFFF",
  text: "#111827",
  textMuted: "#4B5563",
  border: "#E5E7EB",
  inputBorder: "#6B7280",
  accent: "#1D4ED8",
  onAccent: "#FFFFFF",
  danger: "#B91C1C",
};

export const darkColors: ThemeColors = {
  background: "#0B0B0F",
  surface: "#16161D",
  text: "#F3F4F6",
  textMuted: "#9CA3AF",
  border: "#2A2A33",
  inputBorder: "#6B7280",
  accent: "#60A5FA",
  onAccent: "#0B0B0F",
  danger: "#F87171",
};
