import { AS_ERROR_CODES } from "../engine/protocol/constants.js";
import { AppleScriptError } from "./base.js";
import { InvalidActionCodeError, ScriptError } from "./protocol.js";
import { MissingReturnError, InvalidReturnTypeError } from "./validation.js";
import { TimeoutAppleEventError, TimeoutOSAScriptError } from "./timeouts.js";

/**
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
      return new TimeoutAppleEventError(
        undefined,
        appId,
        operationName,
      );
    case AS_ERROR_CODES.MISSING_RETURN:
      return new MissingReturnError(
        undefined,
        operationName,
      );
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
 * @public
 */
export function isAppleScriptError(error: unknown): error is AppleScriptError {
  return error instanceof AppleScriptError;
}

/**
 * @public
 */
export function isTimeoutError(
  error: unknown,
): error is TimeoutAppleEventError | TimeoutOSAScriptError {
  return error instanceof TimeoutAppleEventError || error instanceof TimeoutOSAScriptError;
}

/**
 * @public
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
