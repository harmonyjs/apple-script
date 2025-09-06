/**
 * @fileoverview Unit tests for marshaller module.
 *
 * Tests the safe marshalling of JavaScript values to AppleScript literals,
 * focusing on security (injection prevention) and correctness.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  asStringLiteral,
  asListLiteral,
  validateJsCode,
  marshalParam,
  marshalParams,
  generatePrologue,
} from "./marshaller.js";
import { MAX_SIZES } from "./protocol/constants.js";

test("marshaller", async (t) => {
  await t.test("asStringLiteral", async (t) => {
    await t.test("handles empty string", () => {
      assert.equal(asStringLiteral(""), '""');
    });

    await t.test("handles simple string without quotes", () => {
      assert.equal(asStringLiteral("hello"), '"hello"');
    });

    await t.test("escapes backslashes", () => {
      assert.equal(asStringLiteral("path\\to\\file"), '"path\\\\to\\\\file"');
    });

    await t.test("handles string with single quote", () => {
      assert.equal(asStringLiteral("Hello 'World'"), "\"Hello 'World'\"");
    });

    await t.test("handles string with double quotes", () => {
      const result = asStringLiteral('Hello "World"');
      assert.equal(result, '"Hello " & quote & "World" & quote & ""');
    });

    await t.test("handles string with multiple quotes", () => {
      const result = asStringLiteral('Say "Hello" and "Goodbye"');
      assert.equal(
        result,
        '"Say " & quote & "Hello" & quote & " and " & quote & "Goodbye" & quote & ""',
      );
    });

    await t.test("handles string starting with quote", () => {
      const result = asStringLiteral('"Hello World"');
      assert.equal(result, '"" & quote & "Hello World" & quote & ""');
    });

    await t.test("handles string ending with quote", () => {
      const result = asStringLiteral('Hello World"');
      assert.equal(result, '"Hello World" & quote & ""');
    });

    await t.test("handles string with only quotes", () => {
      const result = asStringLiteral('"""');
      assert.equal(result, '"" & quote & "" & quote & "" & quote & ""');
    });

    await t.test("handles backslashes and quotes together", () => {
      const result = asStringLiteral('path\\to\\"file"');
      assert.equal(result, '"path\\\\to\\\\" & quote & "file" & quote & ""');
    });

    await t.test("handles newlines and special characters", () => {
      const result = asStringLiteral("line1\nline2\ttab");
      assert.equal(result, '"line1\nline2\ttab"');
    });

    await t.test("throws on oversized string", () => {
      const largeString = "x".repeat((MAX_SIZES.STRING_ARG_KB + 1) * 1024);
      assert.throws(
        () => asStringLiteral(largeString),
        /String argument exceeds maximum size/,
      );
    });

    await t.test("accepts string at size limit", () => {
      const maxString = "x".repeat(MAX_SIZES.STRING_ARG_KB * 1024);
      const result = asStringLiteral(maxString);
      assert.equal(result, `"${maxString}"`);
    });
  });

  await t.test("asListLiteral", async (t) => {
    await t.test("handles empty array", () => {
      assert.equal(asListLiteral([]), "{}");
    });

    await t.test("handles array of strings", () => {
      const result = asListLiteral(["a", "b", "c"]);
      assert.equal(result, '{"a", "b", "c"}');
    });

    await t.test("handles array of numbers", () => {
      const result = asListLiteral([1, 2, 3]);
      assert.equal(result, "{1, 2, 3}");
    });

    await t.test("handles array of booleans", () => {
      const result = asListLiteral([true, false, true]);
      assert.equal(result, "{true, false, true}");
    });

    await t.test("handles mixed array", () => {
      const result = asListLiteral(["hello", 42, true]);
      assert.equal(result, '{"hello", 42, true}');
    });

    await t.test("handles array with strings containing quotes", () => {
      const result = asListLiteral(['say "hello"', "world"]);
      assert.equal(result, '{"say " & quote & "hello" & quote & "", "world"}');
    });

    await t.test("handles array with special numbers", () => {
      const result = asListLiteral([0, -1, 3.14]);
      assert.equal(result, "{0, -1, 3.14}");
    });

    await t.test("throws on non-array input", () => {
      assert.throws(
        () => asListLiteral("not an array" as any),
        /Expected an array/,
      );
    });

    await t.test("throws on array with unsupported types", () => {
      assert.throws(
        () => asListLiteral([null] as any),
        /Unsupported array item type/,
      );
    });

    await t.test("throws on array with objects", () => {
      assert.throws(
        () => asListLiteral([{}] as any),
        /Unsupported array item type/,
      );
    });

    await t.test("throws on array with infinite numbers", () => {
      assert.throws(
        () => asListLiteral([Infinity] as any),
        /Unsupported array item type/,
      );
    });

    await t.test("throws on array with NaN", () => {
      assert.throws(
        () => asListLiteral([NaN] as any),
        /Unsupported array item type/,
      );
    });

    await t.test("throws on oversized array", () => {
      const largeArray = new Array(MAX_SIZES.ARRAY_ITEMS + 1).fill("x");
      assert.throws(
        () => asListLiteral(largeArray),
        /Array exceeds maximum length/,
      );
    });

    await t.test("accepts array at size limit", () => {
      const maxArray = new Array(MAX_SIZES.ARRAY_ITEMS).fill("x");
      const result = asListLiteral(maxArray);
      assert.ok(result.startsWith("{"));
      assert.ok(result.endsWith("}"));
    });
  });

  await t.test("validateJsCode", async (t) => {
    await t.test("accepts valid JavaScript code", () => {
      const code = "console.log('hello');";
      const result = validateJsCode(code);
      assert.equal(result, code);
    });

    await t.test("accepts empty code", () => {
      const result = validateJsCode("");
      assert.equal(result, "");
    });

    await t.test("throws on non-string input", () => {
      assert.throws(
        () => validateJsCode(123 as any),
        /JavaScript code must be a string/,
      );
    });

    await t.test("throws on oversized code", () => {
      const largeCode = "x".repeat((MAX_SIZES.JS_CODE_KB + 1) * 1024);
      assert.throws(
        () => validateJsCode(largeCode),
        /JavaScript code exceeds maximum size/,
      );
    });

    await t.test("accepts code at size limit", () => {
      const maxCode = "x".repeat(MAX_SIZES.JS_CODE_KB * 1024);
      const result = validateJsCode(maxCode);
      assert.equal(result, maxCode);
    });

    await t.test("respects custom size limit", () => {
      const code = "x".repeat(2 * 1024); // 2KB
      assert.throws(
        () => validateJsCode(code, 1), // 1KB limit
        /JavaScript code exceeds maximum size of 1KB/,
      );
    });
  });

  await t.test("marshalParam", async (t) => {
    await t.test("marshals string parameter", () => {
      const result = marshalParam("url", "https://example.com");
      assert.equal(result.varName, "__ARG__url");
      assert.equal(result.literal, '"https://example.com"');
      assert.equal(result.paramName, "url");
    });

    await t.test("marshals number parameter", () => {
      const result = marshalParam("count", 42);
      assert.equal(result.varName, "__ARG__count");
      assert.equal(result.literal, "42");
      assert.equal(result.paramName, "count");
    });

    await t.test("marshals boolean parameter", () => {
      const result = marshalParam("enabled", true);
      assert.equal(result.varName, "__ARG__enabled");
      assert.equal(result.literal, "true");
      assert.equal(result.paramName, "enabled");
    });

    await t.test("marshals false boolean parameter", () => {
      const result = marshalParam("disabled", false);
      assert.equal(result.varName, "__ARG__disabled");
      assert.equal(result.literal, "false");
      assert.equal(result.paramName, "disabled");
    });

    await t.test("marshals null parameter", () => {
      const result = marshalParam("optional", null);
      assert.equal(result.varName, "__ARG__optional");
      assert.equal(result.literal, "missing value");
      assert.equal(result.paramName, "optional");
    });

    await t.test("marshals undefined parameter", () => {
      const result = marshalParam("optional", undefined);
      assert.equal(result.varName, "__ARG__optional");
      assert.equal(result.literal, "missing value");
      assert.equal(result.paramName, "optional");
    });

    await t.test("marshals array parameter", () => {
      const result = marshalParam("items", ["a", "b"]);
      assert.equal(result.varName, "__ARG__items");
      assert.equal(result.literal, '{"a", "b"}');
      assert.equal(result.paramName, "items");
    });

    await t.test("marshals object parameter as JSON", () => {
      const result = marshalParam("config", { key: "value" });
      assert.equal(result.varName, "__ARG__config");
      assert.equal(result.literal, '"{\\\"key\\\":\\\"value\\\"}"');
      assert.equal(result.paramName, "config");
    });

    await t.test("marshals JavaScript code with hint", () => {
      const code = "console.log('test');";
      const result = marshalParam("script", code, { js: {} });
      assert.equal(result.varName, "__ARG__script");
      assert.equal(result.literal, "\"console.log('test');\"");
      assert.equal(result.paramName, "script");
    });

    await t.test("marshals JavaScript code with custom size limit", () => {
      const code = "x".repeat(2 * 1024); // 2KB
      assert.throws(
        () => marshalParam("script", code, { js: { maxLenKb: 1 } }),
        /JavaScript code exceeds maximum size of 1KB/,
      );
    });

    await t.test("throws on infinite number", () => {
      assert.throws(
        () => marshalParam("bad", Infinity),
        /Non-finite number is not supported/,
      );
    });

    await t.test("throws on NaN", () => {
      assert.throws(
        () => marshalParam("bad", NaN),
        /Non-finite number is not supported/,
      );
    });

    await t.test("throws on unsupported type", () => {
      assert.throws(
        () => marshalParam("bad", Symbol("test") as any),
        /Unsupported parameter type for bad/,
      );
    });
  });

  await t.test("marshalParams", async (t) => {
    await t.test("marshals empty params object", () => {
      const result = marshalParams({});
      assert.equal(result.length, 0);
    });

    await t.test("marshals multiple parameters", () => {
      const result = marshalParams({
        url: "https://example.com",
        count: 42,
        enabled: true,
      });

      assert.equal(result.length, 3);

      const urlParam = result.find((p) => p.paramName === "url");
      assert.ok(urlParam);
      assert.equal(urlParam.varName, "__ARG__url");
      assert.equal(urlParam.literal, '"https://example.com"');

      const countParam = result.find((p) => p.paramName === "count");
      assert.ok(countParam);
      assert.equal(countParam.varName, "__ARG__count");
      assert.equal(countParam.literal, "42");

      const enabledParam = result.find((p) => p.paramName === "enabled");
      assert.ok(enabledParam);
      assert.equal(enabledParam.varName, "__ARG__enabled");
      assert.equal(enabledParam.literal, "true");
    });

    await t.test("applies hints correctly", () => {
      const result = marshalParams(
        { script: "console.log('test');" },
        { script: { js: {} } },
      );

      assert.equal(result.length, 1);
      assert.equal(result[0].paramName, "script");
      assert.equal(result[0].literal, "\"console.log('test');\"");
    });

    await t.test("handles parameters without hints", () => {
      const result = marshalParams(
        { normal: "value", script: "code" },
        { script: { js: {} } },
      );

      assert.equal(result.length, 2);

      const normalParam = result.find((p) => p.paramName === "normal");
      assert.ok(normalParam);
      assert.equal(normalParam.literal, '"value"');

      const scriptParam = result.find((p) => p.paramName === "script");
      assert.ok(scriptParam);
      assert.equal(scriptParam.literal, '"code"');
    });
  });

  await t.test("generatePrologue", async (t) => {
    await t.test("generates empty prologue for no parameters", () => {
      const result = generatePrologue([]);
      assert.equal(result, "");
    });

    await t.test("generates prologue for single parameter", () => {
      const params = [
        {
          varName: "__ARG__url",
          literal: '"https://example.com"',
          paramName: "url",
        },
      ];
      const result = generatePrologue(params);
      assert.equal(result, 'set __ARG__url to "https://example.com"');
    });

    await t.test("generates prologue for multiple parameters", () => {
      const params = [
        {
          varName: "__ARG__url",
          literal: '"https://example.com"',
          paramName: "url",
        },
        { varName: "__ARG__count", literal: "42", paramName: "count" },
        { varName: "__ARG__enabled", literal: "true", paramName: "enabled" },
      ];
      const result = generatePrologue(params);
      const lines = result.split("\n");
      assert.equal(lines.length, 3);
      assert.equal(lines[0], 'set __ARG__url to "https://example.com"');
      assert.equal(lines[1], "set __ARG__count to 42");
      assert.equal(lines[2], "set __ARG__enabled to true");
    });

    await t.test("handles complex parameter values", () => {
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
      const result = generatePrologue(params);
      const lines = result.split("\n");
      assert.equal(
        lines[0],
        'set __ARG__message to "Say " & quote & "Hello" & quote & ""',
      );
      assert.equal(lines[1], 'set __ARG__items to {"a", "b", "c"}');
    });
  });

  await t.test("security tests", async (t) => {
    await t.test("prevents AppleScript injection via string", () => {
      // Attempt to inject AppleScript code
      const malicious = 'test"; do shell script "rm -rf /"; set x to "';
      const result = asStringLiteral(malicious);

      // Should be safely escaped, not executable code
      assert.equal(
        result,
        '"test" & quote & "; do shell script " & quote & "rm -rf /" & quote & "; set x to " & quote & ""',
      );
    });

    await t.test("prevents injection via parameter name", () => {
      // Parameter names become variable names, should be safe
      const result = marshalParam("test_param", "value");
      assert.equal(result.varName, "__ARG__test_param");
      assert.equal(result.literal, '"value"');
    });

    await t.test("handles control characters safely", () => {
      const controlChars = "\x00\x01\x02\x1F";
      const result = asStringLiteral(controlChars);
      assert.equal(result, `"${controlChars}"`);
    });

    await t.test("handles Unicode safely", () => {
      const unicode = "Hello 世界 🌍";
      const result = asStringLiteral(unicode);
      assert.equal(result, '"Hello 世界 🌍"');
    });
  });
});
