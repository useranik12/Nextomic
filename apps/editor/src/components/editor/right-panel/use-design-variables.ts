"use client";

import {
  frameworkVariableMeta,
  resolveTheme,
  variableCssName,
  variableRef,
  type VariableType
} from "@nextomic/schema";
import { useMemo } from "react";
import { useEditorStore } from "../store/editor-store";

export interface DesignVariable {
  key: string;
  name: string;
  /** The custom property as written in CSS (`--nxt-gap` or `--primary`). */
  cssName: string;
  /** What a style value stores to use the variable. */
  ref: string;
  type: VariableType;
  group: string;
  value: string;
  source: "project" | "framework";
}

const FRAMEWORK_TYPE: Record<string, VariableType> = {
  color: "color",
  size: "size",
  shadow: "shadow",
  string: "string"
};

/** Project variables plus the variables of the framework of the theme the current page uses. */
export function useDesignVariables(): DesignVariable[] {
  const variables = useEditorStore((s) => s.project.variables);
  const themes = useEditorStore((s) => s.project.themes);
  return useMemo(() => {
    const project = variables.map<DesignVariable>((v) => ({
      key: `p:${v.name}`,
      name: v.name,
      cssName: variableCssName(v.name),
      ref: variableRef(v.name),
      type: v.type,
      group: v.group,
      value: v.value,
      source: "project"
    }));
    const theme = resolveTheme(themes, { pageId: "", route: "/" }).theme;
    const framework = (theme?.framework?.variables ?? []).map<DesignVariable>((v) => {
      const m = frameworkVariableMeta(v);
      return {
        key: `f:${v.name}`,
        name: v.name,
        cssName: m.cssName,
        ref: m.ref,
        type: FRAMEWORK_TYPE[m.type] ?? "string",
        group: m.group,
        value: v.value,
        source: "framework"
      };
    });
    return [...project, ...framework];
  }, [variables, themes]);
}
