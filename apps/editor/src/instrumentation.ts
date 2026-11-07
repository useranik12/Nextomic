// Runs once when the Next.js server starts. The import sits inside the runtime check so the
// edge bundle never includes the mail worker (and its database driver).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMailWorker } = await import("./server/mail/worker");
    startMailWorker();
  }
}
