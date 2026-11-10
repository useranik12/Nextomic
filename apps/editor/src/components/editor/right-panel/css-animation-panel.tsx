"use client";

import {
  CSS_ANIMATIONS,
  CSS_ANIMATION_TRIGGERS,
  CSS_ANIMATION_TRIGGER_LABELS,
  cssAnimationById,
  newElementAnimation,
  type CssAnimationTrigger,
  type ElementAnimation,
  type ElementNode
} from "@nextomic/schema";
import { useEffect, useMemo, useState } from "react";
import { SelectField } from "@/components/ui/controls";
import { SwitchRow } from "@/components/ui/switch-row";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { compactFieldClass, SettingRow } from "./setting-row";

const BAD_SELECTOR = /[{};<>]/;

/** A number box that lets you clear and retype; only a number inside the range is saved. */
function NumField({
  label,
  tip,
  value,
  min,
  max,
  step,
  unit,
  onChange
}: {
  label: string;
  tip: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const n = Number(text);
  const valid = text.trim() !== "" && Number.isFinite(n) && n >= min && n <= max;
  return (
    <SettingRow label={`${label} (${unit})`} htmlFor={`anim-${label}`} tip={tip}>
      <input
        id={`anim-${label}`}
        type="number"
        min={min}
        max={max}
        step={step}
        value={text}
        aria-invalid={!valid}
        onChange={(e) => {
          setText(e.target.value);
          const next = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(next) && next >= min && next <= max)
            onChange(next);
        }}
        className={compactFieldClass + (valid ? "" : " !border-danger")}
      />
    </SettingRow>
  );
}

