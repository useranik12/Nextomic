"use client";

import {
  activeQuery,
  expressionScope,
  loopAncestors,
  loopFrame,
  loopRowSample,
  withLoopScope
} from "@nextomic/schema";
import { useEffect, useMemo } from "react";
import { useFlowDraft } from "../actions/editor/flow-draft";
import { useTypeRegistry } from "../data-types/type-picker";
import { useQuerySourcesStore } from "../query/use-query-sources";
import { useEditorStore } from "../store/editor-store";
import { useEditorDynamicContext } from "../use-editor-context";

/**
 * The expression scope for fields of the selected element: the page's preview values plus the
 * query loops around the element as `%name`. Loop rows are fetched live on the canvas, so each row
 * here is a blank shaped by the saved structure (Supabase columns, the REST call's data type):
 * tags check and complete by shape, not by row values.
 */
export function useExpressionScope(): Record<string, unknown> | null {
  const context = useEditorDynamicContext();
  const tree = useEditorStore((s) => s.doc?.tree);
  const pickedId = useEditorStore((s) => s.selectedId);
  // In the Action Flow Editor the element is the one the flow belongs to, whatever is selected.
  const flowElementId = useFlowDraft((s) => (s.target?.mode === "flows" ? s.target.nodeId : null));
  const selectedId = flowElementId ?? pickedId;
  const projectId = useEditorStore((s) => s.projectId);
  const sources = useQuerySourcesStore((s) => s.data);
  const loadSources = useQuerySourcesStore((s) => s.load);
  const registry = useTypeRegistry();
  const appState = useEditorStore((s) => s.project.appState);
  const constants = useEditorStore((s) => s.project.constants);
  const pageState = useEditorStore((s) => s.doc?.settings.state);
  const loops = useMemo(
    () => (tree && selectedId ? loopAncestors(tree, selectedId) : []),
    [tree, selectedId]
  );
  const hasLoops = loops.length > 0;
  useEffect(() => {
    if (projectId && hasLoops) void loadSources(projectId);
  }, [projectId, hasLoops, loadSources]);

  return useMemo(() => {
    if (!context) return null;
    const known = {
      supabase: sources?.supabase?.active ? sources.supabase.structure : null,
      rest: sources?.rest ?? null
    };
    const frames = loops.map((node) => {
      const query = activeQuery(node);
      const variables = { app: appState, const: constants, state: pageState ?? [] };
      return loopFrame(node, query ? loopRowSample(query, known, registry, variables) : {}, 0);
    });
    return withLoopScope(expressionScope(context), frames);
  }, [context, loops, sources, registry, appState, constants, pageState]);
}
