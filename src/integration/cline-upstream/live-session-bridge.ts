export interface ClineActiveSessionRefLike {
  sessionId: string;
  isRunning?: boolean;
  startConfig?: {
    providerId?: string;
    modelId?: string;
  };
}

/**
 * Structural subset of Cline's current VS Code SdkSessionLifecycle.
 * The real Cline surface (v4.1.22) exposes getActiveSession() and
 * updateActiveSessionModel(modelId), where the latter forwards the update to
 * sdkHost.updateSessionModel(activeSession.sessionId, modelId).
 */
export interface ClineSessionLifecycleLike {
  getActiveSession(): ClineActiveSessionRefLike | undefined;
  updateActiveSessionModel(modelId: string): Promise<boolean>;
}

export interface ClineLiveModelSwitchResult {
  sessionId: string;
  previousModelId?: string;
  modelId: string;
  sessionPreserved: true;
}

/**
 * Switches the model through Cline's live-session seam and proves the active
 * session identity did not change. This is safer than only mutating provider
 * defaults because the existing task/history remains attached to the same
 * session id.
 */
export class ClineLiveSessionModelBridge {
  constructor(private readonly lifecycle: ClineSessionLifecycleLike) {}

  current(): ClineActiveSessionRefLike | undefined {
    const active = this.lifecycle.getActiveSession();
    return active ? structuredClone(active) : undefined;
  }

  async switchModelPreservingSession(modelId: string): Promise<ClineLiveModelSwitchResult> {
    const requestedModelId = modelId.trim();
    if (!requestedModelId) throw new Error("Cline live model switch requires a model id");

    const before = this.lifecycle.getActiveSession();
    if (!before) throw new Error("No active Cline session is available for model switching");

    // A turn that is actively streaming/tooling is not a safe replay/switch boundary.
    // The resilience engine only calls fallback before output, but this extra guard
    // fails closed if host state disagrees.
    if (before.isRunning) {
      throw new Error(`Cline session ${before.sessionId} is still running; refusing mid-turn model switch`);
    }

    const sessionId = before.sessionId;
    const previousModelId = before.startConfig?.modelId;
    const supported = await this.lifecycle.updateActiveSessionModel(requestedModelId);
    if (!supported) {
      throw new Error("Active Cline host does not expose updateSessionModel; refusing fallback");
    }

    const after = this.lifecycle.getActiveSession();
    if (!after) {
      throw new Error("Cline active session disappeared during model switch");
    }
    if (after.sessionId !== sessionId) {
      throw new Error(`Cline session identity changed during model switch: ${sessionId} -> ${after.sessionId}`);
    }

    return {
      sessionId,
      previousModelId,
      modelId: requestedModelId,
      sessionPreserved: true,
    };
  }
}
