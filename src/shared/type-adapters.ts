/**
 * @fileoverview Type-safe adapters that encapsulate necessary unsafe type assertions.
 * @internal
 */
import { z } from "zod";

export function safeParseWithSchema<T extends z.ZodType>(
  schema: T,
  data: unknown,
): ReturnType<z.ZodSchema["safeParse"]> {
  return (schema as z.ZodSchema).safeParse(data);
}

export function extractZodIssues(parseResult: {
  success: false;
  error?: unknown;
}): z.ZodIssue[] {
  const error = parseResult.error;
  if (error && typeof error === "object" && "issues" in error) {
    const issues = (error as { issues?: unknown }).issues;
    if (Array.isArray(issues)) return issues as z.ZodIssue[];
  }
  return [];
}

export function getObjectProperty<T = unknown>(
  obj: Record<string, unknown>,
  key: string,
): T {
  return obj[key] as T;
}

export function createParamMap<T extends Record<string, unknown>>(
  params: unknown,
): T {
  if (!params || typeof params !== "object") return {} as T;
  return params as T;
}

export function getArrayElement<T>(
  arr: unknown[],
  index: number,
  defaultValue?: T,
): T | undefined {
  if (index >= 0 && index < arr.length) return arr[index] as T;
  return defaultValue;
}

export function hasProperty<K extends string | number | symbol>(
  obj: unknown,
  key: K,
): obj is Record<K, unknown> {
  return (
    obj !== null && obj !== undefined && typeof obj === "object" && key in obj
  );
}

export function extractErrorCode(error: unknown): number | undefined {
  if (hasProperty(error, "code")) {
    const code = (error as any).code;
    if (typeof code === "number") return code;
  }
  if (
    hasProperty(error, "cause") &&
    hasProperty((error as any).cause, "code")
  ) {
    const code = (error as any).cause.code;
    if (typeof code === "number") return code;
  }
  return undefined;
}

export interface NormalizableOperation {
  normalizeRows?: boolean;
  output: unknown;
}
export function hasNormalizeRows(def: unknown): def is NormalizableOperation {
  return hasProperty(def, "normalizeRows") || hasProperty(def, "output");
}
export function getNormalizeRowsSetting(
  def: unknown,
  defaultValue: boolean,
): boolean {
  if (hasProperty(def, "normalizeRows"))
    return Boolean((def as any).normalizeRows);
  return defaultValue;
}

export function safeArraySlice<T>(
  arr: unknown,
  start: number,
  end?: number,
): T[] {
  if (Array.isArray(arr)) return (arr as unknown[]).slice(start, end) as T[];
  return [];
}
