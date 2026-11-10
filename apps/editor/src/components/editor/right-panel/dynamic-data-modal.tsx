"use client";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { getElementDefinition } from "@nextomic/renderer";
import { loopAncestors, tokenTags, type TransformChain } from "@nextomic/schema";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { TransformPanel } from "../expression/transform-panel";
import { useExpressionScope } from "../expression/use-expression-scope";
import { useQuerySourcesStore } from "../query/use-query-sources";
import { useEditorStore } from "../store/editor-store";
import { TagCard } from "./dynamic-tag-card";
import { dynamicGroups } from "./dynamic-sources";
import { loopGroups } from "./loop-groups";

export type Exclude = ("params" | "state")[];

const CHIP =
  "whitespace-nowrap rounded-full px-3 py-1.5 text-small transition-colors duration-300 ";

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
  const selectedId = useEditorStore((s) => s.selectedId);
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
  const allGroups = useMemo(() => [...loops, ...groups], [loops, groups]);
  const q = query.trim().toLowerCase();
  const visible = allGroups
    .filter((g) => group === "all" || g.id === group)
    .map((g) => ({
      ...g,
      tags: g.tags.filter(
        (t) => !q || t.token.toLowerCase().includes(q) || t.label.toLowerCase().includes(q)
      )
    }))
    .filter((g) => g.tags.length > 0);
  const transformLabel =
    transform?.label ??
    allGroups.flatMap((g) => g.tags).find((t) => t.token === transform?.chain.base)?.label;

  return (
    <Modal
      isOpen
      onClose={onClose}
      backdrop="blur"
      scrollBehavior="inside"
      classNames={{ base: "h-[80vh] w-[80vw] max-w-[80vw] sm:max-w-[80vw]" }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          Dynamic data
          <span className="text-tiny font-normal text-default-500">
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
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-default-500"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type here to filter the dynamic tags"
                  className="h-11 w-full rounded-full border border-default-200 bg-transparent pl-10 pr-4 text-small outline-none transition-colors hover:border-default-400 focus:border-default-800"
                />
              </label>
              <div role="group" aria-label="Tag groups" className="flex flex-wrap gap-2">
                {[{ id: "all", label: "All" }, ...allGroups].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={group === g.id}
                    onClick={() => setGroup(g.id)}
                    className={
                      CHIP +
                      (group === g.id
                        ? "bg-default-800 text-default-50"
                        : "bg-default-100 text-default-600 hover:bg-default-200")
                    }
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              {visible.length === 0 ? (
                <p className="py-8 text-center text-small text-default-500">
                  No dynamic tags match &ldquo;{query}&rdquo;.
                </p>
              ) : (
                // Masonry columns about 14rem wide: as many as fit, groups pack with no blank space.
                <div className="columns-[14rem] gap-6">
                  {visible.map((g) => (
                    <section
                      key={g.id}
                      aria-label={g.label}
                      className="mb-6 flex min-w-0 break-inside-avoid flex-col gap-2"
                    >
                      <h3 className="text-tiny font-semibold uppercase text-default-500">
                        {g.label}
                      </h3>
                      {g.tags.map((tag) => (
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
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
