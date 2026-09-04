import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authFromRequest, staffSession } from '@/lib/helpdesk/auth'
import { listChatsForStaff, listChatsForUser, startChat, liveChatForUser } from '@/lib/helpdesk/chat'
import { getDb } from '@/lib/helpdesk/db'

export const dynamic = 'force-dynamic'

/** Live chat list. Staff: all chats. Clients: own chats (with liveChatEnabled flag). */
export async function GET(req: Request) {
  const auth = authFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (auth.role === 'staff') {
    const s = staffSession(req)
    if (!s) return NextResponse.json({ error: 'Session no longer valid' }, { status: 401 })
    const db = getDb()
    return NextResponse.json({
      chats: listChatsForStaff(),
      liveChatEnabled: Boolean(db.settings?.liveChatEnabled),
      me: s.member.username,
    })
  }

  const db = getDb()
  return NextResponse.json({
    chats: listChatsForUser(auth.id).slice(0, 20),
    live: liveChatForUser(auth.id),
    liveChatEnabled: Boolean(db.settings?.liveChatEnabled),
  })
}

const startSchema = z.object({ action: z.literal('start') })

/** Client: start a live chat (only when enabled). */
export async function POST(req: Request) {
  const auth = authFromRequest(req)
  if (!auth || auth.role !== 'user') return NextResponse.json({ error: 'Clients only' }, { status: 403 })
  const parsed = startSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const result = startChat(auth.id, auth.name)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 })
  return NextResponse.json({ ok: true, chat: result })
}
