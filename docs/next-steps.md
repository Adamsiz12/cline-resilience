# Next implementation steps

## Completed through v0.5

- shared route pool, cooldown and retry classification
- safe pre-stream retry and hard no-replay after streamed output
- compact continuity checkpoint and handoff capsule
- user-selectable primary model and rate-limit routing policy
- exact same-model lock for `SWITCH_ACCOUNT_KEEP_MODEL`
- live Cline Free-model catalog source with fallback/cache support
- pinned Cline VS Code/Desktop/SDK integration contract
- account identity bridge without OAuth-token persistence
- ProviderConfigStore synchronization
- live `SdkSessionLifecycle.updateActiveSessionModel()` bridge
- session-id preservation verification
- canonical messages-v1 incomplete-tool boundary detection
- fail-closed upstream compatibility verifier
- Windows E2E runner
- 32/32 clean-build tests passing

## Next — real host installation / machine E2E

1. Obtain the target Cline source/build on Windows.
2. Run `npm run verify:cline-checkout -- <cline-source-dir>`.
3. Bind `ClineLiveSessionModelBridge` to the real VS Code `SdkSessionLifecycle` instance.
4. Bind model-selection persistence to the real `ProviderConfigStore`.
5. Mount the shared resilience service at the Desktop Bun-sidecar/shared-Hub boundary.
6. Render the shared model selector and rate-limit policy in both hosts.
7. Run Cline VS Code extension-host tests.
8. Run Desktop typecheck, chat-UI tests and a headless sidecar/session test.
9. Run a permitted live provider/account scenario and compare the same canonical Cline session before/after handoff.
10. Package a VSIX/Windows overlay only after the host tests pass.

## Review rule

Do not treat a conversational statement as proof that a coding step finished. Before continuing an interrupted task, inspect repository state, verification results and the canonical Cline message/tool boundary.
