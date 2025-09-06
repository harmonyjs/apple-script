/**
 * @fileoverview Unit tests for ProtocolParseStep
 */
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ProtocolParseStep } from "./protocol-parse.js";
import type { PipelineContext } from "../pipeline/types.js";

// Helper to create mock context for different operation kinds
function createMockContext(kind: "scalar" | "action" | "rows" | "sections"): PipelineContext {
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
      kind,
      name: "test-operation",
      input: z.object({}),
      output: z.string(),
      script: () => "return 'test'",
    },
    shouldValidate: true,
  };
}

void test("ProtocolParseStep", async (t) => {
  await t.test("parses scalar payload", () => {
    const step = new ProtocolParseStep();
    const context = createMockContext("scalar");
    const payload = "test-scalar-value";
    
    const result = step.execute(payload, context);
    
    assert.equal(result, "test-scalar-value");
  });

  await t.test("parses action payload", () => {
    const step = new ProtocolParseStep();
    const context = createMockContext("action");
    const payload = "action-result";
    
    const result = step.execute(payload, context);
    
    // parseAction should handle the payload (though implementation may vary)
    assert(result !== undefined);
  });

  await t.test("parses rows payload", () => {
    const step = new ProtocolParseStep();
    const context = createMockContext("rows");
    // Mock rows format: rows separated by Record Separator (RS), fields by Unit Separator (US)
    const payload = "row1col1\u001Frow1col2\u001Erow2col1\u001Frow2col2";
    
    const result = step.execute(payload, context);
    
    assert(Array.isArray(result), "Should return array for rows");
  });

  await t.test("parses sections payload", () => {
    const step = new ProtocolParseStep();
    const context = createMockContext("sections");
    // Mock sections format with Group Separator (GS)
    const payload = "section1\u001Dsection2\u001Dsection3";
    
    const result = step.execute(payload, context);
    
    assert(Array.isArray(result), "Should return array for sections");
  });

  await t.test("returns payload as-is for unknown operation kind", () => {
    const step = new ProtocolParseStep();
    // Create context with unknown kind (using type assertion for test)
    const context = {
      ...createMockContext("scalar"),
      operation: {
        ...createMockContext("scalar").operation,
        kind: "unknown" as any,
      },
    };
    const payload = "unchanged-payload";
    
    const result = step.execute(payload, context);
    
    assert.equal(result, "unchanged-payload");
  });

  await t.test("has correct step name", () => {
    const step = new ProtocolParseStep();
    assert.equal(step.name, "ProtocolParse");
  });

  await t.test("handles empty payload gracefully", () => {
    const step = new ProtocolParseStep();
    const context = createMockContext("scalar");
    const payload = "";
    
    const result = step.execute(payload, context);
    
    assert.equal(result, "");
  });
});