"use client";

import { Checkbox, Slider, Switch } from "@heroui/react";
import type { ProjectFont } from "@nextomic/schema";
import { useEffect, useState } from "react";
import {
  fontAxisAction,
  installFontAction,
  searchFontsAction
} from "@/app/(builder)/editor/[id]/font-actions";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import type { CatalogFont } from "@/server/fonts";
import { useEditorStore } from "../../store/editor-store";

const CATEGORIES = [
  { value: "all", label: "All categories" },
  { value: "sans-serif", label: "Sans serif" },
  { value: "serif", label: "Serif" },
  { value: "monospace", label: "Monospace" },
  { value: "display", label: "Display" },
  { value: "handwriting", label: "Handwriting" }
];

const PAGE = 30;

/** Pick weights, italic and subsets of a catalog font, then download it into the project. */
function InstallForm({
  font,
  onInstalled
}: {
  font: CatalogFont;
  onInstalled: (font: ProjectFont) => Promise<void>;
}) {
  const [variable, setVariable] = useState(false);
  // The catalog says "variable" for fonts with any axis; only a real weight axis counts here.
  const [axis, setAxis] = useState<{ min: number; max: number } | null | "checking">(
    font.variable ? "checking" : null
  );
  const [range, setRange] = useState<[number, number]>([100, 900]);
  const [weights, setWeights] = useState<number[]>(
    font.weights.includes(400) ? [400] : font.weights.slice(0, 1)
  );
  const [italic, setItalic] = useState(false);
  const [subsets, setSubsets] = useState<string[]>([
    font.subsets.includes(font.defSubset) ? font.defSubset : (font.subsets[0] ?? "latin")
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasItalic = font.styles.includes("italic");
  const low = axis && axis !== "checking" ? Math.ceil(axis.min / 100) * 100 : 100;
  const high = axis && axis !== "checking" ? Math.floor(axis.max / 100) * 100 : 900;
  const files = (variable ? 1 : weights.length) * (italic ? 2 : 1) * subsets.length;

  useEffect(() => {
    if (!font.variable) return;
    let live = true;
    void fontAxisAction(useEditorStore.getState().projectId, font.id).then((result) => {
      if (!live) return;
      const found = result.error === null ? result.data : null;
      setAxis(found);
      if (found) setRange([Math.ceil(found.min / 100) * 100, Math.floor(found.max / 100) * 100]);
    });
    return () => {
      live = false;
    };
  }, [font.id, font.variable]);

  async function install() {
    setBusy(true);
    setError(null);
    const result = await installFontAction(useEditorStore.getState().projectId, {
      id: font.id,
      weights,
      italic: italic && hasItalic,
      subsets,
      variable,
      ...(variable && axis && axis !== "checking" ? { range } : {})
    });
    if (result.error !== null) {
      setBusy(false);
      return setError(result.error);
    }
    await onInstalled(result.data);
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-divider p-3">
      <p className="text-small font-medium">
        {font.family} <span className="font-normal text-default-500">· {font.license}</span>
      </p>
      {axis === "checking" ? (
        <p className="text-tiny text-default-500">Checking for a variable version…</p>
      ) : null}
      {axis && axis !== "checking" ? (
        <>
          <Switch size="sm" isSelected={variable} onValueChange={setVariable}>
            <span className="text-small">Variable font (one file covers every weight)</span>
          </Switch>
          {variable && high > low ? (
            <Slider
              size="sm"
              step={100}
              minValue={low}
              maxValue={high}
              showSteps
              label="Weights the font may use"
              value={range}
              onChange={(v) =>
                Array.isArray(v) && v.length === 2 && setRange([v[0] ?? low, v[1] ?? high])
              }
              getValue={(v) => (Array.isArray(v) ? `${v[0]} to ${v[1]}` : String(v))}
              classNames={{
                label: "text-tiny font-medium text-default-600",
                value: "text-tiny text-default-600"
              }}
            />
          ) : null}
        </>
      ) : null}
      {variable ? null : (
        <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
          <legend className="pb-1 text-tiny font-medium text-default-600">Weights</legend>
          {font.weights.map((w) => (
            <Checkbox
              key={w}
              size="sm"
              isSelected={weights.includes(w)}
              onValueChange={(on) =>
                setWeights(on ? [...weights, w] : weights.filter((x) => x !== w))
              }
            >
              {w}
            </Checkbox>
          ))}
        </fieldset>
      )}
      {hasItalic ? (
        <Checkbox size="sm" isSelected={italic} onValueChange={setItalic}>
          Include italic
        </Checkbox>
      ) : null}
      <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
        <legend className="pb-1 text-tiny font-medium text-default-600">
          Subsets (only these ship)
        </legend>
        {font.subsets.map((s) => (
          <Checkbox
            key={s}
            size="sm"
            isSelected={subsets.includes(s)}
            onValueChange={(on) =>
              setSubsets(on ? [...subsets, s] : subsets.filter((x) => x !== s))
            }
          >
            {s}
          </Checkbox>
        ))}
      </fieldset>
      {error ? (
        <p role="alert" className="text-tiny text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <span className="text-tiny text-default-500">
          {files} file{files === 1 ? "" : "s"} · stored in this project, no Google requests on your
          site
        </span>
        <ActionButton
          size="sm"
          isLoading={busy}
          isDisabled={
            files === 0 || files > 60 || (!variable && weights.length === 0) || subsets.length === 0
          }
          onPress={() => void install()}
        >
          Install font
        </ActionButton>
      </div>
    </div>
  );
}

export function AddGoogleFont({
  installed,
  onInstalled
}: {
  installed: readonly ProjectFont[];
  onInstalled: (font: ProjectFont) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [variableOnly, setVariableOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [results, setResults] = useState<{ fonts: CatalogFont[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CatalogFont | null>(null);

  useEffect(() => {
    let current = true;
    setError(null);
    const timer = setTimeout(
      async () => {
        const result = await searchFontsAction(useEditorStore.getState().projectId, {
          query,
          category,
          variableOnly,
          offset
        });
        if (!current) return;
        if (result.error !== null) return setError(result.error);
        setResults(result.data);
      },
      query ? 300 : 0
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, category, variableOnly, offset]);

  const has = (family: string): boolean => installed.some((f) => f.family === family);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-end gap-2 p-3">
        <div className="min-w-[180px] flex-1">
          <FormInput
            compact
            type="search"
            aria-label="Search Google Fonts"
            placeholder="Search Google Fonts"
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              setOffset(0);
            }}
          />
        </div>
        <div className="w-40">
          <SelectField
            compact
            hideLabel
            label="Category"
            options={CATEGORIES}
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setOffset(0);
            }}
          />
        </div>
        <Switch
          size="sm"
          isSelected={variableOnly}
          onValueChange={(v) => {
            setVariableOnly(v);
            setOffset(0);
          }}
        >
          <span className="text-small">Variable only</span>
        </Switch>
      </div>
      {error ? (
        <p role="alert" className="px-3 pb-2 text-tiny text-danger">
          {error}
        </p>
      ) : null}
      {results === null && !error ? (
        <p className="px-3 pb-3 text-small text-default-500">Loading the catalog…</p>
      ) : null}
      {results ? (
        <>
          <ul aria-label="Fonts" className="max-h-56 overflow-y-auto border-t border-divider">
            {results.fonts.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  disabled={has(f.family)}
                  onClick={() => setSelected(f)}
                  aria-pressed={selected?.id === f.id}
                  className={
                    "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-small transition-colors duration-300 disabled:opacity-50 " +
                    (selected?.id === f.id ? "bg-default-200" : "hover:bg-default-100")
                  }
                >
                  <span className="truncate font-medium">{f.family}</span>
                  <span className="shrink-0 text-tiny text-default-500">
                    {has(f.family)
                      ? "Added"
                      : `${f.category} · ${f.weights.length} weights${f.variable ? " · variable" : ""}`}
                  </span>
                </button>
              </li>
            ))}
            {results.fonts.length === 0 ? (
              <li className="px-3 py-3 text-small text-default-500">No fonts match.</li>
            ) : null}
          </ul>
          <div className="flex items-center justify-between border-t border-divider px-3 py-1.5 text-tiny text-default-500">
            <span>
              {results.total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE, results.total)} of{" "}
              {results.total}
            </span>
            <span className="flex gap-1">
              <ActionButton
                size="sm"
                tone="ghost"
                isDisabled={offset === 0}
                onPress={() => setOffset(Math.max(0, offset - PAGE))}
              >
                Previous
              </ActionButton>
              <ActionButton
                size="sm"
                tone="ghost"
                isDisabled={offset + PAGE >= results.total}
                onPress={() => setOffset(offset + PAGE)}
              >
                Next
              </ActionButton>
            </span>
          </div>
        </>
      ) : null}
      {selected && !has(selected.family) ? (
        <InstallForm key={selected.id} font={selected} onInstalled={onInstalled} />
      ) : null}
    </div>
  );
}
