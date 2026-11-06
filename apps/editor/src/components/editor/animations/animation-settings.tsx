"use client";

import {
  ANIMATION_METHODS,
  GSAP_EASES,
  parseAnimationVars,
  type Animation
} from "@nextomic/schema";
import { SwitchRow } from "@/components/ui/switch-row";
import { Grid2, NumberField, Section, TextField, TipField, TipSelect } from "./fields";
import { PropertyEditor } from "./property-editor";
import { SelectorField } from "./selector-field";
import { animationActions } from "./use-animations";

const METHOD_LABEL: Record<Animation["method"], string> = {
  to: "To (animate from now to values)",
  from: "From (animate from values to now)",
  fromTo: "From → To (set both ends)",
  set: "Set (jump instantly)"
};
const METHOD_TIP: Record<Animation["method"], string> = {
  to: "The element starts as it is on the page and moves to the values you set.",
  from: "The element starts at the values you set and moves to how it is on the page. Best for entrances.",
  fromTo: "You set both the starting and the ending values.",
  set: "Applies the values instantly with no animation. Use it to reset something at a point in the timeline."
};

const EASE_OPTIONS = GSAP_EASES.map((e) => ({ value: e, label: e }));
const POSITION_OPTIONS = [
  { value: "end", label: "After the previous" },
  { value: "start", label: "With the previous" },
  { value: "custom", label: "At a set time" }
];

