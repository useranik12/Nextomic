import {
  INPUT_PARTS,
  INPUT_STATES,
  inputPartSelectors,
  parseInputDesignKey,
  type InputState,
  type ParsedInputKey
} from "@nextomic/schema";

// The look of a Form Input (docs/elements.md "Form Input design"). `INPUT_BASE_CSS` is the built-in
// default (all selectors in :where(), so any setting of the author wins). `inputPartCss` turns the
// `--nxt-ip-*` keys of one element or class into plain declarations on the part selectors; a key
// that is not set at a breakpoint or state emits nothing, so the default look always stays.

const NEUTRAL = "#d4d4d8";
const FIELD = "[data-nxt-field]";
const forced = (state: string) => `${FIELD}[data-nxt-force="${state}"]`;

export const INPUT_BASE_CSS =
  `:where(${FIELD}){display:flex;flex-direction:column;flex-wrap:wrap;gap:6px;width:100%}` +
  `:where(${FIELD} label){order:0;font-size:.875rem;font-weight:500}` +
  `:where(${FIELD} label[data-required])::after{content:" *";color:#dc2626}` +
  `:where(${FIELD} [data-nxt-box]){order:1;display:flex;align-items:center;gap:8px;flex-grow:1;min-width:0;min-height:40px;padding:0 12px;border:1px solid ${NEUTRAL};border-radius:8px;background:#fff;transition:border-color .15s,box-shadow .15s}` +
  `:where(${FIELD}:has(textarea) [data-nxt-box]){align-items:flex-start}` +
  `:where(${FIELD} [data-nxt-control]){flex:1 1 auto;width:100%;min-width:0;padding:8px 0;border:0;outline:0;background:transparent;color:inherit;font:inherit}` +
  `:where(${FIELD} textarea[data-nxt-control]){min-height:96px;resize:vertical}` +
  `:where(${FIELD} [data-nxt-control])::placeholder{color:#a1a1aa;opacity:1}` +
  `:where(${FIELD}:focus-within [data-nxt-box],${forced("focus")} [data-nxt-box]){border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.25)}` +
  `:where(${FIELD}[data-invalid] [data-nxt-box],${forced("error")} [data-nxt-box]){border-color:#dc2626}` +
  `:where(${FIELD}[data-invalid]:focus-within [data-nxt-box],${forced("error")}:focus-within [data-nxt-box]){box-shadow:0 0 0 3px rgba(220,38,38,.2)}` +
  `:where(${FIELD}[data-valid] [data-nxt-box],${forced("success")} [data-nxt-box]){border-color:#16a34a}` +
  `:where(${FIELD}:has([data-nxt-control]:disabled) [data-nxt-box],${forced("disabled")} [data-nxt-box]){background:#f4f4f5;opacity:.6;cursor:not-allowed}` +
  `:where(${FIELD} [data-nxt-icon]){display:inline-flex;flex:none;color:#71717a;font-size:1.125rem}` +
  `:where(${FIELD} [data-nxt-clear],${FIELD} [data-nxt-toggle]){display:inline-flex;flex:none;align-items:center;justify-content:center;padding:4px;border:0;border-radius:6px;background:transparent;color:#71717a;font:inherit;font-size:.8125rem;cursor:pointer}` +
  `:where(${FIELD} [data-nxt-clear],${FIELD} [data-nxt-toggle]):hover{color:#18181b}` +
  `:where(${FIELD} [data-nxt-help],${FIELD} [data-nxt-error],${FIELD} [data-nxt-success]){width:100%;margin:0;font-size:.8125rem}` +
  `:where(${FIELD} [data-nxt-help]){order:2;color:#71717a}` +
  `:where(${FIELD} [data-nxt-error]){order:3;color:#dc2626}` +
  `:where(${FIELD} [data-nxt-success]){order:4;color:#16a34a}` +
  // Hidden parts stay hidden whatever display an author gives them, and the password button
  // shows only the face that matches its state.
  `${FIELD} [hidden]{display:none}` +
  `${FIELD} [data-nxt-toggle][aria-pressed="false"] [data-nxt-when="shown"],${FIELD} [data-nxt-toggle][aria-pressed="true"] [data-nxt-when="hidden"]{display:none}`;

/**
 * Part rules for the `--nxt-ip-*` declarations of one owner selector (already resolved and safe).
 * Rules go state by state in cascade order (default first, disabled last), so a state beats the
 * default and an error beats a focus.
 */
export function inputPartCss(
  owner: string,
  declarations: Readonly<Record<string, string>>
): string {
  const parsed: [ParsedInputKey, string][] = [];
  for (const [key, value] of Object.entries(declarations)) {
    const hit = parseInputDesignKey(key);
    if (hit) parsed.push([hit, value]);
  }
  if (parsed.length === 0) return "";
  const out: string[] = [];
  for (const state of INPUT_STATES as readonly InputState[]) {
    for (const part of INPUT_PARTS) {
      const body = parsed
        .filter(([hit]) => hit.part.id === part.id && hit.state === state)
        .map(([hit, value]) => `${hit.prop}:${value}`);
      if (body.length === 0) continue;
      const selector = inputPartSelectors(owner, part, state).join(",");
      const rule = `${selector}{${body.join(";")}}`;
      out.push(rule);
    }
  }
  return out.join("");
}
