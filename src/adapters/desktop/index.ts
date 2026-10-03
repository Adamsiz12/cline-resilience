import type { AttemptEvent, AttemptJournal, RouteRuntime } from "../../core/index.js";
import type { ModelChoice, UserRoutingSettings } from "../../settings/index.js";

/**
 * Desktop adapter intentionally receives secrets from the host. In the Cline Desktop
 * sidecar this should be backed by the platform keychain / DPAPI integration selected
 * by the host, not by a plaintext JSON file.
 */
export interface DesktopSecretProvider {
  getSecret(routeId: string): Promise<string | undefined>;
}

export class EnvDesktopSecretProvider implements DesktopSecretProvider {
  constructor(
    private readonly mapping: Record<string, string>,
    private readonly env: Record<string, string | undefined> = readProcessEnv(),
  ) {}

  async getSecret(routeId: string): Promise<string | undefined> {
    const envName = this.mapping[routeId];
    return envName ? this.env[envName] : undefined;
  }
}

export interface DesktopEventSink {
  emit(event: string, payload: unknown): void;
}

export class DesktopAttemptJournal implements AttemptJournal {
  constructor(private readonly sink: DesktopEventSink) {}

  record(event: AttemptEvent): void {
    this.sink.emit("resilience:attempt", event);
  }
}

export interface DesktopSettingsPayload {
  settings: UserRoutingSettings;
  modelChoices: ModelChoice[];
}

export function desktopSettingsPayload(settings: UserRoutingSettings, modelChoices: ModelChoice[]): DesktopSettingsPayload {
  return { settings: { ...settings }, modelChoices: modelChoices.map((choice) => ({ ...choice, tags: [...choice.tags] })) };
}

export function desktopStatusPayload(routes: ReadonlyArray<RouteRuntime>): unknown {
  return routes.map(({ invoke: _invoke, ...route }) => route);
}

function readProcessEnv(): Record<string, string | undefined> {
  const maybeProcess = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process;
  return maybeProcess?.env ?? {};
}