/** Settings of one animation (a GSAP tween), grouped like the Bricksforge panel. */
export function AnimationSettings({
  timelineId,
  animation
}: {
  timelineId: string;
  animation: Animation;
}) {
  const patch = (change: Partial<Animation>) =>
    animationActions.patchAnimation(timelineId, animation.id, change);
  const varsCheck = animation.vars.trim() ? parseAnimationVars(animation.vars) : null;
  const both = animation.method === "fromTo";

  return (
    <>
      <Section title="Animation" tip="What is animated and how it moves.">
        <TextField
          label="Name"
          tip="Shown on the timeline bar. Only for you."
          value={animation.name}
          onChange={(name) => patch({ name })}
        />
        <TipSelect
          label="Method"
          tip={METHOD_TIP[animation.method]}
          value={animation.method}
          options={ANIMATION_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
          onChange={(method) => patch({ method: method as Animation["method"] })}
        />
        <SelectorField
          label="Target"
          tip="The elements to animate. 'this' is the timeline's trigger element. A class such as .card animates every element with it."
          allowThis
          value={animation.selector}
          onChange={(selector) => patch({ selector })}
        />
      </Section>

      <Section
        title="Timing"
        tip="How long it runs, when it starts and how it speeds up and slows down."
      >
        {animation.method === "set" ? null : (
          <Grid2>
            <NumberField
              label="Duration"
              tip="Seconds the animation takes."
              value={animation.duration}
              min={0}
              max={600}
              unit="s"
              onChange={(duration) => patch({ duration })}
            />
            <NumberField
              label="Delay"
              tip="Seconds to wait before it starts."
              value={animation.delay}
              min={0}
              max={600}
              unit="s"
              onChange={(delay) => patch({ delay })}
            />
          </Grid2>
        )}
        {animation.method === "set" ? null : (
          <TipSelect
            label="Ease"
            tip="The speed curve. 'power2.out' starts fast and slows down gently, 'back.out' overshoots a little, 'none' is a constant speed."
            value={animation.ease}
            options={EASE_OPTIONS}
            onChange={(ease) => patch({ ease })}
          />
        )}
        <TipSelect
          label="Starts"
          tip="Where on the timeline this animation begins: after the one above it, at the same time as it, or at an exact moment."
          value={animation.position.mode}
          options={POSITION_OPTIONS}
          onChange={(mode) =>
            patch({
              position: { ...animation.position, mode: mode as Animation["position"]["mode"] }
            })
          }
        />
        {animation.position.mode === "custom" ? (
          <TextField
            label="Start time"
            tip="Seconds from the start of the timeline (2), or relative to the previous animation: +=0.5 waits half a second after it, -=0.5 starts half a second before it ends, < starts with it, > starts when it ends."
            value={animation.position.value}
            placeholder="2, +=0.5, -=0.3, <"
            onChange={(value) => patch({ position: { ...animation.position, value } })}
          />
        ) : null}
        {animation.method === "set" ? null : (
          <>
            <NumberField
              label="Repeat"
              tip="Extra times it plays after the first. 0 plays once, -1 loops forever."
              value={animation.repeat}
              min={-1}
              max={1000}
              step={1}
              onChange={(repeat) => patch({ repeat: Math.round(repeat) })}
            />
            <SwitchRow
              label="Yoyo"
              tip="Each repeat plays backwards, so the animation goes back and forth."
              selected={animation.yoyo}
              onChange={(yoyo) => patch({ yoyo })}
            />
          </>
        )}
      </Section>

      <Section
        title="Properties"
        tip="What changes. Each property is a value the element moves to (or from)."
      >
        {both ? (
          <PropertyEditor
            title="From"
            tip="The values the element starts at."
            values={animation.fromProperties}
            onChange={(fromProperties) => patch({ fromProperties })}
          />
        ) : null}
        <PropertyEditor
          title={both ? "To" : animation.method === "from" ? "From values" : "Values"}
          tip={
            animation.method === "from"
              ? "The values the element starts at; it ends as it is on the page."
              : "The values the element ends at."
          }
          values={animation.properties}
          onChange={(properties) => patch({ properties })}
        />
      </Section>

      <Section
        title="Text and stagger"
        tip="Animate letters, words or lines one after another, or delay several targets in turn."
        defaultOpen={false}
      >
        <SwitchRow
          label="Split text"
          tip="Cuts the target's text into pieces so each can animate on its own. Only for elements that contain text."
          selected={animation.splitText.enabled}
          onChange={(enabled) => patch({ splitText: { ...animation.splitText, enabled } })}
        />
        {animation.splitText.enabled ? (
          <TipSelect
            label="Split into"
            tip="Characters, words or lines."
            value={animation.splitText.type}
            options={[
              { value: "chars", label: "Characters" },
              { value: "words", label: "Words" },
              { value: "lines", label: "Lines" }
            ]}
            onChange={(type) =>
              patch({
                splitText: { ...animation.splitText, type: type as "chars" | "words" | "lines" }
              })
            }
          />
        ) : null}
        <SwitchRow
          label="Stagger"
          tip="When the target is several elements or split text, starts each one a little after the last instead of all at once."
          selected={animation.stagger.enabled}
          onChange={(enabled) => patch({ stagger: { ...animation.stagger, enabled } })}
        />
        {animation.stagger.enabled ? (
          <>
            <NumberField
              label="Gap"
              tip="Seconds between the start of one piece and the next."
              value={animation.stagger.amount}
              min={0}
              max={60}
              step={0.01}
              unit="s"
              onChange={(amount) => patch({ stagger: { ...animation.stagger, amount } })}
            />
            <TipSelect
              label="Order"
              tip="Which piece goes first: from the start, from the end, from the middle outward, from both edges inward, or random."
              value={animation.stagger.from}
              options={(["start", "end", "center", "edges", "random"] as const).map((v) => ({
                value: v,
                label: v
              }))}
              onChange={(from) =>
                patch({
                  stagger: { ...animation.stagger, from: from as Animation["stagger"]["from"] }
                })
              }
            />
            <TipSelect
              label="Gap ease"
              tip="Makes the gaps between pieces grow or shrink instead of staying equal."
              value={animation.stagger.ease}
              options={EASE_OPTIONS}
              onChange={(ease) => patch({ stagger: { ...animation.stagger, ease } })}
            />
          </>
        ) : null}
      </Section>

      <Section
        title="Custom GSAP object"
        tip="For anything the controls above do not cover."
        defaultOpen={false}
      >
        <TipField
          label="GSAP vars (JSON)"
          tip='Extra GSAP settings as a JSON object, merged over the values above. Example: {"rotation": 360, "transformOrigin": "center"}. It must be one object, with no functions.'
        >
          <textarea
            aria-label="GSAP vars (JSON)"
            aria-invalid={varsCheck?.ok === false}
            spellCheck={false}
            rows={5}
            value={animation.vars}
            placeholder='{ "transformOrigin": "center" }'
            onChange={(e) => patch({ vars: e.target.value })}
            className={
              "w-full resize-y rounded-medium bg-default-100 p-3 font-mono text-small outline-none focus-visible:ring-2 focus-visible:ring-default-800/30 " +
              (varsCheck?.ok === false ? "ring-2 ring-danger" : "")
            }
          />
        </TipField>
        {varsCheck?.ok === false ? (
          <p role="alert" className="text-tiny text-danger">
            {varsCheck.error} It is ignored until it is fixed.
          </p>
        ) : null}
      </Section>
    </>
  );
}
