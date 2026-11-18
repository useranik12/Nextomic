"use client";

import { sharedResults, type FlowsByNode, type SharedResult } from "@nextomic/schema";
import { useMemo } from "react";
import { useFlowStore } from "../actions/flow-store";

/** The action results the open page's flows keep (saved flows, and those of new elements waiting for Save). */
export function useKeptResults(): SharedResult[] {
  const byNode = useFlowStore((s) => s.byNode);
  const pending = useFlowStore((s) => s.pending);
  return useMemo(() => {
    const flows: FlowsByNode = {};
    for (const [id, value] of Object.entries(byNode)) flows[id] = value.flows;
    Object.assign(flows, pending);
    return sharedResults(flows);
  }, [byNode, pending]);
}
