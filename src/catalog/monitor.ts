import type { FreeModelSnapshot } from "./types.js";
import { ClineFreeModelCatalog } from "./cline-free-catalog.js";

export type FreeModelCatalogChanged = (snapshot: FreeModelSnapshot) => Promise<void> | void;

/**
 * Small refresh controller for hosts that do not already expose a catalog-change event.
 * Production Cline integration should also call refreshOnce() when Cline refreshes/opens its
 * model picker. Polling is a safety net, not a replacement for the host catalog bridge.
 */
export class FreeModelCatalogMonitor {
  private timer?: ReturnType<typeof setInterval>;
  private lastSignature?: string;

  constructor(
    private readonly catalog: ClineFreeModelCatalog,
    private readonly onChanged: FreeModelCatalogChanged,
  ) {}

  async refreshOnce(): Promise<FreeModelSnapshot> {
    const snapshot = await this.catalog.refresh();
    const signature = snapshot.models.map((model) => model.id).sort().join("\n");
    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      await this.onChanged(snapshot);
    }
    return snapshot;
  }

  start(intervalMs = 10 * 60 * 1000): void {
    if (this.timer) return;
    void this.refreshOnce();
    this.timer = setInterval(() => void this.refreshOnce(), Math.max(30_000, intervalMs));
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }
}
