"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Switch } from "@heroui/react";
import { useState } from "react";
import { ActionButton, FormInput, PasswordInput } from "@/components/ui/controls";
import { Icon } from "@/lib/icons/Icon";
import { useEditorStore } from "../store/editor-store";
import { ConnectionStatusChip } from "./connection-status";
import { SupabaseCard } from "./supabase-page";
import type { SupabasePageModel } from "./use-supabase-page";

/** App state and constants typed as a Supabase Row, which a cleared schema leaves pointing nowhere. */
function useRowTypedNames(): string[] {
  const appState = useEditorStore((s) => s.project.appState);
  return appState.filter((v) => v.type === "supabaseRow").map((v) => v.name);
}

/** URL, anon key, Active, Fetch Schema and Clear Schema. Fetch saves changed fields first. */
export function ConnectionCard({ model }: { model: SupabasePageModel }) {
  const { connector, data } = model;
  const savedUrl =
    typeof connector?.config.projectUrl === "string" ? connector.config.projectUrl : "";
  const keyMask = connector?.secrets.anonKey;
  const [url, setUrl] = useState(savedUrl);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"fetch" | "active" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const rowTyped = useRowTypedNames();
  const dirty = url.trim() !== savedUrl || key.trim() !== "";
  const canFetch = url.trim() !== "" && (key.trim() !== "" || Boolean(keyMask?.hasSecret));

  const done = (message: string | null, ok: string) => {
    setBusy(null);
    if (message) return setError(message);
    setNotice(ok);
  };

  async function fetchSchema() {
    setBusy("fetch");
    setError(null);
    setNotice(null);
    let id = connector?.id;
    if (!id || dirty) {
      const saved = await model.save({ draft: { projectUrl: url.trim(), anonKey: key.trim() } });
      if (saved.data === null) return done(saved.error, "");
      id = saved.data;
      setKey("");
    }
    const result = await model.fetchSchema(id);
    done(result.error, "Schema fetched.");
  }

  async function toggleActive(active: boolean) {
    setBusy("active");
    setError(null);
    setNotice(null);
    const result = await model.save({ active });
    done(result.error, active ? "Connection turned on." : "Connection turned off.");
  }

  async function clear() {
    setConfirmClear(false);
    setBusy("clear");
    setError(null);
    const result = await model.clearSchema();
    done(result.error, "Schema cleared.");
  }

  const fetchedAt = data?.schema?.fetchedAt;

  return (
    <SupabaseCard
      title="Connection"
      badge={<ConnectionStatusChip status={model.status} />}
      aside={
        connector ? (
          <Switch
            size="sm"
            isSelected={connector.active}
            isDisabled={busy !== null}
            onValueChange={(on) => void toggleActive(on)}
          >
            <span className="text-small">Active</span>
          </Switch>
        ) : null
      }
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <FormInput
            label="Supabase URL"
            placeholder="https://xyz.supabase.co"
            value={url}
            onValueChange={(v) => {
              setUrl(v);
              setError(null);
            }}
            autoComplete="off"
          />
          <PasswordInput
            label="Anon Key/Publishable Key"
            placeholder={
              keyMask?.hasSecret
                ? `Saved${keyMask.tail ? ` (…${keyMask.tail})` : ""}. Paste to replace.`
                : "eyJ… or sb_publishable_…"
            }
            value={key}
            onValueChange={(v) => {
              setKey(v);
              setError(null);
            }}
            autoComplete="off"
          />
        </div>
        <div className="flex shrink-0 justify-end gap-2">
          <ActionButton
            isLoading={busy === "fetch"}
            isDisabled={!canFetch || busy !== null}
            onPress={() => void fetchSchema()}
          >
            <Icon name="ph:download-simple" width={16} height={16} />
            {data?.schema ? "Refetch Schema" : "Fetch Schema"}
          </ActionButton>
          <ActionButton
            tone="danger-ghost"
            className="border border-danger"
            isLoading={busy === "clear"}
            isDisabled={!data?.schema || busy !== null}
            onPress={() => setConfirmClear(true)}
          >
            <Icon name="ph:trash" width={16} height={16} />
            Clear Schema
          </ActionButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-tiny text-default-500">
        {fetchedAt ? (
          <span>Schema fetched {new Date(fetchedAt).toLocaleString()}.</span>
        ) : (
          <span>No schema fetched yet.</span>
        )}
        {dirty && connector ? (
          <button
            type="button"
            className="text-default-600 underline-offset-2 hover:underline"
            onClick={() => {
              setUrl(savedUrl);
              setKey("");
            }}
          >
            Discard changes
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}
      {notice && !error ? (
        <p role="status" className="text-small text-success">
          {notice}
        </p>
      ) : null}

      <Modal isOpen={confirmClear} onOpenChange={setConfirmClear} size="md">
        <ModalContent>
          <ModalHeader>Clear the schema?</ModalHeader>
          <ModalBody className="text-small text-default-600">
            <p>
              The saved tables, views, functions, buckets and stars are removed. Fetch again to
              bring them back.
            </p>
            {rowTyped.length > 0 ? (
              <p className="text-warning">
                These app state variables use a Supabase Row type and will point at nothing:{" "}
                {rowTyped.join(", ")}.
              </p>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <ActionButton tone="ghost" onPress={() => setConfirmClear(false)}>
              Cancel
            </ActionButton>
            <ActionButton tone="danger" onPress={() => void clear()}>
              Clear Schema
            </ActionButton>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </SupabaseCard>
  );
}
