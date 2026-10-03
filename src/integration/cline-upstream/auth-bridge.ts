import type {
  ClineAccountIdentity,
  ClineProviderSettingsManagerLike,
} from "./types.js";

/** Reads the current Cline account identity through the same providers.json-backed
 * settings manager used by the VS Code SDK auth service. It deliberately never
 * copies refresh/access tokens into resilience state. */
export class ClineAuthIdentityBridge {
  constructor(
    private readonly settings: ClineProviderSettingsManagerLike,
    private readonly providerId = "cline",
  ) {}

  current(): ClineAccountIdentity {
    const provider = this.settings.getProviderSettings(this.providerId);
    const accountId = provider?.auth?.accountId?.trim() || undefined;
    return {
      providerId: this.providerId,
      accountId,
      accountLabel: accountId ? `Cline ${shortAccount(accountId)}` : undefined,
      authenticated: Boolean(provider?.auth?.accessToken),
    };
  }
}

function shortAccount(value: string): string {
  return value.length <= 10 ? value : `${value.slice(0, 4)}…${value.slice(-4)}`;
}
