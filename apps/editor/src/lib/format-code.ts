// Formats code typed or shown in the builder (CSS, JavaScript, JSON) with Prettier. Prettier and
// its parsers load only when a Format button is pressed, so they never weigh on the first load.

import type { Plugin } from "prettier";

export type CodeLanguage = "css" | "js" | "json";

export interface FormatResult {
  ok: boolean;
  /** The formatted code, or the original when it could not be read. */
  code: string;
  /** Why the code could not be formatted (usually a syntax error). */
  error?: string;
}

export async function formatCode(code: string, language: CodeLanguage): Promise<FormatResult> {
  if (code.trim() === "") return { ok: true, code };
  try {
    const prettier = await import("prettier/standalone");
    const plugins: Plugin[] =
      language === "css"
        ? [(await import("prettier/plugins/postcss")).default]
        : [
            (await import("prettier/plugins/babel")).default,
            (await import("prettier/plugins/estree")).default as Plugin
          ];
    const formatted = await prettier.format(code, {
      parser: language === "css" ? "css" : language === "json" ? "json" : "babel",
      plugins,
      printWidth: 80,
      tabWidth: 2
    });
    return { ok: true, code: formatted.replace(/\n$/, "") };
  } catch (error) {
    const message = error instanceof Error ? error.message.split("\n")[0] : "";
    return { ok: false, code, error: message || "The code could not be read." };
  }
}
