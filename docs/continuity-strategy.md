# Continuity strategy — preventing incomplete work after model handoff

## Goal

A model/provider/account handoff must not make the replacement model rediscover the whole
repository, and it must never silently treat partially completed work as finished.

Cline already owns canonical session history, checkpoints and context compaction. The
resilience layer therefore stores only **operational continuity state** that is easy to lose:
active step, completion criteria, modified files, verification state, blockers, key decisions
and the next few actions.

## Compared approaches

| Approach | Token cost | Incomplete-work safety | Freshness | Complexity | Verdict |
|---|---:|---:|---:|---:|---|
| Replay full conversation | very high | high | high | low | accurate but wastes context/tokens |
| Static `ROADMAP.md` only | low | medium-low | depends on manual updates | low | useful human reference, insufficient alone |
| Cline native compaction only | low-medium | medium | high | none | keep it enabled, but it is not an execution ledger |
| Git diff + tests only | low | high for code | high | medium | excellent verification layer, weak on intent/decisions |
| Structured continuity checkpoint only | low | high | high if hooks update it | medium | strong baseline |
| **Hybrid: Cline session + checkpoint + verification gate** | **low** | **very high** | **high** | **medium** | **recommended** |

## Recommended handoff protocol

### Layer 1 — canonical Cline session

Do not create a new task merely because the model changes. Keep the same Cline session/task and
let Cline's own agentic compaction manage historical conversation context.

### Layer 2 — bounded continuity checkpoint

Persist a small JSON document with:

- project/task objective
- current phase
- one active work step and its state
- completion criteria
- recent completed work
- next 3–8 actions
- blockers/constraints
- files touched and whether each is merely modified or verified
- recent test/build verification
- a small decision log

The generated handoff capsule defaults to roughly 6,000 characters, normally far smaller than
replaying a long coding conversation.

### Layer 3 — recovery/verification gate

Work step lifecycle:

```text
PENDING -> IN_PROGRESS -> VERIFYING -> DONE
                         \-> BLOCKED
```

If a handoff sees `IN_PROGRESS`, `VERIFYING` or `BLOCKED`, the replacement model receives a
mandatory recovery contract:

1. inspect current repository/files/state;
2. do not assume the previous edit completed;
3. run the completion criteria/tests;
4. reconcile partial changes;
5. only then mark the step `DONE` and continue.

This is more important than a long project summary: it tells the next model exactly what is
unsafe to assume.

## Suggested Cline hook mapping

When the project is patched into a pinned Cline version, update the checkpoint from host/runtime
hooks rather than asking the model to remember to maintain it manually:

| Event | Continuity action |
|---|---|
| user task begins | initialize checkpoint |
| tool/edit begins | `beginStep` or keep active step `IN_PROGRESS` |
| file edit succeeds | `recordFile(..., MODIFIED)` |
| test/build begins | `markVerifying()` |
| test/build succeeds | `recordVerification(PASS)` and mark files `VERIFIED` |
| work unit complete | `completeStep()` |
| tool/test fails | record `FAIL` / blocker |
| model changes | inject continuity capsule once into the replacement model |
| session resume/crash recovery | load checkpoint and apply same recovery gate |

## Important distinction

The continuity mechanism is independent of *why* a model changes. It works for a user-selected
model change, a permitted provider fallback, a Cline-hosted model rotation, a local fallback, or
a manual account change. The resilience policy remains separate from the continuity policy.
