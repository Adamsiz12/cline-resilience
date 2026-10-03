export interface FreeModelDescriptor {
  id: string;
  name: string;
  description?: string;
  tags: string[];
}

export interface FreeModelSnapshot {
  fetchedAt: number;
  source: string;
  models: FreeModelDescriptor[];
}

export interface FreeModelSource {
  load(): Promise<FreeModelSnapshot>;
}

export interface CatalogCache {
  load(): Promise<FreeModelSnapshot | undefined>;
  save(snapshot: FreeModelSnapshot): Promise<void>;
}
