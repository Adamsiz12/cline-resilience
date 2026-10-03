import { UnsafeReplayError } from "./errors.js";
import { classifyError } from "./error-classifier.js";
import { MemoryAttemptJournal } from "./journal.js";
import { RoutePool } from "./route-pool.js";
import type {
  AttemptEvent,
  ErrorClassification,
  ModelRequest,
  ResilienceOptions,
  RouteDefinition,
  RouteRuntime,
  StreamChunk,
} from "./types.js";

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class ResilienceEngine {
  readonly pool: RoutePool;
  readonly journal;
  private readonly maxSameRouteRetries: number;
  private readonly defaultRetryDelayMs: number;
  private readonly sleep;
  private readonly now;
  private readonly continuity;
  private readonly routingSettings;
  private readonly providerCapabilities;

  constructor(routes: RouteDefinition[], options: ResilienceOptions = {}) {
    this.now = options.now ?? Date.now;
    this.pool = new RoutePool(routes, this.now);
    this.journal = options.journal ?? new MemoryAttemptJournal();
    this.maxSameRouteRetries = options.maxSameRouteRetries ?? 2;
    this.defaultRetryDelayMs = options.defaultRetryDelayMs ?? 500;
    this.sleep = options.sleep ?? defaultSleep;
    this.continuity = options.continuity;
    this.routingSettings = options.routingSettings;
    this.providerCapabilities = options.providerCapabilities ?? {};
  }

  async *execute(request: ModelRequest, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
    let activeRequest: ModelRequest = request;
    const first = this.pool.firstAvailable(this.routingSettings);
    if (!first) {
      const selected = this.routingSettings?.selectedModelId;
      throw new Error(selected
        ? `No available route for selected model: ${selected}`
        : "No available routes");
    }
    activeRequest = { ...request, model: first.model };

    let route = first;
    let globalAttempt = 0;
    const visited = new Set<string>();

    while (route) {
      visited.add(route.id);
      let sameRouteRetry = 0;

      while (true) {
        globalAttempt += 1;
        await this.record(request.requestId, route.id, "CREATED", globalAttempt);
        this.pool.markActive(route.id);
        await this.record(request.requestId, route.id, "SENDING", globalAttempt);

        let streamStarted = false;
        let outputChunks = 0;

        try {
          const response = await route.invoke(activeRequest, { attempt: globalAttempt, signal });
          for await (const chunk of response.stream) {
            if (!streamStarted) {
              streamStarted = true;
              await this.record(request.requestId, route.id, "STREAM_STARTED", globalAttempt);
            }
            outputChunks += 1;
            yield chunk;
          }

          this.pool.markAvailable(route.id);
          await this.record(request.requestId, route.id, "COMPLETED", globalAttempt);
          return;
        } catch (error) {
          const classification = classifyError(error, this.now());
          this.pool.markFailure(route.id, classification);

          if (streamStarted || outputChunks > 0) {
            await this.record(request.requestId, route.id, "UNSAFE_TO_REPLAY", globalAttempt, classification);
            throw new UnsafeReplayError(
              `Route ${route.label} failed after streaming began (${classification.kind}).`,
              { cause: error },
            );
          }

          await this.record(request.requestId, route.id, "PRE_STREAM_FAILURE", globalAttempt, classification);

          if (classification.retryable && classification.retrySameRoute && sameRouteRetry < this.maxSameRouteRetries) {
            sameRouteRetry += 1;
            await this.record(request.requestId, route.id, "SAFE_TO_REPLAY", globalAttempt, classification, "same-route retry");
            const delayMs = classification.cooldownMs ?? this.defaultRetryDelayMs * sameRouteRetry;
            if (delayMs > 0) await this.sleep(delayMs);
            this.pool.markAvailable(route.id);
            continue;
          }

          if (!classification.fallbackAllowed) throw error;

          await this.record(request.requestId, route.id, "SAFE_TO_REPLAY", globalAttempt, classification, "route fallback");
          const candidates = this.pool
            .fallbackCandidates(route, classification, this.routingSettings, this.providerCapabilities)
            .filter((candidate) => !visited.has(candidate.id));
          const next = candidates[0];
          if (!next) throw error;

          if (this.continuity && (next.model !== route.model || next.id !== route.id)) {
            const handoffContext = await this.continuity.buildHandoffContext({
              requestId: request.requestId,
              fromRouteId: route.id,
              toRouteId: next.id,
              fromModel: route.model,
              toModel: next.model,
            });
            activeRequest = handoffContext
              ? { ...request, model: next.model, handoffContext }
              : { ...request, model: next.model };
          } else {
            activeRequest = { ...request, model: next.model };
          }

          route = next;
          break;
        }
      }
    }
  }

  private async record(
    requestId: string,
    routeId: string,
    state: AttemptEvent["state"],
    attempt: number,
    error?: ErrorClassification,
    note?: string,
  ): Promise<void> {
    await this.journal.record({
      at: this.now(),
      requestId,
      routeId,
      state,
      attempt,
      errorKind: error?.kind,
      note,
    });
  }
}
