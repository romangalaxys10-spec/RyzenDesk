# 📜 Changelog
All notable changes to the **RyzenDesk** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
