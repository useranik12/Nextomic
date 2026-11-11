"use client";

import { addCollection, Icon as IconifyIcon, type IconifyIconProps } from "@iconify/react";
import { useSyncExternalStore } from "react";
import bundledIcons from "./bundled-icons.json";
import { ICON_IDS } from "./registry";

// The bundled sets load once in the browser. The server renders no icon; during hydration every
// icon reads the server value (not ready), so the HTML always matches, then icons appear in the
// pass right after hydration. Mounts after hydration render the icon at once.
if (typeof window !== "undefined") {
  for (const [prefix, iconSet] of Object.entries(bundledIcons)) {
    addCollection(iconSet as Parameters<typeof addCollection>[0], prefix);
  }
}

const neverChanges = () => () => undefined;

export interface IconProps extends Omit<IconifyIconProps, "icon"> {
  /** "<set>:<name>", must be registered in src/lib/icons/registry.ts */
  name: string;
  /** Decorative icons are aria-hidden by default; pass an accessible label if the icon is not purely decorative. */
  label?: string;
  className?: string;
}

export function Icon({ name, label, ...props }: IconProps) {
  const ready = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false
  );

  if (process.env.NODE_ENV !== "production" && !ICON_IDS.includes(name)) {
    throw new Error(
      `Icon "${name}" is not registered in src/lib/icons/registry.ts — add it there first.`
    );
  }

  if (!ready) return null;

  return (
    <IconifyIcon
      icon={name}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      // @iconify/react's public prop type allows `null` for height/width (meaning "unset"),
      // but the internal element prop type it's assigned to does not — a gap in their own
      // typings, not a real type mismatch for how we call this. Safe to widen here.
      {...(props as Record<string, unknown>)}
    />
  );
}
