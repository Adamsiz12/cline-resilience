import {
  DEFAULT_USER_ROUTING_SETTINGS,
  type UserRoutingSettings,
  type UserRoutingSettingsStore,
} from "../../settings/index.js";

export interface RoutingSettingsTextIo {
  readText(path: string): Promise<string | undefined>;
  writeTextAtomic(path: string, content: string): Promise<void>;
}

/** Host-neutral JSON settings store. The host supplies workspace.fs / sidecar fs I/O. */
export class JsonTextUserRoutingSettingsStore implements UserRoutingSettingsStore {
  constructor(readonly path: string, private readonly io: RoutingSettingsTextIo) {}

  async load(): Promise<UserRoutingSettings> {
    const text = await this.io.readText(this.path);
    if (text == null) return { ...DEFAULT_USER_ROUTING_SETTINGS };
    const parsed = JSON.parse(text) as Partial<UserRoutingSettings>;
    return { ...DEFAULT_USER_ROUTING_SETTINGS, ...parsed };
  }

  async save(settings: UserRoutingSettings): Promise<void> {
    await this.io.writeTextAtomic(this.path, `${JSON.stringify(settings, null, 2)}\n`);
  }
}
