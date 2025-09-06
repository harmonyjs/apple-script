/**
 * @fileoverview Builds value normalizers from Zod schemas.
 * @internal
 */
import {
  coerceToBoolean,
  coerceToNumber,
  parseAppleScriptList,
} from "./coercion.js";
import { ZodSchemaAdapter } from "./schema-adapter.js";
import { createDebug, describeSchema } from "../engine/debug.js";

const debug = createDebug("normalization:normalizer");

export type Normalizer = (value: unknown) => unknown;

/** Safe get for array element. */
function getArrayElement<T>(arr: unknown, index: number): T | undefined {
  if (!Array.isArray(arr)) return undefined;
  if (index < 0 || index >= arr.length) return undefined;
  return arr[index] as T;
}

/** Safe slice with bounds check. */
function safeArraySlice<T>(arr: unknown, start = 0, end?: number): T[] {
  if (!Array.isArray(arr)) return [];
  const s = Math.max(0, start | 0);
  const e = end === undefined ? arr.length : Math.max(s, end | 0);
  return arr.slice(s, e) as T[];
}

export function buildNormalizer(schema: any): Normalizer {
  const s = ZodSchemaAdapter.from(schema).unwrap().raw;
  const a = ZodSchemaAdapter.from(s);
  const typeName = a.typeName;
  const ctor = a.ctorName;
  debug("build", { typeName, ctor, schema: describeSchema(s) });

  const isString = a.isType("ZodString");
  const isNumber = a.isType("ZodNumber");
  const isBoolean = a.isType("ZodBoolean");
  const isArray = a.isType("ZodArray");
  const isTuple = a.isType("ZodTuple");

  if (isString)
    return (v) => {
      debug("string passthrough", v);
      return v;
    };
  if (isNumber)
    return (v) => {
      const r = coerceToNumber(v);
      debug("number", v, "->", r);
      return r;
    };
  if (isBoolean)
    return (v) => {
      const r = coerceToBoolean(v);
      debug("boolean", v, "->", r);
      return r;
    };

  if (isArray) {
    const el = ZodSchemaAdapter.from(s).getArrayElement();
    const elNorm = buildNormalizer(el);
    return (v) => {
      if (Array.isArray(v)) {
        const r = v.map((x) => elNorm(x));
        debug(
          "array from array",
          safeArraySlice<unknown>(v, 0, 5),
          "->",
          safeArraySlice<unknown>(r, 0, 5),
        );
        return r;
      }
      if (typeof v === "string") {
        const toks = parseAppleScriptList(v);
        const r = toks.map((x) => elNorm(x));
        debug("array from string", v, "->", safeArraySlice<unknown>(r, 0, 5));
        return r;
      }
      debug("array passthrough", v);
      return v;
    };
  }

  if (isTuple) {
    const parts: any[] = ZodSchemaAdapter.from(s).getTupleItems();
    const itemNorms = parts.map((p) => buildNormalizer(p));
    return (v) => {
      if (Array.isArray(v)) {
        const r = itemNorms.map((n, i) => n(getArrayElement(v, i)));
        debug("tuple from array", v, "->", r);
        return r;
      }
      if (typeof v === "string") {
        const toks = parseAppleScriptList(v);
        const r = itemNorms.map((n, i) => n(toks[i]));
        debug("tuple from string", v, "->", r);
        return r;
      }
      debug("tuple passthrough", v);
      return v;
    };
  }

  const shape = ZodSchemaAdapter.from(s).getObjectShape();
  if (shape) {
    const norms: Record<string, Normalizer> = {};
    for (const key of Object.keys(shape)) {
      norms[key] = buildNormalizer((shape as any)[key]);
    }
    return (v) => {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const obj = v as Record<string, unknown>;
        const out: Record<string, unknown> = { ...obj };
        for (const key of Object.keys(norms)) {
          if (key in obj) {
            const norm = norms[key];
            const before = obj[key];
            const after = typeof norm === "function" ? norm(before) : before;
            out[key] = after;
            debug("object field", key, before, "->", after);
          }
        }
        debug("object result", out);
        return out;
      }
      debug("object passthrough", v);
      return v;
    };
  }

  return (v) => v;
}
