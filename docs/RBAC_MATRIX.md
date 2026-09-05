# 🛡️ Role-Based Access Control (RBAC) Matrix

RyzenDesk features an enterprise security model with 5 distinct roles and granular permission controls.

> **Server-side enforcement**: This matrix is not cosmetic. Every REST endpoint validates the caller's session and checks the corresponding permission from the live matrix (stored in `db.settings.rbac`) before processing the request. The Admin Console edits take effect immediately without a restart.

---

## 🔐 How Enforcement Works

1. The caller presents a signed session cookie (`ryzendesk_session`) issued by `/api/auth/login` (staff) or `/api/auth/customer-login` (customer).
2. Middleware resolves the session → account → role → permission set on **every request**.
3. Routes declare the permission they require (`requirePermission('tickets_assign')`, etc.). Missing permissions produce `403 {"code":"FORBIDDEN","permission":"..."}`.
4. Customer sessions are additionally **hard-scoped** to their own tickets; internal notes and time logs are stripped from their responses.

---

## 👥 Role Definitions

| Role | Target Audience | Primary Focus |
|:---|:---|:---|
| **Super Admin** | CTO, Head of IT, Lead Administrator | Full system authority, security policies, API integrations, and billing |
| **Support Manager** | Team Leads, Support Supervisors | Queue throughput, team assignments, SLA threshold management, and analytics |
| **Senior Agent** | Tier 2/3 Technical Specialists | High-priority escalations, internal notes, and macro authoring |
| **Support Agent** | Tier 1 Frontline Support | Ticket replies, status transitions, and customer live chat engagement |
| **Customer / Client** | External Users & Account Holders | Ticket submission, public replies, and knowledge base lookups |

---

## 📋 Comprehensive Capabilities Matrix

| Permission Capability | Super Admin | Support Manager | Senior Agent | Support Agent | Customer |
|:---|:---:|:---:|:---:|:---:|:---:|
| **Submit New Ticket** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Own Submitted Tickets** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Live Chat with Support** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Browse Knowledge Wiki** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **View Global Ticket Queue** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Reply to Customer Tickets** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Add Private Internal Notes** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Change Status & Priority** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Assign / Reassign Staff** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Escalate to Tier 2/3** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Author Canned Responses** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Edit Knowledge Wiki Articles** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Manage SLA Policies** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Configure Webhook Deliveries** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Export Compliance Audit Logs** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Create & Deactivate Staff** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Modify RBAC Matrix** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Deploy Codebase to GitHub** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **SMTP Mailer Credentials** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Cloud Sync Push/Pull (encrypted)** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 🔍 Audit Trail Specification

All security-sensitive operations generate immutable audit events recorded in the `audit` collection: staff/customer logins, password rotations, staff account lifecycle, RBAC matrix edits, SLA/SMTP/webhook configuration, encrypted cloud sync pushes, codebase deployments and installation events.

```json
{
  "id": "aud_1757094012345_8f3a91c2",
  "at": "2026-09-05T14:31:51.000Z",
  "actor": "admin",
  "actorRole": "super_admin",
  "action": "CODEBASE_DEPLOYED",
  "module": "system",
  "entityId": null,
  "detail": "Full codebase deployment triggered from 203.0.113.7",
  "ip": "203.0.113.7"
}
```

Audit reads and the CSV export require the `admin_view_audit` permission (Super Admin & Support Manager).
