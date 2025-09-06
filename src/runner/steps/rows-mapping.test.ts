/**
 * @fileoverview Unit tests for RowsMappingStep
 */
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { RowsMappingStep } from "./rows-mapping.js";
import type { PipelineContext } from "../pipeline/types.js";

// Helper to create mock context for rows operation
function createMockContext(): PipelineContext {
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
      kind: "rows",
      name: "test-rows-operation",
      input: z.object({}),
      output: z.array(z.object({ 
        id: z.string(), 
        name: z.string(),
        count: z.number() 
      })),
      script: () => "return []",
    },
    shouldValidate: true,
  };
}

void test("RowsMappingStep", async (t) => {
  await t.test("maps string rows to objects using schema", () => {
    const step = new RowsMappingStep();
    const context = createMockContext();
    const rows = [
      ["1", "first", "42"],
      ["2", "second", "24"],
    ];
    
    const result = step.execute(rows, context);
    
    assert(Array.isArray(result));
    assert.equal(result.length, 2);
    
    // Check first row mapping
    const firstRow = result[0] as any;
    assert.equal(firstRow.id, "1");
    assert.equal(firstRow.name, "first");
    assert.equal(firstRow.count, "42"); // Still string before normalization
  });

  await t.test("handles empty rows array", () => {
    const step = new RowsMappingStep();
    const context = createMockContext();
    const rows: string[][] = [];
    
    const result = step.execute(rows, context);
    
    assert(Array.isArray(result));
    assert.equal(result.length, 0);
  });

  await t.test("handles rows with different column counts", () => {
    const step = new RowsMappingStep();
    const context = createMockContext();
    const rows = [
      ["1", "first"],           // Missing third column
      ["2", "second", "24", "extra"], // Extra column
    ];
    
    const result = step.execute(rows, context);
    
    assert(Array.isArray(result));
    assert.equal(result.length, 2);
    
    // Should handle gracefully (mapRowsOutput implementation determines exact behavior)
    assert(typeof result[0] === "object");
    assert(typeof result[1] === "object");
  });

  await t.test("maps single row correctly", () => {
    const step = new RowsMappingStep();
    const context = createMockContext();
    const rows = [["single", "row", "123"]];
    
    const result = step.execute(rows, context);
    
    assert(Array.isArray(result));
    assert.equal(result.length, 1);
    
    const mappedRow = result[0] as any;
    assert.equal(mappedRow.id, "single");
    assert.equal(mappedRow.name, "row");
    assert.equal(mappedRow.count, "123");
  });

  await t.test("preserves row order", () => {
    const step = new RowsMappingStep();
    const context = createMockContext();
    const rows = [
      ["first", "a", "1"],
      ["second", "b", "2"],
      ["third", "c", "3"],
    ];
    
    const result = step.execute(rows, context);
    
    assert.equal(result.length, 3);
    assert.equal((result[0] as any).id, "first");
    assert.equal((result[1] as any).id, "second");
    assert.equal((result[2] as any).id, "third");
  });

  await t.test("has correct step name", () => {
    const step = new RowsMappingStep();
    assert.equal(step.name, "RowsMapping");
  });
});