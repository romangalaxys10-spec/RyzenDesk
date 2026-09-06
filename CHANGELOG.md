# 📜 Changelog
All notable changes to the **RyzenDesk** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.5.0] - 2026-09-06

### 🚀 Added — Competitor-Parity Feature Wave (WHMCS / Kayako)

- **Email-to-Ticket Piping** (`POST /api/email/inbound`): provider-agnostic inbound webhook (SendGrid Inbound Parse, Mailgun Routes, Postmark, or a local fetchmail script). Authenticates with a shared secret (`X-Inbound-Secret`, stored AES-256-GCM encrypted at rest). Subjects containing an existing ticket id (`RD-YYYY-NNNN`) become client replies (sender must match the ticket contact or a portal user); everything else becomes a new ticket tagged `via-email`. Automation rules apply to emailed tickets too.
- **Automation Rules Engine**: ordered, first-match-wins rules (`subject/body/email/type/priority` × `contains/equals/starts_with`, match *all/any*) driving allowlisted actions (`set_priority`, `set_team`, `set_type`, `add_tag`, `assign`). Evaluated on every new ticket (web **and** emailed); run counts tracked; managed under Admin ▸ Content & Automation (`admin_content` permission).
- **AI Triage** (optional): when `GEMINI_API_KEY` is set and AI triage is enabled, new tickets are auto-classified (type/priority/team) — strictly filling only default gaps so rules and explicit customer choices always win; tagged `ai-triaged` and audited.
- **Live Chat**: portal visitors (anonymous name+email or logged-in clients) start threads; staff answer from the new chat endpoints (REST polling, capability-token thread ids). Activates the previously dead `liveChatEnabled` setting.
- **Announcements** — published posts surfaced on the customer portal.
- **Network Status page** (`GET /api/status-page`) with per-component status (`operational/degraded/outage/maintenance`) and an aggregate overall status.
- **Downloads area** — published file links on the customer portal.
- **Customer Context Panel** (Kayako *SingleView* parity): staff ticket view aggregates the contact's entire ticket history, open/resolved counts, average CSAT and portal-account info (`GET /api/admin/customers/:email`, `tickets_view_all` enforced).
- **New RBAC permission** `admin_content` ("Manage Content & Automation Rules") — super_admin + team_lead by default, backfilled into existing databases by the migration.

### 🔧 Fixed (during full E2E QA)
- `PATCH /api/tickets/:id` now rejects invalid `status`/`priority` values (previously persisted verbatim, poisoning filtered queue views).
- `POST /api/admin/staff` rejects invalid roles with 400 instead of silently coercing to `agent`.

### 🧪 QA
- 61+ check end-to-end suite extended with chat, rules-engine, email-piping and content-CRUD flows — all green; `tsc` clean; production build green; `npm audit` 0 vulnerabilities.

---

## [2.4.1] - 2026-09-06

### 🛡️ Post-Audit Re-Verification Fixes

Following the independent re-audit of `97011bc` (result: **PASSED — all 9 findings RD-SEC-01…09 verified resolved**), a follow-up review of the same class of issues found and closed one residual gap:

- **Wiki privacy enforcement (RD-SEC-10)**: `GET /api/wiki/spaces` previously returned **all** spaces — including those marked `isPrivate` — to anonymous visitors and client sessions. Private spaces are now staff-only at the API level, and `GET /api/wiki/pages` additionally excludes public pages that live inside private spaces (defense in depth against content leakage through page listings).
- **Crypto IDs**: the last remaining `Math.random()` usage in server code (SMTP email-log IDs) replaced with `crypto.randomUUID` — the server tree is now fully free of `Math.random()`.
- **UI fix — Kanban empty state**: the "Create First Board" button previously did nothing when no boards existed: the component early-returned the empty state before the create-board modal was defined, so the modal was never mounted. The modal is now extracted and rendered in both branches; creating the first board from the empty state works end to end (verified in-browser).
- **UI fix — RBAC-aware board creation**: the Kanban UI was role-blind. It showed "Create First Board" / "+ New Board" to roles whose matrix denies `kanban_create_board` (agent/viewer/client) and silently swallowed the resulting 403 — even appending the error body into board state. Board-create UI is now gated by the signed-in user's live permissions, failures surface as a toast with the server's actual error, and successes confirm with a toast.
- **Verification**: 81/81 API security suite, 7/7 encryption tests, `tsc` clean, production build green, `npm audit` 0 vulnerabilities.


## [2.4.0] - 2026-09-06

### 🛡️ Security Hardening Release (Full External Audit Remediation)

