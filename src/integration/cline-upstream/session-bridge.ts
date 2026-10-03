import type { ContinuityManager } from "../../continuity/index.js";
import type { ClineMessagesFileV1, ClineStoredContentBlock, ClineStoredMessage } from "./types.js";

export interface ClineSessionInspection {
  sessionId: string;
  updatedAt?: number;
  lastModelId?: string;
  lastProviderId?: string;
  lastAssistantCompleted: boolean;
  danglingToolCalls: Array<{ id: string; name: string }>;
  lastUserText?: string;
}

/** Parses Cline's canonical messages-contract-v1 artifact without replaying history. */
export function inspectClineMessagesV1(input: unknown): ClineSessionInspection {
  const file = assertMessagesV1(input);
  const resolvedToolResults = new Set<string>();
  const toolUses = new Map<string, string>();
  let lastUserText: string | undefined;
  let lastAssistant: ClineStoredMessage | undefined;

  for (const message of file.messages) {
    if (message.role === "assistant") lastAssistant = message;
    if (message.role === "user") {
      const text = message.content
        .filter(isTextBlock)
        .map((block) => block.text)
        .join("\n")
        .trim();
      if (text) lastUserText = text;
    }
    for (const block of message.content) {
      if (isToolUse(block)) toolUses.set(block.id, block.name);
      if (isToolResult(block)) resolvedToolResults.add(block.tool_use_id);
    }
  }

  const danglingToolCalls = [...toolUses.entries()]
    .filter(([id]) => !resolvedToolResults.has(id))
    .map(([id, name]) => ({ id, name }));

  return {
    sessionId: file.sessionId,
    updatedAt: Number.isFinite(Date.parse(file.updated_at)) ? Date.parse(file.updated_at) : undefined,
    lastModelId: lastAssistant?.modelInfo?.id,
    lastProviderId: lastAssistant?.modelInfo?.provider,
    lastAssistantCompleted: Boolean(lastAssistant?.metrics),
    danglingToolCalls,
    lastUserText,
  };
}

/** Adds only compact recovery facts to the project's checkpoint. */
export async function syncClineSessionIntoContinuity(
  manager: ContinuityManager,
  input: unknown,
): Promise<ClineSessionInspection> {
  const inspection = inspectClineMessagesV1(input);
  await manager.recordDecision(
    `Cline session ${inspection.sessionId} inspected before handoff`,
    `lastModel=${inspection.lastModelId ?? "unknown"}; provider=${inspection.lastProviderId ?? "unknown"}; danglingTools=${inspection.danglingToolCalls.length}`,
  );
  if (inspection.danglingToolCalls.length > 0) {
    await manager.recordVerification(
      "Cline tool-call boundary",
      "FAIL",
      `Unresolved tool calls: ${inspection.danglingToolCalls.map((tool) => `${tool.name}:${tool.id}`).join(", ")}`,
    );
  } else {
    await manager.recordVerification(
      "Cline tool-call boundary",
      "PASS",
      "No unresolved tool_use blocks in persisted session history",
    );
  }
  return inspection;
}

function assertMessagesV1(input: unknown): ClineMessagesFileV1 {
  if (!input || typeof input !== "object") throw new Error("Invalid Cline messages artifact");
  const row = input as Partial<ClineMessagesFileV1>;
  if (row.version !== 1) throw new Error(`Unsupported Cline messages contract version: ${String(row.version)}`);
  if (typeof row.sessionId !== "string" || !row.sessionId) throw new Error("Cline messages artifact is missing sessionId");
  if (typeof row.updated_at !== "string") throw new Error("Cline messages artifact is missing updated_at");
  if (!Array.isArray(row.messages)) throw new Error("Cline messages artifact is missing messages[]");
  return row as ClineMessagesFileV1;
}

function isTextBlock(block: ClineStoredContentBlock): block is { type: "text"; text: string } {
  return block?.type === "text" && typeof (block as { text?: unknown }).text === "string";
}

function isToolUse(block: ClineStoredContentBlock): block is { type: "tool_use"; id: string; name: string; input: unknown } {
  return block?.type === "tool_use" && typeof (block as { id?: unknown }).id === "string" && typeof (block as { name?: unknown }).name === "string";
}

function isToolResult(block: ClineStoredContentBlock): block is { type: "tool_result"; tool_use_id: string; content: unknown; is_error?: boolean } {
  return block?.type === "tool_result" && typeof (block as { tool_use_id?: unknown }).tool_use_id === "string";
}
