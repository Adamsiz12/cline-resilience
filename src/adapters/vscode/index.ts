import type { AttemptEvent, AttemptJournal, RouteRuntime } from "../../core/index.js";
import {
  DEFAULT_USER_ROUTING_SETTINGS,
  type UserRoutingSettings,
  type UserRoutingSettingsStore,
} from "../../settings/index.js";

/** Minimal VS Code-facing surface. The real extension can satisfy this with
 * vscode.SecretStorage, StatusBarItem and OutputChannel without coupling the core to vscode. */
export interface VsCodeSecretStorageLike {
  get(key: string): PromiseLike<string | undefined>;
  store(key: string, value: string): PromiseLike<void>;
  delete(key: string): PromiseLike<void>;
}

export class VsCodeCredentialStore {
  constructor(private readonly secrets: VsCodeSecretStorageLike, private readonly prefix = "cline-resilience") {}

  get(routeId: string): PromiseLike<string | undefined> {
    return this.secrets.get(`${this.prefix}:${routeId}`);
  }

  set(routeId: string, value: string): PromiseLike<void> {
    return this.secrets.store(`${this.prefix}:${routeId}`, value);
  }

  delete(routeId: string): PromiseLike<void> {
    return this.secrets.delete(`${this.prefix}:${routeId}`);
  }
}

export interface VsCodeConfigurationLike {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): PromiseLike<void>;
}

export class VsCodeRoutingSettingsStore implements UserRoutingSettingsStore {
  constructor(private readonly configuration: VsCodeConfigurationLike) {}

  async load(): Promise<UserRoutingSettings> {
    return {
      selectedModelId: this.configuration.get<string>("selectedModelId"),
      rateLimitAction:
        this.configuration.get<UserRoutingSettings["rateLimitAction"]>("rateLimitAction") ??
        DEFAULT_USER_ROUTING_SETTINGS.rateLimitAction,
    };
  }

  async save(settings: UserRoutingSettings): Promise<void> {
    await this.configuration.update("selectedModelId", settings.selectedModelId);
    await this.configuration.update("rateLimitAction", settings.rateLimitAction);
  }
}

export interface VsCodeUiBindings {
  setStatus(text: string, tooltip?: string): void;
  appendLog(line: string): void;
}

export class VsCodeAttemptJournal implements AttemptJournal {
  constructor(private readonly ui: VsCodeUiBindings) {}

  record(event: AttemptEvent): void {
    this.ui.appendLog(
      `[${new Date(event.at).toISOString()}] request=${event.requestId} route=${event.routeId} state=${event.state}` +
        (event.errorKind ? ` error=${event.errorKind}` : "") +
        (event.note ? ` note=${event.note}` : ""),
    );
  }
}

export function formatVsCodeStatus(routes: ReadonlyArray<RouteRuntime>): string {
  const active = routes.find((route) => route.state === "ACTIVE");
  if (active) {
    const account = active.accountLabel ?? active.accountId;
    return `Cline Resilience: ${active.model}${account ? ` @ ${account}` : ""}`;
  }
  const available = routes.find((route) => route.state === "AVAILABLE");
  return available ? `Cline Resilience: ready (${available.label})` : "Cline Resilience: no route";
}
