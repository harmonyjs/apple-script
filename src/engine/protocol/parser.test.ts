/**
 * @fileoverview Unit tests for protocol module.
 *
 * Tests the parsing of AppleScript responses according to the protocol format,
 * including all payload types and error handling.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  parseProtocolResponse,
  parseRows,
  parseSections,
  parseScalar,
  parseAction,
  isSuccessResponse,
  isErrorResponse,
  getErrorMessage,
} from "./parser.js";
import type { RawResponse } from "./parser.js";
import { GS, RS, US, ACTION_CODES, AS_ERROR_CODES } from "./constants.js";

test("protocol", async (t) => {
  await t.test("parseProtocolResponse", async (t) => {
    await t.test("parses successful response", () => {
      const raw = {
        stdout: `OK${GS}test payload`,
        stderr: "",
        exitCode: 0,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.payload, "test payload");
      }
    });

    await t.test("parses successful response with empty payload", () => {
      const raw = {
        stdout: `OK${GS}`,
        stderr: "",
        exitCode: 0,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.payload, "");
      }
    });

    await t.test("parses successful response with GS in payload", () => {
      const raw = {
        stdout: `OK${GS}part1${GS}part2${GS}part3`,
        stderr: "",
        exitCode: 0,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.payload, `part1${GS}part2${GS}part3`);
      }
    });

    await t.test("parses error response", () => {
      const raw = {
        stdout: `ERR${GS}-1712${GS}AppleScript timeout`,
        stderr: "",
        exitCode: 1,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, -1712);
        assert.equal(result.message, "AppleScript timeout");
      }
    });

    await t.test("parses error response with GS in message", () => {
      const raw = {
        stdout: `ERR${GS}-1${GS}Error${GS}with${GS}separators`,
        stderr: "",
        exitCode: 1,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, -1);
        assert.equal(result.message, `Error${GS}with${GS}separators`);
      }
    });

    await t.test("parses error response with missing message", () => {
      const raw = {
        stdout: `ERR${GS}-1`,
        stderr: "",
        exitCode: 1,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, -1);
        assert.equal(result.message, "Unknown error");
      }
    });

    await t.test("parses error response with invalid code", () => {
      const raw = {
        stdout: `ERR${GS}invalid${GS}Some error`,
        stderr: "",
        exitCode: 1,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, -1);
        assert.equal(result.message, "Some error");
      }
    });

    await t.test("handles empty response", () => {
      const raw = {
        stdout: "",
        stderr: "",
        exitCode: 0,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, -1);
        assert.equal(result.message, "Empty response from AppleScript");
      }
    });

    await t.test("handles whitespace-only response", () => {
      const raw = {
        stdout: "   \n\t  ",
        stderr: "",
        exitCode: 0,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, -1);
        assert.equal(result.message, "Empty response from AppleScript");
      }
    });

    await t.test("handles malformed response without separator", () => {
      const raw = {
        stdout: "INVALID",
        stderr: "",
        exitCode: 0,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, -1);
        assert.equal(result.message, "Malformed response from AppleScript");
      }
    });

    await t.test("handles unknown status prefix", () => {
      const raw = {
        stdout: `UNKNOWN${GS}payload`,
        stderr: "",
        exitCode: 0,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, -1);
        assert.equal(result.message, "Unknown status prefix: UNKNOWN");
      }
    });

    await t.test("handles null stdout", () => {
      const raw = {
        stdout: null as any,
        stderr: "",
        exitCode: 0,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, -1);
        assert.equal(result.message, "Empty response from AppleScript");
      }
    });

    await t.test("handles undefined stdout", () => {
      const raw = {
        stdout: undefined as any,
        stderr: "",
        exitCode: 0,
      };
      const result = parseProtocolResponse(raw);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.code, -1);
        assert.equal(result.message, "Empty response from AppleScript");
      }
    });
  });

  await t.test("parseRows", async (t) => {
    await t.test("parses empty payload", () => {
      const result = parseRows("");
      assert.deepEqual(result, []);
    });

    await t.test("parses single row with single field", () => {
      const result = parseRows("field1");
      assert.deepEqual(result, [["field1"]]);
    });

    await t.test("parses single row with multiple fields", () => {
      const payload = `field1${US}field2${US}field3`;
      const result = parseRows(payload);
      assert.deepEqual(result, [["field1", "field2", "field3"]]);
    });

    await t.test("parses multiple rows", () => {
      const payload = `row1field1${US}row1field2${RS}row2field1${US}row2field2`;
      const result = parseRows(payload);
      assert.deepEqual(result, [
        ["row1field1", "row1field2"],
        ["row2field1", "row2field2"],
      ]);
    });

    await t.test("handles empty fields", () => {
      const payload = `${US}field2${US}${RS}field1${US}${US}field3`;
      const result = parseRows(payload);
      assert.deepEqual(result, [
        ["", "field2"],
        ["field1", "", "field3"],
      ]);
    });

    await t.test("handles trailing separators", () => {
      const payload = `field1${US}field2${US}${RS}field3${US}field4${US}${RS}`;
      const result = parseRows(payload);
      assert.deepEqual(result, [
        ["field1", "field2"],
        ["field3", "field4"],
      ]);
    });

    await t.test("handles empty rows", () => {
      const payload = `field1${RS}${RS}field2`;
      const result = parseRows(payload);
      assert.deepEqual(result, [["field1"], ["field2"]]);
    });

    await t.test("handles single field with no separators", () => {
      const result = parseRows("single");
      assert.deepEqual(result, [["single"]]);
    });

    await t.test("handles complex data", () => {
      const payload = `Tab 1${US}https://example.com${US}active${RS}Tab 2${US}https://google.com${US}inactive`;
      const result = parseRows(payload);
      assert.deepEqual(result, [
        ["Tab 1", "https://example.com", "active"],
        ["Tab 2", "https://google.com", "inactive"],
      ]);
    });
  });

  await t.test("parseSections", async (t) => {
    await t.test("parses empty payload", () => {
      const result = parseSections("");
      assert.deepEqual(result, {});
    });

    await t.test("parses single section with single item", () => {
      const payload = `section1${US}item1`;
      const result = parseSections(payload);
      assert.deepEqual(result, { section1: ["item1"] });
    });

    await t.test("parses single section with multiple items", () => {
      const payload = `section1${US}item1${US}item2${US}item3`;
      const result = parseSections(payload);
      assert.deepEqual(result, { section1: ["item1", "item2", "item3"] });
    });

    await t.test("parses multiple sections", () => {
      const payload = `closed${US}tab1${US}tab2${GS}open${US}tab3${US}tab4${US}tab5`;
      const result = parseSections(payload);
      assert.deepEqual(result, {
        closed: ["tab1", "tab2"],
        open: ["tab3", "tab4", "tab5"],
      });
    });

    await t.test("handles section with no items", () => {
      const payload = `empty${GS}filled${US}item1`;
      const result = parseSections(payload);
      assert.deepEqual(result, {
        empty: [],
        filled: ["item1"],
      });
    });

    await t.test("handles empty section names", () => {
      const payload = `${US}item1${GS}section2${US}item2`;
      const result = parseSections(payload);
      assert.deepEqual(result, { section2: ["item2"] });
    });

    await t.test("handles empty items", () => {
      const payload = `section1${US}${US}item2${US}${GS}section2${US}item3${US}`;
      const result = parseSections(payload);
      assert.deepEqual(result, {
        section1: ["item2"],
        section2: ["item3"],
      });
    });

    await t.test("handles trailing separators", () => {
      const payload = `section1${US}item1${US}item2${GS}section2${US}item3${GS}`;
      const result = parseSections(payload);
      assert.deepEqual(result, {
        section1: ["item1", "item2"],
        section2: ["item3"],
      });
    });

    await t.test("handles complex browser data", () => {
      const payload = `closed${US}1${US}2${GS}notFound${US}3${GS}minimized${US}4${US}5${US}6`;
      const result = parseSections(payload);
      assert.deepEqual(result, {
        closed: ["1", "2"],
        notFound: ["3"],
        minimized: ["4", "5", "6"],
      });
    });
  });

  await t.test("parseScalar", async (t) => {
    await t.test("returns payload as-is", () => {
      assert.equal(parseScalar("test"), "test");
    });

    await t.test("handles empty payload", () => {
      assert.equal(parseScalar(""), "");
    });

    await t.test("handles null payload", () => {
      assert.equal(parseScalar(null as any), "");
    });

    await t.test("handles undefined payload", () => {
      assert.equal(parseScalar(undefined as any), "");
    });

    await t.test("handles numeric string", () => {
      assert.equal(parseScalar("42"), "42");
    });

    await t.test("handles boolean string", () => {
      assert.equal(parseScalar("true"), "true");
    });

    await t.test("handles complex string", () => {
      const complex = `multi\nline\tstring with "quotes" and ${GS}${RS}${US}`;
      assert.equal(parseScalar(complex), complex);
    });
  });

  await t.test("parseAction", async (t) => {
    await t.test("parses success action code", () => {
      const result = parseAction(ACTION_CODES.SUCCESS);
      assert.equal(result, ACTION_CODES.SUCCESS);
    });

    await t.test("parses failure action code", () => {
      const result = parseAction(ACTION_CODES.FAILURE);
      assert.equal(result, ACTION_CODES.FAILURE);
    });

    await t.test("parses partial action code", () => {
      const result = parseAction(ACTION_CODES.PARTIAL);
      assert.equal(result, ACTION_CODES.PARTIAL);
    });

    await t.test("handles whitespace around valid code", () => {
      const result = parseAction(`  ${ACTION_CODES.SUCCESS}  `);
      assert.equal(result, ACTION_CODES.SUCCESS);
    });

    await t.test("throws on invalid action code", () => {
      assert.throws(() => parseAction("3"), /Invalid action code/);
    });

    await t.test("throws on empty action code", () => {
      assert.throws(() => parseAction(""), /Invalid action code/);
    });

    await t.test("throws on null action code", () => {
      assert.throws(() => parseAction(null as any), /Invalid action code/);
    });

    await t.test("throws on undefined action code", () => {
      assert.throws(() => parseAction(undefined as any), /Invalid action code/);
    });

    await t.test("throws on non-numeric action code", () => {
      assert.throws(() => parseAction("invalid"), /Invalid action code/);
    });

    await t.test("includes operation name in error context", () => {
      assert.throws(
        () => parseAction("invalid", { opName: "testOperation" }),
        /Invalid action code.*testOperation/,
      );
    });
  });

  await t.test("type guards", async (t) => {
    await t.test("isSuccessResponse", () => {
      const success = { ok: true as const, payload: "test" };
      const error = { ok: false as const, code: -1, message: "error" };

      assert.equal(isSuccessResponse(success), true);
      assert.equal(isSuccessResponse(error), false);
    });

    await t.test("isErrorResponse", () => {
      const success = { ok: true as const, payload: "test" };
      const error = { ok: false as const, code: -1, message: "error" };

      assert.equal(isErrorResponse(success), false);
      assert.equal(isErrorResponse(error), true);
    });
  });

  await t.test("getErrorMessage", async (t) => {
    await t.test("returns known error message", () => {
      const message = getErrorMessage(
        AS_ERROR_CODES.TIMEOUT_APPLE_EVENT,
        "raw message",
      );
      assert.equal(message, "AppleScript timed out waiting for Apple Event");
    });

    await t.test("returns raw message for unknown code", () => {
      const message = getErrorMessage(-9999, "custom error");
      assert.equal(message, "custom error");
    });

    await t.test("returns fallback for unknown code with empty message", () => {
      const message = getErrorMessage(-9999, "");
      assert.equal(message, "Unknown error");
    });

    await t.test("returns fallback for unknown code with null message", () => {
      const message = getErrorMessage(-9999, null as any);
      assert.equal(message, "Unknown error");
    });

    await t.test(
      "returns fallback for unknown code with undefined message",
      () => {
        const message = getErrorMessage(-9999, undefined as any);
        assert.equal(message, "Unknown error");
      },
    );

    await t.test("handles all known error codes", () => {
      const codes = [
        AS_ERROR_CODES.TIMEOUT_APPLE_EVENT,
        AS_ERROR_CODES.MISSING_RETURN,
        AS_ERROR_CODES.INVALID_RETURN_TYPE_ROWS,
        AS_ERROR_CODES.INVALID_RETURN_TYPE_SECTIONS,
        AS_ERROR_CODES.INVALID_ACTION_CODE,
        AS_ERROR_CODES.INVALID_RETURN_TYPE_SCALAR,
      ];

      for (const code of codes) {
        const message = getErrorMessage(code, "fallback");
        assert.ok(message.length > 0);
        assert.notEqual(message, "fallback");
        assert.notEqual(message, "Unknown error");
      }
    });
  });

  await t.test("edge cases and robustness", async (t) => {
    await t.test("handles very long payloads", () => {
      const longPayload = "x".repeat(10000);
      const result = parseScalar(longPayload);
      assert.equal(result, longPayload);
    });

    await t.test("handles payloads with all separator characters", () => {
      const payload = `field${GS}${RS}${US}`;
      const result = parseScalar(payload);
      assert.equal(result, payload);
    });

    await t.test("parseRows handles malformed data gracefully", () => {
      const payload = `${RS}${RS}${US}${US}field${RS}${US}`;
      const result = parseRows(payload);
      // Should not crash and return some reasonable result
      assert.ok(Array.isArray(result));
    });

    await t.test("parseSections handles malformed data gracefully", () => {
      const payload = `${GS}${GS}${US}${US}section${GS}${US}`;
      const result = parseSections(payload);
      // Should not crash and return some reasonable result
      assert.ok(typeof result === "object");
    });

    await t.test("handles Unicode in all parsers", () => {
      const unicode = "Hello 世界 🌍";

      assert.equal(parseScalar(unicode), unicode);

      const rowsResult = parseRows(unicode);
      assert.deepEqual(rowsResult, [[unicode]]);

      const sectionsPayload = `section${US}${unicode}`;
      const sectionsResult = parseSections(sectionsPayload);
      assert.deepEqual(sectionsResult, { section: [unicode] });
    });

    await t.test("handles control characters in payloads", () => {
      const controlChars = "\x00\x01\x02\x1F";

      assert.equal(parseScalar(controlChars), controlChars);

      const rowsResult = parseRows(controlChars);
      assert.deepEqual(rowsResult, [[controlChars]]);
    });
  });
});
