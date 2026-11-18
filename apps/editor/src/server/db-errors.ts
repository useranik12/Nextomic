/** Postgres error code for a unique constraint violation. */
const UNIQUE_VIOLATION = "23505";

/**
 * True when the error is (or wraps) a Postgres unique violation. Drizzle wraps the driver error
 * and keeps it on `cause`, so the code can sit one or more levels down.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth += 1) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
