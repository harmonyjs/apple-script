# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

## [0.2.0] - 2025-09-07

### Added
- **Processing Pipeline**: New step-based processing pipeline with focused responsibilities (`src/runner/pipeline/processing-pipeline.ts`).

### Changed
- **Runner Internals**: `AppleRunner` now uses specialized pipelines for different operation types. Public API remains the same.
- **Pipeline Architecture**: Implemented generic step-based architecture with `Step<TIn, TOut>` pattern for better extensibility and type safety.
- **Focused Step Responsibilities**: Split monolithic pipeline logic into focused steps:
  - `ProtocolParseStep` - parses AppleScript output by operation kind
  - `RowsMappingStep` - maps string arrays to objects for rows operations  
  - `RowsNormalizationStep` - normalizes types when enabled
  - Individual validation and script building steps
- **Improved Type Safety**: Centralized all unsafe assertions into `src/shared/unsafe-type-casts.ts` and removed scattered `as any` across the codebase.
- **Runner Module Structure**: Reorganized runner module with clear separation of pipeline infrastructure (`pipeline/`) and individual steps (`steps/` format).
- Renamed internal module `src/shared/type-adapters.ts` to `src/shared/unsafe-type-casts.ts`.

### Removed
- Old pipeline implementation and shims: `execution-pipeline.ts`, `steps/`, `pipeline-types.ts`, `adapted-steps.ts`, `pipeline-adapter.ts`, `pipeline-factory.ts`, `simplified-pipeline-poc.ts`, and related comparison/proposal docs and tests.

### BREAKING CHANGES
- Removed experimental generic pipeline and adapter layers in favor of a single, simple processing pipeline. If you imported anything from `src/runner/execution-pipeline*`, `src/runner/pipeline-*`, or `src/runner/steps/*`, migrate to the public `AppleRunner` API or the new `createProcessingPipeline` if you used internals.

### Developer Experience
- **Cleaner Architecture**: Pipeline steps now follow single responsibility principle with focused, well-typed implementations
- **Better Type Safety**: Eliminated unsafe type casts in favor of type guards and proper typing
- **Improved Testability**: Each step can be tested in isolation with clear input/output contracts

## [0.1.0] - 2025-09-05
### Added
- First minor release of `@avavilov/apple-script`
- Type-safe AppleScript execution with full TypeScript typings
- Zod-based input/output validation for operations
- Declarative operations API: scalar, action, rows, sections
- Robust AppleScript protocol parsing (OK/ERR with GS/RS/US separators)
- Secure parameter marshalling with injection safeguards
- Queue management per appId with drain/clear/prune and detailed stats
- Runner with retries, timeouts, and lifecycle hooks (debug/onResult/onError)
- API Extractor setup and generated API docs pipeline
- Comprehensive unit tests and an E2E example test

[Unreleased]: https://github.com/harmonyjs/apple-script/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/harmonyjs/apple-script/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/harmonyjs/apple-script/compare/v0.0.4...v0.1.0