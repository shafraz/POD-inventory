/**
 * Categorical chart palette (validated for colour-vision deficiency, light surface).
 * Assigned to asset types in their configured order — never cycled or re-ranked,
 * so a type keeps its colour when filters change.
 */
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

/** Theme-aware series colour (CSS variable with light/dark steps defined in globals.css). */
export function seriesColor(index: number) {
  return index < SERIES.length ? `var(--series-${index + 1})` : "var(--color-slate-400)"; // beyond 8 → neutral "other"
}

/** Status-style colours for verification states (paired with labels + icons). */
export const STATE_HEX = { VERIFIED: "#10b981", DUE_SOON: "#f59e0b", OVERDUE: "#ef4444" } as const;
