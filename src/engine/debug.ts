import { inspect } from "node:util";
import { hasProperty } from "#shared/unsafe-type-casts.js";

function compilePatterns(raw: string | undefined): RegExp[] {
  if (!raw) return [];
  const val = raw.trim();
  if (!val) return [];
  if (val === "1" || val.toLowerCase() === "true" || val === "*")
    return [/^.*/];
  const parts = val.split(/[\s,]+/).filter(Boolean);
  const regs = parts.map((p) => {
    const esc = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${esc}$`);
  });
  return regs;
}

const patterns = compilePatterns(process.env.APPLESCRIPT_DEBUG);

export function isDebugEnabled(ns: string): boolean {
  if (patterns.length === 0) return false;
  return patterns.some((r) => r.test(ns));
}

export function createDebug(ns: string) {
  const enabled = () => isDebugEnabled(ns);
  return (...args: unknown[]) => {
    if (!enabled()) return;
    const time = new Date().toISOString();
    const formatted = args.map((a) =>
      typeof a === "string"
        ? a
        : inspect(a, {
            colors: process.stderr.isTTY,
            depth: 6,
            maxArrayLength: 50,
          }),
    );
    // eslint-disable-next-line no-console -- debug channel
    console.error(`[${time}] ${ns}:`, ...formatted);
  };
}

export function describeSchema(s: unknown): string {
  try {
    const ctor = s?.constructor?.name ?? typeof s;
    // Narrow _def once and reuse the refined object
    let def: Record<string, unknown> | undefined;
    if (hasProperty(s, "_def")) {
      const maybe = s._def;
      if (maybe && typeof maybe === "object") {
        def = maybe as Record<string, unknown>;
      }
    }
    const tname =
      def && hasProperty(def, "typeName") ? String(def.typeName) : undefined;
    const keys = def ? Object.keys(def as object) : [];
    return `${ctor}${tname ? `/${tname}` : ""}${keys.length ? ` defKeys=${keys.join(",")}` : ""}`;
  } catch {
    return String(s);
  }
}
