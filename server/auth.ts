import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import type { Request, Response, NextFunction } from 'express'
import { getDb, saveDb } from './db'
import type { StaffMember, StaffRole, RolePermissions } from '../src/types'

/* ==========================================================================
   RyzenDesk Security Core
   - scrypt password hashing (salted, timing-safe verification)
   - HMAC-signed opaque session tokens (HttpOnly cookies)
   - Server-side RBAC permission enforcement
   - CSRF origin validation + rate limiting
   ========================================================================== */

const DATA_DIR = path.join(process.cwd(), 'data')
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json')
const SESSION_COOKIE = 'ryzendesk_session'
const SESSION_TTL_MS = 24 * 3600_000 // 24 hours (sliding)

/* --------------------------------------------------------------------------
   Password hashing — Node built-in scrypt (no external dependencies)
   Format: scrypt$<salt-hex>$<hash-hex>
   -------------------------------------------------------------------------- */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored || typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, expectedHex] = parts
  try {
    const candidate = crypto.scryptSync(password, salt, 64)
    const expected = Buffer.from(expectedHex, 'hex')
    if (candidate.length !== expected.length) return false
    return crypto.timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

export function isStrongPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8 && password.length <= 256
}

/* --------------------------------------------------------------------------
   Cryptographically secure token helpers (replace Math.random everywhere)
   -------------------------------------------------------------------------- */

export function secureToken(prefix: string, bytes = 24): string {
  return `${prefix}_${crypto.randomBytes(bytes).toString('base64url')}`
}

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

/* --------------------------------------------------------------------------
   Session store — opaque high-entropy ids, persisted locally (never synced)
   Cookie value = <sessionId>.<HMAC-SHA256(sessionId, secret)> (signed cookie)
   -------------------------------------------------------------------------- */

interface Session {
  id: string
  kind: 'staff' | 'client'
  username?: string
  role?: StaffRole
  zaiId?: string
  email?: string
  fullName?: string
  createdAt: number
  expiresAt: number
}

function sessionSecret(): string {
  return process.env.SESSION_SECRET || 'dev-fallback'
}

function loadSessions(): Map<string, Session> {
  try {
    if (fs.existsSync(SESSIONS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf-8')) as Session[]
      const now = Date.now()
      const map = new Map<string, Session>()
      for (const s of raw) {
        if (s.expiresAt > now) map.set(s.id, s)
      }
      return map
    }
  } catch {
    /* corrupted file -> start fresh */
  }
  return new Map()
}

const sessions = loadSessions()

let persistTimer: ReturnType<typeof setTimeout> | null = null
function persistSessions(): void {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
      fs.writeFileSync(SESSIONS_PATH, JSON.stringify(Array.from(sessions.values()), null, 2), 'utf-8')
    } catch (e) {
      console.warn('Session persistence warning:', e)
    }
  }, 250)
}

function signSessionId(id: string): string {
  return crypto.createHmac('sha256', sessionSecret()).update(id).digest('base64url')
}

export function createSession(
  kind: 'staff' | 'client',
  profile: { username?: string; role?: StaffRole; zaiId?: string; email?: string; fullName?: string }
): Session {
  const now = Date.now()
  const session: Session = {
    id: crypto.randomBytes(32).toString('base64url'),
    kind,
    ...profile,
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  }
  sessions.set(session.id, session)
  persistSessions()
  return session
}

export function destroySession(id: string): void {
  sessions.delete(id)
  persistSessions()
}

export function getSessionFromRequest(req: Request): Session | null {
  const raw = req.cookies?.[SESSION_COOKIE] as string | undefined
  if (!raw || typeof raw !== 'string') return null
  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null
  const id = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expectedSig = signSessionId(id)
  const a = Buffer.from(sig)
  const b = Buffer.from(expectedSig)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  const session = sessions.get(id)
  if (!session) return null
  if (session.expiresAt < Date.now()) {
    sessions.delete(id)
    persistSessions()
    return null
  }
  // Sliding expiration
  session.expiresAt = Date.now() + SESSION_TTL_MS
  return session
}

