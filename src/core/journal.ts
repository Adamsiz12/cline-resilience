import type { AttemptEvent, AttemptJournal } from "./types.js";

export class MemoryAttemptJournal implements AttemptJournal {
  readonly events: AttemptEvent[] = [];
  record(event: AttemptEvent): void {
    this.events.push({ ...event });
  }
}

/**
 * Host-neutral bridge for writing sanitized attempt events to a file, output channel,
 * telemetry sink, or sidecar-owned journal without coupling the core to Node/VS Code/Tauri.
 */
export class CallbackAttemptJournal implements AttemptJournal {
  constructor(private readonly writer: (event: AttemptEvent) => Promise<void> | void) {}
  record(event: AttemptEvent): Promise<void> | void {
    return this.writer({ ...event });
  }
}
