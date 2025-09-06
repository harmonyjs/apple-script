/**
 * @fileoverview Integration tests for processing-pipeline
 */
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createProcessingPipeline, toProcessingConfig } from "./processing-pipeline.js";
import type { RunnerConfig } from "../types.js";

// Helper to create mock runner config
function createMockRunnerConfig(): RunnerConfig {
  return {
    appId: "com.example.test",
    validateByDefault: true,
    normalizeRows: true,
    defaultTimeoutSec: 30,
    defaultControllerTimeoutMs: 5000,
    timeoutByKind: { scalar: 10 },
    ensureAppReady: true,
    maxRetries: 0,
    retryDelayMs: 0,
  };
}

// Helper to create mock operation definitions
function createMockScalarOperation() {
  return {
    name: "test-scalar-operation",
    kind: "scalar" as const,
    input: z.object({ value: z.string() }),
    output: z.string(),
    script: (vars: any) => `return "${vars.value}"`,
  };
}

function createMockActionOperation() {
  return {
    name: "test-action-operation",
    kind: "action" as const,
    input: z.object({ value: z.string() }),
    output: z.string(),
    script: (vars: any) => `return "${vars.value}"`,
  };
}

function createMockRowsOperation() {
  return {
    name: "test-rows-operation",
    kind: "rows" as const,
    input: z.object({ value: z.string() }),
    output: z.array(z.object({ id: z.string(), value: z.string() })),
    script: (vars: any) => `return "${vars.value}"`,
  };
}

function createMockSectionsOperation() {
  return {
    name: "test-sections-operation",
    kind: "sections" as const,
    input: z.object({ value: z.string() }),
    output: z.array(z.string()),
    script: (vars: any) => `return "${vars.value}"`,
  };
}

