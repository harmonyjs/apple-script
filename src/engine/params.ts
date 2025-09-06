/**
 * Contract types for AppleScript parameter marshalling.
 *
 * @public
 */
export interface ParamHint {
  js?: { maxLenKb?: number };
}

/**
 * @public
 */
export interface MarshalledParam {
  varName: string;
  literal: string;
  paramName: string;
}
