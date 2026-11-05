"use client";

import { Button, Input, Link, type ButtonProps, type InputProps } from "@heroui/react";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { getBrandAsset } from "@/lib/assets";
import { Icon } from "@/lib/icons/Icon";

// Look follows blueprint/pages/editor-supabase.png: pill inputs with a 2px outline and the label
// above the field, outlined rounded surfaces. Buttons use the white shades of the default scale
// (default-800/700/50) so every action reads the same; they invert in light mode.

const INPUT_CLASSES: InputProps["classNames"] = {
  base: "gap-1",
  label: "pb-1 text-small font-medium !text-foreground",
  inputWrapper:
    "h-12 min-h-12 flex-row flex-nowrap items-center gap-2 rounded-full border-2 border-default-200 bg-transparent px-5 shadow-none transition-colors " +
    "data-[hover=true]:border-default-400 group-data-[focus=true]:border-default-800 " +
    "group-data-[focus=true]:ring-4 group-data-[focus=true]:ring-default-800/10 " +
    "group-data-[invalid=true]:border-danger group-data-[invalid=true]:ring-0",
  innerWrapper: "h-full flex-nowrap items-center gap-2",
  input:
    "text-base text-foreground h-full min-w-0 flex-1 outline-none placeholder:text-default-400 data-[focus-visible=true]:outline-none",
  errorMessage: "px-2 text-tiny"
};

export function AuthInput(props: InputProps) {
  return (
    <Input
      variant="bordered"
      labelPlacement="outside-top"
      placeholder=" "
      classNames={INPUT_CLASSES}
      {...props}
    />
  );
}

export function PasswordInput(props: InputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <AuthInput
      {...props}
      type={visible ? "text" : "password"}
      endContent={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="rounded-full p-1 text-default-500 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-default-800"
        >
          {visible ? (
            <Icon name="ph:eye-slash" width={20} height={20} />
          ) : (
            <Icon name="ph:eye" width={20} height={20} />
          )}
        </button>
      }
    />
  );
}

export function AuthButton({ className, ...props }: ButtonProps) {
  return (
    <Button
      type="submit"
      radius="full"
      className={
        "h-12 w-full bg-default-800 text-base font-medium text-default-50 transition-colors " +
        "data-[hover=true]:bg-default-700 data-[hover=true]:opacity-100 data-[pressed=true]:bg-default-600 " +
        (className ?? "")
      }
      {...props}
    />
  );
}

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
