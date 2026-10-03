import assert from "node:assert/strict";
import test from "node:test";
import {
  HttpError,
  MemoryAttemptJournal,
  ResilienceEngine,
  UnsafeReplayError,
} from "../dist/src/core/index.js";

async function collect(engine) {
  const out = [];
  for await (const chunk of engine.execute({ requestId: "r1", model: "m", payload: {} })) out.push(chunk);
  return out;
}

async function* stream(...chunks) {
  for (const chunk of chunks) yield chunk;
}

test("temporary 429 retries same route before falling back", async () => {
  let calls = 0;
  const engine = new ResilienceEngine([
    {
      id: "primary", label: "primary", providerId: "provider-a", model: "m", usageClass: "byok", priority: 1,
      invoke: async () => {
        calls += 1;
        if (calls === 1) throw new HttpError(429, "Too many requests");
        return { stream: stream({ type: "text", data: "ok" }) };
      },
    },
  ], { sleep: async () => undefined, maxSameRouteRetries: 1 });

  const out = await collect(engine);
  assert.equal(calls, 2);
  assert.deepEqual(out, [{ type: "text", data: "ok" }]);
});

test("promotional quota does not roll into another promotional route", async () => {
  let forbiddenPromoCalls = 0;
  let localCalls = 0;
  const engine = new ResilienceEngine([
    {
      id: "promo-a", label: "promo-a", providerId: "cline", model: "free-model", usageClass: "promotional", priority: 1,
      invoke: async () => { throw new HttpError(429, "Daily free limit reached. Try again in 23h 59m"); },
    },
    {
      id: "promo-b", label: "promo-b", providerId: "cline", model: "free-model", usageClass: "promotional", priority: 2,
      invoke: async () => { forbiddenPromoCalls += 1; return { stream: stream({ type: "text", data: "bad" }) }; },
    },
    {
      id: "local", label: "local", providerId: "ollama", model: "coder", usageClass: "local", priority: 3,
      invoke: async () => { localCalls += 1; return { stream: stream({ type: "text", data: "local-ok" }) }; },
    },
  ], { sleep: async () => undefined });

  const out = await collect(engine);
  assert.equal(forbiddenPromoCalls, 0);
  assert.equal(localCalls, 1);
  assert.deepEqual(out, [{ type: "text", data: "local-ok" }]);
});

test("paid/BYOK route can fall back to another authorized route", async () => {
  let secondCalls = 0;
  const engine = new ResilienceEngine([
    {
      id: "a", label: "a", providerId: "provider-a", model: "m", usageClass: "byok", priority: 1,
      invoke: async () => { throw new HttpError(503, "upstream unavailable"); },
    },
    {
      id: "b", label: "b", providerId: "provider-b", model: "m", usageClass: "paid", priority: 2,
      invoke: async () => { secondCalls += 1; return { stream: stream({ type: "text", data: "fallback-ok" }) }; },
    },
  ], { sleep: async () => undefined, maxSameRouteRetries: 0 });

  const out = await collect(engine);
  assert.equal(secondCalls, 1);
  assert.deepEqual(out, [{ type: "text", data: "fallback-ok" }]);
});

test("failure after first streamed chunk is never replayed", async () => {
  let fallbackCalls = 0;
  const engine = new ResilienceEngine([
    {
      id: "primary", label: "primary", providerId: "a", model: "m", usageClass: "byok", priority: 1,
      invoke: async () => ({ stream: (async function* () {
        yield { type: "text", data: "partial" };
        throw new HttpError(503, "stream broke");
      })() }),
    },
    {
      id: "fallback", label: "fallback", providerId: "b", model: "m", usageClass: "paid", priority: 2,
      invoke: async () => { fallbackCalls += 1; return { stream: stream({ type: "text", data: "should-not-run" }) }; },
    },
  ], { sleep: async () => undefined, maxSameRouteRetries: 0 });

  const seen = [];
  await assert.rejects(async () => {
    for await (const chunk of engine.execute({ requestId: "r-stream", model: "m", payload: {} })) seen.push(chunk);
  }, UnsafeReplayError);

  assert.deepEqual(seen, [{ type: "text", data: "partial" }]);
  assert.equal(fallbackCalls, 0);
});

test("journal stores attempt metadata but not request payload", async () => {
  const journal = new MemoryAttemptJournal();
  const engine = new ResilienceEngine([
    {
      id: "only", label: "only", providerId: "local", model: "m", usageClass: "local", priority: 1,
      invoke: async () => ({ stream: stream({ type: "text", data: "ok" }) }),
    },
  ], { journal });

  await collect(engine);
  const serialized = JSON.stringify(journal.events);
  assert.equal(serialized.includes("payload"), false);
  assert.equal(journal.events.some((event) => event.state === "COMPLETED"), true);
});

test("model fallback receives compact continuity handoff context", async () => {
  let fallbackRequest;
  const continuity = {
    async buildHandoffContext({ fromModel, toModel }) {
      return `resume:${fromModel}->${toModel}; active=VERIFYING`;
    },
  };
  const engine = new ResilienceEngine([
    {
      id: "a", label: "a", providerId: "provider-a", model: "model-a", usageClass: "byok", priority: 1,
      invoke: async () => { throw new HttpError(503, "temporary outage"); },
    },
    {
      id: "b", label: "b", providerId: "provider-b", model: "model-b", usageClass: "paid", priority: 2,
      invoke: async (request) => {
        fallbackRequest = request;
        return { stream: stream({ type: "text", data: "continued" }) };
      },
    },
  ], { sleep: async () => undefined, maxSameRouteRetries: 0, continuity });

  const out = await collect(engine);
  assert.equal(out[0].data, "continued");
  assert.equal(fallbackRequest.model, "model-b");
  assert.match(fallbackRequest.handoffContext, /active=VERIFYING/);
});

