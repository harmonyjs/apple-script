/**
 * @fileoverview Type definitions for AppleScript operations.
 *
 * This module defines the structure of operations - declarative
 * descriptions of AppleScript tasks with input/output validation.
 */
import { z } from "zod";
import type { PayloadKind } from "../core/constants.js";
import type { ParamHint } from "../core/marshaller.js";

/**
 * Script function that generates the AppleScript body.
 *
 * @remarks
 * The function receives a map of variable names, one per input key. Use these names inside
 * your AppleScript body. The builder injects literal values into variables in the prologue
 * and replaces `${key}` placeholders with the corresponding variable names.
 *
 * @example
 * ```ts
 * // Input schema: z.object({ url: z.string().url() })
 * const script: ScriptFunction<{ url: string }> = ({ url }) => `
 *   -- ${'${'}url} is something like __ARG__url
 *   tell application id "com.apple.Safari"
 *     set URL of front document to ${'${'}url}
 *     return "1" -- success
 *   end tell
 * `
 * ```
 *
 * @public
 */
export type ScriptFunction<TInput> = (vars: VariableMap<TInput>) => string;

/**
 * Maps input schema keys to AppleScript variable names.
 *
 * @remarks
 * Only strings, numbers, booleans, arrays and JSON-serializable objects are supported.
 * Strings and arrays have size limits; see {@link MAX_SIZES}.
 *
 * @public
 */
export type VariableMap<T> = {
  [K in keyof T]: string;
};

/**
 * Base definition for all operations.
 *
 * @remarks
 * Prefer factory functions: {@link scalar}, {@link rows}, {@link sections}, {@link action}.
 *
 * @see scalar
 * @see rows
 * @see sections
 * @see action
 * @public
 */
export interface BaseOperationDef<
  TKind extends PayloadKind,
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
> {
  /**
   * Operation name
   */
  name: string;

  /**
   * Payload kind
   */
  kind: TKind;

  /**
   * Input schema
   */
  input: TInput;

  /**
   * Output schema
   */
  output: TOutput;

  /**
   * User script function
   */
  script: ScriptFunction<z.infer<TInput>>;

  /**
   * Optional parameter hints
   */
  hints?: Record<string, ParamHint>;

  /**
   * Whether to validate input by default
   */
  validateInput?: boolean;

  /**
   * Whether to validate output by default
   */
  validateOutput?: boolean;
}

/**
 * Operation definition for scalar returns.
 * @see scalar
 * @public
 */
export interface ScalarOperationDef<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> extends BaseOperationDef<"scalar", TInput, TOutput> {}

/**
 * Operation definition for action returns.
 * @see action
 * @public
 */
export interface ActionOperationDef<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> extends BaseOperationDef<"action", TInput, TOutput> {}

/**
 * Operation definition for rows returns.
 * @see rows
 * @public
 */
export interface RowsOperationDef<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> extends BaseOperationDef<"rows", TInput, TOutput> {}
/**
 * Extended definition for rows operations including optional mapping helpers.
 *
 * @remarks
 * - `columns`: declarative column names to map row arrays into objects.
 * - `mapRow`: custom mapper for advanced cases. If provided, takes precedence over `columns`.
 * - If neither is provided, the runner will attempt to infer object keys from the Zod output element
 *   when it is an array of objects. If inference fails, rows remain arrays.
 */
export interface RowsOperationDef<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> extends BaseOperationDef<"rows", TInput, TOutput> {
  columns?: string[];
  mapRow?: (cols: string[], rowIndex: number) => unknown;
}

/**
 * Operation definition for sections returns.
 * @see sections
 * @public
 */
export interface SectionsOperationDef<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> extends BaseOperationDef<"sections", TInput, TOutput> {}

/**
 * Union of all operation definition types.
 * @public
 */
export type OperationDef<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> =
  | ScalarOperationDef<TInput, TOutput>
  | ActionOperationDef<TInput, TOutput>
  | RowsOperationDef<TInput, TOutput>
  | SectionsOperationDef<TInput, TOutput>;

/**
 * Type-safe operation instance.
 *
 * @remarks
 * Produced by factory functions and consumed by the runner.
 *
 * @public
 */
export interface Operation<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> {
  def: OperationDef<TInput, TOutput>;
}

/**
 * Error information from a failed operation.
 *
 * @remarks
 * Normalized error payload returned by failed runs.
 *
 * @public
 */
export interface OperationError {
  message: string;
  opName: string;
  appId: string;
  kind: PayloadKind;
  code?: number;
  cause?: unknown;
}

/**
 * Options for running an operation.
 *
 * @remarks
 * Timeouts precedence: `RunOptions.timeoutSec` \> `RunnerConfig.timeoutByKind[kind]` \>
 * `RunnerConfig.defaultTimeoutSec` \> `DEFAULT_TIMEOUTS.APPLESCRIPT_SEC`.
 * Controller timeout works similarly with `defaultControllerTimeoutMs`.
 * Per-run overrides for timeouts and validation.
 *
 * @public
 */
export interface RunOptions {
  /**
   * Override AppleScript timeout in seconds
   */
  timeoutSec?: number;
  /**
   * Override controller timeout in milliseconds
   */
  controllerTimeoutMs?: number;
  /**
   * Skip input validation (overrides per-operation and runner defaults)
   */
  skipInputValidation?: boolean;
  /**
   * Skip output validation (overrides per-operation and runner defaults)
   */
  skipOutputValidation?: boolean;
}

export function isScalarOperation(
  def: OperationDef,
): def is ScalarOperationDef {
  return def.kind === "scalar";
}
export function isActionOperation(
  def: OperationDef,
): def is ActionOperationDef {
  return def.kind === "action";
}
export function isRowsOperation(def: OperationDef): def is RowsOperationDef {
  return def.kind === "rows";
}
export function isSectionsOperation(
  def: OperationDef,
): def is SectionsOperationDef {
  return def.kind === "sections";
}

/**
 * Helper type to infer input shape from an Operation.
 * @public
 */
export type OperationInput<T> =
  T extends Operation<infer I, any> ? z.infer<I> : never;
/**
 * Helper type to infer output shape from an Operation.
 * @public
 */
export type OperationOutput<T> =
  T extends Operation<any, infer O> ? z.infer<O> : never;
