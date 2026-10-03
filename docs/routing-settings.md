# Routing settings — v0.3

The routing policy is user-selectable and deliberately separates **model choice** from
**rate-limit behavior**.

## Setting 1 — Primary model

`selectedModelId` is populated from Cline's live Free catalog. No model IDs are hard-coded.

Example:

```json
{
  "selectedModelId": "cline-free/deepseek-v4.1-flash"
}
```

The selected model is used for the first attempt even when another route has higher numeric
priority.

## Setting 2 — What to do after rate limit

Two values are exposed to both VS Code and Desktop adapters.

### `SWITCH_ACCOUNT_KEEP_MODEL`

Keep the exact model ID pinned. A fallback candidate must:

- use the same `model`
- have a different non-empty `accountId`
- otherwise pass the normal route/provider policy gates

This mode never silently changes the model. If no eligible same-model account route exists, the
request stops rather than substituting another model.

### `SWITCH_MODEL_KEEP_ACCOUNT`

Keep the current account/credential route identity and select another model. A fallback candidate
must:

- have a different `model`
- keep the same `accountId` when account IDs exist
- otherwise remain on the same provider identity
- otherwise pass the normal route/provider policy gates

## Promotional/free provider capability gate

User preference does not override the upstream service's allowed behavior. Promotional-to-
promotional transitions are enabled only when the host adapter declares the relevant capability:

```ts
providerCapabilities: {
  allowPromotionalAccountSwitch: true,
  allowPromotionalModelSwitch: true,
}
```

A Cline integration must set these flags only when the pinned Cline/provider surface explicitly
supports the corresponding transition. The shared core does not forge client identity or bypass
host policy.

## Route identity

Routes now support:

```ts
{
  model: "cline-free/deepseek-v4.1-flash",
  accountId: "account-a",
  accountLabel: "Work account"
}
```

That makes the distinction between "change model" and "change account" explicit and testable.

## Dynamic settings UI

`buildRoutingSettingsViewModel()` produces:

- current selected model
- all live Cline Free model choices
- the two rate-limit actions and user-facing descriptions

VS Code can bind these values to extension configuration / a Webview. Desktop can render the same
view model in the Tauri/Next settings UI.

## Continuity rule

Both transitions still use the v0.2 continuity layer. Switching route/account/model does not mark
an unfinished step complete. If a step is `IN_PROGRESS`, `VERIFYING`, or `BLOCKED`, the next route
receives the compact recovery capsule and must reconcile/verify before continuing.
