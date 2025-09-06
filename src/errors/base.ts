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
