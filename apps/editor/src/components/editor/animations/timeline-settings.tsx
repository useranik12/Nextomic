"use client";

import { TOGGLE_ACTIONS, type Timeline } from "@nextomic/schema";
import { SwitchRow } from "@/components/ui/switch-row";
import type { PageSummary } from "@/server/pages";
import { Grid2, NumberField, Section, TextField, TipField, TipSelect } from "./fields";
import { SelectorField } from "./selector-field";
import { animationActions } from "./use-animations";

type TimelineTrigger = Timeline["trigger"];

const TRIGGERS: { value: TimelineTrigger; label: string }[] = [
  { value: "scroll", label: "Scroll (ScrollTrigger)" },
  { value: "load", label: "Page load" },
  { value: "click", label: "Click" },
  { value: "hover", label: "Hover" },
  { value: "custom", label: "Custom (an action plays it)" }
];

const TRIGGER_TIPS: Record<TimelineTrigger, string> = {
  scroll:
    "Plays when the element scrolls into view. The settings below say when it starts and ends, and whether the scrollbar drives it.",
  load: "Plays as soon as the page has loaded.",
  click: "Plays when the trigger element is clicked.",
  hover: "Plays when the pointer moves onto the trigger element.",
  custom:
    "Does not start by itself. An action (a click on a button, a form, a timer) plays, pauses or reverses it by name."
};

const ACTION_OPTIONS = TOGGLE_ACTIONS.map((a) => ({ value: a, label: a }));
const ACTION_TIPS = [
  "When the start line enters the viewport going down.",
  "When the end line is passed going down.",
  "When the end line enters the viewport going back up.",
  "When the start line is passed going back up."
];
const ACTION_LABELS = ["On enter", "On leave", "On enter back", "On leave back"];

