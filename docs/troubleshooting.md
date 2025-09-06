# Troubleshooting

Quick solutions for common `@avavilov/apple-script` issues.

## Rows return string arrays instead of objects

**Problem**: `operation.rows()` returns `string[][]` instead of expected objects.

**Solution**: Use explicit column mapping:

```typescript
const listTabs = operation.rows({
  name: 'listTabs',
  columns: ['id', 'title', 'url'],  // ← Add this
  output: z.array(z.object({
    id: z.string(),
    title: z.string(),
    url: z.string().url(),
  })),
  script: () => `...`
});
```

**Alternative**: Custom mapping function:

```typescript
const listTabs = operation.rows({
  name: 'listTabs',
  mapRow: ([id, title, url]) => ({  // ← Or this
    id,
    title,
    domain: new URL(url).hostname
  }),
  output: z.array(z.object({...})),
  script: () => `...`
});
```

**Note**: Without `columns` or `mapRow`, the runner attempts to infer keys from your Zod schema, which may fail with complex schemas.

## Section data not parsing correctly

**Problem**: `operation.sections()` returns unexpected raw structure.

**Solution**: Define the correct `output` schema for sections and let the runner parse the AppleScript payload. The parser converts GS/US encoded sections into JavaScript data before validation.

```typescript
const op = operation.sections({
  name: 'getTabsByWindow',
  input: z.object({}),
  output: z.record(z.array(z.string())),  // Keys -> array of strings
  script: () => `...`
});
```

## Script timeout errors

**Problem**: Getting `-1712` (timeout) errors.

**Solutions**:

1. **Increase timeout for specific operation**:
```typescript
await runner.run(myOperation, input, {
  timeoutSec: 30,  // AppleScript timeout
  controllerTimeoutMs: 35000  // Node.js timeout (should be > timeoutSec)
});
```

2. **Configure runner defaults**:
```typescript
const runner = createAppleRunner({
  appId: 'com.apple.Safari',
  defaultTimeoutSec: 20,
  timeoutByKind: {
    rows: 30,  // Rows operations often take longer
    sections: 25
  }
});
```

## Application not found or not responding

**Problem**: Script fails with application errors.

**Solution**: Ensure app is running:

```typescript
const runner = createAppleRunner({
  appId: 'com.apple.Safari',
  ensureAppReady: true  // Launch app if not running (default: true)
});
```

## Validation errors with coercion

**Problem**: Validation fails when AppleScript returns numbers as strings.

**Preferred solution**: Enable built-in normalization (default: on) and use AppleScript-aware helper schemas:

```ts
import { z } from 'zod';
import { asRecord, asNumber, asBoolean, asArray } from '@avavilov/apple-script';

const output = z.array(asRecord({
  id: z.string(),
  active: z.boolean(),        // "true"/"1" → true
  count: z.number(),          // "42" → 42
  values: asArray(asNumber),  // "{1,2,3}" → [1,2,3]
}));
```

Normalization can be disabled globally via `createAppleRunner({ normalizeRows: false })` or per-operation with `operation.rows({ normalizeRows: false, ... })`.

**Alternative**: Use plain Zod coercion when you prefer explicit control:

```typescript
output: z.array(z.object({
  id: z.coerce.number(),  // "123" → 123
  active: z.string().transform(s => s === "true"),  // "true" → true
  count: z.string().regex(/^\d+$/).transform(Number)  // "42" → 42
}))
```

## Special characters breaking scripts

**Problem**: Quotes or special characters in input cause script errors.

**Solution**: The library automatically escapes parameters. For JavaScript code, use the `js` hint:

```typescript
const executeJS = operation.scalar({
  name: 'executeJS',
  hints: { code: { js: {} } },  // ← Treat as JavaScript (optional: { maxLenKb: 512 })
  input: z.object({
    code: z.string()
  }),
  script: ({ code }) => `
    tell front document
      do JavaScript ${code}  
    end tell
  `
});
```

## Queue stuck or operations not executing

**Problem**: Operations seem to hang or execute out of order.

**Solution**: Operations are queued per app. To debug:

```typescript
// Check queue status
console.log(runner.getStats());

// Clear stuck operations
runner.clearQueue();

// Wait for all pending operations
await runner.drain();
```

## Missing return value errors

**Problem**: Getting `-10001` (missing return) errors.

**Solution**: Ensure your script has a return statement:

```typescript
script: () => `
  -- Your logic here
  return "result"  -- ← Don't forget this!
`
```