import type { RunLogEntry } from "@nextomic/runtime";
import type { HostMessage } from "./protocol";

// Connects the flow editor's Test to the canvas iframe, like the animation bridge: commands go out
// through `sendTest`, the canvas reports each step and the end of the run.

export type TestCommand = Extract<HostMessage, { type: "test-run" | "test-stop" }>;

export type TestEvent =
  | { type: "log"; runId: string; entry: RunLogEntry }
  | { type: "done"; runId: string; error: string | null };

const commandListeners = new Set<(command: TestCommand) => void>();
const eventListeners = new Set<(event: TestEvent) => void>();

/** The canvas frame registers here to forward commands to the iframe. */
export function onTestCommand(listener: (command: TestCommand) => void): () => void {
  commandListeners.add(listener);
  return () => void commandListeners.delete(listener);
}

/** Whether a canvas is there to run a test. */
export const canTest = () => commandListeners.size > 0;

export function sendTest(command: TestCommand): void {
  for (const listener of commandListeners) listener(command);
}

export function reportTest(event: TestEvent): void {
  for (const listener of eventListeners) listener(event);
}

export function onTestEvent(listener: (event: TestEvent) => void): () => void {
  eventListeners.add(listener);
  return () => void eventListeners.delete(listener);
}
