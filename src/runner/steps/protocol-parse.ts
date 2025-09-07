/**
 * @fileoverview Protocol parse step - parses raw AppleScript output based on operation kind
 *
 * Why: Focused only on protocol parsing, not data transformation.
 * This step converts the raw payload string into structured data according to
 * the AppleScript protocol format (scalar, action, rows, sections).
 */
import {
  parseScalar,
  parseAction,
  parseRows,
  parseSections,
} from "../../engine/protocol/parser.js";
import type { Step, PipelineContext } from "../pipeline/types.js";

export class ProtocolParseStep implements Step<string, unknown> {
  name = "ProtocolParse";

  execute(payload: string, context: PipelineContext): unknown {
    switch (context.operation.kind) {
      case "scalar":
        return parseScalar(payload);
      case "action":
        return parseAction(payload, { opName: context.operation.name });
      case "rows":
        return parseRows(payload);
      case "sections":
        return parseSections(payload);
      default:
        return payload;
    }
  }
}
