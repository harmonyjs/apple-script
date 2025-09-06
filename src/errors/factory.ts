import { AS_ERROR_CODES, PayloadKind } from "../engine/protocol/constants.js";
import { ProtocolParseError } from "../engine/protocol/parser.js";
import { OSAScriptError } from "../engine/executor.js";
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

/**
 * Centralized mapping from internal exceptions to public error types.
 *
 * Why: Keeps a single source of truth for translating low-level parser/executor
 * failures (e.g., ProtocolParseError, OSAScriptError) into stable, documented
 * public errors. This avoids scattered instanceof checks and ensures consistent
 * user-facing behavior.
 *
 * Note: This does not handle protocol ERR codes (those go through createErrorFromCode).
 * It converts thrown exceptions during validation/parsing/execution into
 * AppleScriptError subclasses.
 *
 * @internal
 */
export function createPublicErrorFromUnknown(
  error: unknown,
  ctx: {
    operationName: string;
    appId: string;
    kind: PayloadKind;
    /** Controller timeout used for osascript execution; required to enrich timeout errors. */
    controllerTimeoutMs?: number;
  },
): AppleScriptError {
  // Pass-through already public errors
  if (error instanceof AppleScriptError) return error;

  // Protocol parsing failures: currently used for invalid action codes
  if (error instanceof ProtocolParseError) {
    const msg = String(error.message ?? "Invalid action code");
    const m = /Invalid action code:\s*(.+?)(?:\s|$)/i.exec(msg);
    const received = m?.[1] ?? "unknown";
    return new InvalidActionCodeError(received, ctx.operationName);
  }

  // Low-level osascript execution failures
  if (error instanceof OSAScriptError) {
    if (String(error.code) === "ETIMEDOUT") {
      return new TimeoutOSAScriptError(
        "osascript timed out",
        ctx.appId,
        ctx.operationName,
        ctx.controllerTimeoutMs ?? 0,
      );
    }
    // Map other executor failures to ScriptError with synthetic code -1
    return new ScriptError(
      error.message || "osascript execution failed",
      -1,
      ctx.operationName,
      error.message,
    );
  }

  // Fallback: wrap unknowns into a generic script error with code -1
  const message = error instanceof Error ? error.message : getUserFriendlyMessage(error);
  return new ScriptError(message, -1, ctx.operationName, message);
}
