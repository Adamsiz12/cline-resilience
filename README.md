# Cline Resilience Layer v0.5

A shared TypeScript resilience + continuity layer for **Cline VS Code** and **Cline Desktop**.

The two critical goals are:

1. model/account handoff must never silently leave a half-finished coding step behind;
2. the user must control whether a rate limit means **keep the model and change account** or
   **keep the account and change model**.

## v0.5 — live-session bridge + practical host-contract E2E

The VS Code integration now prefers Cline's active-session seam for live model changes:

```text
SdkSessionLifecycle.getActiveSession()
        ↓
updateActiveSessionModel(modelId)
        ↓
sdkHost.updateSessionModel(activeSession.sessionId, modelId)
```

The bridge proves the `sessionId` is unchanged before/after the switch and refuses to switch while
the active Cline turn reports `isRunning=true`. `ProviderConfigStore.commitSelection()` remains in
use to keep Cline UI/default selection synchronized, but it is no longer treated as the sole live
session switch mechanism.

Practical validation in this artifact performs a clean TypeScript build, 32 Node tests, an executable
same-session/same-model authorized-route E2E scenario, and a smoke session containing an unresolved
`tool_use`. The unresolved boundary is intentionally marked FAIL so the replacement route must
reconcile it instead of assuming completion.

For a real Cline source checkout, run:

```bash
npm run verify:cline-checkout -- C:\path\to\cline
```

The verifier fails closed if the pinned/current source no longer exposes the required auth, model
selection, live-session, messages-v1, or Desktop/Hub structural seams.

## v0.4 — pinned Cline upstream bridge

The project now contains a concrete bridge for the verified Cline host surfaces used by the
VS Code extension and Desktop/Hub runtime. Current pins are `v4.1.22`, `desktop-v0.0.43` and
SDK `0.0.90`. The bridge reads Cline account identity without copying tokens, commits model
selection through Cline's `ProviderConfigStore`, uses Cline as the primary catalog source, and
inspects Cline's canonical messages-v1 session artifact before handoff.

A structural compatibility probe fails closed if an upstream update removes a required surface.

## v0.3 — user-controlled model pinning and rate-limit policy

The model selector is driven by Cline's live Free catalog. Model IDs are not hard-coded.

Example user settings:

```json
{
  "selectedModelId": "cline-free/deepseek-v4.1-flash",
  "rateLimitAction": "SWITCH_ACCOUNT_KEEP_MODEL"
}
```

Two actions are available:

```text
SWITCH_ACCOUNT_KEEP_MODEL
    selected model stays EXACTLY the same
    ↓
    only another eligible accountId/credential route may be selected

SWITCH_MODEL_KEEP_ACCOUNT
    account/credential stays the same
    ↓
    another eligible model may be selected
```

In `SWITCH_ACCOUNT_KEEP_MODEL`, the engine will not silently choose a different model if the
selected model is unavailable. It stops unless an eligible route for the exact same model exists.

Routes now carry explicit identity:

```text
providerId
model
accountId
accountLabel
usageClass
```

This makes "change account" and "change model" different, testable operations.

### Provider capability gate

User preference does not override the upstream provider's permitted surface. For promotional/free
routes, the host adapter must explicitly declare whether promotional account/model transitions are
supported. The core never forges provider capabilities.

## v0.2 — continuity checkpoint

`ContinuityManager` stores only operational state that a replacement route/model needs:

- objective / phase
- one active step and its state
- completion criteria
- recently completed work
- next actions
- blockers and constraints
- files touched (`PLANNED`, `MODIFIED`, `VERIFIED`)
- test/build verification
- compact decision log

It deliberately does **not** duplicate Cline's full conversation history.

### Compact handoff

On a permitted route/model/account fallback, `ResilienceEngine` can attach a bounded
`handoffContext` to the next request. The continuity capsule puts unfinished work first.

```text
IN_PROGRESS / VERIFYING / BLOCKED
        ↓ route/account/model changes
next route MUST inspect current files/state
        ↓
run/inspect completion criteria
        ↓
reconcile partial work
        ↓
only then mark DONE and continue
```

## Cline-native Free model discovery

Preferred source order:

```text
Cline host / @cline/llms Free tier
              ↓ unavailable
official Cline recommended/free feed
              ↓ unavailable
last-known cache
```

Standalone fallback endpoint:

```text
https://api.cline.bot/api/v1/ai/cline/recommended-models
```

Only the response's `free` array is authoritative. The code does not infer Free membership from
an ID prefix.

