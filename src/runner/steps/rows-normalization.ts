/**
 * @fileoverview Rows normalization step - normalizes mapped row data to match schema types
 * 
 * Why: Single responsibility for type normalization.
 * This step converts string values to proper types (numbers, booleans, arrays, etc.)
 * based on the operation's output schema when normalization is enabled.
 * 
 * Focused version: Only handles rows operations, no type checking needed.
 */
import { normalizeRowsToSchema } from "../../normalization/normalize-rows.js";
import { getNormalizeRowsSetting } from "#shared/unsafe-type-casts.js";
import type { Step, PipelineContext } from "../pipeline/types.js";

export class RowsNormalizationStep implements Step<unknown[], unknown[]> {
  name = "RowsNormalization";
  
  execute(data: unknown[], context: PipelineContext): unknown[] {
    const shouldNormalize = getNormalizeRowsSetting(context.operation, context.config.normalizeRows);
    
    return shouldNormalize 
      ? normalizeRowsToSchema(context.operation, data)
      : data;
  }
}