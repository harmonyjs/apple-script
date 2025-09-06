/**
 * @fileoverview AppleScript list and primitive coercion helpers.
 * @internal
 */

export function coerceToNumber(value: unknown): unknown {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return value;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return value;
}

export function coerceToBoolean(value: unknown): unknown {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
  }
  return value;
}

export function parseAppleScriptList(input: string): string[] {
  let s = input.trim();
  if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
    s = s.slice(1, -1);
  }
  return s
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .map((v) => {
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        return v.slice(1, -1);
      }
      return v;
    });
}
