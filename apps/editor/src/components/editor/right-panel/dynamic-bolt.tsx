"use client";

import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { useMemo, useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { dynamicGroups } from "./dynamic-sources";

type Exclude = ("params" | "state")[];

const CHIP =
  "whitespace-nowrap rounded-full px-3 py-1.5 text-small transition-colors duration-300 ";

/**
 * The bolt on a field. It opens a large modal of dynamic tags grouped by source, with a filter and
 * group chips; picking a tag inserts it into the field as a {{token}}.
 */
export function DynamicBolt({
  label,
  onInsert,
  disabledReason,
  exclude
}: {
  label: string;
  onInsert: (token: string) => void;
  /** When set the bolt is shown but cannot be used yet, and this says why. */
  disabledReason?: string;
  /** Page groups this field must not reference (its own parameters or state variables). */
  exclude?: Exclude;
}) {
  const [open, setOpen] = useState(false);
  const button =
    "flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-300 " +
    (disabledReason
      ? "text-default-300"
      : "text-default-500 hover:bg-default-200 hover:text-warning");

  if (disabledReason) {
    return (
      <button
        type="button"
        aria-label={`Dynamic value for ${label} (unavailable)`}
        title={disabledReason}
        aria-disabled="true"
        className={button + " cursor-not-allowed"}
      >
        <Icon name="ph:lightning" width={14} height={14} />
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Dynamic value for ${label}`}
        onClick={() => setOpen(true)}
        className={button}
      >
        <Icon name="ph:lightning" width={14} height={14} />
      </button>
      {open ? (
        <DynamicDataModal
          title={label}
          exclude={exclude}
          onClose={() => setOpen(false)}
          onPick={(token) => {
            onInsert(token);
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function DynamicDataModal({
  title,
  exclude,
  onClose,
  onPick
}: {
  title: string;
  exclude?: Exclude;
  onClose: () => void;
  onPick: (token: string) => void;
}) {
  const settings = useEditorStore((s) => s.doc?.settings);
  const appState = useEditorStore((s) => s.project.appState);
  const constants = useEditorStore((s) => s.project.constants);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("all");
  const excludeKey = exclude?.join(",") ?? "";
  const groups = useMemo(
    () =>
      dynamicGroups(settings, excludeKey ? (excludeKey.split(",") as Exclude) : [], {
        appState,
        constants
      }),
    [settings, excludeKey, appState, constants]
  );
  const q = query.trim().toLowerCase();
  const visible = groups
    .filter((g) => group === "all" || g.id === group)
    .map((g) => ({
      ...g,
      tags: g.tags.filter(
        (t) => !q || t.token.toLowerCase().includes(q) || t.label.toLowerCase().includes(q)
      )
    }))
    .filter((g) => g.tags.length > 0);

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
            Insert a dynamic tag into {title}
          </span>
        </ModalHeader>
        <ModalBody className="gap-4 pb-6">
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
            {[{ id: "all", label: "All" }, ...groups].map((g) => (
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
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {visible.map((g) => (
                <section key={g.id} aria-label={g.label} className="flex min-w-0 flex-col gap-2">
                  <h3 className="text-tiny font-semibold uppercase text-default-500">{g.label}</h3>
                  {g.tags.map((tag) => (
                    <button
                      key={tag.token}
                      type="button"
                      onClick={() => onPick(tag.token)}
                      title={tag.help}
                      className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-large bg-default-100 px-4 py-2 text-left transition-colors duration-300 hover:bg-default-200"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-small text-foreground">
                          {`{{${tag.token}}}`}
                        </span>
                        <span className="block truncate text-tiny text-default-500">
                          {tag.label}
                        </span>
                        {tag.help ? (
                          <span className="mt-1 hidden whitespace-normal text-tiny text-default-600 group-hover:block group-focus-visible:block">
                            {tag.help}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-tiny text-default-500">{tag.hint}</span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
