import type { OperationError } from "../operations/types.js";
import { hasProperty } from "../shared/type-adapters.js";

/**
 * Default retry policy: retries only on AppleScript/controller timeouts.
 */
export function isRetriableError(error: OperationError): boolean {
  // WHY: error.cause could be any type of object/error. We need to check if it has
  // a name property that matches our timeout error names.
  const c = error.cause;
  if (hasProperty(c, "name") && typeof c.name === "string") {
    return c.name === "TimeoutAppleEventError" || c.name === "TimeoutOSAScriptError";
  }
  return false;
}

export async function delay(ms: number): Promise<void> {
  if (ms > 0) await new Promise((r) => setTimeout(r, ms));
}