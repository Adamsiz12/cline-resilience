# Security

## Sensitive information

Do not commit or publish:

- API keys
- OAuth access or refresh tokens
- session cookies
- private Cline authentication files
- `.env` files containing secrets
- `.cline-resilience/` local runtime state
- private source-code excerpts or logs from unrelated projects

The repository intentionally ignores common secret/local-state files. Review `git status` before every push.

## Reporting a security issue

If a finding contains credentials, authentication material, private user data, or an exploit that should not be publicly disclosed, do not open a public GitHub issue. Report it privately to the repository owner through a private channel they provide on GitHub.

## Project boundary

The resilience core should fail closed when an upstream Cline API/surface is incompatible. It should not guess replacement authentication or session APIs.
