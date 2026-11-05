"use client";

import { Link } from "@heroui/react";
import Image from "next/image";
import type { ReactNode } from "react";
import { getBrandAsset } from "@/lib/assets";
import { Icon } from "@/lib/icons/Icon";

export function AuthLink({ className, ...props }: React.ComponentProps<typeof Link>) {
  return (
    <Link
      size="sm"
      className={`text-default-500 transition-colors hover:text-foreground ${className ?? ""}`}
      {...props}
    />
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-2xl border-2 border-danger/40 bg-danger/10 px-4 py-3 text-small text-danger-600"
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
    <div className="flex flex-col gap-6 rounded-3xl border-2 border-default-200 bg-content1 p-8">
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
        {description ? <p className="text-small text-default-500">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
