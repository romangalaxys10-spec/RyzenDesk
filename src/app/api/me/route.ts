import { NextResponse } from 'next/server'
import { authFromRequest } from '@/lib/helpdesk/auth'
import { listTicketsForUser } from '@/lib/helpdesk/service'

export const dynamic = 'force-dynamic'

/** Returns the current session profile + tickets (for users). Validates staff against live DB (suspension/role). */
export async function GET(req: Request) {
  const auth = authFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (auth.role === 'user') {
    return NextResponse.json({
      role: 'user',
      profile: { zaiId: auth.id, fullName: auth.name },
      tickets: listTicketsForUser(auth.id),
    })
  }

  // Staff: resolve live record so suspension & role changes take effect immediately.
  const { staffSession } = await import('@/lib/helpdesk/auth')
  const s = staffSession(req)
  if (!s) return NextResponse.json({ error: 'Session no longer valid' }, { status: 401 })
  return NextResponse.json({
    role: 'staff',
    profile: {
      username: s.member.username,
      displayName: s.member.displayName,
      staffRole: s.member.role,
      team: s.member.team,
      mustChangePassword: Boolean(s.member.mustChangePassword),
    },
  })
}
