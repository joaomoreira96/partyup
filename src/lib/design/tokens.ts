/**
 * PartyUp Design System — Documento 04
 * Referência para uso em TS/JS (cores em CSS via globals.css)
 */
export const colors = {
  background: "#0F172A",
  surface: "#1E293B",
  surfaceHover: "#334155",
  primary: "#3B82F6",
  secondary: "#8B5CF6",
  accent: "#F59E0B",
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
} as const;

export const radius = {
  default: "12px",
  premium: "16px",
} as const;

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64] as const;

export const typography = {
  fontFamily: "Inter, system-ui, sans-serif",
} as const;
