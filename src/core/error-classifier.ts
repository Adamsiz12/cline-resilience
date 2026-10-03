import { HttpError, NetworkError, TimeoutError } from "./errors.js";
import { parseResetFromMessage, parseRetryAfter } from "./reset-time.js";
import type { ErrorClassification } from "./types.js";

const PROMO_PATTERNS = [
  /daily\s+free\s+limit/i,
  /free\s+(?:model\s+)?quota/i,
  /promotional\s+quota/i,
  /daily\s+promotional\s+limit/i,
];

export function classifyError(error: unknown, now = Date.now()): ErrorClassification {
  if (error instanceof TimeoutError) {
    return {
      kind: "TIMEOUT",
      retryable: true,
      retrySameRoute: true,
      fallbackAllowed: true,
      reason: error.message,
    };
  }

  if (error instanceof NetworkError) {
    return {
      kind: "NETWORK",
      retryable: true,
      retrySameRoute: true,
      fallbackAllowed: true,
      reason: error.message,
    };
  }

  if (error instanceof HttpError) {
    const message = `${error.message} ${stringifyBody(error.body)}`.trim();
    const resetFromBody = parseResetFromMessage(message, now);
    const resetFromHeader = parseRetryAfter(error.headers["retry-after"], now);
    const resetAt = resetFromBody ?? resetFromHeader;

    if (error.status === 429 && PROMO_PATTERNS.some((pattern) => pattern.test(message))) {
      return {
        kind: "PROMOTIONAL_QUOTA",
        retryable: false,
        retrySameRoute: false,
        fallbackAllowed: true,
        resetAt,
        cooldownMs: resetAt ? Math.max(0, resetAt - now) : undefined,
        status: error.status,
        reason: message,
      };
    }

    if (error.status === 429) {
      return {
        kind: "TEMPORARY_RATE_LIMIT",
        retryable: true,
        retrySameRoute: true,
        fallbackAllowed: true,
        resetAt,
        cooldownMs: resetAt ? Math.max(0, resetAt - now) : undefined,
        status: error.status,
        reason: message,
      };
    }

    if (error.status === 401) {
      return {
        kind: "AUTH",
        retryable: false,
        retrySameRoute: false,
        fallbackAllowed: false,
        status: error.status,
        reason: message,
      };
    }

    if (error.status === 403) {
      return {
        kind: "FORBIDDEN",
        retryable: false,
        retrySameRoute: false,
        fallbackAllowed: false,
        status: error.status,
        reason: message,
      };
    }

    if (error.status >= 500) {
      return {
        kind: "SERVER",
        retryable: true,
        retrySameRoute: true,
        fallbackAllowed: true,
        status: error.status,
        reason: message,
      };
    }
  }

  return {
    kind: "UNKNOWN",
    retryable: false,
    retrySameRoute: false,
    fallbackAllowed: false,
    reason: error instanceof Error ? error.message : String(error),
  };
}

function stringifyBody(body: unknown): string {
  if (body == null) return "";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}
