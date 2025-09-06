/**
 * @fileoverview Factory functions for creating AppleScript operations.
 *
 * These helpers build strongly-typed operation definitions that the runner can execute.
 * Each factory maps to a payload kind of the wire protocol:
 * - scalar: returns a single text value
 * - rows: tabular data encoded with RS/US separators
 * - sections: named groups encoded with GS+US
 * - action: imperative result as a code ("0" | "1" | "2")
 *
 * @remarks
 * Use these factories for most use cases. They add sensible defaults and output validation.
 * If you need full control, see {@link createOperation}.
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
import type { ScriptFunction } from "./types.js";
import type { ParamHint } from "../engine/params.js";

/**
 * Creates a low-level operation object from a full {@link OperationDef}.
 *
 * @remarks
 * Prefer using {@link scalar}, {@link rows}, {@link sections} or {@link action} unless you
 * need to provide every detail manually. The factories set default validation flags and
 * ensure the output schemas match the protocol expectations.
 *
 * @public
 */
export function createOperation<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
>(def: OperationDef<TInput, TOutput>): Operation<TInput, TOutput> {
  return { def };
}

/**
 * Options for a scalar operation factory.
 * @public
 */
export interface ScalarOptions<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
> {
  /**
   * Human-friendly operation name (used in errors/debug)
   */
  name: string;
  /**
   * Zod schema describing input shape
   */
  input: TInput;
  /**
   * Zod schema describing the scalar output (string, number, boolean, etc.)
   */
  output: TOutput;
  /**
   * Function that builds the AppleScript body using variable placeholders
   */
  script: ScriptFunction<z.infer<TInput>>;
  /**
   * Marshalling hints keyed by input keys (see {@link ParamHint})
   */
  hints?: Record<string, ParamHint>;
  /**
   * Validate input before running
   * @defaultValue true (inherits runner's validateByDefault)
   */
  validateInput?: boolean;
  /**
   * Validate output after parsing
   * @defaultValue true (inherits runner's validateByDefault)
   */
  validateOutput?: boolean;
}

/**
 * Creates a scalar operation.
 *
 * @remarks
 * Scalar is the simplest mode that returns a single text value. The user script must
 * `return` the value. The runner will parse it as text and validate it with your `output` schema.
 *
 * @example
 * ```ts
 * import { z } from 'zod'
 * import { createAppleRunner, operation } from '@avavilov/apple-script'
 *
 * const op = operation.scalar({
 *   name: 'Get Safari URL',
 *   input: z.object({ }),
 *   output: z.string().url(),
 *   script: () => `
 *     set winUrl to ""
 *     tell application id "com.apple.Safari"
 *       if exists front document then set winUrl to URL of front document
 *     end tell
 *     return winUrl
 *   `,
 * })
 *
* const runner = createAppleRunner({ appId: 'com.apple.Safari' })
 * const res = await runner.run(op, {})
 * ```
 *
 * @public
 */
export function scalar<TInput extends z.ZodType, TOutput extends z.ZodType>(
  options: ScalarOptions<TInput, TOutput>,
): Operation<TInput, TOutput> {
  const def: ScalarOperationDef<TInput, TOutput> = {
    kind: "scalar",
    name: options.name,
    input: options.input,
    output: options.output,
    script: options.script,
    hints: options.hints,
    validateInput: options.validateInput,
    validateOutput: options.validateOutput,
  };
  return createOperation(def);
}

/**
 * Options for an action operation factory.
 * @public
 */
export interface ActionOptions<TInput extends z.ZodType> {
  /**
   * Operation name
   */
  name: string;
  /**
   * Input schema
   */
  input: TInput;
  /**
   * User script should return one of "0" | "1" | "2"
   */
  script: ScriptFunction<z.infer<TInput>>;
  /**
   * Marshalling hints keyed by input keys (see {@link ParamHint})
   */
  hints?: Record<string, ParamHint>;
  /**
   * Validate input before running
   * @defaultValue true (inherits runner's validateByDefault)
   */
  validateInput?: boolean;
}

