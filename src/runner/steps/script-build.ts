/**
 * @fileoverview Script build step - builds AppleScript from operation definition and input
 */
import { marshalParams } from "../../engine/marshaller.js";
import { buildAppleScript } from "../../engine/script-builder.js";
import { buildVarsMap, unsafeCast } from "#shared/unsafe-type-casts.js";
import type { PayloadKind } from "../../engine/protocol/constants.js";
import type { Step, PipelineContext, BuiltScriptContext } from "../pipeline/types.js";

export class ScriptBuildStep<T> implements Step<T, BuiltScriptContext> {
  name = "ScriptBuild";
  
  execute(input: T, context: PipelineContext): BuiltScriptContext {
    // WHY unsafeCast: marshalParams expects Record<string, unknown> but we receive generic input
    // This is safe because the input has already been validated by InputValidationStep
    const params = marshalParams(unsafeCast<Record<string, unknown>>(input), context.operation.hints ?? {});
    
    const timeoutSec = context.options?.timeoutSec ?? 
      context.config.timeoutByKind[context.operation.kind] ?? 
      context.config.defaultTimeoutSec;
    const controllerTimeoutMs = context.options?.controllerTimeoutMs ?? 
      context.config.defaultControllerTimeoutMs;

    const script = buildAppleScript({
      appId: context.config.appId,
      kind: context.operation.kind as PayloadKind,
      userScript: context.operation.script(unsafeCast(buildVarsMap(params))),
      params,
      timeoutSec,
      ensureReady: context.config.ensureAppReady,
    });

    return { params, timeoutSec, controllerTimeoutMs, script };
  }
}