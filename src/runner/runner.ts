/**
 * @fileoverview Main AppleRunner class implementation.
 */
import { z } from "zod";
import { DEFAULT_TIMEOUTS, PayloadKind } from "../core/constants";
import { buildAppleScript } from "../core/script-builder";
import { executeAppleScript } from "../core/executor";
import {
  parseProtocolResponse,
  isSuccessResponse,
  parseRows,
  parseSections,
  parseScalar,
  parseAction,
} from "../core/protocol";
import { marshalParams } from "../core/marshaller";
import { QueueManager } from "../queue/queue-manager";
import type {
  Operation,
  OperationDef,
  OperationError,
  OperationResult,
  RunOptions,
} from "../operations/types";
import {
  isActionOperation,
  isRowsOperation,
  isScalarOperation,
  isSectionsOperation,
} from "../operations/types";
import type { RunnerConfig, RunResult, RunnerStats } from "./types";
import type { DebugInfo, ResultInfo, ErrorInfo } from "./types";
import {
  createErrorFromCode,
  InputValidationError,
  InvalidActionCodeError,
  InvalidReturnTypeError,
  MissingReturnError,
  OutputValidationError,
  ScriptError,
} from "../errors";

export class AppleRunner {
  private readonly config: Required<
    Omit<RunnerConfig, "debug" | "onResult" | "onError">
  > & {
    debug: (info: DebugInfo) => void;
    onResult: (info: ResultInfo) => void;
    onError: (error: ErrorInfo) => void;
  };
  private readonly queueManager: QueueManager;
  private stats = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    operationsByKind: {
      scalar: 0,
      action: 0,
      rows: 0,
      sections: 0,
    } as Record<PayloadKind, number>,
    totalExecutionTime: 0,
    totalRetries: 0,
  };

  constructor(config: RunnerConfig) {
    const {
      appId,
      defaultTimeoutSec = DEFAULT_TIMEOUTS.APPLESCRIPT_SEC,
      defaultControllerTimeoutMs = DEFAULT_TIMEOUTS.CONTROLLER_MS,
      timeoutByKind = {},
      ensureAppReady = true,
      validateByDefault = true,
      maxRetries = 0,
      retryDelayMs = 0,
      debug,
      onResult,
      onError,
    } = config;
    this.config = {
      appId,
      defaultTimeoutSec,
      defaultControllerTimeoutMs,
      timeoutByKind,
      ensureAppReady,
      validateByDefault,
      maxRetries,
      retryDelayMs,
      debug: debug ?? (() => {}),
      onResult: onResult ?? (() => {}),
      onError: onError ?? (() => {}),
    };
    this.queueManager = new QueueManager();
  }

  async run<TInput extends z.ZodType, TOutput extends z.ZodType>(
    operation: Operation<TInput, TOutput>,
    input: z.infer<TInput>,
    options?: RunOptions,
  ): Promise<RunResult<z.infer<TOutput>>> {
    const def = operation.def;
    const startedAt = Date.now();
    let retryCount = 0;
    this.stats.totalOperations += 1;
    this.stats.operationsByKind[def.kind] += 1;

    while (retryCount <= this.config.maxRetries) {
      const res = await this.executeOperation(def, input, options, retryCount);
      const tookMs = Date.now() - startedAt;
      this.stats.totalExecutionTime += tookMs;

      if (res.ok) {
        this.stats.successfulOperations += 1;
        return { ok: true, data: res.data };
      }

      const shouldRetry =
        this.isRetriableError(res.error) && retryCount < this.config.maxRetries;
      if (!shouldRetry) {
        this.stats.failedOperations += 1;
        return { ok: false, error: res.error };
      }

      retryCount += 1;
      this.stats.totalRetries += 1;
      if (this.config.retryDelayMs > 0)
        await new Promise((r) => setTimeout(r, this.config.retryDelayMs));
    }

    // Should not reach
    return {
      ok: false,
      error: {
        message: "Unknown error",
        opName: def.name,
        appId: this.config.appId,
        kind: def.kind,
      },
    };
  }

  private async executeOperation<
    TInput extends z.ZodType,
    TOutput extends z.ZodType,
  >(
    def: OperationDef<TInput, TOutput>,
    input: z.infer<TInput>,
    options?: RunOptions,
    retryCount: number = 0,
  ): Promise<OperationResult<z.infer<TOutput>>> {
    const validateInput = options?.skipInputValidation
      ? false
      : (def.validateInput ?? this.config.validateByDefault);
    const validateOutput = options?.skipOutputValidation
      ? false
      : (def.validateOutput ?? this.config.validateByDefault);

    try {
      // Validate input
      if (validateInput) {
        const parse = (def.input as any).safeParse?.(input);
        if (!parse?.success) {
          throw new InputValidationError(
            "Input validation failed",
            (parse as any)?.error?.issues ?? [],
            def.name,
          );
        }
      }

      const params = marshalParams(input as any, def.hints ?? {});
      const timeoutSec =
        options?.timeoutSec ??
        this.config.timeoutByKind[def.kind] ??
        this.config.defaultTimeoutSec;
      const controllerTimeoutMs =
        options?.controllerTimeoutMs ?? this.config.defaultControllerTimeoutMs;
      const script = buildAppleScript({
        appId: this.config.appId,
        kind: def.kind as PayloadKind,
        userScript: def.script(
          Object.fromEntries(
            params.map((p) => [p.paramName, p.varName]),
          ) as any,
        ),
        params,
        timeoutSec,
        ensureReady: this.config.ensureAppReady,
      });

      this.config.debug?.({
        opName: def.name,
        appId: this.config.appId,
        kind: def.kind as PayloadKind,
        script,
        timeoutSec,
        controllerTimeoutMs,
        input,
        params: params.map((p) => ({
          varName: p.varName,
          literal: p.literal,
          paramName: p.paramName,
        })),
      } satisfies DebugInfo);

      const start = Date.now();
      const result = await this.queueManager.execute(
        this.config.appId,
        async () =>
          executeAppleScript(script, { timeoutMs: controllerTimeoutMs }),
        { opName: def.name, kind: def.kind, retry: retryCount },
      );

      const tookMs = Date.now() - start;
      const response = parseProtocolResponse(result);

      if (isSuccessResponse(response)) {
        const payload = response.payload;
        let output: any;
        if (isScalarOperation(def)) output = parseScalar(payload);
        else if (isActionOperation(def))
          output = parseAction(payload, { opName: def.name });
        else if (isRowsOperation(def)) output = parseRows(payload);
        else if (isSectionsOperation(def)) output = parseSections(payload);
        else output = payload;

        if (validateOutput) {
          // Special handling for rows: if schema is array(object), map columns to object keys
          if (isRowsOperation(def)) {
            const outSchema: any = def.output;
            const elem =
              outSchema?._def?.type ??
              outSchema?._def?.schema ??
              outSchema?.element; // try common places
            const shape =
              elem?.shape ??
              (typeof elem?._def?.shape === "function"
                ? elem._def.shape()
                : undefined);
            const keys = shape ? Object.keys(shape) : undefined;
            if (Array.isArray(keys) && Array.isArray(output)) {
              output = (output as any[]).map((row) => {
                const obj: Record<string, any> = {};
                for (let i = 0; i < keys.length; i++)
                  obj[keys[i] as string] = (row as any)[i];
                return obj;
              });
            }
          }
          const parsed = (def.output as any).safeParse?.(output);
          if (!parsed?.success) {
            throw new OutputValidationError(
              "Output validation failed",
              (parsed as any)?.error?.issues ?? [],
              def.name,
            );
          }
          output = parsed.data;
        }

        this.config.onResult?.({
          opName: def.name,
          appId: this.config.appId,
          kind: def.kind,
          payload,
          output,
          tookMs,
        } satisfies ResultInfo);
        return { ok: true, data: output };
      }

      const err = createErrorFromCode(
        response.code,
        response.message,
        def.name,
        this.config.appId,
      );
      const opErr: OperationError = {
        message: err.message,
        opName: def.name,
        appId: this.config.appId,
        kind: def.kind,
        code: (err as any).code,
        cause: err,
      };
      this.config.onError?.({
        opName: def.name,
        appId: this.config.appId,
        kind: def.kind,
        tookMs,
        error: opErr,
      } satisfies ErrorInfo);
      return { ok: false, error: opErr };
    } catch (e: any) {
      let err: OperationError;
      if (
        e instanceof MissingReturnError ||
        e instanceof InvalidReturnTypeError ||
        e instanceof InvalidActionCodeError ||
        e instanceof OutputValidationError ||
        e instanceof ScriptError
      ) {
        err = {
          message: e.message,
          opName: def.name,
          appId: this.config.appId,
          kind: def.kind,
          cause: e,
        };
      } else {
        err = {
          message: e?.message ?? "Unknown error",
          opName: def.name,
          appId: this.config.appId,
          kind: def.kind,
          cause: e,
        };
      }
      this.config.onError?.({
        opName: def.name,
        appId: this.config.appId,
        kind: def.kind,
        tookMs: 0,
        error: err,
      } satisfies ErrorInfo);
      return { ok: false, error: err };
    }
  }

  private isRetriableError(_error: OperationError): boolean {
    // Basic: do not retry by default; extend for timeouts/transient
    return false;
  }

  getStats(): RunnerStats {
    return this.stats;
  }
  clearQueue(): void {
    this.queueManager.clearQueue(this.config.appId);
  }
  async drain(): Promise<void> {
    await this.queueManager.drainQueue(this.config.appId);
  }
}

export function createAppleRunner(config: RunnerConfig): AppleRunner {
  return new AppleRunner(config);
}
