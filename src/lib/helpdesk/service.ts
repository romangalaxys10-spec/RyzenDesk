/**
 * Helpdesk business logic: tickets, users, messages, escalations, notifications.
 */

import type { Escalation, HelpdeskUser, IssueType, Ticket, TicketMessage, TicketPriority, TicketStatus, Team } from './types'
import { TYPE_PRIORITY, TYPE_TEAM, maxPriority } from './types'
import { getDb, mutate, audit, nextTicketId, randomToken, msgId, randomChatId } from './db'
import { escapeHtml, notifyStaff, notifyStaffMember, notifyUser, ticketCard } from './telegram'

export interface CreateTicketInput {
  zaiId: string
  fullName: string
  email: string
  discordId?: string
  type: IssueType
  subject: string
  body: string
  reproduction: string
}

export interface CreateTicketResult {
  user: HelpdeskUser
  ticket: Ticket
  isNewUser: boolean
}

export function createTicket(input: CreateTicketInput): CreateTicketResult {
  const db = getDb()
  const now = new Date().toISOString()
  let result: CreateTicketResult | null = null

  mutate((d) => {
    let user = d.users.find((u) => u.zaiId.toLowerCase() === input.zaiId.trim().toLowerCase())
    let isNewUser = false
    if (!user) {
      isNewUser = true
      user = {
        zaiId: input.zaiId.trim(),
        fullName: input.fullName.trim(),
        email: input.email.trim().toLowerCase(),
        discordId: (input.discordId || '').trim(),
        token: randomToken(),
        telegramChatId: null,
        createdAt: now,
        updatedAt: now,
      }
      d.users.push(user)
    } else {
      // Refresh contact details on every submission (kept in sync).
      user.fullName = input.fullName.trim()
      user.email = input.email.trim().toLowerCase()
      user.discordId = (input.discordId || '').trim()
      user.updatedAt = now
    }

    const id = nextTicketId(d)
    const priority: TicketPriority = TYPE_PRIORITY[input.type]
    const ticket: Ticket = {
      id,
      zaiId: user.zaiId,
      contact: { zaiId: user.zaiId, fullName: user.fullName, email: user.email, discordId: user.discordId },
      subject: input.subject.trim(),
      type: input.type,
      status: 'open',
      priority,
      team: TYPE_TEAM[input.type],
      assignee: null,
      escalationLevel: 0,
      escalations: [],
      body: input.body.trim(),
      reproduction: input.reproduction.trim(),
      messages: [],
      createdAt: now,
      updatedAt: now,
    }
    d.tickets.unshift(ticket)
    audit(d, user.zaiId, 'ticket.created', `${id} [${input.type}] ${input.subject.slice(0, 80)}`)
    result = { user, ticket, isNewUser }
    return `ticket: ${id} created (${input.type}) for ${user.zaiId}`
  })

  if (!result) throw new Error('ticket creation failed')
  return result
}

export interface AddMessageInput {
  ticketId: string
  from: 'user' | 'staff'
  author: string
  body: string
  visibility?: 'public' | 'internal'
}

export function addMessage(input: AddMessageInput): { ticket: Ticket; message: TicketMessage } | null {
  const db = getDb()
  const ticket = db.tickets.find((t) => t.id === input.ticketId)
  if (!ticket) return null

  const message: TicketMessage = {
    id: msgId(),
    from: input.from,
    author: input.author,
    body: input.body.trim(),
    visibility: input.visibility || 'public',
    at: new Date().toISOString(),
  }

  mutate((d) => {
    const t = d.tickets.find((x) => x.id === input.ticketId)
    if (!t) return
    t.messages.push(message)
    t.updatedAt = message.at
    // Auto status transitions
    if (input.from === 'staff' && input.visibility !== 'internal' && ['open', 'waiting_customer'].includes(t.status)) {
      t.status = 'in_progress'
    }
    if (input.from === 'user' && t.status === 'waiting_customer') {
      t.status = 'in_progress'
    }
    audit(d, input.author, `message.${input.from}`, `${input.ticketId} (${message.visibility})`)
    return `ticket: ${input.ticketId} new ${input.from} message (${message.visibility})`
  })

  // Notifications (outside mutation to keep commits snappy)
  void (async () => {
    const esc = escapeHtml
    if (input.from === 'user') {
      await notifyStaff(
        [
          '💬 <b>Client replied</b>',
          ticketCard(ticket),
          '',
          esc(input.body.slice(0, 700)),
        ].join('\n'),
      )
    } else {
      const user = getDb().users.find((u) => u.zaiId === ticket.zaiId)
      if (user && message.visibility === 'public') {
        await notifyUser(
          user,
          [
            `💬 <b>Support replied to ${esc(ticket.id)}</b>`,
            `${esc(ticket.subject)}`,
            '',
            esc(input.body.slice(0, 700)),
          ].join('\n'),
        )
      }
    }
  })()

  const updated = getDb().tickets.find((t) => t.id === input.ticketId)!
  return { ticket: updated, message }
}

