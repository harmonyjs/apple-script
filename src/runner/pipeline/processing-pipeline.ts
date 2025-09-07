/**
 * @fileoverview Factory for creating processing pipelines using generalized composition
 *
 * Why: Provides clean pipeline factory focused on the three core operations needed by AppleRunner.
 * Creates specialized pipelines for different operation types with proper type flow.
 */
import { z } from "zod";
import type { RunnerConfig } from "../types.js";
import type { OperationDef, RunOptions } from "../../operations/types.js";
import type {
  ProcessingConfig,
  PipelineContext,
  BuiltScriptContext,
  Step,
} from "./types.js";
import {
  InputValidationStep,
  ScriptBuildStep,
  ProtocolParseStep,
  RowsMappingStep,
  RowsNormalizationStep,
  OutputValidationStep,
} from "../steps/index.js";

/**
 * Generic pipeline that chains steps together with type flow
 *
 * Why: Internal implementation for composing processing steps.
 * Not exported to keep the public API surface minimal.
 */
class Pipeline<TStart, TEnd> {
  constructor(private steps: Array<Step<any, any>>) {}

  execute(input: TStart, context: PipelineContext): TEnd {
    let result: any = input;
    for (const step of this.steps) {
      result = step.execute(result, context);
    }
    // WHY as TEnd: TypeScript cannot infer the final type through step composition
    // This is safe because the pipeline is constructed with proper type flow
    return result as TEnd;
  }
}

/**
 * Builder for creating type-safe pipelines
 *
 * Why: Internal helper for fluent pipeline construction.
 * Not exported to keep implementation details private.
 */
class PipelineBuilder<TInput> {
  private steps: Array<Step<any, any>> = [];

  addStep<TOutput>(step: Step<any, TOutput>): PipelineBuilder<TOutput> {
    this.steps.push(step);
    // WHY as any: TypeScript limitation with method chaining and conditional types
    // This is safe because we maintain type flow through the builder pattern
    return this as any;
  }

  build<TOutput = TInput>(): Pipeline<TInput, TOutput> {
    return new Pipeline<TInput, TOutput>([...this.steps]);
  }
}

/**
 * Creates context for pipeline step execution
 *
 * Why: Centralizes context creation to avoid duplication and ensure consistency
 */
function createContext(
  config: ProcessingConfig,
  operation: OperationDef<any, any>,
  shouldValidate: boolean,
  options?: RunOptions,
): PipelineContext {
  return { config, operation, shouldValidate, options };
}

// Factory function to create pipelines using generalized composition
export function createProcessingPipeline(cfg: ProcessingConfig) {
  // Create reusable step instances
  const inputValidation = new InputValidationStep();
  const scriptBuild = new ScriptBuildStep();
  const protocolParse = new ProtocolParseStep();
  const rowsMapping = new RowsMappingStep();
  const rowsNormalization = new RowsNormalizationStep();
  const outputValidation = new OutputValidationStep();

  // Build specialized pipelines for different operation types
  const scalarPipeline = new PipelineBuilder<string>()
    .addStep(protocolParse)
    .addStep(outputValidation)
    .build();

  const actionPipeline = new PipelineBuilder<string>()
    .addStep(protocolParse)
    .addStep(outputValidation)
    .build();

  const rowsPipeline = new PipelineBuilder<string>()
    .addStep(protocolParse)
    .addStep(rowsMapping)
    .addStep(rowsNormalization)
    .addStep(outputValidation)
    .build();

  const sectionsPipeline = new PipelineBuilder<string>()
    .addStep(protocolParse)
    .addStep(outputValidation)
    .build();

  // Registry pattern for operation type to pipeline mapping
  // Why: Replaces switch statement to follow Open/Closed principle
  // and make adding new operation types easier
  const pipelineRegistry = {
    scalar: scalarPipeline,
    action: actionPipeline,
    rows: rowsPipeline,
    sections: sectionsPipeline,
  } as const;

  return {
    validateInputIfNeeded<TInput extends z.ZodType, TOutput extends z.ZodType>(
      def: OperationDef<TInput, TOutput>,
      input: z.infer<TInput>,
      shouldValidate: boolean,
    ): void {
      const context = createContext(cfg, def, shouldValidate);
      inputValidation.execute(input, context);
    },

    buildScriptContext<TInput extends z.ZodType, TOutput extends z.ZodType>(
      def: OperationDef<TInput, TOutput>,
      input: z.infer<TInput>,
      options?: RunOptions,
    ): BuiltScriptContext {
      const context = createContext(cfg, def, false, options);
      return scriptBuild.execute(input, context);
    },

    runPostProcessing<
      TInput extends z.ZodType,
      TOutput extends z.ZodType,
      TValidate extends boolean,
    >(
      def: OperationDef<TInput, TOutput>,
      payload: string,
      shouldValidate: TValidate,
    ): TValidate extends true ? z.infer<TOutput> : unknown {
      const context = createContext(cfg, def, shouldValidate);

      // Use registry to get appropriate pipeline based on operation kind
      const pipeline = pipelineRegistry[def.kind];
      if (!pipeline) {
        throw new Error(
          `Unknown operation kind: ${def.kind}. Supported kinds: ${Object.keys(pipelineRegistry).join(", ")}`,
        );
      }

      // WHY as any: TypeScript cannot track the exact return type through the registry lookup
      // This is safe because each pipeline in the registry has the correct input/output types
      return pipeline.execute(payload, context) as any;
    },
  } as const;
}

export function toProcessingConfig(
  cfg: RunnerConfig & { ensureAppReady?: boolean },
): ProcessingConfig {
  return {
    appId: cfg.appId,
    validateByDefault: cfg.validateByDefault ?? true,
    normalizeRows: cfg.normalizeRows ?? true,
    defaultTimeoutSec: cfg.defaultTimeoutSec ?? 30,
    defaultControllerTimeoutMs: cfg.defaultControllerTimeoutMs ?? 5000,
    timeoutByKind: cfg.timeoutByKind ?? {},
    ensureAppReady: cfg.ensureAppReady ?? true,
  };
}
