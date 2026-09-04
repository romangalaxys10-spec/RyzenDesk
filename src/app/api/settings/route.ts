import { NextResponse } from 'next/server'
import { z } from 'zod'
import { staffSession, setupPending } from '@/lib/helpdesk/auth'
import { getDb, mutate, audit } from '@/lib/helpdesk/db'

export const dynamic = 'force-dynamic'

/** Public: is live chat enabled? (Clients use this to show/hide the widget.) */
export async function GET() {
  const db = getDb()
  return NextResponse.json({ liveChatEnabled: Boolean(db.settings?.liveChatEnabled) })
}

const patchSchema = z.object({ liveChatEnabled: z.boolean() })

/** Super-admin only: toggle live chat availability. */
export async function PATCH(req: Request) {
  const s = staffSession(req)
  if (!s) return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
  if (s.member.role !== 'super_admin') return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  if (setupPending(s.member)) return NextResponse.json({ error: 'Initial setup required — change your password first.', code: 'setup_required' }, { status: 403 })
  const parsed = patchSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

  mutate((d) => {
    d.settings.liveChatEnabled = parsed.data.liveChatEnabled
    audit(d, s.member.username, 'settings.updated', `liveChat=${parsed.data.liveChatEnabled}`)
    return `settings: live chat ${parsed.data.liveChatEnabled ? 'enabled' : 'disabled'} by ${s.member.username}`
  })
  return NextResponse.json({ ok: true, liveChatEnabled: parsed.data.liveChatEnabled })
}
