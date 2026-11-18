"use client";

import {
  findTable,
  outputShape,
  splitTableRef,
  type RowShapeContext,
  type ShapeField
} from "@nextomic/schema";
import { useMemo } from "react";
import { useTypeRegistry } from "../data-types/type-picker";
import { useQuerySourcesStore } from "../query/use-query-sources";
import { useKeptResults } from "./use-kept-results";

/**
 * What the editor knows about the shape of responses and loop rows: Supabase columns and API Data
 * fields from the saved structure, and the kept action results by name. Structure only, no rows.
 */
export function useRowShape(): RowShapeContext {
  const sources = useQuerySourcesStore((s) => s.data);
  const registry = useTypeRegistry();
  const kept = useKeptResults();
  return useMemo(() => {
    const structure = sources?.supabase?.structure ?? null;
    const lookup = {
      columns: (ref: string): ShapeField[] | null => {
        const { schema, table } = splitTableRef(ref);
        const found = findTable(structure, schema, table);
        return found
          ? found.columns.map((c) => ({ name: c.name, type: c.type, isList: c.isList }))
          : null;
      },
      restFields: (callId: string): ShapeField[] | null => {
        const response = sources?.rest?.calls.find((c) => c.id === callId)?.response;
        if (!response?.parseAsDataType) return null;
        const type = registry.dataTypes.find((d) => d.id === response.dataTypeId);
        return type ? type.fields.map((f) => ({ name: f.name, type: f.type })) : null;
      }
    };
    return {
      ...lookup,
      resultShape: (name) => {
        const result = kept.find((r) => r.name === name);
        return result ? (outputShape(result.type, result.params, lookup)?.fields ?? null) : null;
      }
    };
  }, [sources, registry, kept]);
}
