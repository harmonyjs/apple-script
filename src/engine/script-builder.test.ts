/**
 * @fileoverview Unit tests for script-builder module.
 *
 * Tests the generation of complete AppleScript from components,
 * including parameter substitution and different operation types.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAppleScript,
  hasReturnStatement,
  validateUserScript,
} from "./script-builder.js";
import { GS, RS, US, ACTION_CODES } from "./protocol/constants.js";

test("script-builder", async (t) => {
  await t.test("buildAppleScript", async (t) => {
    await t.test("builds basic scalar script", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: 'return "Hello World"',
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should contain all essential parts
      assert.ok(script.includes("-- Standard helpers"));
      assert.ok(script.includes("on __join__(listItems, sep)"));
      assert.ok(script.includes("on __user_fn__()"));
      assert.ok(script.includes("with timeout of 10 seconds"));
      assert.ok(script.includes('tell application id "com.apple.Safari"'));
      assert.ok(script.includes('return "Hello World"'));
      assert.ok(script.includes("on __run__()"));
      assert.ok(script.includes("on __main__()"));
      assert.ok(
        script.includes('tell application id "com.apple.Safari" to launch'),
      );
      assert.ok(script.includes("__main__()"));
    });

    await t.test("builds script without app readiness check", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: 'return "test"',
        params: [],
        timeoutSec: 5,
        ensureReady: false,
      });

      // Should not contain app readiness check
      assert.ok(!script.includes("to launch"));
      assert.ok(!script.includes("delay 0.1"));

      // But should contain other parts
      assert.ok(script.includes("on __user_fn__()"));
      assert.ok(script.includes("with timeout of 5 seconds"));
    });

    await t.test("builds script with parameters", () => {
      const params = [
        {
          varName: "__ARG__url",
          literal: '"https://example.com"',
          paramName: "url",
        },
        { varName: "__ARG__count", literal: "42", paramName: "count" },
      ];

      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: 'return ${url} & " has " & ${count} & " tabs"',
        params,
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should contain parameter declarations
      assert.ok(script.includes('set __ARG__url to "https://example.com"'));
      assert.ok(script.includes("set __ARG__count to 42"));

      // Should have parameters substituted in user script
      assert.ok(
        script.includes('return __ARG__url & " has " & __ARG__count & " tabs"'),
      );
    });

    await t.test("builds action script", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "action",
        userScript: 'return "1"',
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should contain action-specific validation
      assert.ok(
        script.includes(
          `if __code__ is not in {"${ACTION_CODES.FAILURE}", "${ACTION_CODES.SUCCESS}", "${ACTION_CODES.PARTIAL}"}`,
        ),
      );
      assert.ok(script.includes("error -10004"));
      assert.ok(script.includes('return "OK" & "' + GS + '" & __code__'));
    });

    await t.test("builds rows script", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "rows",
        userScript:
          'return {{"row1col1", "row1col2"}, {"row2col1", "row2col2"}}',
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should contain rows-specific logic
      assert.ok(
        script.includes("if class of __rows__ is not list then error -10002"),
      );
      assert.ok(script.includes("repeat with r in __rows__"));
      assert.ok(script.includes("repeat with f in r"));
      assert.ok(script.includes(`my __join__(__fields__, "${US}")`));
      assert.ok(script.includes(`my __join__(__encoded__, "${RS}")`));
    });

    await t.test("builds sections script", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "sections",
        userScript:
          'return {{"section1", {"item1", "item2"}}, {"section2", {"item3"}}}',
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should contain sections-specific logic
      assert.ok(
        script.includes(
          "if class of __sections__ is not list then error -10003",
        ),
      );
      assert.ok(script.includes("repeat with s in __sections__"));
      assert.ok(script.includes("set __name__ to item 1 of s"));
      assert.ok(script.includes("set __items__ to item 2 of s"));
      assert.ok(
        script.includes(`"${US}" & my __join__(__text_items__, "${US}")`),
      );
      assert.ok(script.includes(`my __join__(__encoded__, "${GS}")`));
    });

    await t.test("handles complex parameter substitution", () => {
      const params = [
        {
          varName: "__ARG__message",
          literal: '"Say " & quote & "Hello" & quote & ""',
          paramName: "message",
        },
        {
          varName: "__ARG__items",
          literal: '{"a", "b", "c"}',
          paramName: "items",
        },
      ];

      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript:
          "set msg to ${message}\nset list to ${items}\nreturn msg & (count of list)",
        params,
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should substitute all parameters
      assert.ok(script.includes("set msg to __ARG__message"));
      assert.ok(script.includes("set list to __ARG__items"));
      assert.ok(script.includes("return msg & (count of list)"));

      // Should contain parameter declarations
      assert.ok(
        script.includes(
          'set __ARG__message to "Say " & quote & "Hello" & quote & ""',
        ),
      );
      assert.ok(script.includes('set __ARG__items to {"a", "b", "c"}'));
    });

    await t.test("handles multiple occurrences of same parameter", () => {
      const params = [
        { varName: "__ARG__value", literal: '"test"', paramName: "value" },
      ];

      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript:
          "set x to ${value}\nset y to ${value}\nreturn x & y & ${value}",
        params,
        timeoutSec: 10,
        ensureReady: true,
      });

      // All occurrences should be substituted
      assert.ok(script.includes("set x to __ARG__value"));
      assert.ok(script.includes("set y to __ARG__value"));
      assert.ok(script.includes("return x & y & __ARG__value"));

      // Should not contain any ${value} placeholders
      assert.ok(!script.includes("${value}"));
    });

    await t.test("preserves user script indentation", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: "if true then\n  set x to 1\n  return x\nend if",
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should preserve the structure with proper indentation
      assert.ok(script.includes("      if true then"));
      assert.ok(script.includes("        set x to 1"));
      assert.ok(script.includes("        return x"));
      assert.ok(script.includes("      end if"));
    });

    await t.test("handles empty user script", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: "",
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should still generate valid script structure
      assert.ok(script.includes("on __user_fn__()"));
      assert.ok(script.includes("on __run__()"));
      assert.ok(script.includes("on __main__()"));
    });

    await t.test("uses default timeout when not specified", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: 'return "test"',
        params: [],
        ensureReady: true,
      });

      // Should use default timeout of 12 seconds
      assert.ok(script.includes("with timeout of 12 seconds"));
    });

    await t.test("handles special characters in app ID", () => {
      const script = buildAppleScript({
        appId: "com.company.app-name_v2",
        kind: "scalar",
        userScript: 'return "test"',
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      assert.ok(
        script.includes('tell application id "com.company.app-name_v2"'),
      );
      assert.ok(
        script.includes(
          'tell application id "com.company.app-name_v2" to launch',
        ),
      );
    });
  });

  await t.test("hasReturnStatement", async (t) => {
    await t.test("detects return statement", () => {
      assert.equal(hasReturnStatement("return 42"), true);
      assert.equal(hasReturnStatement("set x to 1\nreturn x"), true);
      assert.equal(hasReturnStatement("if true then return false"), true);
    });

    await t.test("detects return statement case insensitive", () => {
      assert.equal(hasReturnStatement("RETURN 42"), true);
      assert.equal(hasReturnStatement("Return x"), true);
      assert.equal(hasReturnStatement("rEtUrN value"), true);
    });

    await t.test("detects return with extra spaces", () => {
      assert.equal(hasReturnStatement("return  value"), true);
      assert.equal(hasReturnStatement("  return value  "), true);
      assert.equal(hasReturnStatement("set x to 1\n  return x"), true);
    });

    await t.test("returns false when no return statement", () => {
      assert.equal(hasReturnStatement("set x to 1"), false);
      assert.equal(hasReturnStatement('display dialog "hello"'), false);
      assert.equal(hasReturnStatement(""), false);
    });

    await t.test("handles false positives", () => {
      // These contain "return" but not as a statement
      assert.equal(hasReturnStatement("set returnValue to 1"), false); // Should not detect "return" in variable names
      assert.equal(hasReturnStatement("-- this will return something"), false); // Should not detect "return" in comments
    });

    await t.test("handles multiline scripts", () => {
      const script = `
        set x to 1
        set y to 2
        return x + y
      `;
      assert.equal(hasReturnStatement(script), true);
    });
  });

  await t.test("validateUserScript", async (t) => {
    // Note: validateUserScript currently only warns, doesn't throw
    // We can test that it doesn't crash on various inputs

    await t.test("validates script with return", () => {
      // Should not throw
      assert.doesNotThrow(() => {
        validateUserScript("return 42", "scalar");
      });
    });

    await t.test("validates script without return", () => {
      // Should not throw (just warns)
      assert.doesNotThrow(() => {
        validateUserScript("set x to 1", "scalar");
      });
    });

    await t.test("validates empty script", () => {
      assert.doesNotThrow(() => {
        validateUserScript("", "scalar");
      });
    });

    await t.test("validates complex script", () => {
      const script = `
        tell application "Safari"
          set tabCount to count of tabs of window 1
          return tabCount
        end tell
      `;
      assert.doesNotThrow(() => {
        validateUserScript(script, "rows");
      });
    });
  });

  await t.test("error handling in generated scripts", async (t) => {
    await t.test("scalar script handles missing return", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: 'return "test"',
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should check for missing value and error appropriately
      assert.ok(
        script.includes("if __val__ is missing value then error -10001"),
      );
    });

    await t.test("action script validates return type", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "action",
        userScript: 'return "1"',
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should validate action code
      assert.ok(
        script.includes("if __val__ is missing value then error -10001"),
      );
      assert.ok(script.includes("if __code__ is not in"));
      assert.ok(script.includes("then error -10004"));
    });

    await t.test("rows script validates return type", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "rows",
        userScript: 'return {{"a", "b"}}',
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should validate that return is a list
      assert.ok(
        script.includes("if class of __rows__ is not list then error -10002"),
      );
    });

    await t.test("sections script validates return type", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "sections",
        userScript: 'return {{"section", {"item"}}}',
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should validate that return is a list
      assert.ok(
        script.includes(
          "if class of __sections__ is not list then error -10003",
        ),
      );
    });

    await t.test("all scripts have error handling wrapper", () => {
      const kinds = ["scalar", "action", "rows", "sections"] as const;

      for (const kind of kinds) {
        const script = buildAppleScript({
          appId: "com.apple.Safari",
          kind,
          userScript: 'return "test"',
          params: [],
          timeoutSec: 10,
          ensureReady: true,
        });

        // Should have try/catch wrapper
        assert.ok(script.includes("try"));
        assert.ok(script.includes("on error errMsg number errNum"));
        assert.ok(
          script.includes(
            `return "ERR" & "${GS}" & errNum & "${GS}" & (errMsg as text)`,
          ),
        );
      }
    });
  });

  await t.test("script structure and formatting", async (t) => {
    await t.test("generates well-formed AppleScript", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: 'return "test"',
        params: [
          { varName: "__ARG__param", literal: '"value"', paramName: "param" },
        ],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should have proper structure with sections separated by blank lines
      const sections = script.split("\n\n");
      assert.ok(sections.length >= 4); // prologue, params, user function, operation wrapper, main

      // Each section should be non-empty
      for (const section of sections) {
        assert.ok(section.trim().length > 0);
      }
    });

    await t.test("handles no parameters gracefully", () => {
      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: 'return "test"',
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should not have empty parameter section
      assert.ok(!script.includes("\n\n\n")); // No triple newlines

      // Should still be well-formed
      assert.ok(script.includes("-- Standard helpers"));
      assert.ok(script.includes("on __user_fn__()"));
    });

    await t.test("preserves user script exactly", () => {
      const userScript = `-- User comment
set myVar to "special chars: \\"quotes\\" & tab & return"
if myVar contains "special" then
  return myVar
else
  return "nothing"
end if`;

      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript,
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // User script should be preserved with proper indentation
      assert.ok(script.includes("      -- User comment"));
      assert.ok(
        script.includes(
          '      set myVar to "special chars: \\"quotes\\" & tab & return"',
        ),
      );
      assert.ok(script.includes('      if myVar contains "special" then'));
      assert.ok(script.includes("        return myVar"));
      assert.ok(script.includes("      else"));
      assert.ok(script.includes('        return "nothing"'));
      assert.ok(script.includes("      end if"));
    });
  });

  await t.test("edge cases", async (t) => {
    await t.test("handles parameter names with special characters", () => {
      const params = [
        {
          varName: "__ARG__param_with_underscores",
          literal: '"value"',
          paramName: "param_with_underscores",
        },
        {
          varName: "__ARG__param123",
          literal: '"value"',
          paramName: "param123",
        },
      ];

      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: "return ${param_with_underscores} & ${param123}",
        params,
        timeoutSec: 10,
        ensureReady: true,
      });

      assert.ok(
        script.includes(
          "return __ARG__param_with_underscores & __ARG__param123",
        ),
      );
    });

    await t.test("handles very long user scripts", () => {
      const longScript = "return " + '"x"'.repeat(1000).split("").join(" & ");

      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: longScript,
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      // Should contain the long script
      assert.ok(script.includes(longScript));
    });

    await t.test("handles Unicode in user scripts", () => {
      const unicodeScript = 'return "Hello 世界 🌍"';

      const script = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: unicodeScript,
        params: [],
        timeoutSec: 10,
        ensureReady: true,
      });

      assert.ok(script.includes('return "Hello 世界 🌍"'));
    });

    await t.test("handles extreme timeout values", () => {
      const script1 = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: 'return "test"',
        params: [],
        timeoutSec: 1,
        ensureReady: true,
      });

      const script2 = buildAppleScript({
        appId: "com.apple.Safari",
        kind: "scalar",
        userScript: 'return "test"',
        params: [],
        timeoutSec: 3600, // 1 hour
        ensureReady: true,
      });

      assert.ok(script1.includes("with timeout of 1 seconds"));
      assert.ok(script2.includes("with timeout of 3600 seconds"));
    });
  });
});
