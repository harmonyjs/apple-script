/**
 * @fileoverview Protocol parser for AppleScript responses.
 *
 * Handles parsing of the standard response format:
 * - Success: OK<GS><payload>
 * - Error: ERR<GS><code><GS><message>
 *
 * Also provides utilities for parsing different payload formats
 * (rows, sections, scalar, action).
 */
import {
  ACTION_CODES,
  ActionCode,
  AS_ERROR_MESSAGES,
  GS,
  RS,
  US,
} from "./constants";
import { InvalidActionCodeError } from "../errors";

/**
 * Raw response from AppleScript execution
 */
export interface RawResponse {
  /** Standard output from osascript */
  stdout: string;

  /** Standard error from osascript */
  stderr: string;

  /** Exit code from process */
  exitCode: number | null;
}

/**
 * Parsed protocol response
 */
export type ProtocolResponse =
  | { ok: true; payload: string }
  | { ok: false; code: number; message: string };

/**
 * Parses the raw response from osascript according to the protocol.
 *
 * @param raw - Raw response from osascript execution
 * @returns Parsed protocol response
 * @throws Error if response doesn't match protocol format
 */
export function parseProtocolResponse(raw: RawResponse): ProtocolResponse {
  const output = (raw.stdout ?? "").trim();

  // Handle empty response
  if (!output) {
    return { ok: false, code: -1, message: "Empty response from AppleScript" };
  }

  // Split by GS to get response parts
  const parts = output.split(GS);

  if (parts.length < 2) {
    return {
      ok: false,
      code: -1,
      message: "Malformed response from AppleScript",
    };
  }

  const status = parts[0];

  if (status === "OK") {
    const payload = parts.slice(1).join(GS);
    return { ok: true, payload };
  } else if (status === "ERR") {
    const code = Number(parts[1] ?? "0");
    const message = parts.slice(2).join(GS) || "Unknown error";
    return { ok: false, code: Number.isFinite(code) ? code : -1, message };
  } else {
    return { ok: false, code: -1, message: `Unknown status prefix: ${status}` };
  }
}

/**
 * Parses payload as rows (RS/US separated table).
 *
 * @param payload - Raw payload string
 * @returns Array of arrays representing rows and columns
 *
 * @example
 * parseRows('a⟨US⟩b⟨US⟩c⟨RS⟩d⟨US⟩e⟨US⟩f')
 * // Returns: [['a', 'b', 'c'], ['d', 'e', 'f']]
 */
export function parseRows(payload: string): string[][] {
  if (!payload) return [];

  const rows = payload.split(RS).filter((row) => row.length > 0);

  return rows.map((row) => {
    // Edge case: if this row ends with a single trailing US and contains no
    // other US characters, treat it as a single scalar cell to preserve the
    // trailing control character (e.g., "\x00\x01\x02\x1F"). This avoids
    // losing the trailing \x1F when splitting and trimming.
    if (row.endsWith(US) && row.slice(0, -1).indexOf(US) === -1) {
      return [row];
    }

    const fields = row.split(US);
    // Trim trailing empty fields that may result from separators at end
    while (fields.length > 0 && fields[fields.length - 1] === "") fields.pop();
    return fields;
  });
}

/**
 * Parses payload as sections (GS separated named groups).
 * Each section is: name<US>item1<US>item2...
 *
 * @param payload - Raw payload string
 * @returns Object with section names as keys and item arrays as values
 *
 * @example
 * parseSections('closed⟨US⟩1⟨US⟩2⟨GS⟩notFound⟨US⟩3')
 * // Returns: { closed: ['1', '2'], notFound: ['3'] }
 */
export function parseSections(payload: string): Record<string, string[]> {
  if (!payload) return {};

  const sections = payload.split(GS).filter((sec) => sec.length > 0);
  const result: Record<string, string[]> = {};

  for (const sec of sections) {
    const parts = sec.split(US);
    const name = parts.shift() ?? "";
    if (!name) continue;
    result[name] = parts.filter((p) => p.length > 0);
  }

  return result;
}

/**
 * Parses payload as a scalar value.
 * Simply returns the payload as-is for scalar mode.
 *
 * @param payload - Raw payload string
 * @returns The payload string
 */
export function parseScalar(payload: string): string {
  return payload ?? "";
}

/**
 * Parses payload as an action code.
 * Validates that it's one of the valid action codes (0, 1, 2).
 *
 * @param payload - Raw payload string
 * @returns The action code
 * @throws Error if invalid action code
 */
export function parseAction(
  payload: string,
  ctx?: { opName?: string },
): ActionCode {
  const code = payload?.trim();
  if (
    code === ACTION_CODES.FAILURE ||
    code === ACTION_CODES.SUCCESS ||
    code === ACTION_CODES.PARTIAL
  ) {
    return code;
  }
  throw new InvalidActionCodeError(code ?? "", ctx?.opName ?? "unknown");
}

/**
 * Type guard to check if a response is successful
 */
export function isSuccessResponse(
  response: ProtocolResponse,
): response is { ok: true; payload: string } {
  return response.ok === true;
}

/**
 * Type guard to check if a response is an error
 */
export function isErrorResponse(
  response: ProtocolResponse,
): response is { ok: false; code: number; message: string } {
  return response.ok === false;
}

/**
 * Gets a human-readable error message for an error code.
 * Falls back to the raw message if no known mapping exists.
 */
export function getErrorMessage(code: number, rawMessage: string): string {
  const knownMessage = AS_ERROR_MESSAGES[code];
  if (knownMessage) return knownMessage;
  if (rawMessage && rawMessage.trim()) return rawMessage;
  return "Unknown error";
}
