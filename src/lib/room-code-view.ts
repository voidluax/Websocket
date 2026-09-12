/** Client-safe code helpers (no node imports) */

/** Normalise whatever the user typed ("k7q2-9x4m", "K7Q2 9X4M") to canonical form */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** K7Q2X9 -> K7Q2-X9 — prettier for display/copy */
export function formatCode(code: string): string {
  const c = normalizeCode(code).slice(0, 12);
  if (c.length <= 3) return c;
  const mid = Math.ceil(c.length / 2);
  return `${c.slice(0, mid)}-${c.slice(mid)}`;
}
