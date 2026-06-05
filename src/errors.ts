export class CliError extends Error {
  code: string;
  hint?: string;
  status?: number;
  details?: unknown;

  constructor(
    code: string,
    message: string,
    options: { hint?: string; status?: number; details?: unknown } = {},
  ) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.hint = options.hint;
    this.status = options.status;
    this.details = options.details;
  }
}

export function errorToPayload(error: unknown): Record<string, unknown> {
  if (error instanceof CliError) {
    return {
      ok: false,
      error: error.code,
      message: error.message,
      ...(error.hint ? { hint: error.hint } : {}),
      ...(error.status ? { status: error.status } : {}),
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: "internal_error",
      message: error.message,
    };
  }

  return {
    ok: false,
    error: "internal_error",
    message: String(error),
  };
}
