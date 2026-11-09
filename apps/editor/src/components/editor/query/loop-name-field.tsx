"use client";

import { loopNameProblem, loopNames, type ElementNode } from "@nextomic/schema";
import { useEffect, useState } from "react";
import { FormInput } from "@/components/ui/controls";
import { useEditorStore } from "../store/editor-store";

// The loop's name, read inside the loop as {{ %name.item }} and {{ %name.index }}. Typing keeps a
// draft; a valid, unique name is applied on blur or Enter and every %old tag inside the loop is
// renamed with it. An invalid draft shows why and is dropped on Escape.

export function LoopNameField({ node }: { node: ElementNode }) {
  const name = node.query?.name ?? "";
  const tree = useEditorStore((s) => s.doc?.tree);
  const renameLoop = useEditorStore((s) => s.renameLoop);
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);

  const problem = tree ? loopNameProblem(draft, loopNames(tree, node.id)) : null;
  const commit = () => {
    if (draft !== name && !problem) renameLoop(node.id, draft);
  };

  return (
    <FormInput
      compact
      label="Loop name"
      description={problem ? undefined : `Read inside the loop as {{ %${name}.item }}`}
      value={draft}
      onValueChange={setDraft}
      isInvalid={!!problem}
      errorMessage={problem ?? undefined}
      spellCheck="false"
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") setDraft(name);
      }}
    />
  );
}
