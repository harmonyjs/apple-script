/**
 * @fileoverview Minimal Zod schema introspection utilities.
 * WARNING: Uses Zod internals; keep surface small and well-tested.
 * @internal
 */
import { createDebug, describeSchema } from "../engine/debug.js";
const debug = createDebug("normalization:zod-introspection");

const MAX_UNWRAP_DEPTH = 8;

export function getZodTypeName(schema: any): string | undefined {
  return schema?._def?.typeName;
}

/** Unwrap common Zod wrappers to reach the inner schema (Optional/Nullable/Default/Effects). */
export function unwrapZodSchema(schema: any): any {
  let s = schema;
  for (let i = 0; i < MAX_UNWRAP_DEPTH; i++) {
    const t = getZodTypeName(s);
    const ctor = s?.constructor?.name;
    const defType = s?._def?.type;
    debug("unwrap step", i, { t, ctor, defType }, describeSchema(s));
    if (
      t === "ZodOptional" ||
      t === "ZodNullable" ||
      t === "ZodDefault" ||
      t === "ZodCatch" ||
      ctor === "ZodOptional" ||
      ctor === "ZodNullable" ||
      ctor === "ZodDefault" ||
      ctor === "ZodCatch" ||
      defType === "optional" ||
      defType === "nullable" ||
      defType === "default" ||
      defType === "catch"
    ) {
      s = s?._def?.innerType ?? s;
      continue;
    }
    if (
      t === "ZodEffects" ||
      ctor === "ZodEffects" ||
      ctor === "ZodTransform" ||
      defType === "transform"
    ) {
      s = s?._def?.schema ?? s;
      continue;
    }
    if (
      t === "ZodPipeline" ||
      t === "ZodPipe" ||
      ctor === "ZodPipeline" ||
      ctor === "ZodPipe" ||
      defType === "pipe"
    ) {
      const left =
        s?._def?.left ?? (s?._def?.type === "pipe" ? s?._def?.in : undefined);
      debug("unwrap pipe", {
        hasLeft: Boolean(s?._def?.left),
        hasIn: Boolean(s?._def?.type === "pipe" && s?._def?.in),
        hasOut: Boolean(s?._def?.out),
        next: describeSchema(left),
      });
      s = left ?? s;
      continue;
    }
    if (
      t === "ZodBranded" ||
      t === "ZodReadonly" ||
      ctor === "ZodBranded" ||
      ctor === "ZodReadonly" ||
      defType === "branded" ||
      defType === "readonly"
    ) {
      s = s?._def?.type ?? s;
      continue;
    }
    break;
  }
  debug("unwrap final", describeSchema(s));
  return s;
}

/** Try to extract object shape map from a Zod object schema. */
export function extractObjectShape(
  schema: any,
): Record<string, any> | undefined {
  const s = unwrapZodSchema(schema);
  try {
    const candidates: any[] = [];
    if (s?._def) {
      if (typeof s._def.shape === "function") {
        try {
          const val = s._def.shape();
          candidates.push(val);
        } catch {}
      } else if (s._def.shape && typeof s._def.shape === "object") {
        candidates.push(s._def.shape);
      }
    }
    if (typeof s?.shape === "function") {
      try {
        const val = s.shape();
        candidates.push(val);
      } catch {}
    } else if (s?.shape && typeof s.shape === "object") {
      candidates.push(s.shape);
    }
    for (const sh of candidates) {
      if (sh && typeof sh === "object") return sh as Record<string, any>;
    }
  } catch {}
  return undefined;
}

/** Extract array element schema from a Zod array schema. */
export function getArrayElementSchema(schema: any): any {
  const s = unwrapZodSchema(schema);
  const el = s?.element ?? s?._def?.type;
  return el;
}

/** Extract tuple item schemas from a Zod tuple schema. */
export function getTupleItemSchemas(schema: any): any[] {
  const s = unwrapZodSchema(schema);
  const items = s?.items ?? s?._def?.items ?? s?._def?.schemas ?? [];
  return items;
}