function ScrollSettings({ timeline }: { timeline: Timeline }) {
  const st = timeline.scrollTrigger;
  const patch = (change: Partial<Timeline["scrollTrigger"]>) =>
    animationActions.patchTimeline(timeline.id, { scrollTrigger: { ...st, ...change } });
  const actions = st.toggleActions.split(" ");
  return (
    <>
      <Grid2>
        <TextField
          label="Start"
          tip="When the animation starts: where the trigger element meets the viewport. 'top 80%' means the element's top edge reaches 80% down the screen."
          value={st.start}
          onChange={(start) => patch({ start })}
        />
        <TextField
          label="End"
          tip="When the animation ends. 'bottom top' means the element's bottom edge reaches the top of the screen. With scrub on, the animation finishes here."
          value={st.end}
          onChange={(end) => patch({ end })}
        />
      </Grid2>
      {st.scrub ? null : (
        <div className="grid grid-cols-2 gap-3">
          {ACTION_LABELS.map((label, i) => (
            <TipSelect
              key={label}
              label={label}
              tip={`What happens ${ACTION_TIPS[i] ?? ""}`}
              value={actions[i] ?? "none"}
              options={ACTION_OPTIONS}
              onChange={(value) => {
                const next = [...actions];
                next[i] = value;
                patch({ toggleActions: next.join(" ") });
              }}
            />
          ))}
        </div>
      )}
      <SwitchRow
        label="Scrub"
        tip="Ties the animation to the scrollbar: scroll down to play it, scroll up to rewind. The start and end above set how much scrolling it takes."
        selected={st.scrub}
        onChange={(scrub) => patch({ scrub })}
      />
      {st.scrub ? (
        <NumberField
          label="Smoothing"
          tip="Seconds the animation takes to catch up with the scrollbar. 0 follows it exactly; 1 feels smooth."
          value={st.scrubSmooth}
          min={0}
          max={10}
          unit="s"
          onChange={(scrubSmooth) => patch({ scrubSmooth })}
        />
      ) : null}
      <SwitchRow
        label="Pin"
        tip="Keeps the trigger element fixed on screen while the scroll runs from Start to End. Used for sticky storytelling sections."
        selected={st.pin}
        onChange={(pin) => patch({ pin })}
      />
      {st.pin ? (
        <SwitchRow
          label="Pin spacing"
          tip="Adds empty space after the pinned element so the content below does not slide under it. Leave on unless you handle spacing yourself."
          selected={st.pinSpacing}
          onChange={(pinSpacing) => patch({ pinSpacing })}
        />
      ) : null}
      <SwitchRow
        label="Show markers"
        tip="Draws the start and end lines on the page so you can see exactly when the trigger fires. Turn it off before publishing."
        selected={st.markers}
        onChange={(markers) => patch({ markers })}
      />
      <SwitchRow
        label="Toggle a class"
        tip="Adds a CSS class to an element while the scroll is between Start and End, and removes it after."
        selected={st.toggleClass.enabled}
        onChange={(enabled) => patch({ toggleClass: { ...st.toggleClass, enabled } })}
      />
      {st.toggleClass.enabled ? (
        <>
          <SelectorField
            label="Class target"
            tip="The element that gets the class."
            allowThis
            value={st.toggleClass.selector}
            onChange={(selector) => patch({ toggleClass: { ...st.toggleClass, selector } })}
          />
          <TextField
            label="Class name"
            tip="The class to add, without the dot."
            value={st.toggleClass.className}
            onChange={(className) => patch({ toggleClass: { ...st.toggleClass, className } })}
          />
        </>
      ) : null}
      <SwitchRow
        label="Snap"
        tip="After the user stops scrolling, glides to the nearest step of the animation."
        selected={st.snap.enabled}
        onChange={(enabled) => patch({ snap: { ...st.snap, enabled } })}
      />
      {st.snap.enabled ? (
        <div className="grid grid-cols-3 gap-3">
          <NumberField
            label="Step"
            tip="Size of each step as a share of the animation: 0.33 snaps to thirds, 0.5 to halves."
            value={st.snap.to}
            min={0}
            max={1}
            step={0.01}
            onChange={(to) => patch({ snap: { ...st.snap, to } })}
          />
          <NumberField
            label="Duration"
            tip="Seconds the snap glide takes."
            value={st.snap.duration}
            min={0}
            max={5}
            unit="s"
            onChange={(duration) => patch({ snap: { ...st.snap, duration } })}
          />
          <NumberField
            label="Delay"
            tip="Seconds to wait after scrolling stops before snapping."
            value={st.snap.delay}
            min={0}
            max={5}
            unit="s"
            onChange={(delay) => patch({ snap: { ...st.snap, delay } })}
          />
        </div>
      ) : null}
    </>
  );
}

function InteractionSettings({ timeline }: { timeline: Timeline }) {
  const it = timeline.interaction;
  const patch = (change: Partial<Timeline["interaction"]>) =>
    animationActions.patchTimeline(timeline.id, { interaction: { ...it, ...change } });
  const click = timeline.trigger === "click";
  return (
    <>
      <SwitchRow
        label={click ? "Reverse on second click" : "Reverse on mouse leave"}
        tip={
          click
            ? "The next click plays the timeline backwards instead of playing it again. Good for open and close."
            : "Plays the timeline backwards when the pointer leaves the element."
        }
        selected={it.reverse}
        onChange={(reverse) => patch({ reverse })}
      />
      {click ? (
        <>
          <SelectorField
            label="Reverse button"
            tip="Another element whose click plays the timeline backwards, such as a close button. Leave empty for none."
            value={it.reverseSelector}
            onChange={(reverseSelector) => patch({ reverseSelector })}
          />
          <SwitchRow
            label="Reverse on click outside"
            tip="Plays the timeline backwards when the visitor clicks anywhere outside the trigger element. Good for menus and popups."
            selected={it.reverseOutside}
            onChange={(reverseOutside) => patch({ reverseOutside })}
          />
        </>
      ) : null}
      <TextField
        label="Ignore clicks on"
        tip="Selectors (separated by commas) that do not start the timeline when they are inside the trigger, such as 'a, button'."
        value={it.excludedSelectors}
        onChange={(excludedSelectors) => patch({ excludedSelectors })}
      />
      <NumberField
        label="Speed"
        tip="Playback speed. 1 is normal, 2 is twice as fast, 0.5 is half speed."
        value={it.timeScale}
        min={0.1}
        max={10}
        onChange={(timeScale) => patch({ timeScale })}
      />
    </>
  );
}

