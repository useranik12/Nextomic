// The built-in look of a PIN / OTP field (docs/elements.md "PIN design"). Every rule sits in
// :where() so any setting an author makes wins. The editor canvas pins a field in a state with
// `data-nxt-force`, the same way the other form fields do.

const FIELD = "[data-nxt-field]";
const CELLS = "[data-nxt-cells]";
const CELL = "[data-nxt-cell]";
const forced = (state: string) => `${FIELD}[data-nxt-force="${state}"]`;

export const PIN_BASE_CSS =
  `:where(${FIELD} ${CELLS}){order:1;display:flex;flex-wrap:wrap;gap:8px}` +
  `:where(${FIELD} ${CELL}){box-sizing:border-box;width:44px;height:52px;min-width:0;padding:0;border:1px solid #d4d4d8;border-radius:8px;background:#fff;color:inherit;font:inherit;font-size:1.25rem;text-align:center;outline:0;transition:border-color .15s,box-shadow .15s}` +
  `:where(${FIELD} ${CELL})::placeholder{color:#a1a1aa;opacity:1}` +
  `:where(${FIELD} ${CELL}:focus,${forced("focus")} ${CELL}){border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.25)}` +
  `:where(${FIELD}[data-invalid] ${CELL},${forced("error")} ${CELL}){border-color:#dc2626}` +
  `:where(${FIELD}[data-invalid] ${CELL}:focus,${forced("error")} ${CELL}:focus){box-shadow:0 0 0 3px rgba(220,38,38,.2)}` +
  `:where(${FIELD}[data-valid] ${CELL},${forced("success")} ${CELL}){border-color:#16a34a}` +
  `:where(${FIELD} ${CELL}:disabled,${forced("disabled")} ${CELL}){background:#f4f4f5;opacity:.6;cursor:not-allowed}`;
