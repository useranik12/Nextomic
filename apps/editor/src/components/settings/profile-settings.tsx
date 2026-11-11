"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveProfileAction } from "@/app/(builder)/(dashboard)/settings/actions";
import { ActionButton, FormInput } from "@/components/ui/controls";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Icon } from "@/lib/icons/Icon";
import { EmailChange } from "./email-change";

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_BYTES = 2 * 1024 * 1024;

/** Picked image waiting for Save: a new file, or removal of the current one. */
type Pending = { kind: "file"; file: File; preview: string } | { kind: "remove" } | null;

/** Name, profile image and email. Name and image change only when Save is pressed. */
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
  const [savedName, setSavedName] = useState(name);
  const [savedImage, setSavedImage] = useState(image);
  const [draftName, setDraftName] = useState(name);
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  useEffect(
    () => () => {
      if (pending?.kind === "file") URL.revokeObjectURL(pending.preview);
    },
    [pending]
  );

  const shownImage =
    pending?.kind === "file" ? pending.preview : pending?.kind === "remove" ? null : savedImage;
  const dirty = draftName.trim() !== savedName || pending !== null;

  function pick(file: File) {
    setError(null);
    setNotice(null);
    if (file.size > MAX_BYTES) return setError("Images can be up to 2 MB.");
    setPending({ kind: "file", file, preview: URL.createObjectURL(file) });
  }

  function discard() {
    setDraftName(savedName);
    setPending(null);
    setError(null);
  }

  function save() {
    setError(null);
    setNotice(null);
    const form = new FormData();
    form.set("name", draftName);
    if (pending?.kind === "file") form.set("file", pending.file);
    if (pending?.kind === "remove") form.set("removeImage", "true");
    startSaving(async () => {
      const result = await saveProfileAction(form);
      if (result.data === null) return setError(result.error);
      setSavedName(draftName.trim());
      setSavedImage(result.data.image);
      setPending(null);
      setNotice("Profile saved.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-large border border-default-100 bg-content1/40 p-5">
      <div className="flex flex-wrap items-center gap-5">
        <UserAvatar
          name={draftName || savedName}
          image={shownImage}
          size="lg"
          className="h-16 w-16 text-large"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            className="hidden"
            aria-label="Profile image file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) pick(file);
            }}
          />
          <ActionButton size="sm" tone="outline" onPress={() => input.current?.click()}>
            <Icon name="ph:upload-simple" width={14} height={14} />
            {shownImage ? "Change image" : "Upload image"}
          </ActionButton>
          {shownImage ? (
            <ActionButton
              size="sm"
              tone="danger-ghost"
              onPress={() => setPending(savedImage ? { kind: "remove" } : null)}
            >
              Remove
            </ActionButton>
          ) : null}
        </div>
        <p className="w-full text-tiny text-default-500">
          PNG, JPG, WebP or GIF, up to 2 MB. Without an image, the first letter of your name is
          shown.
        </p>
      </div>
      <FormInput
        label="Name"
        value={draftName}
        onValueChange={setDraftName}
        autoComplete="name"
        className="max-w-md"
      />
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      {notice && !dirty ? (
        <p role="status" className="text-small text-success">
          {notice}
        </p>
      ) : null}
      {dirty ? (
        <div className="flex items-center gap-2">
          <ActionButton size="sm" isLoading={saving} isDisabled={!draftName.trim()} onPress={save}>
            Save
          </ActionButton>
          <ActionButton size="sm" tone="ghost" isDisabled={saving} onPress={discard}>
            Discard
          </ActionButton>
          <span className="text-tiny text-default-500">Unsaved changes</span>
        </div>
      ) : null}
      <EmailChange email={email} />
    </div>
  );
}
