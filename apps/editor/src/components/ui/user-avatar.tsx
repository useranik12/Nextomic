"use client";

import { Avatar, type AvatarProps } from "@heroui-v2/react";

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
  size?: AvatarProps["size"];
  className?: string;
}) {
  return (
    <Avatar
      size={size}
      src={image ?? undefined}
      // HeroUI shortens `name` itself; give it the one letter we want and show it as is.
      name={avatarLetter(name)}
      getInitials={(letter) => letter}
      alt={name}
      showFallback
      className={className}
      classNames={{ name: "font-semibold" }}
    />
  );
}