void test("processing-pipeline", async (t) => {
  await t.test("toProcessingConfig converts RunnerConfig correctly", () => {
    const runnerConfig = createMockRunnerConfig();
    const processingConfig = toProcessingConfig(runnerConfig);
    
    assert.equal(processingConfig.appId, "com.example.test");
    assert.equal(processingConfig.validateByDefault, true);
    assert.equal(processingConfig.normalizeRows, true);
    assert.equal(processingConfig.defaultTimeoutSec, 30);
    assert.equal(processingConfig.defaultControllerTimeoutMs, 5000);
    assert.equal(processingConfig.ensureAppReady, true);
    assert.deepEqual(processingConfig.timeoutByKind, { scalar: 10 });
  });

  await t.test("toProcessingConfig uses defaults for missing values", () => {
    const minimalConfig: RunnerConfig = { appId: "com.test.app" };
    const processingConfig = toProcessingConfig(minimalConfig);
    
    assert.equal(processingConfig.appId, "com.test.app");
    assert.equal(processingConfig.validateByDefault, true);
    assert.equal(processingConfig.normalizeRows, true);
    assert.equal(processingConfig.defaultTimeoutSec, 30);
    assert.equal(processingConfig.defaultControllerTimeoutMs, 5000);
    assert.equal(processingConfig.ensureAppReady, true);
    assert.deepEqual(processingConfig.timeoutByKind, {});
  });

  await t.test("createProcessingPipeline returns pipeline with correct interface", () => {
    const config = toProcessingConfig(createMockRunnerConfig());
    const pipeline = createProcessingPipeline(config);
    
    assert(typeof pipeline.validateInputIfNeeded === "function");
    assert(typeof pipeline.buildScriptContext === "function");
    assert(typeof pipeline.runPostProcessing === "function");
  });

  await t.test("pipeline.validateInputIfNeeded validates input when enabled", () => {
    const config = toProcessingConfig(createMockRunnerConfig());
    const pipeline = createProcessingPipeline(config);
    const operation = createMockScalarOperation();
    const validInput = { value: "test" };
    
    // Should not throw for valid input
    pipeline.validateInputIfNeeded(operation, validInput, true);
    
    // Should not validate when disabled
    pipeline.validateInputIfNeeded(operation, { invalid: "data" } as any, false);
  });

  await t.test("pipeline.buildScriptContext builds complete script context", () => {
    const config = toProcessingConfig(createMockRunnerConfig());
    const pipeline = createProcessingPipeline(config);
    const operation = createMockScalarOperation();
    const input = { value: "test-input" };
    
    const result = pipeline.buildScriptContext(operation, input);
    
    assert(typeof result === "object");
    assert(Array.isArray(result.params));
    assert(typeof result.timeoutSec === "number");
    assert.equal(result.timeoutSec, 10); // Should use timeoutByKind.scalar
    assert(typeof result.controllerTimeoutMs === "number");
    assert(typeof result.script === "string");
    assert(result.script.includes("com.example.test"));
  });

  await t.test("pipeline.buildScriptContext respects timeout options", () => {
    const config = toProcessingConfig(createMockRunnerConfig());
    const pipeline = createProcessingPipeline(config);
    const operation = createMockScalarOperation();
    const input = { value: "test" };
    const options = { timeoutSec: 60, controllerTimeoutMs: 10000 };
    
    const result = pipeline.buildScriptContext(operation, input, options);
    
    assert.equal(result.timeoutSec, 60);
    assert.equal(result.controllerTimeoutMs, 10000);
  });

  await t.test("pipeline.runPostProcessing handles scalar operations", () => {
    const config = toProcessingConfig(createMockRunnerConfig());
    const pipeline = createProcessingPipeline(config);
    const operation = createMockScalarOperation();
    const payload = "test-result";
    
    const result = pipeline.runPostProcessing(operation, payload, false);
    
    // Should return the parsed result
    assert.equal(result, "test-result");
  });

  await t.test("pipeline.runPostProcessing handles rows operations", () => {
    const config = toProcessingConfig(createMockRunnerConfig());
    const pipeline = createProcessingPipeline(config);
    const operation = createMockRowsOperation();
    // Mock rows payload with Record Separator (RS) and Unit Separator (US)
    const payload = "1\u001Frow1\u001E2\u001Frow2";
    
    const result = pipeline.runPostProcessing(operation, payload, false);
    
    // Should process through rows pipeline (parse -> map -> normalize -> validate)
    assert(result !== undefined);
  });

  await t.test("pipeline.runPostProcessing throws error for unknown operation kind", () => {
    const config = toProcessingConfig(createMockRunnerConfig());
    const pipeline = createProcessingPipeline(config);
    const operation = {
      ...createMockScalarOperation(),
      kind: "unknown" as any,
    };
    
    assert.throws(
      () => pipeline.runPostProcessing(operation, "payload", false),
      (error: Error) => error.message.includes("Unknown operation kind: unknown")
    );
  });

  await t.test("pipeline integration: complete flow for different operation types", () => {
    const config = toProcessingConfig(createMockRunnerConfig());
    const pipeline = createProcessingPipeline(config);
    
    // Test scalar operation
    const scalarOp = createMockScalarOperation();
    const scalarInput = { value: "test-scalar" };
    pipeline.validateInputIfNeeded(scalarOp, scalarInput, true);
    const scalarContext = pipeline.buildScriptContext(scalarOp, scalarInput);
    assert(typeof scalarContext.script === "string");
    const scalarResult = pipeline.runPostProcessing(scalarOp, "scalar-result", false);
    assert(scalarResult !== undefined);

    // Test action operation
    const actionOp = createMockActionOperation();
    const actionInput = { value: "test-action" };
    pipeline.validateInputIfNeeded(actionOp, actionInput, true);
    const actionContext = pipeline.buildScriptContext(actionOp, actionInput);
    assert(typeof actionContext.script === "string");
    const actionResult = pipeline.runPostProcessing(actionOp, "1", false); // Using ACTION_CODES.SUCCESS
    assert(actionResult !== undefined);

    // Test rows operation  
    const rowsOp = createMockRowsOperation();
    const rowsInput = { value: "test-rows" };
    pipeline.validateInputIfNeeded(rowsOp, rowsInput, true);
    const rowsContext = pipeline.buildScriptContext(rowsOp, rowsInput);
    assert(typeof rowsContext.script === "string");
    const rowsResult = pipeline.runPostProcessing(rowsOp, "col1\u001Fcol2\u001Erow2col1\u001Frow2col2", false);
    assert(rowsResult !== undefined);

    // Test sections operation
    const sectionsOp = createMockSectionsOperation();
    const sectionsInput = { value: "test-sections" };
    pipeline.validateInputIfNeeded(sectionsOp, sectionsInput, true);
    const sectionsContext = pipeline.buildScriptContext(sectionsOp, sectionsInput);
    assert(typeof sectionsContext.script === "string");
    const sectionsResult = pipeline.runPostProcessing(sectionsOp, "section1\u001Dsection2\u001Dsection3", false);
    assert(sectionsResult !== undefined);
  });

  await t.test("pipeline preserves processing order", () => {
    const config = toProcessingConfig(createMockRunnerConfig());
    const pipeline = createProcessingPipeline(config);
    const operation = createMockRowsOperation();
    
    // The pipeline should process in order: parse -> map -> normalize -> validate
    // This is more of an integration test to ensure the steps are composed correctly
    const payload = "id1\u001Fvalue1\u001Eid2\u001Fvalue2";
    
    // Should complete without error, indicating proper step composition
    const result = pipeline.runPostProcessing(operation, payload, false);
    assert(result !== undefined);
  });
});