import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  unwrapZodSchema,
  extractObjectShape,
  getArrayElementSchema,
  getTupleItemSchemas,
} from "./zod-introspection.js";

void test("unwrapZodSchema: unwraps optional/nullable/default/effects", () => {
  const base = z.number();
  const schema = z
    .optional(z.nullable(base))
    .default(1)
    .transform((x) => x);
  const unwrapped = unwrapZodSchema(schema);
  assert.equal(unwrapped.constructor.name, "ZodNumber");
});

void test("extractObjectShape: returns shape map for objects", () => {
  const obj = z.object({ a: z.string(), b: z.number() });
  const shape = extractObjectShape(obj);
  assert.ok(shape);
  assert.equal(Object.keys(shape!).join(","), "a,b");
});

void test("getArrayElementSchema: returns element for array", () => {
  const arr = z.array(z.string());
  const el = getArrayElementSchema(arr);
  assert.equal(el.constructor.name, "ZodString");
});

void test("getTupleItemSchemas: returns items for tuple", () => {
  const tup = z.tuple([z.string(), z.number()]);
  const items = getTupleItemSchemas(tup);
  assert.equal(items.length, 2);
  assert.equal(items[0].constructor.name, "ZodString");
  assert.equal(items[1].constructor.name, "ZodNumber");
});
