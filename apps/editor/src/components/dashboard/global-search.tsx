"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { searchProjectsAction, type ProjectHit } from "@/app/(builder)/(dashboard)/search-actions";
import { Icon } from "@/lib/icons/Icon";
import { matchSettings } from "@/lib/builder-search";

interface Option {
  key: string;
  label: string;
  hint: string;
  href: string;
  kind: "project" | "settings";
}

const DEBOUNCE_MS = 200;
const WIDTH = "w-[min(28rem,calc(100vw-9rem))]";

/**
 * The builder-wide search: an icon that grows into a wide field. It finds the builder's settings
 * sections and the workspace's projects by name (workspaces and more join when they exist).
 */
export function GlobalSearch() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [projects, setProjects] = useState<ProjectHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  const options: Option[] = [
    ...matchSettings(text).map<Option>((t) => ({
      key: `settings:${t.id}`,
      label: t.label,
      hint: "Settings",
      href: t.href,
      kind: "settings"
    })),
    ...projects.map<Option>((p) => ({
      key: `project:${p.id}`,
      label: p.name,
      hint: "Project",
      href: `/editor/${p.id}`,
      kind: "project"
    }))
  ];

  function close(returnFocus: boolean) {
    setOpen(false);
    setText("");
    setProjects([]);
    setError(null);
    if (returnFocus) trigger.current?.focus();
  }

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) close(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = text.trim();
    if (query === "") {
      setProjects([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    let current = true;
    const timer = window.setTimeout(() => {
      void searchProjectsAction(query).then((result) => {
        if (!current) return;
        setLoading(false);
        if (result.error !== null) return setError(result.error);
        setError(null);
        setProjects(result.data);
      });
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [text, open]);

  useEffect(() => setActive(0), [text, projects.length]);

  function choose(option: Option | undefined) {
    if (!option) return;
    close(false);
    router.push(option.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (options.length === 0 ? 0 : (i + 1) % options.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (options.length === 0 ? 0 : (i - 1 + options.length) % options.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(options[active]);
    }
  }

  const settings = options.filter((o) => o.kind === "settings");
  const found = options.filter((o) => o.kind === "project");
  const row = (o: Option) => {
    const index = options.indexOf(o);
    return (
      <li
        key={o.key}
        id={`${listId}-${index}`}
        role="option"
        aria-selected={index === active}
        onMouseEnter={() => setActive(index)}
        onClick={() => choose(o)}
        className={
          "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors " +
          (index === active ? "bg-default text-foreground" : "text-body")
        }
      >
        {o.kind === "project" ? (
          <Icon name="ph:folder" width={16} height={16} className="shrink-0 text-muted" />
        ) : (
          <Icon name="ph:gear-six" width={16} height={16} className="shrink-0 text-muted" />
        )}
        <span className="min-w-0 flex-1 truncate">{o.label}</span>
        <span className="shrink-0 text-xs text-muted">{o.hint}</span>
      </li>
    );
  };

  return (
    <div ref={root} className="relative">
      <div
        className={
          "flex h-9 items-center overflow-hidden rounded-full border transition-[width,background-color,border-color] duration-300 ease-out motion-reduce:transition-none " +
          (open ? `${WIDTH} border-border bg-default` : "w-9 border-transparent bg-transparent")
        }
      >
        <button
          ref={trigger}
          type="button"
          aria-label="Search the builder"
          aria-expanded={open}
          onClick={() => (open ? input.current?.focus() : setOpen(true))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-body transition-colors hover:text-foreground"
        >
          <Icon name="ph:magnifying-glass" label="Search" className="size-5!" />
        </button>
        <input
          ref={input}
          role="combobox"
          aria-label="Search settings and projects"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && options.length > 0 ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          tabIndex={open ? 0 : -1}
          placeholder="Search settings and projects"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className="h-9 min-w-0 flex-1 bg-transparent pr-3 text-sm text-foreground outline-none placeholder:text-muted"
        />
      </div>
      {open ? (
        <div
          className={`absolute right-0 top-11 z-50 ${WIDTH} overflow-hidden rounded-2xl border border-border bg-overlay p-2 shadow-overlay`}
        >
          <ul
            id={listId}
            role="listbox"
            aria-label="Results"
            className="flex max-h-80 flex-col overflow-y-auto"
          >
            {settings.length > 0 ? (
              <>
                <li role="presentation" className="px-3 pb-1 pt-1 text-xs font-medium text-muted">
                  Settings
                </li>
                {settings.map(row)}
              </>
            ) : null}
            {found.length > 0 ? (
              <>
                <li role="presentation" className="px-3 pb-1 pt-2 text-xs font-medium text-muted">
                  Projects
                </li>
                {found.map(row)}
              </>
            ) : null}
          </ul>
          {error ? (
            <p role="alert" className="px-3 py-2 text-xs text-danger">
              {error}
            </p>
          ) : loading ? (
            <p role="status" className="px-3 py-2 text-xs text-muted">
              Searching…
            </p>
          ) : options.length === 0 ? (
            <p role="status" className="px-3 py-2 text-sm text-muted">
              Nothing matches this search.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
