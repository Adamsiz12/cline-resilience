import type { FreeModelSnapshot } from "../catalog/types.js";
import { buildFreeModelChoices, type ModelChoice, type RateLimitAction, type UserRoutingSettings } from "./types.js";

export interface RateLimitActionChoice {
  id: RateLimitAction;
  label: string;
  description: string;
}

export const RATE_LIMIT_ACTION_CHOICES: readonly RateLimitActionChoice[] = [
  {
    id: "SWITCH_ACCOUNT_KEEP_MODEL",
    label: "Switch account, keep the same model",
    description: "Keep the selected model pinned and continue only through another authorized account/credential route.",
  },
  {
    id: "SWITCH_MODEL_KEEP_ACCOUNT",
    label: "Switch model, keep the current account",
    description: "Stay on the current account/credential and continue with another available model route.",
  },
] as const;

export interface RoutingSettingsViewModel {
  selectedModelId?: string;
  modelChoices: ModelChoice[];
  rateLimitAction: RateLimitAction;
  rateLimitActionChoices: readonly RateLimitActionChoice[];
}

export function buildRoutingSettingsViewModel(
  snapshot: FreeModelSnapshot,
  settings: UserRoutingSettings,
): RoutingSettingsViewModel {
  return {
    selectedModelId: settings.selectedModelId,
    modelChoices: buildFreeModelChoices(snapshot),
    rateLimitAction: settings.rateLimitAction,
    rateLimitActionChoices: RATE_LIMIT_ACTION_CHOICES,
  };
}
