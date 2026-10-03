import type { CatalogCache, FreeModelDescriptor, FreeModelSnapshot, FreeModelSource } from "./types.js";

export const CLINE_RECOMMENDED_MODELS_URL = "https://api.cline.bot/api/v1/ai/cline/recommended-models";

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/**
 * Fallback source that reads the same official live feed used for Cline's featured tiers.
 * In an upstream Cline integration prefer HostFreeModelSource so Cline itself remains the
 * source of truth and this HTTP source is only a fallback.
 */
export class ClineLiveFreeModelSource implements FreeModelSource {
  constructor(
    private readonly fetchFn: FetchLike = fetch,
    private readonly endpoint = CLINE_RECOMMENDED_MODELS_URL,
    private readonly now: () => number = Date.now,
  ) {}

  async load(): Promise<FreeModelSnapshot> {
    const response = await this.fetchFn(this.endpoint, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(7_500),
    });
    if (!response.ok) throw new Error(`Cline free-model feed failed with HTTP ${response.status}`);
    const payload = await response.json() as { free?: unknown };
    if (!Array.isArray(payload.free)) throw new Error("Cline free-model feed did not contain a free array");
    return {
      fetchedAt: this.now(),
      source: this.endpoint,
      models: payload.free.map(parseModel),
    };
  }
}

/** Preferred integration path: bind this loader to Cline's own @cline/llms featured/free
 * model list. This avoids maintaining a second interpretation of the catalog. */
export class HostFreeModelSource implements FreeModelSource {
  constructor(
    private readonly loader: () => Promise<FreeModelDescriptor[]>,
    private readonly now: () => number = Date.now,
    private readonly sourceName = "cline-host-catalog",
  ) {}

  async load(): Promise<FreeModelSnapshot> {
    const models = await this.loader();
    return {
      fetchedAt: this.now(),
      source: this.sourceName,
      models: models.map((model) => ({ ...model, tags: [...model.tags] })),
    };
  }
}

export class MemoryCatalogCache implements CatalogCache {
  private snapshot?: FreeModelSnapshot;
  async load(): Promise<FreeModelSnapshot | undefined> {
    return this.snapshot ? structuredClone(this.snapshot) : undefined;
  }
  async save(snapshot: FreeModelSnapshot): Promise<void> {
    this.snapshot = structuredClone(snapshot);
  }
}

/** Host source first, official live feed second, last-known cache third. */
export class ClineFreeModelCatalog {
  constructor(
    private readonly sources: FreeModelSource[],
    private readonly cache: CatalogCache = new MemoryCatalogCache(),
  ) {
    if (sources.length === 0) throw new Error("At least one free-model source is required");
  }

  async refresh(): Promise<FreeModelSnapshot> {
    const failures: string[] = [];
    for (const source of this.sources) {
      try {
        const snapshot = await source.load();
        const normalized = normalizeSnapshot(snapshot);
        await this.cache.save(normalized);
        return normalized;
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
    const cached = await this.cache.load();
    if (cached) return cached;
    throw new Error(`All Cline free-model catalog sources failed: ${failures.join(" | ")}`);
  }
}

function parseModel(value: unknown): FreeModelDescriptor {
  if (!value || typeof value !== "object") throw new Error("Invalid free model entry");
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) throw new Error("Free model entry is missing id");
  return {
    id: row.id,
    name: typeof row.name === "string" && row.name ? row.name : row.id,
    description: typeof row.description === "string" ? row.description : undefined,
    tags: Array.isArray(row.tags) ? row.tags.filter((item): item is string => typeof item === "string") : [],
  };
}

function normalizeSnapshot(snapshot: FreeModelSnapshot): FreeModelSnapshot {
  const seen = new Set<string>();
  const models = snapshot.models.filter((model) => {
    if (seen.has(model.id)) return false;
    seen.add(model.id);
    return true;
  });
  return { ...snapshot, models };
}
