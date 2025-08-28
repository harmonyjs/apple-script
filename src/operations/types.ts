/**
 * @fileoverview Type definitions for AppleScript operations.
 *
 * This module defines the structure of operations - declarative
 * descriptions of AppleScript tasks with input/output validation.
 */
import { z } from "zod";
import type { PayloadKind } from "../core/constants.js";

/**
 * Script function that generates AppleScript code.
 * Receives an object with parameter variable names.
 */
export type ScriptFunction<TInput> = (vars: VariableMap<TInput>) => string;

/**
 * Maps input schema keys to AppleScript variable names.
 */
export type VariableMap<T> = {
  [K in keyof T]: string;
};

/** Base definition for all operations. */
export interface BaseOperationDef<
  TKind extends PayloadKind,
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
> {
  /** Operation name */
  name: string;

  /** Payload kind */
  kind: TKind;

  /** Input schema */
  input: TInput;

  /** Output schema */
  output: TOutput;

  /** User script function */
  script: ScriptFunction<z.infer<TInput>>;

  /** Optional parameter hints */
  hints?: Record<string, any>;

  /** Whether to validate input by default */
  validateInput?: boolean;

  /** Whether to validate output by default */
  validateOutput?: boolean;
}

/** Operation definition for scalar returns. */
export interface ScalarOperationDef<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> extends BaseOperationDef<"scalar", TInput, TOutput> {}

/** Operation definition for action returns. */
export interface ActionOperationDef<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> extends BaseOperationDef<"action", TInput, TOutput> {}

/** Operation definition for rows returns. */
export interface RowsOperationDef<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> extends BaseOperationDef<"rows", TInput, TOutput> {}

/** Operation definition for sections returns. */
export interface SectionsOperationDef<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> extends BaseOperationDef<"sections", TInput, TOutput> {}

/** Union of all operation definition types. */
export type OperationDef<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> =
  | ScalarOperationDef<TInput, TOutput>
  | ActionOperationDef<TInput, TOutput>
  | RowsOperationDef<TInput, TOutput>
  | SectionsOperationDef<TInput, TOutput>;

/** Type-safe operation instance. */
export interface Operation<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> {
  def: OperationDef<TInput, TOutput>;
}

/** Result from running an operation. */
export type OperationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: OperationError };

/** Error information from a failed operation. */
export interface OperationError {
  message: string;
  opName: string;
  appId: string;
  kind: PayloadKind;
  code?: number;
  cause?: unknown;
}

/** Options for running an operation. */
export interface RunOptions {
  /** Override AppleScript timeout in seconds */
  timeoutSec?: number;
  /** Override controller timeout in ms */
  controllerTimeoutMs?: number;
  /** Skip input validation */
  skipInputValidation?: boolean;
  /** Skip output validation */
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

export type OperationInput<T> =
  T extends Operation<infer I, any> ? z.infer<I> : never;
export type OperationOutput<T> =
  T extends Operation<any, infer O> ? z.infer<O> : never;
