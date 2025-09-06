import { inspect } from "node:util";

function compilePatterns(raw: string | undefined): RegExp[] {
  if (!raw) return [];
  const val = raw.trim();
  if (!val) return [];
  if (val === "1" || val.toLowerCase() === "true" || val === "*") return [/^.*/];
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
        : inspect(a, { colors: process.stderr.isTTY, depth: 6, maxArrayLength: 50 }),
    );
    // eslint-disable-next-line no-console -- debug channel
    console.error(`[${time}] ${ns}:`, ...formatted);
  };
}

export function describeSchema(s: any): string {
  try {
    const ctor = s?.constructor?.name ?? typeof s;
    const tname = (s as any)?._def?.typeName;
    const keys = (s as any)?._def ? Object.keys((s as any)._def) : [];
    return `${ctor}${tname ? `/${tname}` : ""}${keys.length ? ` defKeys=${keys.join(",")}` : ""}`;
  } catch {
    return String(s);
  }
}
