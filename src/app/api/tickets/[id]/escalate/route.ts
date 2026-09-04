import { NextResponse } from 'next/server'
import { z } from 'zod'
import { staffSession, setupPending } from '@/lib/helpdesk/auth'
import { escalateTicket } from '@/lib/helpdesk/service'
import { TEAMS } from '@/lib/helpdesk/types'

export const dynamic = 'force-dynamic'

const schema = z.object({
  toMember: z.string().min(1, 'Choose a staff member to escalate to'),
  toTeam: z.enum(TEAMS),
  reason: z.string().max(2000).optional().or(z.literal('')),
})

/** Staff-only: escalate a ticket to another team/member. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = staffSession(req)
  if (!s) return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
  if (setupPending(s.member)) return NextResponse.json({ error: 'Initial setup required — change your password first.', code: 'setup_required' }, { status: 403 })
  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid escalation' }, { status: 400 })
  }
  const ticket = escalateTicket({
    ticketId: id,
    toMember: parsed.data.toMember,
    toTeam: parsed.data.toTeam,
    reason: parsed.data.reason || '',
    actor: s.member.username,
  })
  if (!ticket) return NextResponse.json({ error: 'Ticket or target member not found' }, { status: 404 })
  return NextResponse.json({ ok: true, ticket })
}
