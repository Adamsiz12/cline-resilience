import type { ContinuityStore, ProjectCheckpoint } from "./types.js";

export class MemoryContinuityStore implements ContinuityStore {
  private value?: ProjectCheckpoint;

  constructor(seed?: ProjectCheckpoint) {
    this.value = seed ? structuredClone(seed) : undefined;
  }

  async load(): Promise<ProjectCheckpoint | undefined> {
    return this.value ? structuredClone(this.value) : undefined;
  }

  async save(checkpoint: ProjectCheckpoint): Promise<void> {
    this.value = structuredClone(checkpoint);
  }
}

export class CallbackContinuityStore implements ContinuityStore {
  constructor(
    private readonly reader: () => Promise<ProjectCheckpoint | undefined>,
    private readonly writer: (checkpoint: ProjectCheckpoint) => Promise<void>,
  ) {}

  load(): Promise<ProjectCheckpoint | undefined> {
    return this.reader();
  }

  save(checkpoint: ProjectCheckpoint): Promise<void> {
    return this.writer(checkpoint);
  }
}
