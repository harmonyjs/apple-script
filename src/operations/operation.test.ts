/**
 * @fileoverview Unit tests for operation module.
 * 
 * Tests the factory functions for creating different types of AppleScript operations,
 * including validation and type safety.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  scalar,
  action,
  rows,
  sections,
  operation,
} from "./operation.js";

test("operation", async (t) => {
  await t.test("scalar operations", async (t) => {
    await t.test("creates basic scalar operation", () => {
      const op = scalar({
        name: "getTabCount",
        input: z.object({ windowId: z.number() }),
        output: z.string().transform(s => parseInt(s, 10)).pipe(z.number()),
        script: (vars) => `return count of tabs of window ${vars.windowId}`,
      });

      assert.equal(op.def.kind, "scalar");
      assert.equal(op.def.name, "getTabCount");
      assert.ok(op.def.input);
      assert.ok(op.def.output);
      assert.equal(typeof op.def.script, "function");
    });

    await t.test("creates scalar operation with hints", () => {
      const op = scalar({
        name: "executeJS",
        input: z.object({ code: z.string() }),
        output: z.string(),
        script: (vars) => `return do JavaScript ${vars.code}`,
        hints: { code: { js: {} } },
      });

      assert.equal(op.def.kind, "scalar");
      assert.equal(op.def.name, "executeJS");
      assert.deepEqual(op.def.hints, { code: { js: {} } });
    });

    await t.test("creates scalar operation with validation flags", () => {
      const op = scalar({
        name: "test",
        input: z.object({}),
        output: z.string(),
        script: () => 'return "test"',
        validateInput: false,
        validateOutput: true,
      });

      assert.equal(op.def.validateInput, false);
      assert.equal(op.def.validateOutput, true);
    });

    await t.test("scalar script function receives correct variables", () => {
      const op = scalar({
        name: "test",
        input: z.object({ url: z.string(), count: z.number() }),
        output: z.string(),
        script: (vars) => {
          // vars should have the parameter names as keys
          return `open location ${vars.url} repeat ${vars.count} times`;
        },
      });

      const script = op.def.script({ url: "__ARG__url", count: "__ARG__count" });
      assert.equal(script, "open location __ARG__url repeat __ARG__count times");
    });

    await t.test("handles empty input schema", () => {
      const op = scalar({
        name: "getCurrentTab",
        input: z.object({}),
        output: z.string(),
        script: () => 'return name of current tab',
      });

      assert.equal(op.def.kind, "scalar");
      const script = op.def.script({});
      assert.equal(script, "return name of current tab");
    });
  });

  await t.test("action operations", async (t) => {
    await t.test("creates basic action operation", () => {
      const op = action({
        name: "closeTab",
        input: z.object({ tabId: z.number() }),
        script: (vars) => `close tab ${vars.tabId}`,
      });

      assert.equal(op.def.kind, "action");
      assert.equal(op.def.name, "closeTab");
      assert.ok(op.def.input);
      assert.ok(op.def.output);
      assert.equal(op.def.validateOutput, true); // Always true for actions
    });

    await t.test("action has fixed output schema", () => {
      const op = action({
        name: "test",
        input: z.object({}),
        script: () => 'return "1"',
      });

      // Output should be the action enum
      const testResult = op.def.output.safeParse("1");
      assert.equal(testResult.success, true);
      
      const invalidResult = op.def.output.safeParse("3");
      assert.equal(invalidResult.success, false);
    });

    await t.test("creates action with hints", () => {
      const op = action({
        name: "executeScript",
        input: z.object({ script: z.string() }),
        script: (vars) => `do shell script ${vars.script}`,
        hints: { script: { js: { maxLenKb: 10 } } },
      });

      assert.deepEqual(op.def.hints, { script: { js: { maxLenKb: 10 } } });
    });

    await t.test("creates action with input validation flag", () => {
      const op = action({
        name: "test",
        input: z.object({ param: z.string() }),
        script: () => 'return "1"',
        validateInput: false,
      });

      assert.equal(op.def.validateInput, false);
    });

    await t.test("action script function works correctly", () => {
      const op = action({
        name: "refreshTab",
        input: z.object({ tabIndex: z.number() }),
        script: (vars) => `tell tab ${vars.tabIndex} to reload`,
      });

      const script = op.def.script({ tabIndex: "__ARG__tabIndex" });
      assert.equal(script, "tell tab __ARG__tabIndex to reload");
    });
  });

  await t.test("rows operations", async (t) => {
    await t.test("creates basic rows operation", () => {
      const op = rows({
        name: "getAllTabs",
        input: z.object({}),
        output: z.array(z.object({
          name: z.string(),
          url: z.string(),
        })),
        script: () => `
          set tabList to {}
          repeat with t in tabs of window 1
            set end of tabList to {name of t, URL of t}
          end repeat
          return tabList
        `,
      });

      assert.equal(op.def.kind, "rows");
      assert.equal(op.def.name, "getAllTabs");
      assert.ok(op.def.input);
      assert.ok(op.def.output);
    });

    await t.test("creates rows operation with validation flags", () => {
      const op = rows({
        name: "test",
        input: z.object({}),
        output: z.array(z.string()),
        script: () => 'return {"a", "b"}',
        validateInput: true,
        validateOutput: false,
      });

      assert.equal(op.def.validateInput, true);
      assert.equal(op.def.validateOutput, false);
    });

    await t.test("rows operation with complex schema", () => {
      const TabSchema = z.object({
        id: z.number(),
        title: z.string(),
        url: z.string(),
        active: z.boolean(),
      });

      const op = rows({
        name: "getTabsWithDetails",
        input: z.object({ windowIndex: z.number() }),
        output: z.array(TabSchema),
        script: (vars) => `
          set tabData to {}
          repeat with i from 1 to count of tabs of window ${vars.windowIndex}
            set t to tab i of window ${vars.windowIndex}
            set end of tabData to {i, name of t, URL of t, t is active tab}
          end repeat
          return tabData
        `,
      });

      assert.equal(op.def.kind, "rows");
      const script = op.def.script({ windowIndex: "__ARG__windowIndex" });
      assert.ok(script.includes("window __ARG__windowIndex"));
    });

    await t.test("rows operation with hints", () => {
      const op = rows({
        name: "executeAndGetResults",
        input: z.object({ jsCode: z.string() }),
        output: z.array(z.string()),
        script: (vars) => `return do JavaScript ${vars.jsCode}`,
        hints: { jsCode: { js: {} } },
      });

      assert.deepEqual(op.def.hints, { jsCode: { js: {} } });
    });
  });

  await t.test("sections operations", async (t) => {
    await t.test("creates basic sections operation", () => {
      const op = sections({
        name: "getTabsByState",
        input: z.object({}),
        output: z.object({
          active: z.array(z.string()),
          inactive: z.array(z.string()),
        }),
        script: () => `
          set activeList to {}
          set inactiveList to {}
          repeat with t in tabs of window 1
            if t is active tab then
              set end of activeList to name of t
            else
              set end of inactiveList to name of t
            end if
          end repeat
          return {{"active", activeList}, {"inactive", inactiveList}}
        `,
      });

      assert.equal(op.def.kind, "sections");
      assert.equal(op.def.name, "getTabsByState");
      assert.ok(op.def.input);
      assert.ok(op.def.output);
    });

    await t.test("creates sections operation with validation flags", () => {
      const op = sections({
        name: "test",
        input: z.object({}),
        output: z.record(z.array(z.string())),
        script: () => 'return {{"section1", {"item1"}}}',
        validateInput: false,
        validateOutput: true,
      });

      assert.equal(op.def.validateInput, false);
      assert.equal(op.def.validateOutput, true);
    });

    await t.test("sections operation with parameters", () => {
      const op = sections({
        name: "categorizeTabsByDomain",
        input: z.object({ domains: z.array(z.string()) }),
        output: z.record(z.array(z.string())),
        script: (vars) => `
          set domainList to ${vars.domains}
          set results to {}
          repeat with domain in domainList
            set domainTabs to {}
            repeat with t in tabs of window 1
              if URL of t contains domain then
                set end of domainTabs to name of t
              end if
            end repeat
            set end of results to {domain, domainTabs}
          end repeat
          return results
        `,
      });

      const script = op.def.script({ domains: "__ARG__domains" });
      assert.ok(script.includes("set domainList to __ARG__domains"));
    });

    await t.test("sections operation with hints", () => {
      const op = sections({
        name: "processWithJS",
        input: z.object({ processor: z.string() }),
        output: z.record(z.array(z.string())),
        script: (vars) => `return do JavaScript ${vars.processor}`,
        hints: { processor: { js: { maxLenKb: 50 } } },
      });

      assert.deepEqual(op.def.hints, { processor: { js: { maxLenKb: 50 } } });
    });
  });

  await t.test("operation namespace", async (t) => {
    await t.test("provides all operation types", () => {
      assert.equal(typeof operation.scalar, "function");
      assert.equal(typeof operation.action, "function");
      assert.equal(typeof operation.rows, "function");
      assert.equal(typeof operation.sections, "function");
      assert.equal(typeof operation.create, "function");
    });

    await t.test("scalar factory works through namespace", () => {
      const op = operation.scalar({
        name: "test",
        input: z.object({}),
        output: z.string(),
        script: () => 'return "test"',
      });

      assert.equal(op.def.kind, "scalar");
      assert.equal(op.def.name, "test");
    });

    await t.test("action factory works through namespace", () => {
      const op = operation.action({
        name: "test",
        input: z.object({}),
        script: () => 'return "1"',
      });

      assert.equal(op.def.kind, "action");
      assert.equal(op.def.name, "test");
    });

    await t.test("rows factory works through namespace", () => {
      const op = operation.rows({
        name: "test",
        input: z.object({}),
        output: z.array(z.string()),
        script: () => 'return {"test"}',
      });

      assert.equal(op.def.kind, "rows");
      assert.equal(op.def.name, "test");
    });

    await t.test("sections factory works through namespace", () => {
      const op = operation.sections({
        name: "test",
        input: z.object({}),
        output: z.record(z.array(z.string())),
        script: () => 'return {{"section", {"item"}}}',
      });

      assert.equal(op.def.kind, "sections");
      assert.equal(op.def.name, "test");
    });

    await t.test("create factory works with operation definition", () => {
      const def = {
        kind: "scalar" as const,
        name: "test",
        input: z.object({}),
        output: z.string(),
        script: () => 'return "test"',
      };

      const op = operation.create(def);
      assert.equal(op.def.kind, "scalar");
      assert.equal(op.def.name, "test");
    });
  });

  await t.test("type safety and validation", async (t) => {
    await t.test("operation definitions have correct structure", () => {
      const scalarOp = scalar({
        name: "test",
        input: z.object({ param: z.string() }),
        output: z.number(),
        script: (vars) => `return ${vars.param}`,
      });

      // Check that the operation has the expected structure
      assert.ok(scalarOp.def);
      assert.equal(scalarOp.def.kind, "scalar");
      assert.equal(scalarOp.def.name, "test");
      assert.ok(scalarOp.def.input);
      assert.ok(scalarOp.def.output);
      assert.equal(typeof scalarOp.def.script, "function");
    });

    await t.test("script functions receive variable mapping", () => {
      const op = scalar({
        name: "test",
        input: z.object({
          url: z.string(),
          count: z.number(),
          enabled: z.boolean(),
        }),
        output: z.string(),
        script: (vars) => {
          // vars should be an object with parameter names as keys
          assert.equal(typeof vars, "object");
          assert.ok("url" in vars);
          assert.ok("count" in vars);
          assert.ok("enabled" in vars);
          return `process ${vars.url} ${vars.count} times, enabled: ${vars.enabled}`;
        },
      });

      const result = op.def.script({
        url: "__ARG__url",
        count: "__ARG__count",
        enabled: "__ARG__enabled",
      });

      assert.equal(result, "process __ARG__url __ARG__count times, enabled: __ARG__enabled");
    });

    await t.test("operations preserve schema types", () => {
      const InputSchema = z.object({
        windowId: z.number(),
        filter: z.string().optional(),
      });

      const OutputSchema = z.array(z.object({
        id: z.number(),
        title: z.string(),
      }));

      const op = rows({
        name: "getFilteredTabs",
        input: InputSchema,
        output: OutputSchema,
        script: (vars) => `get tabs from window ${vars.windowId} where ${vars.filter}`,
      });

      // The schemas should be preserved
      assert.equal(op.def.input, InputSchema);
      assert.equal(op.def.output, OutputSchema);
    });
  });

  await t.test("edge cases and error handling", async (t) => {
    await t.test("handles empty script functions", () => {
      const op = scalar({
        name: "empty",
        input: z.object({}),
        output: z.string(),
        script: () => "",
      });

      const result = op.def.script({});
      assert.equal(result, "");
    });

    await t.test("handles script functions with no parameters", () => {
      const op = scalar({
        name: "noParams",
        input: z.object({}),
        output: z.string(),
        script: (vars) => {
          assert.deepEqual(vars, {});
          return 'return "no params"';
        },
      });

      const result = op.def.script({});
      assert.equal(result, 'return "no params"');
    });

    await t.test("handles complex parameter names", () => {
      const op = scalar({
        name: "complexParams",
        input: z.object({
          "param-with-dashes": z.string(),
          param_with_underscores: z.string(),
          param123: z.number(),
        }),
        output: z.string(),
        script: (vars) => {
          return `${vars["param-with-dashes"]} ${vars.param_with_underscores} ${vars.param123}`;
        },
      });

      const result = op.def.script({
        "param-with-dashes": "__ARG__param_with_dashes",
        param_with_underscores: "__ARG__param_with_underscores",
        param123: "__ARG__param123",
      });

      assert.equal(result, "__ARG__param_with_dashes __ARG__param_with_underscores __ARG__param123");
    });

    await t.test("handles multiline scripts", () => {
      const op = scalar({
        name: "multiline",
        input: z.object({ windowId: z.number() }),
        output: z.string(),
        script: (vars) => `
          tell window ${vars.windowId}
            set tabCount to count of tabs
            set windowName to name
            return windowName & " has " & tabCount & " tabs"
          end tell
        `,
      });

      const result = op.def.script({ windowId: "__ARG__windowId" });
      assert.ok(result.includes("tell window __ARG__windowId"));
      assert.ok(result.includes("set tabCount to count of tabs"));
    });

    await t.test("preserves all optional properties", () => {
      const op = scalar({
        name: "withAllOptions",
        input: z.object({ param: z.string() }),
        output: z.string(),
        script: (vars) => `return ${vars.param}`,
        hints: { param: { js: { maxLenKb: 100 } } },
        validateInput: false,
        validateOutput: true,
      });

      assert.equal(op.def.name, "withAllOptions");
      assert.deepEqual(op.def.hints, { param: { js: { maxLenKb: 100 } } });
      assert.equal(op.def.validateInput, false);
      assert.equal(op.def.validateOutput, true);
    });
  });
});
