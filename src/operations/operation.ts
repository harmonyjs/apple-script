/**
 * @fileoverview Factory functions for creating AppleScript operations.
 */
import { z } from "zod";
import type {
  ActionOperationDef,
  Operation,
  OperationDef,
  RowsOperationDef,
  ScalarOperationDef,
  SectionsOperationDef,
} from "./types.js";

function createOperation<TInput extends z.ZodType, TOutput extends z.ZodType>(
  def: OperationDef<TInput, TOutput>,
): Operation<TInput, TOutput> {
  return { def };
}

export interface ScalarOptions<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
> {
  name: string;
  input: TInput;
  output: TOutput;
  script: (vars: any) => string;
  hints?: Record<string, any>;
  validateInput?: boolean;
  validateOutput?: boolean;
}

export function scalar<TInput extends z.ZodType, TOutput extends z.ZodType>(
  options: ScalarOptions<TInput, TOutput>,
): Operation<TInput, TOutput> {
  const def: ScalarOperationDef<TInput, TOutput> = {
    kind: "scalar",
    name: options.name,
    input: options.input,
    output: options.output,
    script: options.script as any,
    hints: options.hints,
    validateInput: options.validateInput,
    validateOutput: options.validateOutput,
  };
  return createOperation(def);
}

export interface ActionOptions<TInput extends z.ZodType> {
  name: string;
  input: TInput;
  script: (vars: any) => string;
  hints?: Record<string, any>;
  validateInput?: boolean;
}

// Reusable strict enum for action results: '0' | '1' | '2'
const ACTION_ENUM = z.enum(["0", "1", "2"] as const);

export function action<TInput extends z.ZodType>(
  options: ActionOptions<TInput>,
): Operation<TInput, typeof ACTION_ENUM> {
  const def: ActionOperationDef<TInput, typeof ACTION_ENUM> = {
    kind: "action",
    name: options.name,
    input: options.input,
    output: ACTION_ENUM,
    script: options.script as any,
    hints: options.hints,
    validateInput: options.validateInput,
    validateOutput: true,
  } as any;
  return createOperation(def);
}

export interface RowsOptions<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
> {
  name: string;
  input: TInput;
  output: TOutput; // array(object(...)) expected
  script: (vars: any) => string;
  hints?: Record<string, any>;
  validateInput?: boolean;
  validateOutput?: boolean;
}

export function rows<TInput extends z.ZodType, TOutput extends z.ZodType>(
  options: RowsOptions<TInput, TOutput>,
): Operation<TInput, TOutput> {
  const def: RowsOperationDef<TInput, TOutput> = {
    kind: "rows",
    name: options.name,
    input: options.input,
    output: options.output,
    script: options.script as any,
    hints: options.hints,
    validateInput: options.validateInput,
    validateOutput: options.validateOutput,
  };
  return createOperation(def);
}

export interface SectionsOptions<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
> {
  name: string;
  input: TInput;
  output: TOutput; // record of arrays
  script: (vars: any) => string;
  hints?: Record<string, any>;
  validateInput?: boolean;
  validateOutput?: boolean;
}

export function sections<TInput extends z.ZodType, TOutput extends z.ZodType>(
  options: SectionsOptions<TInput, TOutput>,
): Operation<TInput, TOutput> {
  const def: SectionsOperationDef<TInput, TOutput> = {
    kind: "sections",
    name: options.name,
    input: options.input,
    output: options.output,
    script: options.script as any,
    hints: options.hints,
    validateInput: options.validateInput,
    validateOutput: options.validateOutput,
  };
  return createOperation(def);
}

export const operation = {
  scalar,
  action,
  rows,
  sections,
  create: createOperation,
} as const;

export type InferOperation<T> =
  T extends Operation<infer I, infer O> ? Operation<I, O> : never;
