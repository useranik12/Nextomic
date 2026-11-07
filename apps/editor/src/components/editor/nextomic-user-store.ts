import type { NextomicUser } from "@nextomic/schema";
import { create } from "zustand";

// The builder account viewing the editor, for {{nextomic.user.*}} on the canvas. Set once from the
// server when the editor opens.

export const useNextomicUser = create<{ user: NextomicUser | null }>(() => ({ user: null }));
