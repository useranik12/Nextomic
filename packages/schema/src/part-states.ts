import type { InputState, StateTail } from "./input-design";

// How the states of a part that repeats inside a field (the boxes of a PIN, the buttons of a
// counter, the days of a calendar) reach one of its copies. Each test sits inside :where() so every
// state weighs the same and the cascade order decides; a state weighs one more than the default
// through the doubled selector, so it also wins at another breakpoint. `own` states test the copy
// itself (hover, focus, filled ...); `wide` states belong to the whole field (error, success), so
// they mark every copy at once. The editor canvas pins a state with `data-nxt-force`.

const forced = (state: string) => `:where([data-nxt-force="${state}"])`;

export function repeatedStates(
  selector: string,
  own: Partial<Record<InputState, string>>,
  wide: Partial<Record<InputState, string>> = {}
): Partial<Record<InputState, StateTail[]>> {
  const copy = (test: string) => `${selector}${selector}${test}`;
  const out: Partial<Record<InputState, StateTail[]>> = {
    default: [{ field: "", tail: ` ${selector}` }]
  };
  for (const [state, test] of Object.entries(own) as [InputState, string][])
    out[state] = [
      { field: "", tail: ` ${copy(test)}` },
      { field: forced(state), tail: ` ${copy("")}` }
    ];
  for (const [state, test] of Object.entries(wide) as [InputState, string][])
    out[state] = [
      { field: test, tail: ` ${copy("")}` },
      { field: forced(state), tail: ` ${copy("")}` }
    ];
  return out;
}
