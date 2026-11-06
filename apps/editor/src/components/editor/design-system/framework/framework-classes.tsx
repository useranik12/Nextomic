"use client";

import {
  frameworkClassRules,
  frameworkClasses,
  frameworkStylesheet,
  type Framework
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { useEditorStore } from "../../store/editor-store";
import { useDesignNav } from "../design-nav";

/** Classes found in the framework stylesheet, grouped by prefix, with their rules and an add action. */
export function FrameworkClasses({ framework }: { framework: Framework }) {
  const css = useMemo(() => frameworkStylesheet(framework), [framework]);
  const all = useMemo(() => frameworkClasses(css), [css]);
  const nav = useDesignNav();
  const selectedId = useEditorStore((s) => s.selectedId);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of all) {
      if (!q || c.name.toLowerCase().includes(q))
        map.set(c.group, [...(map.get(c.group) ?? []), c.name]);
    }
    return [...map.entries()];
  }, [all, q]);

  if (all.length === 0)
    return <p className="p-4 text-small text-default-500">This framework has no classes.</p>;
  return (
    <div className="flex flex-col gap-3 p-3">
      <FormInput
        compact
        label={`Search ${all.length} classes`}
        value={query}
        onValueChange={setQuery}
      />
      {groups.map(([group, names]) => (
        <section key={group}>
          <h3 className="pb-1 text-small font-semibold">
            {group} <span className="font-normal text-default-500">{names.length}</span>
          </h3>
          <ul className="flex flex-col">
            {names.slice(0, 200).map((name) => (
              <li key={name} className="border-b border-divider py-1">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 truncate text-left font-mono text-tiny hover:underline"
                    title="Open in the Classes manager"
                    onClick={() => nav.go("classes", { className: name })}
                  >
                    .{name}
                  </button>
                  <button
                    type="button"
                    aria-expanded={open === name}
                    aria-label={`Show the rules of .${name}`}
                    onClick={() => setOpen(open === name ? null : name)}
                    className="shrink-0 rounded-medium px-2 text-tiny text-default-500 hover:bg-default-100"
                  >
                    {open === name ? "Hide CSS" : "CSS"}
                  </button>
                  <ActionButton
                    size="sm"
                    tone="ghost"
                    isDisabled={!selectedId}
                    onPress={() =>
                      selectedId && useEditorStore.getState().setElementClass(selectedId, name)
                    }
                  >
                    {selectedId ? "Add to element" : "Select an element"}
                  </ActionButton>
                </div>
                {open === name ? (
                  <pre className="mt-1 max-h-40 overflow-auto rounded-medium bg-default-100 p-2 text-tiny">
                    {frameworkClassRules(css, name)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
