"use client";

import {
  frameworkVariableMeta,
  type Framework,
  type FrameworkVariableMeta
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { FormInput } from "@/components/ui/controls";
import { useDesignNav } from "../design-nav";

/** Variables grouped by prefix, searchable, with a light and a dark value each. */
export function FrameworkVariables({
  framework,
  darkMode,
  onChange
}: {
  framework: Framework;
  /** The theme has dark mode on: show the dark value column. */
  darkMode: boolean;
  onChange: (fw: Framework) => string | null;
}) {
  const nav = useDesignNav();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, FrameworkVariableMeta[]>();
    for (const v of framework.variables) {
      if (q && !v.name.toLowerCase().includes(q)) continue;
      const meta = frameworkVariableMeta(v);
      map.set(meta.group, [...(map.get(meta.group) ?? []), meta]);
    }
    return [...map.entries()];
  }, [framework.variables, query]);

  function edit(name: string, key: "value" | "dark", value: string) {
    const v = value.trim();
    void onChange({
      ...framework,
      variables: framework.variables.map((x) => {
        if (x.name !== name) return x;
        if (key === "dark") {
          const { dark: _drop, ...rest } = x;
          return v === "" ? rest : { ...rest, dark: v };
        }
        return v === "" ? x : { ...x, value: v };
      })
    });
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <FormInput compact label="Search variables" value={query} onValueChange={setQuery} />
      {groups.length === 0 ? <p className="text-sm text-muted">No variables match.</p> : null}
      {groups.map(([group, list]) => (
        <section key={group}>
          <h3 className="pb-1 text-sm font-semibold">{group}</h3>
          <ul className="flex flex-col divide-y divide-border">
            {list.map((m) => {
              const dark = framework.variables.find((v) => v.name === m.name)?.dark ?? "";
              return (
                <li
                  key={m.name}
                  className={`grid items-center gap-2 py-1.5 ${darkMode ? "grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]" : "grid-cols-[minmax(0,1fr)_minmax(0,2.4fr)]"}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {m.type === "color" ? (
                      <span
                        aria-hidden
                        className="h-4 w-4 shrink-0 rounded-full border border-border"
                        style={{ background: m.value }}
                      />
                    ) : null}
                    <button
                      type="button"
                      title="Open in the Variables manager"
                      onClick={() => nav.go("variables", { variable: m.name })}
                      className="min-w-0 truncate text-left font-mono text-xs hover:underline"
                    >
                      {m.cssName}
                    </button>
                  </span>
                  <FormInput
                    compact
                    aria-label={`${m.cssName} value`}
                    value={m.value}
                    onValueChange={(v) => edit(m.name, "value", v)}
                  />
                  {darkMode ? (
                    <FormInput
                      compact
                      aria-label={`${m.cssName} dark value`}
                      placeholder="dark value"
                      value={dark}
                      onValueChange={(v) => edit(m.name, "dark", v)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
