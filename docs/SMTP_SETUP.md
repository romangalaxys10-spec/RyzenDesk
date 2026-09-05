# 📧 Transactional SMTP Email Setup

RyzenDesk supports transactional emails for customer ticket creation receipts, agent assignments, and customer reply notifications.

---

## ⚙️ Configuration Parameters

Configure SMTP settings in `.env` or interactively in **Admin Console &rarr; Email (SMTP)**:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="support@yourcompany.com"
SMTP_PASS="your-app-specific-password"
SMTP_FROM="support@yourcompany.com"
SMTP_SECURE="false"
```

---

## 🔌 Popular Provider Settings

### 1. Google Workspace / Gmail
- **Host**: `smtp.gmail.com`
- **Port**: `587`
- **Secure**: `false` (uses STARTTLS)
- **Password**: Generate a 16-character **App Password** in Google Account &rarr; Security &rarr; 2-Step Verification &rarr; App Passwords.

### 2. Amazon SES
- **Host**: `email-smtp.us-east-1.amazonaws.com`
- **Port**: `587`
- **Secure**: `false`
- **User & Pass**: Use your dedicated Amazon SES SMTP credentials.

### 3. SendGrid
- **Host**: `smtp.sendgrid.net`
- **Port**: `587`
- **User**: `apikey`
- **Pass**: Your generated SendGrid API Key (`SG....`)

### 4. Postmark
- **Host**: `smtp.postmarkapp.com`
- **Port**: `587`
- **User & Pass**: Your Postmark Server API Token.

---

## 🧪 Testing Email Delivery

1. Open **Admin Console &rarr; Email (SMTP)** tab.
2. Enter your test recipient email address in the **Send Test Email** section.
3. Click **Send Test Email** and check the **Email Delivery Logs** table for immediate delivery confirmation or error diagnostics.
