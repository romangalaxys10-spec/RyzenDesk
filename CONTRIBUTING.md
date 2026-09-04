# Contributing to RyzenDesk

Thanks for your interest in improving RyzenDesk! Contributions of every size are welcome — from typo fixes to new features.

## How to contribute

1. **Fork** the repository and create your branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. **Make your change.** Keep the scope focused — one feature or fix per PR.
3. **Test it locally.** Run the dev server (`bun run dev`), exercise the affected flows (ticket submit, staff console, live chat, admin panel).
4. **Keep it clean.** `bunx tsc --noEmit` should pass with no errors in `src/`.
5. **Open a Pull Request** with a clear title and a short description of *what* changed and *why*.

## Areas that especially need help

- 🌍 Translations / i18n
- 📧 Email notification provider (SMTP)
- 🧪 Automated tests (the project currently relies on manual E2E flows)
- 📚 Docs & setup guides for other hosting platforms

## Ground rules

- TypeScript + Tailwind + shadcn/ui conventions — match the existing code style.
- No secrets in code: all configuration comes from environment variables.
- Backwards-compatible DB changes only: new fields must be optional with idempotent migration in `src/lib/helpdesk/db.ts` (`migrateDb`).
- Security issues: please use [SECURITY.md](SECURITY.md) instead of a public PR/issue.

## Development quick reference

```bash
bun install            # install deps
bun run dev            # dev server on :3000
bun run lint           # eslint
bunx tsc --noEmit      # typecheck
```

The database lives in `data/helpdesk-db.json` (gitignored). Delete it for a fresh start — a bootstrap super admin will be re-created on boot.