// Reusable strict enum for action results: '0' | '1' | '2'
/**
 * Strict schema for {@link action} output: one of "0" | "1" | "2".
 *
 * @remarks
 * See semantics in {@link ACTION_CODES}:
 * - "0" — FAILURE, the operation failed and no changes applied
 * - "1" — SUCCESS, the operation fully completed
 * - "2" — PARTIAL, the operation partially completed and may require follow-up
 *
 * The runner exposes this code to your application as-is and you can use
 * utilities like {@link isSuccess} / {@link unwrapResult} on the overall run result.
 * You will typically consume the action result as an {@link ActionCode} union ("0" | "1" | "2").
 *
 * @public
 */
export const ACTION_OUTPUT_SCHEMA = z.enum(["0", "1", "2"] as const);
/**
 * Type of the ACTION_OUTPUT_SCHEMA runtime enum (ZodEnum of "0" | "1" | "2").
 * @public
 */
export type ActionOutputSchema = typeof ACTION_OUTPUT_SCHEMA;

/**
 * Creates an action operation returning an {@link ActionOutputSchema} code.
 *
 * @remarks
 * Use this mode for imperative flows (clicks, navigation, form submit) when you want
 * a compact success signal without a payload. In your AppleScript body, `return "0" | "1" | "2"`.
 * The library validates the returned code and maps unknown values to {@link InvalidActionCodeError}.
 *
 * @example
 * ```ts
 * import { z } from 'zod'
 * import { createAppleRunner, operation } from '@avavilov/apple-script'
 *
 * const click = operation.action({
 *   name: 'Click button',
 *   input: z.object({ title: z.string() }),
 *   script: ({ title }) => `
 *     tell application id "com.apple.Safari"
 *       set ok to false
 *       -- ... attempt to click a button titled ${title} ...
 *       if ok then return "1" else return "0"
 *     end tell
 *   `,
 * })
 *
* const runner = createAppleRunner({ appId: 'com.apple.Safari' })
 * const result = await runner.run(click, { title: 'OK' })
 * ```
 *
 * @see ACTION_CODES
 * @public
 */
export function action<TInput extends z.ZodType>(
  options: ActionOptions<TInput>,
): Operation<TInput, ActionOutputSchema> {
  const def: ActionOperationDef<TInput, ActionOutputSchema> = {
    kind: "action",
    name: options.name,
    input: options.input,
    output: ACTION_OUTPUT_SCHEMA,
    script: options.script,
    hints: options.hints,
    validateInput: options.validateInput,
    validateOutput: true,
  } as any;
  return createOperation(def);
}

/**
 * Options for a rows operation factory.
 * @public
 */
export interface RowsOptions<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
> {
  /**
   * Operation name
   */
  name: string;
  /**
   * Input schema
   */
  input: TInput;
  /**
   * Output schema (typically z.array(z.object(...)))
   */
  output: TOutput; // array(object(\{ ... \})) expected
  /**
   * User script producing a list of lists (rows x columns)
   */
  script: ScriptFunction<z.infer<TInput>>;
  /**
   * Declarative column names for mapping row arrays to objects.
   * If provided, takes effect before validation. Ignored when `mapRow` is set.
   */
  columns?: string[];
  /**
   * Custom row mapper. Receives raw columns and row index; should return the object/value for this row.
   * If provided, it takes precedence over `columns` and schema-based inference.
   */
  mapRow?: (cols: string[], rowIndex: number) => unknown;
  /**
   * Marshalling hints keyed by input keys (see {@link ParamHint})
   */
  hints?: Record<string, ParamHint>;
  /**
   * Validate input before running
   * @defaultValue true (inherits runner's validateByDefault)
   */
  validateInput?: boolean;
  /**
   * Validate output after parsing and key-mapping
   * @defaultValue true (inherits runner's validateByDefault)
   */
  validateOutput?: boolean;
}

