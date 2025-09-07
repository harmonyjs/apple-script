/**
 * @fileoverview Unit tests for InputValidationStep
 */
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { InputValidationStep } from "./input-validation.js";
import { InputValidationError } from "../../errors/validation.js";
import type { PipelineContext } from "../pipeline/types.js";

// Helper to create mock context
function createMockContext(shouldValidate: boolean): PipelineContext {
  return {
    config: {
      appId: "com.example.test",
      validateByDefault: true,
      normalizeRows: false,
      defaultTimeoutSec: 30,
      defaultControllerTimeoutMs: 5000,
      timeoutByKind: {},
      ensureAppReady: true,
    },
    operation: {
      kind: "scalar",
      name: "test-operation",
      input: z.object({ value: z.string() }),
      output: z.string(),
      script: () => "return 'test'",
    },
    shouldValidate,
  };
}

void test("InputValidationStep", async (t) => {
  await t.test("passes through input when validation is disabled", () => {
    const step = new InputValidationStep();
    const context = createMockContext(false);
    const input = { value: "test" };

    const result = step.execute(input, context);

    assert.deepEqual(result, input);
  });

  await t.test("passes valid input when validation is enabled", () => {
    const step = new InputValidationStep();
    const context = createMockContext(true);
    const input = { value: "test" };

    const result = step.execute(input, context);

    assert.deepEqual(result, input);
  });

  await t.test("throws InputValidationError for invalid input", () => {
    const step = new InputValidationStep();
    const context = createMockContext(true);
    const input = { value: 123 }; // Should be string, not number

    assert.throws(
      () => step.execute(input, context),
      (error: unknown) => error instanceof InputValidationError,
    );
  });

  await t.test("includes operation name in error", () => {
    const step = new InputValidationStep();
    const context = createMockContext(true);
    const input = { value: 123 };

    try {
      step.execute(input, context);
      assert.fail("Expected error to be thrown");
    } catch (error) {
      assert(error instanceof InputValidationError);
      assert.equal(error.operationName, "test-operation");
    }
  });

  await t.test("has correct step name", () => {
    const step = new InputValidationStep();
    assert.equal(step.name, "InputValidation");
  });
});
