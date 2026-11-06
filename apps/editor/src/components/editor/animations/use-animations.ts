import {
  newAnimation,
  newTimeline,
  type Animation,
  type AnimationSettings,
  type Timeline
} from "@nextomic/schema";
import { useEditorStore } from "../store/editor-store";

function uid(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function uniqueName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.includes(`${base} ${n}`)) return `${base} ${n}`;
}

const read = (): AnimationSettings => useEditorStore.getState().project.animations;
const commit = (next: AnimationSettings): void =>
  useEditorStore.getState().patchProject({ animations: next });

function mapTimeline(id: string, change: (t: Timeline) => Timeline): void {
  const current = read();
  commit({ ...current, timelines: current.timelines.map((t) => (t.id === id ? change(t) : t)) });
}

/** Every change the Animations editor makes to the project's animation data. */
export const animationActions = {
  addTimeline(folderId: string | null): Timeline {
    const current = read();
    const name = uniqueName(
      "New timeline",
      current.timelines.map((t) => t.name)
    );
    const timeline = newTimeline(uid("tl"), name, folderId);
    commit({ ...current, timelines: [...current.timelines, timeline] });
    return timeline;
  },
  duplicateTimeline(id: string): Timeline | null {
    const current = read();
    const source = current.timelines.find((t) => t.id === id);
    if (!source) return null;
    const copy: Timeline = {
      ...source,
      id: uid("tl"),
      name: uniqueName(
        `${source.name} copy`,
        current.timelines.map((t) => t.name)
      ),
      animations: source.animations.map((a) => ({ ...a, id: uid("an") }))
    };
    commit({ ...current, timelines: [...current.timelines, copy] });
    return copy;
  },
  removeTimeline(id: string): void {
    const current = read();
    commit({ ...current, timelines: current.timelines.filter((t) => t.id !== id) });
  },
  patchTimeline(id: string, change: Partial<Timeline>): void {
    mapTimeline(id, (t) => ({ ...t, ...change }));
  },
  addAnimation(timelineId: string): Animation | null {
    const timeline = read().timelines.find((t) => t.id === timelineId);
    if (!timeline) return null;
    const name = uniqueName(
      "Animation",
      timeline.animations.map((a) => a.name)
    );
    const animation = newAnimation(uid("an"), name);
    mapTimeline(timelineId, (t) => ({ ...t, animations: [...t.animations, animation] }));
    return animation;
  },
  duplicateAnimation(timelineId: string, id: string): Animation | null {
    const timeline = read().timelines.find((t) => t.id === timelineId);
    const source = timeline?.animations.find((a) => a.id === id);
    if (!timeline || !source) return null;
    const copy: Animation = {
      ...source,
      id: uid("an"),
      name: uniqueName(
        `${source.name} copy`,
        timeline.animations.map((a) => a.name)
      )
    };
    mapTimeline(timelineId, (t) => ({ ...t, animations: [...t.animations, copy] }));
    return copy;
  },
  patchAnimation(timelineId: string, id: string, change: Partial<Animation>): void {
    mapTimeline(timelineId, (t) => ({
      ...t,
      animations: t.animations.map((a) => (a.id === id ? { ...a, ...change } : a))
    }));
  },
  removeAnimation(timelineId: string, id: string): void {
    mapTimeline(timelineId, (t) => ({
      ...t,
      animations: t.animations.filter((a) => a.id !== id)
    }));
  },
  moveAnimation(timelineId: string, id: string, by: -1 | 1): void {
    mapTimeline(timelineId, (t) => {
      const index = t.animations.findIndex((a) => a.id === id);
      const target = index + by;
      if (index < 0 || target < 0 || target >= t.animations.length) return t;
      const next = [...t.animations];
      const [item] = next.splice(index, 1);
      if (item) next.splice(target, 0, item);
      return { ...t, animations: next };
    });
  },
  addFolder(): string {
    const current = read();
    const id = uid("fo");
    const name = uniqueName(
      "New folder",
      current.folders.map((f) => f.name)
    );
    commit({ ...current, folders: [...current.folders, { id, name }] });
    return id;
  },
  renameFolder(id: string, name: string): void {
    const current = read();
    const trimmed = name.trim().slice(0, 48);
    if (!trimmed) return;
    commit({
      ...current,
      folders: current.folders.map((f) => (f.id === id ? { ...f, name: trimmed } : f))
    });
  },
  /** Timelines inside a deleted folder move to the top level; none are lost. */
  removeFolder(id: string): void {
    const current = read();
    commit({
      folders: current.folders.filter((f) => f.id !== id),
      timelines: current.timelines.map((t) => (t.folderId === id ? { ...t, folderId: null } : t))
    });
  },
  replaceAll: commit
};

export function useAnimationSettings(): AnimationSettings {
  return useEditorStore((s) => s.project.animations);
}
