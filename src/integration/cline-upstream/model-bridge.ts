import type { RouteDefinition } from "../../core/index.js";
import type {
  ClineAccountIdentity,
  ClineMode,
  ClineModelRuntimeLike,
  ClineProviderConfigStoreLike,
  ClineRouteSpec,
} from "./types.js";

/**
 * Bridges resilience routes to Cline's real ProviderConfigStore model selection.
 * Before each attempt the selected model is committed through Cline's store, so the
 * host UI/state and the actual model invocation cannot silently drift apart.
 */
export class ClineModelSelectionBridge {
  constructor(
    private readonly configStore: ClineProviderConfigStoreLike,
    private readonly runtime: ClineModelRuntimeLike,
    private readonly mode: ClineMode = "act",
  ) {}

  current(providerId: string) {
    return this.configStore.readSelection(providerId, this.mode);
  }

  async commit(providerId: string, modelId: string, modelInfo?: Record<string, unknown>): Promise<void> {
    await this.configStore.commitSelection(
      providerId,
      this.mode,
      { providerId, modelId },
      modelInfo,
    );
  }

  route(spec: ClineRouteSpec, account: ClineAccountIdentity, modelInfo?: Record<string, unknown>): RouteDefinition {
    const routeId = `cline-upstream:${spec.providerId}:${account.accountId ?? "current"}:${spec.modelId}`;
    return {
      id: routeId,
      label: spec.label ?? `${spec.modelId}${account.accountLabel ? ` / ${account.accountLabel}` : ""}`,
      providerId: spec.providerId,
      model: spec.modelId,
      accountId: account.accountId,
      accountLabel: account.accountLabel,
      usageClass: spec.usageClass,
      priority: spec.priority,
      enabled: spec.enabled ?? true,
      invoke: async (request, context) => {
        const selected = this.current(spec.providerId);
        if (selected?.modelId !== spec.modelId) {
          await this.commit(spec.providerId, spec.modelId, modelInfo);
        }
        return this.runtime.invoke({
          providerId: spec.providerId,
          modelId: spec.modelId,
          request: { ...request, model: spec.modelId },
          context,
        });
      },
    };
  }
}
