"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { getBrandAsset } from "@/lib/assets";
import { Icon } from "@/lib/icons/Icon";

const AUTH_LINK =
  "rounded-sm text-sm text-muted underline-offset-4 outline-none transition-colors duration-150 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-focus";

/** A quiet text link (`href`) or text button (`onPress`) for the auth screens. */
export function AuthLink({
  href,
  onPress,
  children
}: {
  href?: string;
  onPress?: () => void;
  children: ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} className={AUTH_LINK}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onPress} className={AUTH_LINK}>
      {children}
    </button>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      <Icon name="ph:warning-circle" width={18} height={18} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <div className="flex flex-col gap-6 rounded-3xl border-2 border-border bg-surface p-8">
      <div className="flex flex-col gap-3">
        <Image
          src={getBrandAsset("name-logo", "dark")}
          alt="Nextomic"
          width={134}
          height={25}
          priority
          className="hidden dark:block"
        />
        <Image
          src={getBrandAsset("name-logo", "light")}
          alt="Nextomic"
          width={134}
          height={25}
          priority
          className="dark:hidden"
        />
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function AuthNotice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-2xl border-2 border-success/40 bg-success/10 px-4 py-3 text-sm text-success-600"
    >
      <Icon name="ph:check-circle" width={18} height={18} className="mt-0.5 shrink-0" />
      {message}
    </p>
  );
}
