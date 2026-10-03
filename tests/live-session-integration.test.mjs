import test from "node:test";
import assert from "node:assert/strict";
import {
  ClineLiveSessionModelBridge,
  verifyClineHostCompatibility,
} from "../dist/src/index.js";

test("live Cline session model switch preserves the exact session id", async () => {
  const active = {
    sessionId: "session-8472",
    isRunning: false,
    startConfig: { providerId: "cline", modelId: "cline-free/deepseek-v4.1-flash" },
  };
  const updates = [];
  const lifecycle = {
    getActiveSession() {
      return active;
    },
    async updateActiveSessionModel(modelId) {
      updates.push({ sessionId: active.sessionId, modelId });
      active.startConfig.modelId = modelId;
      return true;
    },
  };

  const bridge = new ClineLiveSessionModelBridge(lifecycle);
  const result = await bridge.switchModelPreservingSession("cline-free/deepseek-v4.1-flash");

  assert.equal(result.sessionId, "session-8472");
  assert.equal(result.sessionPreserved, true);
  assert.equal(result.modelId, "cline-free/deepseek-v4.1-flash");
  assert.deepEqual(updates, [
    { sessionId: "session-8472", modelId: "cline-free/deepseek-v4.1-flash" },
  ]);
  assert.equal(lifecycle.getActiveSession().sessionId, "session-8472");
});

test("live session bridge refuses model switching while a Cline turn is still running", async () => {
  const active = {
    sessionId: "session-running",
    isRunning: true,
    startConfig: { providerId: "cline", modelId: "m1" },
  };
  let updateCalls = 0;
  const bridge = new ClineLiveSessionModelBridge({
    getActiveSession() { return active; },
    async updateActiveSessionModel() { updateCalls += 1; return true; },
  });

  await assert.rejects(
    () => bridge.switchModelPreservingSession("m1"),
    /still running; refusing mid-turn model switch/,
  );
  assert.equal(updateCalls, 0);
});

test("live session bridge fails closed if Cline replaces the session during switch", async () => {
  let active = {
    sessionId: "session-before",
    isRunning: false,
    startConfig: { providerId: "cline", modelId: "m1" },
  };
  const bridge = new ClineLiveSessionModelBridge({
    getActiveSession() { return active; },
    async updateActiveSessionModel(modelId) {
      active = {
        sessionId: "session-after",
        isRunning: false,
        startConfig: { providerId: "cline", modelId },
      };
      return true;
    },
  });

  await assert.rejects(
    () => bridge.switchModelPreservingSession("m2"),
    /session identity changed/,
  );
});

test("compatibility probe can verify current VS Code live-session switching surface", () => {
  const report = verifyClineHostCompatibility({
    providerSettingsManager: { getProviderSettings() { return undefined; } },
    providerConfigStore: { readSelection() { return undefined; }, commitSelection() {} },
    catalog: { async listModels() { return []; } },
    runtime: { async invoke() { return { stream: (async function* () {})() }; } },
    sessionLifecycle: {
      getActiveSession() { return undefined; },
      async updateActiveSessionModel() { return false; },
    },
  });

  assert.equal(report.compatible, true);
  assert.equal(report.checks.some((c) => c.name === "SdkSessionLifecycle.updateActiveSessionModel" && c.ok), true);
});
