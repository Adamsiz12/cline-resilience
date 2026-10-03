# Cline Resilience roadmap

## Done — v0.1

- shared resilience core for VS Code + Desktop
- route pool / cooldown state machine
- temporary 429 vs daily promotional-limit classification
- pre-stream safe retry
- hard stop on replay after first output
- sanitized attempt journal
- VS Code/Desktop host adapter contracts
- promotional-quota policy boundary

## Done — v0.2

- structured `ContinuityManager`
- active-step states: `IN_PROGRESS`, `VERIFYING`, `DONE`, `BLOCKED`
- completion criteria, files touched, blockers, decisions, verification records
- bounded low-token handoff capsule
- automatic handoff-context creation when fallback changes route/model
- live Cline free-model catalog source + Cline-host source + cache fallback
- feed-driven route creation with no prefix assumptions

## Done — v0.3

- dynamic user model selector from Cline Free catalog
- `SWITCH_ACCOUNT_KEEP_MODEL`
- `SWITCH_MODEL_KEEP_ACCOUNT`
- exact model lock when same-model mode is selected
- explicit `accountId` / `accountLabel`
- provider capability gates
- shared VS Code/Desktop settings view model

## Done — v0.4

- pinned Cline VS Code/Desktop/SDK integration metadata
- account identity bridge without token persistence
- ProviderConfigStore model selection synchronization
- messages-contract-v1 session inspector
- dangling tool-call recovery detection
- fail-closed upstream compatibility probe

## Done — v0.5

- live `SdkSessionLifecycle` bridge
- preserve exact active `sessionId` across model update
- refuse switching during a running turn
- fail closed on session replacement/disappearance
- executable authorized route A -> 429 -> route B same-model E2E
- deliberately higher-priority wrong model proven ineligible in same-model mode
- executable incomplete `tool_use` recovery smoke
- clean build + 32/32 passing tests
- source checkout verifier for the pinned/current Cline structural seams
- Windows runner for project E2E + optional upstream VS Code/Desktop host tests

## Next — host installation / real-machine E2E

1. On Windows, obtain/check out the desired Cline source/build.
2. Run `npm run verify:cline-checkout -- <cline-source-dir>`.
3. Bind `ClineLiveSessionModelBridge` to the real VS Code `SdkSessionLifecycle` instance.
4. Bind selection persistence to the real ProviderConfigStore.
5. Mount shared resilience service in Desktop Bun sidecar / shared Hub boundary, not the React UI.
6. Render model + rate-limit policy settings in both hosts.
7. Run Cline's real VS Code extension-host integration tests.
8. Run Desktop `typecheck`, chat UI tests and headless sidecar session test.
9. Run a permitted live provider/account scenario and confirm the same Cline session artifact before/after handoff.
10. Package a Windows installer/VSIX overlay only after those tests pass.
