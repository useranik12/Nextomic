"use client";

import {
  DEFAULT_COLOR_GROUP,
  derivedColorVariables,
  frameworkColors,
  frameworkVariableMeta,
  resolveRenderTheme,
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
  /** The dark mode value, when the color has its own (or a shade of a color that does). */
  dark?: string;
  source: "project" | "framework";
}

const SHADE_NAME = /-(?:l|d)-\d{1,2}$|-t-\d{2}$/;

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
    const theme = resolveRenderTheme(themes, { pageId: "", route: "/" }).theme;
    const fw = theme?.framework ?? null;
    // Colors belong to the palette (group) the Colors manager shows them in, and their generated
    // shades sit with them, so the picker and the manager list the same colors the same way.
    const palette = new Map<string, string>();
    if (fw) for (const c of frameworkColors(fw)) palette.set(c.name, c.group);
    const shadeBase = (name: string) => name.replace(SHADE_NAME, "");
    const all = fw ? [...fw.variables, ...derivedColorVariables(fw)] : [];
    const framework = all.map<DesignVariable>((v) => {
      const m = frameworkVariableMeta(v);
      const isShade = SHADE_NAME.test(v.name) && palette.has(shadeBase(v.name));
      const type = isShade ? "color" : (FRAMEWORK_TYPE[m.type] ?? "string");
      const group =
        type === "color"
          ? (palette.get(v.name) ?? palette.get(shadeBase(v.name)) ?? DEFAULT_COLOR_GROUP)
          : m.group;
      return {
        key: `f:${v.name}`,
        name: v.name,
        cssName: m.cssName,
        ref: m.ref,
        type,
        group,
        value: v.value,
        ...(v.dark !== undefined ? { dark: v.dark } : {}),
        source: "framework"
      };
    });
    return [...project, ...framework];
  }, [variables, themes]);
}
