const DURATION_RE = /try\s+again\s+in\s+(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s\s*)?/i;

export function parseResetFromMessage(message: string, now = Date.now()): number | undefined {
  const match = message.match(DURATION_RE);
  if (!match) return undefined;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const ms = (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
  return ms > 0 ? now + ms : undefined;
}

export function parseRetryAfter(value: string | undefined, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return now + seconds * 1000;

  const date = Date.parse(value);
  return Number.isFinite(date) && date > now ? date : undefined;
}
