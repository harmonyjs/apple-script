/**
 * @fileoverview Centralized helpers for unavoidable unsafe operations and casts.
 *
 * Why this module: Some libraries (e.g., Zod) expose loosely-typed surfaces that
 * occasionally require assertions to interoperate in a strictly-typed codebase.
 * By concentrating such assertions here with minimal, well-documented helpers,
 * we keep the rest of the codebase free of scattered `as any` and simplify audits.
 */
import type { z } from "zod";

/**
 * Performs a focused, documented type assertion in one place.
 *
 * Why: Used where the compiler cannot infer a safe up/down-cast but runtime
 * invariants guarantee shape (e.g., building VariableMap<K> from marshalled params).
 * @internal
 */
export function unsafeCast<T>(value: unknown): T {
  return value as T;
}

/**
 * Narrow property existence check for unknown values.
 *
 * Why: Many error-like values are `unknown`. This guard prevents exceptions
 * from property access and enables safe refinement.
 * @internal
 */
export function hasProperty<K extends PropertyKey>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> {
  return (
    obj !== null && obj !== undefined && typeof obj === "object" && key in obj
  );
}

/**
 * Wraps Zod's safeParse for generics.
 *
 * Why: Zod types are structurally compatible but generics lose the precise
 * method typing. This adapter preserves type information.
 * @internal
 */
export function safeParseWithSchema<T extends z.ZodType>(
  schema: T,
  data: unknown,
): ReturnType<T["safeParse"]> {
  return schema.safeParse(data) as ReturnType<T["safeParse"]>;
}

/** Extracts Zod issues from an unknown error object (best-effort). @internal */
export function extractZodIssues(parseResult: {
  success: false;
  error?: unknown;
}): unknown[] {
  const error = parseResult.error;
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues?: unknown }).issues;
    if (Array.isArray(issues)) return issues;
  }
  return [];
}

/** Indexes into a record with a dynamic key. @internal */
export function getObjectProperty<T = unknown>(
  obj: Record<string, unknown>,
  key: string,
): T {
  return obj[key] as T;
}

/** Extracts numeric error code from nested error/cause chains if present. @internal */
export function extractErrorCode(error: unknown): number | undefined {
  if (hasProperty(error, "code")) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "number") return code;
  }
  if (
    hasProperty(error, "cause") &&
    hasProperty((error as { cause?: unknown }).cause, "code" as const)
  ) {
    const code = (error as { cause?: { code?: unknown } }).cause?.code;
    if (typeof code === "number") return code;
  }
  return undefined;
}

/** Minimal shape check for operations with optional normalizeRows flag. @internal */
export function getNormalizeRowsSetting(
  def: unknown,
  defaultValue: boolean,
): boolean {
  if (hasProperty(def, "normalizeRows"))
    return Boolean((def as { normalizeRows?: unknown }).normalizeRows);
  return defaultValue;
}

/**
 * Builds a map from param name to AppleScript variable name.
 *
 * Why: ScriptFunction expects a VariableMap<K> (string values) which we assemble
 * at runtime from marshalled params.
 * @internal
 */
export function buildVarsMap(
  params: Array<{ paramName: string; varName: string }>,
): Record<string, string> {
  return Object.fromEntries(params.map((p) => [p.paramName, p.varName]));
}
