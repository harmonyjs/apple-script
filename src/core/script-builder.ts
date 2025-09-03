/**
 * @fileoverview AppleScript template builder.
 *
 * This module assembles the complete AppleScript by combining:
 * 1. Standard prologue with helper functions
 * 2. Marshalled parameters
 * 3. User-provided script body
 * 4. Error handling and response formatting
 *
 * The template ensures consistent error handling and output format
 * across all operations.
 */
import {
  ACTION_CODES,
  AS_ERROR_CODES,
  GS,
  PayloadKind,
  RS,
  US,
} from "./constants.js";
import type { MarshalledParam } from "./marshaller.js";
import { generatePrologue } from "./marshaller.js";

/**
 * Options for building an AppleScript
 */
export interface ScriptBuildOptions {
  /**
   * Application bundle ID to target
   */
  appId: string;

  /**
   * Payload encoding mode
   */
  kind: PayloadKind;

  /**
   * User script body (uses ${varName} for parameters)
   */
  userScript: string;

  /**
   * Marshalled parameters
   */
  params: MarshalledParam[];

  /**
   * AppleScript timeout in seconds
   */
  timeoutSec?: number;

  /**
   * Whether to ensure app is ready before execution
   */
  ensureReady?: boolean;
}

/**
 * Generates the standard prologue with helper functions.
 * This is the same for all scripts and provides encoding utilities.
 *
 * Important AppleScript gotcha:
 * - Do NOT use the identifier "items" as a formal parameter name in handlers.
 *   AppleScript treats it specially and raises:
 *   "syntax error: items is illegal as a formal parameter. (-2761)".
 *   We therefore use `listItems` instead.
 */
function generateStandardPrologue(): string {
  return `-- Standard helpers
-- NOTE: Do NOT name handler parameters "items"; it's illegal as a formal parameter (-2761).
-- We intentionally use 'listItems' to avoid the parser trap.
on __join__(listItems, sep)
	set out to ""
  repeat with i from 1 to count of listItems
    set itemText to item i of listItems
		if i is 1 then
			set out to itemText
		else
			set out to out & sep & itemText
		end if
	end repeat
	return out
end __join__`;
}

/**
 * Generates the user function wrapper with timeout and tell block.
 *
 * @param appId - Application bundle ID
 * @param userScript - User script body (with ${varName} already replaced)
 * @param timeoutSec - Timeout in seconds
 */
function generateUserFunction(
  appId: string,
  userScript: string,
  timeoutSec: number,
): string {
  return `on __user_fn__()
	with timeout of ${timeoutSec} seconds
		tell application id "${appId}"
${userScript
  .split("\n")
  .map((l) => (l ? "      " + l : ""))
  .join("\n")}
		end tell
	end timeout
end __user_fn__`;
}

/**
 * Generates the operation wrapper that handles return value encoding.
 * Different encoding logic based on the payload kind.
 */
function generateOperationWrapper(kind: PayloadKind): string {
  if (kind === "scalar") {
    return `on __run__()
	set __val__ to __user_fn__()
	if __val__ is missing value then error ${AS_ERROR_CODES.MISSING_RETURN}
	return "OK" & "${GS}" & __val__ as text
end __run__`;
  }
  if (kind === "action") {
    return `on __run__()
	set __val__ to __user_fn__()
	if __val__ is missing value then error ${AS_ERROR_CODES.MISSING_RETURN}
	set __code__ to (__val__ as text)
	if __code__ is not in {"${ACTION_CODES.FAILURE}", "${ACTION_CODES.SUCCESS}", "${ACTION_CODES.PARTIAL}"} then error ${AS_ERROR_CODES.INVALID_ACTION_CODE}
	return "OK" & "${GS}" & __code__
end __run__`;
  }
  if (kind === "rows") {
    return `on __run__()
	set __rows__ to __user_fn__()
	if class of __rows__ is not list then error ${AS_ERROR_CODES.INVALID_RETURN_TYPE_ROWS}
	set __encoded__ to {}
	repeat with r in __rows__
		set __fields__ to {}
		repeat with f in r
			set end of __fields__ to (f as text)
		end repeat
		set end of __encoded__ to my __join__(__fields__, "${US}")
	end repeat
	return "OK" & "${GS}" & my __join__(__encoded__, "${RS}")
end __run__`;
  }
  // sections
  return `on __run__()
	set __sections__ to __user_fn__()
	if class of __sections__ is not list then error ${AS_ERROR_CODES.INVALID_RETURN_TYPE_SECTIONS}
	set __encoded__ to {}
	repeat with s in __sections__
		set __name__ to item 1 of s
		set __items__ to item 2 of s
		if class of __items__ is not list then set __items__ to {__items__}
		set __text_items__ to {}
		repeat with it in __items__
			set end of __text_items__ to (it as text)
		end repeat
		set end of __encoded__ to ((__name__ as text) & "${US}" & my __join__(__text_items__, "${US}"))
	end repeat
	return "OK" & "${GS}" & my __join__(__encoded__, "${GS}")
end __run__`;
}