#### 🔐 Authentication & Session Model (now actually implemented)
- **Staff Session Auth**: `POST /api/auth/login` with scrypt-hashed passwords, HMAC-signed HttpOnly session cookies (24h sliding expiry), server-side session store excluded from Git, logout invalidation and tamper rejection.
- **Customer Token Auth**: `POST /api/auth/customer-login` (email + `zt_...` secret); customer sessions are hard-scoped to their own tickets.
- **Forced Password Rotation**: bootstrap/admin-provisioned passwords block all API access until changed (`PASSWORD_CHANGE_REQUIRED`).
- **Bootstrap admin provisioning**: first boot now creates a real scrypt password hash for the documented default admin.

#### 🧾 Server-Side RBAC Enforcement
- Every API route now passes authentication + granular permission middleware driven by the live matrix (`db.settings.rbac`): tickets, kanban, wiki, canned replies, analytics, staff, RBAC, SLA, SMTP, webhooks, audit, cloud sync and codebase deployment.
- Customer responses never include internal notes or time logs; clients cannot author internal notes.
- Staff API responses are sanitized (password hashes never leave the server); self-demotion and last-super-admin lockout protection; role/PATCH field allowlists.

#### 🔑 Cryptographic Hardening
- All security tokens (`zt_...` customer tokens, webhook secrets, installation lock key, session ids) now use `crypto.randomBytes` instead of `Math.random()`.
- Customer tokens are stored only as SHA-256 digests (shown once at creation + emailed).
- New `server/auth.ts` security core (scrypt hashing, sessions, RBAC, CSRF guard, rate limiting).

#### 🌐 SSRF Protection (Webhooks)
- Webhook targets validated at creation and on every delivery: http/https only, no credentials, no redirects, DNS resolution checked against loopback/private/link-local/CGNAT/metadata ranges.

#### ☁️ Encrypted Cloud Sync & At-Rest Secrets
- GitHub-synced database snapshots are wrapped in AES-256-GCM envelopes; production refuses to push with default secrets; legacy cleartext snapshots migrate transparently on pull.
- SMTP password, Telegram bot token and installation lock key are AES-256-GCM encrypted inside the JSON store.
- Demo SMTP credential placeholder removed from the seed database.

#### 🚦 Transport & Abuse Controls
- Security headers: nosniff, frame-deny, referrer policy, permissions policy, COOP, HSTS over TLS and a production Content-Security-Policy.
- Sliding-window rate limits on login, customer login, ticket creation, offline batch, installation, SMTP/AI testers, webhook tests, wiki votes and global API traffic.
- CSRF origin validation on all mutating requests.

#### 🐳 Container & Dependencies
- Dockerfile rewritten for the actual Vite + Express stack (was a broken Next.js template): multi-stage Node 22 alpine build, non-root runtime, HEALTHCHECK on public `/api/health`.
- `npm audit` reduced to **0 vulnerabilities** (qs/body-parser overrides).

#### 🧪 QA & Documentation
- 81-check API security regression suite (auth matrix, RBAC roles, client scoping, SSRF vectors, rate limits, CSRF, session lifecycle) — all passing.
- Encryption verification suite (round-trip, wrong-key, tamper detection) — all passing.
- New `docs/SECURITY.md`; rewritten `docs/API.md` and `docs/RBAC_MATRIX.md`; README updated with the real security model and fresh screenshots of the current UI.
- Fixed `src/App.tsx` syntax error that broke the frontend build.


## [2.3.0] - 2026-09-05

### 🚀 Added (Self-Hosted Server Installation Wizard & Deployment Engine)

#### 🧙 Web-Based Installation Wizard
- **6-Step Interactive Setup Flow**: Friendly browser-based web wizard guiding administrators through initial deployment, server pre-flight checks, and environment configuration:
  - **Pre-flight Environmental Diagnostics**: Automated validation of Node.js engine compatibility, `/data` directory write permissions, memory footprint (RSS/Heap), and network ingress.
  - **Organization & Branding Customizer**: Configure Organization Name, Helpdesk Title, Public Server Base URL, Timezone, and Default System Language.
  - **Storage Architecture Selection**: Choose between RyzenDesk Atomic ACID JSON Engine (local zero-dependency disk persistence) or Cloud Git Mirror.
  - **Master Admin Security Provisioning**: Dedicated super-administrator account creation with live password strength validation and automatic role assignment.
  - **Service Integration & Gateway Verification**: In-wizard live connection testers for Transactional SMTP mail servers and Gemini 2.5 Flash AI API keys.
  - **Cryptographic Lock & Deployment**: Generates master security recovery key (`rd_lock_...`), writes configuration, sets up initial database seed, and unlocks the production helpdesk.

