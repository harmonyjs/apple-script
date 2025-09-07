/**
 * @fileoverview Protocol constants and error codes for AppleScript communication.
 *
 * This module defines the control characters used for structuring data exchange
 * between Node.js and AppleScript, as well as standardized error codes.
 *
 * The protocol uses ASCII control characters from the C0 set (0x00-0x1F)
 * which are guaranteed to not appear in normal text content.
 */

/**
 * Group Separator (GS) - ASCII 29 (0x1D)
 * Used to separate top-level sections in the protocol.
 * In responses: OK<GS>payload or ERR<GS>code<GS>message
 * In sections mode: separates named sections.
 *
 * @example
 * // Sections example: two sections "good" and "bad"
 * // Encoded as: "good"<US>"a"<US>"b"<GS>"bad"<US>"c"
 *
 * @public
 */
export const GS = String.fromCharCode(29);

/**
 * Record Separator (RS) - ASCII 30 (0x1E)
 * Used to separate records/rows in tabular data.
 * Each row in a table is separated by RS.
 *
 * @example
 * // Rows example: two rows with two fields each
 * // Encoded as: "A"<US>"1"<RS>"B"<US>"2"
 *
 * @public
 */
export const RS = String.fromCharCode(30);

/**
 * Unit Separator (US) - ASCII 31 (0x1F)
 * Used to separate fields within a record.
 * Each field in a row is separated by US.
 *
 * @example
 * // Rows example with two rows, two fields:
 * // field1<US>field2<RS>field3<US>field4
 *
 * @public
 */
export const US = String.fromCharCode(31);

/**
 * Error codes returned from AppleScript.
 * Negative numbers follow AppleScript convention.
 */
export const AS_ERROR_CODES = {
  /**
   * AppleScript timeout on Apple Event
   */
  TIMEOUT_APPLE_EVENT: -1712,

  /**
   * User script didn't return a value
   */
  MISSING_RETURN: -10001,

  /**
   * Invalid return type for rows mode
   */
  INVALID_RETURN_TYPE_ROWS: -10002,

  /**
   * Invalid return type for sections mode
   */
  INVALID_RETURN_TYPE_SECTIONS: -10003,

  /**
   * Invalid action code (not 0, 1, or 2)
   */
  INVALID_ACTION_CODE: -10004,

  /**
   * Invalid return type for scalar mode
   */
  INVALID_RETURN_TYPE_SCALAR: -10005,
} as const;

/**
 * Human-readable error messages for AS error codes
 */
export const AS_ERROR_MESSAGES: Record<number, string> = {
  [AS_ERROR_CODES.TIMEOUT_APPLE_EVENT]:
    "AppleScript timed out waiting for Apple Event",
  [AS_ERROR_CODES.MISSING_RETURN]: "Script did not return a value",
  [AS_ERROR_CODES.INVALID_RETURN_TYPE_ROWS]:
    "Invalid return type for rows mode (expected list)",
  [AS_ERROR_CODES.INVALID_RETURN_TYPE_SECTIONS]:
    "Invalid return type for sections mode (expected list of pairs)",
  [AS_ERROR_CODES.INVALID_ACTION_CODE]:
    'Invalid action code (expected "0", "1", or "2")',
  [AS_ERROR_CODES.INVALID_RETURN_TYPE_SCALAR]:
    "Invalid return type for scalar mode (expected text or primitive)",
};

/**
 * Payload kinds used by the wire protocol to encode return values.
 * @public
 */
export type PayloadKind = "scalar" | "rows" | "sections" | "action";

/**
 * Action codes for imperative operations
 *
 * @remarks
 * These codes are returned by {@link action} operations and validated by the protocol parser:
 * - FAILURE: "0" — the action failed or did nothing
 * - SUCCESS: "1" — the action completed successfully
 * - PARTIAL: "2" — the action partially completed; caller may decide to retry or follow up
 *
 * @see ACTION_OUTPUT_SCHEMA
 * @public
 */
export const ACTION_CODES = {
  FAILURE: "0",
  SUCCESS: "1",
  PARTIAL: "2",
} as const;

/**
 * String union of the ACTION_CODES values ("0" | "1" | "2").
 * @public
 */
export type ActionCode = (typeof ACTION_CODES)[keyof typeof ACTION_CODES];

/**
 * Default timeout configurations
 *
 * @remarks
 * Applied as the last-resort defaults. Precedence:
 * `RunOptions.timeoutSec` \> `RunnerConfig.timeoutByKind[kind]` \>
 * `RunnerConfig.defaultTimeoutSec` \> `DEFAULT_TIMEOUTS.APPLESCRIPT_SEC`.
 * Controller timeout follows the analogous chain for ms timeouts.
 *
 * @defaultValue
 * - APPLESCRIPT_SEC: 12 seconds
 * - CONTROLLER_MS: 15000 ms
 * - APP_READY_MS: 2000 ms
 * - APP_READY_CHECK_DELAY_MS: 100 ms
 *
 * @public
 */
export const DEFAULT_TIMEOUTS = {
  /**
   * Default AppleScript timeout in seconds
   */
  APPLESCRIPT_SEC: 12,

  /**
   * Default Node.js controller timeout in milliseconds
   */
  CONTROLLER_MS: 15000,

  /**
   * Timeout for ensuring app is ready (milliseconds)
   */
  APP_READY_MS: 2000,

  /**
   * Delay between app ready checks (milliseconds)
   */
  APP_READY_CHECK_DELAY_MS: 100,
} as const;

/**
 * Maximum sizes for various inputs
 *
 * Notes on limits:
 * - If string/array limits are exceeded, marshalling functions will throw an Error
 *   describing the exceeded limit. This happens before AppleScript execution.
 * - Objects are JSON.stringified; the final string should also fit reasonable
 *   system limits for command size.
 *
 * @public
 */
export const MAX_SIZES = {
  /**
   * Default maximum size for JavaScript code strings in KB
   */
  JS_CODE_KB: 512,

  /**
   * Maximum size for a single string argument in KB
   */
  STRING_ARG_KB: 100,

  /**
   * Maximum number of items in an array argument
   */
  ARRAY_ITEMS: 1000,
} as const;
