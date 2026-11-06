"use client";

import {
  frameworkVariableMeta,
  type Framework,
  type FrameworkVariableMeta
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { FormInput } from "@/components/ui/controls";

/** Variables grouped by prefix, searchable, with a light and a dark value each. */
export function FrameworkVariables({
  framework,
  onChange
}: {
  framework: Framework;
  onChange: (fw: Framework) => string | null;
}) {
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
      {groups.length === 0 ? (
        <p className="text-small text-default-500">No variables match.</p>
      ) : null}
      {groups.map(([group, list]) => (
        <section key={group}>
          <h3 className="pb-1 text-small font-semibold">{group}</h3>
          <ul className="flex flex-col divide-y divide-divider">
            {list.map((m) => {
              const dark = framework.variables.find((v) => v.name === m.name)?.dark ?? "";
              return (
                <li
                  key={m.name}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] items-center gap-2 py-1.5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {m.type === "color" ? (
                      <span
                        aria-hidden
                        className="h-4 w-4 shrink-0 rounded-full border border-divider"
                        style={{ background: m.value }}
                      />
                    ) : null}
                    <code className="truncate text-tiny">{m.cssName}</code>
                  </span>
                  <FormInput
                    compact
                    aria-label={`${m.cssName} value`}
                    value={m.value}
                    onValueChange={(v) => edit(m.name, "value", v)}
                  />
                  <FormInput
                    compact
                    aria-label={`${m.cssName} dark value`}
                    placeholder="dark value"
                    value={dark}
                    onValueChange={(v) => edit(m.name, "dark", v)}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
