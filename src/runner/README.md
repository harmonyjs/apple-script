# Runner Architecture

The runner module implements a generic step-based processing pipeline for executing AppleScript operations.

## Directory Structure

```
src/runner/
  pipeline/              # Core pipeline infrastructure
    types.ts            # Shared types and interfaces
    processing-pipeline.ts # Factory for creating pipelines
    index.ts            # Module exports
  steps/                # Individual pipeline steps
    input-validation.ts
    script-build.ts
    protocol-parse.ts
    rows-mapping.ts
    rows-normalization.ts
    output-validation.ts
    index.ts            # Step exports
  runner.ts             # Main AppleRunner class
  index.ts              # Public API exports
```

## Core Concepts

### Generic Step Pattern

All pipeline steps implement the `Step<TIn, TOut>` interface:

```typescript
interface Step<TIn, TOut> {
  name: string;
  execute(input: TIn, context: PipelineContext): TOut;
}
```

This provides:
- **Type Safety**: Natural type flow from input to output
- **Composability**: Steps can be chained in any order
- **Testability**: Each step can be tested in isolation
- **Extensibility**: New steps can be added without modifying existing code

### Pipeline Context

The `PipelineContext` carries shared state across all steps:

```typescript
interface PipelineContext {
  config: ProcessingConfig;
  operation: OperationDef<any, any>;
  options?: RunOptions;
  shouldValidate: boolean;
}
```

### Current Steps

1. **InputValidationStep**: Validates input against operation's Zod schema
2. **ScriptBuildStep**: Builds AppleScript from operation definition and input
3. **ProtocolParseStep**: Parses raw AppleScript output based on operation kind
4. **RowsMappingStep**: Maps parsed rows data to objects using operation schema
5. **RowsNormalizationStep**: Normalizes mapped row data to match schema types
6. **OutputValidationStep**: Validates parsed output against operation's schema

### Type Flow

The pipeline maintains type safety through generic composition:

```typescript
Pipeline<unknown, BuiltScriptContext>  // Pre-execution
Pipeline<string, unknown>              // Post-execution
```

## Usage

The `createProcessingPipeline` factory creates a pipeline instance with all steps configured:

```typescript
const pipeline = createProcessingPipeline(config);

// Use individual steps
pipeline.validateInputIfNeeded(operation, input, shouldValidate);
const script = pipeline.buildScriptContext(operation, input, options);

// Or use complete post-processing
const output = pipeline.runPostProcessing(operation, payload, shouldValidate);
```

## Benefits Over Previous Architecture

- **Focused Responsibilities**: Each step handles one specific concern (parse, map, normalize, validate)
- **Simple Type Flow**: Clear generic composition with natural type inference

- **Standardized Pattern**: All steps follow the same `Step<TIn, TOut>` interface
- **Easy to Test**: Each step can be tested in isolation with clear inputs/outputs
- **Better Maintainability**: Clean separation of concerns and focused responsibilities

## Architecture Benefits

1. **Single Responsibility**: Each step has one clear purpose
2. **Composability**: Steps can be combined for different operation types
3. **Type Safety**: Natural type flow through pipeline composition
4. **Testability**: Each step can be tested in isolation
5. **Extensibility**: New operation types can be added by composing existing steps