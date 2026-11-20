// The built-in look of a Select (docs/elements.md "Select design"). Every rule sits in :where() so
// any setting an author makes wins; the box, icon, clear button and messages come from the shared
// Input look. The panel sits under the field; the runtime sets `data-placement="top"` and
// `data-align="end"` on it when there is no room below or to the right, and `data-active` on the
// option under the keyboard or pointer.

const FIELD = '[data-nxt-field][data-nxt-variant="select"]';
const ROW = "[data-nxt-choice]";
const MARK = "[data-nxt-mark]";
// The editor canvas pins a field in a state (`data-nxt-force`) to style that state.
const forced = (state: string) => `${FIELD}[data-nxt-force="${state}"]`;
const TICK =
  'content:"";position:absolute;left:5px;top:1px;width:5px;height:10px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)';

export const SELECT_BASE_CSS =
  `:where(${FIELD} [data-nxt-picker]){position:relative;order:1;width:100%}` +
  `:where(${FIELD} [data-nxt-box]){cursor:pointer}` +
  `:where(${FIELD} [data-nxt-trigger]){display:flex;flex:1 1 auto;align-items:center;min-width:0;padding:6px 0;outline:0;cursor:pointer;overflow:hidden}` +
  `:where(${FIELD} [data-nxt-trigger][aria-disabled="true"]){cursor:not-allowed}` +
  `:where(${FIELD} [data-nxt-value],${FIELD} [data-nxt-placeholder]){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}` +
  `:where(${FIELD} [data-nxt-placeholder]){color:#a1a1aa}` +
  `:where(${FIELD} [data-nxt-values]){display:flex;flex-wrap:wrap;align-items:center;gap:6px;min-width:0}` +
  `:where(${FIELD} [data-nxt-chip]){display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:2px 4px 2px 10px;border-radius:999px;background:rgba(99,102,241,.1);color:#4338ca;font-size:.8125rem;line-height:1.4}` +
  `:where(${FIELD} [data-nxt-chip-label]){min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}` +
  `:where(${FIELD} [data-nxt-chip-x]){display:inline-flex;flex:none;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;font-size:.875rem;line-height:1;cursor:pointer}` +
  `:where(${FIELD} [data-nxt-chip-x]:hover){background:rgba(99,102,241,.22)}` +
  `:where(${FIELD} [data-nxt-more]){display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;background:#f4f4f5;color:#52525b;font-size:.8125rem}` +
  `:where(${FIELD} [data-nxt-caret]){display:inline-flex;flex:none;color:#71717a;font-size:1rem;transition:transform .15s}` +
  `:where(${FIELD} [data-nxt-trigger][aria-expanded="true"] ~ [data-nxt-caret]){transform:rotate(180deg)}` +
  `:where(${FIELD} [data-nxt-popover]){position:absolute;top:calc(100% + 6px);left:0;z-index:30;display:flex;flex-direction:column;box-sizing:border-box;width:100%;min-width:12rem;max-width:calc(100vw - 16px);overflow:hidden;border:1px solid #e4e4e7;border-radius:12px;background:#fff;color:#18181b;box-shadow:0 12px 32px rgba(0,0,0,.18)}` +
  `:where(${FIELD} [data-nxt-popover][data-placement="top"]){top:auto;bottom:calc(100% + 6px)}` +
  `:where(${FIELD} [data-nxt-popover][data-align="end"]){left:auto;right:0}` +
  `:where(${FIELD} [data-nxt-search-row]){padding:8px;border-bottom:1px solid #f4f4f5}` +
  `:where(${FIELD} [data-nxt-search]){box-sizing:border-box;width:100%;padding:8px 10px;border:1px solid #e4e4e7;border-radius:8px;outline:0;background:#fff;color:inherit;font:inherit}` +
  `:where(${FIELD} [data-nxt-search]:focus){border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.25)}` +
  `:where(${FIELD} [data-nxt-search])::placeholder{color:#a1a1aa;opacity:1}` +
  `:where(${FIELD} [data-nxt-listbox]){display:flex;flex-direction:column;gap:2px;max-height:15rem;padding:4px;overflow-y:auto}` +
  `:where(${FIELD} ${ROW}){position:relative;display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:.9375rem;font-weight:400;line-height:1.4}` +
  `:where(${FIELD} ${ROW} [data-nxt-control]){display:none}` +
  `:where(${FIELD} ${ROW}:hover,${FIELD} ${ROW}[data-active],${forced("hover")} ${ROW}:first-child,${forced("focus")} ${ROW}:first-child){background:#f4f4f5}` +
  `:where(${FIELD} ${ROW}[aria-selected="true"],${forced("checked")} ${ROW}:first-child){background:rgba(99,102,241,.1);color:#4338ca}` +
  `:where(${FIELD} ${ROW}[aria-disabled="true"]){opacity:.45;cursor:not-allowed}` +
  `:where(${FIELD} ${ROW}[hidden]){display:none}` +
  `:where(${FIELD}[data-nxt-multiple] ${ROW} ${MARK}){position:relative;flex:none;box-sizing:border-box;width:18px;height:18px;border:1.5px solid #a1a1aa;border-radius:5px;background:#fff;transition:background-color .15s,border-color .15s}` +
  `:where(${FIELD}[data-nxt-multiple] ${ROW}[aria-selected="true"] ${MARK},${forced("checked")}[data-nxt-multiple] ${ROW}:first-child ${MARK}){border-color:#6366f1;background:#6366f1}` +
  `:where(${FIELD}[data-nxt-multiple] ${ROW}[aria-selected="true"] ${MARK},${forced("checked")}[data-nxt-multiple] ${ROW}:first-child ${MARK})::after{${TICK}}` +
  `:where(${FIELD}:not([data-nxt-multiple]) ${ROW} ${MARK}){position:relative;order:3;flex:none;width:16px;height:16px;margin-left:auto}` +
  `:where(${FIELD}:not([data-nxt-multiple]) ${ROW}[aria-selected="true"] ${MARK},${forced("checked")}:not([data-nxt-multiple]) ${ROW}:first-child ${MARK})::after{${TICK.replace("#fff", "#6366f1").replace("left:5px;top:1px", "left:4px;top:0")}}` +
  `:where(${FIELD} ${ROW} [data-nxt-text]){display:flex;flex:1 1 auto;flex-direction:column;gap:2px;min-width:0}` +
  `:where(${FIELD} ${ROW} [data-nxt-sub]){font-size:.8125rem;color:#71717a}` +
  `:where(${FIELD} ${ROW} [data-nxt-ico]){display:inline-flex;flex:none;align-items:center;font-size:1.125rem;color:#52525b}` +
  `:where(${FIELD} ${ROW}[data-nxt-invalid]){flex-wrap:wrap;opacity:.7;outline:1px dashed #dc2626;outline-offset:-2px}` +
  `:where(${FIELD} ${ROW}[data-nxt-invalid])::after{content:attr(data-nxt-invalid);flex-basis:100%;font-size:.75rem;color:#dc2626}` +
  `:where(${FIELD} [data-nxt-empty]){margin:0;padding:14px 12px;text-align:center;font-size:.875rem;color:#71717a}` +
  `[data-nxt-ghost]{display:contents}[data-nxt-ghost]>*{opacity:.4;pointer-events:none}`;
