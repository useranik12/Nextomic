// Every connector failure reaches callers in one shape. Upstream stack traces, raw bodies and
// secrets never travel in it.

export type ConnectorErrorCode =
  | "invalid_request"
  | "invalid_config"
  | "blocked_host"
  | "timeout"
  | "too_large"
  | "bad_content_type"
  | "too_many_redirects"
  | "network"
  | "upstream"
  | "rate_limited"
  | "not_found"
  | "decrypt_failed"
  | "internal";

export interface NormalizedError {
  code: ConnectorErrorCode;
  message: string;
  status?: number;
  details?: Record<string, string | number | boolean>;
}

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  readonly status?: number;
  readonly details?: NormalizedError["details"];

  constructor(
    code: ConnectorErrorCode,
    message: string,
    extra: Omit<NormalizedError, "code" | "message"> = {}
  ) {
    super(message);
    this.name = "ConnectorError";
    this.code = code;
    this.status = extra.status;
    this.details = extra.details;
  }

  toJSON(): NormalizedError {
    return {
      code: this.code,
      message: this.message,
      ...(this.status === undefined ? {} : { status: this.status }),
      ...(this.details === undefined ? {} : { details: this.details })
    };
  }
}

/** Turns anything thrown during a connector call into the safe shape. Unknown errors say nothing. */
export function normalizeError(error: unknown): NormalizedError {
  if (error instanceof ConnectorError) return error.toJSON();
  if (error instanceof Error && error.name === "AbortError")
    return { code: "timeout", message: "The request was cancelled or took too long." };
  return { code: "internal", message: "The connector call failed." };
}
