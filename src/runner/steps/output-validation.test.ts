/**
 * @fileoverview Unit tests for OutputValidationStep
 */
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { OutputValidationStep } from "./output-validation.js";
import { OutputValidationError } from "../../errors/validation.js";
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
      input: z.object({}),
      output: z.object({ 
        result: z.string(),
        count: z.number() 
      }),
      script: () => "return 'test'",
    },
    shouldValidate,
  };
}

void test("OutputValidationStep", async (t) => {
  await t.test("passes through output when validation is disabled", () => {
    const step = new OutputValidationStep();
    const context = createMockContext(false);
    const output = { result: "test", count: 42 };
    
    const result = step.execute(output, context);
    
    assert.deepEqual(result, output);
  });

  await t.test("passes valid output when validation is enabled", () => {
    const step = new OutputValidationStep();
    const context = createMockContext(true);
    const output = { result: "test", count: 42 };
    
    const result = step.execute(output, context);
    
    assert.deepEqual(result, output);
  });

  await t.test("throws OutputValidationError for invalid output", () => {
    const step = new OutputValidationStep();
    const context = createMockContext(true);
    const output = { result: "test", count: "not-a-number" }; // Should be number, not string
    
    assert.throws(
      () => step.execute(output, context),
      (error: unknown) => error instanceof OutputValidationError
    );
  });

  await t.test("includes operation name in error", () => {
    const step = new OutputValidationStep();
    const context = createMockContext(true);
    const output = { result: "test", count: "invalid" };
    
    try {
      step.execute(output, context);
      assert.fail("Expected error to be thrown");
    } catch (error) {
      assert(error instanceof OutputValidationError);
      assert.equal(error.operationName, "test-operation");
    }
  });

  await t.test("validates missing required fields", () => {
    const step = new OutputValidationStep();
    const context = createMockContext(true);
    const output = { result: "test" }; // Missing 'count' field
    
    assert.throws(
      () => step.execute(output, context),
      (error: unknown) => error instanceof OutputValidationError
    );
  });

  await t.test("validates extra fields according to schema", () => {
    const step = new OutputValidationStep();
    const context = createMockContext(true);
    const output = { 
      result: "test", 
      count: 42, 
      extra: "should-be-ignored-or-cause-error" 
    };
    
    // Behavior depends on Zod schema strictness
    // This test ensures the validation step is called
    const result = step.execute(output, context);
    
    // If no error is thrown, validation passed (Zod allows extra fields by default)
    assert(result !== undefined);
  });

  await t.test("returns validated data when validation passes", () => {
    const step = new OutputValidationStep();
    const context = createMockContext(true);
    const output = { result: "test", count: 42 };
    
    const result = step.execute(output, context);
    
    // Should return the validated data (potentially transformed by Zod)
    assert(typeof result === "object");
    assert.equal((result as any).result, "test");
    assert.equal((result as any).count, 42);
  });

  await t.test("handles null and undefined gracefully in validation", () => {
    const step = new OutputValidationStep();
    const context = createMockContext(true);
    
    assert.throws(
      () => step.execute(null, context),
      (error: unknown) => error instanceof OutputValidationError
    );
    
    assert.throws(
      () => step.execute(undefined, context),
      (error: unknown) => error instanceof OutputValidationError
    );
  });

  await t.test("has correct step name", () => {
    const step = new OutputValidationStep();
    assert.equal(step.name, "OutputValidation");
  });
});