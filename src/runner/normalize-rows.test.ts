import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { RowsLikeDef } from "./map-rows.js";
import { normalizeRowsToSchema } from "../normalization/normalize-rows.js";

void test("normalizeRowsToSchema: numbers and booleans", () => {
  const def: RowsLikeDef = {
    output: z.array(z.object({ id: z.number(), active: z.boolean() })),
    columns: ["id", "active"],
  };
  const rows = [
    { id: "42", active: "true" },
    { id: "7", active: "0" },
  ];
  const res = normalizeRowsToSchema(def, rows) as Array<{
    id: number;
    active: boolean;
  }>;
  assert.deepEqual(res, [
    { id: 42, active: true },
    { id: 7, active: false },
  ]);
});

void test('normalizeRowsToSchema: tuple from string "{1, 2, 3, 4}"', () => {
  const def: RowsLikeDef = {
    output: z.array(
      z.object({
        bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      }),
    ),
    columns: ["bounds"],
  };
  const rows = [{ bounds: "{1, 2, 300, 400}" }];
  const res = normalizeRowsToSchema(def, rows) as Array<{
    bounds: [number, number, number, number];
  }>;
  assert.deepEqual(res, [{ bounds: [1, 2, 300, 400] }]);
});

void test("normalizeRowsToSchema: array<number> from string", () => {
  const def: RowsLikeDef = {
    output: z.array(z.object({ ids: z.array(z.number()) })),
    columns: ["ids"],
  };
  const rows = [{ ids: "{1,2,3}" }, { ids: "4, 5, 6" }];
  const res = normalizeRowsToSchema(def, rows) as Array<{ ids: number[] }>;
  assert.deepEqual(res, [{ ids: [1, 2, 3] }, { ids: [4, 5, 6] }]);
});

void test("normalizeRowsToSchema: leaves strings when schema is string", () => {
  const def: RowsLikeDef = {
    output: z.array(z.object({ title: z.string() })),
    columns: ["title"],
  };
  const rows = [{ title: "Hello" }, { title: "123" }];
  const res = normalizeRowsToSchema(def, rows) as Array<{ title: string }>;
  assert.deepEqual(res, rows);
});
