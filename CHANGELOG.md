# Changelog

## 0.5.0 — 2026-10-03

- added `ClineLiveSessionModelBridge` over the current `SdkSessionLifecycle` structural seam
- prefer live `updateActiveSessionModel(modelId)` for active-session model changes
- prove session ID remains unchanged across a model switch
- refuse automatic model switch while active Cline turn reports `isRunning=true`
- fail closed if the active session disappears or changes identity during switch
- added executable same-session/same-model host E2E test
- added executable unresolved-tool recovery smoke scenario
- added Cline source-checkout verifier for VS Code, auth, model store, messages-v1 and Desktop/Hub seams
- upgraded integration manifest to schema v2 with live-session required surfaces
- clean build verified with 32/32 tests passing
- added Windows E2E runner for checkout verification + optional Cline VS Code/Desktop host tests

## 0.4.0 — 2026-10-03

- pinned Cline VS Code v4.1.22 (`f58bc11`)
- pinned Cline Desktop v0.0.43 (`476b165`)
- pinned Cline SDK v0.0.90 (`a7ad50b`)
- added current-account identity bridge over Cline ProviderSettingsManager
- added Cline ProviderConfigStore model-selection bridge
- commit selected model in Cline before invoking each route
- added host-first Cline catalog bridge
- added canonical messages-contract-v1 session inspector
- added unresolved tool-call boundary detection for recovery
- added structural compatibility probe that fails closed on upstream drift
- added machine-readable integration manifest
- expanded test suite to 27/27 passing tests

## 0.3.0 — 2026-10-03

- added user-selectable primary model from the live Cline Free catalog
- added `SWITCH_ACCOUNT_KEEP_MODEL` rate-limit strategy
- added `SWITCH_MODEL_KEEP_ACCOUNT` rate-limit strategy
- added explicit `accountId` / `accountLabel` route identity
- added provider capability gates for promotional account/model transitions
- added host-neutral routing settings store
- added VS Code configuration-backed settings adapter
- added Desktop settings payload/view model support
- added dynamic routing settings UI model
- ensured same-model account mode never silently substitutes another model
- expanded test suite to 20/20 passing tests

## 0.2.0 — 2026-10-03

- added structured continuity checkpoints for model handoff
- added compact recovery capsule with explicit incomplete-work contract
- added verification/file/decision/next-action tracking
- added handoff context injection on route/model fallback
- added Cline host catalog source + official live free-feed fallback
- added free catalog cache and change monitor
- added feed-driven free model route builder using Cline as provider
- added current project continuity snapshot and roadmap
- expanded tests from 7 to 14

## 0.1.0

- initial shared resilience engine
- safe pre-stream retry / no replay after output
- route pool, cooldown and error classification
- VS Code/Desktop adapter contracts
