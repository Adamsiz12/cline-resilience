# Security and usage boundaries

## Credentials

The core never stores credentials. Route `invoke` functions receive their credential through host-owned closures/adapters.

Recommended host storage:

- VS Code: `SecretStorage`
- Desktop Windows: OS-backed credential/keychain mechanism selected by the host (for example Windows Credential Manager / DPAPI-backed integration)
- CI/headless: environment variables or a secret manager

Never put refresh/access tokens in `routes.json`, source files, logs, or the attempt journal.

## Logging

`AttemptJournal` records only:

- request ID
- route ID
- attempt number
- lifecycle state
- classified error kind
- optional non-sensitive note

It does not record prompts, response text, API keys, access tokens, refresh tokens, cookies, or authorization headers.

## Promotional quota policy

The classifier recognizes explicit daily/free promotional-limit messages separately from temporary rate limiting. The routing policy blocks automatic `promotional -> promotional` rollover when such a quota is exhausted. Allowed continuation targets are BYOK, paid, organization-managed, or local routes.

## Stream safety

After the first response chunk is emitted, replay is forbidden. This avoids replaying a request after model output or a tool-intent fragment may already have been observed by the agent runtime.
