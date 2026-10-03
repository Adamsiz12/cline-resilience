# Cline integration map

## Verified upstream shape (October 2026)

The current Cline repository documents these package responsibilities:

| Cline package | Responsibility | Resilience integration implication |
|---|---|---|
| `@cline/llms` | provider settings, model catalog, handler creation | closest place to provider invocation / HTTP error normalization |
| `@cline/agents` | stateless agent loop, tools, streaming | first-output boundary must remain visible here or below it |
| `@cline/core` | stateful runtime, sessions, persistence, hub/RPC | task/session identity should stay unchanged during provider fallback |
| VS Code host | extension/webview/RPC client | status, commands, secret storage adapter |
| Desktop host | Tauri + Bun sidecar + web UI | status panel, sidecar secret/provider adapter |

Sources used during design:

- https://github.com/cline/cline
- https://github.com/cline/cline/blob/main/sdk/packages/README.md
- https://github.com/cline/cline/blob/main/sdk/AGENTS.md
- https://github.com/cline/cline/blob/main/apps/examples/vscode/package.json
- https://github.com/cline/cline/blob/main/apps/examples/README.md

## Hooking strategy

Do **not** put failover logic in the UI.

Preferred flow:

```text
Task/session (unchanged)
   │
   ▼
provider request boundary
   │
   ▼
ResilienceEngine.execute()
   │
   ├─ pre-stream error -> classify/retry/fallback
   │
   └─ first chunk -> lock replay gate
```

### VS Code host

Use a thin adapter for:

- `SecretStorage` for user-owned credentials
- `StatusBarItem` for active route/status
- `OutputChannel` for sanitized attempt logs
- commands/webview for route status

The `src/adapters/vscode` module contains interfaces that can be satisfied by VS Code without importing `vscode` into the shared core.

### Desktop host

Use the sidecar/runtime host for:

- provider credential resolution from an OS-backed secure store
- emitting route/attempt events to the webview
- reporting route health and cooldowns

The `src/adapters/desktop` module intentionally does not write tokens to plaintext JSON.

## Patch gate before touching upstream Cline

Pin a Cline commit and identify the concrete symbol for each row:

| Concern | Exact symbol to pin |
|---|---|
| provider invocation | function creating/sending provider request |
| HTTP error normalization | status/body -> provider error mapper |
| stream first-chunk boundary | first yielded model event |
| session/task owner | runtime/session API invoking agent run |
| secret resolver | current host credential API |
| VS Code status UI | extension host command/status registration |
| Desktop status UI | sidecar/webview bridge |

Only after those symbols are pinned should an upstream patch be created.

## v0.3 settings binding

Both hosts must bind the same two user settings:

```text
selectedModelId
rateLimitAction = SWITCH_ACCOUNT_KEEP_MODEL | SWITCH_MODEL_KEEP_ACCOUNT
```

The model selector must be populated from `buildRoutingSettingsViewModel()` using the current Cline
Free catalog snapshot. Do not hard-code DeepSeek or any other model ID into the UI.

Every account-scoped route should provide `accountId` and optionally `accountLabel`. The pinned
Cline integration is responsible for mapping its authenticated account/session identity to those
fields.

Promotional transition capability flags must be derived from what the pinned Cline/provider surface
actually supports; they must not be guessed by the shared core.
