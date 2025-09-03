/**
 * @fileoverview Safe marshalling of JavaScript values to AppleScript literals.
 *
 * This module provides functions to safely convert JavaScript values into
 * AppleScript literal representations, preventing injection attacks and
 * ensuring correct type conversions.
 *
 * Security principle: All user input is treated as data, never as code.
 * We generate AppleScript literals that are assigned to variables in the
 * script prologue, then reference those variables by name in the script body.
 */
import { MAX_SIZES } from "./constants.js";

/**
 * Parameter hint for special handling of certain parameter types.
 *
 * @remarks
 * Hints are provided per input key via `options.hints`. They affect marshalling only and
 * do not change validation. Typical usage is to mark a field as JavaScript code with
 * a custom size limit.
 *
 * @example
 * ```ts
 * const hints = { code: { js: { maxLenKb: 256 } } };
 * // input: { code: string }
 * ```
 *
 * @public
 */
export interface ParamHint {
  /**
   * Indicates this parameter contains JavaScript code
   */
  js?: {
    // Optional override for maximum KB
    maxLenKb?: number;
  };
}

/**
 * Marshalled parameter ready for AppleScript.
 *
 * @remarks
 * The library assigns a unique `varName` (e.g. `__ARG__url`) and a safe AppleScript literal
 * string for the value. Large strings and arrays are limited; see {@link MAX_SIZES}.
 *
 * @public
 */
export interface MarshalledParam {
  /**
   * Variable name in AppleScript (e.g., "__ARG__url")
   */
  varName: string;

  /**
   * AppleScript literal value (e.g., '"https://example.com"')
   */
  literal: string;

  /**
   * Original parameter name
   */
  paramName: string;
}

/**
 * Escapes a string for safe use as an AppleScript string literal.
 *
 * AppleScript uses double quotes for strings and backslash for escaping.
 * The tricky part is handling quotes within strings - we use the technique
 * of breaking the string and concatenating with 'quote'.
 *
 * @example
 * asStringLiteral('Hello "World"')
 * // Returns: '"Hello " & quote & "World" & quote & ""'
 *
 * @public
 */
export function asStringLiteral(str: string): string {
  // Empty string
  if (!str) return '""';

  // Check size limit
  const sizeKb = Buffer.byteLength(str, "utf8") / 1024;
  if (sizeKb > MAX_SIZES.STRING_ARG_KB) {
    throw new Error(
      `String argument exceeds maximum size of ${MAX_SIZES.STRING_ARG_KB}KB`,
    );
  }

  // If no quotes, simple case
  if (!str.includes('"')) {
    // Escape backslashes
    const escaped = str.replace(/\\/g, "\\\\");
    return `"${escaped}"`;
  }

  // Break at quotes and join with ' & quote & '
  const parts = str.split('"').map((part) => part.replace(/\\/g, "\\\\"));
  // Example: "Hello " & quote & "World" & quote & ""
  return parts.map((p) => `"${p}"`).join(" & quote & ");
}

/**
 * Converts a JavaScript array to an AppleScript list literal.
 * Supports arrays of strings, numbers, and booleans.
 *
 * @example
 * asListLiteral(['a', 'b', 'c']) // Returns: '{"a", "b", "c"}'
 * asListLiteral([1, 2, 3])        // Returns: '{1, 2, 3}'
 *
 * @public
 */
export function asListLiteral(arr: unknown[]): string {
  if (!Array.isArray(arr)) throw new Error("Expected an array");
  if (arr.length > MAX_SIZES.ARRAY_ITEMS) {
    throw new Error(`Array exceeds maximum length of ${MAX_SIZES.ARRAY_ITEMS}`);
  }
  const items = arr.map((v) => {
    if (typeof v === "string") return asStringLiteral(v);
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    throw new Error("Unsupported array item type");
  });
  return `{${items.join(", ")}}`;
}

/**
 * Validates JavaScript code parameter.
 * Ensures it's a string and within size limits.
 *
 * @public
 */
export function validateJsCode(
  code: string,
  maxKb: number = MAX_SIZES.JS_CODE_KB,
): string {
  if (typeof code !== "string")
    throw new Error("JavaScript code must be a string");
  const sizeKb = Buffer.byteLength(code, "utf8") / 1024;
  if (sizeKb > maxKb)
    throw new Error(`JavaScript code exceeds maximum size of ${maxKb}KB`);
  return code;
}

/**
 * Marshals a single parameter value to AppleScript literal.
 *
 * @param paramName - Name of the parameter
 * @param value - JavaScript value to marshal
 * @param hint - Optional hint for special handling
 * @returns Marshalled parameter with variable name and literal
 *
 * @public
 */
export function marshalParam(
  paramName: string,
  value: unknown,
  hint?: ParamHint,
): MarshalledParam {
  const varName = `__ARG__${paramName}`;

  if (hint?.js) {
    const code = validateJsCode(
      String(value ?? ""),
      hint.js.maxLenKb ?? MAX_SIZES.JS_CODE_KB,
    );
    return { varName, literal: asStringLiteral(code), paramName };
  }

  switch (typeof value) {
    case "string":
      return { varName, literal: asStringLiteral(value), paramName };
    case "number":
      if (!Number.isFinite(value))
        throw new Error("Non-finite number is not supported");
      return { varName, literal: String(value), paramName };
    case "boolean":
      return { varName, literal: value ? "true" : "false", paramName };
    case "object": {
      if (value === null)
        return { varName, literal: "missing value", paramName };
      if (Array.isArray(value))
        return { varName, literal: asListLiteral(value), paramName };
      // For objects, stringify to JSON and escape for AppleScript
      const jsonStr = JSON.stringify(value);
      const escaped = jsonStr.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return {
        varName,
        literal: `"${escaped}"`,
        paramName,
      };
    }
    case "undefined":
      return { varName, literal: "missing value", paramName };
    default:
      throw new Error(`Unsupported parameter type for ${paramName}`);
  }
}

/**
 * Marshals multiple parameters for use in AppleScript.
 *
 * @param params - Object with parameter values
 * @param hints - Optional hints for special parameter handling
 * @returns Array of marshalled parameters
 *
 * @public
 */
export function marshalParams(
  params: Record<string, unknown>,
  hints: Record<string, ParamHint> = {},
): MarshalledParam[] {
  return Object.keys(params).map((key) =>
    marshalParam(key, (params as any)[key], hints[key]),
  );
}

/**
 * Generates AppleScript variable declarations from marshalled parameters.
 * These declarations go in the script prologue.
 *
 * @public
 */
export function generatePrologue(params: MarshalledParam[]): string {
  if (!params.length) return "";
  return params.map((p) => `set ${p.varName} to ${p.literal}`).join("\n");
}
