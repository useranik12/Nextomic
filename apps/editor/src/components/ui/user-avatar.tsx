"use client";

import { Avatar } from "@heroui/react";

/** The first letter of the name, upper-cased; "?" when the name is empty. */
export function avatarLetter(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toLocaleUpperCase() : "?";
}

/**
 * A builder user's avatar: their uploaded image, or the first letter of their name when there is
 * no image (or it fails to load).
 */
export function UserAvatar({
  name,
  image,
  size = "sm",
  className
}: {
  name: string;
  image: string | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Avatar
      size={size}
      className={`aspect-square shrink-0 overflow-hidden !rounded-full ${className ?? ""}`}
    >
      {image ? (
        <Avatar.Image
          src={image}
          alt={name}
          className="aspect-square h-full w-full rounded-full object-cover"
        />
      ) : null}
      <Avatar.Fallback className="rounded-full font-semibold">{avatarLetter(name)}</Avatar.Fallback>
    </Avatar>
  );
}
