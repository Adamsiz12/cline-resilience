# Practical E2E / host-contract validation — v0.5

## What was executed here

This repository was rebuilt from a clean `dist/` directory with the available TypeScript compiler,
then all Node tests and the executable host smoke scenario were run.

The practical validation covers the current Cline contracts that are externally verifiable from the
pinned/current source:

1. **VS Code live-session switching seam** — Cline's current `SdkSessionLifecycle` exposes
   `getActiveSession()` and `updateActiveSessionModel(modelId)`. The latter updates the model on
   `activeSession.sessionId`, so our bridge verifies the session id before and after a switch.
2. **Same-session, same-model failover policy** — an executable E2E contract test starts with an
   authorized account route A, injects a pre-stream 429, then verifies route B is selected only when
   it has the exact same model id and a different account id. A higher-priority different-model route
   is deliberately present and must never run.
3. **Incomplete tool boundary recovery** — the smoke scenario feeds a real
   `messages-contract-v1` shaped session containing a `tool_use` without `tool_result`; the recovery
   gate marks the boundary FAIL rather than assuming the task completed.
4. **Fail closed** — switching while the Cline session reports `isRunning=true`, loss of the active
   session, or a changed session id all abort the automatic handoff.

## What was not possible inside this execution environment

The environment used to build this artifact cannot launch the graphical Cline Desktop/VS Code host
or authenticate to a user's Cline account. It also cannot clone GitHub directly from the shell.
Therefore this is an **executable host-contract integration test**, not a live cloud-quota test.

A live-account E2E must be run on the user's Windows machine with their installed Cline build and
credentials. The project deliberately does not automate aggregation of promotional/free-account
quotas; account-route failover is limited to host-authorized account/organization/BYOK transitions.

## Windows runner

On the user's Windows machine:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows-live-e2e.ps1 `
  -ClineSourceDir C:\src\cline `
  -RunClineHostTests
```

The runner first executes our checkout verifier and practical E2E. With `-RunClineHostTests`, it also
runs the current Cline VS Code unit suite and Desktop `typecheck` + `test:chat-ui` commands. It does
not read, export or rotate login tokens.
