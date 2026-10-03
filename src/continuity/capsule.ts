import type { ContinuityCapsuleOptions, ProjectCheckpoint } from "./types.js";

const DEFAULT_MAX_CHARS = 6_000;

/**
 * Builds a compact, operational handoff. It intentionally does NOT summarize the whole
 * conversation: Cline already owns canonical session history and compaction. This capsule
 * only carries state a replacement model must know to avoid repeating work or assuming a
 * half-finished edit is complete.
 */
export function buildContinuityCapsule(
  checkpoint: ProjectCheckpoint,
  options: ContinuityCapsuleOptions = {},
): string {
  const maxChars = Math.max(1_500, options.maxChars ?? DEFAULT_MAX_CHARS);
  const lines: string[] = [
    "<cline_resilience_continuity>",
    "RECOVERY CONTRACT:",
    "- Preserve the same task objective; do not restart project discovery.",
    "- If ACTIVE STEP is IN_PROGRESS or VERIFYING, treat it as incomplete until you inspect current files/state and verify it.",
    "- Never claim a step is complete without its completion criteria or verification evidence.",
    "- Prefer the NEXT ACTIONS below; consult older conversation only when this capsule is insufficient.",
    "",
    `PROJECT: ${checkpoint.projectId}`,
    `TASK: ${checkpoint.taskId}`,
    `OBJECTIVE: ${checkpoint.objective}`,
  ];

  if (checkpoint.phase) lines.push(`PHASE: ${checkpoint.phase}`);

  if (checkpoint.activeStep) {
    const step = checkpoint.activeStep;
    lines.push("", "ACTIVE STEP:");
    lines.push(`- [${step.state}] ${step.id}: ${step.title}`);
    for (const criterion of step.completionCriteria ?? []) lines.push(`  criterion: ${criterion}`);
    for (const note of (step.notes ?? []).slice(-4)) lines.push(`  note: ${note}`);
  } else {
    lines.push("", "ACTIVE STEP: none");
  }

  appendList(lines, "NEXT ACTIONS", checkpoint.nextActions.slice(0, 5));
  appendList(lines, "BLOCKERS", checkpoint.blockers.slice(0, 5));
  appendList(lines, "CONSTRAINTS", checkpoint.constraints.slice(0, 8));

  const verifications = checkpoint.verifications
    .slice(-(options.verificationLimit ?? 8))
    .map((item) => `${item.status}: ${item.label}${item.detail ? ` — ${item.detail}` : ""}`);
  appendList(lines, "LATEST VERIFICATION", verifications);

  const files = checkpoint.files
    .slice(-(options.fileLimit ?? 12))
    .map((item) => `${item.status}: ${item.path}${item.reason ? ` — ${item.reason}` : ""}`);
  appendList(lines, "FILES TO KNOW", files);

  appendList(lines, "RECENTLY COMPLETED", checkpoint.completed.slice(-(options.completedLimit ?? 8)));

  const decisions = checkpoint.decisions
    .slice(-(options.decisionLimit ?? 6))
    .map((item) => `${item.decision}${item.rationale ? ` — because: ${item.rationale}` : ""}`);
  appendList(lines, "KEY DECISIONS", decisions);
  lines.push("</cline_resilience_continuity>");

  return fitPreservingCriticalPrefix(lines, maxChars);
}

function appendList(lines: string[], title: string, items: string[]): void {
  if (items.length === 0) return;
  lines.push("", `${title}:`);
  for (const item of items) lines.push(`- ${item}`);
}

function fitPreservingCriticalPrefix(lines: string[], maxChars: number): string {
  const full = lines.join("\n");
  if (full.length <= maxChars) return full;

  // Keep recovery contract, objective, and active step. Drop oldest tail material first.
  const output: string[] = [];
  let length = 0;
  for (const line of lines) {
    const addition = line.length + (output.length ? 1 : 0);
    if (length + addition > maxChars - 80) break;
    output.push(line);
    length += addition;
  }
  output.push("", "[capsule truncated to configured budget]", "</cline_resilience_continuity>");
  return output.join("\n");
}
