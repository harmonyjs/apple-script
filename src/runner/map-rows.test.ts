import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { mapRowsOutput, type RowsLikeDef } from "./map-rows.js";

test("mapRowsOutput: columns mapping", () => {
  const def: RowsLikeDef = {
    output: z.array(z.object({ id: z.string(), title: z.string() })),
    columns: ["id", "title"],
  };
  const rows = [
    ["1", "A"],
    ["2", "B"],
  ];
  const res = mapRowsOutput(def, rows) as Array<{ id: string; title: string }>;
  assert.deepEqual(res, [
    { id: "1", title: "A" },
    { id: "2", title: "B" },
  ]);
});

test("mapRowsOutput: mapRow has precedence", () => {
  const def: RowsLikeDef = {
    output: z.array(z.object({ x: z.string() })),
    columns: ["ignored"],
    mapRow: (cols) => ({ x: cols.join("|") }),
  };
  const rows = [
    ["a", "b"],
    ["c", "d"],
  ];
  const res = mapRowsOutput(def, rows) as Array<{ x: string }>;
  assert.deepEqual(res, [{ x: "a|b" }, { x: "c|d" }]);
});

test("mapRowsOutput: fallback infers keys from zod object", () => {
  const def: RowsLikeDef = {
    output: z.array(z.object({ a: z.string(), b: z.string(), c: z.string() })),
  };
  const rows = [["x", "y", "z"]];
  const res = mapRowsOutput(def, rows) as Array<{
    a: string;
    b: string;
    c: string;
  }>;
  assert.deepEqual(res, [{ a: "x", b: "y", c: "z" }]);
});

test("mapRowsOutput: passthrough when no mapping possible", () => {
  const def: RowsLikeDef = {
    output: z.array(z.array(z.string())), // element is not an object
  };
  const rows = [["x", "y"], ["z"]];
  const res = mapRowsOutput(def, rows) as string[][];
  assert.equal(Array.isArray(res) && Array.isArray(res[0]), true);
  assert.deepEqual(res, rows);
});
