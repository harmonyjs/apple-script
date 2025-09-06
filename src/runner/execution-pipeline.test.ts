import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { OperationDef } from "../operations/types.js";
import { ExecutionPipeline } from "./execution-pipeline.js";

function makeRowsDef(
  overrides: Partial<OperationDef<any, any>> = {},
): OperationDef<any, any> {
  return {
    kind: "rows",
    name: "rows-op",
    input: z.object({}),
    output: z.array(z.object({ n: z.number() })),
    script: () => "return {}",
    ...overrides,
  // WHY as any: We're creating a partial mock of OperationDef for testing.
  // Only the properties needed for postProcessRows are included.
  } as any;
}

function pipelineCfg(normalizeRows: boolean) {
  return {
    appId: "com.example.app",
    ensureAppReady: false,
    validateByDefault: true,
    normalizeRows,
    defaultTimeoutSec: 10,
    defaultControllerTimeoutMs: 10000,
    timeoutByKind: {},
  } as const;
}

void test("postProcessRows: global normalizeRows=false -> no normalization", () => {
  const p = new ExecutionPipeline(pipelineCfg(false));
  const def = makeRowsDef();
  const rows = [["42"]];
  // Type assertion is safe here - def matches OperationDef interface
  const out = p.postProcessRows(def, rows);
  assert.deepEqual(out, [{ n: "42" }]); // mapped but not normalized
});

void test("postProcessRows: global true + per-op normalizeRows=false -> no normalization", () => {
  const p = new ExecutionPipeline(pipelineCfg(true));
  const def = makeRowsDef({ normalizeRows: false });
  const rows = [["42"]];
  // Type assertion is safe here - def matches OperationDef interface
  const out = p.postProcessRows(def, rows);
  assert.deepEqual(out, [{ n: "42" }]);
});

void test("postProcessRows: global false + per-op normalizeRows=true -> normalization applied", () => {
  const p = new ExecutionPipeline(pipelineCfg(false));
  const def = makeRowsDef({ normalizeRows: true });
  const rows = [["42"]];
  // Type assertion is safe here - def matches OperationDef interface
  const out = p.postProcessRows(def, rows) as Array<{ n: number }>;
  assert.deepEqual(out, [{ n: 42 }]);
});