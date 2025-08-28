import test from "node:test";
import assert from "node:assert/strict";

// Import from the local source to test the library end-to-end in this repo
import { z } from "zod";
import { createAppleRunner, operation } from "../src/index.ts";

// Bundle ID for Yandex Browser (macOS)
const BROWSER_ID = "ru.yandex.desktop.yandex-browser";

// Define a scalar operation that returns the total number of open tabs as a number
const countOpenTabs = operation.scalar({
  name: "countOpenTabs",
  input: z.object({}),
  // Parse the scalar string result into an integer and validate
  output: z
    .string()
    .transform((s) => {
      const n = parseInt(String(s), 10);
      if (!Number.isFinite(n)) throw new Error(`Not a number: ${s}`);
      return n;
    })
    .pipe(z.number().int().nonnegative()),
  script: () => `
    set totalTabs to 0
    try
      set winCount to (count of windows)
    on error
      set winCount to 0
    end try
    if winCount > 0 then
      repeat with w in windows
        try
          set totalTabs to totalTabs + (count of tabs of w)
        on error
          -- Some window types might not have tabs; ignore and continue
        end try
      end repeat
    end if
    return (totalTabs as text)
  `,
});

test("counts open tabs in Yandex Browser and logs the number", async (t) => {
  console.log("🚀 AppleScript E2E Test: Count Yandex Browser tabs");
  console.log(`📱 Using browser: ${BROWSER_ID}`);

  const runner = createAppleRunner({
    appId: BROWSER_ID,
    defaultTimeoutSec: 12,
    defaultControllerTimeoutMs: 15000,
    timeoutByKind: {
      action: 8,
      scalar: 20,
      rows: 12,
      sections: 12,
    },
    debug: process.env.DEBUG
      ? ({ opName, kind, script }) => {
          console.log(`\n[DEBUG] ${opName} (${kind}) script preview:`);
          console.log(
            script.substring(0, 400) + (script.length > 400 ? "…" : ""),
          );
        }
      : undefined,
    onResult: ({ opName, tookMs }) => {
      console.log(`✅ ${opName} completed in ${tookMs}ms`);
    },
    onError: ({ opName, error }) => {
      console.error(`❌ ${opName} failed: ${error.message}`);
    },
  });

  // Run operation
  const res = await runner.run(countOpenTabs, {});

  // If the browser isn't installed, AppleScript may return -10814 (Application not found).
  // We surface the failure, as this is an integration test. Uncomment to soft-skip in such cases:
  // if (!res.ok && (res.error as any)?.cause?.code === -10814) {
  //   t.skip('Yandex Browser is not installed (code -10814). Skipping integration test.');
  //   return;
  // }

  assert.equal(
    res.ok,
    true,
    res.ok ? "Unexpected non-error result shape" : res.error.message,
  );
  const count = res.ok ? res.data : 0;
  assert.equal(typeof count, "number");
  assert.ok(
    Number.isInteger(count) && count >= 0,
    "Tab count should be a non-negative integer",
  );

  console.log(`📊 Open tabs in Yandex Browser: ${count}`);
});
