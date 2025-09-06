# @avavilov/apple-script

Type-safe AppleScript execution library for Node.js with Zod validation. Execute AppleScript operations with full TypeScript support, automatic input/output validation, and proper error handling.

## Features

- 🔒 **Type-Safe**: Full TypeScript support with compile-time type checking
- ✅ **Validation**: Input/output validation using Zod schemas
- 🎯 **Declarative API**: Define operations once, use everywhere
- 🔄 **Queue Management**: Automatic serialization of operations per application
- 🧹 **Automatic Normalization**: Best-effort, schema-guided normalization of rows output (numbers/booleans/arrays/tuples/objects)
- ⚡ **Protocol Standardization**: Consistent encoding/decoding with control characters (see the [Protocol](docs/protocol.md))
- 🛡️ **Security**: Safe parameter marshalling prevents injection attacks
- 📊 **Observable**: Debug hooks, result callbacks, and error handlers
- ⏱️ **Timeout Control**: Dual timeout system (AppleScript + Node.js)
- 🔁 **Retry Logic**: Configurable retry mechanism for transient failures

**Note**: This library is macOS-only as AppleScript is an Apple technology. For cross-platform automation, consider using tools like Playwright or Puppeteer.

## Installation

```bash
npm install @avavilov/apple-script zod
```

## Quick Start

```typescript
import { z } from 'zod';
import { createAppleRunner, operation } from '@avavilov/apple-script';

// Define an operation
const getCurrentURL = operation.scalar({
  name: 'getCurrentURL',
  input: z.object({}),
  output: z.string(),
  script: () => `
    return URL of active tab of front window
  `
});

// Create a runner
const runner = createAppleRunner({
  appId: 'com.apple.Safari'
});

// Execute the operation
const result = await runner.run(getCurrentURL, {});
if (result.ok) {
  console.log('Current URL:', result.data);
} else {
  console.error('Error:', result.error.message);
}
```

## Core Concepts

### Operations

Operations are declarative descriptions of AppleScript tasks with strict input/output contracts:

```typescript
const openURL = operation.action({
  name: 'openURL',
  input: z.object({ 
    url: z.string().url() 
  }),
  script: ({ url }) => `
    try
      open location ${url}
      return "1"
    on error
      return "0"
    end try
  `
});
```

### Operation Types

