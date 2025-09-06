# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

### Changed
- Centralized all unsafe assertions into `src/shared/unsafe-type-casts.ts` and removed scattered `as any` across the codebase.
- Renamed internal module `src/shared/type-adapters.ts` to `src/shared/unsafe-type-casts.ts`.
- If you imported internal helpers from `#shared/type-adapters`, switch to `#shared/unsafe-type-casts`.
	Public API remains unchanged.

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

[Unreleased]: https://github.com/harmonyjs/apple-script/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/harmonyjs/apple-script/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/harmonyjs/apple-script/compare/v0.0.4...v0.1.0