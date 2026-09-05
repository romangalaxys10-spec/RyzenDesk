# 🛡️ RyzenDesk Security Model

This document describes the security architecture introduced in **v2.4.0** and maps each control to the external audit findings it resolves.

---

## 1. Authentication & Session Management

- **Staff login** (`POST /api/auth/login`): username + password verified against a **scrypt** hash (`scrypt$salt$hash`, Node built-in `crypto`, constant-time comparison). Rate limited to 20 attempts / 15 min / IP.
- **Customer login** (`POST /api/auth/customer-login`): email + secret `zt_...` token. Tokens are stored **only as SHA-256 digests** and compared in constant time. Rate limited to 30 / 15 min / IP.
- **Sessions**: opaque 256-bit random identifiers delivered in an **HMAC-SHA256-signed, HttpOnly, SameSite=Lax cookie** (`ryzendesk_session`). The session store lives in `data/sessions.json` — a runtime-only file that is **excluded from Git** (`.gitignore`) and never synced to GitHub. Sliding 24-hour expiry; logout deletes the session server-side; tampered cookie signatures are rejected before any lookup.
- **Forced credential rotation**: the bootstrap admin and any admin-provisioned password carry `mustChangePassword`, which blocks **every** API route except the password-change endpoint until rotation completes (mirrors the documented "mandatory password update on initial login").

## 2. Authorization (RBAC Enforcement)

- Every route is gated by `requireAuth`, `requireStaff`, `requirePermission(perm)` or `requireSuperAdmin` middleware in `server/auth.ts`.
- Permissions are resolved **per request** from the live matrix in `db.settings.rbac`, so matrix edits in the Admin Console take effect immediately — the UI is not the security boundary.
- **Client sessions are hard-scoped**: ticket lists/detail are filtered by the customer identity; internal notes and time logs are stripped from client-visible payloads; customers can never author internal notes or mutate tickets.
- Staff account payloads are sanitized — `passwordHash` never leaves the server; the PATCH allowlist forbids setting hashes through the API and protects the last active Super Admin from demotion/suspension.

## 3. Cryptographic Hygiene

| Purpose | Construction |
|:---|:---|
| Password hashing | `crypto.scrypt` (N=16384 default), 16-byte salt, 64-byte digest, `timingSafeEqual` verification |
| Customer access tokens | `crypto.randomBytes(24)` → base64url (≈192-bit entropy), stored as SHA-256 digest |
| Webhook signing secrets | `crypto.randomBytes(24)`, HMAC-SHA256 signatures on every delivery |
| Installation lock key | `crypto.randomBytes(24)` |
| Session identifiers | `crypto.randomBytes(32)`, HMAC-signed cookie binding |
| All legacy `Math.random()` identifiers | Replaced with `crypto.randomUUID()` / `crypto.randomBytes` |

## 4. Server-Side Request Forgery (SSRF) — Webhooks

Webhook targets are validated **at creation time and again on every delivery/test** (`server/webhooks.ts`):

1. Scheme allowlist: `http:` / `https:` only; `file:`, `data:`, etc. rejected.
2. No embedded credentials, no `localhost`/`.local`/`.internal` hostnames.
3. IP literals checked against loopback, RFC1918, link-local (`169.254.169.254` cloud metadata), CGNAT, multicast and IPv6 unique-local/link-local ranges.
4. Hostnames are **DNS-resolved before dispatch** and every resolved address is re-checked (anti-DNS-rebinding baseline).
5. Redirects are disabled (`redirect: 'error'`) and deliveries time out after 4 s.

## 5. Encrypted Cloud Sync & At-Rest Storage

- The Git-synced database snapshot is wrapped in an **AES-256-GCM envelope** (`{format: ryzendesk-encrypted-db, alg, iv, tag, payload}`) keyed by `scrypt(SESSION_SECRET | ENCRYPTION_KEY, 'ryzendesk-cloud-sync-v1', 32)`.
- **Production refuses to push** when only the default dev secret is configured.
- Pulls transparently decrypt envelopes and still accept legacy cleartext snapshots (migrated on the next push).
- Inside the local JSON store: SMTP password, Telegram bot token and the installation lock key are **AES-256-GCM encrypted at rest**; customer tokens are stored as SHA-256 digests.
- `data/sessions.json` and installation lock artifacts are excluded from Git and codebase deployments.

## 6. Transport & Browser Hardening

