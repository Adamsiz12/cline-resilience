export class HttpError extends Error {
  readonly status: number;
  readonly body?: unknown;
  readonly headers: Record<string, string>;

  constructor(status: number, message: string, options?: { body?: unknown; headers?: Record<string, string> }) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.body = options?.body;
    this.headers = normalizeHeaders(options?.headers ?? {});
  }
}

export class TimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class NetworkError extends Error {
  constructor(message = "Network failure") {
    super(message);
    this.name = "NetworkError";
  }
}

export class UnsafeReplayError extends Error {
  constructor(message = "The response stream already started; automatic replay is disabled.", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UnsafeReplayError";
  }
}

function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) out[key.toLowerCase()] = value;
  return out;
}
