# Project continuity snapshot

**Objective:** preserve the same Cline task across allowed route/account/model changes without making
the replacement route rediscover the repository, while keeping user-selected model pinning strict.

**Current state:** v0.5 live-session integration and executable host-contract E2E complete; no active
half-finished project implementation step.

**Pinned upstream:** VS Code `v4.1.22` / `f58bc11`; Desktop `desktop-v0.0.43` / `476b165`;
SDK `0.0.90` / `a7ad50b`.

**Done:** resilience engine; pre-stream retry gate; no replay after stream; continuity checkpoint;
compact handoff capsule; live/host Free catalog; dynamic model selector; explicit account identity;
`SWITCH_ACCOUNT_KEEP_MODEL`; `SWITCH_MODEL_KEEP_ACCOUNT`; provider capability gates; current-account
identity bridge; ProviderConfigStore synchronization; live `SdkSessionLifecycle` session-preserving
model bridge; canonical messages-v1 inspector; dangling tool-call recovery check; checkout source
verifier; structural compatibility probe; clean build; 32/32 tests; executable practical smoke.

**Critical behavior:** in `SWITCH_ACCOUNT_KEEP_MODEL`, another model is never eligible. The route must
have the exact selected `modelId`. If no eligible same-model route is available, execution stops.

**Critical live-session rule:** when a live Cline session is available, prefer
`updateActiveSessionModel(modelId)` and verify the session ID does not change. Never perform an
automatic switch while the host reports the active turn is still running.

**Critical continuity rule:** before a handoff, inspect the canonical Cline messages artifact. A
`tool_use` without a matching `tool_result`, or any active project step in `IN_PROGRESS`, `VERIFYING`
or `BLOCKED`, is incomplete work and must be reconciled before new work begins.

**Practical result:** session `smoke-session-001` remained the same during the executable switch
smoke. An intentionally dangling `apply_patch:tool-smoke-1` was detected and marked FAIL rather than
being treated as completed work.

**Next on user's Windows machine:** run the source verifier against an actual Cline checkout, mount
the host glue into the installed/development VS Code and Desktop hosts, then run Cline's own
extension-host/Desktop headless tests with the user's chosen permitted provider/account setup.

**Critical rule for any next model:** never infer completion from conversation text alone. Inspect
`PROJECT_CONTINUITY.md`, `ROADMAP.md`, repository diff/test state, and the current Cline
`<sessionId>.messages.json` boundary first. Local runtime state is intentionally not committed.
