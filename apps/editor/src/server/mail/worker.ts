import { processQueue } from "./queue";

// Sends due mail every 15 seconds for the life of the server process. Started once from
// instrumentation.ts; new messages are also sent right away when they are queued.

const TICK_MS = 15_000;
const KEY = Symbol.for("nextomic.mailWorker");

type WithWorker = typeof globalThis & { [KEY]?: ReturnType<typeof setInterval> };

export function startMailWorker() {
  const scope = globalThis as WithWorker;
  if (scope[KEY]) return;
  const tick = () => {
    processQueue().catch(() => {
      // A database or network hiccup; the next tick tries again.
    });
  };
  scope[KEY] = setInterval(tick, TICK_MS);
  scope[KEY].unref?.();
  tick();
}
