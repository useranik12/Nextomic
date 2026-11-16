"use client";

import { activeForms, type FormInfo } from "@nextomic/schema";
import { useEffect, useMemo } from "react";
import { useFlowTargets } from "../actions/editor/flow-targets";
import { useEditorStore } from "../store/editor-store";

/**
 * The active forms Form actions and Form tags can use: those of the open page or template (read
 * live, so an unsaved form counts) plus those of every saved template, since a header, footer or
 * popup form is part of the page it shows on. A form name appears once.
 */
export function useAvailableForms(): FormInfo[] {
  const projectId = useEditorStore((s) => s.projectId);
  const tree = useEditorStore((s) => s.doc?.tree ?? null);
  const openTemplateId = useEditorStore((s) => (s.page?.kind === "template" ? s.page.id : null));
  const status = useFlowTargets((s) => s.status);
  const templateForms = useFlowTargets((s) => s.templateForms);

  useEffect(() => {
    if (projectId && status === "idle") void useFlowTargets.getState().load(projectId);
  }, [projectId, status]);

  return useMemo(() => {
    const own = tree ? activeForms(tree) : [];
    const others = templateForms
      .filter((t) => t.templateId !== openTemplateId)
      .flatMap((t) => t.forms);
    const seen = new Set<string>();
    return [...own, ...others].filter((f) => {
      const key = f.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tree, templateForms, openTemplateId]);
}
