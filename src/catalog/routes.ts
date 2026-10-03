import type { RouteDefinition, RouteInvoker } from "../core/index.js";
import type { FreeModelSnapshot } from "./types.js";

export type FreeModelInvokerFactory = (modelId: string) => RouteInvoker;

export interface FreeModelRouteOptions {
  providerId?: string;
  priorityStart?: number;
  enabled?: (modelId: string) => boolean;
  /** Identity of the current Cline account/credential backing these routes. */
  accountId?: string;
  accountLabel?: string;
}

/**
 * Converts whatever is currently in Cline's official `free` tier into routes. The caller
 * supplies the invoker factory, which in production should call Cline's own provider runtime.
 * This is deliberately feed-driven: no model names or `cline-free/` prefix assumptions.
 */
export function buildClineFreeRoutes(
  snapshot: FreeModelSnapshot,
  createInvoker: FreeModelInvokerFactory,
  options: FreeModelRouteOptions = {},
): RouteDefinition[] {
  const providerId = options.providerId ?? "cline";
  const priorityStart = options.priorityStart ?? 100;
  return snapshot.models.map((model, index) => ({
    id: `cline-free-route:${options.accountId ?? "current"}:${model.id}`,
    label: `${model.name} (Cline Free${options.accountLabel ? ` / ${options.accountLabel}` : ""})`,
    providerId,
    model: model.id,
    accountId: options.accountId,
    accountLabel: options.accountLabel,
    usageClass: "promotional" as const,
    priority: priorityStart + index,
    enabled: options.enabled?.(model.id) ?? true,
    invoke: createInvoker(model.id),
  }));
}
