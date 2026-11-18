// The built-in look of a Range slider (docs/elements.md "Range slider design"). Every rule sits in
// :where() so any setting an author makes wins, except the two vendor rules that size the native
// thumb of the invisible input: they match the drawn thumb so a click lands where the handle is,
// and they must stay separate rules (a browser drops a whole rule list when one selector is unknown).
// The editor canvas pins a field in a state with `data-nxt-force`, like the other form fields.

const FIELD = "[data-nxt-field]";
const RANGE = "[data-nxt-range]";
const AREA = "[data-nxt-slide]";
const THUMB = "[data-nxt-thumb]";
const forced = (state: string) => `${FIELD}[data-nxt-force="${state}"]`;
const AT = "calc((100% - var(--nxt-thumb)) * var(--nxt-p))";
const BAR = "position:absolute;top:50%;height:6px;margin-top:-3px;border-radius:999px";

export const RANGE_BASE_CSS =
  `:where(${FIELD} ${RANGE}){--nxt-thumb:20px;order:1;display:flex;align-items:center;gap:12px;width:100%}` +
  `:where(${FIELD} ${AREA}){position:relative;flex:1 1 auto;min-width:0;height:var(--nxt-thumb)}` +
  `:where(${FIELD} [data-nxt-track]){${BAR};left:0;right:0;background:#e4e4e7}` +
  `:where(${FIELD} [data-nxt-fill]){${BAR};left:0;width:calc(var(--nxt-thumb) / 2 + (100% - var(--nxt-thumb)) * var(--nxt-p));background:#6366f1}` +
  `:where(${FIELD} ${THUMB}){position:absolute;top:50%;left:${AT};box-sizing:border-box;width:var(--nxt-thumb);height:var(--nxt-thumb);margin-top:calc(var(--nxt-thumb) / -2);border:2px solid #6366f1;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);transition:box-shadow .15s,transform .15s}` +
  `:where(${FIELD} ${AREA} [data-nxt-control]){position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}` +
  `:where(${FIELD} ${AREA}:hover ${THUMB},${forced("hover")} ${THUMB}){box-shadow:0 0 0 6px rgba(99,102,241,.15),0 1px 3px rgba(0,0,0,.3)}` +
  `:where(${FIELD} ${AREA}:has([data-nxt-control]:focus-visible) ${THUMB},${forced("focus")} ${THUMB}){box-shadow:0 0 0 4px rgba(99,102,241,.35)}` +
  `:where(${FIELD}[data-invalid] [data-nxt-fill],${forced("error")} [data-nxt-fill]){background:#dc2626}` +
  `:where(${FIELD}[data-invalid] ${THUMB},${forced("error")} ${THUMB}){border-color:#dc2626}` +
  `:where(${FIELD}[data-valid] [data-nxt-fill],${forced("success")} [data-nxt-fill]){background:#16a34a}` +
  `:where(${FIELD}[data-valid] ${THUMB},${forced("success")} ${THUMB}){border-color:#16a34a}` +
  `:where(${FIELD}:has([data-nxt-control]:disabled) ${RANGE},${forced("disabled")} ${RANGE}){opacity:.5}` +
  `:where(${FIELD}:has([data-nxt-control]:disabled) ${AREA} [data-nxt-control]){cursor:not-allowed}` +
  `:where(${FIELD} ${RANGE} [data-nxt-value]){font-size:.8125rem;font-weight:600;font-variant-numeric:tabular-nums}` +
  `:where(${FIELD} ${THUMB} [data-nxt-value]){position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);padding:2px 8px;border-radius:6px;background:#18181b;color:#fff;white-space:nowrap;pointer-events:none}` +
  `:where(${FIELD} ${RANGE} > [data-nxt-value]){min-width:3ch;text-align:right}` +
  `:where(${FIELD} [data-nxt-limit]){flex:none;color:#71717a;font-size:.75rem}` +
  `${FIELD} ${AREA} [data-nxt-control]::-webkit-slider-thumb{-webkit-appearance:none;width:var(--nxt-thumb);height:var(--nxt-thumb)}` +
  `${FIELD} ${AREA} [data-nxt-control]::-moz-range-thumb{width:var(--nxt-thumb);height:var(--nxt-thumb);border:0}`;
