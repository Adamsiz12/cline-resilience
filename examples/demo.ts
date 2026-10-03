import {
  HttpError,
  MemoryAttemptJournal,
  ResilienceEngine,
  type RouteDefinition,
  type StreamChunk,
} from "../src/core/index.js";

async function* chunks(...items: StreamChunk[]): AsyncGenerator<StreamChunk> {
  for (const item of items) yield item;
}

const routes: RouteDefinition[] = [
  {
    id: "cline-free-primary",
    label: "Cline promotional route",
    providerId: "cline",
    model: "deepseek-free",
    usageClass: "promotional",
    priority: 10,
    invoke: async () => {
      throw new HttpError(429, "Daily free limit reached on model. Try again in 23h 59m");
    },
  },
  {
    id: "cline-free-secondary",
    label: "Second promotional route",
    providerId: "cline",
    model: "deepseek-free",
    usageClass: "promotional",
    priority: 20,
    invoke: async () => ({ stream: chunks({ type: "text", data: "THIS SHOULD NOT BE USED" }) }),
  },
  {
    id: "local-coder",
    label: "Local coding model",
    providerId: "ollama",
    model: "local-coder",
    usageClass: "local",
    priority: 30,
    invoke: async () => ({
      stream: chunks(
        { type: "meta", data: { provider: "local" } },
        { type: "text", data: "Task continued through an allowed local fallback." },
      ),
    }),
  },
];

const journal = new MemoryAttemptJournal();
const engine = new ResilienceEngine(routes, {
  journal,
  sleep: async () => undefined,
});

const output: StreamChunk[] = [];
for await (const chunk of engine.execute({ requestId: "demo-1", model: "deepseek", payload: { prompt: "demo" } })) {
  output.push(chunk);
}

console.log("Output:", output);
console.log("Routes:", engine.pool.snapshot().map(({ invoke: _invoke, ...route }) => route));
console.log("Attempt journal:", journal.events);
