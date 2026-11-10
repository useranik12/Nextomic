"use client";

import { activeQuery, walkElements, type FieldKind, type ParamField } from "@nextomic/schema";
import { useEffect, useMemo, useState } from "react";
import { listPagesAction } from "@/app/(builder)/editor/[id]/actions";
import type { SelectOption } from "@/components/ui/controls";
import { useQuerySources } from "../../query/use-query-sources";
import { useEditorStore } from "../../store/editor-store";

export type PickerKind = Extract<
  FieldKind,
  | "element"
  | "page"
  | "appState"
  | "pageState"
  | "query"
  | "supabaseTable"
  | "restCall"
  | "timeline"
  | "theme"
>;

export const PICKER_KINDS: ReadonlySet<FieldKind> = new Set<PickerKind>([
  "element",
  "page",
  "appState",
  "pageState",
  "query",
  "supabaseTable",
  "restCall",
  "timeline",
  "theme"
]);

const EMPTY_HINT: Record<PickerKind, string> = {
  element: "No matching element on this page.",
  page: "No pages yet.",
  appState: "Add app state variables in State Management first.",
  pageState: "Add page state variables in Page Settings first.",
  query: "No query loop on this page.",
  supabaseTable: "Connect Supabase and fetch its schema first.",
  restCall: "Add a call in API Data first.",
  timeline: "Create a GSAP timeline in Animations first.",
  theme: "No themes."
};

/** Options for every structure picker, read from the editor and the project. */
export function usePickerOptions(): {
  optionsFor: (field: ParamField) => SelectOption[];
  emptyHint: (kind: PickerKind) => string;
} {
  const projectId = useEditorStore((s) => s.projectId);
  const doc = useEditorStore((s) => s.doc);
  const project = useEditorStore((s) => s.project);
  const sources = useQuerySources(projectId);
  const [pages, setPages] = useState<SelectOption[]>([]);

  useEffect(() => {
    if (!projectId) return;
    let live = true;
    void listPagesAction(projectId).then((result) => {
      if (live && result.error === null) {
        setPages(result.data.map((p) => ({ value: p.id, label: `${p.name} (${p.route})` })));
      }
    });
    return () => {
      live = false;
    };
  }, [projectId]);

  const lists = useMemo(() => {
    const elements: { value: string; label: string; type: string }[] = [];
    const queries: SelectOption[] = [];
    if (doc) {
      walkElements(doc.tree, (node) => {
        elements.push({ value: node.id, label: node.name ?? node.type, type: node.type });
        const query = activeQuery(node);
        if (query) queries.push({ value: node.id, label: query.name });
      });
    }
    const structure = sources.data?.supabase?.structure;
    const tables = (structure?.schemas ?? []).flatMap((s) =>
      s.tables.map((t) => {
        const name = s.schema === "public" ? t.name : `${s.schema}.${t.name}`;
        return { value: name, label: name };
      })
    );
    return {
      elements,
      queries,
      tables,
      calls: (sources.data?.rest.calls ?? []).map((c) => ({ value: c.id, label: c.name })),
      appState: project.appState.map((v) => ({ value: v.name, label: v.name })),
      pageState: (doc?.settings.state ?? []).map((v) => ({ value: v.name, label: v.name })),
      timelines: project.animations.timelines.map((t) => ({ value: t.id, label: t.name })),
      themes: project.themes.map((t) => ({ value: t.id, label: t.name }))
    };
  }, [doc, project, sources.data]);

  const optionsFor = (field: ParamField): SelectOption[] => {
    switch (field.kind as PickerKind) {
      case "element": {
        const allowed = field.elementTypes;
        const items = lists.elements
          .filter((e) => !allowed || allowed.includes(e.type))
          .map(({ value, label }) => ({ value, label }));
        return field.selfWhenEmpty ? [{ value: "", label: "This element" }, ...items] : items;
      }
      case "page":
        return pages;
      case "appState":
        return lists.appState;
      case "pageState":
        return lists.pageState;
      case "query":
        return lists.queries;
      case "supabaseTable":
        return lists.tables;
      case "restCall":
        return lists.calls;
      case "timeline":
        return lists.timelines;
      case "theme":
        return lists.themes;
      default:
        return [];
    }
  };

  return { optionsFor, emptyHint: (kind) => EMPTY_HINT[kind] };
}
