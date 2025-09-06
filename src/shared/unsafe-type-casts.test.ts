import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  hasProperty,
  extractErrorCode,
  buildVarsMap,
  getObjectProperty,
  getNormalizeRowsSetting,
  safeParseWithSchema,
} from "#shared/unsafe-type-casts.js";

void test("hasProperty: narrows unknown objects", () => {
  const x: unknown = { a: 1 };
  assert.equal(hasProperty(x, "a"), true);
  if (hasProperty(x, "a")) {
    assert.equal(typeof x.a, "number");
  }
  assert.equal(hasProperty(null, "a"), false);
  assert.equal(hasProperty(undefined, "a"), false);
});

void test("extractErrorCode: reads code at top-level and from cause chain", () => {
  assert.equal(extractErrorCode({ code: 123 }), 123);
  assert.equal(extractErrorCode({ cause: { code: 456 } }), 456);
  assert.equal(extractErrorCode({ cause: {} }), undefined);
  assert.equal(extractErrorCode({}), undefined);
});

void test("buildVarsMap: creates name→var mapping", () => {
  const params = [
    { paramName: "x", varName: "v1" },
    { paramName: "y", varName: "v2" },
  ];
  assert.deepEqual(buildVarsMap(params), { x: "v1", y: "v2" });
});

void test("getObjectProperty: indexes with dynamic key", () => {
  const obj: Record<string, unknown> = { foo: 42 };
  const v = getObjectProperty<number>(obj, "foo");
  assert.equal(v, 42);
});

void test("getNormalizeRowsSetting: respects flag or default", () => {
  assert.equal(getNormalizeRowsSetting({ normalizeRows: true }, false), true);
  assert.equal(getNormalizeRowsSetting({ normalizeRows: false }, true), false);
  assert.equal(getNormalizeRowsSetting({}, true), true);
});

void test("safeParseWithSchema: works with zod generics", () => {
  const schema = z.object({ n: z.number() });
  const ok = safeParseWithSchema(schema, { n: 1 });
  assert.equal(ok.success, true);
  const bad = safeParseWithSchema(schema, { n: "x" });
  assert.equal(bad.success, false);
});
