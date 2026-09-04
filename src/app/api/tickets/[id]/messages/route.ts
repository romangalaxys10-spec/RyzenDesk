import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authFromRequest, staffSession, setupPending } from '@/lib/helpdesk/auth'
import { addMessage } from '@/lib/helpdesk/service'

export const dynamic = 'force-dynamic'

const schema = z.object({
  body: z.string().min(1, 'Message cannot be empty').max(8000),
  visibility: z.enum(['public', 'internal']).optional(),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (auth.role === 'staff') {
    const s = staffSession(req)
    if (!s) return NextResponse.json({ error: 'Session no longer valid' }, { status: 401 })
    if (setupPending(s.member)) return NextResponse.json({ error: 'Initial setup required — change your password first.', code: 'setup_required' }, { status: 403 })
  }
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid message' }, { status: 400 })
  }

  const result = addMessage({
    ticketId: id,
    from: auth.role === 'staff' ? 'staff' : 'user',
    author: auth.name,
    body: parsed.data.body,
    visibility: auth.role === 'staff' ? parsed.data.visibility || 'public' : 'public',
  })
  if (!result) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })

  const { ticket, message } = result
  const safeTicket =
    auth.role === 'user'
      ? { ...ticket, messages: ticket.messages.filter((m) => m.visibility === 'public') }
      : ticket
  return NextResponse.json({ ok: true, ticket: safeTicket, message })
}
