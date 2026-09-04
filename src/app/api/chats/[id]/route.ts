import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authFromRequest, staffSession, setupPending } from '@/lib/helpdesk/auth'
import { chatForUser, claimChat, endChat, getChat } from '@/lib/helpdesk/chat'

export const dynamic = 'force-dynamic'

/** Get one chat (participant only). */
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

const patchSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('claim') }),
  z.object({ action: z.literal('end') }),
])

/** Staff: claim / end. Client: end own. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = authFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  if (auth.role === 'staff') {
    const s = staffSession(req)
    if (!s) return NextResponse.json({ error: 'Session no longer valid' }, { status: 401 })
    if (setupPending(s.member)) return NextResponse.json({ error: 'Initial setup required — change your password first.', code: 'setup_required' }, { status: 403 })
    const chat =
      parsed.data.action === 'claim'
        ? claimChat(id, s.member.username)
        : endChat(id, s.member.username, 'staff')
    if (!chat) return NextResponse.json({ error: 'Chat not found or already ended' }, { status: 404 })
    return NextResponse.json({ ok: true, chat })
  }

  if (parsed.data.action !== 'end') return NextResponse.json({ error: 'Clients cannot claim chats' }, { status: 403 })
  const chat = endChat(id, auth.name || auth.id, 'user')
  if (!chat || chat.zaiId.toLowerCase() !== auth.id.toLowerCase()) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, chat })
}
