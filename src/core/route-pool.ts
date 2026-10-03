import type { ProviderPolicyCapabilities, UserRoutingSettings } from "../settings/types.js";
import { canFallback, validateRoutes } from "./policy.js";
import type { ErrorClassification, RouteDefinition, RouteRuntime } from "./types.js";

export class RoutePool {
  private readonly routes: RouteRuntime[];

  constructor(definitions: RouteDefinition[], private readonly now: () => number = Date.now) {
    this.routes = definitions
      .map((route) => ({
        ...route,
        enabled: route.enabled ?? true,
        state: (route.enabled ?? true) ? "AVAILABLE" as const : "DISABLED" as const,
        failures: 0,
      }))
      .sort((a, b) => a.priority - b.priority);
    validateRoutes(this.routes);
  }

  snapshot(): ReadonlyArray<RouteRuntime> {
    this.refreshCooldowns();
    return this.routes.map((route) => ({ ...route }));
  }

  firstAvailable(settings?: UserRoutingSettings): RouteRuntime | undefined {
    this.refreshCooldowns();
    const available = this.routes.filter((route) => route.enabled && route.state === "AVAILABLE");
    if (!settings?.selectedModelId) return available[0];

    const selected = available.find((route) => route.model === settings.selectedModelId);
    if (selected) return selected;

    // In same-model mode, do not silently substitute another model at task start.
    if (settings.rateLimitAction === "SWITCH_ACCOUNT_KEEP_MODEL") return undefined;
    return available[0];
  }

  fallbackCandidates(
    from: RouteRuntime,
    error: ErrorClassification,
    settings?: UserRoutingSettings,
    capabilities?: ProviderPolicyCapabilities,
  ): RouteRuntime[] {
    this.refreshCooldowns();
    return this.routes.filter((route) => {
      if (route.id === from.id || route.state !== "AVAILABLE") return false;
      return canFallback(from, route, error, settings, capabilities).allowed;
    });
  }

  markActive(routeId: string): RouteRuntime {
    const route = this.mustGet(routeId);
    route.state = "ACTIVE";
    return route;
  }

  markAvailable(routeId: string): void {
    const route = this.mustGet(routeId);
    if (route.enabled) route.state = "AVAILABLE";
  }

  markFailure(routeId: string, error: ErrorClassification): void {
    const route = this.mustGet(routeId);
    route.failures += 1;
    route.lastErrorKind = error.kind;

    if (error.kind === "AUTH") {
      route.state = "AUTH_REQUIRED";
      return;
    }

    if (error.resetAt && error.resetAt > this.now()) {
      route.cooldownUntil = error.resetAt;
      route.state = "COOLDOWN";
      return;
    }

    if (error.kind === "FORBIDDEN") {
      route.state = "UNHEALTHY";
      return;
    }

    route.state = route.enabled ? "AVAILABLE" : "DISABLED";
  }

  disable(routeId: string): void {
    const route = this.mustGet(routeId);
    route.enabled = false;
    route.state = "DISABLED";
  }

  private refreshCooldowns(): void {
    const now = this.now();
    for (const route of this.routes) {
      if (route.state === "COOLDOWN" && route.cooldownUntil != null && route.cooldownUntil <= now) {
        route.cooldownUntil = undefined;
        route.state = route.enabled ? "AVAILABLE" : "DISABLED";
      }
    }
  }

  private mustGet(routeId: string): RouteRuntime {
    const route = this.routes.find((candidate) => candidate.id === routeId);
    if (!route) throw new Error(`Unknown route: ${routeId}`);
    return route;
  }
}
