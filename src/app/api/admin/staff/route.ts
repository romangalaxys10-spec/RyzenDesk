import { NextResponse } from 'next/server'
import { z } from 'zod'
import crypto from 'crypto'
import { superAdminSession, setupPending } from '@/lib/helpdesk/auth'
import { getDb, mutate, audit, hashPassword } from '@/lib/helpdesk/db'
import { TEAMS, type StaffRole, type Team } from '@/lib/helpdesk/types'

export const dynamic = 'force-dynamic'

/** Super admin: staff roster (without password hashes) + recent audit trail. */
export async function GET(req: Request) {
  const s = superAdminSession(req)
  if (!s) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  const db = getDb()
  return NextResponse.json({
    staff: db.staff.map((m) => ({
      username: m.username,
      displayName: m.displayName,
      role: m.role,
      team: m.team,
      suspended: m.suspended,
      telegramLinked: Boolean(m.telegramChatId),
      mustChangePassword: Boolean(m.mustChangePassword),
      createdAt: m.createdAt,
    })),
    audit: db.audit.slice(0, 120),
    me: s.member.username,
  })
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    username: z.string().min(2).max(32).regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, dots, dashes'),
    displayName: z.string().min(1).max(60),
    password: z.string().min(6, 'Password must be at least 6 characters').max(100),
    role: z.enum(['super_admin', 'agent']),
    team: z.enum(TEAMS),
  }),
  z.object({
    action: z.literal('resetPassword'),
    username: z.string().min(1),
    password: z.string().min(6).max(100).optional(),
  }),
  z.object({
    action: z.literal('setRole'),
    username: z.string().min(1),
    role: z.enum(['super_admin', 'agent']),
  }),
  z.object({
    action: z.literal('setTeam'),
    username: z.string().min(1),
    team: z.enum(TEAMS),
  }),
  z.object({
    action: z.literal('setSuspended'),
    username: z.string().min(1),
    suspended: z.boolean(),
  }),
  z.object({
    action: z.literal('rename'),
    username: z.string().min(1),
    displayName: z.string().min(1).max(60),
  }),
  z.object({ action: z.literal('delete'), username: z.string().min(1) }),
])

function randomPassword(): string {
  return `Zd!${crypto.randomBytes(6).toString('hex')}`
}

function superAdminCount(db: ReturnType<typeof getDb>): number {
  return db.staff.filter((m) => m.role === 'super_admin' && !m.suspended).length
}

/** Super admin: manage staff accounts. */
export async function POST(req: Request) {
  const s = superAdminSession(req)
  if (!s) return NextResponse.json({ error: 'Super admin access required' }, { status: 403 })
  if (setupPending(s.member)) return NextResponse.json({ error: 'Initial setup required — change your password first.', code: 'setup_required' }, { status: 403 })
  const parsed = actionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 })
  }
  const data = parsed.data
  const db = getDb()
  const target = db.staff.find((m) => m.username.toLowerCase() === data.username?.toLowerCase())

  switch (data.action) {
    case 'create': {
      if (target) return NextResponse.json({ error: 'A staff member with this username already exists' }, { status: 400 })
      let created!: { username: string; displayName: string; role: StaffRole; team: Team }
      mutate((d) => {
        const member = {
          username: data.username,
          displayName: data.displayName.trim() || data.username,
          passwordHash: hashPassword(data.password),
          role: data.role,
          team: data.team,
          suspended: false,
          mustChangePassword: true,
          telegramChatId: null,
          createdAt: new Date().toISOString(),
        }
        d.staff.push(member)
        audit(d, s.member.username, 'staff.created', `${member.username} (${member.role}, ${member.team})`)
        created = { username: member.username, displayName: member.displayName, role: member.role, team: member.team }
        return `staff: created ${member.username} by ${s.member.username}`
      })
      return NextResponse.json({ ok: true, staff: created })
    }
    case 'resetPassword': {
      if (!target) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
      const pw = data.password || randomPassword()
      mutate((d) => {
        const m = d.staff.find((x) => x.username === target.username)!
        m.passwordHash = hashPassword(pw)
        m.mustChangePassword = true
        audit(d, s.member.username, 'staff.password_reset', target.username)
        return `staff: password reset for ${target.username} by ${s.member.username}`
      })
      // Return the new password exactly once so the admin can hand it over.
      return NextResponse.json({ ok: true, username: target.username, newPassword: pw, mustChangePassword: true })
    }
    case 'setRole': {
      if (!target) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
      if (target.username === s.member.username) return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
      if (target.role === 'super_admin' && data.role !== 'super_admin' && superAdminCount(db) <= 1) {
        return NextResponse.json({ error: 'Cannot demote the last super admin' }, { status: 400 })
      }
      mutate((d) => {
        const m = d.staff.find((x) => x.username === target.username)!
        m.role = data.role
        audit(d, s.member.username, 'staff.role_changed', `${target.username} → ${data.role}`)
        return `staff: role ${target.username} → ${data.role} by ${s.member.username}`
      })
      return NextResponse.json({ ok: true })
    }
    case 'setTeam': {
      if (!target) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
      mutate((d) => {
        const m = d.staff.find((x) => x.username === target.username)!
        m.team = data.team
        audit(d, s.member.username, 'staff.team_changed', `${target.username} → ${data.team}`)
        return `staff: team ${target.username} → ${data.team} by ${s.member.username}`
      })
      return NextResponse.json({ ok: true })
    }
    case 'rename': {
      if (!target) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
      mutate((d) => {
        const m = d.staff.find((x) => x.username === target.username)!
        m.displayName = data.displayName.trim()
        audit(d, s.member.username, 'staff.renamed', `${target.username} → "${m.displayName}"`)
        return `staff: renamed ${target.username} by ${s.member.username}`
      })
      return NextResponse.json({ ok: true })
    }
    case 'setSuspended': {
      if (!target) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
      if (target.username === s.member.username) return NextResponse.json({ error: 'You cannot suspend yourself' }, { status: 400 })
      if (target.role === 'super_admin' && data.suspended && superAdminCount(db) <= 1) {
        return NextResponse.json({ error: 'Cannot suspend the last super admin' }, { status: 400 })
      }
      mutate((d) => {
        const m = d.staff.find((x) => x.username === target.username)!
        m.suspended = data.suspended
        audit(d, s.member.username, data.suspended ? 'staff.suspended' : 'staff.unsuspended', target.username)
        return `staff: ${data.suspended ? 'suspended' : 'unsuspended'} ${target.username} by ${s.member.username}`
      })
      return NextResponse.json({ ok: true })
    }
    case 'delete': {
      if (!target) return NextResponse.json({ error: 'Staff member not found' }, { status: 404 })
      if (target.username === s.member.username) return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
      if (target.role === 'super_admin' && superAdminCount(db) <= 1) {
        return NextResponse.json({ error: 'Cannot delete the last super admin' }, { status: 400 })
      }
      mutate((d) => {
        d.staff = d.staff.filter((m) => m.username !== target.username)
        audit(d, s.member.username, 'staff.deleted', target.username)
        return `staff: deleted ${target.username} by ${s.member.username}`
      })
      return NextResponse.json({ ok: true })
    }
  }
}
