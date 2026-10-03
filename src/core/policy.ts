import type { ProviderPolicyCapabilities, UserRoutingSettings } from "../settings/types.js";
import type { ErrorClassification, RouteRuntime } from "./types.js";

export interface RoutingPolicyDecision {
  allowed: boolean;
  reason?: string;
}

function isRateLimit(error: ErrorClassification): boolean {
  return error.kind === "PROMOTIONAL_QUOTA" || error.kind === "TEMPORARY_RATE_LIMIT";
}

function sameAccount(from: RouteRuntime, to: RouteRuntime): boolean {
  if (from.accountId != null || to.accountId != null) return from.accountId === to.accountId;
  return from.providerId === to.providerId;
}

/**
 * Policy boundary:
 * - User settings decide whether a rate-limit fallback keeps the model or keeps the account.
 * - A host/provider capability gate is still required for promotional->promotional transitions.
 * - Without explicit routing settings, legacy behavior remains: promotional quota may fall back
 *   to BYOK/paid/org/local, but not automatically into another promotional route.
 */
export function canFallback(
  from: RouteRuntime,
  to: RouteRuntime,
  error: ErrorClassification,
  routingSettings?: UserRoutingSettings,
  capabilities: ProviderPolicyCapabilities = {},
): RoutingPolicyDecision {
  if (!to.enabled || to.state === "DISABLED" || to.state === "AUTH_REQUIRED") {
    return { allowed: false, reason: "target route is disabled or needs authentication" };
  }

  const promoToPromo = from.usageClass === "promotional" && to.usageClass === "promotional";

  if (routingSettings && isRateLimit(error)) {
    if (routingSettings.rateLimitAction === "SWITCH_ACCOUNT_KEEP_MODEL") {
      if (to.model !== from.model) {
        return { allowed: false, reason: "user selected same-model account switching" };
      }
      if (!from.accountId || !to.accountId || from.accountId === to.accountId) {
        return { allowed: false, reason: "same-model account switching requires a different accountId" };
      }
      if (promoToPromo && !capabilities.allowPromotionalAccountSwitch) {
        return { allowed: false, reason: "provider host has not authorized promotional account switching" };
      }
      return { allowed: true };
    }

    if (routingSettings.rateLimitAction === "SWITCH_MODEL_KEEP_ACCOUNT") {
      if (to.model === from.model) {
        return { allowed: false, reason: "user selected model switching, not same-model replay on another route" };
      }
      if (!sameAccount(from, to)) {
        return { allowed: false, reason: "user selected model switching on the current account" };
      }
      if (promoToPromo && !capabilities.allowPromotionalModelSwitch) {
        return { allowed: false, reason: "provider host has not authorized promotional model switching" };
      }
      return { allowed: true };
    }
  }

  if (error.kind === "PROMOTIONAL_QUOTA" && promoToPromo) {
    return {
      allowed: false,
      reason: "automatic promotional-quota aggregation is blocked unless the host explicitly authorizes it",
    };
  }

  return { allowed: true };
}

export function validateRoutes(routes: RouteRuntime[]): void {
  const ids = new Set<string>();
  for (const route of routes) {
    if (ids.has(route.id)) throw new Error(`Duplicate route id: ${route.id}`);
    ids.add(route.id);
  }
}
