import { AppleScriptError } from "./base.js";

/** @public */
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

/** @public */
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
