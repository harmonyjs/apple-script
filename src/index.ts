/**
 * @packageDocumentation
 * Public API for \@avavilov/apple-script.
 *
 * Overview:
 * - Define an operation with {@link scalar} / {@link rows} / {@link sections} / {@link action}
 * - Create a runner via {@link createAppleRunner}
 * - Run the operation and handle the result using {@link isSuccess}, {@link unwrapResult}
 *
 * Minimal example:
 * ```ts
 * import { z } from 'zod'
 * import { createAppleRunner, operation, isSuccess } from '@avavilov/apple-script'
 *
 * const op = operation.scalar({
 *   name: 'Front URL',
 *   input: z.object({}),
 *   output: z.string().url(),
 *   script: () => `
 *     tell application id "com.apple.Safari"
 *       if exists front document then return URL of front document
 *       return ""
 *     end tell
 *   `,
 * })
 *
 * const runner = createAppleRunner({ appId: 'com.apple.Safari' })
 * const result = await runner.run(op, {})
 * if (isSuccess(result)) console.log(result.data)
 * ```
 *
 * Glossary:
 * - Payload kinds: `scalar` (single value), `rows` (tabular), `sections` (named groups), `action` (code: "0" | "1" | "2")
 * - Separators: {@link US} — field, {@link RS} — row, {@link GS} — section
 * - Factories: prefer {@link operation.scalar} / {@link operation.rows} / {@link operation.sections} / {@link operation.action}
 * - Runner: prefer {@link createAppleRunner} (constructor available as {@link AppleRunner} for advanced setups)
 */

// Main API
export { createAppleRunner, AppleRunner } from "./runner/runner";
export { operation } from "./operations/operation";
/**
 * Convenience namespace with factory functions: {@link scalar}, {@link rows}, {@link sections}, {@link action}, and {@link createOperation}.
 * Prefer `operation.scalar({...})` style; use `operation.create(...)` only for advanced customization.
 * @public
 */
export {
  createOperation,
  scalar,
  action,
  rows,
  sections,
  ACTION_OUTPUT_SCHEMA,
} from "./operations/operation";
export type { ActionOutputSchema } from "./operations/operation";

// Public option types for operation factories
export type {
  ScalarOptions,
  ActionOptions,
  RowsOptions,
  SectionsOptions,
} from "./operations/operation";

// Types for runner
export type {
  RunnerConfig,
  RunResult,
  RunnerStats,
  CreateRunnerOptions,
  DebugInfo,
  ResultInfo,
  ErrorInfo,
} from "./runner/types";

// Utility functions for results
export {
  isSuccess,
  isError,
  unwrapResult,
  getResultData,
  getResultError,
} from "./runner/types";

// Types for operations
export type {
  BaseOperationDef,
  Operation,
  OperationDef,
  OperationInput,
  OperationOutput,
  OperationError,
  RunOptions,
  ScalarOperationDef,
  ActionOperationDef,
  RowsOperationDef,
  SectionsOperationDef,
  ScriptFunction,
  VariableMap,
} from "./operations/types";

// Protocol constants (for advanced users)
export {
  GS,
  RS,
  US,
  ACTION_CODES,
  DEFAULT_TIMEOUTS,
  MAX_SIZES,
} from "./core/constants";

export type { PayloadKind, ActionCode } from "./core/constants";

// Error types
export {
  AppleScriptError,
  TimeoutAppleEventError,
  TimeoutOSAScriptError,
  MissingReturnError,
  InvalidReturnTypeError,
  InvalidActionCodeError,
  ScriptError,
  ParseError,
  InputValidationError,
  OutputValidationError,
  isAppleScriptError,
  isTimeoutError,
  getUserFriendlyMessage,
} from "./errors";

// Marshaller types (for advanced users)
export type { ParamHint, MarshalledParam } from "./core/marshaller";
