# Architecture Overview

This document summarizes the internal module boundaries and layering rules to keep coupling low and cohesion high.

## Layers

- `src/engine/` — low-level primitives and wire-level logic:
  - `protocol/` — wire protocol constants and parser (`constants.ts`, `parser.ts`)
  - Script assembly (`marshaller.ts`, `script-builder.ts`)
  - Params contract types (`params.ts`)
  - Runtime executor (`executor.ts`)
  - Debug helpers (`debug.ts`)
  - AppleScript list helpers (`applescript-list.ts`)

- `src/shared/` — cross-cutting utilities used by multiple layers:
  - Centralized unsafe casts and helpers (`unsafe-type-casts.ts`)
    - Why: to concentrate unavoidable unsafe assertions (e.g., Zod interop, dynamic record access) in one auditable place. This keeps the rest of the codebase free from scattered `as any` and simplifies reviews.
    - Example import: `import { hasProperty } from '#shared/unsafe-type-casts.js'`

- `src/errors/` — public error types and factory (modularized by concern).

- `src/operations/` — declarative operation factories and type contracts.

- `src/normalization/` — Zod-aware schemas and data normalization used by the runner.

- `src/runner/` — orchestration (AppleRunner), execution pipeline, retry policy, stats, and post-processing.
  - Steps-based execution pipeline in `src/runner/steps/`:
    - `input-validation.ts` — Validates input against operation's Zod schema
    - `script-build.ts` — Builds AppleScript from operation definition and input
    - `protocol-parse.ts` — Parses raw AppleScript output based on operation kind
    - `rows-mapping.ts` — Maps parsed rows data to objects using operation schema
    - `rows-normalization.ts` — Normalizes mapped row data to match schema types
    - `output-validation.ts` — Validates parsed output against operation's schema
  - Why: Each step has a single responsibility and stays <200 lines, improving readability and testability. The `ProcessingPipeline` composes these steps dynamically based on operation type.

- `src/queue/` — queue implementation used by the runner.

Legacy `src/core/` has been retired; files remain as empty stubs only to ease transitions and will be removed in a future major.

## Import rules

- `engine` must not import from `runner`, `operations`, or `normalization`.
- `engine/protocol` is internal to the engine and does not import public error classes.
- `runner` converts internal parse errors into public error types.
- `operations` depend on contract types from `engine` (e.g., `engine/params`, `engine/protocol/constants`), not on implementation details.
- `normalization` should not import from `runner`.
- Tests should avoid cross-layer imports; declare minimal local test types if needed.

## Public API

The public entrypoint is `src/index.ts`. It re-exports selected types from `engine/protocol` and `engine/params`. Internal helpers are not exported.

## Naming

- Prefer specific names to avoid ambiguity (e.g., `applescript-list.ts` instead of a generic `coercion.ts`).
- Use kebab-case file names.
