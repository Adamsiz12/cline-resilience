import assert from "node:assert/strict";
import test from "node:test";
import {
  ClineFreeModelCatalog,
  ClineLiveFreeModelSource,
  HostFreeModelSource,
  MemoryCatalogCache,
} from "../dist/src/index.js";

function fakeResponse(body, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

test("Cline live source uses only the official free array, including non cline-free ids", async () => {
  const source = new ClineLiveFreeModelSource(async () => fakeResponse({
    recommended: [{ id: "paid/recommended", name: "paid", tags: [] }],
    free: [
      { id: "cline-free/deepseek-v4.1-flash", name: "DeepSeek", description: "free", tags: [] },
      { id: "stealth/space-bunny-alpha", name: "Bunny", tags: ["NEW"] },
    ],
    clinePass: [{ id: "cline-pass/x", name: "pass", tags: [] }],
  }), "https://example.test/models", () => 42);

  const snapshot = await source.load();
  assert.deepEqual(snapshot.models.map((model) => model.id), [
    "cline-free/deepseek-v4.1-flash",
    "stealth/space-bunny-alpha",
  ]);
  assert.equal(snapshot.fetchedAt, 42);
});

test("catalog prefers Cline host source and falls back to cache", async () => {
  const cache = new MemoryCatalogCache();
  const host = new HostFreeModelSource(async () => [
    { id: "cline-free/current", name: "Current", tags: [] },
  ], () => 10);
  const catalog = new ClineFreeModelCatalog([host], cache);
  const live = await catalog.refresh();
  assert.equal(live.models[0].id, "cline-free/current");

  const failing = new HostFreeModelSource(async () => { throw new Error("host unavailable"); });
  const cachedCatalog = new ClineFreeModelCatalog([failing], cache);
  const cached = await cachedCatalog.refresh();
  assert.equal(cached.models[0].id, "cline-free/current");
});

test("every model in Cline free tier becomes a Cline-hosted promotional route", async () => {
  const { buildClineFreeRoutes } = await import("../dist/src/index.js");
  const snapshot = {
    fetchedAt: 1,
    source: "cline-host-catalog",
    models: [
      { id: "cline-free/deepseek-v4.1-flash", name: "DeepSeek", tags: [] },
      { id: "stealth/space-bunny-alpha", name: "Bunny", tags: [] },
    ],
  };
  const seen = [];
  const routes = buildClineFreeRoutes(snapshot, (modelId) => async () => {
    seen.push(modelId);
    return { stream: (async function* () { yield { type: "text", data: "ok" }; })() };
  });
  assert.equal(routes.length, 2);
  assert.equal(routes.every((route) => route.providerId === "cline"), true);
  assert.equal(routes.every((route) => route.usageClass === "promotional"), true);
  assert.deepEqual(routes.map((route) => route.model), snapshot.models.map((m) => m.id));
});

test("catalog monitor emits only when Cline free model ids change", async () => {
  const { FreeModelCatalogMonitor } = await import("../dist/src/index.js");
  let generation = 0;
  const source = {
    async load() {
      generation += 1;
      const ids = generation < 3 ? ["cline-free/a"] : ["cline-free/a", "stealth/b"];
      return { fetchedAt: generation, source: "host", models: ids.map((id) => ({ id, name: id, tags: [] })) };
    },
  };
  const catalog = new ClineFreeModelCatalog([source], new MemoryCatalogCache());
  const changes = [];
  const monitor = new FreeModelCatalogMonitor(catalog, (snapshot) => changes.push(snapshot.models.map((m) => m.id)));
  await monitor.refreshOnce();
  await monitor.refreshOnce();
  await monitor.refreshOnce();
  assert.equal(changes.length, 2);
  assert.deepEqual(changes[1], ["cline-free/a", "stealth/b"]);
});

test("free catalog becomes a user-selectable model list without hard-coded model ids", async () => {
  const { buildFreeModelChoices } = await import("../dist/src/index.js");
  const snapshot = {
    fetchedAt: 1,
    source: "cline-host-catalog",
    models: [
      { id: "cline-free/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", description: "fast", tags: ["FREE"] },
      { id: "stealth/space-bunny-alpha", name: "Space Bunny", tags: [] },
    ],
  };
  const choices = buildFreeModelChoices(snapshot);
  assert.deepEqual(choices.map((choice) => choice.id), snapshot.models.map((model) => model.id));
  assert.equal(choices[0].label, "DeepSeek V4.1 Flash");
});

test("settings view model exposes dynamic model selector and both rate-limit actions", async () => {
  const { buildRoutingSettingsViewModel } = await import("../dist/src/index.js");
  const snapshot = {
    fetchedAt: 1,
    source: "cline-host-catalog",
    models: [
      { id: "cline-free/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", tags: ["FREE"] },
      { id: "other/free", name: "Other", tags: [] },
    ],
  };
  const view = buildRoutingSettingsViewModel(snapshot, {
    selectedModelId: "cline-free/deepseek-v4.1-flash",
    rateLimitAction: "SWITCH_ACCOUNT_KEEP_MODEL",
  });
  assert.equal(view.selectedModelId, "cline-free/deepseek-v4.1-flash");
  assert.equal(view.modelChoices.length, 2);
  assert.deepEqual(view.rateLimitActionChoices.map((choice) => choice.id), [
    "SWITCH_ACCOUNT_KEEP_MODEL",
    "SWITCH_MODEL_KEEP_ACCOUNT",
  ]);
});