export function updateTicket(
  ticketId: string,
  patch: { status?: TicketStatus; priority?: TicketPriority; assignee?: string | null; team?: Team },
  actor: string,
): Ticket | null {
  const db = getDb()
  const existing = db.tickets.find((t) => t.id === ticketId)
  if (!existing) return null
  const oldStatus = existing.status
  const oldAssignee = existing.assignee

  mutate((d) => {
    const t = d.tickets.find((x) => x.id === ticketId)
    if (!t) return
    if (patch.status) t.status = patch.status
    if (patch.priority) t.priority = patch.priority
    if (patch.team) t.team = patch.team
    if (patch.assignee !== undefined) t.assignee = patch.assignee
    t.updatedAt = new Date().toISOString()
    audit(d, actor, 'ticket.updated', `${ticketId} status=${t.status} priority=${t.priority} team=${t.team} assignee=${t.assignee || '—'}`)
    return `ticket: ${ticketId} updated by ${actor}`
  })

  const updated = db.tickets.find((t) => t.id === ticketId)!
  const user = getDb().users.find((u) => u.zaiId === updated.zaiId)
  if (patch.status && patch.status !== oldStatus && user) {
    void notifyUser(
      user,
      [
        `🔔 <b>Ticket ${escapeHtml(updated.id)} status changed</b>`,
        `${escapeHtml(oldStatus.replace('_', ' '))} → <b>${escapeHtml(patch.status.replace('_', ' '))}</b>`,
        `${escapeHtml(updated.subject)}`,
      ].join('\n'),
    )
  }
  // Notify newly assigned staff member (direct ping)
  if (patch.assignee && patch.assignee !== oldAssignee && patch.assignee !== actor) {
    void notifyStaffMember(
      patch.assignee,
      [
        `📌 <b>You were assigned a ticket</b>`,
        ticketCard(updated),
        `Assigned by: ${escapeHtml(actor)}`,
      ].join('\n'),
    )
  }
  return updated
}

export interface EscalateInput {
  ticketId: string
  toMember: string
  toTeam: Team
  reason: string
  actor: string
}

/** Escalate a ticket to another team/member: reassign, boost priority, notify. */
export function escalateTicket(input: EscalateInput): Ticket | null {
  const db = getDb()
  const existing = db.tickets.find((t) => t.id === input.ticketId)
  if (!existing) return null
  const member = db.staff.find((s) => s.username.toLowerCase() === input.toMember.toLowerCase())
  if (!member) return null

  const level = existing.escalationLevel + 1
  const record: Escalation = {
    id: msgId(),
    at: new Date().toISOString(),
    from: input.actor,
    toMember: member.username,
    toTeam: input.toTeam,
    reason: input.reason.trim(),
  }

  mutate((d) => {
    const t = d.tickets.find((x) => x.id === input.ticketId)
    if (!t) return
    t.escalations.push(record)
    t.escalationLevel = level
    t.assignee = member.username
    t.team = input.toTeam
    t.priority = maxPriority(t.priority, level >= 2 ? 'urgent' : 'high')
    if (t.status === 'open') t.status = 'in_progress'
    t.updatedAt = record.at
    t.messages.push({
      id: msgId(),
      from: 'system',
      author: 'System',
      body: `Ticket escalated to ${member.displayName} (${input.toTeam} team) by ${input.actor}. Priority raised to ${t.priority}.${input.reason.trim() ? ` Reason: ${input.reason.trim()}` : ''}`,
      visibility: 'internal',
      at: record.at,
    })
    audit(d, input.actor, 'ticket.escalated', `${input.ticketId} → ${member.username} (${input.toTeam}) level=${level}`)
    return `ticket: ${input.ticketId} escalated to ${member.username} by ${input.actor}`
  })

  const updated = db.tickets.find((t) => t.id === input.ticketId)!
  // Direct ping to the escalation target + general staff notice
  void notifyStaffMember(
    member.username,
    [
      `⬆️ <b>Ticket escalated to YOU</b>`,
      ticketCard(updated),
      `Escalated by: ${escapeHtml(input.actor)}`,
      input.reason.trim() ? `Reason: ${escapeHtml(input.reason.trim().slice(0, 300))}` : '',
    ].filter(Boolean).join('\n'),
  )
  void notifyStaff(
    [
      `⬆️ <b>Ticket escalated</b>`,
      ticketCard(updated),
      `${escapeHtml(input.actor)} escalated to <b>${escapeHtml(member.username)}</b> (${escapeHtml(input.toTeam)})`,
    ].join('\n'),
    input.actor,
  )
  return updated
}

export function listTicketsForUser(zaiId: string): Ticket[] {
  const db = getDb()
  return db.tickets
    .filter((t) => t.zaiId.toLowerCase() === zaiId.toLowerCase())
    .map((t) => ({ ...t, messages: t.messages.filter((m) => m.visibility === 'public') }))
}

export function listAllTickets(): Ticket[] {
  return getDb().tickets
}

export function getTicketForUser(ticketId: string, zaiId: string): Ticket | null {
  const db = getDb()
  const t = db.tickets.find((x) => x.id === ticketId)
  if (!t || t.zaiId.toLowerCase() !== zaiId.toLowerCase()) return null
  return { ...t, messages: t.messages.filter((m) => m.visibility === 'public') }
}

export function getTicketForStaff(ticketId: string): Ticket | null {
  return getDb().tickets.find((x) => x.id === ticketId) || null
}

export function newTicketNotification(t: Ticket): void {
  void (async () => {
    await notifyStaff(
      [
        '🆕 <b>New ticket submitted</b>',
        ticketCard(t),
        '',
        `📝 ${escapeHtml(t.body.slice(0, 500))}`,
        '',
        'Open the staff panel to respond.',
      ].join('\n'),
    )
  })()
}

export function listStaffRoster(): Array<{ username: string; displayName: string; role: string; team: Team; suspended: boolean }> {
  return getDb().staff.map((s) => ({
    username: s.username,
    displayName: s.displayName,
    role: s.role,
    team: s.team,
    suspended: s.suspended,
  }))
}
