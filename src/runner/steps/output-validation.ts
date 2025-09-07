/**
 * @fileoverview Output validation step - validates parsed output against operation's schema
 */
import {
  extractZodIssues,
  safeParseWithSchema,
} from "#shared/unsafe-type-casts.js";
import { OutputValidationError } from "../../errors/validation.js";
import type { Step, PipelineContext } from "../pipeline/types.js";

export class OutputValidationStep<T> implements Step<T, T> {
  name = "OutputValidation";

  execute(output: T, context: PipelineContext): T {
    if (!context.shouldValidate) return output;

    const result = safeParseWithSchema(context.operation.output, output);
    if (!result.success) {
      throw new OutputValidationError(
        "Output validation failed",
        extractZodIssues(result),
        context.operation.name,
      );
    }
    return result.data as T;
  }
}
