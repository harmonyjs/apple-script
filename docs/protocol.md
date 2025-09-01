# Protocol: GS/RS/US

The library uses simple ASCII control characters to encode structured data from AppleScript:

- GS (Group Separator, 0x1D) — group/sections separator
- RS (Record Separator, 0x1E) — row separator
- US (Unit Separator, 0x1F) — field separator

## Response envelope

- Success: `OK<GS>payload`
- Error: `ERR<GS><code><GS><message>`

## Payload formats

### scalar

- Payload is a single string. The script should `return` a text value.

### action

- Payload is one of "0" | "1" | "2" (see ACTION_CODES). The script should `return` one of these.

### rows

- Payload is rows separated by RS, fields by US
- Example: two rows with fields [A,1] and [B,2]
  - Encoded: `A<US>1<RS>B<US>2`

### sections

- Payload is sections separated by GS, inside each: `name<US>item1<US>item2...`
- Example: good=[a,b], bad=[c]
  - Encoded: `good<US>a<US>b<GS>bad<US>c`

Notes:
- The parser trims trailing empty fields caused by trailing separators.
- For rows, the library can map columns to object keys when your output schema is array(object).
