# Contributing

Contributions are welcome! Please ensure:

1. All tests pass
2. Code follows the existing style
3. New features include tests
4. Documentation is updated

## Development

```bash
# Install dependencies
npm install

# Build the library
npm run build

# Run tests
npm test

# Development mode
npm run dev
```

## Internals: Queue behavior

If you change queue behavior (e.g., length semantics, clear() logic, scheduling), please:

- Read src/queue/README.md for the intended semantics
- Run the focused tests:
	- src/queue/queue.test.ts
	- src/queue/queue-manager.test.ts
- Ensure edge cases around `clear()` rejection and pending length are covered

These tests validate the epoch cut-off and microtask scheduling that prevent races between `add()` and `clear()`.
