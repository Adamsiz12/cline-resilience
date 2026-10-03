import type { ContinuityStore, ProjectCheckpoint } from "../../continuity/index.js";

export interface TextFileIo {
  readText(path: string): Promise<string | undefined>;
  writeTextAtomic(path: string, content: string): Promise<void>;
}

/**
 * Host-neutral JSON checkpoint store. VS Code should bind this to workspace.fs / Node fs;
 * Desktop should bind it to the sidecar's filesystem layer. Atomicity is delegated to the
 * host so this package does not force Node-only APIs into the shared core.
 */
export class JsonTextContinuityStore implements ContinuityStore {
  constructor(readonly path: string, private readonly io: TextFileIo) {}

  async load(): Promise<ProjectCheckpoint | undefined> {
    const text = await this.io.readText(this.path);
    if (text == null) return undefined;
    return JSON.parse(text) as ProjectCheckpoint;
  }

  async save(checkpoint: ProjectCheckpoint): Promise<void> {
    await this.io.writeTextAtomic(this.path, `${JSON.stringify(checkpoint, null, 2)}\n`);
  }
}
