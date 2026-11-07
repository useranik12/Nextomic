"use client";

import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from "@heroui/react";
import { useEffect, useState } from "react";
import {
  getEmailTemplateAction,
  resetEmailTemplateAction,
  saveEmailTemplateAction
} from "@/app/(builder)/(dashboard)/settings/smtp-actions";
import { ActionButton, FormInput } from "@/components/ui/controls";

interface Variable {
  name: string;
  description: string;
}

const AREA =
  "min-h-40 w-full resize-y rounded-large border border-default-200 bg-transparent p-3 font-mono text-tiny text-foreground outline-none transition-colors hover:border-default-400 focus:border-default-800";

/** Edits one email template: subject, HTML and plain text, with its {{variables}} listed. */
export function TemplateDialog({
  kind,
  label,
  variables,
  onClose
}: {
  kind: string;
  label: string;
  variables: Variable[];
  onClose: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");
  const [text, setText] = useState("");
  const [custom, setCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void getEmailTemplateAction(kind).then((result) => {
      if (!live) return;
      setLoading(false);
      if (result.data === null) return setError(result.error);
      setSubject(result.data.subject);
      setHtml(result.data.html);
      setText(result.data.text);
      setCustom(result.data.custom);
    });
    return () => {
      live = false;
    };
  }, [kind]);

  async function finish(work: () => Promise<{ error: string | null }>) {
    setBusy(true);
    setError(null);
    const result = await work();
    setBusy(false);
    if (result.error) setError(result.error);
    else onClose();
  }

  return (
    <Modal isOpen onClose={onClose} backdrop="blur" size="3xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>{label} template</ModalHeader>
        <ModalBody className="gap-4">
          {loading ? (
            <Spinner size="sm" label="Loading template" />
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {variables.map((v) => (
                  <code
                    key={v.name}
                    title={v.description}
                    className="rounded-medium bg-default-100 px-2 py-0.5 text-tiny text-default-700"
                  >
                    {`{{${v.name}}}`}
                  </code>
                ))}
              </div>
              <FormInput label="Subject" value={subject} onValueChange={setSubject} isRequired />
              <label className="flex flex-col gap-1 text-small font-medium text-foreground">
                HTML
                <textarea
                  aria-label="HTML"
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  className={AREA}
                  spellCheck={false}
                />
              </label>
              <label className="flex flex-col gap-1 text-small font-medium text-foreground">
                Plain text
                <textarea
                  aria-label="Plain text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className={`${AREA} min-h-28`}
                />
              </label>
              <p className="text-tiny text-default-500">
                Values are escaped in the HTML part. Unknown variables come out empty.
              </p>
            </>
          )}
          {error ? (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter className="flex items-center">
          {custom ? (
            <ActionButton
              tone="danger-ghost"
              className="mr-auto"
              isDisabled={busy}
              onPress={() => void finish(() => resetEmailTemplateAction(kind))}
            >
              Reset to default
            </ActionButton>
          ) : null}
          <ActionButton tone="ghost" onPress={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            isLoading={busy}
            isDisabled={loading}
            onPress={() =>
              void finish(() => saveEmailTemplateAction(kind, { subject, html, text }))
            }
          >
            Save template
          </ActionButton>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
