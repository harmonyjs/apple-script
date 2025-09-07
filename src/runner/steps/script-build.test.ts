/**
 * @fileoverview Unit tests for ScriptBuildStep
 */
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ScriptBuildStep } from "./script-build.js";
import type { PipelineContext } from "../pipeline/types.js";

// Helper to create mock context
function createMockContext(options?: {
  timeoutSec?: number;
  controllerTimeoutMs?: number;
}): PipelineContext {
  return {
    config: {
      appId: "com.example.test",
      validateByDefault: true,
      normalizeRows: false,
      defaultTimeoutSec: 30,
      defaultControllerTimeoutMs: 5000,
      timeoutByKind: { scalar: 10 },
      ensureAppReady: true,
    },
    operation: {
      kind: "scalar",
      name: "test-operation",
      input: z.object({ value: z.string() }),
      output: z.string(),
      script: (vars: any) => `return "${vars.value}"`,
      hints: { value: { js: { maxLenKb: 1 } } },
    },
    shouldValidate: true,
    options: {
      timeoutSec: options?.timeoutSec,
      controllerTimeoutMs: options?.controllerTimeoutMs,
    },
  };
}

void test("ScriptBuildStep", async (t) => {
  await t.test("builds script context with correct structure", () => {
    const step = new ScriptBuildStep();
    const context = createMockContext();
    const input = { value: "test-input" };

    const result = step.execute(input, context);

    assert(typeof result === "object");
    assert(Array.isArray(result.params));
    assert(typeof result.timeoutSec === "number");
    assert(typeof result.controllerTimeoutMs === "number");
    assert(typeof result.script === "string");
  });

  await t.test("uses operation-specific timeout from timeoutByKind", () => {
    const step = new ScriptBuildStep();
    const context = createMockContext();
    const input = { value: "test" };

    const result = step.execute(input, context);

    // Should use timeoutByKind.scalar = 10, not defaultTimeoutSec = 30
    assert.equal(result.timeoutSec, 10);
  });

  await t.test("uses options timeout when provided", () => {
    const step = new ScriptBuildStep();
    const context = createMockContext({ timeoutSec: 60 });
    const input = { value: "test" };

    const result = step.execute(input, context);

    // Should use options.timeoutSec = 60
    assert.equal(result.timeoutSec, 60);
  });

  await t.test("uses options controller timeout when provided", () => {
    const step = new ScriptBuildStep();
    const context = createMockContext({ controllerTimeoutMs: 10000 });
    const input = { value: "test" };

    const result = step.execute(input, context);

    assert.equal(result.controllerTimeoutMs, 10000);
  });

  await t.test("uses default controller timeout when not provided", () => {
    const step = new ScriptBuildStep();
    const context = createMockContext();
    const input = { value: "test" };

    const result = step.execute(input, context);

    assert.equal(result.controllerTimeoutMs, 5000);
  });

  await t.test("generates parameters from input", () => {
    const step = new ScriptBuildStep();
    const context = createMockContext();
    const input = { value: "test-value" };

    const result = step.execute(input, context);

    assert(result.params.length > 0);
    const valueParam = result.params.find((p) => p.varName === "value");
    assert(valueParam, "Should have 'value' parameter");
  });

  await t.test("builds complete AppleScript", () => {
    const step = new ScriptBuildStep();
    const context = createMockContext();
    const input = { value: "test" };

    const result = step.execute(input, context);

    assert(typeof result.script === "string");
    assert(result.script.length > 0);
    assert(result.script.includes("com.example.test"), "Should include app ID");
  });

  await t.test("has correct step name", () => {
    const step = new ScriptBuildStep();
    assert.equal(step.name, "ScriptBuild");
  });
});
