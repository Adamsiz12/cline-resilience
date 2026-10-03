import {
  ClineFreeModelCatalog,
  ClineLiveFreeModelSource,
  HostFreeModelSource,
  MemoryCatalogCache,
} from "../../catalog/index.js";
import type { FreeModelDescriptor } from "../../catalog/index.js";
import type { ClineHostCatalogLike } from "./types.js";

/**
 * Cline-host catalog is authoritative. The public Cline feed is only a fallback,
 * matching the project's rule that model additions/removals should flow from Cline.
 */
export function createClineUpstreamFreeCatalog(host: ClineHostCatalogLike, providerId = "cline"): ClineFreeModelCatalog {
  const hostSource = new HostFreeModelSource(async () => {
    const models = await host.listModels(providerId);
    return models.map<FreeModelDescriptor>((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      description: model.description,
      tags: [...(model.tags ?? [])],
    }));
  }, Date.now, `cline-host:${providerId}`);

  return new ClineFreeModelCatalog(
    [hostSource, new ClineLiveFreeModelSource()],
    new MemoryCatalogCache(),
  );
}
