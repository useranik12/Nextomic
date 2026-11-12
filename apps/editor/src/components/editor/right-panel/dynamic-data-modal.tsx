"use client";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@/components/ui/modal";
import { getElementDefinition } from "@nextomic/renderer";
import {
  findTable,
  flowNamesBefore,
  loopAncestors,
  splitTableRef,
  tokenTags,
  type TransformChain
} from "@nextomic/schema";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { TransformPanel } from "../expression/transform-panel";
import { useExpressionScope } from "../expression/use-expression-scope";
import { useQuerySourcesStore } from "../query/use-query-sources";
import { useFlowDraft } from "../actions/editor/flow-draft";
import { useTypeRegistry } from "../data-types/type-picker";
import { useEditorStore } from "../store/editor-store";
import { actionGroups } from "./action-groups";
import { TagCard } from "./dynamic-tag-card";
import { dynamicGroups, type DynamicGroup } from "./dynamic-sources";
import { loopGroups } from "./loop-groups";

export type Exclude = ("params" | "state")[];

const CHIP = "whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors duration-300 ";

/**
 * The dynamic data modal: tags grouped by source with a filter and group chips, and the Transform
 * view for a tag (opened from a tag's wand, or straight away when reopening a tag from the field).
 */
export function DynamicDataModal({
  title,
  exclude,
  serverRun = false,
  initialTransform,
  onClose,
  onPick
}: {
  title: string;
  exclude?: Exclude;
  serverRun?: boolean;
  /** Opens the Transform view of this chain (a tag already in the field). */
  initialTransform: TransformChain | null;
  onClose: () => void;
  onPick: (token: string) => void;
}) {
  const settings = useEditorStore((s) => s.doc?.settings);
  const appState = useEditorStore((s) => s.project.appState);
  const constants = useEditorStore((s) => s.project.constants);
  const appAuth = useEditorStore((s) => s.project.appAuth);
  const tree = useEditorStore((s) => s.doc?.tree);
  const pickedId = useEditorStore((s) => s.selectedId);
  // In the Action Flow Editor the element is the one the flow belongs to, whatever is selected.
  const flowElementId = useFlowDraft((s) => (s.target?.mode === "flows" ? s.target.nodeId : null));
  const selectedId = flowElementId ?? pickedId;
  const projectId = useEditorStore((s) => s.projectId);
  const sources = useQuerySourcesStore((s) => s.data);
  const loadSources = useQuerySourcesStore((s) => s.load);
  const scope = useExpressionScope();
  useEffect(() => {
    if (projectId) void loadSources(projectId);
  }, [projectId, loadSources]);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const [transform, setTransform] = useState<{ chain: TransformChain; label?: string } | null>(
    initialTransform ? { chain: initialTransform } : null
  );
  const excludeKey = exclude?.join(",") ?? "";
  const loops = useMemo(
    () =>
      tree && selectedId
        ? loopGroups(
            loopAncestors(tree, selectedId),
            { supabase: sources?.supabase?.structure ?? null, rest: sources?.rest ?? null },
            (node) => node.name ?? getElementDefinition(node.type)?.label ?? node.type
          )
        : [],
    [tree, selectedId, sources]
  );
  const groups = useMemo(
    () =>
      dynamicGroups(settings, excludeKey ? (excludeKey.split(",") as Exclude) : [], {
        appState,
        constants,
        auth: serverRun ? { ...tokenTags(appAuth), raw: appAuth.enabled } : tokenTags(appAuth)
      }),
    [settings, excludeKey, appState, constants, appAuth, serverRun]
  );
  // Inside the Action Flow Editor: what the earlier nodes of the open node answer.
  const flowNodes = useFlowDraft((s) => (s.target ? s.nodes() : null));
  const flowNodeId = useFlowDraft((s) => s.selectedId);
  const registry = useTypeRegistry();
  const actions = useMemo(() => {
    if (!flowNodes || !flowNodeId) return [];
    const structure = sources?.supabase?.structure ?? null;
    return actionGroups(flowNamesBefore(flowNodes, flowNodeId) ?? [], {
      columns: (ref) => {
        const { schema, table } = splitTableRef(ref);
        const found = findTable(structure, schema, table);
        return found ? found.columns.map((c) => ({ name: c.name, type: c.type })) : null;
      },
      restFields: (callId) => {
        const response = sources?.rest?.calls.find((c) => c.id === callId)?.response;
        if (!response?.parseAsDataType) return null;
        const type = registry.dataTypes.find((d) => d.id === response.dataTypeId);
        return type ? type.fields.map((f) => ({ name: f.name, type: f.type })) : null;
      }
    });
  }, [flowNodes, flowNodeId, sources, registry]);
  const allGroups = useMemo(() => [...actions, ...loops, ...groups], [actions, loops, groups]);
  const q = query.trim().toLowerCase();
  const visible = allGroups
    .filter((g) => group === "all" || g.id === group || g.section?.id === group)
    .map((g) => ({
      ...g,
      tags: g.tags.filter(
        (t) => !q || t.token.toLowerCase().includes(q) || t.label.toLowerCase().includes(q)
      )
    }))
    .filter((g) => g.tags.length > 0 || (g.section && !q));
  const plain = visible.filter((g) => !g.section);
  const sections = [...new Set(visible.flatMap((g) => (g.section ? [g.section.id] : [])))].map(
    (id) => ({
      id,
      label: visible.find((g) => g.section?.id === id)?.section?.label ?? id,
      groups: visible.filter((g) => g.section?.id === id)
    })
  );
  const chips = [
    ...new Map(allGroups.map((g) => [g.section?.id ?? g.id, g.section?.label ?? g.label])).entries()
  ].map(([id, label]) => ({ id, label }));
  // A search or a chosen chip opens the blocks; otherwise they start closed.
  const opened = q !== "" || group !== "all";
  const transformLabel =
    transform?.label ??
    allGroups.flatMap((g) => g.tags).find((t) => t.token === transform?.chain.base)?.label;

  const renderTags = (g: DynamicGroup) =>
    g.tags.map((tag) => (
      <TagCard
        key={tag.token}
        tag={tag}
        onPick={() => onPick(tag.token)}
        onTransform={() =>
          setTransform({
            chain: { base: tag.token, steps: [], fallback: "" },
            label: tag.label
          })
        }
      />
    ));

  return (
    <Modal
      isOpen
      onClose={onClose}
      scrollBehavior="inside"
      classNames={{ base: "h-[80vh] w-[80vw] max-w-[80vw] sm:max-w-[80vw]" }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          Dynamic data
          <span className="text-xs font-normal text-muted">
            {transform ? "Transform a dynamic tag for" : "Insert a dynamic tag into"} {title}
          </span>
        </ModalHeader>
        <ModalBody className="gap-4 pb-6">
          {transform ? (
            <TransformPanel
              initial={transform.chain}
              label={transformLabel}
              scope={scope}
              replacing={initialTransform !== null}
              onBack={() => (initialTransform ? onClose() : setTransform(null))}
              onInsert={onPick}
            />
          ) : (
            <>
              <label className="relative block">
                <span className="sr-only">Filter the dynamic tags</span>
                <Icon
                  name="ph:magnifying-glass"
                  width={16}
                  height={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type here to filter the dynamic tags"
                  className="h-11 w-full rounded-full border border-border bg-transparent pl-10 pr-4 text-sm outline-none transition-colors hover:border-default-400 focus:border-focus"
                />
              </label>
              <div role="group" aria-label="Tag groups" className="flex flex-wrap gap-2">
                {[{ id: "all", label: "All" }, ...chips].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={group === g.id}
                    onClick={() => setGroup(g.id)}
                    className={
                      CHIP +
                      (group === g.id
                        ? "bg-default-hover text-foreground"
                        : "bg-default text-body hover:bg-default-hover")
                    }
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              {visible.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">
                  No dynamic tags match &ldquo;{query}&rdquo;.
                </p>
              ) : (
                <>
                  {sections.map((sec) => (
                    <details
                      key={`${sec.id}-${opened}`}
                      open={opened}
                      className="rounded-xl border border-border px-3 py-2"
                    >
                      <summary className="cursor-pointer text-sm font-semibold">
                        {sec.label}{" "}
                        <span className="font-normal text-muted">({sec.groups.length})</span>
                      </summary>
                      <div className="mt-2 flex flex-col gap-2">
                        {sec.groups.map((g) => (
                          <details key={`${g.id}-${opened}`} open={opened} className="pl-2">
                            <summary className="cursor-pointer text-xs font-semibold uppercase text-muted">
                              {g.label}
                            </summary>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {g.tags.length === 0 ? (
                                <p className="text-sm text-muted">
                                  Name this loop in its Query Loop settings to use its tags.
                                </p>
                              ) : (
                                renderTags(g)
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                  {plain.length > 0 ? (
                    // Masonry columns about 14rem wide: as many as fit, groups pack with no blank space.
                    <div className="columns-[14rem] gap-6">
                      {plain.map((g) => (
                        <section
                          key={g.id}
                          aria-label={g.label}
                          className="mb-6 flex min-w-0 break-inside-avoid flex-col gap-2"
                        >
                          <h3 className="text-xs font-semibold uppercase text-muted">{g.label}</h3>
                          {renderTags(g)}
                        </section>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
