"use client";

import { addCollection, Icon as IconifyIcon, type IconifyIconProps } from "@iconify/react";
import { useEffect, useState } from "react";
import bundledIcons from "./bundled-icons.json";
import { ICON_IDS } from "./registry";

let collectionLoaded = false;
function ensureCollectionLoaded() {
  if (collectionLoaded) return;
  for (const [prefix, iconSet] of Object.entries(bundledIcons)) {
    addCollection(iconSet as Parameters<typeof addCollection>[0], prefix);
  }
  collectionLoaded = true;
}

export interface IconProps extends Omit<IconifyIconProps, "icon"> {
  /** "<set>:<name>", must be registered in src/lib/icons/registry.ts */
  name: string;
  /** Decorative icons are aria-hidden by default; pass an accessible label if the icon is not purely decorative. */
  label?: string;
  className?: string;
}

export function Icon({ name, label, ...props }: IconProps) {
  const [ready, setReady] = useState(collectionLoaded);

  useEffect(() => {
    ensureCollectionLoaded();
    setReady(true);
  }, []);

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
