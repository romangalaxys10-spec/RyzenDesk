import { NextResponse } from 'next/server'
import { staffSession } from '@/lib/helpdesk/auth'
import { listAllTickets, listStaffRoster } from '@/lib/helpdesk/service'

export const dynamic = 'force-dynamic'

/** Staff-only: all tickets, newest first + roster (for assignment dropdowns). */
export async function GET(req: Request) {
  const s = staffSession(req)
  if (!s) return NextResponse.json({ error: 'Staff access required' }, { status: 403 })
  return NextResponse.json({
    tickets: listAllTickets(),
    roster: listStaffRoster(),
    profile: { username: s.member.username, displayName: s.member.displayName, staffRole: s.member.role, team: s.member.team },
  })
}
