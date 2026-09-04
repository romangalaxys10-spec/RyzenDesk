/**
 * Stateless session auth (HMAC-signed tokens) + credential helpers.
 * Sessions: base64url(payload).hmac  — payload { role, id, name, exp }
 */

import crypto from 'crypto'
import type { HelpdeskUser, StaffMember, StaffRole } from './types'
import { getDb, hashPassword } from './db'

const SECRET = process.env.SESSION_SECRET || 'ryzendesk-dev-secret'
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

export interface SessionPayload {
  role: 'user' | 'staff'
  id: string
  name: string
  /** For staff sessions: super_admin | agent */
  staffRole?: StaffRole
  exp: number
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', SECRET).update(data).digest('base64url')
}

export function createSession(payload: Omit<SessionPayload, 'exp'>): string {
  const full: SessionPayload = { ...payload, exp: Date.now() + SESSION_TTL_MS }
  const body = b64url(JSON.stringify(full))
  return `${body}.${hmac(body)}`
}

export function verifySession(token: string | null | undefined): SessionPayload | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const expected = hmac(parts[0])
  const given = parts[1]
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf-8')) as SessionPayload
    if (!payload.exp || payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || ''
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return null
}

export function authFromRequest(req: Request): SessionPayload | null {
  return verifySession(bearerToken(req))
}

/** Validate a user login: z.ai user ID + secret token. */
export function authenticateUser(zaiId: string, token: string): HelpdeskUser | null {
  const db = getDb()
  const user = db.users.find((u) => u.zaiId.toLowerCase() === zaiId.trim().toLowerCase())
  if (!user) return null
  const a = Buffer.from(user.token)
  const b = Buffer.from(token.trim())
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return user
}

/** Validate a staff login: username + password. Suspended members cannot sign in. */
export function authenticateStaff(username: string, password: string): StaffMember | null {
  const db = getDb()
  const member = db.staff.find((s) => s.username.toLowerCase() === username.trim().toLowerCase())
  if (!member || member.suspended) return null
  const a = Buffer.from(member.passwordHash)
  const b = Buffer.from(hashPassword(password))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  return member
}

/**
 * Resolve a staff session to a live member record, enforcing suspension.
 * Returns null when the session is invalid, the member no longer exists, or is suspended.
 */
export function staffSession(req: Request): { payload: SessionPayload; member: StaffMember } | null {
  const auth = authFromRequest(req)
  if (!auth || auth.role !== 'staff') return null
  const member = getStaffByName(auth.id)
  if (!member || member.suspended) return null
  // Trust live DB record for the role (sessions survive role changes).
  return { payload: { ...auth, staffRole: member.role }, member }
}

/** Resolve a super-admin session, enforcing suspension. */
export function superAdminSession(req: Request): { payload: SessionPayload; member: StaffMember } | null {
  const s = staffSession(req)
  if (!s || s.member.role !== 'super_admin') return null
  return s
}

/**
 * True when the member still has to complete the initial password setup.
 * Used by mutation routes to lock the account down until the password is changed.
 */
export function setupPending(member: StaffMember): boolean {
  return Boolean(member.mustChangePassword)
}

export function getStaffByName(username: string): StaffMember | null {
  const db = getDb()
  return db.staff.find((s) => s.username.toLowerCase() === username.trim().toLowerCase()) || null
}

export function getUserById(zaiId: string): HelpdeskUser | null {
  const db = getDb()
  return db.users.find((u) => u.zaiId.toLowerCase() === zaiId.trim().toLowerCase()) || null
}

export function getUserByToken(token: string): HelpdeskUser | null {
  const db = getDb()
  return db.users.find((u) => u.token === token.trim()) || null
}
