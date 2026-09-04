import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateStaff, authenticateUser, createSession } from '@/lib/helpdesk/auth'

export const dynamic = 'force-dynamic'

const schema = z.object({
  mode: z.enum(['user', 'staff']),
  zaiId: z.string().optional(),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
})

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    const { mode } = parsed.data

    if (mode === 'user') {
      const { zaiId, token } = parsed.data
      if (!zaiId || !token) {
        return NextResponse.json({ error: 'User ID and Secret Token are both required' }, { status: 400 })
      }
      const user = authenticateUser(zaiId, token)
      if (!user) {
        return NextResponse.json({ error: 'Invalid User ID or Secret Token' }, { status: 401 })
      }
      const session = createSession({ role: 'user', id: user.zaiId, name: user.fullName })
      return NextResponse.json({
        ok: true,
        session,
        role: 'user',
        profile: { zaiId: user.zaiId, fullName: user.fullName, email: user.email, discordId: user.discordId, telegramLinked: Boolean(user.telegramChatId) },
      })
    }

    const { username, password } = parsed.data
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
    }
    const staff = authenticateStaff(username, password)
    if (!staff) {
      return NextResponse.json({ error: 'Invalid staff credentials' }, { status: 401 })
    }
    const session = createSession({ role: 'staff', id: staff.username, name: staff.displayName, staffRole: staff.role })
    return NextResponse.json({ ok: true, session, role: 'staff', profile: { username: staff.username, displayName: staff.displayName, staffRole: staff.role, team: staff.team, telegramLinked: Boolean(staff.telegramChatId), mustChangePassword: Boolean(staff.mustChangePassword) } })
  } catch (err) {
    console.error('[api/auth/login] error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal error during login' }, { status: 500 })
  }
}
