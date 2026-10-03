import type {
  ClineHostCatalogLike,
  ClineModelRuntimeLike,
  ClineProviderConfigStoreLike,
  ClineProviderSettingsManagerLike,
} from "./types.js";
import type { ClineSessionLifecycleLike } from "./live-session-bridge.js";

export interface ClineHostBindings {
  providerSettingsManager: ClineProviderSettingsManagerLike;
  providerConfigStore: ClineProviderConfigStoreLike;
  catalog: ClineHostCatalogLike;
  runtime: ClineModelRuntimeLike;
  /** Optional in old hosts; required when session-preserving live switching is enabled. */
  sessionLifecycle?: ClineSessionLifecycleLike;
}

export interface CompatibilityReport {
  compatible: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
}

/**
 * Runtime drift detector. It is intentionally structural rather than version-only:
 * a newer Cline build can still be accepted when the required surfaces remain intact.
 * If a critical surface disappears we fail closed instead of guessing.
 */
export function verifyClineHostCompatibility(bindings: Partial<ClineHostBindings>): CompatibilityReport {
  const checks = [
    checkFunction("ProviderSettingsManager.getProviderSettings", bindings.providerSettingsManager?.getProviderSettings),
    checkFunction("ProviderConfigStore.readSelection", bindings.providerConfigStore?.readSelection),
    checkFunction("ProviderConfigStore.commitSelection", bindings.providerConfigStore?.commitSelection),
    checkFunction("Host catalog listModels", bindings.catalog?.listModels),
    checkFunction("Model runtime invoke", bindings.runtime?.invoke),
    ...(bindings.sessionLifecycle
      ? [
          checkFunction("SdkSessionLifecycle.getActiveSession", bindings.sessionLifecycle.getActiveSession),
          checkFunction("SdkSessionLifecycle.updateActiveSessionModel", bindings.sessionLifecycle.updateActiveSessionModel),
        ]
      : []),
  ];
  return { compatible: checks.every((check) => check.ok), checks };
}

export function assertClineHostCompatible(bindings: Partial<ClineHostBindings>): asserts bindings is ClineHostBindings {
  const report = verifyClineHostCompatibility(bindings);
  if (!report.compatible) {
    const missing = report.checks.filter((check) => !check.ok).map((check) => check.name).join(", ");
    throw new Error(`Cline upstream integration is incompatible; missing/changed surfaces: ${missing}`);
  }
}

function checkFunction(name: string, value: unknown) {
  const ok = typeof value === "function";
  return { name, ok, detail: ok ? "available" : "missing or not callable" };
}
