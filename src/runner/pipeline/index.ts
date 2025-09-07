/**
 * @fileoverview Pipeline module exports
 */
export {
  createProcessingPipeline,
  toProcessingConfig,
} from "./processing-pipeline.js";
export type { ProcessingConfig, BuiltScriptContext } from "./types.js";
// Note: Step, PipelineContext, Pipeline, and PipelineBuilder are internal implementation details
