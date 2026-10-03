import assert from "node:assert/strict";
import test from "node:test";
import {
  ContinuityManager,
  MemoryContinuityStore,
  buildContinuityCapsule,
} from "../dist/src/index.js";

test("continuity capsule makes unfinished work explicit and stays compact", async () => {
  const store = new MemoryContinuityStore();
  const manager = new ContinuityManager(store, { maxChars: 3000 }, () => 1000);
  await manager.init({
    projectId: "demo",
    taskId: "task-1",
    objective: "Finish the feature without redoing project discovery",
    constraints: ["Preserve the same Cline session", "Verify incomplete edits before continuing"],
    nextActions: ["Inspect current diff", "Run tests", "Continue implementation"],
  });
  await manager.beginStep("S2", "Refactor provider adapter", ["tests pass", "no partial edit remains"]);
  await manager.recordFile("src/provider.ts", "MODIFIED", "adapter refactor");
  await manager.recordVerification("unit tests", "NOT_RUN");

  const capsule = buildContinuityCapsule(manager.snapshot(), { maxChars: 3000 });
  assert.match(capsule, /IN_PROGRESS/);
  assert.match(capsule, /treat it as incomplete/i);
  assert.match(capsule, /src\/provider\.ts/);
  assert.ok(capsule.length <= 3000);
});

test("completion clears active step and preserves concise history", async () => {
  const manager = new ContinuityManager(new MemoryContinuityStore(), {}, () => 2000);
  await manager.init({ projectId: "p", taskId: "t", objective: "o" });
  await manager.beginStep("S1", "Implement continuity", ["tests pass"]);
  await manager.markVerifying("implementation finished; verifying now");
  await manager.recordVerification("npm test", "PASS", "all tests passed");
  await manager.completeStep("S1 continuity implemented and verified");
  const state = manager.snapshot();
  assert.equal(state.activeStep, undefined);
  assert.equal(state.completed.at(-1), "S1 continuity implemented and verified");
  assert.equal(state.verifications.at(-1).status, "PASS");
});
