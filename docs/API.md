# 📡 RyzenDesk REST API Specification

This document details the HTTP endpoints exposed by RyzenDesk, including required headers, parameters, and sample response payloads.

---

## 🔐 Authentication

RyzenDesk supports two authentication paradigms — **both are enforced by server-side middleware**:

1. **Client Token Auth** — customers sign in via `POST /api/auth/customer-login` with their email + secret `zt_...` token. Successful login issues an HMAC-signed, HttpOnly session cookie (`ryzendesk_session`). Tokens are stored server-side as SHA-256 digests and cannot be recovered.
2. **Staff Session Auth** — staff sign in via `POST /api/auth/login` (username + password, scrypt-verified). The same signed session cookie is issued with a 24-hour sliding expiry.

Additional rules:

- Every state-changing request is protected by **SameSite=Lax** cookies plus **Origin validation** (cross-origin writes → `403 CSRF_BLOCKED`).
- Requests without a valid session receive `401 {"error":"Authentication required","code":"AUTH_REQUIRED"}`.
- Staff with an un-rotated bootstrap password receive `403 {"code":"PASSWORD_CHANGE_REQUIRED"}` on all routes except `/api/auth/change-password`.
- Permission failures return `403 {"code":"FORBIDDEN","permission":"<required_permission>"}`.
- `POST /api/auth/logout` invalidates the session server-side.

### Auth Endpoints
| Endpoint | Method | Access | Description |
|:---|:---:|:---:|:---|
| `/api/auth/login` | `POST` | Public (rate-limited) | Staff sign-in |
| `/api/auth/customer-login` | `POST` | Public (rate-limited) | Customer sign-in (email + `zt_` token) |
| `/api/auth/me` | `GET` | Session | Current profile + effective RBAC permissions |
| `/api/auth/change-password` | `POST` | Session | Rotate password (min 8 chars, enforced on first login) |
| `/api/auth/logout` | `POST` | Session | Destroy the session |

```json
// POST /api/auth/login
{ "username": "admin", "password": "••••••••" }
// 200 OK
{
  "user": {
    "kind": "staff",
    "username": "admin",
    "displayName": "Super Administrator",
    "role": "super_admin",
    "email": "admin@ryzendesk.internal",
    "mustChangePassword": false
  }
}
```

---

## 🎟️ Ticket Endpoints

### 1. Submit a Ticket
- **Method**: `POST`
- **Path**: `/api/tickets`
- **Access**: Public (rate-limited, validated)
- **Request Body**:
```json
{
  "contact": { "fullName": "Alex Mercer", "email": "alex@example.com" },
  "subject": "Unable to connect custom domain",
  "body": "DNS records are propagating but SSL handshake fails.",
  "type": "Technical",
  "priority": "high",
  "attachments": []
}
```
- **Response** (`201 Created`):
```json
{
  "ticket": { "id": "RD-2026-0042", "subject": "Unable to connect custom domain", "status": "open" },
  "secretToken": "zt_9f8e7d6c5b4a3..."
}
```
> The secret token is displayed **once** and emailed to the customer; the server stores only its SHA-256 digest.

### 2. List Tickets
- **Method**: `GET`
- **Path**: `/api/tickets`
- **Access**: Staff (`tickets_view_all`) or Customer session (hard-scoped to own tickets)
- **Query Parameters**: `status`, `priority`, `team`, `search`, `sla=breached|warning`, `zaiId`

### 3. Get Ticket Thread
- **Method**: `GET`
- **Path**: `/api/tickets/:id`
- **Access**: Staff or ticket owner. Internal notes are **stripped from customer responses**.

### 4. Update Ticket
- **Method**: `PATCH`
- **Path**: `/api/tickets/:id`
- **Access**: `tickets_edit_status` (assignee changes additionally require `tickets_assign`)

### 5. Add Reply or Internal Note
- **Method**: `POST`
- **Path**: `/api/tickets/:id/messages`
- **Access**: `tickets_reply`; internal visibility requires `tickets_internal_note`; customers can only post public replies on their own tickets (identity derived from the session, never the body)

---

## ⚙️ Administration Endpoints

| Endpoint | Method | Access | Description |
|:---|:---:|:---:|:---|
| `/api/admin/staff` | `GET` / `POST` / `PATCH` | `admin_manage_staff` | Staff roster (password hashes never leave the server) |
| `/api/admin/rbac` | `GET` / `PUT` | Staff / `admin_manage_rbac` | Live permission matrix |
| `/api/admin/sla` | `GET` / `PUT` | Staff / `sla_manage` | SLA policies |
| `/api/admin/smtp` | `GET` / `PUT` / `POST test` | `admin_smtp` | SMTP credentials (masked) & test dispatch |
| `/api/admin/webhooks` | `GET` / `POST` / `DELETE` | `admin_webhooks` | Webhook configuration (SSRF-validated targets) |
| `/api/admin/webhooks/:id/test` | `POST` | `admin_webhooks` | Test-fire a webhook ping |
| `/api/admin/audit` | `GET` / `GET export` | `admin_view_audit` | Compliance audit trail (CSV export) |
| `/api/admin/deploy-codebase` | `POST` | `admin_deploy` (Super Admin) | Trigger full codebase push to GitHub |

### Synchronize JSON Database
- **Push to GitHub**: `POST /api/sync/push` — `admin_cloud_sync`
- **Pull from GitHub**: `POST /api/sync/pull` — `admin_cloud_sync`

> Snapshots are AES-256-GCM encrypted envelopes; the repository never receives plaintext ticket data or credentials.

---

## 🧙 Installation Endpoints

| Endpoint | Method | Access | Description |
|:---|:---:|:---:|:---|
| `/api/install/status` | `GET` | Public | Installation flag + counters (lock key never exposed) |
| `/api/install/preflight` | `GET` | Public pre-install / Super Admin after | Runtime diagnostics |
| `/api/install/test-smtp` | `POST` | Public pre-install / Super Admin after | SMTP gateway verification |
| `/api/install/test-ai` | `POST` | Public pre-install / Super Admin after | Gemini credential verification |
| `/api/install/execute` | `POST` | Public bootstrap (rate-limited 5/h) / Super Admin after | Provision installation |
| `/api/install/reset` | `POST` | Super Admin (post-install) | Reset installation state |

---

## 📌 Error Semantics

| Code | Meaning |
|:---|:---|
| `400` | Validation error (invalid email, weak password, bad webhook target, …) |
| `401` `AUTH_REQUIRED` | No or invalid session |
| `403` `FORBIDDEN` | Authenticated but missing the required RBAC permission |
| `403` `PASSWORD_CHANGE_REQUIRED` | Bootstrap/provisioned password must be rotated first |
| `403` `CSRF_BLOCKED` | Cross-origin mutation rejected |
| `403` `SUPER_ADMIN_ONLY` | Installation/system configuration requires Super Admin |
| `404` | Resource not found (API routes return JSON, never the SPA shell) |
| `429` `RATE_LIMITED` | Sliding-window rate limit exceeded |
