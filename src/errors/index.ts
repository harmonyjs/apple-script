/**
 * @fileoverview Custom error classes for the AppleScript library.
 *
 * This module defines a hierarchy of error types that provide
 * detailed information about what went wrong during script execution.
 */
import { AS_ERROR_CODES } from "../core/constants";

/**
 * Base error class for all AppleScript-related errors.
 */
export class AppleScriptError extends Error {
  constructor(
    message: string,
    public readonly kind: string,
  ) {
    super(message);
    this.name = "AppleScriptError";
  }
}

/**
 * Error thrown when AppleScript times out waiting for an Apple Event.
 * This typically happens when the target application is unresponsive.
 */
export class TimeoutAppleEventError extends AppleScriptError {
  constructor(
    message: string = "AppleScript timed out waiting for Apple Event",
    public readonly appId: string,
    public readonly operationName: string,
  ) {
    super(message, "TimeoutAppleEventError");
    this.name = "TimeoutAppleEventError";
  }
}

/**
 * Error thrown when the Node.js controller times out.
 * This is different from AppleScript timeout - it's enforced by Node.js.
 */
export class TimeoutOSAScriptError extends AppleScriptError {
  constructor(
    message: string,
    public readonly appId: string,
    public readonly operationName: string,
    public readonly timeoutMs: number,
  ) {
    super(message, "TimeoutOSAScriptError");
    this.name = "TimeoutOSAScriptError";
  }
}

/**
 * Error thrown when a script doesn't return a value.
 */
export class MissingReturnError extends AppleScriptError {
  constructor(
    message: string = "Script did not return a value",
    public readonly operationName: string,
  ) {
    super(message, "MissingReturnError");
    this.name = "MissingReturnError";
  }
}

/**
 * Error thrown when the return type doesn't match the expected format.
 */
export class InvalidReturnTypeError extends AppleScriptError {
  constructor(
    message: string,
    public readonly expectedType: string,
    public readonly operationName: string,
  ) {
    super(message, "InvalidReturnTypeError");
    this.name = "InvalidReturnTypeError";
  }
}

/**
 * Error thrown when an action returns an invalid code.
 */
export class InvalidActionCodeError extends AppleScriptError {
  constructor(
    public readonly receivedCode: string,
    public readonly operationName: string,
  ) {
    super(`Invalid action code: ${receivedCode} (operation: ${operationName})`, "InvalidActionCodeError");
    this.name = "InvalidActionCodeError";
  }
}

/**
 * Generic script execution error.
 */
export class ScriptError extends AppleScriptError {
  constructor(
    message: string,
    public readonly code: number,
    public readonly operationName: string,
    public readonly rawMessage?: string,
  ) {
    super(message, "ScriptError");
    this.name = "ScriptError";
  }
}

/**
 * Error thrown when the protocol response cannot be parsed.
 */
export class ParseError extends AppleScriptError {
  constructor(
    message: string,
    public readonly rawOutput: string,
    public readonly operationName: string,
  ) {
    super(message, "ParseError");
    this.name = "ParseError";
  }
}

/**
 * Error thrown when input validation fails.
 */
export class InputValidationError extends AppleScriptError {
  constructor(
    message: string,
    public readonly issues: unknown[],
    public readonly operationName: string,
  ) {
    super(message, "InputValidationError");
    this.name = "InputValidationError";
  }
}

/**
 * Error thrown when output validation fails.
 */
export class OutputValidationError extends AppleScriptError {
  constructor(
    message: string,
    public readonly issues: unknown[],
    public readonly operationName: string,
  ) {
    super(message, "OutputValidationError");
    this.name = "OutputValidationError";
  }
}

/**
 * Creates an appropriate error instance based on the error code.
 */
export function createErrorFromCode(
  code: number,
  message: string,
  operationName: string,
  appId: string,
): AppleScriptError {
  switch (code) {
    case AS_ERROR_CODES.TIMEOUT_APPLE_EVENT:
      return new TimeoutAppleEventError(undefined, appId, operationName);
    case AS_ERROR_CODES.MISSING_RETURN:
      return new MissingReturnError(undefined, operationName);
    case AS_ERROR_CODES.INVALID_ACTION_CODE:
      return new InvalidActionCodeError("unknown", operationName);
    case AS_ERROR_CODES.INVALID_RETURN_TYPE_ROWS:
    case AS_ERROR_CODES.INVALID_RETURN_TYPE_SECTIONS:
    case AS_ERROR_CODES.INVALID_RETURN_TYPE_SCALAR:
      return new InvalidReturnTypeError(
        message,
        "protocol expected type",
        operationName,
      );
    default:
      return new ScriptError(message, code, operationName, message);
  }
}

/**
 * Type guard to check if an error is an AppleScriptError.
 */
export function isAppleScriptError(error: unknown): error is AppleScriptError {
  return error instanceof AppleScriptError;
}

/**
 * Type guard to check if an error is a timeout error.
 */
export function isTimeoutError(
  error: unknown,
): error is TimeoutAppleEventError | TimeoutOSAScriptError {
  return (
    error instanceof TimeoutAppleEventError ||
    error instanceof TimeoutOSAScriptError
  );
}

/**
 * Gets a user-friendly error message from any error.
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error === null) return "null";
  if (error === undefined) return "undefined";
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
