// The built-in look of a Date and time field (docs/elements.md "Date and time design"). Every rule
// sits in :where() so any setting an author makes wins; the box, icon and messages come from the
// shared Input look. The popover sits under the field; the runtime sets `data-placement="top"` and
// `data-align="end"` on it when there is no room below or to the right.

const FIELD = "[data-nxt-field]";
const DAY = "[data-nxt-day]";
const OPTION = "[data-nxt-time]";
const GHOST =
  "display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;color:inherit;font:inherit;cursor:pointer;transition:background-color .15s,color .15s,box-shadow .15s";

export const DATE_BASE_CSS =
  `:where(${FIELD} [data-nxt-picker]){position:relative;order:1;width:100%}` +
  `:where(${FIELD} [data-nxt-picker] [data-nxt-box]){cursor:pointer}` +
  `:where(${FIELD} [data-nxt-trigger]){flex:1 1 auto;min-width:0;padding:8px 0;border:0;outline:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}` +
  `:where(${FIELD} [data-nxt-trigger][data-empty]){color:#a1a1aa}` +
  `:where(${FIELD} [data-nxt-trigger]:disabled){cursor:not-allowed}` +
  `:where(${FIELD} [data-nxt-popover]){position:absolute;top:calc(100% + 6px);left:0;z-index:30;display:flex;flex-wrap:wrap;gap:12px;box-sizing:border-box;width:max-content;max-width:calc(100vw - 16px);padding:12px;border:1px solid #e4e4e7;border-radius:12px;background:#fff;color:#18181b;box-shadow:0 12px 32px rgba(0,0,0,.18)}` +
  `:where(${FIELD} [data-nxt-popover][data-placement="top"]){top:auto;bottom:calc(100% + 6px)}` +
  `:where(${FIELD} [data-nxt-popover][data-align="end"]){left:auto;right:0}` +
  `:where(${FIELD} [data-nxt-calendar]){display:flex;flex:1 1 auto;flex-direction:column;gap:8px;min-width:16rem}` +
  `:where(${FIELD} [data-nxt-calhead]){display:flex;align-items:center;gap:8px}` +
  `:where(${FIELD} [data-nxt-title]){flex:1 1 auto;text-align:center;font-weight:600}` +
  `:where(${FIELD} [data-nxt-nav]){${GHOST};flex:none;width:32px;height:32px;padding:0;border-radius:8px;font-size:1.125rem;color:#52525b}` +
  `:where(${FIELD} [data-nxt-nav]:hover:not(:disabled)){background:#f4f4f5;color:#18181b}` +
  `:where(${FIELD} [data-nxt-nav]:focus-visible,${FIELD} ${DAY}:focus-visible,${FIELD} ${OPTION}:focus-visible,${FIELD} [data-nxt-foot] button:focus-visible){outline:2px solid #6366f1;outline-offset:1px}` +
  `:where(${FIELD} [data-nxt-nav]:disabled){opacity:.35;cursor:not-allowed}` +
  `:where(${FIELD} [data-nxt-weekdays]){display:grid;grid-template-columns:repeat(7,1fr)}` +
  `:where(${FIELD} [data-nxt-weekday]){padding:4px 0;text-align:center;color:#71717a;font-size:.75rem;font-weight:500}` +
  `:where(${FIELD} [data-nxt-days]){display:grid;grid-template-columns:repeat(7,1fr);gap:2px}` +
  `:where(${FIELD} [data-nxt-week]){display:contents}` +
  `:where(${FIELD} ${DAY}){${GHOST};box-sizing:border-box;height:36px;padding:0;border-radius:8px;font-size:.875rem}` +
  `:where(${FIELD} ${OPTION}){${GHOST};flex:none;box-sizing:border-box;height:32px;padding:0 6px;border-radius:6px;font-size:.875rem}` +
  `:where(${FIELD} ${DAY}[data-outside]){color:#a1a1aa}` +
  `:where(${FIELD} ${DAY}[data-today]){font-weight:700;box-shadow:inset 0 0 0 1px #6366f1}` +
  `:where(${FIELD} ${DAY}:hover,${FIELD} ${OPTION}:hover){background:#f4f4f5}` +
  `:where(${FIELD} ${DAY}[aria-selected="true"],${FIELD} ${OPTION}[aria-selected="true"]){background:#6366f1;color:#fff}` +
  `:where(${FIELD} ${DAY}[aria-disabled="true"],${FIELD} ${OPTION}:disabled){opacity:.35;cursor:not-allowed;background:transparent;color:inherit}` +
  `:where(${FIELD} [data-nxt-times]){display:flex;gap:4px}` +
  `:where(${FIELD} [data-nxt-timecol]){position:relative;display:flex;flex-direction:column;gap:2px;width:3.25rem;max-height:15rem;padding:0 2px;overflow-y:auto}` +
  `:where(${FIELD} [data-nxt-foot]){display:flex;flex:1 1 100%;justify-content:space-between;gap:8px;padding-top:8px;border-top:1px solid #f4f4f5}` +
  `:where(${FIELD} [data-nxt-foot] button){${GHOST};padding:6px 10px;border-radius:6px;color:#6366f1;font-size:.875rem;font-weight:600}` +
  `:where(${FIELD} [data-nxt-foot] button:hover){background:rgba(99,102,241,.1)}`;
