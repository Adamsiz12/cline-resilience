export type UsageClass = "byok" | "paid" | "organization" | "local" | "promotional";

export type RouteState =
  | "AVAILABLE"
  | "ACTIVE"
  | "COOLDOWN"
  | "AUTH_REQUIRED"
  | "DISABLED"
  | "UNHEALTHY";

export type AttemptState =
  | "CREATED"
  | "SENDING"
  | "PRE_STREAM_FAILURE"
  | "STREAM_STARTED"
  | "COMPLETED"
  | "SAFE_TO_REPLAY"
  | "UNSAFE_TO_REPLAY";

export interface ModelRequest {
  requestId: string;
  model: string;
  payload: unknown;
  metadata?: Record<string, string | number | boolean>;
  /** Compact operational state injected only when a model/route handoff needs it. */
  handoffContext?: string;
}

export interface StreamChunk {
  type: "text" | "reasoning" | "tool" | "meta";
  data: unknown;
}

export interface RouteResponse {
  stream: AsyncIterable<StreamChunk>;
  responseMetadata?: Record<string, unknown>;
}

export interface RouteContext {
  attempt: number;
  signal?: AbortSignal;
}

export type RouteInvoker = (request: ModelRequest, context: RouteContext) => Promise<RouteResponse>;

export interface RouteDefinition {
  id: string;
  label: string;
  providerId: string;
  model: string;
  /** Optional identity of the credential/account behind this route. */
  accountId?: string;
  accountLabel?: string;
  usageClass: UsageClass;
  priority: number;
  enabled?: boolean;
  invoke: RouteInvoker;
}

export interface RouteRuntime extends RouteDefinition {
  state: RouteState;
  cooldownUntil?: number;
  lastErrorKind?: ErrorKind;
  failures: number;
}

export type ErrorKind =
  | "PROMOTIONAL_QUOTA"
  | "TEMPORARY_RATE_LIMIT"
  | "AUTH"
  | "FORBIDDEN"
  | "SERVER"
  | "TIMEOUT"
  | "NETWORK"
  | "UNKNOWN";

export interface ErrorClassification {
  kind: ErrorKind;
  retryable: boolean;
  retrySameRoute: boolean;
  fallbackAllowed: boolean;
  cooldownMs?: number;
  resetAt?: number;
  status?: number;
  reason: string;
}

export interface AttemptEvent {
  at: number;
  requestId: string;
  routeId: string;
  state: AttemptState;
  attempt: number;
  errorKind?: ErrorKind;
  note?: string;
}

export interface AttemptJournal {
  record(event: AttemptEvent): Promise<void> | void;
}

export interface SleepFn {
  (ms: number): Promise<void>;
}

export interface ResilienceOptions {
  maxSameRouteRetries?: number;
  defaultRetryDelayMs?: number;
  sleep?: SleepFn;
  now?: () => number;
  journal?: AttemptJournal;
  /** Optional bridge that creates a compact task handoff when fallback changes route/model. */
  continuity?: import("../continuity/types.js").ContinuityContextProvider;
  /** User-selectable primary model and rate-limit behavior. */
  routingSettings?: import("../settings/types.js").UserRoutingSettings;
  /** Provider capability gates supplied by the host adapter. */
  providerCapabilities?: import("../settings/types.js").ProviderPolicyCapabilities;
}
