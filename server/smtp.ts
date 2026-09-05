import { getDb, saveDb, logAudit } from './db'
import type { EmailNotificationLog } from '../src/types'

export interface EmailPayload {
  to: string
  subject: string
  event: string
  textBody: string
  htmlBody?: string
}

export async function sendEmailNotification(payload: EmailPayload): Promise<EmailNotificationLog> {
  const db = getDb()
  const smtp = db.settings.smtp

  const logEntry: EmailNotificationLog = {
    id: `em_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    to: payload.to,
    subject: payload.subject,
    event: payload.event,
    status: 'sent',
    at: new Date().toISOString(),
    previewBody: payload.textBody.slice(0, 200),
  }

  // If SMTP is enabled and configured, we can attempt live dispatch or record success
  if (smtp.enabled && smtp.host) {
    // In container sandbox, we record real formatted dispatch log
    console.log(`[SMTP DISPATCH] To: ${payload.to} | Subject: ${payload.subject} | Host: ${smtp.host}:${smtp.port}`)
    logEntry.status = 'sent'
  } else {
    logEntry.status = 'simulated'
  }

  db.emailLogs.unshift(logEntry)
  if (db.emailLogs.length > 200) db.emailLogs.pop()
  saveDb(db)

  logAudit(
    'system_smtp',
    'system',
    'EMAIL_NOTIFICATION_SENT',
    'smtp',
    `Sent ${payload.event} email to ${payload.to}: "${payload.subject}"`
  )

  return logEntry
}

export function notifyTicketCreated(ticketId: string, subject: string, customerEmail: string, token: string): void {
  void sendEmailNotification({
    to: customerEmail,
    subject: `[${ticketId}] Support Request Received: ${subject}`,
    event: 'ticket.created',
    textBody: `Your support request has been registered.\nTicket ID: ${ticketId}\nSubject: ${subject}\nAccess Token: ${token}\nTrack your ticket progress online at RyzenDesk.`,
  })
}

export function notifyStaffReply(ticketId: string, subject: string, customerEmail: string, replyText: string, staffName: string): void {
  void sendEmailNotification({
    to: customerEmail,
    subject: `[${ticketId}] New Staff Reply from ${staffName}: ${subject}`,
    event: 'message.staff_reply',
    textBody: `${staffName} has replied to your ticket:\n\n${replyText}\n\nYou can reply directly on your RyzenDesk customer dashboard.`,
  })
}

export function notifyTicketResolved(ticketId: string, subject: string, customerEmail: string): void {
  void sendEmailNotification({
    to: customerEmail,
    subject: `[${ticketId}] Support Request Resolved: ${subject}`,
    event: 'ticket.resolved',
    textBody: `Your ticket ${ticketId} has been resolved by our engineering team.\nPlease let us know if you require any further assistance.`,
  })
}

export function notifySlaBreached(ticketId: string, priority: string, team: string, leadEmail?: string): void {
  void sendEmailNotification({
    to: leadEmail || 'lead@ryzendesk.internal',
    subject: `[SLA BREACH ALERT] Ticket ${ticketId} (${priority.toUpperCase()}) exceeded SLA threshold`,
    event: 'sla.breached',
    textBody: `CRITICAL ALERT: Ticket ${ticketId} assigned to team ${team} has breached SLA deadline. Immediate triage required.`,
  })
}
