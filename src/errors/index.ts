/**
 * @fileoverview Custom error classes for the AppleScript library.
 *
 * This module defines a hierarchy of error types that provide
 * detailed information about what went wrong during script execution.
 */
import { AS_ERROR_CODES } from "../engine/protocol/constants.js";

/**
 * Base error class for all AppleScript-related errors.
 *
 * @public
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
 *
 * @public
 */
export class TimeoutAppleEventError extends AppleScriptError {
  /**
   * @remarks
   * Thrown by AppleScript when the target application does not respond to an Apple Event
   * within the AppleScript timeout window. Consider increasing `timeoutSec` or checking
   * that the app is launched and responsive.
   */
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
 *
 * @public
 */
export class TimeoutOSAScriptError extends AppleScriptError {
  /**
   * @remarks
   * Enforced by Node.js controller. Indicates the outer process exceeded
   * `controllerTimeoutMs`. Increase the controller timeout or optimize the script.
   */
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
 *
 * @public
 */
export class MissingReturnError extends AppleScriptError {
  /**
   * @remarks
   * The user AppleScript did not return a value. Ensure the script body contains
   * a `return` statement compatible with the selected payload kind.
   */
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
 *
 * @public
 */
export class InvalidReturnTypeError extends AppleScriptError {
  /**
   * @remarks
   * The returned AppleScript value did not match the protocol expectations.
   * For example: rows require a list of lists; sections require a list of pairs; scalar expects a primitive.
   */
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
 *
 * @public
 */
export class InvalidActionCodeError extends AppleScriptError {
  /**
   * @remarks
   * Action operations must return one of the {@link ACTION_CODES} values ("0" | "1" | "2").
   */
  constructor(
    public readonly receivedCode: string,
    public readonly operationName: string,
  ) {
    super(
      `Invalid action code: ${receivedCode} (operation: ${operationName})`,
      "InvalidActionCodeError",
    );
    this.name = "InvalidActionCodeError";
  }
}

/**
 * Generic script execution error.
 *
 * @public
 */
export class ScriptError extends AppleScriptError {
  /**
   * @remarks
   * Represents an error originating from AppleScript. Includes the numeric code when available.
   */
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
 *
 * @public
 */
export class ParseError extends AppleScriptError {
  /**
   * @remarks
   * The stdout from `osascript` did not match the expected OK/ERR protocol. Inspect `rawOutput`.
   */
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
 *
 * @public
 */
export class InputValidationError extends AppleScriptError {
  /**
   * @remarks
   * Zod validation failed for the input parameters. Inspect `issues` for details.
   */
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
 *
 * @public
 */
export class OutputValidationError extends AppleScriptError {
  /**
   * @remarks
   * Zod validation failed for the output payload. Inspect `issues` for details.
   */
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
 *
 * @public
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
 *
 * @public
 */
export function isAppleScriptError(error: unknown): error is AppleScriptError {
  /**
   * @example
   * ```ts
   * try {
   *   // ...
   * } catch (e) {
   *   if (isAppleScriptError(e)) console.error(e.kind)
   * }
   * ```
   */
  return error instanceof AppleScriptError;
}

/**
 * Type guard to check if an error is a timeout error.
 *
 * @public
 */
export function isTimeoutError(
  error: unknown,
): error is TimeoutAppleEventError | TimeoutOSAScriptError {
  /**
   * @example
   * ```ts
   * const r = await runner.run(op, input)
   * if (!r.ok && isTimeoutError(r.error.cause)) {
   *   // adjust timeouts or retry
   * }
   * ```
   */
  return (
    error instanceof TimeoutAppleEventError ||
    error instanceof TimeoutOSAScriptError
  );
}

/**
 * Gets a user-friendly error message from any error.
 *
 * @public
 */
export function getUserFriendlyMessage(error: unknown): string {
  /**
   * @example
   * ```ts
   * const msg = getUserFriendlyMessage(err)
   * console.log(msg)
   * ```
   */
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