#### 🛠️ Administration & Maintenance Integration
- **Server Setup Wizard Tab in Admin Console**: New dedicated tab providing real-time diagnostic probes, configuration overview, disaster recovery snapshot controls, and re-run wizard triggers.
- **Header & Sidebar Launch Points**: Accessible directly from the top navigation bar, persistent left sidebar, and the global Command Palette (`Cmd+K`).
- **RESTful Installation API Suite**:
  - `GET /api/install/preflight`: System diagnostic probe endpoint.
  - `GET /api/install/status`: Current installation and lock state.
  - `POST /api/install/test-smtp`: Real-time SMTP gateway validator.
  - `POST /api/install/test-ai`: Live Gemini model credentials test.
  - `POST /api/install/execute`: Finalize installation, seed admin, and write lock key.
  - `POST /api/install/reset`: Reset installation state for maintenance or re-configuration.

---

## [2.2.0] - 2026-09-04

### 🚀 Added (Enterprise Productivity Suite - 20+ Major Features)

#### 🤖 AI Copilot & Automated Intelligence
- **Ticket Thread Summarization**: Integrated `@google/genai` (Gemini 2.5 Flash) to generate instantaneous, multi-point summaries highlighting core issue details, identified root causes, and recommended agent actions.
- **Contextual Smart Replies**: One-click AI response suggestion generator offering technical diagnostic steps, polite acknowledgements, and quick resolution proposals.
- **Client Sentiment & Emotion Classifier**: Dynamic sentiment analysis classifying customer tone (`urgent`, `frustrated`, `neutral`, `positive`) with color-coded badges.
- **Heuristic Offline Fallback**: Deterministic rule-based extraction ensuring AI buttons and summaries work seamlessly even when no API key is provided or offline.

#### ⚡ Supercharged Agent Workflow
- **Global Command Palette (`Cmd+K` / `Ctrl+K`)**: Instant keyboard navigation with fuzzy search across tickets, wiki articles, tab switching, and ticket creation.
- **Real-Time Agent Presence & Collision Detection**: 35-second heartbeat API tracking active viewers and typists on tickets with warning banners to prevent duplicate replies.
- **Interactive Batch Action Bar**: Bulk multi-select tickets for mass status changes (Open, In Progress, Resolved), agent reassignments, and bulk priority upgrades.
- **Live Time Tracker & Stopwatch**: Persistent billable and non-billable time logger with real-time ticking stopwatch and manual duration inputs.
- **Rich Markdown Composer**: Complete WYSIWYG/Markdown writing environment with formatting toolbar (bold, italic, code, quotes, lists, tables) and live preview mode.
- **Ticket Linking & Duplicate Merging Engine**: Ability to link tickets with semantic relationships (`duplicate_of`, `relates_to`, `blocked_by`) and merge duplicate tickets while consolidating message threads.
- **One-Click Export**: Streaming export endpoints for raw CSV (`/api/tickets/export?format=csv`) and JSON (`/api/tickets/export?format=json`).
- **Quick Views & Saved Filters**: Instant queue tabs for *All Tickets*, *Unassigned*, *SLA Risk*, and *Urgent & High* along with clickable `#tag` filtering.

#### 🎯 Customer Experience & Self-Service
- **Self-Service Knowledge Deflection**: Live article suggestion widget inside ticket submission modal searching the wiki as customers type, resolving inquiries prior to ticket creation.
- **Post-Resolution CSAT Survey**: Automated 5-star customer rating widget with qualitative feedback comments captured upon ticket resolution.
- **Web Audio Sound Effects**: Pure client-side Web Audio API synthesizer generating gentle chimes for replies and alerts with no external audio file dependencies.
- **Global Toast System**: Floating notification toasts for operational confirmations (notes added, bulk changes applied, links created).
- **Draggable Kanban Board**: HTML5 drag-and-drop card interaction between Sprint workflow columns with immediate server persistence.
- **Offline Banner & Mutex Sync Queue**: Visual connectivity status indicator showing real-time network states and queued mutations during disconnections.

---

## [2.1.0] - 2026-09-02

### 🌟 Added
- **Kanban Module**: Multi-column sprint board with custom card creation, priority tags, and assignee filtering.
- **Confluence-style Knowledge Wiki**: Spaces and hierarchical Markdown documentation pages with helpfulness voting.
- **Live Support Chat**: Real-time customer chat interface with agent toggle and token session validation.
- **SLA Breach Engine**: Automatic calculation of first-response and resolution deadlines with visual countdown timers.

---

## [2.0.0] - 2026-08-28

### 🚀 Initial Enterprise Release
- Token-based passwordless customer ticket portal (`zt_...`).
- Super Admin, Support Manager, Senior Agent, Support Agent RBAC matrix.
- Telegram Bot integration via webhook and staff commands.
- Transactional SMTP email delivery for customer receipts and assignment notices.
- Git-backed JSON database store with GitHub synchronization.
- Dark and Light executive theme styling with Tailwind CSS.
