"use client";

import { useState } from "react";
import { Icon } from "@/lib/icons/Icon";
import { formatCode, type CodeLanguage } from "@/lib/format-code";

/**
 * The Format icon at the top right of a code box. It formats the code and hands it back; when the
 * code has a syntax error it says so and changes nothing.
 */
export function FormatButton({
  code,
  language,
  onFormatted,
  label = "Format code"
}: {
  code: string;
  language: CodeLanguage;
  onFormatted: (code: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    const result = await formatCode(code, language);
    setBusy(false);
    setError(result.ok ? null : (result.error ?? "The code could not be formatted."));
    if (result.ok && result.code !== code) onFormatted(result.code);
  }

  return (
    <span className="flex items-center gap-1">
      {error ? (
        <span role="alert" className="max-w-56 truncate text-tiny text-danger" title={error}>
          {error}
        </span>
      ) : null}
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={busy}
        onClick={() => void run()}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-default-200/80 text-default-600 backdrop-blur transition-colors duration-300 hover:bg-default-300 hover:text-foreground disabled:opacity-50"
      >
        <Icon name="ph:magic-wand" width={14} height={14} />
      </button>
    </span>
  );
}
