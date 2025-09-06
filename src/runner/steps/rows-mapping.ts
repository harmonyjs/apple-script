/**
 * @fileoverview Rows mapping step - maps parsed rows data to objects using operation schema
 * 
 * Why: Single responsibility for row mapping transformation.
 * This step takes string[][] rows data and converts it to objects
 * using the operation's column mapping or schema inference.
 * 
 * Focused version: Only handles rows operations, no type checking needed.
 */
import { mapRowsOutput } from "../map-rows.js";
import type { Step, PipelineContext } from "../pipeline/types.js";

export class RowsMappingStep implements Step<string[][], unknown[]> {
  name = "RowsMapping";
  
  execute(rows: string[][], context: PipelineContext): unknown[] {
    return mapRowsOutput(context.operation, rows);
  }
}