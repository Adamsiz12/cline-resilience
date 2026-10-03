# Design decisions

## Why one repository instead of two projects?

VS Code and Desktop should share retry, policy, route-state, stream-boundary and test logic. Only host integration differs. Duplicating the core would create divergent safety semantics and double maintenance work.

## Why not fork pi-freeflow?

pi-freeflow is valuable as a reference for pool/cooldown/logging concepts, but it is designed around Pi/Oh My Pi and has different task/session semantics. This project keeps Cline's task/session above the resilience layer.

## Why not a standalone intercepting VS Code extension?

A second extension should not try to intercept another extension's private requests or private secret store. The resilient boundary belongs in a supported/provider/runtime integration point.

## Why not replay after stream start?

The consumer may already have observed partial model output or tool intent. Replaying can duplicate side effects or produce inconsistent agent state.
