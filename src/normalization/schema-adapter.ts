import {
  extractObjectShape,
  getArrayElementSchema,
  getTupleItemSchemas,
  getZodTypeName,
  unwrapZodSchema,
} from "./zod-introspection.js";
// After relocation, import from normalization

/**
 * Adapter around Zod schema to encapsulate access to internals.
 * Keeps all _def-based logic in one place.
 */
export class ZodSchemaAdapter {
  constructor(public readonly raw: any) {}

  static from(schema: any): ZodSchemaAdapter {
    return new ZodSchemaAdapter(schema);
  }

  get typeName(): string | undefined {
    return getZodTypeName(this.raw);
  }

  get ctorName(): string | undefined {
    return this.raw?.constructor?.name;
  }

  /**
   * Checks if the unwrapped schema matches a Zod type name (by typeName or constructor name).
   * Example: isType("ZodNumber"), isType("ZodArray").
   */
  isType(expected: string): boolean {
    const base = this.unwrap();
    const t = base.typeName;
    const c = base.ctorName;
    return t === expected || c === expected;
  }

  unwrap(): ZodSchemaAdapter {
    const base = unwrapZodSchema(this.raw);
    return new ZodSchemaAdapter(base);
  }

  getObjectShape(): Record<string, any> | undefined {
    return extractObjectShape(this.raw);
  }

  getArrayElement(): any {
    return getArrayElementSchema(this.raw);
  }

  getTupleItems(): any[] {
    return getTupleItemSchemas(this.raw);
  }
}
