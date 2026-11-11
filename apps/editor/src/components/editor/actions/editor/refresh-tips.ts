import {
  LOCAL_LOOP_KIND_LABELS,
  SUPABASE_OPERATOR_LABELS,
  tableRef,
  type ElementQuery,
  type QueryFilter,
  type QueryOrder,
  type RestConfig
} from "@nextomic/schema";

// The info tips of Refresh Query's settings (docs/dynamic-data-and-actions.md section 8.7): each
// label says what the query loop itself uses for that field, so the owner sees what they changed.
// Keys match the ones the query forms ask for (see query-form-mode.tsx).

const quoted = (text: string) => (text === "" ? "empty" : `"${text}"`);

const filterText = (f: QueryFilter) =>
  `${f.column} ${SUPABASE_OPERATOR_LABELS[f.operator].toLowerCase()} ${quoted(f.value)}`;

const orderText = (o: QueryOrder) => `${o.column}, ${o.ascending ? "increasing" : "decreasing"}`;

const listText = (items: string[], none: string) =>
  items.length === 0 ? none : `The loop uses: ${items.join("; ")}.`;

const KEPT = "A refresh keeps the loop's own setting: change it on the loop.";

const FILLED = "Tags are filled when the action runs; fixed text stays as written.";
const FILTER_FILLED = `${FILLED} Never rely on a filter to protect rows: use Row Level Security.`;

/** The tip for each refresh setting, from the loop's own query. */
export function refreshTips(loop: ElementQuery, rest: RestConfig | null) {
  const s = loop.supabase;
  const r = loop.rest;
  const l = loop.local;
  const shape = (single: boolean, limit: number) =>
    single ? "a single row" : `a list of up to ${limit} rows at a time`;
  const filterTip = (id: string, part: "column" | "operator" | "value") => {
    const own = s.filters.find((f) => f.id === id);
    if (!own) return "Added here: the loop has no such filter.";
    const used =
      part === "column"
        ? own.column
        : part === "operator"
          ? SUPABASE_OPERATOR_LABELS[own.operator]
          : quoted(own.value);
    return `The loop uses ${used} (${filterText(own)}).${part === "value" ? ` ${FILTER_FILLED}` : ""}`;
  };
  const orderTip = (id: string) => {
    const own = s.order.find((o) => o.id === id);
    return own
      ? `The loop orders by ${orderText(own)}.`
      : "Added here: the loop has no such order.";
  };
  const call = rest?.calls.find((c) => c.id === r.callId);
  const callPath = call?.response.jsonPaths.find((p) => p.id === r.listPath);

  const tips: Record<string, string> = {
    type: "Refresh Query keeps the loop's query type. Change it on the loop.",
    name: "The loop this action refreshes. Inside the loop, rows are read as %name.item.",
    rows:
      loop.source === "supabase"
        ? `The loop loads ${shape(s.single, s.limit)}.`
        : loop.source === "rest"
          ? `The loop loads ${shape(r.single, r.limit)}.`
          : `The loop loads ${shape(l.single, l.limit)}.`,
    limit: `The loop loads ${loop.source === "supabase" ? s.limit : loop.source === "rest" ? r.limit : l.limit} rows at a time.`,
    infiniteScroll: `The loop has infinite scroll ${s.infiniteScroll ? "on" : "off"}. ${KEPT}`,
    realtime: `The loop has realtime ${s.realtime ? "on" : "off"}. ${KEPT}`,
    table: s.table
      ? `The loop reads ${tableRef(s.schema, s.table)}.`
      : "The loop has no table yet.",
    filters: listText(s.filters.map(filterText), "The loop has no filters."),
    order: listText(s.order.map(orderText), "The loop has no order."),
    call: call ? `The loop calls ${call.name}.` : "The loop has no API call yet.",
    variables: listText(
      Object.entries(r.values).map(([name, value]) => `${name} = ${quoted(value)}`),
      "The loop sends the variables' defaults."
    ),
    list: callPath
      ? `The loop reads the list at ${callPath.name} (${callPath.path}).`
      : "The loop reads the whole response.",
    source: `The loop reads ${LOCAL_LOOP_KIND_LABELS[l.kind]}.`,
    variable: l.variable ? `The loop reads ${l.variable}.` : "The loop has no variable yet.",
    parentLoop: l.parentLoop
      ? `The loop reads %${l.parentLoop}.`
      : "The loop has no parent loop yet.",
    field: `The loop reads the field ${quoted(l.field)}.`,
    json: l.json ? "The loop has its own static JSON." : "The loop has no static JSON yet.",
    expression: `The loop uses ${quoted(l.expression)}.`,
    offset: `The loop skips ${l.offset} rows.`
  };

  return (key: string): string | undefined => {
    const [kind, id = "", part] = key.split(":");
    if (kind === "filter") return filterTip(id, part as "column" | "operator" | "value");
    if (kind === "order") return orderTip(id);
    if (kind === "var") {
      const value = r.values[id];
      return `${value === undefined ? "The loop sends the default." : `The loop sends ${quoted(value)}.`} ${FILLED}`;
    }
    return tips[key];
  };
}
