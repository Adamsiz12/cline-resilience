import { buildContinuityCapsule } from "./capsule.js";
import type {
  ContinuityCapsuleOptions,
  ContinuityContextProvider,
  ContinuityStore,
  DecisionRecord,
  FileTouch,
  ProjectCheckpoint,
  VerificationRecord,
  WorkStep,
} from "./types.js";

export interface CreateCheckpointInput {
  projectId: string;
  taskId: string;
  objective: string;
  phase?: string;
  constraints?: string[];
  nextActions?: string[];
}

export class ContinuityManager implements ContinuityContextProvider {
  private checkpoint?: ProjectCheckpoint;

  constructor(
    private readonly store: ContinuityStore,
    private readonly capsuleOptions: ContinuityCapsuleOptions = {},
    private readonly now: () => number = Date.now,
  ) {}

  async init(input?: CreateCheckpointInput): Promise<ProjectCheckpoint> {
    const existing = await this.store.load();
    if (existing) {
      this.checkpoint = normalize(existing);
      return this.snapshot();
    }
    if (!input) throw new Error("Continuity checkpoint does not exist and no initialization input was provided");

    this.checkpoint = normalize({
      schemaVersion: 1,
      projectId: input.projectId,
      taskId: input.taskId,
      objective: input.objective,
      phase: input.phase,
      updatedAt: this.now(),
      completed: [],
      nextActions: input.nextActions ?? [],
      blockers: [],
      constraints: input.constraints ?? [],
      files: [],
      verifications: [],
      decisions: [],
    });
    await this.persist();
    return this.snapshot();
  }

  snapshot(): ProjectCheckpoint {
    if (!this.checkpoint) throw new Error("ContinuityManager is not initialized");
    return structuredClone(this.checkpoint);
  }

  async setPhase(phase: string): Promise<void> {
    this.state().phase = phase;
    await this.persist();
  }

  async beginStep(id: string, title: string, completionCriteria: string[] = []): Promise<void> {
    const now = this.now();
    this.state().activeStep = {
      id,
      title,
      state: "IN_PROGRESS",
      startedAt: now,
      updatedAt: now,
      completionCriteria: [...completionCriteria],
      notes: [],
    };
    await this.persist();
  }

  async noteActiveStep(note: string): Promise<void> {
    const step = this.requireActive();
    step.notes = boundedPush(step.notes ?? [], note, 8);
    step.updatedAt = this.now();
    await this.persist();
  }

  async markVerifying(note?: string): Promise<void> {
    const step = this.requireActive();
    step.state = "VERIFYING";
    step.updatedAt = this.now();
    if (note) step.notes = boundedPush(step.notes ?? [], note, 8);
    await this.persist();
  }

  async completeStep(summary?: string): Promise<void> {
    const state = this.state();
    const step = this.requireActive();
    step.state = "DONE";
    step.updatedAt = this.now();
    state.completed = boundedPush(state.completed, summary ?? `${step.id}: ${step.title}`, 20);
    state.activeStep = undefined;
    await this.persist();
  }

  async blockStep(reason: string): Promise<void> {
    const step = this.requireActive();
    step.state = "BLOCKED";
    step.updatedAt = this.now();
    step.notes = boundedPush(step.notes ?? [], reason, 8);
    this.state().blockers = boundedPush(this.state().blockers, reason, 8);
    await this.persist();
  }

  async recordFile(path: string, status: FileTouch["status"], reason?: string): Promise<void> {
    const state = this.state();
    const current = state.files.find((item) => item.path === path);
    if (current) {
      current.status = status;
      current.reason = reason ?? current.reason;
      current.updatedAt = this.now();
    } else {
      state.files.push({ path, status, reason, updatedAt: this.now() });
    }
    state.files = state.files.slice(-30);
    await this.persist();
  }

  async recordVerification(
    label: string,
    status: VerificationRecord["status"],
    detail?: string,
  ): Promise<void> {
    this.state().verifications = boundedPush(
      this.state().verifications,
      { label, status, detail, at: this.now() },
      20,
    );
    await this.persist();
  }

  async recordDecision(decision: string, rationale?: string): Promise<void> {
    const record: DecisionRecord = { decision, rationale, at: this.now() };
    this.state().decisions = boundedPush(this.state().decisions, record, 16);
    await this.persist();
  }

  async setNextActions(actions: string[]): Promise<void> {
    this.state().nextActions = actions.slice(0, 8);
    await this.persist();
  }

  async setConstraints(constraints: string[]): Promise<void> {
    this.state().constraints = constraints.slice(0, 12);
    await this.persist();
  }

  async clearBlocker(blocker: string): Promise<void> {
    this.state().blockers = this.state().blockers.filter((item) => item !== blocker);
    await this.persist();
  }

  async buildHandoffContext(input: {
    requestId: string;
    fromRouteId: string;
    toRouteId: string;
    fromModel: string;
    toModel: string;
  }): Promise<string | undefined> {
    if (!this.checkpoint) {
      const loaded = await this.store.load();
      if (!loaded) return undefined;
      this.checkpoint = normalize(loaded);
    }
    const capsule = buildContinuityCapsule(this.checkpoint, this.capsuleOptions);
    return `${capsule}\n\nMODEL HANDOFF: ${input.fromModel} (${input.fromRouteId}) -> ${input.toModel} (${input.toRouteId}); request=${input.requestId}`;
  }

  private state(): ProjectCheckpoint {
    if (!this.checkpoint) throw new Error("ContinuityManager is not initialized");
    return this.checkpoint;
  }

  private requireActive(): WorkStep {
    const active = this.state().activeStep;
    if (!active) throw new Error("No active work step");
    return active;
  }

  private async persist(): Promise<void> {
    const state = this.state();
    state.updatedAt = this.now();
    await this.store.save(normalize(state));
  }
}

function normalize(input: ProjectCheckpoint): ProjectCheckpoint {
  return {
    ...structuredClone(input),
    schemaVersion: 1,
    completed: (input.completed ?? []).slice(-20),
    nextActions: (input.nextActions ?? []).slice(0, 8),
    blockers: (input.blockers ?? []).slice(-8),
    constraints: (input.constraints ?? []).slice(0, 12),
    files: (input.files ?? []).slice(-30),
    verifications: (input.verifications ?? []).slice(-20),
    decisions: (input.decisions ?? []).slice(-16),
  };
}

function boundedPush<T>(items: T[], item: T, max: number): T[] {
  return [...items, item].slice(-max);
}
