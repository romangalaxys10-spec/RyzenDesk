import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ISSUE_TYPES } from '@/lib/helpdesk/types'
import { createTicket, newTicketNotification } from '@/lib/helpdesk/service'
import { createSession } from '@/lib/helpdesk/auth'

export const dynamic = 'force-dynamic'

const schema = z.object({
  zaiId: z.string().min(1, 'User ID is required').max(120),
  fullName: z.string().min(2, 'Full name is required').max(120),
  email: z.email('A valid email is required').max(200),
  discordId: z.string().max(120).optional().or(z.literal('')),
  type: z.enum(ISSUE_TYPES),
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200),
  body: z.string().min(10, 'Please describe the issue (at least 10 characters)').max(8000),
  reproduction: z.string().min(3, 'Please explain how to re-create the issue').max(8000),
})

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => null)
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Invalid submission'
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    const input = parsed.data
    const { user, ticket, isNewUser } = createTicket({
      zaiId: input.zaiId,
      fullName: input.fullName,
      email: input.email,
      discordId: input.discordId,
      type: input.type,
      subject: input.subject,
      body: input.body,
      reproduction: input.reproduction,
    })

    // Fire Telegram notification to staff (non-blocking).
    newTicketNotification(ticket)

    const session = createSession({ role: 'user', id: user.zaiId, name: user.fullName })
    return NextResponse.json({
      ok: true,
      ticketId: ticket.id,
      token: user.token,
      isNewUser,
      user: { zaiId: user.zaiId, fullName: user.fullName, email: user.email, discordId: user.discordId },
      ticket,
      session,
    })
  } catch (err) {
    console.error('[api/tickets] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error while creating the ticket' }, { status: 500 })
  }
}
