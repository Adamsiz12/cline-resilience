# Contributing

Thank you for reviewing or improving Cline Resilience.

## Development setup

Requirements:

- Node.js 22 or newer
- npm

Install dependencies and run the complete suite:

```bash
npm ci
npm test
npm run test:practical
```

## Pull requests

Keep changes focused. If behavior around routing, streaming, session continuity, or Cline upstream integration changes, add or update tests for that boundary.

A change should not be considered complete when it only compiles. It should also preserve these project invariants:

- never automatically replay after streamed output has begun;
- never silently treat unfinished tool work as complete;
- preserve the active Cline session identity across permitted handoffs;
- honor the user's selected model/routing policy;
- fail closed when a required Cline upstream surface changes;
- never commit credentials, OAuth tokens, cookies, private logs, or local runtime state.

## Security-sensitive reports

Do not paste real credentials or private project data into a public issue. See `SECURITY.md`.
