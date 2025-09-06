import { AppleScriptError } from "./base.js";

/** @public */
export class MissingReturnError extends AppleScriptError {
  constructor(
    message: string = "Script did not return a value",
    public readonly operationName: string,
  ) {
    super(message, "MissingReturnError");
    this.name = "MissingReturnError";
  }
}

/** @public */
export class InvalidReturnTypeError extends AppleScriptError {
  constructor(
    message: string,
    public readonly expectedType: string,
    public readonly operationName: string,
  ) {
    super(message, "InvalidReturnTypeError");
    this.name = "InvalidReturnTypeError";
  }
}

/** @public */
export class InputValidationError extends AppleScriptError {
  constructor(
    message: string,
    public readonly issues: unknown[],
    public readonly operationName: string,
  ) {
    super(message, "InputValidationError");
    this.name = "InputValidationError";
  }
}

/** @public */
export class OutputValidationError extends AppleScriptError {
  constructor(
    message: string,
    public readonly issues: unknown[],
    public readonly operationName: string,
  ) {
    super(message, "OutputValidationError");
    this.name = "OutputValidationError";
  }
}
