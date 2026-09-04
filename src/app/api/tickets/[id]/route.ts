import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authFromRequest, staffSession, getStaffByName, setupPending } from '@/lib/helpdesk/auth'
import { getTicketForStaff, getTicketForUser, updateTicket } from '@/lib/helpdesk/service'
import { TICKET_PRIORITIES, TICKET_STATUSES, TEAMS } from '@/lib/helpdesk/types'

export const dynamic = 'force-dynamic'

/** Get a single ticket (owner or staff). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (auth.role === 'staff') {
    const s = staffSession(req)
    if (!s) return NextResponse.json({ error: 'Session no longer valid' }, { status: 401 })
    const ticket = getTicketForStaff(id)
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    return NextResponse.json({ ticket, viewer: 'staff' })
  }

  const ticket = getTicketForUser(id, auth.id)
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  return NextResponse.json({ ticket, viewer: 'user' })
}

const patchSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignee: z.string().nullable().optional(),
  team: z.enum(TEAMS).optional(),
})

/** Staff-only: update ticket status / priority / assignee / team. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = staffSession(req)
  if (!s) return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
  if (setupPending(s.member)) return NextResponse.json({ error: 'Initial setup required — change your password first.', code: 'setup_required' }, { status: 403 })
  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid update payload' }, { status: 400 })
  const { assignee, ...rest } = parsed.data
  if (!rest.status && !rest.priority && !rest.team && assignee === undefined) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }
  if (assignee) {
    const target = getStaffByName(assignee)
    if (!target) return NextResponse.json({ error: 'Unknown staff member' }, { status: 400 })
  }
  const ticket = updateTicket(id, { ...rest, assignee: assignee ?? undefined }, s.member.username)
  if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  return NextResponse.json({ ok: true, ticket })
}
