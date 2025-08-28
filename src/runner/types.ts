/**
 * @fileoverview Type definitions for the AppleRunner.
 */
import type { PayloadKind } from "../core/constants";
import type { OperationError } from "../operations/types";

/** Configuration for the AppleRunner. */
export interface RunnerConfig {
  appId: string;
  defaultTimeoutSec?: number;
  defaultControllerTimeoutMs?: number;
  timeoutByKind?: Partial<Record<PayloadKind, number>>;
  ensureAppReady?: boolean;
  validateByDefault?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
  debug?: (info: DebugInfo) => void;
  onResult?: (info: ResultInfo) => void;
  onError?: (error: ErrorInfo) => void;
}

/** Information provided to the debug hook. */
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

/** Information provided to the result hook. */
export interface ResultInfo {
  opName: string;
  appId: string;
  kind: PayloadKind;
  payload: string;
  output: unknown;
  tookMs: number;
}

/** Information provided to the error hook. */
export interface ErrorInfo {
  opName: string;
  appId: string;
  kind: PayloadKind;
  tookMs: number;
  error: OperationError;
}

/** Result from running an operation through the runner. */
export type RunResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: OperationError };

/** Statistics about runner performance. */
export interface RunnerStats {
  totalOperations: number;
  successfulOperations: 0 | number;
  failedOperations: 0 | number;
  operationsByKind: Record<PayloadKind, number>;
  totalExecutionTime: number;
  totalRetries: number;
}

/** Options for creating a runner instance. */
export interface CreateRunnerOptions extends RunnerConfig {}

export function isSuccess<T>(
  result: RunResult<T>,
): result is { ok: true; data: T } {
  return result.ok === true;
}

export function isError<T>(
  result: RunResult<T>,
): result is { ok: false; error: OperationError } {
  return result.ok === false;
}

export function unwrapResult<T>(result: RunResult<T>): T {
  if (isSuccess(result)) return result.data;
  throw result.error;
}

export function getResultData<T>(result: RunResult<T>): T | undefined {
  return isSuccess(result) ? result.data : undefined;
}

export function getResultError<T>(
  result: RunResult<T>,
): OperationError | undefined {
  return isError(result) ? result.error : undefined;
}