/** A selector box with a crosshair that picks an element from the canvas or the Navigator. */
function SelectorPicker({
  label,
  tip,
  value,
  onChange
}: {
  label: string;
  tip: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const startPicking = useEditorStore((s) => s.startPicking);
  const cancelPicking = useEditorStore((s) => s.cancelPicking);
  const picking = useEditorStore((s) => s.picker !== null);
  const [mine, setMine] = useState(false);
  const active = picking && mine;
  const bad = BAD_SELECTOR.test(value);

  useEffect(() => {
    if (!active) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") cancelPicking();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, cancelPicking]);

  useEffect(() => {
    if (!picking) setMine(false);
  }, [picking]);

  return (
    <SettingRow label={label} htmlFor={`anim-${label}`} tip={tip}>
      <div className="flex items-center gap-2">
        <input
          id={`anim-${label}`}
          value={value}
          aria-invalid={bad}
          placeholder=".my-class or #my-id"
          onChange={(e) => onChange(e.target.value)}
          className={compactFieldClass + (bad ? " !border-danger" : "")}
        />
        <button
          type="button"
          aria-label={active ? `Cancel picking for ${label}` : `Pick an element for ${label}`}
          aria-pressed={active}
          title={
            active
              ? "Click an element on the canvas or in the Navigator, or press Esc to cancel"
              : "Pick an element on the canvas or in the Navigator"
          }
          onClick={() => {
            if (active) {
              cancelPicking();
              return;
            }
            setMine(true);
            startPicking(onChange);
          }}
          className={
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-300 " +
            (active
              ? "bg-pink-500 text-white"
              : "bg-default-100 text-default-600 hover:bg-default-200 hover:text-foreground")
          }
        >
          <Icon name="ph:crosshair" width={16} height={16} />
        </button>
      </div>
      {bad ? (
        <p role="alert" className="mt-1 text-tiny text-danger">
          Selectors cannot contain {"{ } ; < >"}. This value is not saved.
        </p>
      ) : null}
    </SettingRow>
  );
}

/** The searchable list of ready-made animations. */
export function AnimationPicker({
  value,
  onChange,
  only
}: {
  value: string;
  onChange: (id: string) => void;
  /** Limits the list (a bottom sheet offers only "up" entrances). */
  only?: readonly { id: string; label: string; group: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = cssAnimationById(value);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (only ?? CSS_ANIMATIONS).filter(
      (a) => !q || a.label.toLowerCase().includes(q) || a.group.toLowerCase().includes(q)
    );
  }, [query, only]);

  return (
    <SettingRow
      label="Animation"
      htmlFor="anim-picker"
      tip="The ready-made effect to play. Search by name, such as bounce, fade or zoom."
    >
      <button
        id="anim-picker"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={compactFieldClass + " flex items-center justify-between text-left"}
      >
        <span className={current ? "" : "text-default-400"}>{current?.label ?? "Choose…"}</span>
        <Icon name="ph:caret-down" width={14} height={14} />
      </button>
      {open ? (
        <div className="mt-2 rounded-medium border border-divider bg-content1 p-2">
          <input
            autoFocus
            aria-label="Search animations"
            placeholder="Search animations"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={compactFieldClass}
          />
          <ul role="listbox" aria-label="Animations" className="mt-2 max-h-64 overflow-y-auto">
            {matches.length === 0 ? (
              <li className="px-2 py-2 text-small text-default-500">No animation matches.</li>
            ) : null}
            {matches.map((a, i) => (
              <li key={a.id} role="presentation">
                {i === 0 || matches[i - 1]?.group !== a.group ? (
                  <div className="px-2 pb-0.5 pt-2 text-tiny font-semibold uppercase tracking-wide text-default-500">
                    {a.group}
                  </div>
                ) : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={a.id === value}
                  onClick={() => {
                    onChange(a.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={
                    "w-full rounded-medium px-2 py-1.5 text-left text-small hover:bg-default-100 " +
                    (a.id === value ? "bg-default-200 font-medium" : "")
                  }
                >
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </SettingRow>
  );
}

/** Design tab > Animations: ready-made CSS animations played by a trigger. */
export function CssAnimationPanel({ node }: { node: ElementNode }) {
  const set = useEditorStore((s) => s.setElementAnimation);
  const settings: ElementAnimation = node.animation ?? newElementAnimation();

  function patch(change: Partial<ElementAnimation>) {
    set(node.id, { ...settings, ...change });
  }
  const selectorChange = (key: "triggerSelector" | "targetSelector") => (value: string) => {
    if (!BAD_SELECTOR.test(value)) patch({ [key]: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <SettingRow
        label="Trigger"
        htmlFor="anim-trigger"
        tip="What starts the animation: a click, the pointer over it, focus, scrolling it into or out of view, scrolling down the page, or the page finishing loading."
      >
        <SelectField
          compact
          hideLabel
          label="Trigger"
          value={settings.trigger}
          options={CSS_ANIMATION_TRIGGERS.map((t) => ({
            value: t,
            label: CSS_ANIMATION_TRIGGER_LABELS[t]
          }))}
          onValueChange={(trigger) => patch({ trigger: trigger as CssAnimationTrigger })}
        />
      </SettingRow>
      <SelectorPicker
        label="Trigger selector"
        tip="The element that listens for the trigger. Leave empty to use this element. Use the crosshair to pick one, or type a CSS selector; every match listens."
        value={settings.triggerSelector}
        onChange={selectorChange("triggerSelector")}
      />
      <NumField
        label="Delay"
        tip="How long to wait after the trigger before the animation starts."
        value={settings.delay}
        min={0}
        max={60000}
        step={50}
        unit="ms"
        onChange={(delay) => patch({ delay })}
      />
      {settings.trigger === "scroll" ? (
        <NumField
          label="Scroll offset"
          tip="How far the visitor scrolls down the page, in pixels, before the animation plays."
          value={settings.scrollOffset}
          min={0}
          max={1000000}
          step={50}
          unit="px"
          onChange={(scrollOffset) => patch({ scrollOffset })}
        />
      ) : null}
      <AnimationPicker value={settings.animation} onChange={(animation) => patch({ animation })} />
      <NumField
        label="Duration"
        tip="How long the animation runs. Decimals are fine, such as 0.3."
        value={settings.duration}
        min={0.05}
        max={60}
        step={0.1}
        unit="s"
        onChange={(duration) => patch({ duration })}
      />
      <SettingRow
        label="Target"
        htmlFor="anim-target"
        tip="What moves: this element, or other elements picked by a CSS selector."
      >
        <SelectField
          compact
          hideLabel
          label="Target"
          value={settings.target}
          options={[
            { value: "self", label: "Self" },
            { value: "selector", label: "CSS selector" }
          ]}
          onValueChange={(target) => patch({ target: target as ElementAnimation["target"] })}
        />
      </SettingRow>
      {settings.target === "selector" ? (
        <SelectorPicker
          label="Target selector"
          tip="The elements to animate. Use the crosshair to pick one, or type a CSS selector; every match animates."
          value={settings.targetSelector}
          onChange={selectorChange("targetSelector")}
        />
      ) : null}
      <SwitchRow
        label="Run only once"
        tip="Plays one time per visit (browser session). It plays again in a new session."
        selected={settings.once}
        onChange={(once) => patch({ once })}
      />
      {node.animation ? (
        <button
          type="button"
          onClick={() => set(node.id, null)}
          className="self-start rounded-full px-3 py-1.5 text-small text-danger hover:bg-danger/10"
        >
          Remove animation
        </button>
      ) : null}
    </div>
  );
}
