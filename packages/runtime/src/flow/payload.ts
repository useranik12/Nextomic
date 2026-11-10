import type {
  ActionBlock,
  AppStateVariable,
  DynamicContext,
  FlowsByNode,
  Overlay,
  OverlayTemplateType,
  SheetEntry
} from "@nextomic/schema";

/** What a built page's action runtime receives from the server render. */
export interface RuntimePayload {
  projectId: string;
  /** Live site or the owner preview (drafts; persisted state uses its own namespace there). */
  mode: "live" | "preview";
  route: string;
  search: string;
  flows: FlowsByNode;
  blocks: ActionBlock[];
  /** Per element id, the state names it reads ("app.cart", "state.open"); loop-free elements only. */
  deps: Record<string, string[]>;
  /** Ids of the page root and template roots: their flows hold page-level triggers. */
  rootIds: string[];
  /** The page's dynamic context; the access token is always blank. */
  dynamic: DynamicContext;
  appState: AppStateVariable[];
  /** Page id to route, for Navigate To. */
  routes: Record<string, string>;
}

/** One redrawn element from the fragment endpoint. */
export interface FragmentPart {
  id: string;
  /** Rendered HTML, or an empty `<template data-nx-slot>` when its conditions now fail. */
  html: string;
  css: string;
}

export interface FragmentRequest {
  ids?: string[];
  app: Record<string, string>;
  state: Record<string, string>;
  /** Show Modal or Show Bottom Sheet: the template and its parameter values. */
  overlay?: { templateId: string; params: Record<string, string> };
}

/** A modal or bottom sheet template, rendered and ready for the overlay layer. */
export interface OverlayPart {
  templateId: string;
  type: OverlayTemplateType;
  html: string;
  css: string;
  /** Template's own overlay settings; the action may override them. */
  overlay: Overlay;
  /** Bottom sheet only. */
  entry: SheetEntry;
  /** Rank from the template's "Show above" settings, within its band. */
  rank: number;
}

export interface FragmentResponse {
  parts: FragmentPart[];
  overlay: OverlayPart | null;
}
