/**
 * @fileoverview Helper for mapping rows (string[][]) to objects based on operation definition.
 */

export interface RowsLikeDef {
  output: unknown;
  columns?: string[];
  mapRow?: (cols: string[], rowIndex: number) => unknown;
}

/**
 * Maps rows into objects/values according to:
 * 1) mapRow(cols, i) if provided
 * 2) columns[] if provided
 * 3) Fallback: infer keys from Zod output element shape when it's an object
 *    (best-effort; relies on common Zod internals).
 * If none apply, returns the original rows.
 */
export function mapRowsOutput(def: RowsLikeDef, rows: string[][]): unknown[] {
  // 1) mapRow has highest precedence
  if (typeof def?.mapRow === "function") {
    return rows.map((cols, i) => def.mapRow!(cols, i));
  }

  // 2) columns mapping
  if (Array.isArray(def?.columns)) {
    const columns = def.columns as string[];
    return rows.map((cols) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) obj[columns[i]!] = cols[i];
      return obj;
    });
  }

  // 3) Fallback: infer keys from Zod object element if possible
  let keys: string[] | undefined;
  try {
    const outSchema: any = (def as any).output;
    
    // For ZodArray, the element is in outSchema.element or outSchema._def.type
    let el: any = outSchema?.element;
    if (!el && outSchema?._def?.type) {
      el = outSchema._def.type;
    }
    
    if (el) {
      // Try multiple known places where shape may live across Zod versions
      const candidates: any[] = [];
      
      // For ZodObject, shape can be in _def.shape() or _def.shape
      if (el._def) {
        if (typeof el._def.shape === 'function') {
          try { candidates.push(el._def.shape()); } catch {}
        } else if (el._def.shape && typeof el._def.shape === 'object') {
          candidates.push(el._def.shape);
        }
      }
      
      // Also try direct .shape property
      if (typeof el.shape === 'function') {
        try { candidates.push(el.shape()); } catch {}
      } else if (el.shape && typeof el.shape === 'object') {
        candidates.push(el.shape);
      }
      
      for (const s of candidates) {
        if (s && typeof s === 'object') { 
          keys = Object.keys(s);
          break;
        }
      }
      
      // Fallback via keyof
      if (!keys && typeof el.keyof === 'function') {
        try {
          const keyEnum = el.keyof();
          const values: any = keyEnum?.options ?? keyEnum?._def?.values;
          if (Array.isArray(values)) keys = values as string[];
        } catch {}
      }
    }
  } catch {
    // best-effort only
  }
  if (Array.isArray(keys)) {
    return rows.map((cols) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < keys.length; i++) obj[keys[i]!] = cols[i];
      return obj;
    });
  }

  // default: unchanged
  return rows;
}
