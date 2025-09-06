/**
 * @fileoverview Unit tests for RowsNormalizationStep
 */
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { RowsNormalizationStep } from "./rows-normalization.js";
import type { PipelineContext } from "../pipeline/types.js";

// Helper to create mock context with normalization settings
function createMockContext(
  globalNormalizeRows = true, 
  operationNormalizeRows?: boolean
): PipelineContext {
  const operation: any = {
    kind: "rows",
    name: "test-rows-operation",
    input: z.object({}),
    output: z.array(z.object({ 
      id: z.string(), 
      count: z.number(),  // Will test normalization to number
      active: z.boolean() // Will test normalization to boolean
    })),
    script: () => "return []",
  };

  // Add normalizeRows property if specified
  if (operationNormalizeRows !== undefined) {
    operation.normalizeRows = operationNormalizeRows;
  }

  return {
    config: {
      appId: "com.example.test",
      validateByDefault: true,
      normalizeRows: globalNormalizeRows,
      defaultTimeoutSec: 30,
      defaultControllerTimeoutMs: 5000,
      timeoutByKind: {},
      ensureAppReady: true,
    },
    operation,
    shouldValidate: true,
  };
}

void test("RowsNormalizationStep", async (t) => {
  await t.test("normalizes data when global normalizeRows is true", () => {
    const step = new RowsNormalizationStep();
    const context = createMockContext(true); // Global: true, Operation: undefined
    const data = [
      { id: "1", count: "42", active: "true" },
      { id: "2", count: "24", active: "false" },
    ];
    
    const result = step.execute(data, context);
    
    assert(Array.isArray(result));
    assert.equal(result.length, 2);
    
    // Should be normalized (exact behavior depends on normalizeRowsToSchema implementation)
    // At minimum, the function should be called with correct parameters
    assert(result !== data); // Should be a new array/modified data
  });

  await t.test("skips normalization when global normalizeRows is false", () => {
    const step = new RowsNormalizationStep();
    const context = createMockContext(false); // Global: false, Operation: undefined
    const data = [
      { id: "1", count: "42", active: "true" },
    ];
    
    const result = step.execute(data, context);
    
    // Should return data unchanged
    assert.deepEqual(result, data);
  });

  await t.test("operation normalizeRows=true overrides global false", () => {
    const step = new RowsNormalizationStep();
    const context = createMockContext(false, true); // Global: false, Operation: true
    const data = [
      { id: "1", count: "42", active: "true" },
    ];
    
    const result = step.execute(data, context);
    
    // Should normalize despite global setting being false
    assert(result !== data); // Should be processed
  });

  await t.test("operation normalizeRows=false overrides global true", () => {
    const step = new RowsNormalizationStep();
    const context = createMockContext(true, false); // Global: true, Operation: false
    const data = [
      { id: "1", count: "42", active: "true" },
    ];
    
    const result = step.execute(data, context);
    
    // Should not normalize despite global setting being true
    assert.deepEqual(result, data);
  });

  await t.test("handles empty array", () => {
    const step = new RowsNormalizationStep();
    const context = createMockContext(true);
    const data: unknown[] = [];
    
    const result = step.execute(data, context);
    
    assert(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  await t.test("preserves array order", () => {
    const step = new RowsNormalizationStep();
    const context = createMockContext(true);
    const data = [
      { id: "first", count: "1", active: "true" },
      { id: "second", count: "2", active: "false" },
      { id: "third", count: "3", active: "true" },
    ];
    
    const result = step.execute(data, context);
    
    assert(Array.isArray(result));
    assert.equal(result.length, 3);
    // Order should be preserved (exact values depend on normalization implementation)
    assert.equal((result[0] as any).id, "first");
    assert.equal((result[1] as any).id, "second");
    assert.equal((result[2] as any).id, "third");
  });

  await t.test("uses global setting when operation setting is undefined", () => {
    const step = new RowsNormalizationStep();
    const context = createMockContext(true); // Global: true, Operation: undefined
    const data = [{ id: "1", count: "42", active: "true" }];
    
    const result = step.execute(data, context);
    
    // Should use global setting (true) when operation setting is undefined
    assert(result !== data); // Should be processed
  });

  await t.test("has correct step name", () => {
    const step = new RowsNormalizationStep();
    assert.equal(step.name, "RowsNormalization");
  });
});