export function setSessionCookie(res: Response, session: Session): void {
  const value = `${session.id}.${signSessionId(session.id)}`
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${
      process.env.NODE_ENV === 'production' && process.env.FORCE_INSECURE_COOKIE !== '1' ? '' : ''
    }`
  )
}

export function clearSessionCookie(res: Response): void {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

/* --------------------------------------------------------------------------
   RBAC permission resolution (server-side, driven by db.settings.rbac)
   -------------------------------------------------------------------------- */

export interface AuthUser {
  kind: 'staff' | 'client'
  username: string
  displayName: string
  role: StaffRole
  email: string
  zaiId?: string
  mustChangePassword?: boolean
  permissions: RolePermissions
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser
    session?: Session
  }
}

export function resolveUser(req: Request): AuthUser | null {
  const session = getSessionFromRequest(req)
  if (!session) return null
  const db = getDb()

  if (session.kind === 'staff') {
    const staff = db.staff.find((s) => s.username === session.username)
    if (!staff || staff.suspended) return null
    const matrix = db.settings.rbac
    const permissions = matrix[staff.role]
    if (!permissions) return null
    return {
      kind: 'staff',
      username: staff.username,
      displayName: staff.displayName,
      role: staff.role,
      email: staff.email,
      mustChangePassword: Boolean(staff.mustChangePassword),
      permissions,
    }
  }

  // Client session
  const matrix = db.settings.rbac
  const clientPermissions = matrix.client
  return {
    kind: 'client',
    username: session.zaiId || session.email || 'client',
    displayName: session.fullName || session.email || 'Customer',
    role: 'client',
    email: session.email || '',
    zaiId: session.zaiId,
    permissions: clientPermissions,
  }
}

/* --------------------------------------------------------------------------
   Middleware
   -------------------------------------------------------------------------- */

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  req.user = resolveUser(req)
  next()
}

/** Reject unauthenticated requests. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    return
  }
  if (req.user.kind === 'staff' && req.user.mustChangePassword) {
    res.status(403).json({
      error: 'Password change required before accessing this resource',
      code: 'PASSWORD_CHANGE_REQUIRED',
    })
    return
  }
  next()
}

/** Reject non-staff (clients) — convenience wrapper. */
export function requireStaff(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
    return
  }
  if (req.user.kind !== 'staff') {
    res.status(403).json({ error: 'Staff access required', code: 'STAFF_ONLY' })
    return
  }
  if (req.user.mustChangePassword) {
    res.status(403).json({
      error: 'Password change required before accessing this resource',
      code: 'PASSWORD_CHANGE_REQUIRED',
    })
    return
  }
  next()
}

/** Enforce a granular RBAC permission from the live matrix (db.settings.rbac). */
export function requirePermission(perm: keyof RolePermissions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user
    if (!user) {
      res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' })
      return
    }
    if (user.mustChangePassword) {
      res.status(403).json({
        error: 'Password change required before accessing this resource',
        code: 'PASSWORD_CHANGE_REQUIRED',
      })
      return
    }
    if (!user.permissions || user.permissions[perm] !== true) {
      res.status(403).json({
        error: `Missing required permission: ${perm}`,
        code: 'FORBIDDEN',
        permission: perm,
      })
      return
    }
    next()
  }
}

/** Allow only super admins (installation lock, destructive system ops). */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.kind !== 'staff' || req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'Super Admin access required', code: 'SUPER_ADMIN_ONLY' })
    return
  }
  next()
}

/** Install-wizard guard: public during first-run bootstrap, admin-only afterwards. */
export function installGuard(req: Request, res: Response, next: NextFunction): void {
  const db = getDb()
  const installed = Boolean(db.settings.installation?.installed)
  if (!installed) return next() // bootstrap window
  // After installation, system configuration requires a super admin session
  if (!req.user || req.user.kind !== 'staff' || req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'System is installed. Super Admin access required.', code: 'SUPER_ADMIN_ONLY' })
    return
  }
  next()
}

/* --------------------------------------------------------------------------
   CSRF: validate Origin/Referer on state-changing requests when present.
   Combined with SameSite=Lax cookies this blocks cross-site write attacks.
   -------------------------------------------------------------------------- */

export function csrfGuard(req: Request, res: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next()

  const origin = req.headers.origin
  if (origin) {
    let host = req.headers['x-forwarded-host'] || req.headers.host
    if (typeof host !== 'string') host = ''
    try {
      const originHost = new URL(origin).host
      if (host && originHost !== host) {
        res.status(403).json({ error: 'Cross-origin request blocked', code: 'CSRF_BLOCKED' })
        return
      }
    } catch {
      res.status(403).json({ error: 'Invalid Origin header', code: 'CSRF_BLOCKED' })
      return
    }
  }
  next()
}

/* --------------------------------------------------------------------------
   Rate limiting — lightweight sliding window (per IP + bucket)
   -------------------------------------------------------------------------- */

interface RateBucket {
  hits: number[]
}
const rateBuckets = new Map<string, RateBucket>()

export function rateLimit(options: { windowMs: number; max: number; key?: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Exempt loopback/localhost in local development so previewing is never blocked
    const ip = req.ip || ''
    const isLoopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip === ''
    if (process.env.NODE_ENV !== 'production' && isLoopback && options.key !== 'login') {
      return next()
    }

    const bucketKey = `${options.key || 'global'}:${req.ip || 'unknown'}`
    const now = Date.now()
    let bucket = rateBuckets.get(bucketKey)
    if (!bucket) {
      bucket = { hits: [] }
      rateBuckets.set(bucketKey, bucket)
    }
    bucket.hits = bucket.hits.filter((t) => now - t < options.windowMs)
    if (bucket.hits.length >= options.max) {
      res.status(429).json({ error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' })
      return
    }
    bucket.hits.push(now)
    // Opportunistic global cleanup
    if (rateBuckets.size > 5000) {
      for (const [k, v] of rateBuckets) {
        if (v.hits.length === 0 || now - v.hits[v.hits.length - 1] > options.windowMs) rateBuckets.delete(k)
      }
    }
    next()
  }
}

/* --------------------------------------------------------------------------
   Cookie parser (minimal, dependency-free)
   -------------------------------------------------------------------------- */

export function cookieParser(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.cookie
  if (header) {
    const cookies: Record<string, string> = {}
    for (const pair of header.split(';')) {
      const idx = pair.indexOf('=')
      if (idx > 0) {
        const key = pair.slice(0, idx).trim()
        const val = pair.slice(idx + 1).trim()
        if (key) {
          try {
            cookies[key] = decodeURIComponent(val)
          } catch {
            cookies[key] = val
          }
        }
      }
    }
    ;(req as Request & { cookies: Record<string, string> }).cookies = cookies
  }
  next()
}

/* --------------------------------------------------------------------------
   Bootstrap: guarantee the documented default admin exists with a real hash.
   Runs on server start — implements the README "Initial Admin Setup" model.
   -------------------------------------------------------------------------- */

export function ensureBootstrapAdmin(): void {
  const db = getDb()
  const anyHashed = db.staff.some((s) => Boolean(s.passwordHash))
  const admin = db.staff.find((s) => s.username === (process.env.SUPERADMIN_USERNAME || 'admin').toLowerCase().trim())

  if (admin && !admin.passwordHash) {
    admin.passwordHash = hashPassword(process.env.SUPERADMIN_PASSWORD || 'RyzenAdmin@2026')
    admin.mustChangePassword = true
    saveDb(db)
    console.log('[auth] Bootstrap super admin password hash provisioned (password change enforced on first login).')
  } else if (!anyHashed && db.staff.length > 0) {
    // Hardening: staff accounts without passwords cannot sign in — leave them
    // passwordless (login rejects) except the documented bootstrap admin above.
    console.log('[auth] Staff accounts exist without password hashes; only hashed accounts can authenticate.')
  }
}