/** Everything about the timeline as a whole: what starts it, where it runs and how it repeats. */
export function TimelineSettings({
  timeline,
  pages
}: {
  timeline: Timeline;
  pages: readonly PageSummary[];
}) {
  const patch = (change: Partial<Timeline>) => animationActions.patchTimeline(timeline.id, change);
  const togglePage = (id: string) =>
    patch({
      pageIds: timeline.pageIds.includes(id)
        ? timeline.pageIds.filter((p) => p !== id)
        : [...timeline.pageIds, id]
    });
  return (
    <>
      <Section title="Timeline" tip="The name, whether it is on, and what starts it.">
        <TextField
          label="Name"
          tip="Only for you, to tell timelines apart. It does not appear on the site."
          value={timeline.name}
          onChange={(name) => name.trim() && patch({ name })}
        />
        <SwitchRow
          label="Enabled"
          tip="Off: the timeline stays in the project but does not run on any page."
          selected={timeline.enabled}
          onChange={(enabled) => patch({ enabled })}
        />
        <TipSelect
          label="Trigger"
          tip={TRIGGER_TIPS[timeline.trigger]}
          value={timeline.trigger}
          options={TRIGGERS}
          onChange={(trigger) => patch({ trigger: trigger as TimelineTrigger })}
        />
        <SelectorField
          label="Trigger element"
          tip="The element that starts the timeline: the section to scroll to, the button to click. Leave empty to use the whole page. If several elements match, each one runs its own copy."
          value={timeline.triggerSelector}
          onChange={(triggerSelector) => patch({ triggerSelector })}
          placeholder="Empty: the whole page"
        />
        <NumberField
          label="Repeat"
          tip="How many extra times the timeline plays after the first. 0 plays once, 2 plays three times, -1 loops forever."
          value={timeline.repeat}
          min={-1}
          max={1000}
          step={1}
          onChange={(repeat) => patch({ repeat: Math.round(repeat) })}
        />
      </Section>
      {timeline.trigger === "scroll" ? (
        <Section
          title="Scroll"
          tip="When and how scrolling plays the timeline (GSAP ScrollTrigger)."
        >
          <ScrollSettings timeline={timeline} />
        </Section>
      ) : null}
      {timeline.trigger === "click" || timeline.trigger === "hover" ? (
        <Section title="Interaction" tip="How clicks or hovers control the timeline.">
          <InteractionSettings timeline={timeline} />
        </Section>
      ) : null}
      <Section
        title="Where it runs"
        tip="Limit the timeline to some screen sizes or some pages."
        defaultOpen={false}
      >
        <TextField
          label="Only when (media query)"
          tip="Runs the timeline only when this CSS media query matches, for example '(min-width: 768px)' for tablets and larger. Leave empty to run everywhere."
          value={timeline.matchMedia}
          placeholder="(min-width: 768px)"
          onChange={(matchMedia) => patch({ matchMedia })}
        />
        <TipField
          label="Pages"
          tip="Pick the pages that run this timeline. With none picked it runs on every page."
        >
          {pages.length === 0 ? (
            <p className="text-small text-default-500">This project has no pages yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {pages.map((page) => {
                const on = timeline.pageIds.includes(page.id);
                return (
                  <button
                    key={page.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePage(page.id)}
                    className={
                      "rounded-full px-3 py-1.5 text-small transition-colors duration-300 " +
                      (on
                        ? "bg-default-800 text-default-50"
                        : "bg-default-100 text-default-600 hover:bg-default-200")
                    }
                  >
                    {page.name}
                  </button>
                );
              })}
            </div>
          )}
        </TipField>
      </Section>
    </>
  );
}
