import type { OperationError } from "../operations/types.js";
import { hasProperty } from "#shared/unsafe-type-casts.js";

/**
 * Default retry policy: retries only on AppleScript/controller timeouts.
 */
export function isRetriableError(error: OperationError): boolean {
  // WHY: error.cause could be any type of object/error. We need to check if it has
  // a name property that matches our timeout error names.
  const cause = error.cause;
  if (hasProperty(cause, "name")) {
    const name = (cause as Record<string, unknown>).name;
    if (typeof name === "string") {
      return name === "TimeoutAppleEventError" || name === "TimeoutOSAScriptError";
    }
  }
  return false;
}

export async function delay(ms: number): Promise<void> {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}