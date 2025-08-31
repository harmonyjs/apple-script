/**
 * @fileoverview Unit tests for errors module.
 * 
 * Tests all error types, error factories, type guards, and user-friendly messages.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  AppleScriptError,
  TimeoutAppleEventError,
  TimeoutOSAScriptError,
  MissingReturnError,
  InvalidReturnTypeError,
  InvalidActionCodeError,
  ScriptError,
  ParseError,
  InputValidationError,
  OutputValidationError,
  createErrorFromCode,
  isAppleScriptError,
  isTimeoutError,
  getUserFriendlyMessage,
} from "./index.js";
import { AS_ERROR_CODES } from "../core/constants.js";

test("errors", async (t) => {
  await t.test("AppleScriptError base class", async (t) => {
    await t.test("creates basic AppleScript error", () => {
      const error = new AppleScriptError("Test error", "TestError");
      
      assert.equal(error.name, "AppleScriptError");
      assert.equal(error.message, "Test error");
      assert.equal(error.kind, "TestError");
      assert.ok(error instanceof Error);
      assert.ok(error instanceof AppleScriptError);
    });

    await t.test("has proper stack trace", () => {
      const error = new AppleScriptError("Test error", "TestError");
      
      assert.ok(error.stack);
      assert.ok(error.stack.includes("AppleScriptError"));
    });
  });

  await t.test("TimeoutAppleEventError", async (t) => {
    await t.test("creates timeout apple event error", () => {
      const error = new TimeoutAppleEventError("Timeout occurred", "com.apple.Safari", "testOp");
      
      assert.equal(error.name, "TimeoutAppleEventError");
      assert.equal(error.message, "Timeout occurred");
      assert.equal(error.appId, "com.apple.Safari");
      assert.equal(error.operationName, "testOp");
      assert.equal(error.kind, "TimeoutAppleEventError");
      assert.ok(error instanceof AppleScriptError);
      assert.ok(error instanceof TimeoutAppleEventError);
    });

    await t.test("uses default message when not provided", () => {
      const error = new TimeoutAppleEventError(undefined, "com.apple.Safari", "testOp");
      assert.equal(error.message, "AppleScript timed out waiting for Apple Event");
    });
  });

  await t.test("TimeoutOSAScriptError", async (t) => {
    await t.test("creates timeout osascript error", () => {
      const error = new TimeoutOSAScriptError("OSA timeout", "com.apple.Safari", "testOp", 30000);
      
      assert.equal(error.name, "TimeoutOSAScriptError");
      assert.equal(error.message, "OSA timeout");
      assert.equal(error.appId, "com.apple.Safari");
      assert.equal(error.operationName, "testOp");
      assert.equal(error.timeoutMs, 30000);
      assert.equal(error.kind, "TimeoutOSAScriptError");
      assert.ok(error instanceof AppleScriptError);
      assert.ok(error instanceof TimeoutOSAScriptError);
    });
  });

  await t.test("MissingReturnError", async (t) => {
    await t.test("creates missing return error", () => {
      const error = new MissingReturnError("No return value", "testOp");
      
      assert.equal(error.name, "MissingReturnError");
      assert.equal(error.message, "No return value");
      assert.equal(error.operationName, "testOp");
      assert.equal(error.kind, "MissingReturnError");
      assert.ok(error instanceof AppleScriptError);
      assert.ok(error instanceof MissingReturnError);
    });

    await t.test("uses default message when not provided", () => {
      const error = new MissingReturnError(undefined, "testOp");
      assert.equal(error.message, "Script did not return a value");
    });
  });

  await t.test("InvalidReturnTypeError", async (t) => {
    await t.test("creates invalid return type error", () => {
      const error = new InvalidReturnTypeError("Wrong type", "list", "testOp");
      
      assert.equal(error.name, "InvalidReturnTypeError");
      assert.equal(error.message, "Wrong type");
      assert.equal(error.expectedType, "list");
      assert.equal(error.operationName, "testOp");
      assert.equal(error.kind, "InvalidReturnTypeError");
      assert.ok(error instanceof AppleScriptError);
      assert.ok(error instanceof InvalidReturnTypeError);
    });
  });

  await t.test("InvalidActionCodeError", async (t) => {
    await t.test("creates invalid action code error", () => {
      const error = new InvalidActionCodeError("5", "testOp");
      
      assert.equal(error.name, "InvalidActionCodeError");
      assert.equal(error.message, "Invalid action code: 5 (operation: testOp)");
      assert.equal(error.receivedCode, "5");
      assert.equal(error.operationName, "testOp");
      assert.equal(error.kind, "InvalidActionCodeError");
      assert.ok(error instanceof AppleScriptError);
      assert.ok(error instanceof InvalidActionCodeError);
    });

    await t.test("handles empty action code", () => {
      const error = new InvalidActionCodeError("", "testOp");
      assert.equal(error.message, "Invalid action code:  (operation: testOp)");
      assert.equal(error.receivedCode, "");
    });
  });

  await t.test("ScriptError", async (t) => {
    await t.test("creates script error", () => {
      const error = new ScriptError("Script failed", -1712, "testOp", "Raw message");
      
      assert.equal(error.name, "ScriptError");
      assert.equal(error.message, "Script failed");
      assert.equal(error.code, -1712);
      assert.equal(error.operationName, "testOp");
      assert.equal(error.rawMessage, "Raw message");
      assert.equal(error.kind, "ScriptError");
      assert.ok(error instanceof AppleScriptError);
      assert.ok(error instanceof ScriptError);
    });

    await t.test("works without raw message", () => {
      const error = new ScriptError("Script failed", -1712, "testOp");
      
      assert.equal(error.rawMessage, undefined);
    });
  });

  await t.test("ParseError", async (t) => {
    await t.test("creates parse error", () => {
      const error = new ParseError("Parse failed", "invalid response", "testOp");
      
      assert.equal(error.name, "ParseError");
      assert.equal(error.message, "Parse failed");
      assert.equal(error.rawOutput, "invalid response");
      assert.equal(error.operationName, "testOp");
      assert.equal(error.kind, "ParseError");
      assert.ok(error instanceof AppleScriptError);
      assert.ok(error instanceof ParseError);
    });
  });

  await t.test("InputValidationError", async (t) => {
    await t.test("creates input validation error", () => {
      const issues = [
        { path: ["name"], message: "Required" },
        { path: ["age"], message: "Must be positive" },
      ];
      const error = new InputValidationError("Validation failed", issues, "testOp");
      
      assert.equal(error.name, "InputValidationError");
      assert.equal(error.message, "Validation failed");
      assert.equal(error.operationName, "testOp");
      assert.deepEqual(error.issues, issues);
      assert.equal(error.kind, "InputValidationError");
      assert.ok(error instanceof AppleScriptError);
      assert.ok(error instanceof InputValidationError);
    });

    await t.test("handles empty issues array", () => {
      const error = new InputValidationError("Validation failed", [], "testOp");
      assert.deepEqual(error.issues, []);
    });
  });

  await t.test("OutputValidationError", async (t) => {
    await t.test("creates output validation error", () => {
      const issues = [
        { path: ["result"], message: "Invalid format" },
      ];
      const error = new OutputValidationError("Output validation failed", issues, "testOp");
      
      assert.equal(error.name, "OutputValidationError");
      assert.equal(error.message, "Output validation failed");
      assert.equal(error.operationName, "testOp");
      assert.deepEqual(error.issues, issues);
      assert.equal(error.kind, "OutputValidationError");
      assert.ok(error instanceof AppleScriptError);
      assert.ok(error instanceof OutputValidationError);
    });
  });

  await t.test("createErrorFromCode", async (t) => {
    await t.test("creates TimeoutAppleEventError for timeout code", () => {
      const error = createErrorFromCode(AS_ERROR_CODES.TIMEOUT_APPLE_EVENT, "Timeout", "testOp", "com.apple.Safari");
      
      assert.ok(error instanceof TimeoutAppleEventError);
      assert.equal(error.message, "AppleScript timed out waiting for Apple Event"); // Uses default message
      assert.equal(error.operationName, "testOp");
      assert.equal(error.appId, "com.apple.Safari");
    });

    await t.test("creates MissingReturnError for missing return code", () => {
      const error = createErrorFromCode(AS_ERROR_CODES.MISSING_RETURN, "No return", "testOp", "com.apple.Safari");
      
      assert.ok(error instanceof MissingReturnError);
      assert.equal(error.message, "Script did not return a value"); // Uses default message
      assert.equal(error.operationName, "testOp");
    });

    await t.test("creates InvalidReturnTypeError for invalid return type codes", () => {
      const rowsError = createErrorFromCode(AS_ERROR_CODES.INVALID_RETURN_TYPE_ROWS, "Wrong type", "testOp", "app");
      assert.ok(rowsError instanceof InvalidReturnTypeError);
      assert.equal(rowsError.expectedType, "protocol expected type");
      assert.equal(rowsError.message, "Wrong type");
      
      const sectionsError = createErrorFromCode(AS_ERROR_CODES.INVALID_RETURN_TYPE_SECTIONS, "Wrong type", "testOp", "app");
      assert.ok(sectionsError instanceof InvalidReturnTypeError);
      assert.equal(sectionsError.expectedType, "protocol expected type");
      
      const scalarError = createErrorFromCode(AS_ERROR_CODES.INVALID_RETURN_TYPE_SCALAR, "Wrong type", "testOp", "app");
      assert.ok(scalarError instanceof InvalidReturnTypeError);
      assert.equal(scalarError.expectedType, "protocol expected type");
    });

    await t.test("creates InvalidActionCodeError for invalid action code", () => {
      const error = createErrorFromCode(AS_ERROR_CODES.INVALID_ACTION_CODE, "Invalid code", "testOp", "app");
      
      assert.ok(error instanceof InvalidActionCodeError);
      assert.equal(error.receivedCode, "unknown");
      assert.equal(error.operationName, "testOp");
    });

    await t.test("creates ScriptError for unknown codes", () => {
      const error = createErrorFromCode(-9999, "Unknown error", "testOp", "com.apple.Safari");
      
      assert.ok(error instanceof ScriptError);
      assert.ok(!(error instanceof TimeoutAppleEventError));
      assert.ok(!(error instanceof MissingReturnError));
      assert.equal(error.message, "Unknown error");
      assert.equal(error.code, -9999);
      assert.equal(error.operationName, "testOp");
      assert.equal(error.rawMessage, "Unknown error");
    });
  });

  await t.test("type guards", async (t) => {
    await t.test("isAppleScriptError", () => {
      const appleError = new AppleScriptError("Test", "TestError");
      const timeoutError = new TimeoutAppleEventError("Timeout", "app", "op");
      const regularError = new Error("Regular error");
      
      assert.equal(isAppleScriptError(appleError), true);
      assert.equal(isAppleScriptError(timeoutError), true);
      assert.equal(isAppleScriptError(regularError), false);
      assert.equal(isAppleScriptError(null), false);
      assert.equal(isAppleScriptError(undefined), false);
      assert.equal(isAppleScriptError("string"), false);
    });

    await t.test("isTimeoutError", () => {
      const timeoutAppleEvent = new TimeoutAppleEventError("Timeout", "app", "op");
      const timeoutOSAScript = new TimeoutOSAScriptError("Timeout", "app", "op", 5000);
      const regularAppleError = new AppleScriptError("Error", "TestError");
      const regularError = new Error("Error");
      
      assert.equal(isTimeoutError(timeoutAppleEvent), true);
      assert.equal(isTimeoutError(timeoutOSAScript), true);
      assert.equal(isTimeoutError(regularAppleError), false);
      assert.equal(isTimeoutError(regularError), false);
      assert.equal(isTimeoutError(null), false);
    });
  });

  await t.test("getUserFriendlyMessage", async (t) => {
    await t.test("returns message for Error instances", () => {
      const error = new Error("Test error");
      const message = getUserFriendlyMessage(error);
      
      assert.equal(message, "Test error");
    });

    await t.test("returns message for AppleScript errors", () => {
      const error = new AppleScriptError("AppleScript error", "TestError");
      const message = getUserFriendlyMessage(error);
      
      assert.equal(message, "AppleScript error");
    });

    await t.test("returns message for timeout errors", () => {
      const timeoutError = new TimeoutAppleEventError("Timeout occurred", "com.apple.Safari", "testOp");
      const message = getUserFriendlyMessage(timeoutError);
      
      assert.equal(message, "Timeout occurred");
    });

    await t.test("handles non-Error objects", () => {
      const message1 = getUserFriendlyMessage("string error");
      assert.equal(message1, "string error");
      
      const message2 = getUserFriendlyMessage(42);
      assert.equal(message2, "42");
      
      const message3 = getUserFriendlyMessage({ error: "object error" });
      assert.equal(message3, '{"error":"object error"}');
    });

    await t.test("handles null and undefined", () => {
      const message1 = getUserFriendlyMessage(null);
      assert.equal(message1, "null");
      
      const message2 = getUserFriendlyMessage(undefined);
      assert.equal(message2, "undefined");
    });

    await t.test("handles circular references", () => {
      const circular: any = { name: "test" };
      circular.self = circular;
      
      const message = getUserFriendlyMessage(circular);
      assert.equal(message, "[object Object]"); // Falls back to String() when JSON.stringify fails
    });
  });

  await t.test("error inheritance and properties", async (t) => {
    await t.test("all error types inherit from AppleScriptError", () => {
      const errors = [
        new TimeoutAppleEventError("msg", "app", "op"),
        new TimeoutOSAScriptError("msg", "app", "op", 5000),
        new MissingReturnError("msg", "op"),
        new InvalidReturnTypeError("msg", "type", "op"),
        new InvalidActionCodeError("code", "op"),
        new ScriptError("msg", -1, "op"),
        new ParseError("msg", "raw", "op"),
        new InputValidationError("msg", [], "op"),
        new OutputValidationError("msg", [], "op"),
      ];

      for (const error of errors) {
        assert.ok(error instanceof AppleScriptError);
        assert.ok(error instanceof Error);
        assert.ok(error.name);
        assert.ok(error.message);
        assert.ok(error.operationName);
        assert.ok(error.kind);
      }
    });

    await t.test("error properties are preserved", () => {
      const timeoutError = new TimeoutOSAScriptError("Timeout", "app", "op", 5000);
      const validationError = new InputValidationError("Invalid", [{ path: ["x"], message: "bad" }], "op");
      const actionError = new InvalidActionCodeError("9", "op");
      
      assert.equal(timeoutError.timeoutMs, 5000);
      assert.equal(validationError.issues.length, 1);
      assert.equal(actionError.receivedCode, "9");
    });

    await t.test("error kinds are correctly assigned", () => {
      const errors = [
        { error: new TimeoutAppleEventError("", "app", "op"), expectedKind: "TimeoutAppleEventError" },
        { error: new MissingReturnError("", "op"), expectedKind: "MissingReturnError" },
        { error: new InvalidReturnTypeError("", "type", "op"), expectedKind: "InvalidReturnTypeError" },
        { error: new InvalidActionCodeError("", "op"), expectedKind: "InvalidActionCodeError" },
        { error: new ScriptError("", -1, "op"), expectedKind: "ScriptError" },
        { error: new ParseError("", "raw", "op"), expectedKind: "ParseError" },
        { error: new InputValidationError("", [], "op"), expectedKind: "InputValidationError" },
        { error: new OutputValidationError("", [], "op"), expectedKind: "OutputValidationError" },
      ];

      for (const { error, expectedKind } of errors) {
        assert.equal(error.kind, expectedKind);
      }
    });
  });

  await t.test("edge cases", async (t) => {
    await t.test("handles very long error messages", () => {
      const longMessage = "x".repeat(10000);
      const error = new AppleScriptError(longMessage, "TestError");
      
      assert.equal(error.message, longMessage);
      assert.ok(getUserFriendlyMessage(error).length > 0);
    });

    await t.test("handles special characters in error messages", () => {
      const specialMessage = 'Error with "quotes" and \n newlines \t tabs';
      const error = new AppleScriptError(specialMessage, "TestError");
      
      assert.equal(error.message, specialMessage);
    });

    await t.test("handles Unicode in error messages", () => {
      const unicodeMessage = "Error: 世界 🌍 failed";
      const error = new AppleScriptError(unicodeMessage, "TestError");
      
      assert.equal(error.message, unicodeMessage);
      assert.ok(getUserFriendlyMessage(error).includes("世界"));
    });

    await t.test("handles empty and null values gracefully", () => {
      const error1 = new AppleScriptError("", "");
      const error2 = new InvalidActionCodeError("", "");
      
      assert.equal(error1.message, "");
      assert.equal(error1.kind, "");
      
      assert.equal(error2.message, "Invalid action code:  (operation: )"); // Should generate a message
      assert.equal(error2.receivedCode, "");
    });

    await t.test("handles complex validation issues", () => {
      const complexIssues = [
        { path: ["user", "profile", "name"], message: "Required field missing", code: "REQUIRED" },
        { path: ["user", "age"], message: "Must be between 0 and 120", code: "RANGE", min: 0, max: 120 },
        { path: ["settings", "theme"], message: "Invalid theme", code: "ENUM", allowed: ["light", "dark"] },
      ];
      
      const inputError = new InputValidationError("Complex validation failed", complexIssues, "validateUser");
      const outputError = new OutputValidationError("Complex output validation failed", complexIssues, "processUser");
      
      assert.equal(inputError.issues.length, 3);
      assert.equal(outputError.issues.length, 3);
      assert.deepEqual(inputError.issues, complexIssues);
      assert.deepEqual(outputError.issues, complexIssues);
    });
  });
});