- Security headers on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`.
- `Strict-Transport-Security` (max-age 1 year, includeSubDomains) automatically enabled when the request arrives over TLS.
- Production **Content-Security-Policy**: `default-src 'self'; script-src 'self'; frame-ancestors 'none'; ...` (inline styles permitted for Recharts/Tailwind runtime styles).
- CSRF: SameSite=Lax cookies plus Origin/Referer validation on all state-changing requests; cross-origin writes are rejected with `403 CSRF_BLOCKED`.

## 7. Rate Limiting & Abuse Control

Sliding-window limiter (per IP + bucket): global API 600/15 min; login 20/15 min; customer login 30/15 min; ticket creation 30/15 min; offline batch 30/15 min; install execute 5/h; SMTP/AI wizard testers 10/h; webhook test 20/15 min; wiki votes 60/h.

## 8. Installation Lifecycle

- `POST /api/install/execute` and `/api/install/reset` are open **only during the first-run bootstrap window** (`installation.installed = false`), are rate limited (5/h), and require an authenticated Super Admin afterwards.
- `GET /api/install/status` never exposes the installation lock key.
- Wizard execution validates administrator password strength (≥ 8 chars) and stores it as a scrypt hash.
- `POST /api/admin/deploy-codebase` requires the `admin_deploy` permission (Super Admin only), runs with a 120 s timeout and `GIT_TERMINAL_PROMPT=0`, and is audit-logged with source IP.

## 9. Audit Trail

Security-relevant events are recorded with actor, role, module, entity, detail and source IP: logins (staff/customer), password changes, staff account lifecycle, RBAC matrix changes, SLA/SMTP/webhook configuration, cloud sync pushes, codebase deployments, installation completion. Exportable via `/api/admin/audit/export` (requires `admin_view_audit`).

## 10. Dependencies & Container

- `npm audit`: **0 vulnerabilities** (qs/body-parser pinned via package overrides).
- Docker image: multi-stage Node 22 alpine build, non-root `ryzendesk` user, only `dist/` + production `node_modules` shipped, `HEALTHCHECK` on the public `/api/health` endpoint, persistent state isolated in a volume.

---

## 11. External Audit Findings → Resolution Map

| Ref | Finding | Status | Where |
|:---|:---|:---|:---|
| RD-SEC-01 | No authentication / authorization on API | ✅ Fixed | `server/auth.ts`, middleware on all routes, 81-check regression suite |
| RD-SEC-02 | Unauthenticated `/api/install/reset` | ✅ Fixed | `installGuard` — Super Admin required once installed |
| RD-SEC-03 | Unauthenticated `execSync` deploy trigger | ✅ Fixed | `requirePermission('admin_deploy')`, timeout, audit |
| RD-SEC-04 | SSRF via webhook targets | ✅ Fixed | URL validator + DNS resolution checks + no redirects |
| RD-SEC-05 | `Math.random()` token generation | ✅ Fixed | `crypto.randomBytes` everywhere; SHA-256 token storage |
| RD-SEC-06 | Plaintext credentials in JSON DB & Git sync | ✅ Fixed | AES-256-GCM sync envelope + at-rest field encryption + hashed client tokens + scrubbed seed secrets |
| RD-SEC-07 | Missing security headers & rate limiting | ✅ Fixed | Header middleware (incl. HSTS/CSP) + sliding-window limiters |
| RD-SEC-08 | Broken Dockerfile (Next.js artifacts) | ✅ Fixed | Rewritten multi-stage Vite/Express Dockerfile, non-root, healthcheck on `/api/health` |
| RD-SEC-09 | Vulnerable transitive deps (`qs`) | ✅ Fixed | Package overrides → `npm audit` reports 0 vulnerabilities |
| RD-SEC-10 | Private wiki spaces/pages readable by anonymous & client sessions via direct API call (found during post-audit re-verification) | ✅ Fixed | `GET /api/wiki/spaces` filters `isPrivate` spaces for non-staff; `GET /api/wiki/pages` additionally excludes public pages nested inside private spaces |

---

## 12. Verification Evidence

- External re-audit of commit `97011bc` (RD-SEC-01 → RD-SEC-09): **PASSED — all findings verified resolved** by independent reviewer (code inspection, dependency audit, clean build confirmation).
- `scripts/rd-qa-suite.sh` (repository-independent): **81/81 checks passing** — unauthenticated access matrix, install guard, login/rotation flow, RBAC enforcement for Super Admin / Team Lead / Agent / Client, client scoping, internal-note leakage, SSRF vectors (loopback, metadata, file scheme, credentials, localhost, RFC1918), token entropy, brute-force rate limiting, CSRF origin blocking, session lifecycle (logout invalidation, tampered cookie rejection) and API 404 behaviour.
- Encryption suite: envelope round-trip, wrong-key rejection, tamper detection, no-plaintext checks — 7/7 passing.
- `npm audit`: 0 vulnerabilities. Secret scan across the tree: no committed credentials (runtime tokens and lock files are Git-ignored).

## 13. Responsible Disclosure

Please report vulnerabilities privately via the maintainer's security contact. Do not open public issues for exploitable findings.
