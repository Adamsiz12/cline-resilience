import test from "node:test";
import assert from "node:assert/strict";
import {
  ContinuityManager,
  MemoryContinuityStore,
  ResilienceEngine,
  HttpError,
} from "../dist/src/index.js";

async function collect(generator) {
  const out = [];
  for await (const chunk of generator) out.push(chunk);
  return out;
}

test("E2E host contract: same session + same model survives authorized account-route failover", async () => {
  const sessionId = "cline-session-e2e-01";
  const modelId = "cline-free/deepseek-v4.1-flash";
  const calls = [];

  const continuity = new ContinuityManager(new MemoryContinuityStore(), { maxChars: 5000 });
  await continuity.init({
    projectId: "project-e2e",
    taskId: sessionId,
    objective: "continue the exact Cline task without re-learning the whole project",
    nextActions: ["finish active edit", "run tests", "mark step done only after verification"],
  });
  await continuity.beginStep("S42", "finish provider bridge", ["same session id", "same model id", "tests pass"]);

  const routes = [
    {
      id: "authorized-A",
      label: "Authorized account A",
      providerId: "cline",
      model: modelId,
      accountId: "acct-A",
      usageClass: "organization",
      priority: 1,
      async invoke(request) {
        calls.push({ route: "A", sessionId, model: request.model, handoff: Boolean(request.handoffContext) });
        throw new HttpError(429, "Daily free limit reached. Try again in 23h 59m");
      },
    },
    {
      id: "authorized-B",
      label: "Authorized account B",
      providerId: "cline",
      model: modelId,
      accountId: "acct-B",
      usageClass: "organization",
      priority: 2,
      async invoke(request) {
        calls.push({ route: "B", sessionId, model: request.model, handoff: Boolean(request.handoffContext) });
        return {
          stream: (async function* () {
            yield { type: "text", data: "continued on same task" };
          })(),
        };
      },
    },
    {
      id: "wrong-model",
      label: "Wrong model",
      providerId: "cline",
      model: "cline-free/mimo-v2.6-flash",
      accountId: "acct-C",
      usageClass: "organization",
      priority: 0,
      async invoke() {
        throw new Error("wrong model route must never be selected");
      },
    },
  ];

  const engine = new ResilienceEngine(routes, {
    continuity,
    routingSettings: {
      selectedModelId: modelId,
      rateLimitAction: "SWITCH_ACCOUNT_KEEP_MODEL",
    },
  });

  const chunks = await collect(engine.execute({
    requestId: "req-e2e-1",
    model: modelId,
    payload: { sessionId, prompt: "continue" },
  }));

  assert.deepEqual(chunks, [{ type: "text", data: "continued on same task" }]);
  assert.deepEqual(calls.map((c) => c.route), ["A", "B"]);
  assert.equal(calls.every((c) => c.sessionId === sessionId), true);
  assert.equal(calls.every((c) => c.model === modelId), true);
  assert.equal(calls[1].handoff, true);
});
