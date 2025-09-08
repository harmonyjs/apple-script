/**
 * AppleScript-oriented Zod helper schemas.
 * This is the single source of truth for schema helpers.
 */
import { z } from "zod";
import { parseAppleScriptList } from "../engine/value-parsers.js";
import { unwrapZodSchema } from "./zod-introspection.js";

/**
 * Accepts boolean values and common AppleScript string/number representations.
 * Examples: "true" | "false" | "1" | "0" | 1 | 0.
 * @public
 */
export const asBoolean = z.union([
  z.boolean(),
  z.string().transform((v) => {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0") return false;
    throw new Error(`Cannot parse "${v}" as boolean`);
  }),
  z.number().transform((v) => v !== 0),
]);

/**
 * Accepts numbers or numeric strings (AppleScript often returns numbers as text).
 * @public
 */
export const asNumber = z.union([
  z.number(),
  z.string().transform((v) => {
    const s = v.trim();
    const n = Number(s);
    if (Number.isFinite(n)) return n;
    throw new Error(`Cannot parse "${v}" as number`);
  }),
]);

/**
 * Accepts arrays or AppleScript list/CSV strings and parses each item with the provided item schema.
 * @public
 */
export function asArray<T extends z.ZodTypeAny>(
  itemSchema: T,
): z.ZodType<z.infer<T>[]> {
  return z.union([
    z.array(itemSchema),
    z
      .string()
      .transform((v) =>
        parseAppleScriptList(v).map((p) => itemSchema.parse(p)),
      ),
  ]);
}

/**
 * Accepts a fixed-length tuple or an AppleScript list string of that length; each item is parsed with the corresponding schema.
 * @public
 */
export function asTuple<T extends [z.ZodTypeAny, ...z.ZodTypeAny[]]>(
  items: T,
): z.ZodType<{ [K in keyof T]: z.infer<T[K]> }> {
  type TupleType = { [K in keyof T]: z.infer<T[K]> };
  return z.union([
    z.tuple(items) as unknown as z.ZodType<TupleType>,
    z.string().transform((v) => {
      const parts = parseAppleScriptList(v);
      if (parts.length !== items.length)
        throw new Error(`Expected ${items.length} items, got ${parts.length}`);
      return items.map((schema, i) => schema.parse(parts[i])) as TupleType;
    }),
  ]);
}

/**
 * Shorthand tuple for common window bounds: [x, y, width, height].
 * @public
 */
export const asBounds = asTuple([
  asNumber,
  asNumber,
  asNumber,
  asNumber,
]).describe("Window bounds as [x, y, width, height]");

/**
 * Wraps a Zod object shape, replacing number/boolean fields with AppleScript-aware coercers.
 * Other field types are kept as-is.
 * 
 * Returns a strict object by default - unknown keys will cause validation to fail.
 * This is intentional for AppleScript contexts where extra keys typically indicate bugs.
 * 
 * If you need to allow unknown keys, you can explicitly call `.strip()` or `.passthrough()` 
 * on the returned schema:
 * ```ts
 * const schema = asRecord({ ... }).strip(); // removes unknown keys
 * const schema = asRecord({ ... }).passthrough(); // keeps unknown keys
 * ```
 * 
 * @public
 */
export function asRecord<T extends z.ZodRawShape>(
  shape: T
): z.ZodObject<{
  [K in keyof T]: T[K] extends z.ZodNumber
    ? typeof asNumber
    : T[K] extends z.ZodBoolean
    ? typeof asBoolean
    : T[K];
}> {
  const newShape: Record<string, z.ZodTypeAny> = {};
  for (const [key, schema] of Object.entries(shape)) {
    const base = unwrapZodSchema(schema);
    const ctor = base?.constructor?.name;
    if (ctor === "ZodNumber") newShape[key] = asNumber;
    else if (ctor === "ZodBoolean") newShape[key] = asBoolean;
    else newShape[key] = schema as z.ZodTypeAny;
  }
  return z.object(newShape).strict() as z.ZodObject<{
    [K in keyof T]: T[K] extends z.ZodNumber
      ? typeof asNumber
      : T[K] extends z.ZodBoolean
      ? typeof asBoolean
      : T[K];
  }>;
}

/**
 * Namespaced access to helper schemas.
 * @public
 */
export const schemas: {
  readonly boolean: typeof asBoolean;
  readonly number: typeof asNumber;
  readonly array: typeof asArray;
  readonly tuple: typeof asTuple;
  readonly bounds: typeof asBounds;
  readonly record: typeof asRecord;
} = {
  boolean: asBoolean,
  number: asNumber,
  array: asArray,
  tuple: asTuple,
  bounds: asBounds,
  record: asRecord,
} as const;
