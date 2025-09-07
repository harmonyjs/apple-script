/**
 * @fileoverview Input validation step - validates input against operation's Zod schema
 */
import {
  extractZodIssues,
  safeParseWithSchema,
} from "#shared/unsafe-type-casts.js";
import { InputValidationError } from "../../errors/validation.js";
import type { Step, PipelineContext } from "../pipeline/types.js";

export class InputValidationStep<T> implements Step<T, T> {
  name = "InputValidation";

  execute(input: T, context: PipelineContext): T {
    if (!context.shouldValidate) return input;

    const result = safeParseWithSchema(context.operation.input, input);
    if (!result.success) {
      throw new InputValidationError(
        "Input validation failed",
        extractZodIssues(result),
        context.operation.name,
      );
    }
    return input;
  }
}
