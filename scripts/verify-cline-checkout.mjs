#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(process.argv[2] || process.env.CLINE_SOURCE_DIR || ".");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function read(relativePath) {
  const path = join(root, relativePath);
  if (!existsSync(path)) {
    fail(`missing ${relativePath}`);
    return null;
  }
  return readFileSync(path, "utf8");
}

function requirePatterns(relativePath, patterns) {
  const text = read(relativePath);
  if (text === null) return;
  let ok = true;
  for (const pattern of patterns) {
    if (!text.includes(pattern)) {
      ok = false;
      fail(`${relativePath} missing required surface: ${pattern}`);
    }
  }
  if (ok) pass(relativePath);
}

console.log(`Cline checkout: ${root}`);
if (!existsSync(root) || !statSync(root).isDirectory()) {
  fail("checkout directory does not exist");
  process.exit();
}

requirePatterns("apps/vscode/src/sdk/sdk-session-lifecycle.ts", [
  "getActiveSession()",
  "updateActiveSessionModel(modelId",
  "sdkHost.updateSessionModel(activeSession.sessionId, modelId)",
]);

requirePatterns("apps/vscode/src/sdk/model-catalog/store.ts", [
  "readSelection",
  "commitSelection",
]);

requirePatterns("apps/vscode/src/sdk/auth-service.ts", [
  "ProviderSettingsManager",
  "accountId",
]);

requirePatterns("sdk/packages/core/docs/messages-contract-v1.md", [
  "messages.json contract — v1",
  "<sessionId>.messages.json",
  "tool_use",
  "tool_result",
]);

requirePatterns("apps/examples/desktop-app/README.md", [
  "Tauri desktop shell + Bun sidecar backend + Next.js UI",
  "canonical shared Cline Hub",
]);

if (process.exitCode) {
  console.error("\nCline checkout is NOT compatible with the pinned v0.5 integration contract.");
} else {
  console.log("\nCline checkout satisfies the v0.5 structural integration contract.");
}
