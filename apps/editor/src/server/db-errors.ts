/** Postgres error code for a unique constraint violation. */
const UNIQUE_VIOLATION = "23505";
/** Postgres error code for text that is not a valid value of the column type (a bad uuid). */
const INVALID_TEXT = "22P02";

/**
 * True when the error is (or wraps) a Postgres error with this code. Drizzle wraps the driver error
 * and keeps it on `cause`, so the code can sit one or more levels down.
 */
function hasCode(error: unknown, code: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === "object" && current !== null; depth += 1) {
    if ((current as { code?: unknown }).code === code) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** True when the error is (or wraps) a Postgres unique violation. */
export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, UNIQUE_VIOLATION);
}

/** True when a query was refused because an id was not a valid uuid: the thing asked for does not exist. */
export function isInvalidId(error: unknown): boolean {
  return hasCode(error, INVALID_TEXT);
}
