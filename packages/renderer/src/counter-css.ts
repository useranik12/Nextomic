// The built-in look of a Count Controller (docs/elements.md "Count Controller design"). Every rule
// sits in :where() so any setting an author makes wins. The editor canvas pins a field in a state
// with `data-nxt-force`, the same way the other form fields do.

const FIELD = "[data-nxt-field]";
const COUNTER = "[data-nxt-counter]";
const STEP = "[data-nxt-step]";
const COUNT = "[data-nxt-count]";
const forced = (state: string) => `${FIELD}[data-nxt-force="${state}"]`;

export const COUNTER_BASE_CSS =
  `:where(${FIELD} ${COUNTER}){order:1;display:inline-flex;align-items:center;align-self:flex-start;gap:4px;padding:2px;border:1px solid #d4d4d8;border-radius:8px;background:#fff;transition:border-color .15s,box-shadow .15s}` +
  `:where(${FIELD} ${STEP}){display:inline-flex;align-items:center;justify-content:center;flex:none;width:36px;height:36px;padding:0;border:0;border-radius:6px;background:transparent;color:#6366f1;font:inherit;font-size:1.25rem;line-height:1;cursor:pointer;transition:background-color .15s,color .15s}` +
  `:where(${FIELD} ${STEP}:hover:not(:disabled),${forced("hover")} ${STEP}){background:rgba(99,102,241,.1)}` +
  `:where(${FIELD} ${STEP}:focus-visible){outline:2px solid #6366f1;outline-offset:1px}` +
  `:where(${FIELD} ${STEP}:disabled){color:#a1a1aa;cursor:not-allowed}` +
  `:where(${FIELD} ${COUNT}){box-sizing:border-box;width:4ch;min-width:0;padding:0 4px;border:0;outline:0;background:transparent;color:inherit;font:inherit;font-weight:600;text-align:center;cursor:default}` +
  `:where(${FIELD}:focus-within ${COUNTER},${forced("focus")} ${COUNTER}){border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.25)}` +
  `:where(${FIELD}[data-invalid] ${COUNTER},${forced("error")} ${COUNTER}){border-color:#dc2626}` +
  `:where(${FIELD}[data-valid] ${COUNTER},${forced("success")} ${COUNTER}){border-color:#16a34a}` +
  `:where(${FIELD}:has(${COUNT}:disabled) ${COUNTER},${forced("disabled")} ${COUNTER}){background:#f4f4f5;opacity:.6;cursor:not-allowed}`;
