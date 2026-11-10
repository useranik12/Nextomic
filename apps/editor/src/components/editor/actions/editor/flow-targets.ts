import type { PageParam, TargetParams } from "@nextomic/schema";
import { create } from "zustand";
import { listPagesAction } from "@/app/(builder)/editor/[id]/actions";
import { listTemplatesAction } from "@/app/(builder)/editor/[id]/library-actions";
import type { PageSummary } from "@/server/pages";
import type { TemplateSummary } from "@/server/templates";

// Pages and templates a flow can target (Navigate To, Show Toast), with their parameters. Loaded
// when the flow editor opens, so the pickers, the parameter inputs and the checks agree.

interface FlowTargetsState {
  status: "idle" | "loading" | "ready" | "error";
  pages: PageSummary[];
  templates: TemplateSummary[];
  load: (projectId: string) => Promise<void>;
}

export const useFlowTargets = create<FlowTargetsState>((set) => ({
  status: "idle",
  pages: [],
  templates: [],
  load: async (projectId) => {
    set({ status: "loading" });
    const [pages, templates] = await Promise.all([
      listPagesAction(projectId),
      listTemplatesAction(projectId)
    ]);
    if (pages.error !== null || templates.error !== null) {
      set({ status: "error" });
      return;
    }
    set({ status: "ready", pages: pages.data, templates: templates.data });
  }
}));

/** What the flow checks read: the parameters of every page and template. */
export function targetParamsOf(
  pages: readonly PageSummary[],
  templates: readonly TemplateSummary[]
): TargetParams {
  return {
    pages: Object.fromEntries(pages.map((p) => [p.id, p.params])),
    templates: Object.fromEntries(
      templates.map((t) => [
        t.id,
        {
          params: t.settings.params,
          published: t.status !== "draft",
          hasConditions: t.settings.rules.items.length > 0
        }
      ])
    )
  };
}

/** The parameters of the page or template a field targets (empty until one is chosen). */
export function paramsOfTarget(
  kind: "page" | "template",
  id: string,
  pages: readonly PageSummary[],
  templates: readonly TemplateSummary[]
): readonly PageParam[] {
  if (kind === "page") return pages.find((p) => p.id === id)?.params ?? [];
  return templates.find((t) => t.id === id)?.settings.params ?? [];
}
