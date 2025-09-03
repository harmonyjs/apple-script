/**
 * @fileoverview Type definitions for the AppleRunner.
 */
import type { PayloadKind } from "../core/constants.js";
import type { OperationError } from "../operations/types.js";

/**
 * Configuration for the AppleRunner.
 *
 * @remarks
 * Timeout precedence:
 * - RunOptions.timeoutSec (per run)
 * - RunnerConfig.timeoutByKind[kind] (per kind override)
 * - RunnerConfig.defaultTimeoutSec (runner default)
 * - DEFAULT_TIMEOUTS.APPLESCRIPT_SEC (library fallback)
 *
 * Controller timeout precedence:
 * - RunOptions.controllerTimeoutMs (per run)
 * - RunnerConfig.defaultControllerTimeoutMs (runner default)
 * - DEFAULT_TIMEOUTS.CONTROLLER_MS (library fallback)
 *
 * Validation: if `validateByDefault` is true (default), factories also validate unless
 * overridden by per-operation flags.
 *
 * @public
 */
export interface RunnerConfig {
  appId: string;
  /**
   * Default AppleScript timeout in seconds (see DEFAULT_TIMEOUTS for fallback)
   */
  defaultTimeoutSec?: number;
  /**
   * Default controller timeout in milliseconds (see DEFAULT_TIMEOUTS for fallback)
   */
  defaultControllerTimeoutMs?: number;
  /**
   * Per-payload-kind timeout override in seconds
   */
  timeoutByKind?: Partial<Record<PayloadKind, number>>;
  /**
   * Ensure the target app is ready before executing (default: true)
   */
  ensureAppReady?: boolean;
  /**
   * Whether to validate input/output by default in factories (default: true)
   */
  validateByDefault?: boolean;
  /**
  * Number of retry attempts on retriable errors (default: 0).
  * Only timeout errors are retried by default; validation/protocol errors are not retried.
   */
  maxRetries?: number;
  /**
  * Delay between retries in milliseconds (default: 0ms).
   */
  retryDelayMs?: number;
  debug?: (info: DebugInfo) => void;
  onResult?: (info: ResultInfo) => void;
  onError?: (error: ErrorInfo) => void;
}

/**
 * Information provided to the debug hook.
 * @public
 */
export interface DebugInfo {
  opName: string;
  appId: string;
  kind: PayloadKind;
  script: string;
  timeoutSec: number;
  controllerTimeoutMs: number;
  input: unknown;
  params: Array<{
    varName: string;
    literal: string;
    paramName: string;
  }>;
}

/**
 * Information provided to the result hook.
 * @public
 */
export interface ResultInfo {
  opName: string;
  appId: string;
  kind: PayloadKind;
  payload: string;
  output: unknown;
  tookMs: number;
}

/**
 * Information provided to the error hook.
 * @public
 */
export interface ErrorInfo {
  opName: string;
  appId: string;
  kind: PayloadKind;
  tookMs: number;
  error: OperationError;
}

/**
 * Result from running an operation through the runner.
 * @public
 */
export type RunResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: OperationError };

/**
 * Statistics about runner performance.
 *
 * @remarks
 * Execution time is the total wall time across all attempts, including retries.
 *
 * @public
 */
export interface RunnerStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  operationsByKind: Record<PayloadKind, number>;
  /**
   * Total wall time across all operations and retries, in milliseconds
   */
  totalExecutionTime: number;
  totalRetries: number;
}

/**
 * Options for creating a runner instance.
 *
 * @remarks
 * Creates a runner using the provided configuration type; alias of RunnerConfig for semantic clarity.
 *
 * @public
 */
export interface CreateRunnerOptions extends RunnerConfig {}

/**
 * @public
 * Type guard for successful RunResult.
 */
export function isSuccess<T>(
  result: RunResult<T>,
): result is { ok: true; data: T } {
  return result.ok === true;
}

/**
 * @public
 * Type guard for failed RunResult.
 */
export function isError<T>(
  result: RunResult<T>,
): result is { ok: false; error: OperationError } {
  return result.ok === false;
}

/**
 * @public
 * Returns data when the result is ok; otherwise throws the contained error.
 */
export function unwrapResult<T>(result: RunResult<T>): T {
  /**
   * @example
   * ```ts
   * const data = unwrapResult(await runner.run(op, input))
   * ```
   */
  if (isSuccess(result)) return result.data;
  throw result.error;
}

/**
 * @public
 * Extracts data from a successful result, or undefined for errors.
 */
export function getResultData<T>(result: RunResult<T>): T | undefined {
  /**
   * @example
   * ```ts
   * const r = await runner.run(op, input)
   * const data = getResultData(r)
   * ```
   */
  return isSuccess(result) ? result.data : undefined;
}

/**
 * @public
 * Extracts error from a failed result, or undefined for successes.
 */
export function getResultError<T>(
  result: RunResult<T>,
): OperationError | undefined {
  /**
   * @example
   * ```ts
   * const r = await runner.run(op, input)
   * const err = getResultError(r)
   * ```
   */
  return isError(result) ? result.error : undefined;
}
