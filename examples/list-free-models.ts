import { ClineFreeModelCatalog, ClineLiveFreeModelSource } from "../src/index.js";

const catalog = new ClineFreeModelCatalog([new ClineLiveFreeModelSource()]);
const snapshot = await catalog.refresh();
console.log(`Source: ${snapshot.source}`);
console.log(`Fetched: ${new Date(snapshot.fetchedAt).toISOString()}`);
for (const model of snapshot.models) console.log(`- ${model.id} :: ${model.name}`);
