# Cline upstream integration — v0.5

Observed and verified on **2026-10-03**.

## Pinned surfaces

| Surface | Pin | Short SHA |
|---|---|---|
| VS Code extension | `v4.1.22` | `f58bc11` |
| Desktop | `desktop-v0.0.43` | `476b165` |
| SDK | `sdk/sdk/v0.0.90` | `a7ad50b` |

Pins are recorded in `src/integration/cline-upstream/pins.ts`. Compatibility is structural as well as
version-aware: if a newer host retains the required surfaces, it can be accepted; if a required seam
is missing, integration fails closed.

## Authentication / account identity

`apps/vscode/src/sdk/auth-service.ts` uses `ProviderSettingsManager` / `providers.json` as the
credential source of truth. `ClineAuthIdentityBridge` reads only provider/account identity and never
copies access/refresh tokens into routing settings, continuity state or attempt logs.

## Persisted model selection

`apps/vscode/src/sdk/model-catalog/store.ts` exposes `readSelection` and `commitSelection`.
`ClineModelSelectionBridge` uses this store to synchronize Cline UI/default selection with the route
that resilience intends to invoke.

This is **not** the only live-session mechanism anymore.

## Live active-session model switch — preferred seam

Current VS Code Cline exposes the stronger active-session seam in
`apps/vscode/src/sdk/sdk-session-lifecycle.ts`:

```text
getActiveSession()
updateActiveSessionModel(modelId)
        ↓
sdkHost.updateSessionModel(activeSession.sessionId, modelId)
```

`ClineLiveSessionModelBridge` uses this seam and checks:

1. an active session exists;
2. the host does not report the turn as currently running;
3. `updateActiveSessionModel` is supported;
4. the active `sessionId` after switching is exactly the same as before.

Any failure aborts automatic handoff. This makes the active session, history/checkpoints and persisted
messages artifact the identity anchor rather than merely changing provider defaults.

## Model catalog

Cline host catalog remains primary. The official Cline featured Free feed is fallback, then last-known
cache. Runtime Free membership is never inferred from a model ID prefix.

## Session continuity

The canonical replay/export artifact is:

```text
~/.cline/data/sessions/<sessionId>/<sessionId>.messages.json
```

Contract v1 stores provider/model information, terminal turn metrics and Anthropic-native `tool_use` /
`tool_result` blocks. `inspectClineMessagesV1()` detects unresolved tool calls and whether the last
assistant turn reached a terminal state.

A `tool_use` without matching `tool_result` is an incomplete boundary. The continuation capsule marks
that verification FAIL and the next route must inspect/reconcile repository/tool state before doing
new work.

## Desktop binding

The current Desktop example uses a Tauri shell, Bun sidecar backend, Next.js webview and canonical
shared Cline Hub. Resilience belongs in the sidecar/shared-Hub boundary. The browser UI receives only
redacted model/account/status information and never reads credentials directly.

## Source checkout verification

Before mounting the overlay onto a Cline checkout:

```bash
npm run verify:cline-checkout -- C:\\src\\cline
```

The verifier checks current structural anchors:

- VS Code `SdkSessionLifecycle.getActiveSession`
- `updateActiveSessionModel(modelId)` -> `sdkHost.updateSessionModel(activeSession.sessionId, modelId)`
- ProviderConfigStore `readSelection` / `commitSelection`
- ProviderSettingsManager + account identity
- messages-contract-v1 tool boundary contract
- Desktop Tauri + Bun sidecar + shared Hub architecture marker

If one drifts, do not silently continue. Update the adapter and tests first.

## Practical validation completed here

A clean build passed **32/32 tests**. The executable smoke preserved session
`smoke-session-001` across a same-model switch. An intentionally unresolved
`apply_patch:tool-smoke-1` was detected as incomplete and marked FAIL by the recovery gate.

The environment cannot launch/authenticate the user's GUI Cline installation, so the final live-host
step remains a Windows-machine E2E rather than a cloud-account test performed here.
