import type { FreeModelSnapshot } from "../catalog/types.js";

/** What should happen after a rate-limit/quota condition prevents the current route from continuing. */
export type RateLimitAction =
  | "SWITCH_ACCOUNT_KEEP_MODEL"
  | "SWITCH_MODEL_KEEP_ACCOUNT";

export interface UserRoutingSettings {
  /** User-selected primary model. When set, this model is preferred for the first attempt. */
  selectedModelId?: string;
  /** User-selected behavior after rate limit/quota exhaustion. */
  rateLimitAction: RateLimitAction;
}

/**
 * Provider-side capability gates. User preference alone is never enough to bypass
 * a provider's own allowed surfaces or quota policy. Host adapters must set these
 * only when the upstream/provider explicitly permits the behavior.
 */
export interface ProviderPolicyCapabilities {
  allowPromotionalAccountSwitch?: boolean;
  allowPromotionalModelSwitch?: boolean;
}

export interface ModelChoice {
  id: string;
  label: string;
  description?: string;
  tags: string[];
}

export const DEFAULT_USER_ROUTING_SETTINGS: UserRoutingSettings = {
  rateLimitAction: "SWITCH_MODEL_KEEP_ACCOUNT",
};

export function buildFreeModelChoices(snapshot: FreeModelSnapshot): ModelChoice[] {
  return snapshot.models.map((model) => ({
    id: model.id,
    label: model.name || model.id,
    description: model.description,
    tags: [...model.tags],
  }));
}