#### 1. Scalar Operations
Return a single string value (see [Protocol: scalar](docs/protocol.md#scalar)):

```typescript
const getTitle = operation.scalar({
  name: 'getTitle',
  input: z.object({ windowIndex: z.number() }),
  output: z.string(),
  script: ({ windowIndex }) => `
    return title of window ${windowIndex}
  `
});
```

#### 2. Action Operations
Return status codes (0=failure, 1=success, 2=partial) (see [Protocol: action](docs/protocol.md#action)):

```typescript
const closeTab = operation.action({
  name: 'closeTab',
  input: z.object({ tabId: z.string() }),
  script: ({ tabId }) => `
    repeat with w in windows
      repeat with t in tabs of w
        if (id of t as text) is ${tabId} then
          try
            close t
            return "1"
          on error
            return "0"
          end try
        end if
      end repeat
    end repeat
    return "0"
  `
});
```

#### 3. Rows Operations
Return tabular data as array of objects (encoded with RS/US separators; see [Protocol: rows](docs/protocol.md#rows)):

```typescript
const listTabs = operation.rows({
  name: 'listTabs',
  input: z.object({}),
  output: z.array(z.object({
    id: z.string(),
    url: z.string(),
    title: z.string()
  })),
  script: () => `
    set rows to {}
    repeat with w in windows
      repeat with t in tabs of w
        set end of rows to {(id of t as text), URL of t, title of t}
      end repeat
    end repeat
    return rows
  `
});
```

##### Rows → Objects Mapping
The runner automatically maps rows (string arrays) to objects based on:
1. **`mapRow`** function if provided (highest priority)
2. **`columns`** array if provided (explicit column names)
3. **Zod schema inference** from `output: z.array(z.object({...}))`

```typescript
// Explicit columns (recommended for clarity)
const listTabs = operation.rows({
  name: 'listTabs',
  columns: ['id', 'url', 'title'], // Maps row[0]→id, row[1]→url, row[2]→title
  output: z.array(z.object({
    id: z.coerce.number(),
    url: z.string().url(),
    title: z.string()
  })),
  script: () => `...`
});

// Custom mapping function
const listTabsWithDomain = operation.rows({
  name: 'listTabsWithDomain',
  mapRow: ([id, url, title]) => ({
    id,
    title,
    domain: new URL(url).hostname
  }),
  output: z.array(z.object({
    id: z.string(),
    title: z.string(),
    domain: z.string()
  })),
  script: () => `...`
});
```

**Note**: Row mapping happens *before* output validation, ensuring consistent behavior regardless of validation settings. See [Troubleshooting](docs/troubleshooting.md#rows--objects-mapping-doesnt-work) for common issues.

##### Automatic normalization (rows)
After mapping rows to objects, the runner can automatically normalize stringly-typed values to match your output schema. This is a best-effort, schema-guided step that handles:

- numbers: "42" → 42
- booleans: "true"/"false"/"1"/"0" → true/false
- arrays: "{1, 2, 3}" or "1,2,3" → [1, 2, 3]
- tuples: "{a, b, c}" → [a, b, c]
- objects: recursively normalizes fields using the object shape

Toggles:
- Global: `RunnerConfig.normalizeRows` (default: `true`)
- Per-operation: `RowsOperationDef.normalizeRows` (overrides global)

Example with AppleScript-aware helper schemas:

```ts
import { z } from 'zod';
import { operation, schemas as as } from '@avavilov/apple-script';

const listTabs = operation.rows({
  name: 'listTabs',
  columns: ['id', 'url', 'title', 'active', 'bounds', 'indices'],
  // as.record wraps number/boolean fields to accept AppleScript string representations
  // You may also use explicit helpers like as.boolean/as.number
  output: z.array(as.record({
    id: z.string(),
    url: z.string().url(),
    title: z.string(),
    active: as.boolean,        // "true" → true, "0" → false
    bounds: as.array(as.number) // "{0, 0, 800, 600}" → [0, 0, 800, 600]
  })).describe('List of tabs')
});

// You can disable/enable normalization:
// const runner = createAppleRunner({ appId, normalizeRows: true });
// Or per operation: operation.rows({ normalizeRows: false, ... })
```

#### 4. Sections Operations
Return grouped data with named sections (see [Protocol: sections](docs/protocol.md#sections)):

```typescript
const closeTabs = operation.sections({
  name: 'closeTabs',
  input: z.object({ ids: z.array(z.string()) }),
  output: z.record(z.array(z.string())),
  script: ({ ids }) => `
    set closedList to {}
    set notFoundList to {}
    -- close tabs logic here --
    return {{"closed", closedList}, {"notFound", notFoundList}}
  `
});
```

### Runner Configuration

```typescript
const runner = createAppleRunner({
  // Required
  appId: 'com.apple.Safari',
  
  // Timeouts
  defaultTimeoutSec: 12,              // AppleScript timeout
  defaultControllerTimeoutMs: 15000,  // Node.js timeout
  timeoutByKind: {
    scalar: 10,
    action: 8,
    rows: 15,
    sections: 15
  },
  
  // Behavior
  ensureAppReady: true,               // Launch app if not running
  validateByDefault: true,            // Validate input/output
  normalizeRows: true,                // Normalize rows to schema (numbers/booleans/arrays/tuples/objects)
  maxRetries: 2,                      // Retry on timeout
  retryDelayMs: 1000,                 // Delay between retries
  
  // Hooks
  debug: ({ opName, script }) => {
    console.log(`[${opName}] Script:`, script);
  },
  onResult: ({ opName, tookMs }) => {
    console.log(`[${opName}] Completed in ${tookMs}ms`);
  },
  onError: ({ opName, error }) => {
    console.error(`[${opName}] Failed:`, error.message);
  }
});
```

Note: The runner serializes operations per appId using an internal QueueManager. Each appId has its own FIFO queue. Queue semantics (microtask scheduling, clear() epoch cut-off, and the length property) apply per appId queue. See: src/queue/README.md.

## Protocol Details
For the complete protocol specification and additional examples, see [docs/protocol.md](docs/protocol.md).

### Encoding

The library uses ASCII control characters for data structuring:

- **GS** (Group Separator, ASCII 29): Top-level sections
- **RS** (Record Separator, ASCII 30): Rows in tables
- **US** (Unit Separator, ASCII 31): Fields in records

### Response Format

All AppleScript responses follow this format:

- Success: `OK<GS><payload>`
- Error: `ERR<GS><code><GS><message>`

### Error Codes

- `-1712`: AppleScript timeout
- `-10001`: Missing return value
- `-10002`: Invalid return type for rows
- `-10003`: Invalid return type for sections
- `-10004`: Invalid action code
- `-10005`: Invalid return type for scalar

## Security

### Parameter Marshalling

All parameters are safely marshalled as AppleScript literals:

```typescript
// Your input
{ url: 'https://example.com', ids: ['1', '2', '3'] }

// Becomes AppleScript variables
set __ARG__url to "https://example.com"
set __ARG__ids to {"1", "2", "3"}
```

### Injection Prevention

String values are properly escaped:

```typescript
// Input with quotes
{ message: 'Hello "World"' }

// Safe AppleScript literal
set __ARG__message to "Hello " & quote & "World" & quote & ""
```

## Advanced Usage

### AppleScript-aware helper schemas (stable public API)
The library ships Zod helpers tailored for AppleScript string outputs. They can be used directly in your schemas or with automatic normalization.

- `asBoolean` — accepts boolean/numeric/string representations
- `asNumber` — accepts number or numeric string
- `asArray(item)` — accepts array or list string ("{...}" or CSV)
- `asTuple([...items])` — accepts tuple or list string with fixed length
- `asBounds` — shorthand for `[x, y, width, height]` using `asNumber`
- `asRecord(shape)` — wraps boolean/number fields in a shape with `asBoolean`/`asNumber`

Import from the root entrypoint:

```ts
import { schemas as as } from '@avavilov/apple-script';
```

These helpers are a stable part of the public API and will follow semver. Breaking changes, if any, will be released as a major version.

Examples:

```ts
import { z } from 'zod';
import { schemas as as } from '@avavilov/apple-script';

// A single row item
const Tab = as.record({
  id: z.string(),
  title: z.string(),
  active: as.boolean,        // "1"/"true" → true
  zoom: as.number,           // "125" → 125
  bounds: as.bounds          // "{0, 0, 800, 600}" → [0,0,800,600]
});

// Whole rows output
const TabsOutput = z.array(Tab);

// Tuple example from a list string
const XY = as.tuple([as.number, as.number]); // "{10, 20}" → [10, 20]

// Array-of-number from CSV/list
const Numbers = as.array(as.number); // "1,2,3" or "{1, 2, 3}" → [1,2,3]
```

Compatibility note: Helper schema behavior and automatic rows normalization rely on limited Zod introspection under the hood (reading common internal fields). This path is covered by unit tests in this repository. In rare cases after a Zod upgrade, normalization may gracefully degrade to a no-op for affected shapes (values remain strings) rather than throwing. You can always opt in to explicit Zod coercion or transform as a fallback.

### JavaScript Execution

Execute JavaScript in browser contexts:

```typescript
const executeJS = operation.scalar({
  name: 'executeJS',
  input: z.object({ 
    js: z.string().describe('js') // Mark as JS code
  }),
  output: z.string(),
  hints: {
    js: { js: { maxLenKb: 512 } } // Limit size
  },
  script: ({ js }) => `
    return execute active tab of front window javascript ${js}
  `
});

// Usage
const title = await runner.run(executeJS, {
  js: 'document.title'
});
```

### Custom Timeouts

Override timeouts per operation:

```typescript
// At runtime per call
await runner.run(longOperation, {}, {
  controllerTimeoutMs: 45000 // Controller timeout
});
```

### Queue Management

Operations to the same app are automatically serialized:

```typescript
// These run sequentially
const promise1 = runner.run(operation1, {});
const promise2 = runner.run(operation2, {});
const promise3 = runner.run(operation3, {});

// Wait for all
await Promise.all([promise1, promise2, promise3]);

// Or drain the queue
await runner.drain();
```

Tip: For microtask scheduling details, clear() epoch behavior, and the length property semantics, see src/queue/README.md.

## Error Handling

The library provides detailed error information:

```typescript
const result = await runner.run(myOperation, input);

if (!result.ok) {
  switch (result.error.kind) {
    case 'TimeoutAppleEvent':
      console.log('AppleScript timed out');
      break;
    case 'InputValidationError':
      console.log('Invalid input:', result.error.metadata);
      break;
    case 'ScriptError':
      console.log('Script failed:', result.error.message);
      break;
  }
}
```

## Internals

For details about internal queueing behavior (microtask scheduling, clear() epoch cut-off, length semantics), see:

- src/queue/README.md

## Architecture

The library follows a layered architecture:

1. **User API Layer**: High-level functions (`createAppleRunner`, `operation.*`)
2. **Runner Layer**: Orchestration, retries, hooks
3. **Operations & Queue Layer**: Operation definitions, queue management, validation
4. **Engine Layer**: Script building, marshalling, `engine/protocol` parsing
5. **System Layer**: `osascript` execution via `child_process`

## Additional Documentation

- [Protocol Specification](docs/protocol.md) - Detailed protocol documentation
- [Troubleshooting Guide](docs/troubleshooting.md) - Common issues and solutions
- [Queue Implementation](src/queue/README.md) - Queue semantics and behavior
- [Release Guide](docs/how-to-release.md) - How to publish new versions

## License

MIT