/**
 * Creates a rows operation for tabular results.
 *
 * @remarks
 * The user script must return a list of lists, where each inner list is a row. The library
 * encodes fields with {@link US} and rows with {@link RS}. After parsing, if your `output`
 * is a Zod array of object schema (for example, z.array(z.object(...))), the library will map
 * columns left-to-right into object keys from the schema shape.
 *
 * Mapping rules:
 * - If a row has fewer columns than object keys, missing keys will become `undefined` and then be validated by your schema.
 * - If a row has more columns than object keys, extra columns are ignored.
 * - The object keys order is taken from the z.object shape enumeration order.
 * - If your `output` is not an array of objects, rows are returned as arrays of arrays.
 *
 * @example
 * ```ts
 * import { z } from 'zod'
 * import { createAppleRunner, operation } from '@avavilov/apple-script'
 *
 * const findTabs = operation.rows({
 *   name: 'List tabs',
 *   input: z.object({ }),
 *   output: z.array(z.object({ title: z.string(), url: z.string().url() })),
 *   script: () => `
 *     tell application id "com.apple.Safari"
 *       set rows to \{\}
 *       repeat with w in windows
 *         repeat with t in tabs of w
 *           set end of rows to \{ name of t, URL of t \}
 *         end repeat
 *       end repeat
 *       return rows
 *     end tell
 *   `,
 * })
 * ```
 *
 * @see US
 * @see RS
 * @public
 */
export function rows<TInput extends z.ZodType, TOutput extends z.ZodType>(
  options: RowsOptions<TInput, TOutput>,
): Operation<TInput, TOutput> {
  const def: RowsOperationDef<TInput, TOutput> = {
    kind: "rows",
    name: options.name,
    input: options.input,
    output: options.output,
    script: options.script,
    columns: options.columns,
    mapRow: options.mapRow,
    hints: options.hints,
    validateInput: options.validateInput,
    validateOutput: options.validateOutput,
  };
  return createOperation(def);
}

/**
 * Options for a sections operation factory.
 * @public
 */
export interface SectionsOptions<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
> {
  /**
   * Operation name
   */
  name: string;
  /**
   * Input schema
   */
  input: TInput;
  /**
   * Output schema (typically z.record(z.array(z.string())))
   */
  output: TOutput; // record of arrays
  /**
   * User script producing a list of pairs (name, items)
   */
  script: ScriptFunction<z.infer<TInput>>;
  /**
   * Marshalling hints keyed by input keys (see {@link ParamHint})
   */
  hints?: Record<string, ParamHint>;
  /**
   * Validate input before running
   * @defaultValue true (inherits runner's validateByDefault)
   */
  validateInput?: boolean;
  /**
   * Validate output after parsing
   * @defaultValue true (inherits runner's validateByDefault)
   */
  validateOutput?: boolean;
}

/**
 * Creates a sections operation for grouped results.
 *
 * @remarks
 * The user script must return a list of pairs: name/items or name/item. The builder encodes
 * sections using {@link GS} between sections and {@link US} within a section. The parser
 * produces a `Record<string, string[]>` which is then validated against your `output`.
 *
 * @example
 * ```ts
 * const op = operation.sections({
 *   name: 'Classify URLs',
 *   input: z.object({ urls: z.array(z.string().url()) }),
 *   output: z.record(z.array(z.string())),
 *   script: ({ urls }) => `
 *     set good to {}
 *     set bad to {}
 *     -- 'urls' is provided via the parameters mapping
 *     repeat with u in urls
 *       if (u starts with "https://") then set end of good to u else set end of bad to u
 *     end repeat
 *     return \{\{"good", good\}, \{"bad", bad\}\}
 *   `,
 * })
 * ```
 *
 * @see GS
 * @see US
 * @public
 */
export function sections<TInput extends z.ZodType, TOutput extends z.ZodType>(
  options: SectionsOptions<TInput, TOutput>,
): Operation<TInput, TOutput> {
  const def: SectionsOperationDef<TInput, TOutput> = {
    kind: "sections",
    name: options.name,
    input: options.input,
    output: options.output,
    script: options.script,
    hints: options.hints,
    validateInput: options.validateInput,
    validateOutput: options.validateOutput,
  };
  return createOperation(def);
}

/**
 * Namespace of operation factories and a low-level create helper.
 * @public
 */
export const operation = {
  scalar,
  action,
  rows,
  sections,
  create: createOperation,
} as const;

export type InferOperation<T> =
  T extends Operation<infer I, infer O> ? Operation<I, O> : never;
