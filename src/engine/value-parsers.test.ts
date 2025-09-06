import test from "node:test";
import assert from "node:assert/strict";
import {
  coerceToNumber,
  coerceToBoolean,
  parseAppleScriptList,
} from "./value-parsers.js";

void test("coerceToNumber: numbers and numeric strings", () => {
  assert.equal(coerceToNumber(42), 42);
  assert.equal(coerceToNumber(" 42 "), 42);
  assert.equal(coerceToNumber("-3.5"), -3.5);
  assert.equal(coerceToNumber(""), "");
  assert.equal(coerceToNumber("abc"), "abc");
});

void test("coerceToBoolean: booleans, numbers, and strings", () => {
  assert.equal(coerceToBoolean(true), true);
  assert.equal(coerceToBoolean(false), false);
  assert.equal(coerceToBoolean(1), true);
  assert.equal(coerceToBoolean(0), false);
  assert.equal(coerceToBoolean("true"), true);
  assert.equal(coerceToBoolean("false"), false);
  assert.equal(coerceToBoolean("1"), true);
  assert.equal(coerceToBoolean("0"), false);
  // Unknown strings pass through unchanged
  assert.equal(coerceToBoolean("yes"), "yes");
});

void test("parseAppleScriptList: parses list and csv strings", () => {
  assert.deepEqual(parseAppleScriptList("{1, 2, 3}"), ["1", "2", "3"]);
  assert.deepEqual(parseAppleScriptList("1,2,3"), ["1", "2", "3"]);
  assert.deepEqual(parseAppleScriptList('{ "a", "b" }'), ["a", "b"]);
  assert.deepEqual(parseAppleScriptList("[1, 2]"), ["1", "2"]);
});
