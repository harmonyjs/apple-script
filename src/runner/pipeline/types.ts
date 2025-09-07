/**
 * @fileoverview Core pipeline types and interfaces
 */
import type { PayloadKind } from "../../engine/protocol/constants.js";
import type { OperationDef, RunOptions } from "../../operations/types.js";

// Generic Step interface
export interface Step<TIn, TOut> {
  name: string;
  execute(input: TIn, context: PipelineContext): TOut;
}

// Pipeline context shared across steps
export interface PipelineContext {
  config: ProcessingConfig;
  operation: OperationDef<any, any>;
  options?: RunOptions;
  shouldValidate: boolean;
}

export interface ProcessingConfig {
  appId: string;
  validateByDefault: boolean;
  normalizeRows: boolean;
  defaultTimeoutSec: number;
  defaultControllerTimeoutMs: number;
  timeoutByKind: Partial<Record<PayloadKind, number>>;
  ensureAppReady: boolean;
}

export interface BuiltScriptContext {
  params: Array<{ varName: string; literal: string; paramName: string }>;
  timeoutSec: number;
  controllerTimeoutMs: number;
  script: string;
}
