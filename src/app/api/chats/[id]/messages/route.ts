import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authFromRequest, staffSession, setupPending } from '@/lib/helpdesk/auth'
import { addChatMessage, chatForUser, getChat } from '@/lib/helpdesk/chat'

export const dynamic = 'force-dynamic'

/** Poll chat messages (?after=ISO to fetch only newer ones client-side). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params

  if (auth.role === 'staff') {
    const s = staffSession(req)
    if (!s) return NextResponse.json({ error: 'Session no longer valid' }, { status: 401 })
    const chat = getChat(id)
    if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
    return NextResponse.json({ chat })
  }
  const chat = chatForUser(id, auth.id)
  if (!chat) return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  return NextResponse.json({ chat })
}

const schema = z.object({
  body: z.string().min(1, 'Message cannot be empty').max(4000),
})

/** Send a chat message (client or staff participant). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid message' }, { status: 400 })
  }

  if (auth.role === 'staff') {
    const s = staffSession(req)
    if (!s) return NextResponse.json({ error: 'Session no longer valid' }, { status: 401 })
    if (setupPending(s.member)) return NextResponse.json({ error: 'Initial setup required — change your password first.', code: 'setup_required' }, { status: 403 })
    const chat = addChatMessage(id, 'staff', s.member.displayName || s.member.username, parsed.data.body)
    if (!chat) return NextResponse.json({ error: 'Chat not found or ended' }, { status: 404 })
    return NextResponse.json({ ok: true, chat })
  }

  const existing = getChat(id)
  if (!existing || existing.zaiId.toLowerCase() !== auth.id.toLowerCase()) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  }
  const chat = addChatMessage(id, 'user', auth.name || auth.id, parsed.data.body)
  if (!chat) return NextResponse.json({ error: 'Chat not found or ended' }, { status: 404 })
  return NextResponse.json({ ok: true, chat })
}
