# Cline free-model catalog integration

## Design rule

Do not hard-code a list of free models and do not infer free status from model-id prefixes.
Cline promotions rotate.

Preferred source order:

1. **Cline host / `@cline/llms` featured Free tier** — production integration.
2. Cline's official recommended/free feed — fallback during standalone development:
   `https://api.cline.bot/api/v1/ai/cline/recommended-models`
3. last-known cache — temporary offline fallback only.

`HostFreeModelSource` implements source 1 as an adapter contract. `ClineLiveFreeModelSource`
implements source 2. `ClineFreeModelCatalog` tries the sources in order and saves the last good
snapshot.

## Current snapshot (2026-10-03)

At the time v0.2.0 was prepared, Cline's official `free` array returned:

- `cline-free/deepseek-v4.1-flash` — Deepseek-v4.1-Flash
- `stealth/space-bunny-alpha` — space-bunny-alpha
- `cline-free/mimo-v2.6-flash` — Mimo V2.6 Flash
- `cline-free/muse-spark-1.3-contributor` — Muse Spark 1.3 Contributor

This snapshot is documentation only. Runtime code does **not** use it as the authoritative list.

The presence of `stealth/space-bunny-alpha` is important: prefix checks such as
`id.startsWith("cline-free/")` would miss a currently free model. The `free` tier returned by
Cline is the authority.

## Keeping free models inside Cline

`buildClineFreeRoutes(snapshot, createInvoker)` converts every current free-tier entry into a
`providerId: "cline"` route. The host supplies `createInvoker(modelId)` and should bind it to
Cline's own provider runtime rather than calling the public Cline API directly.

This matters because Cline documents free model usage as a product-surface feature and its SDK
now owns provider catalogs, featured tiers, model aliases/capabilities, and client-identity
headers. Reusing Cline's runtime minimizes drift when model IDs, headers, capabilities or free
promotions change.

## Refresh behavior

Recommended production behavior:

- refresh from the Cline host catalog when the model picker opens;
- refresh again at application/session startup;
- subscribe to a host model-catalog change event if Cline exposes one on the pinned version;
- retain the last-known snapshot if refresh fails;
- never convert a stale model into "free" merely because its ID used to be in a previous list.
