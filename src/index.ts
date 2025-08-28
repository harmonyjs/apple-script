/**
 * @fileoverview Public API for @avavilov/apple-script library.
 *
 * This module re-exports all the public types and functions that
 * users of the library need to access.
 */

// Main API
export { createAppleRunner, AppleRunner } from "./runner/runner";
export { operation } from "./operations/operation";

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
  Operation,
  OperationDef,
  OperationInput,
  OperationOutput,
  OperationResult,
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
