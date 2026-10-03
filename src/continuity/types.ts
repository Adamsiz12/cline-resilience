export type WorkStepState = "PENDING" | "IN_PROGRESS" | "VERIFYING" | "DONE" | "BLOCKED";

export interface WorkStep {
  id: string;
  title: string;
  state: WorkStepState;
  startedAt?: number;
  updatedAt: number;
  completionCriteria?: string[];
  notes?: string[];
}

export interface FileTouch {
  path: string;
  reason?: string;
  status: "PLANNED" | "MODIFIED" | "VERIFIED";
  updatedAt: number;
}

export interface VerificationRecord {
  label: string;
  status: "PASS" | "FAIL" | "NOT_RUN";
  detail?: string;
  at: number;
}

export interface DecisionRecord {
  decision: string;
  rationale?: string;
  at: number;
}

export interface ProjectCheckpoint {
  schemaVersion: 1;
  projectId: string;
  taskId: string;
  objective: string;
  phase?: string;
  updatedAt: number;
  activeStep?: WorkStep;
  completed: string[];
  nextActions: string[];
  blockers: string[];
  constraints: string[];
  files: FileTouch[];
  verifications: VerificationRecord[];
  decisions: DecisionRecord[];
}

export interface ContinuityStore {
  load(): Promise<ProjectCheckpoint | undefined>;
  save(checkpoint: ProjectCheckpoint): Promise<void>;
}

export interface ContinuityCapsuleOptions {
  maxChars?: number;
  completedLimit?: number;
  fileLimit?: number;
  verificationLimit?: number;
  decisionLimit?: number;
}

export interface ContinuityContextProvider {
  buildHandoffContext(input: {
    requestId: string;
    fromRouteId: string;
    toRouteId: string;
    fromModel: string;
    toModel: string;
  }): Promise<string | undefined>;
}