test("user-selected model is used as the primary route even when another route has higher priority", async () => {
  const calls = [];
  const engine = new ResilienceEngine([
    {
      id: "first", label: "first", providerId: "cline", accountId: "acct-1", model: "model-a", usageClass: "promotional", priority: 1,
      invoke: async () => { calls.push("model-a"); return { stream: stream({ type: "text", data: "a" }) }; },
    },
    {
      id: "selected", label: "selected", providerId: "cline", accountId: "acct-1", model: "deepseek-v4.1-flash", usageClass: "promotional", priority: 50,
      invoke: async () => { calls.push("deepseek-v4.1-flash"); return { stream: stream({ type: "text", data: "selected" }) }; },
    },
  ], {
    routingSettings: {
      selectedModelId: "deepseek-v4.1-flash",
      rateLimitAction: "SWITCH_ACCOUNT_KEEP_MODEL",
    },
  });

  const out = await collect(engine);
  assert.deepEqual(calls, ["deepseek-v4.1-flash"]);
  assert.equal(out[0].data, "selected");
});

test("same-model account mode never changes the selected model", async () => {
  const calls = [];
  const engine = new ResilienceEngine([
    {
      id: "acct-a", label: "acct-a", providerId: "provider", accountId: "a", model: "deepseek-v4.1-flash", usageClass: "organization", priority: 1,
      invoke: async () => { calls.push("a:deepseek"); throw new HttpError(429, "Too many requests"); },
    },
    {
      id: "wrong-model", label: "wrong-model", providerId: "provider", accountId: "a", model: "other-free-model", usageClass: "organization", priority: 2,
      invoke: async () => { calls.push("a:other"); return { stream: stream({ type: "text", data: "wrong" }) }; },
    },
    {
      id: "acct-b", label: "acct-b", providerId: "provider", accountId: "b", model: "deepseek-v4.1-flash", usageClass: "organization", priority: 3,
      invoke: async (request) => { calls.push(`b:${request.model}`); return { stream: stream({ type: "text", data: "same-model" }) }; },
    },
  ], {
    sleep: async () => undefined,
    maxSameRouteRetries: 0,
    routingSettings: {
      selectedModelId: "deepseek-v4.1-flash",
      rateLimitAction: "SWITCH_ACCOUNT_KEEP_MODEL",
    },
  });

  const out = await collect(engine);
  assert.deepEqual(calls, ["a:deepseek", "b:deepseek-v4.1-flash"]);
  assert.equal(out[0].data, "same-model");
});

test("model-switch mode keeps the current account and selects a different model", async () => {
  const calls = [];
  const engine = new ResilienceEngine([
    {
      id: "a-deepseek", label: "a-deepseek", providerId: "provider", accountId: "a", model: "deepseek-v4.1-flash", usageClass: "organization", priority: 1,
      invoke: async () => { calls.push("a:deepseek"); throw new HttpError(429, "Too many requests"); },
    },
    {
      id: "b-other", label: "b-other", providerId: "provider", accountId: "b", model: "other-model", usageClass: "organization", priority: 2,
      invoke: async () => { calls.push("b:other"); return { stream: stream({ type: "text", data: "wrong-account" }) }; },
    },
    {
      id: "a-other", label: "a-other", providerId: "provider", accountId: "a", model: "other-model", usageClass: "organization", priority: 3,
      invoke: async () => { calls.push("a:other"); return { stream: stream({ type: "text", data: "model-switched" }) }; },
    },
  ], {
    sleep: async () => undefined,
    maxSameRouteRetries: 0,
    routingSettings: {
      selectedModelId: "deepseek-v4.1-flash",
      rateLimitAction: "SWITCH_MODEL_KEEP_ACCOUNT",
    },
  });

  const out = await collect(engine);
  assert.deepEqual(calls, ["a:deepseek", "a:other"]);
  assert.equal(out[0].data, "model-switched");
});

test("promotional same-model account transition requires explicit provider-host capability", async () => {
  let secondCalls = 0;
  const routes = [
    {
      id: "promo-a", label: "promo-a", providerId: "cline", accountId: "a", model: "deepseek-v4.1-flash", usageClass: "promotional", priority: 1,
      invoke: async () => { throw new HttpError(429, "Daily free limit reached. Try again in 23h 59m"); },
    },
    {
      id: "promo-b", label: "promo-b", providerId: "cline", accountId: "b", model: "deepseek-v4.1-flash", usageClass: "promotional", priority: 2,
      invoke: async () => { secondCalls += 1; return { stream: stream({ type: "text", data: "ok" }) }; },
    },
  ];

  const blocked = new ResilienceEngine(routes, {
    sleep: async () => undefined,
    maxSameRouteRetries: 0,
    routingSettings: { selectedModelId: "deepseek-v4.1-flash", rateLimitAction: "SWITCH_ACCOUNT_KEEP_MODEL" },
  });
  await assert.rejects(async () => collect(blocked), /Daily free limit/);
  assert.equal(secondCalls, 0);

  const authorized = new ResilienceEngine(routes, {
    sleep: async () => undefined,
    maxSameRouteRetries: 0,
    routingSettings: { selectedModelId: "deepseek-v4.1-flash", rateLimitAction: "SWITCH_ACCOUNT_KEEP_MODEL" },
    providerCapabilities: { allowPromotionalAccountSwitch: true },
  });
  const out = await collect(authorized);
  assert.equal(secondCalls, 1);
  assert.equal(out[0].data, "ok");
});
