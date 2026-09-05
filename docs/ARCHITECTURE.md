# 🏛️ RyzenDesk System Architecture

This document provides a technical overview of RyzenDesk's architecture, data flows, persistence layer, and security boundary designs.

---

## 📐 Architectural Blueprint

```
+-------------------------------------------------------------------------+
|                              CLIENT LAYER                               |
|                                                                         |
|  +---------------------------+  +------------------------------------+  |
|  |    Client Portal (Web)    |  |     Executive Staff Console (Web)  |  |
|  |  - Token Auth (zt_...)    |  |  - Ticket Queues & SLA Timers      |  |
|  |  - Submission Forms       |  |  - Kanban Sprint Boards            |  |
|  |  - Live Chat Widget       |  |  - Knowledge Wiki Authoring        |  |
|  |  - Knowledge Base Viewer  |  |  - Admin Console & RBAC Matrix     |  |
|  +---------------------------+  +------------------------------------+  |
|                               ^                                         |
|                               | HTTP / JSON REST / Polling              |
+-------------------------------|-----------------------------------------+
                                v
+-------------------------------------------------------------------------+
|                             API & SERVER LAYER                          |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |                  Express.js TypeScript Server                     |  |
|  |                                                                   |  |
|  |  [ Auth & Sessions ]     [ Ticket Engine ]      [ Chat Service ]  |  |
|  |  [ SLA Policy Calc ]     [ RBAC Guard ]         [ Audit Logger ]  |  |
|  +-------------------------------------------------------------------+  |
|                               |                                         |
|         +---------------------+---------------------+                   |
|         |                     |                     |                   |
|         v                     v                     v                   |
|  +---------------+   +------------------+   +-------------------+       |
|  | Telegram Bot  |   |  SMTP Mailer     |   | Webhook Dispatch  |       |
|  | (Long-poll)   |   |  (TLS / STARTTLS)|   | (HMAC SHA-256)    |       |
|  +---------------+   +------------------+   +-------------------+       |
+-------------------------------|-----------------------------------------+
                                v
+-------------------------------------------------------------------------+
|                             STORAGE LAYER                               |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  |  Local Atomic JSON Store (`data/helpdesk-db.json`)                |  |
|  |  - In-memory cache + fsync atomic file writes                     |  |
|  +-------------------------------------------------------------------+  |
|                               |                                         |
|                               v (Debounced ~3s HTTPS Sync)              |
|  +-------------------------------------------------------------------+  |
|  |  Remote GitHub Repository (`romangalaxys10-spec/RyzenDesk`)       |  |
|  |  - Conflict-safe SHA resolution, commit history, branch fallback  |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 🗄️ Persistence & Storage Engine

RyzenDesk is engineered with a **Zero-Infrastructure Persistence Model**. Rather than requiring external PostgreSQL or MongoDB database instances:

1. **Local Atomic JSON Store**:
   - All state (tickets, users, staff accounts, chat threads, audit logs, wiki articles, webhooks, SLA policies) lives in `data/helpdesk-db.json`.
   - Writes are atomic: modified payloads are serialized to a temporary buffer and written atomically to prevent file corruption during sudden restarts.

2. **Cloud Synchronization Protocol**:
   - When a state change occurs, a debounced sync timer (~3 seconds) is scheduled.
   - The server pushes the serialized JSON database directly to the configured GitHub repository via the GitHub REST API (`/repos/{owner}/{repo}/contents/{path}`).
   - SHA conflict detection automatically triggers pull-and-merge recovery if remote changes have occurred.

---

## 🔒 Security Architecture

- **Customer Authentication**: Customers authenticate using non-guessable, 256-bit cryptographically secure tokens (`zt_...`). No passwords or personal credentials are stored.
- **Staff Authentication**: Passwords for agents, senior agents, and administrators are hashed using HMAC-SHA256 with a unique salt per account and a server-level `SESSION_SECRET`.
- **First-Time Password Enforcement**: The bootstrap super-admin account (`admin`) is flagged with `mustChangePassword: true`. Administrative endpoints reject calls until this initial rotation is executed.
- **Webhook Integrity**: Outgoing webhooks are signed using HMAC-SHA256 headers (`X-RyzenDesk-Signature`) containing the hex digest of the payload.