/**
 * Generates the app readiness check.
 * Ensures the application is running and responsive before executing the script.
 */
function generateAppReadiness(appId: string): string {
  return `-- Ensure app is running
tell application id "${appId}" to launch
delay 0.1`;
}

/**
 * Generates the main error handling wrapper.
 * This catches all errors and formats them according to the protocol.
 */
function generateMainWrapper(appId: string, ensureReady: boolean): string {
  return `on __main__()
	try
${
  ensureReady
    ? generateAppReadiness(appId)
        .split("\n")
        .map((l) => "    " + l)
        .join("\n") + "\n"
    : ""
}
		return __run__()
	on error errMsg number errNum
		return "ERR" & "${GS}" & errNum & "${GS}" & (errMsg as text)
	end try
end __main__
__main__()`;
}

/**
 * Replaces parameter placeholders in the user script.
 * Converts ${paramName} to the actual AppleScript variable name.
 *
 * @param userScript - Script with ${paramName} placeholders
 * @param params - Marshalled parameters
 * @returns Script with placeholders replaced
 */
function replaceParameterPlaceholders(
  userScript: string,
  params: MarshalledParam[],
): string {
  let result = userScript;
  for (const p of params) {
    // Replace template placeholders like ${param}
    result = result.split(`\${${p.paramName}}`).join(p.varName);
  }
  return result;
}

/**
 * Builds the complete AppleScript from components.
 */
export function buildAppleScript(options: ScriptBuildOptions): string {
  const {
    appId,
    kind,
    userScript,
    params,
    timeoutSec = 12,
    ensureReady = true,
  } = options;
  const prologue = generateStandardPrologue();
  const paramBlock = generatePrologue(params);
  const body = replaceParameterPlaceholders(userScript.trim(), params);
  const userFn = generateUserFunction(appId, body, timeoutSec);
  const opWrapper = generateOperationWrapper(kind);
  const main = generateMainWrapper(appId, ensureReady);

  return [prologue, paramBlock, userFn, opWrapper, main]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Validates that a user script has proper return statements.
 * This is a simple heuristic check, not a full parser.
 * Tries to avoid false positives from comments and strings.
 */
export function hasReturnStatement(script: string): boolean {
  const lines = script.split("\n");

  for (const line of lines) {
    const trimmed = line.trim().toLowerCase();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("--")) continue;

    // Skip lines with quotes (to avoid strings)
    if (trimmed.includes('"') || trimmed.includes("'")) continue;

    // Look for return statement at start of line (after whitespace)
    if (trimmed.startsWith("return ") || trimmed === "return") {
      return true;
    }

    // Also check for return after other keywords like "then return"
    if (
      /\bthen\s+return\b/.test(trimmed) ||
      /\belse\s+return\b/.test(trimmed)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Warns if a script might be missing return statements.
 * This helps catch common user errors.
 */
export function validateUserScript(script: string, _kind: PayloadKind): void {
  if (!hasReturnStatement(script)) {
    // Intentionally not throwing; let runtime validation handle
    // eslint-disable-next-line no-console
    console.warn("AppleScript user script may be missing a return statement.");
  }
}
