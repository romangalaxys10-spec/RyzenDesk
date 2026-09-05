# 🛡️ Role-Based Access Control (RBAC) Matrix

RyzenDesk features an enterprise security model with 5 distinct roles and granular permission controls.

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

---

## 🔍 Audit Trail Specification

All security-sensitive operations generate immutable audit events recorded in `auditLogs`:

```json
{
  "id": "audit_827f31a",
  "timestamp": "2026-09-04T14:31:51.000Z",
  "actorId": "usr_superadmin",
  "actorName": "System Administrator",
  "actorRole": "superadmin",
  "action": "deploy_codebase",
  "module": "system",
  "details": "Triggered full codebase push to GitHub repository romangalaxys10-spec/RyzenDesk",
  "ipAddress": "127.0.0.1"
}
```
