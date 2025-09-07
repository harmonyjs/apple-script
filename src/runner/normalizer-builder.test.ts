import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { buildNormalizer } from "../normalization/normalizer-builder.js";

void test("buildNormalizer: number and boolean", () => {
  const obj = z.object({ id: z.number(), active: z.boolean() });
  const norm = buildNormalizer(obj);
  // WHY as any: The normalizer returns unknown but we know the shape for testing
  const out = norm({ id: "42", active: "0" }) as any;
  assert.deepEqual(out, { id: 42, active: false });
});

void test("buildNormalizer: tuple from string", () => {
  const obj = z.object({ t: z.tuple([z.number(), z.boolean(), z.number()]) });
  const norm = buildNormalizer(obj);
  // WHY as any: The normalizer returns unknown but we know the shape for testing
  const out = norm({ t: "{1, 1, 3}" }) as any;
  assert.deepEqual(out, { t: [1, true, 3] });
});

void test("buildNormalizer: array<number> from string", () => {
  const obj = z.object({ ids: z.array(z.number()) });
  const norm = buildNormalizer(obj);
  // WHY as any: The normalizer returns unknown but we know the shape for testing
  const out = norm({ ids: "1, 2, 3" }) as any;
  assert.deepEqual(out, { ids: [1, 2, 3] });
});
