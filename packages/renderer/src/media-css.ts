// The built-in look of the Video and Audio players (docs/elements.md "Video and Audio"). Every
// selector sits in :where(), so any setting of the author wins. The parts the author can restyle
// are listed in `packages/schema/src/media-design.ts`.

const MEDIA = "[data-nxt-media]";
const BTN = "[data-nxt-btn]";

export const MEDIA_BASE_CSS =
  `:where(${MEDIA}){position:relative;display:flex;flex-direction:column;width:100%;max-width:100%;overflow:hidden;background:#000;color:#fff;border-radius:8px}` +
  `:where(${MEDIA}[data-kind="audio"]){background:#18181b;border-radius:12px}` +
  `:where(${MEDIA} [data-nxt-el]){display:block;width:100%;aspect-ratio:16/9;object-fit:contain;background:#000}` +
  // An audio file has no picture: its own element stays out of the way unless the browser bar is used.
  `:where(${MEDIA}[data-kind="audio"]:not([data-controls="native"]) [data-nxt-el]){display:none}` +
  `:where(${MEDIA}[data-kind="audio"][data-controls="native"] [data-nxt-el]){aspect-ratio:auto;background:transparent}` +
  `:where(${MEDIA}:fullscreen){max-width:none;height:100%;border-radius:0}` +
  `:where(${MEDIA}:fullscreen [data-nxt-el]){height:100%;aspect-ratio:auto}` +
  // The bar.
  `:where([data-nxt-bar]){display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;width:100%;padding:8px 12px;box-sizing:border-box;color:#fff;font-size:.875rem;transition:opacity .2s}` +
  `:where([data-bar="overlay"] [data-nxt-bar]){position:absolute;left:0;right:0;bottom:0;background:linear-gradient(transparent,rgba(0,0,0,.75))}` +
  `:where([data-bar="below"] [data-nxt-bar]){background:#18181b}` +
  `:where([data-bar="above"] [data-nxt-bar]){order:-1;background:#18181b}` +
  `:where([data-autohide][data-state="playing"][data-idle] [data-nxt-bar]){opacity:0;pointer-events:none}` +
  // Until the script has taken over, the browser's own bar is the one that shows.
  `:where(${MEDIA}[data-controls="custom"]:not([data-nxt-ready]) :is([data-nxt-bar],[data-nxt-btn="big"])){display:none}` +
  // The Show / Hide Controls action.
  `:where(${MEDIA}[data-controls-off] :is([data-nxt-bar],[data-nxt-btn="big"])){display:none}` +
  // Buttons.
  `:where(${BTN}){display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:32px;height:32px;padding:0 6px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;font-size:1.25rem;line-height:1;text-decoration:none;cursor:pointer;transition:background-color .15s,color .15s,opacity .15s}` +
  `:where(${BTN}:hover){background:rgba(255,255,255,.18)}` +
  `:where(${BTN}:focus-visible){outline:2px solid #818cf8;outline-offset:2px}` +
  `:where(${BTN}:disabled){opacity:.4;cursor:not-allowed}` +
  `:where(${BTN}[data-nxt-btn="speed"]){min-width:44px;font-size:.8125rem;font-weight:600}` +
  `:where(${BTN}[data-nxt-btn="loop"][aria-pressed="true"],${BTN}[data-nxt-btn="captions"][aria-pressed="true"]){color:#818cf8}` +
  `${BTN}[aria-pressed="false"] [data-nxt-when="on"],${BTN}[aria-pressed="true"] [data-nxt-when="off"]{display:none}` +
  `:where(${BTN}[data-nxt-btn="big"]){position:absolute;top:50%;left:50%;width:72px;height:72px;transform:translate(-50%,-50%);border-radius:50%;background:rgba(0,0,0,.6);font-size:2.5rem}` +
  `:where(${BTN}[data-nxt-btn="big"]:hover){background:rgba(0,0,0,.8)}` +
  `:where(${MEDIA}[data-state="playing"] ${BTN}[data-nxt-btn="big"]){display:none}` +
  // The seek bar and the volume slider: plain elements over an invisible range input.
  `:where([data-nxt-seek],[data-nxt-vol]){position:relative;display:flex;align-items:center;height:18px;min-width:0}` +
  `:where([data-nxt-seek]){flex:1 0 100%}` +
  `:where([data-nxt-vol]){flex:0 0 80px;width:80px}` +
  `:where([data-nxt-track],[data-nxt-buffer],[data-nxt-fill]){position:absolute;left:0;top:50%;height:4px;transform:translateY(-50%);border-radius:999px;pointer-events:none}` +
  `:where([data-nxt-track]){width:100%;background:rgba(255,255,255,.3)}` +
  `:where([data-nxt-buffer]){width:calc(var(--nxt-b,0)*100%);background:rgba(255,255,255,.35)}` +
  `:where([data-nxt-fill]){width:calc(var(--nxt-p,0)*100%);background:#fff}` +
  `:where([data-nxt-thumb]){position:absolute;top:50%;left:calc(var(--nxt-p,0)*100%);width:14px;height:14px;transform:translate(-50%,-50%);border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4);pointer-events:none}` +
  `:where([data-nxt-seek] input,[data-nxt-vol] input){position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}` +
  `:where([data-nxt-seek] input:focus-visible ~ [data-nxt-thumb],[data-nxt-vol] input:focus-visible ~ [data-nxt-thumb]){outline:2px solid #818cf8;outline-offset:2px}` +
  `:where([data-nxt-tip]){position:absolute;bottom:100%;left:var(--nxt-tip-x,0);transform:translateX(-50%);margin-bottom:6px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.85);color:#fff;font-size:.75rem;font-variant-numeric:tabular-nums;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .15s}` +
  `:where([data-nxt-seek]:hover [data-nxt-tip]){opacity:1}` +
  // Time, title and the spacer that pushes the right-hand buttons to the end.
  `:where([data-nxt-time]){font-size:.8125rem;font-variant-numeric:tabular-nums;white-space:nowrap}` +
  `:where([data-nxt-title]){flex:1 0 100%;overflow:hidden;font-weight:600;text-overflow:ellipsis;white-space:nowrap}` +
  `:where([data-nxt-spacer]){flex:1 1 0;min-width:0}` +
  `@media (prefers-reduced-motion:reduce){:where(${MEDIA} *){transition:none!important}}`;
