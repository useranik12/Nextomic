import { getAction, outputIsList, type FlowName, type Params } from "@nextomic/schema";
import type { DynamicGroup, DynamicTag } from "./dynamic-sources";

export const ACTIONS_SECTION = { id: "actions", label: "Actions" };
export const QUERIES_SECTION = { id: "added-queries", label: "Added Queries" };

interface Field {
  name: string;
  type: string;
}

/** What the editor knows about the shapes of responses (saved structure only, never row data). */
export interface OutputLookup {
  /** Columns of a Supabase table by its `schema.table` reference. */
  columns: (ref: string) => Field[] | null;
  /** Fields of the data type an API Data call's response is read as. */
  restFields: (callId: string) => Field[] | null;
}

const USER_FIELDS: Field[] = [
  { name: "id", type: "text" },
  { name: "email", type: "text" },
  { name: "phone", type: "text" },
  { name: "emailVerified", type: "true or false" },
  { name: "name", type: "text" },
  { name: "role", type: "text" },
  { name: "metadata", type: "JSON" }
];
const UPLOADED_FIELDS: Field[] = [
  { name: "name", type: "text" },
  { name: "size", type: "number" },
  { name: "type", type: "text" },
  { name: "bucket", type: "text" },
  { name: "path", type: "text" }
];
const PICKED_FIELDS: Field[] = [
  { name: "id", type: "text" },
  { name: "name", type: "text" },
  { name: "size", type: "number" },
  { name: "type", type: "text" }
];

/** The fields of an action's response and whether it is a list of them; null: not an object. */
function shapeOf(
  type: string,
  params: Params,
  lookup: OutputLookup
): { fields: Field[]; list: boolean } | null {
  if (type.startsWith("supabase.") && type !== "supabase.rpc") {
    const ref = typeof params.table === "string" ? params.table : "";
    const fields = ref ? lookup.columns(ref) : null;
    return fields
      ? { fields, list: !(type === "supabase.query" && params.single === "true") }
      : null;
  }
  if (type === "rest.call") {
    const fields = typeof params.call === "string" ? lookup.restFields(params.call) : null;
    return fields ? { fields, list: false } : null;
  }
  if (type.startsWith("auth.") && getAction(type)?.output)
    return { fields: USER_FIELDS, list: false };
  if (type === "file.upload") return { fields: UPLOADED_FIELDS, list: true };
  if (type === "files.pick") {
    const def = getAction(type);
    const list = def?.output ? outputIsList(def.output, params) : false;
    return { fields: params.mode === "supabase" ? UPLOADED_FIELDS : PICKED_FIELDS, list };
  }
  return null;
}

const tag = (token: string, label: string, hint: string, help?: string): DynamicTag => ({
  token,
  label,
  hint,
  help
});

function outputTags(n: FlowName, source: string, lookup: OutputLookup): DynamicTag[] {
  const whole = tag(
    n.name,
    "Response",
    "everything the action answered",
    `What ${source} answered. Read a field with dot notation: {{ ${n.name}.field }}.`
  );
  const shape = n.type ? shapeOf(n.type, n.params ?? {}, lookup) : null;
  if (!shape) return [whole];
  const base = shape.list ? `${n.name}[0]` : n.name;
  return [
    whole,
    ...(shape.list
      ? [tag(base, "First item", "object", `The first item of the list: {{ ${n.name}[0].field }}.`)]
      : []),
    ...shape.fields.map((f) => tag(`${base}.${f.name}`, f.name, f.type))
  ];
}

/** One group per name an action node can read (outputs of earlier nodes, loop items, errors). */
export function actionGroups(names: readonly FlowName[], lookup: OutputLookup): DynamicGroup[] {
  return names.map((n) => {
    const source =
      n.kind === "loopItem"
        ? "Loop item"
        : n.kind === "error"
          ? "Error"
          : (n.nodeName ?? getAction(n.type ?? "")?.label ?? "Action Block");
    const tags =
      n.kind === "loopItem"
        ? [
            tag(`${n.name}.item`, "Item", "the current item"),
            tag(`${n.name}.index`, "Position", "number, from 0")
          ]
        : n.kind === "error"
          ? [tag(`${n.name}.code`, "Code", "text"), tag(`${n.name}.message`, "Message", "text")]
          : outputTags(n, source, lookup);
    return {
      id: `action-${n.name}`,
      label: `${n.name} · ${source}`,
      section: ACTIONS_SECTION,
      tags
    };
  });
}
