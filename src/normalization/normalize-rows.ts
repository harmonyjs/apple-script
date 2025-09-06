/**
 * @fileoverview Schema-guided normalization for rows output.
 *
 * Best-effort coercion of stringly-typed AppleScript rows into the
 * shapes expected by the Zod output schema element (numbers/booleans/arrays/tuples/objects).
 *
 * Pure functions only. No side effects.
 */
import { buildNormalizer } from "./normalizer-builder.js";
import { createDebug, describeSchema } from "../engine/debug.js";
import { ZodSchemaAdapter } from "./schema-adapter.js";

const debug = createDebug("normalization:normalize-rows");

/**
 * Safe array slice that returns [] on invalid input and clamps bounds.
 */
function safeArraySlice<T>(arr: unknown, start = 0, end?: number): T[] {
  if (!Array.isArray(arr)) return [];
  const s = Math.max(0, start | 0);
  const e = end === undefined ? arr.length : Math.max(s, end | 0);
  return arr.slice(s, e) as T[];
}

/**
 * Normalize mapped rows (arrays or objects) according to the Zod output element schema.
 * Safe by default: only coerces when target type is clearly number/boolean/array/tuple/object.
 */
export function normalizeRowsToSchema(def: { output: unknown }, rows: unknown[]): unknown[] {
  try {
    const outSchema = (def as any).output as unknown;
    // Extract array element schema via adapter
    const el = ZodSchemaAdapter.from(outSchema).getArrayElement();
    debug("element schema", describeSchema(el));
    if (!el) return rows; // cannot introspect
    const normalizer = buildNormalizer(el);
    const res = rows.map((row) => normalizer(row));
    debug("normalized sample", safeArraySlice<unknown>(res, 0, 3));
    return res;
  } catch {
    return rows;
  }
}
