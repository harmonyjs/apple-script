/**
 * @fileoverview Main AppleRunner class implementation.
 *
 * @remarks
 * Lifecycle:
 * 1) Input validation (optional, zod)
 * 2) Marshalling input to AppleScript literals
 * 3) AppleScript template assembly and execution
 * 4) Protocol parse (OK/ERR with GS/RS/US)
 * 5) Output parse and validation (optional)
 * 6) Retries (configurable)
 * 7) Hooks (debug/onResult/onError)
 *
 * Timeout precedence:
 * - RunOptions.timeoutSec > RunnerConfig.timeoutByKind[kind] > RunnerConfig.defaultTimeoutSec > DEFAULT_TIMEOUTS.APPLESCRIPT_SEC
 * - RunOptions.controllerTimeoutMs > RunnerConfig.defaultControllerTimeoutMs > DEFAULT_TIMEOUTS.CONTROLLER_MS
 *
 * See also: {@link isSuccess}, {@link getResultData}, {@link unwrapResult}.
 */
import { z } from "zod";
import { DEFAULT_TIMEOUTS, PayloadKind } from "../engine/protocol/constants.js";
import { executeAppleScript } from "../engine/executor.js";
import {
  parseProtocolResponse,
  isSuccessResponse,
} from "../engine/protocol/parser.js";
import { QueueManager } from "../queue/queue-manager.js";
import type {
  Operation,
  OperationDef,
  OperationError,
  RunOptions,
} from "../operations/types.js";
import type { RunnerConfig, RunResult, RunnerStats } from "./types.js";
import type { DebugInfo, ResultInfo, ErrorInfo } from "./types.js";
import { extractErrorCode, unsafeCast } from "#shared/unsafe-type-casts.js";
import { createErrorFromCode } from "../errors/index.js";
import { createPublicErrorFromUnknown } from "#errors/factory.js";
import { RunnerStatsManager } from "./runner-stats.js";
import { isRetriableError, delay } from "./retry-policy.js";
import {
  createProcessingPipeline,
  toProcessingConfig,
} from "./pipeline/index.js";

/**
 * Executes operations against a target macOS application with validation, timeouts, retries, and hooks.
 * @public
 */
export class AppleRunner {
  private readonly config: Required<
    Omit<RunnerConfig, "debug" | "onResult" | "onError">
  > & {
    debug: (info: DebugInfo) => void;
    onResult: (info: ResultInfo) => void;
    onError: (error: ErrorInfo) => void;
  };
  private readonly queueManager: QueueManager;
  private readonly pipeline: ReturnType<typeof createProcessingPipeline>;
  private readonly statsMgr = new RunnerStatsManager();

  constructor(config: RunnerConfig) {
    const {
      appId,
      defaultTimeoutSec = DEFAULT_TIMEOUTS.APPLESCRIPT_SEC,
      defaultControllerTimeoutMs = DEFAULT_TIMEOUTS.CONTROLLER_MS,
      timeoutByKind = {},
      ensureAppReady = true,
      validateByDefault = true,
      normalizeRows = true,
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
      normalizeRows,
      maxRetries,
      retryDelayMs,
      debug: debug ?? (() => {}),
      onResult: onResult ?? (() => {}),
      onError: onError ?? (() => {}),
    };
    this.queueManager = new QueueManager();
    this.pipeline = createProcessingPipeline(toProcessingConfig(this.config));
  }

  /**
   * Runs a typed operation against the configured application.
   *
   * Contract:
   * - Inputs: an {@link Operation} and its input shape (`z.infer` from the operation's input schema);
   *   optional {@link RunOptions} for timeouts/validation overrides.
   * - Output: a {@link RunResult} with either parsed & validated data or a normalized error.
   * - Retries: by default only timeout errors are retried when `maxRetries > 0`; other errors are not retried.
   */
  async run<TInput extends z.ZodType, TOutput extends z.ZodType>(
    operation: Operation<TInput, TOutput>,
    input: z.infer<TInput>,
    options?: RunOptions,
  ): Promise<RunResult<z.infer<TOutput>>> {
    const def = operation.def;
    const startedAt = Date.now();
    let retryCount = 0;
    this.statsMgr.onStart(def.kind);

    while (retryCount <= this.config.maxRetries) {
      const res = await this.executeOperation(def, input, options, retryCount);
      const tookMs = Date.now() - startedAt;

      if (res.ok) {
        this.statsMgr.onSuccess(tookMs);
        return { ok: true, data: res.data };
      }

      const shouldRetry =
        isRetriableError(res.error) && retryCount < this.config.maxRetries;
      if (!shouldRetry) {
        this.statsMgr.onFailure(tookMs);
        return { ok: false, error: res.error };
      }

      retryCount += 1;
      this.statsMgr.onRetryAttempt();
      await delay(this.config.retryDelayMs);
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
  ): Promise<RunResult<z.infer<TOutput>>> {
    const validateInput = options?.skipInputValidation
      ? false
      : (def.validateInput ?? this.config.validateByDefault);
    const validateOutput = options?.skipOutputValidation
      ? false
      : (def.validateOutput ?? this.config.validateByDefault);

    try {
      // 1) Validate input
      this.pipeline.validateInputIfNeeded(def, input, validateInput);

      // 2) Build script context
      const { params, timeoutSec, controllerTimeoutMs, script } =
        this.pipeline.buildScriptContext(def, input, options);

      // 3) Debug hook
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
        const output = this.pipeline.runPostProcessing(
          def,
          payload,
          validateOutput,
        );

        this.config.onResult?.({
          opName: def.name,
          appId: this.config.appId,
          kind: def.kind,
          payload,
          output,
          tookMs,
        } satisfies ResultInfo);
        // WHY: After validation, `output` is guaranteed to match z.infer<TOutput>.
        // Use centralized unsafeCast to localize the assertion.
        return { ok: true, data: unsafeCast<z.infer<TOutput>>(output) };
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
        code: extractErrorCode(err),
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
      const publicErr = createPublicErrorFromUnknown(e, {
        operationName: def.name,
        appId: this.config.appId,
        kind: def.kind,
      });
      const err: OperationError = {
        message: publicErr.message,
        opName: def.name,
        appId: this.config.appId,
        kind: def.kind,
        cause: publicErr,
      };
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

  getStats(): RunnerStats {
    return this.statsMgr.getStats();
  }
  clearQueue(): void {
    this.queueManager.clearQueue(this.config.appId);
  }
  async drain(): Promise<void> {
    await this.queueManager.drainQueue(this.config.appId);
  }
}

/**
 * Creates an AppleRunner for the given app id and configuration.
 * @public
 */
export function createAppleRunner(config: RunnerConfig): AppleRunner {
  return new AppleRunner(config);
}
