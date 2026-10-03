import { DEFAULT_USER_ROUTING_SETTINGS, type UserRoutingSettings } from "./types.js";

export interface UserRoutingSettingsStore {
  load(): Promise<UserRoutingSettings>;
  save(settings: UserRoutingSettings): Promise<void>;
}

export class MemoryUserRoutingSettingsStore implements UserRoutingSettingsStore {
  private value: UserRoutingSettings;

  constructor(initial: Partial<UserRoutingSettings> = {}) {
    this.value = { ...DEFAULT_USER_ROUTING_SETTINGS, ...initial };
  }

  async load(): Promise<UserRoutingSettings> {
    return { ...this.value };
  }

  async save(settings: UserRoutingSettings): Promise<void> {
    this.value = { ...settings };
  }
}
