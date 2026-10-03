import {
  buildRoutingSettingsViewModel,
  type FreeModelSnapshot,
  type UserRoutingSettings,
} from "../src/index.js";

const snapshot: FreeModelSnapshot = {
  fetchedAt: Date.now(),
  source: "cline-host-catalog",
  models: [
    { id: "cline-free/deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", tags: ["FREE"] },
    { id: "example/free-model-b", name: "Other Free Model", tags: ["FREE"] },
  ],
};

const settings: UserRoutingSettings = {
  selectedModelId: "cline-free/deepseek-v4.1-flash",
  rateLimitAction: "SWITCH_ACCOUNT_KEEP_MODEL",
};

console.log(JSON.stringify(buildRoutingSettingsViewModel(snapshot, settings), null, 2));
