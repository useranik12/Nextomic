"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  removeAvatarAction,
  uploadAvatarAction
} from "@/app/(builder)/(dashboard)/settings/actions";
import { ActionButton } from "@/components/ui/controls";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Icon } from "@/lib/icons/Icon";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** Name, email and the profile image (upload or remove). */
export function ProfileSettings({
  name,
  email,
  image
}: {
  name: string;
  email: string;
  image: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [current, setCurrent] = useState(image);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    setError(null);
    const form = new FormData();
    form.set("file", file);
    startTransition(async () => {
      const result = await uploadAvatarAction(form);
      if (result.error) setError(result.error);
      else {
        setCurrent(result.image);
        router.refresh();
      }
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeAvatarAction();
      if (result.error) setError(result.error);
      else {
        setCurrent(null);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-5 rounded-large border border-default-100 bg-content1/40 p-5">
        <UserAvatar name={name} image={current} size="lg" className="h-16 w-16 text-large" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="truncate text-medium font-semibold text-foreground">{name}</p>
          <p className="truncate text-small text-default-500">{email}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="hidden"
            aria-label="Profile image file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
          <ActionButton size="sm" isLoading={pending} onPress={() => input.current?.click()}>
            <Icon name="ph:upload-simple" width={14} height={14} />
            {current ? "Change image" : "Upload image"}
          </ActionButton>
          {current ? (
            <ActionButton size="sm" tone="danger-ghost" isDisabled={pending} onPress={remove}>
              Remove
            </ActionButton>
          ) : null}
        </div>
      </div>
      <p className="text-tiny text-default-500">
        PNG, JPG, WebP or GIF, up to 2 MB. Without an image, the first letter of your name is shown.
      </p>
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
