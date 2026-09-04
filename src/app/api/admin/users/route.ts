import { NextResponse } from 'next/server'
import { z } from 'zod'
import { superAdminSession, setupPending } from '@/lib/helpdesk/auth'
import { getDb, mutate, audit, randomToken } from '@/lib/helpdesk/db'

export const dynamic = 'force-dynamic'

/** Super admin: client user directory (CRM view) with ticket stats. */
export async function GET(req: Request) {
  const s = superAdminSession(req)
  if (!s) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  const db = getDb()
  const users = db.users.map((u) => {
    const their = db.tickets.filter((t) => t.zaiId.toLowerCase() === u.zaiId.toLowerCase())
    return {
      zaiId: u.zaiId,
      fullName: u.fullName,
      email: u.email,
      discordId: u.discordId,
      telegramLinked: Boolean(u.telegramChatId),
      notes: u.notes || '',
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
      ticketCount: their.length,
      openCount: their.filter((t) => !['resolved', 'closed'].includes(t.status)).length,
      lastTicketAt: their[0]?.createdAt || null,
    }
  })
  return NextResponse.json({ users, total: users.length })
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('updateContact'),
    zaiId: z.string().min(1),
    fullName: z.string().min(2).max(120),
    email: z.string().email().max(200),
    discordId: z.string().max(120).optional().or(z.literal('')),
    notes: z.string().max(2000).optional().or(z.literal('')),
  }),
  z.object({ action: z.literal('resetToken'), zaiId: z.string().min(1) }),
  z.object({ action: z.literal('unlinkTelegram'), zaiId: z.string().min(1) }),
  z.object({
    action: z.literal('delete'),
    zaiId: z.string().min(1),
    cascadeTickets: z.boolean().optional(),
  }),
  z.object({
    action: z.literal('create'),
    zaiId: z.string().min(1).max(120),
    fullName: z.string().min(2).max(120),
    email: z.string().email().max(200),
    discordId: z.string().max(120).optional().or(z.literal('')),
  }),
])

/** Super admin: manage client users. */
export async function POST(req: Request) {
  const s = superAdminSession(req)
  if (!s) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  if (setupPending(s.member)) return NextResponse.json({ error: 'Initial setup required — change your password first.', code: 'setup_required' }, { status: 403 })
  const parsed = actionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 })
  }
  const data = parsed.data
  const db = getDb()
  const target = db.users.find((u) => u.zaiId.toLowerCase() === data.zaiId?.toLowerCase())

  switch (data.action) {
    case 'create': {
      if (target) return NextResponse.json({ error: 'A client with this User ID already exists' }, { status: 400 })
      const now = new Date().toISOString()
      let token = ''
      mutate((d) => {
        token = randomToken()
        d.users.push({
          zaiId: data.zaiId.trim(),
          fullName: data.fullName.trim(),
          email: data.email.trim().toLowerCase(),
          discordId: (data.discordId || '').trim(),
          token,
          telegramChatId: null,
          createdAt: now,
          updatedAt: now,
        })
        audit(d, s.member.username, 'user.created', `${data.zaiId} (manual)`)
        return `user: created ${data.zaiId} by ${s.member.username}`
      })
      // Token returned once — the admin hands it to the client.
      return NextResponse.json({ ok: true, zaiId: data.zaiId, token })
    }
    case 'updateContact': {
      if (!target) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      mutate((d) => {
        const u = d.users.find((x) => x.zaiId === target.zaiId)!
        u.fullName = data.fullName.trim()
        u.email = data.email.trim().toLowerCase()
        u.discordId = (data.discordId || '').trim()
        if (typeof data.notes === 'string') u.notes = data.notes.trim()
        u.updatedAt = new Date().toISOString()
        // Keep contact snapshots on tickets in sync
        for (const t of d.tickets) {
          if (t.zaiId.toLowerCase() === u.zaiId.toLowerCase()) {
            t.contact = { zaiId: u.zaiId, fullName: u.fullName, email: u.email, discordId: u.discordId }
          }
        }
        audit(d, s.member.username, 'user.updated', `${target.zaiId}`)
        return `user: updated ${target.zaiId} by ${s.member.username}`
      })
      return NextResponse.json({ ok: true })
    }
    case 'resetToken': {
      if (!target) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      let token = ''
      mutate((d) => {
        const u = d.users.find((x) => x.zaiId === target.zaiId)!
        u.token = randomToken()
        token = u.token
        u.updatedAt = new Date().toISOString()
        audit(d, s.member.username, 'user.token_reset', target.zaiId)
        return `user: token reset ${target.zaiId} by ${s.member.username}`
      })
      // Old token stops working immediately; new token shown once.
      return NextResponse.json({ ok: true, zaiId: target.zaiId, token })
    }
    case 'unlinkTelegram': {
      if (!target) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      mutate((d) => {
        const u = d.users.find((x) => x.zaiId === target.zaiId)!
        u.telegramChatId = null
        audit(d, s.member.username, 'user.telegram_unlinked', target.zaiId)
        return `user: telegram unlinked ${target.zaiId} by ${s.member.username}`
      })
      return NextResponse.json({ ok: true })
    }
    case 'delete': {
      if (!target) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
      const cascade = Boolean(data.cascadeTickets)
      mutate((d) => {
        d.users = d.users.filter((u) => u.zaiId !== target.zaiId)
        if (cascade) {
          d.tickets = d.tickets.filter((t) => t.zaiId.toLowerCase() !== target.zaiId.toLowerCase())
          d.chats = d.chats.filter((c) => c.zaiId.toLowerCase() !== target.zaiId.toLowerCase())
        }
        audit(d, s.member.username, 'user.deleted', `${target.zaiId}${cascade ? ' + tickets' : ''}`)
        return `user: deleted ${target.zaiId} by ${s.member.username}`
      })
      return NextResponse.json({ ok: true, cascade })
    }
  }
}