`FreeModelCatalogMonitor` detects changes. `buildFreeModelChoices()` turns the live tier into the
user's model selector. `buildClineFreeRoutes()` builds the current-account Cline routes.

## Current documentation snapshot

Observed on 2026-10-03:

- `cline-free/deepseek-v4.1-flash`
- `stealth/space-bunny-alpha`
- `cline-free/mimo-v2.6-flash`
- `cline-free/muse-spark-1.3-contributor`

Runtime behavior does not depend on this snapshot.

## Resilience behavior

- temporary 429 / Retry-After
- network and timeout failures
- upstream 5xx
- user-selected primary model
- user-selected rate-limit routing action
- safe retry only **before the first streamed output**
- hard stop on automatic replay after text/reasoning/tool/meta output begins
- compact task handoff on an allowed route/account/model change
- sanitized attempt journal

## Architecture

```text
                    Same Cline task/session
                             │
                  Cline native compaction
                             │
                             ▼
                    Continuity capsule
                             │
        ┌────────────────────┴────────────────────┐
        ▼                                         ▼
 Cline VS Code                              Cline Desktop
        │                                         │
        └──────────── host adapters ──────────────┘
                             │
                   User Routing Settings
                ┌────────────┴────────────┐
                │                         │
         Selected Model           Rate-limit Action
                │                         │
                └────────────┬────────────┘
                             ▼
                    Resilience Engine
               ┌─────────────┼─────────────┐
               │             │             │
          Route Pool     Replay Gate   Attempt Journal
               │
       Cline Free Catalog Bridge
               │
      Cline provider runtime
```

## Safe replay rule

Automatic replay is allowed only when:

```text
streamStarted == false
outputChunks == 0
error is retry/fallback-safe
```

Once any output is emitted, a later failure becomes `UNSAFE_TO_REPLAY`.

## Settings UI contract

`buildRoutingSettingsViewModel()` exposes one shared view model for both hosts:

- `selectedModelId`
- dynamic `modelChoices`
- current `rateLimitAction`
- two rate-limit action choices and descriptions

VS Code can bind it to extension configuration/Webview. Desktop can render the same model in its
Tauri/Next settings surface.

## Repository map

```text
src/
├─ core/                 retry/fallback/replay gate
├─ continuity/           checkpoint, capsule, recovery state
├─ catalog/              Cline free-model sources, monitor, route builder
├─ settings/             model selector + rate-limit action
├─ integration/
│  └─ cline-upstream/    pinned auth/model/catalog/session bridges
└─ adapters/
   ├─ vscode/
   ├─ desktop/
   └─ shared/

tests/                   network-free + host-contract tests
.github/                 CI + review templates
docs/
├─ continuity-strategy.md
├─ free-model-catalog.md
├─ routing-settings.md
├─ cline-upstream-integration.md
├─ integration-map.md
├─ security.md
└─ next-steps.md
```

## Reviewer quick start

This repository is prepared for public technical review. No generated build output, local runtime state, archives, or credentials are included.

Requirements: Node.js 22+ and npm.

```bash
npm install
npm test
npm run test:practical
```

Useful review entry points:

- `PROJECT_CONTINUITY.md` — compact current project state
- `ROADMAP.md` — completed milestones and remaining host-installation work
- `TEST_RESULTS.md` — latest executed verification
- `docs/cline-upstream-integration.md` — pinned Cline integration surfaces
- `docs/continuity-strategy.md` — incomplete-work recovery design
- `docs/routing-settings.md` — user-selectable model/rate-limit policy
- `integration-manifest.json` — machine-readable upstream contract

## Run

```bash
npm install
npm test
npm run demo
npm run settings:demo
npm run models:free
```

## Upstream integration rule

Do not fork separate implementations for VS Code and Desktop. Pin a Cline SDK/repository version,
then bind both hosts to the same core. In production, bind `HostFreeModelSource` to Cline's own
SDK/provider model list so Cline remains the source of truth for aliases, capabilities, client
identity and featured Free tiers.

See `ROADMAP.md`, `PROJECT_CONTINUITY.md`, `integration-manifest.json`,
`docs/cline-upstream-integration.md`, `docs/continuity-strategy.md`,
`docs/free-model-catalog.md`, and `docs/routing-settings.md`.

## Windows end-to-end runner

After obtaining a real Cline checkout on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows-live-e2e.ps1 `
  -ClineSourceDir C:\src\cline `
  -RunClineHostTests
```

This verifies the source seams, runs the resilience host-contract E2E, and optionally runs Cline's
own VS Code unit and Desktop typecheck/chat-UI suites. Authentication credentials are not exported.
