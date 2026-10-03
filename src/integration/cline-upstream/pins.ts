export interface ClineUpstreamPin {
  observedAt: string;
  vscode: { tag: string; shortSha: string };
  desktop: { tag: string; shortSha: string };
  sdk: { tag: string; shortSha: string; version: string };
  integrationFiles: string[];
}

/**
 * Verified public Cline surfaces used while building v0.4.0.
 * Pinning these prevents silent drift when upstream changes its internal host glue.
 */
export const CLINE_UPSTREAM_PIN: ClineUpstreamPin = {
  observedAt: "2026-10-03",
  vscode: { tag: "v4.1.22", shortSha: "f58bc11" },
  desktop: { tag: "desktop-v0.0.43", shortSha: "476b165" },
  sdk: { tag: "sdk/sdk/v0.0.90", shortSha: "a7ad50b", version: "0.0.90" },
  integrationFiles: [
    "apps/vscode/src/sdk/auth-service.ts",
    "apps/vscode/src/sdk/model-catalog/store.ts",
    "sdk/packages/core/src/services/storage/provider-settings-manager.ts",
    "sdk/packages/core/src/services/providers/local-provider-service.ts",
    "sdk/packages/core/docs/messages-contract-v1.md",
    "apps/examples/desktop-app/sidecar/chat-session.ts",
    "apps/examples/desktop-app/webview/lib/desktop-client.ts",
  ],
};
