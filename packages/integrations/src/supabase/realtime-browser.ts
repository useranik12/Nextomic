import { RealtimeClient } from "@supabase/realtime-js";

// Browser side of realtime query loops (docs/dynamic-data-and-actions.md section 3): a page with a
// realtime loop receives the project's Supabase URL and anon key (owner decision 2026-11-08: the
// anon key is public by Supabase's design; RLS and the Realtime publication decide what streams)
// and listens for row changes. Only this entry may be loaded in a browser.

export interface RealtimeTable {
  schema: string;
  table: string;
}

export interface RealtimeConnection {
  url: string;
  anonKey: string;
}

/** Calls `onChange` when a row of one of the tables is inserted, updated or deleted. */
export function watchTables(
  connection: RealtimeConnection,
  tables: readonly RealtimeTable[],
  onChange: (table: RealtimeTable) => void
): () => void {
  const endpoint = `${connection.url.replace(/^http/i, "ws").replace(/\/+$/, "")}/realtime/v1`;
  const client = new RealtimeClient(endpoint, { params: { apikey: connection.anonKey } });
  const channels = tables.map((target) =>
    client
      .channel(`nx:${target.schema}:${target.table}`)
      .on("postgres_changes", { event: "*", schema: target.schema, table: target.table }, () =>
        onChange(target)
      )
      .subscribe()
  );
  return () => {
    for (const channel of channels) void client.removeChannel(channel);
    void client.disconnect();
  };
}
