import { AppleScriptError } from "./base.js";

/** @public */
export class InvalidActionCodeError extends AppleScriptError {
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

/** @public */
export class ScriptError extends AppleScriptError {
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

/** @public */
export class ParseError extends AppleScriptError {
  constructor(
    message: string,
    public readonly rawOutput: string,
    public readonly operationName: string,
  ) {
    super(message, "ParseError");
    this.name = "ParseError";
  }
}
