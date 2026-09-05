<div align="center">

# 🚀 RyzenDesk

**The Modern, Open-Source, Token-Based Customer Support & Helpdesk Platform**

*Crafted with React 19, TypeScript, Express, Tailwind CSS, Recharts, and Git-backed persistence.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61DAFB.svg?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-06B6D4.svg?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker&logoColor=white)](Dockerfile)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)

[Features](#-key-features) • [Screenshots](#-screenshots) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [Deployment](#-deployment--github-sync) • [REST API](#-api-reference) • [Docs Hub](#-documentation-hub)

</div>

---

## 📖 Overview

**RyzenDesk** is a self-hostable, zero-database-overhead helpdesk platform designed for development teams, modern SaaS companies, and freelance consultants who need a responsive ticketing system without paying hundreds of dollars per seat for Zendesk or Jira Service Management.

Built around **token-based passwordless customer authentication**, customers submit and track tickets seamlessly using a unique secret token (`zt_...`), while agents and administrators leverage a **deep slate & indigo executive console** equipped with SLA breach prediction timers, Kanban sprint boards, multi-language internationalization (i18n), audit trails, webhook delivery pipelines, Telegram bot alerts, and transactional SMTP email notifications.

### 🌟 Why RyzenDesk?

- 🔒 **Zero-Password Client Experience**: Customers submit tickets and receive an instant secret access token (`zt_...`) — no friction, no lost passwords.
- ⏱️ **Real-Time SLA Engine**: Live countdown timers with dynamic color-coding (`Safe`, `Warning`, `Breached`) calculated against granular priority policies.
- 📋 **Kanban & Sprint Management**: Drag-and-drop workflow columns with priority chips, assignee avatars, and sprint velocity tracking.
- 📚 **Integrated Knowledge Wiki**: Multi-category markdown article authoring with helpfulness voting and instant keyword filtering.
- 📊 **Executive Analytics Suite**: Real-time resolution metrics, category distributions, priority breakdowns, and agent leaderboards rendered via Recharts.
- 🌐 **Global i18n Localization**: Instant client-side switching between **English (EN)**, **Spanish (ES)**, **German (DE)**, and **French (FR)**.
- 🧙 **Self-Hosted Web Installation Wizard**: 6-step friendly web-based setup wizard guiding server administrators through pre-flight diagnostics, branding, storage engines, master admin security, and live service testing.
- 🗄️ **Zero-Database Git Persistence**: State automatically persists to a single conflict-safe JSON store that syncs directly with private GitHub repositories.
- ⚡ **1-Click Full Codebase Deployer**: Automated deployment scripts push codebase updates directly to GitHub with secret masking.

---

## 📸 Screenshots

| Customer Portal & Ticket Creation | Staff Executive Console & SLA Timers |
|:---:|:---:|
| ![Ticket Submission](docs/screenshots/ui-home.png) | ![Staff Console](docs/screenshots/ui-staff-console.png) |
| *Passwordless token submission & knowledge lookup* | *Real-time queue management & SLA breach counters* |

| Super-Admin CRM & RBAC Matrix | Interactive Ticket Thread & Internal Notes |
|:---:|:---:|
| ![Admin Panel](docs/screenshots/ui-admin-panel.png) | ![Ticket Thread](docs/screenshots/ui-ticket-thread.png) |
| *Role permissions, webhook pipelines, and audit logs* | *Customer communications + private team notes* |

| Real-Time Live Support Chat | First-Time Bootstrap Setup |
|:---:|:---:|
| ![Live Chat Widget](docs/screenshots/ui-client-chat.png) | ![Setup Wizard](docs/screenshots/ui-setup-wizard.png) |
| *Instant client messaging with admin toggle* | *Enforced first-login security & credential rotation* |

---

## ⚡ Key Features & Productivity Suite

### 🤖 AI Copilot & Automated Intelligence (Powered by Gemini)
- **One-Click Ticket Summarization**: Condenses extensive multi-message customer threads into actionable bullets, root cause diagnostics, and recommended next actions.
- **Smart Response Generator**: Generates 3 contextual response options (e.g. detailed step-by-step diagnostic, quick acknowledgement, or gentle follow-up) inserted directly into the editor.
- **Customer Sentiment Analysis**: Automatic sentiment scoring identifying urgent or frustrated clients with distinct visual badges.
- **Graceful Heuristic Fallback**: Zero external dependency failures — includes built-in semantic fallback algorithms if AI credentials are unset.

### ⚡ Supercharged Agent Productivity
- **Global Command Palette (`Cmd+K` / `Ctrl+K`)**: Rapid keyboard-first navigation across tickets, knowledge wiki pages, quick actions, and tab routing.
- **Agent Collision Detection & Live Presence**: Real-time heartbeat tracker alerting agents when teammates are viewing or typing in the same ticket, preventing duplicate work.
- **Batch Ticket Operations**: Multi-select support tickets to perform instant bulk status changes, mass reassignments, priority escalations, or bulk deletions.
- **Time Tracking & Billable Hours**: Interactive stopwatch with live elapsed counter and manual duration logging with billable/non-billable categorization.
- **Rich Markdown Composer**: Complete formatting toolbar (bold, italics, code blocks, blockquotes, ordered lists, markdown tables) with a real-time Write/Preview toggle.
- **Quick Views & Tag Filtering**: Dedicated instant filters for *Unassigned*, *SLA Risk*, and *Urgent & High* queues with clickable `#tag` badges.
- **Export to CSV & JSON**: One-click streaming exports of ticket records and metrics for audits and data pipelines.

### 🎯 Customer Experience & Self-Service
- **Self-Service Knowledge Deflection**: Intelligently searches and recommends relevant Knowledge Base articles as the customer types their ticket subject, deflecting routine inquiries before submission.
- **Customer Satisfaction (CSAT) Survey**: Automated 5-star feedback rating and qualitative review widget displayed upon ticket resolution.
- **Audio Feedback System**: High-fidelity, synthetic Web Audio API chimes for incoming messages and status alerts without requiring external media assets.
- **Global System Toast Notifications**: Accessible, self-dismissing feedback notifications for operational updates.

### 🧙 Self-Hosted Server Installation Wizard
- **6-Step Guided Web Setup**: Browser-driven installation flow akin to modern CRM and enterprise self-hosted platforms (WordPress/Ghost/Nextcloud).
- **Automated Pre-Flight Environmental Audits**: Validates Node.js version, `/data` read/write permissions, RAM RSS/Heap memory footprint, and network ports in real time.
- **Organization & Branding Setup**: Custom helpdesk naming, primary support email, public base URL, default system language, and timezone settings.
- **Dual Storage Strategy**: Choose between the zero-dependency **RyzenDesk Atomic ACID JSON Engine** (single conflict-free file) or **Cloud Git Mirror** with automated snapshotting.
- **Master Admin Security**: Guided creation of the primary super-administrator account with live entropy password validation.
- **Live Communication Gateway Testers**: Interactive SMTP mail server and Gemini AI token testers validating external API connectivity before finalizing installation.
- **Cryptographic Lock & Disaster Recovery**: Generates a tamper-proof installation lock key (`rd_lock_...`) and downloadable recovery manifest.
- **Dedicated Admin Reconfiguration Tab**: Allows administrators to review server parameters, re-run diagnostics, or reconfigure server profile without editing raw JSON files.

### 🎫 Core Ticket Management & Collaboration
- **Ticket Linking & Duplicate Merging**: Link related issues (`relates_to`, `blocked_by`, `subtask_of`) or merge duplicates with automated conversation thread consolidation.
- **Draggable Kanban Board**: HTML5 drag-and-drop workflow cards across custom board columns with team member avatars.
- **6 Standard Categories**: Technical Issue, Billing, Feature Request, Account Access, Bug Report, and General Inquiry.
- **Priority Matrix**: `Low`, `Medium`, `High`, and `Urgent` with auto-routing to designated functional teams.
- **Internal Notes**: Collaborate privately within ticket threads without alerting external clients.
- **File Attachments**: Drag-and-drop file attachment support with thumbnail previews and size validation.
- **Canned Responses**: Quick insert pre-configured response macros via keyboard shortcuts or dropdown.

### ⏱️ SLA Policies & Compliance
- Configure custom response and resolution target times per priority level (Urgent: 1h / 4h, High: 2h / 8h, etc.).
- Active countdown timer chips that turn yellow when approaching limits and pulsing red upon SLA breaches.
- Complete exportable compliance audit logs recording timestamps, actors, and state transitions.

### 🛡️ Role-Based Access Control (RBAC)
- 5 distinct user privilege tiers:
  - **Super Admin**: Full platform configuration, API keys, staff management, and system deployment.
  - **Support Manager**: Team queues, SLA policy tuning, webhook dispatchers, and analytics export.
  - **Senior Agent**: Escalation handling, ticket reassignment, and canned response authoring.
  - **Support Agent**: Queue processing, customer replies, and private note authoring.
  - **Customer / Client**: Ticket submission, thread tracking, and live chat engagement.

### 🔌 Real-Time Integrations
- **Telegram Bot**: Full bi-directional notifications via [@BotFather](https://t.me/BotFather) with `/link <token>` and `/staff` commands.
- **SMTP Email Notifications**: Automated customer receipts and agent assignment alerts with TLS/STARTTLS support.
- **Outgoing Webhooks**: HMAC SHA-256 signed event dispatching for `ticket.created`, `ticket.updated`, and `ticket.resolved`.
- **GitHub Cloud Sync**: Auto-commits database mutations to private repositories with conflict-safe SHA resolution.

---

## 🚀 Quick Start

### Option 1: Docker (Fastest)

```bash
# 1. Clone the repository
git clone https://github.com/romangalaxys10-spec/RyzenDesk.git
cd RyzenDesk

# 2. Copy environment variables
cp .env.example .env

# 3. Launch with Docker Compose
docker compose up -d
```

Access the application at **`http://localhost:3000`**.

---

### Option 2: Local Node.js / NPM

```bash
# 1. Clone repository & install dependencies
git clone https://github.com/romangalaxys10-spec/RyzenDesk.git
cd RyzenDesk
npm install

# 2. Configure environment
cp .env.example .env

# 3. Start development server
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## 🔑 Initial Admin Setup & Credentials

RyzenDesk boots with a pre-configured, bootstrap Super Admin account. On first login, the platform **strictly enforces** an initial password change before granting access to administrative controls.

| Role | Default Username | Default Password | Setup Requirement |
|:---|:---|:---|:---|
| **Super Admin** | `admin` | `RyzenAdmin@2026` | **Mandatory password update on initial login** |

> ⚠️ **Production Security Notice**: Always change the default bootstrap password and set a cryptographically random `SESSION_SECRET` in your `.env` before public deployment.

---

## ⚙️ Environment Configuration

Configuration is managed via `.env`. A complete template is provided in [`.env.example`](.env.example):

| Variable | Required | Default | Description |
|:---|:---:|:---|:---|
| `SESSION_SECRET` | **Yes** | `dev-fallback` | HMAC secret for session cookies and token encryption |
| `PORT` | No | `3000` | Server listening port |
| `SUPERADMIN_USERNAME` | No | `admin` | Initial bootstrap administrator username |
| `SUPERADMIN_PASSWORD` | No | `RyzenAdmin@2026` | Initial bootstrap password |
| `GITHUB_TOKEN` | No | `—` | GitHub Personal Access Token (PAT) for cloud storage sync |
| `GITHUB_REPO` | No | `romangalaxys10-spec/RyzenDesk` | GitHub repository target (`owner/repo`) |
| `GITHUB_BRANCH` | No | `main` | Branch for cloud database synchronization |
| `GITHUB_DB_PATH` | No | `data/helpdesk-db.json` | Path inside the repository for the JSON database |
| `TELEGRAM_BOT_TOKEN` | No | `—` | Bot token provided by Telegram [@BotFather](https://t.me/BotFather) |
| `SMTP_HOST` | No | `—` | Outgoing SMTP mail server hostname |
| `SMTP_PORT` | No | `587` | Outgoing SMTP port (587 for TLS, 465 for SSL) |
| `SMTP_USER` | No | `—` | SMTP authentication username / email |
| `SMTP_PASS` | No | `—` | SMTP authentication password / app key |
| `SMTP_FROM` | No | `support@ryzendesk.internal` | Outgoing sender email address |

---

## 🚢 Deployment & GitHub Sync

RyzenDesk includes built-in tools to push all codebase updates directly to GitHub:

### Using the CLI Script
```bash
# Push all code updates using the automated script
npm run deploy

# Push with a custom release message
npm run deploy -- --message="feat: v2.1 production release"

# Or execute the shell script directly
./scripts/deploy.sh
```

### Using the Admin Console UI
1. Navigate to **Admin Console &rarr; Integrations & Sync** tab.
2. Click **Deploy Updates to GitHub**.
3. View the live deployment status and commit hash confirmation in real time.

---

## 📡 API Reference

All features are accessible via standard JSON REST endpoints:

| Endpoint | Method | Auth | Description |
|:---|:---:|:---:|:---|
| `/api/tickets` | `POST` | Public | Submit new ticket; returns Ticket ID & secret token |
| `/api/tickets` | `GET` | Staff | Fetch list of all active tickets |
| `/api/tickets/:id` | `GET` | Session | Retrieve complete ticket thread and metadata |
| `/api/tickets/:id` | `PATCH` | Staff | Update ticket status, priority, assignee, or team |
| `/api/tickets/:id/messages` | `POST` | Session | Add public reply or private staff note |
| `/api/tickets/:id/escalate` | `POST` | Staff | Escalate ticket to higher tier with alert dispatch |
| `/api/chats` | `GET` / `POST` | Session | Retrieve or initialize real-time live support chat |
| `/api/chats/:id/messages` | `POST` | Session | Send live chat message to support agent |
| `/api/admin/staff` | `GET` / `POST` | Admin | Manage staff roster, roles, and status |
| `/api/admin/webhooks` | `GET` / `POST` | Admin | Configure webhook endpoints and event triggers |
| `/api/admin/deploy-codebase` | `POST` | Admin | Trigger full codebase commit and push to GitHub |
| `/api/sync/push` | `POST` | Staff | Force push local JSON database to GitHub |
| `/api/sync/pull` | `POST` | Staff | Force pull latest JSON database state from GitHub |

---

## 📚 Documentation Hub

Deep-dive guides are available in the [`docs/`](docs/) directory:

- 🏛️ **[System Architecture](docs/ARCHITECTURE.md)**: Architectural diagrams, state machine flows, and storage mechanics.
- 📖 **[REST API Specification](docs/API.md)**: Comprehensive request/response schema documentation.
- 🚀 **[Production Deployment Guide](docs/DEPLOYMENT.md)**: Docker, Cloud Run, VPS, and CI/CD pipelines.
- 🛡️ **[RBAC & Security Matrix](docs/RBAC_MATRIX.md)**: Granular role definitions, capability matrices, and audit logging.
- 🤖 **[Telegram Bot Setup](docs/TELEGRAM_SETUP.md)**: BotFather configuration, webhook handling, and customer linking.
- 📧 **[SMTP Mailer Setup](docs/SMTP_SETUP.md)**: Configuring Gmail, SendGrid, Amazon SES, and Postmark.

---

## 🛠️ Tech Stack

- **Frontend Framework**: [React 19](https://react.dev/) + [Vite 6](https://vitejs.dev/)
- **Styling & Design System**: [Tailwind CSS 4](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Data Visualization**: [Recharts](https://recharts.org/)
- **Animations**: [Motion](https://motion.dev/)
- **Backend Server**: [Express 4](https://expressjs.com/) with native TypeScript execution via [tsx](https://github.com/privatenumber/tsx)
- **Persistence Engine**: Git-backed zero-infrastructure JSON store + GitHub API synchronization
- **Containerization**: [Docker](https://www.docker.com/) & Docker Compose

---

## 🤝 Contributing

We welcome contributions from the community! Check out [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup, coding standards, and PR guidelines. Please adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📄 License

RyzenDesk is open-source software released under the permissive [MIT License](LICENSE). Free for personal and commercial use without seat limitations.

<div align="center">
  <sub>Built with ❤️ by the RyzenDesk open-source community. If this software helps your team, please consider giving it a ⭐ on GitHub!</sub>
</div>
