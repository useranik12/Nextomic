export async function register(): Promise<void> {
  // The Edge runtime has no database or timers; only the Node server cleans up storage.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startStorageCleanup } = await import("@/server/storage-cleanup");
  startStorageCleanup();
}
