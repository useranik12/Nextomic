import { PLAYER_ACTIONS, toText } from "@nextomic/schema";
import { FlowError, type ActionHandler } from "./engine";
import { PlayerError, mediaOf, runCommand } from "../media/player";

// Actions of the Video and Audio players (docs/elements.md "Video and Audio"): the same commands
// the buttons and keys use, run on the player of this element or of a chosen one.

const toStrings = (params: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(params).map(([key, value]) => [key, toText(value)]));

function playersOf(id: string): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[data-nxt-media][data-nid="${CSS.escape(id)}"]`)
  ).filter((player) => mediaOf(player) !== null);
}

export function mediaHandlers(): Record<string, ActionHandler> {
  const handlers: Record<string, ActionHandler> = {};
  for (const action of PLAYER_ACTIONS) {
    if (action.disabled) continue;
    const command = action.type.split(".")[1] ?? "";
    handlers[action.type] = async (params, ctx) => {
      const id = toText(params.element) || ctx.elementId;
      if (!id) throw new FlowError("no-element", "Choose the player.");
      const players = playersOf(id);
      if (players.length === 0) throw new FlowError("no-element", "The player is not on the page.");
      try {
        // A player that sits in a query loop appears once per row: all of them obey.
        for (const player of players) await runCommand(player, command, toStrings(params));
      } catch (e) {
        if (e instanceof PlayerError) throw new FlowError(e.code, e.message);
        throw e;
      }
    };
  }
  return handlers;
}
