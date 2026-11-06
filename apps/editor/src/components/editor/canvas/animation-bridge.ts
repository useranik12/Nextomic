import type { HostMessage } from "./protocol";

// Connects the Animations editor to the canvas iframe without routing every tick through the
// editor store: commands go out through `sendAnimation`, the canvas reports where the preview is.

export type AnimationCommand = Extract<
  HostMessage,
  { type: "anim-load" | "anim-control" | "anim-seek" }
>;

export interface AnimationPreviewState {
  /** Seconds. */
  time: number;
  duration: number;
  playing: boolean;
}

const IDLE: AnimationPreviewState = { time: 0, duration: 0, playing: false };

let state = IDLE;
const stateListeners = new Set<() => void>();
const commandListeners = new Set<(command: AnimationCommand) => void>();

/** The canvas frame registers here to forward commands to the iframe. */
export function onAnimationCommand(listener: (command: AnimationCommand) => void): () => void {
  commandListeners.add(listener);
  return () => void commandListeners.delete(listener);
}

export function sendAnimation(command: AnimationCommand): void {
  for (const listener of commandListeners) listener(command);
}

export function reportAnimationState(next: AnimationPreviewState): void {
  state = next;
  for (const listener of stateListeners) listener();
}

export function subscribeAnimationState(listener: () => void): () => void {
  stateListeners.add(listener);
  return () => void stateListeners.delete(listener);
}

export function getAnimationState(): AnimationPreviewState {
  return state;
}

export function getIdleAnimationState(): AnimationPreviewState {
  return IDLE;
}
