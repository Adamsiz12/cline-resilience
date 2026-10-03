import type { RouteResponse, RouteContext, ModelRequest, UsageClass } from "../../core/index.js";

export type ClineMode = "plan" | "act";

export interface ClineAuthLike {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId?: string;
  metadata?: Record<string, unknown>;
}

export interface ClineProviderSettingsLike {
  provider?: string;
  model?: string;
  auth?: ClineAuthLike;
  [key: string]: unknown;
}

export interface ClineProviderSettingsManagerLike {
  getProviderSettings(providerId: string): ClineProviderSettingsLike | undefined;
}

export interface ClineResolvedSelectionLike {
  providerId: string;
  modelId: string;
  modelInfo?: Record<string, unknown>;
}

export interface ClineProviderConfigStoreLike {
  readSelection(providerId: string, mode: ClineMode): ClineResolvedSelectionLike | undefined;
  commitSelection(
    providerId: string,
    mode: ClineMode,
    selection: { providerId: string; modelId: string },
    baseModelInfoHint?: Record<string, unknown>,
  ): void | Promise<void>;
}

export interface ClineCatalogModelLike {
  id: string;
  name?: string;
  description?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface ClineHostCatalogLike {
  listModels(providerId: string): Promise<ClineCatalogModelLike[]>;
}

export interface ClineModelInvocationInput {
  providerId: string;
  modelId: string;
  request: ModelRequest;
  context: RouteContext;
}

export interface ClineModelRuntimeLike {
  invoke(input: ClineModelInvocationInput): Promise<RouteResponse>;
}

export interface ClineRouteSpec {
  providerId: string;
  modelId: string;
  label?: string;
  usageClass: UsageClass;
  priority: number;
  enabled?: boolean;
}

export interface ClineAccountIdentity {
  providerId: string;
  accountId?: string;
  accountLabel?: string;
  authenticated: boolean;
}

export interface ClineMessagesFileV1 {
  version: 1;
  updated_at: string;
  agent: "lead" | "subagent" | "teammate";
  sessionId: string;
  taskType?: string;
  system_prompt?: string;
  messages: ClineStoredMessage[];
}

export interface ClineStoredMessage {
  id: string;
  role: "user" | "assistant";
  content: ClineStoredContentBlock[];
  ts?: number;
  modelInfo?: {
    id: string;
    provider: string;
    family?: string;
  };
  metrics?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    cost: number;
  };
}

export type ClineStoredContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: unknown; is_error?: boolean }
  | Record<string, unknown>;
