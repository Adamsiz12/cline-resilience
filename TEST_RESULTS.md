# Test Results — v0.5.0

Date: 2026-10-03

## Clean build + complete suite

Executed from a deleted `dist/` directory:

```bash
rm -rf dist
tsc -p tsconfig.json
node --test tests/*.test.mjs
node dist/examples/practical-host-smoke.js
```

Result:

```text
32 tests
32 pass
0 fail
```

The executable smoke result also confirmed:

```text
session before: smoke-session-001
session after : smoke-session-001
sessionPreserved: true
model before/after: cline-free/deepseek-v4.1-flash
```

The smoke session deliberately contained an unresolved tool boundary:

```text
tool_use: apply_patch / tool-smoke-1
matching tool_result: absent
```

Recovery result:

```text
lastAssistantCompleted: false
Cline tool-call boundary: FAIL
Unresolved tool calls: apply_patch:tool-smoke-1
```

This is expected and is the safety behavior: the replacement route must inspect/reconcile the
unfinished edit before continuing.

## Practical E2E contract covered

- active Cline session id remains identical across live model update
- same-model account mode rejects a higher-priority different model
- authorized route A -> pre-stream 429 -> authorized route B
- model ID stays exactly the same across the handoff
- continuity capsule is present on the replacement route
- model switching is refused while the active Cline turn reports `isRunning=true`
- integration fails closed if session identity changes during a switch
- unresolved `tool_use` without `tool_result` blocks completion
- safe replay remains impossible after any streamed output
- Cline account identity can be read without persisting OAuth tokens
- current Cline catalog is still the primary Free-model source
- upstream structural drift disables integration rather than guessing

## Environment boundary

This environment cannot launch/authenticate the user's graphical Cline VS Code/Desktop installation
and cannot clone GitHub directly from the shell. Therefore the practical test here is an executable
host-contract E2E against the verified current Cline seams, not a live cloud-account quota test.

For a local Windows Cline checkout, `npm run verify:cline-checkout -- <cline-source-dir>` was added so
the exact source surfaces can be checked before installing/running the overlay.

## Checkout verifier practical test

The source-checkout verifier was executed against a complete structural fixture and returned PASS for
all five source anchors. Then `updateActiveSessionModel` was deliberately removed from the fixture;
the verifier exited non-zero and identified the missing live-session surface. This confirms the
upstream-drift guard is fail-closed in execution, not only in unit tests.
