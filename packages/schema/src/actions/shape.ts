import { getAction, outputIsList } from "./catalog";
import type { Params } from "./fields";

// The shape of what an action answers, from the saved structure only (never row data). Shared by
// the editor's pickers and the server's publish checks.

/** One field of a response or row: its Nextomic type and whether it holds a list. */
export interface ShapeField {
  name: string;
  type: string;
  isList?: boolean;
}

/** What the editor knows about the shapes of responses (saved structure only, never row data). */
export interface OutputLookup {
  /** Columns of a Supabase table by its `schema.table` reference. */
  columns: (ref: string) => ShapeField[] | null;
  /** Fields of the data type an API Data call's response is read as. */
  restFields: (callId: string) => ShapeField[] | null;
}

const USER_FIELDS: ShapeField[] = [
  { name: "id", type: "text" },
  { name: "email", type: "text" },
  { name: "phone", type: "text" },
  { name: "emailVerified", type: "true or false" },
  { name: "name", type: "text" },
  { name: "role", type: "text" },
  { name: "metadata", type: "JSON" }
];
const UPLOADED_FIELDS: ShapeField[] = [
  { name: "name", type: "text" },
  { name: "size", type: "number" },
  { name: "type", type: "text" },
  { name: "bucket", type: "text" },
  { name: "path", type: "text" }
];
const PICKED_FIELDS: ShapeField[] = [
  { name: "id", type: "text" },
  { name: "name", type: "text" },
  { name: "size", type: "number" },
  { name: "type", type: "text" }
];

/** The fields of an action's response and whether it is a list of them; null: not an object. */
export function outputShape(
  type: string,
  params: Params,
  lookup: OutputLookup
): { fields: ShapeField[]; list: boolean } | null {
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
