"use client";

import phosphorIcons from "@iconify-json/ph/icons.json";
import { addCollection, Icon as IconifyIcon } from "@iconify/react";
import type { ComponentProps } from "react";

addCollection(phosphorIcons);

export const iconRegistry = {
  apps: "ph:circles-four",
  calendar: "ph:calendar",
  grid: "ph:squares-four",
  list: "ph:list",
  logo: "ph:hexagon",
  menu: "ph:dots-three-vertical",
  plus: "ph:plus",
  search: "ph:magnifying-glass",
  settings: "ph:gear-six",
  user: "ph:user-circle"
} as const;

export type RegisteredIconName = keyof typeof iconRegistry;

export function Icon({ name, ...props }: { name: RegisteredIconName } & Omit<ComponentProps<typeof IconifyIcon>, "icon">) {
  return <IconifyIcon aria-hidden="true" icon={iconRegistry[name]} {...props} />;
}
