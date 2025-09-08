import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  asBoolean,
  asNumber,
  asArray,
  asTuple,
  asBounds,
  asRecord,
} from "./schemas.js";

void test("asBoolean: accepts boolean, numeric, and string representations", () => {
  assert.equal(asBoolean.parse(true), true);
  assert.equal(asBoolean.parse(false), false);
  assert.equal(asBoolean.parse(1), true);
  assert.equal(asBoolean.parse(0), false);
  assert.equal(asBoolean.parse("true"), true);
  assert.equal(asBoolean.parse("false"), false);
  assert.equal(asBoolean.parse("1"), true);
  assert.equal(asBoolean.parse("0"), false);
});

void test("asNumber: parses numeric strings", () => {
  assert.equal(asNumber.parse(42), 42);
  assert.equal(asNumber.parse("42"), 42);
  assert.equal(asNumber.parse("  -3.5 "), -3.5);
});

void test("asArray<number>: parses AppleScript list strings and CSV", () => {
  const schema = asArray(asNumber);
  assert.deepEqual(schema.parse([1, 2, 3]), [1, 2, 3]);
  assert.deepEqual(schema.parse("{1, 2, 3}"), [1, 2, 3]);
  assert.deepEqual(schema.parse("4,5,6"), [4, 5, 6]);
});

void test("asTuple: parses tuple from list string", () => {
  const t = asTuple([asNumber, asBoolean, asNumber]);
  assert.deepEqual(t.parse([1, true, 3]), [1, true, 3]);
  assert.deepEqual(t.parse("{1, 0, 3}"), [1, false, 3]);
});

void test("asBounds: parses common bounds string", () => {
  assert.deepEqual(
    asBounds.parse("{100, 200, 1280, 720}"),
    [100, 200, 1280, 720],
  );
});

void test("asRecord: wraps number/boolean fields with coercers", () => {
  const rec = asRecord({
    id: z.number(),
    active: z.boolean(),
    title: z.string(),
  });
  const out = rec.parse({ id: "7", active: "0", title: "Hello" });
  assert.deepEqual(out, { id: 7, active: false, title: "Hello" });
});

void test("asRecord: is strict by default - rejects unknown keys", () => {
  const rec = asRecord({
    id: z.number(),
    active: z.boolean(),
    title: z.string(),
  });
  
  // Should throw on unknown keys
  assert.throws(() => {
    rec.parse({ id: "7", active: "0", title: "Hello", extra: "unknown" });
  }, {
    name: "ZodError",
    message: /unrecognized key/i,
  });
});

void test("asRecord: can be made non-strict with .strip() or .passthrough()", () => {
  const rec = asRecord({
    id: z.number(),
    active: z.boolean(),
    title: z.string(),
  });
  
  // Using .strip() removes unknown keys
  const stripped = rec.strip();
  const outStripped = stripped.parse({ id: "7", active: "0", title: "Hello", extra: "unknown" });
  assert.deepEqual(outStripped, { id: 7, active: false, title: "Hello" });
  
  // Using .passthrough() keeps unknown keys
  const passthrough = rec.passthrough();
  const outPassthrough = passthrough.parse({ id: "7", active: "0", title: "Hello", extra: "unknown" });
  assert.deepEqual(outPassthrough, { id: 7, active: false, title: "Hello", extra: "unknown" });
});
