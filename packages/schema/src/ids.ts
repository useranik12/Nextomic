import { z } from "zod";

// Row ids are native Postgres `uuid` values (gen_random_uuid(), as Supabase does). Postgres refuses
// any other text for a uuid column with an error, so an id from a URL or a request body is checked
// here first and a bad one is "not found", never a server error.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for the textual form Postgres accepts for a uuid (any version, any case). */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export const uuidSchema = z.string().regex(UUID_PATTERN, "Not found.");
