"use client";

import {
  addColor,
  addColorGroup,
  applyColorPrefix,
  colorGroups,
  colorRenamePairs,
  frameworkColors,
  removeColorGroup,
  renameColor,
  renameColorGroup,
  renameInFramework,
  type ColorResult,
  type Framework
} from "@nextomic/schema";
import { useMemo, useState } from "react";
import { ActionButton, FormInput, SelectField } from "@/components/ui/controls";
import { ColorField } from "@/components/ui/color-field";
import { Icon } from "@/lib/icons/Icon";
import { FrameworkGate, type GateProps } from "../framework/framework-gate";
import { useCssVarUsage } from "../use-css-var-usage";
import { InfoTip } from "@/components/ui/info-tip";
import { useEditorStore } from "../../store/editor-store";
import { ColorRow } from "./color-row";

type Mode = "none" | "add-color" | "add-palette" | "rename-palette";

function IconButton({
  label,
  icon,
  onPress,
  danger
}: {
  label: string;
  icon: "ph:plus" | "ph:pencil-simple" | "ph:trash";
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onPress}
      className={`flex h-9 w-9 items-center justify-center rounded-xl border border-border text-body transition-colors duration-300 ${danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-default"}`}
    >
      <Icon name={icon} width={16} height={16} />
    </button>
  );
}

function ColorsManager({ theme, framework, update }: GateProps) {
  const groups = colorGroups(framework);
  const [selected, setSelected] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("none");
  const [text, setText] = useState("");
  const [value, setValue] = useState("#4f46e5");
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState(framework.colorPrefix);
  const used = useCssVarUsage();
  const palette = selected && groups.includes(selected) ? selected : (groups[0] ?? null);
  const colors = useMemo(
    () => frameworkColors(framework).filter((c) => c.group === palette),
    [framework, palette]
  );

  function apply(run: (fw: Framework) => ColorResult): string | null {
    const result = run(framework);
    if ("error" in result) return result.error;
    return update(result.framework);
  }

  /** Renames a color and points everything that uses it (this page, classes, variables, other pages) at the new name. */
  function rename(from: string, to: string): string | null {
    const result = renameColor(framework, from, to);
    if ("error" in result) return result.error;
    const pairs = colorRenamePairs(framework, from, to);
    const failed = update(renameInFramework(result.framework, pairs));
    if (failed) return failed;
    useEditorStore.getState().renameCssVars(pairs);
    return null;
  }

  /** Gives every color of the theme the prefix, with the same follow-up for what uses them. */
  function applyPrefix() {
    const out = applyColorPrefix(framework, prefix);
    if ("error" in out) return setError(out.error);
    const failed = update(out.framework);
    setError(failed);
    if (failed) return;
    useEditorStore.getState().renameCssVars(out.renames);
    setOpen(null);
  }

  function submit() {
    const failed =
      mode === "add-color"
        ? apply((fw) => addColor(fw, { name: text, value, group: palette ?? "Colors" }))
        : mode === "add-palette"
          ? apply((fw) => addColorGroup(fw, text))
          : apply((fw) => renameColorGroup(fw, palette ?? "", text));
    setError(failed);
    if (failed) return;
    if (mode === "add-palette") setSelected(text.trim());
    if (mode === "rename-palette") setSelected(text.trim());
    if (mode === "add-color") setOpen(text.trim());
    setMode("none");
  }

  function begin(next: Mode) {
    setError(null);
    setMode(next);
    setText(
      next === "add-color"
        ? framework.colorPrefix
        : next === "rename-palette"
          ? (palette ?? "")
          : ""
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <p className="text-sm text-muted">
        Manage the colors of this theme. Generate dark mode colors, shades and utility classes.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-56">
          <SelectField
            compact
            label="Palette"
            value={palette ?? ""}
            options={groups.map((g) => ({
              value: g,
              label: `${g} (${frameworkColors(framework).filter((c) => c.group === g).length})`
            }))}
            onValueChange={(g) => {
              setSelected(g);
              setOpen(null);
            }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <IconButton
            label="Rename the palette"
            icon="ph:pencil-simple"
            onPress={() => begin("rename-palette")}
          />
          <IconButton label="Add a palette" icon="ph:plus" onPress={() => begin("add-palette")} />
          <IconButton
            label="Delete the palette and its colors"
            icon="ph:trash"
            danger
            onPress={() => {
              if (
                palette &&
                window.confirm(`Delete the palette "${palette}" and its ${colors.length} colors?`)
              ) {
                void update(removeColorGroup(framework, palette));
                setSelected(null);
              }
            }}
          />
        </div>
        <form
          className="ml-auto flex items-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            applyPrefix();
          }}
        >
          <div className="w-56">
            <FormInput
              compact
              label={
                <span className="inline-flex items-center gap-1.5">
                  Color name prefix
                  <InfoTip text="Starts the name of every color in this theme, for example brand- makes brand-primary. Apply renames all colors, their shades, and everything on your pages that uses them." />
                </span>
              }
              placeholder="for example brand-"
              value={prefix}
              onValueChange={(v) => setPrefix(v.trim())}
            />
          </div>
          <ActionButton size="sm" type="submit" isDisabled={prefix === framework.colorPrefix}>
            Apply
          </ActionButton>
        </form>
      </div>

      {mode !== "none" ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-2xl border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="w-56">
            <FormInput
              compact
              autoFocus
              label={mode === "add-color" ? "Color name" : "Palette name"}
              value={text}
              onValueChange={setText}
            />
          </div>
          {mode === "add-color" ? (
            <div className="w-56">
              <p className="pb-0.5 text-xs font-medium text-body">Value</p>
              <ColorField label="New color value" value={value} onChange={setValue} />
            </div>
          ) : null}
          <ActionButton size="sm" type="submit">
            {mode === "add-color" ? "Add color" : mode === "add-palette" ? "Add palette" : "Rename"}
          </ActionButton>
          <ActionButton size="sm" tone="ghost" onPress={() => setMode("none")}>
            Cancel
          </ActionButton>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}

      {palette === null ? (
        <p className="text-sm text-muted">No palettes yet. Add one to start.</p>
      ) : (
        <>
          <ul aria-label={`${palette} colors`} className="flex flex-col gap-2">
            {colors.map((c) => (
              <ColorRow
                key={c.name}
                color={c}
                framework={framework}
                used={used(c.name)}
                darkMode={theme.darkMode}
                onRename={rename}
                open={open === c.name}
                onToggle={() => setOpen(open === c.name ? null : c.name)}
                onChange={apply}
              />
            ))}
            {colors.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-default-300 p-4 text-sm text-muted">
                This palette has no colors yet.
              </li>
            ) : null}
          </ul>
          <div>
            <ActionButton size="sm" tone="outline" onPress={() => begin("add-color")}>
              Add a color to {palette}
            </ActionButton>
          </div>
        </>
      )}
    </div>
  );
}

/** Design System > Colors: palettes of the theme's framework, with shades and utility classes. */
export function ColorsTab() {
  return <FrameworkGate title="Colors">{(props) => <ColorsManager {...props} />}</FrameworkGate>;
}
