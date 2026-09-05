# 📡 RyzenDesk REST API Specification

This document details the HTTP endpoints exposed by RyzenDesk, including required headers, parameters, and sample response payloads.

---

## 🔐 Authentication

RyzenDesk supports two authentication paradigms:

1. **Client Token Auth**: Header `Authorization: Bearer zt_<token>` or `x-client-token: zt_<token>`.
2. **Staff Session Auth**: Signed cookie `ryzendesk_session` containing an encrypted session identifier, or `x-staff-token: <session_id>`.

---

## 🎟️ Ticket Endpoints

### 1. Submit a Ticket
- **Method**: `POST`
- **Path**: `/api/tickets`
- **Access**: Public
- **Request Body**:
```json
{
  "clientName": "Alex Mercer",
  "clientEmail": "alex@example.com",
  "subject": "Unable to connect custom domain",
  "description": "DNS records are propagating but SSL handshake fails.",
  "category": "Technical Issue",
  "priority": "High",
  "attachments": []
}
```
- **Response** (`201 Created`):
```json
{
  "success": true,
  "ticketId": "RD-2026-0042",
  "clientToken": "zt_9f8e7d6c5b4a3...",
  "ticket": {
    "id": "RD-2026-0042",
    "subject": "Unable to connect custom domain",
    "status": "Open",
    "priority": "High",
    "slaDueAt": "2026-09-04T16:00:00.000Z",
    "createdAt": "2026-09-04T14:00:00.000Z"
  }
}
```

---

### 2. List Active Tickets
- **Method**: `GET`
- **Path**: `/api/tickets`
- **Access**: Staff
- **Query Parameters**:
  - `status`: Filter by `Open`, `In Progress`, `Pending`, `Resolved`, `Closed`
  - `priority`: Filter by `Low`, `Medium`, `High`, `Urgent`
  - `team`: Filter by `Support`, `Engineering`, `Billing`, `Security`
  - `assigneeId`: Filter by staff ID

---

### 3. Add Reply or Internal Note
- **Method**: `POST`
- **Path**: `/api/tickets/:id/messages`
- **Access**: Session (Client or Staff)
- **Request Body**:
```json
{
  "body": "We have updated the CAA record. Please re-check now.",
  "isInternal": false,
  "attachments": []
}
```
- **Response** (`200 OK`):
```json
{
  "success": true,
  "messageId": "msg_018f...",
  "createdAt": "2026-09-04T14:15:00.000Z"
}
```

---

## 💬 Live Chat Endpoints

### 1. Get or Create Chat Session
- **Method**: `POST`
- **Path**: `/api/chats`
- **Request Body**: `{ "clientName": "Alex", "clientEmail": "alex@example.com" }`
- **Response**: `{ "chatId": "chat_01...", "status": "active" }`

### 2. Send Chat Message
- **Method**: `POST`
- **Path**: `/api/chats/:id/messages`
- **Request Body**: `{ "text": "Hello, is an agent available?" }`

---

## ⚙️ Administration Endpoints

### 1. Trigger Full Codebase GitHub Deployment
- **Method**: `POST`
- **Path**: `/api/admin/deploy-codebase`
- **Access**: Super Admin
- **Response**:
```json
{
  "success": true,
  "output": "✔ SUCCESS! All updates deployed and pushed to GitHub.\nLatest commit: 23c77b6..."
}
```

### 2. Synchronize JSON Database
- **Push to GitHub**: `POST /api/sync/push`
- **Pull from GitHub**: `POST /api/sync/pull`
