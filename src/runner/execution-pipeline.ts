import { z } from "zod";
import { marshalParams } from "../engine/marshaller.js";
import { buildAppleScript } from "../engine/script-builder.js";
import { PayloadKind } from "../engine/protocol/constants.js";
import {
  isActionOperation,
  isRowsOperation,
  isScalarOperation,
  isSectionsOperation,
} from "../operations/types.js";
import type { OperationDef, RunOptions } from "../operations/types.js";
import {
  parseRows,
  parseSections,
  parseScalar,
  parseAction,
} from "../engine/protocol/parser.js";
import {
  InputValidationError,
  OutputValidationError,
} from "../errors/index.js";
import { mapRowsOutput } from "./map-rows.js";
import { normalizeRowsToSchema } from "../normalization/normalize-rows.js";
import {
  safeParseWithSchema,
  extractZodIssues,
  getNormalizeRowsSetting,
  buildVarsMap,
  unsafeCast,
} from "#shared/unsafe-type-casts.js";

export interface PipelineConfig {
  appId: string;
  ensureAppReady: boolean;
  validateByDefault: boolean;
  normalizeRows: boolean;
  defaultTimeoutSec: number;
  defaultControllerTimeoutMs: number;
  timeoutByKind: Partial<Record<PayloadKind, number>>;
}

export class ExecutionPipeline {
  constructor(private readonly cfg: PipelineConfig) {}

  validateInputIfNeeded<TInput extends z.ZodType, TOutput extends z.ZodType>(
    def: OperationDef<TInput, TOutput>,
    input: z.infer<TInput>,
    shouldValidate: boolean,
  ): void {
    if (!shouldValidate) return;
    // Using type adapter for safe schema parsing
    const parse = safeParseWithSchema(def.input, input);
    if (!parse.success) {
      throw new InputValidationError(
        "Input validation failed",
        extractZodIssues(parse),
        def.name,
      );
    }
  }

  buildScriptContext<TInput extends z.ZodType, TOutput extends z.ZodType>(
    def: OperationDef<TInput, TOutput>,
    input: z.infer<TInput>,
    options?: RunOptions,
  ) {
  // Centralized unsafe cast: marshaller expects a record
  const params = marshalParams(unsafeCast<Record<string, unknown>>(input), def.hints ?? {});
    const timeoutSec =
      options?.timeoutSec ??
      this.cfg.timeoutByKind[def.kind] ??
      this.cfg.defaultTimeoutSec;
    const controllerTimeoutMs =
      options?.controllerTimeoutMs ?? this.cfg.defaultControllerTimeoutMs;
    const script = buildAppleScript({
      appId: this.cfg.appId,
      kind: def.kind as PayloadKind,
      userScript: def.script(unsafeCast<any>(buildVarsMap(params))),
      params,
      timeoutSec,
      ensureReady: this.cfg.ensureAppReady,
    });
    return { params, timeoutSec, controllerTimeoutMs, script };
  }

  parsePayload<TInput extends z.ZodType, TOutput extends z.ZodType>(
    def: OperationDef<TInput, TOutput>,
    payload: string,
  ): unknown {
    if (isScalarOperation(def)) return parseScalar(payload);
    if (isActionOperation(def))
      return parseAction(payload, { opName: def.name });
    if (isRowsOperation(def)) return parseRows(payload);
    if (isSectionsOperation(def)) return parseSections(payload);
    return payload;
  }

  postProcessRows<TInput extends z.ZodType, TOutput extends z.ZodType>(
    def: OperationDef<TInput, TOutput>,
    output: unknown,
  ): unknown {
    if (!isRowsOperation(def) || !Array.isArray(output)) return output;
    
    // Type-safe row mapping
    let out: unknown = mapRowsOutput(def, output as string[][]);
    
    // Use type adapter to safely check normalizeRows setting
    const shouldNormalize = getNormalizeRowsSetting(def, this.cfg.normalizeRows);
    
    if (shouldNormalize) {
      // WHY cast: normalizeRowsToSchema needs the full operation def with output schema
      out = normalizeRowsToSchema(def, out as unknown[]);
    }
    return out;
  }

  validateOutputIfNeeded<TInput extends z.ZodType, TOutput extends z.ZodType>(
    def: OperationDef<TInput, TOutput>,
    output: unknown,
    shouldValidate: boolean,
  ): unknown {
    if (!shouldValidate) return output;
    // Using type adapter for safe schema parsing
    const parsed = safeParseWithSchema(def.output, output);
    if (!parsed.success) {
      throw new OutputValidationError(
        "Output validation failed",
        extractZodIssues(parsed),
        def.name,
      );
    }
    return parsed.data;
  }
}