import test from "node:test";
import assert from "node:assert/strict";
import {
  CLINE_UPSTREAM_PIN,
  ClineAuthIdentityBridge,
  ClineModelSelectionBridge,
  inspectClineMessagesV1,
  syncClineSessionIntoContinuity,
  ContinuityManager,
  MemoryContinuityStore,
} from "../dist/src/index.js";

test("upstream pin records current VS Code/Desktop/SDK releases", () => {
  assert.equal(CLINE_UPSTREAM_PIN.vscode.tag, "v4.1.22");
  assert.equal(CLINE_UPSTREAM_PIN.desktop.tag, "desktop-v0.0.43");
  assert.equal(CLINE_UPSTREAM_PIN.sdk.version, "0.0.90");
});

test("auth bridge reads accountId without exposing tokens", () => {
  const bridge = new ClineAuthIdentityBridge({
    getProviderSettings(providerId) {
      assert.equal(providerId, "cline");
      return {
        provider: "cline",
        auth: {
          accessToken: "secret-access",
          refreshToken: "secret-refresh",
          accountId: "account-1234567890",
        },
      };
    },
  });

  const identity = bridge.current();
  assert.equal(identity.accountId, "account-1234567890");
  assert.equal(identity.authenticated, true);
  assert.equal("accessToken" in identity, false);
  assert.equal("refreshToken" in identity, false);
});

test("model bridge commits selected model to Cline store before invoke", async () => {
  let selected = { providerId: "cline", modelId: "old-model" };
  const commits = [];
  const configStore = {
    readSelection() {
      return selected;
    },
    commitSelection(providerId, mode, selection) {
      commits.push({ providerId, mode, selection });
      selected = selection;
    },
  };

  const calls = [];
  const runtime = {
    async invoke(input) {
      calls.push(input);
      return { stream: (async function* () { yield { type: "text", data: "ok" }; })() };
    },
  };

  const bridge = new ClineModelSelectionBridge(configStore, runtime, "act");
  const route = bridge.route(
    {
      providerId: "cline",
      modelId: "cline-free/deepseek-v4.1-flash",
      usageClass: "promotional",
      priority: 1,
    },
    { providerId: "cline", accountId: "acct-A", accountLabel: "A", authenticated: true },
  );

  const response = await route.invoke(
    { requestId: "r1", model: "ignored", payload: { prompt: "continue" } },
    { attempt: 1 },
  );
  const chunks = [];
  for await (const chunk of response.stream) chunks.push(chunk);

  assert.equal(commits.length, 1);
  assert.equal(commits[0].mode, "act");
  assert.equal(commits[0].selection.modelId, "cline-free/deepseek-v4.1-flash");
  assert.equal(calls[0].modelId, "cline-free/deepseek-v4.1-flash");
  assert.equal(calls[0].request.model, "cline-free/deepseek-v4.1-flash");
  assert.deepEqual(chunks, [{ type: "text", data: "ok" }]);
});

test("session inspector detects unresolved tool calls before handoff", () => {
  const inspection = inspectClineMessagesV1({
    version: 1,
    updated_at: "2026-10-03T10:00:00.000Z",
    agent: "lead",
    sessionId: "s1",
    messages: [
      { id: "u1", role: "user", content: [{ type: "text", text: "continue task" }] },
      {
        id: "a1",
        role: "assistant",
        content: [{ type: "tool_use", id: "tool-1", name: "apply_patch", input: {} }],
        modelInfo: { id: "cline-free/deepseek-v4.1-flash", provider: "cline" },
      },
    ],
  });

  assert.equal(inspection.lastModelId, "cline-free/deepseek-v4.1-flash");
  assert.equal(inspection.lastAssistantCompleted, false);
  assert.deepEqual(inspection.danglingToolCalls, [{ id: "tool-1", name: "apply_patch" }]);
});

test("session inspector recognizes resolved tool boundary", () => {
  const inspection = inspectClineMessagesV1({
    version: 1,
    updated_at: "2026-10-03T10:00:00.000Z",
    agent: "lead",
    sessionId: "s2",
    messages: [
      { id: "u1", role: "user", content: [{ type: "text", text: "continue task" }] },
      {
        id: "a1",
        role: "assistant",
        content: [{ type: "tool_use", id: "tool-1", name: "apply_patch", input: {} }],
        modelInfo: { id: "m1", provider: "cline" },
      },
      { id: "u2", role: "user", content: [{ type: "tool_result", tool_use_id: "tool-1", content: "done" }] },
      {
        id: "a2",
        role: "assistant",
        content: [{ type: "text", text: "complete" }],
        modelInfo: { id: "m1", provider: "cline" },
        metrics: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 },
      },
    ],
  });
  assert.equal(inspection.lastAssistantCompleted, true);
  assert.deepEqual(inspection.danglingToolCalls, []);
});

test("syncing Cline session into continuity records verification", async () => {
  const store = new MemoryContinuityStore();
  const manager = new ContinuityManager(store);
  await manager.init({ projectId: "p", taskId: "t", objective: "finish safely" });

  await syncClineSessionIntoContinuity(manager, {
    version: 1,
    updated_at: "2026-10-03T10:00:00.000Z",
    agent: "lead",
    sessionId: "s3",
    messages: [
      { id: "u1", role: "user", content: [{ type: "text", text: "continue" }] },
      {
        id: "a1",
        role: "assistant",
        content: [{ type: "text", text: "done" }],
        modelInfo: { id: "m1", provider: "cline" },
        metrics: { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheWriteTokens: 0, cost: 0 },
      },
    ],
  });

  const state = manager.snapshot();
  assert.equal(state.verifications.at(-1).label, "Cline tool-call boundary");
  assert.equal(state.verifications.at(-1).status, "PASS");
  assert.match(state.decisions.at(-1).decision, /Cline session s3 inspected/);
});

test("compatibility probe fails closed when an upstream surface disappears", async () => {
  const { verifyClineHostCompatibility } = await import("../dist/src/index.js");
  const report = verifyClineHostCompatibility({
    providerSettingsManager: { getProviderSettings() { return undefined; } },
    providerConfigStore: {
      readSelection() { return undefined; },
      commitSelection() {},
    },
    catalog: { async listModels() { return []; } },
    // runtime intentionally missing
  });
  assert.equal(report.compatible, false);
  assert.equal(report.checks.find((c) => c.name === "Model runtime invoke").ok, false);
});
