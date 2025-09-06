import test from "node:test";
import assert from "node:assert/strict";
import { describeSchema } from "./debug.js";

void test("describeSchema: shows ctor and typeName when present", () => {
  // Mimic a zod-like object with _def.typeName
  const obj = { _def: { typeName: "ZodObject", other: 1 } };
  const out = describeSchema(obj);
  assert.match(out, /Object\/ZodObject/);
  assert.match(out, /defKeys=/);
});

void test("describeSchema: handles object without _def", () => {
  const obj = { a: 1 };
  const out = describeSchema(obj);
  assert.match(out, /Object/);
});

void test("describeSchema: handles non-object gracefully", () => {
  const out = describeSchema(42);
  assert.equal(typeof out, "string");
  assert.match(out, /Number|42/);
});
