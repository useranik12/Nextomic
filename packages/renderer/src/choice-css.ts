// The built-in look of choice fields: Checkbox, Radio, Checkbox group and Choice chips (docs/elements.md
// "Forms"). Every selector is in :where(), so any setting of the author wins. The real input is kept
// (hidden but focusable); `[data-nxt-mark]` is the box the visitor sees, drawn from the input's state.

const CHOICE = "[data-nxt-choice]";
const MARK = "[data-nxt-mark]";
const INPUT = "[data-nxt-control]";

export const CHOICE_BASE_CSS =
  `:where(${CHOICE}){position:relative;display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:.9375rem;font-weight:400;line-height:1.4}` +
  `:where(${CHOICE} ${INPUT}){position:absolute;width:1px;height:1px;margin:0;opacity:0;pointer-events:none}` +
  `:where(${CHOICE} ${MARK}){position:relative;flex:none;box-sizing:border-box;width:20px;height:20px;margin-top:1px;border:1.5px solid #a1a1aa;border-radius:6px;background:#fff;transition:background-color .15s,border-color .15s,box-shadow .15s}` +
  `:where([data-nxt-kind="one"] ${CHOICE} ${MARK}){border-radius:999px}` +
  `:where(${CHOICE} ${INPUT}:checked + ${MARK}){border-color:#6366f1;background:#6366f1}` +
  `:where(${CHOICE} ${INPUT}:checked + ${MARK})::after{content:"";position:absolute;left:6px;top:2px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}` +
  `:where([data-nxt-kind="one"] ${CHOICE} ${INPUT}:checked + ${MARK})::after{left:5px;top:5px;width:6px;height:6px;border:0;border-radius:999px;background:#fff;transform:none}` +
  `:where(${CHOICE} ${INPUT}:focus-visible + ${MARK}){box-shadow:0 0 0 3px rgba(99,102,241,.35)}` +
  `:where([data-invalid] ${CHOICE} ${MARK}){border-color:#dc2626}` +
  `:where(${CHOICE}:has(${INPUT}:disabled)){cursor:not-allowed;opacity:.6}` +
  `:where(${CHOICE} [data-nxt-text]){display:flex;flex-direction:column;gap:2px}` +
  `:where(${CHOICE} [data-nxt-sub]){font-size:.8125rem;color:#71717a}` +
  `:where([data-nxt-options]){display:flex;flex-direction:column;gap:8px}` +
  `:where([data-nxt-options][data-nxt-layout="horizontal"]){flex-direction:row;flex-wrap:wrap;gap:8px 16px}` +
  `:where(${CHOICE} [data-nxt-ico]){display:inline-flex;flex:none;align-items:center;font-size:1.125rem;color:#52525b}` +
  `:where([data-nxt-variant="chips"] [data-nxt-options]){flex-direction:row;flex-wrap:wrap;gap:8px}` +
  `:where([data-nxt-variant="chips"] ${CHOICE}){align-items:center;gap:6px;padding:6px 14px;border:1px solid #d4d4d8;border-radius:999px;background:#fff;transition:background-color .15s,border-color .15s,color .15s}` +
  `:where([data-nxt-variant="chips"] ${MARK}){display:none}` +
  `:where([data-nxt-variant="chips"] ${CHOICE}:has(${INPUT}:checked)){border-color:#6366f1;background:rgba(99,102,241,.1);color:#4338ca}` +
  `:where([data-nxt-variant="chips"] ${CHOICE}:has(${INPUT}:focus-visible)){box-shadow:0 0 0 3px rgba(99,102,241,.35)}` +
  `:where([data-nxt-variant="chips"][data-invalid] ${CHOICE}){border-color:#dc2626}`;
