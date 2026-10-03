import {
  ClineLiveSessionModelBridge,
  ContinuityManager,
  MemoryContinuityStore,
  inspectClineMessagesV1,
  syncClineSessionIntoContinuity,
} from "../src/index.js";

/**
 * Executable host-contract smoke test. It mirrors the current Cline VS Code
 * SdkSessionLifecycle seam and the persisted messages-contract-v1 boundary.
 * No cloud credentials are required.
 */
async function main() {
  const active = {
    sessionId: "smoke-session-001",
    isRunning: false,
    startConfig: {
      providerId: "cline",
      modelId: "cline-free/deepseek-v4.1-flash",
    },
  };

  const lifecycle = {
    getActiveSession() { return active; },
    async updateActiveSessionModel(modelId: string) {
      // Mirrors Cline v4.1.22: sdkHost.updateSessionModel(activeSession.sessionId, modelId)
      active.startConfig.modelId = modelId;
      return true;
    },
  };

  const modelBridge = new ClineLiveSessionModelBridge(lifecycle);
  const switchResult = await modelBridge.switchModelPreservingSession(
    "cline-free/deepseek-v4.1-flash",
  );

  const continuity = new ContinuityManager(new MemoryContinuityStore());
  await continuity.init({
    projectId: "smoke-project",
    taskId: "smoke-task",
    objective: "prove same-session continuation after a safe route handoff",
    nextActions: ["verify unresolved tool boundary", "continue the exact active step"],
  });
  await continuity.beginStep("S1", "finish current source edit", ["tool result persisted", "tests pass"]);

  const persisted = {
    version: 1,
    updated_at: "2026-10-03T12:00:00.000Z",
    agent: "lead",
    sessionId: active.sessionId,
    messages: [
      { id: "u1", role: "user", content: [{ type: "text", text: "continue implementation" }] },
      {
        id: "a1",
        role: "assistant",
        content: [{ type: "tool_use", id: "tool-smoke-1", name: "apply_patch", input: { path: "src/x.ts" } }],
        modelInfo: { id: active.startConfig.modelId, provider: "cline" },
      },
    ],
  } as const;

  const inspection = inspectClineMessagesV1(persisted);
  await syncClineSessionIntoContinuity(continuity, persisted);

  const report = {
    switchResult,
    activeSessionIdAfterSwitch: lifecycle.getActiveSession().sessionId,
    danglingToolCalls: inspection.danglingToolCalls,
    lastAssistantCompleted: inspection.lastAssistantCompleted,
    continuityVerification: continuity.snapshot().verifications.at(-1),
  };

  console.log(JSON.stringify(report, null, 2));

  if (report.activeSessionIdAfterSwitch !== "smoke-session-001") throw new Error("session id changed during live model switch");
  if (report.danglingToolCalls.length !== 1) throw new Error("expected one unresolved tool call");
  if (report.continuityVerification?.status !== "FAIL") throw new Error("recovery gate did not mark unresolved tool boundary");
}

main().catch((error) => {
  // Throw on the microtask queue so Node exits non-zero without importing Node-specific types.
  queueMicrotask(() => { throw error; });
});
