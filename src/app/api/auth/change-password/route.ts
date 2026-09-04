import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { staffSession } from '@/lib/helpdesk/auth'
import { hashPassword, mutate, audit } from '@/lib/helpdesk/db'

export const dynamic = 'force-dynamic'

const schema = z.object({
  currentPassword: z.string().max(200).optional().or(z.literal('')),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .max(100, 'Password is too long'),
})

/**
 * Staff: change own password.
 * - When the account is flagged mustChangePassword (initial setup / admin reset),
 *   the current password is not required — the member just authenticated with it.
 * - Otherwise the current password must be provided and verified.
 */
export async function POST(req: Request) {
  const s = staffSession(req)
  if (!s) return NextResponse.json({ error: 'Staff access required' }, { status: 403 })

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 })
  }

  const { currentPassword, newPassword } = parsed.data
  const member = s.member
  const setupPending = Boolean(member.mustChangePassword)

  if (!setupPending) {
    if (!currentPassword) {
      return NextResponse.json({ error: 'Current password is required' }, { status: 400 })
    }
    const a = Buffer.from(member.passwordHash)
    const b = Buffer.from(hashPassword(currentPassword))
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
    }
  }

  mutate((d) => {
    const m = d.staff.find((x) => x.username === member.username)
    if (!m) return
    m.passwordHash = hashPassword(newPassword)
    m.mustChangePassword = false
    audit(d, m.username, 'staff.password_changed', setupPending ? 'initial setup completed' : 'self-service change')
    return `staff: password changed for ${m.username}${setupPending ? ' (initial setup)' : ''}`
  })

  return NextResponse.json({
    ok: true,
    profile: {
      username: member.username,
      displayName: member.displayName,
      staffRole: member.role,
      team: member.team,
      mustChangePassword: false,
    },
  })
}
