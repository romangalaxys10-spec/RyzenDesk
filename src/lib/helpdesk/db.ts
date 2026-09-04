/**
 * File-based JSON database for the helpdesk.
 * Single source of truth locally: <project>/data/helpdesk-db.json
 * Every mutation is persisted locally (atomic write) and scheduled for GitHub sync.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type { HelpdeskDB, StaffMember } from './types'
import { TYPE_TEAM } from './types'
import { pullRemote, schedulePush, pushNow, registerSnapshotProvider } from './github'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'helpdesk-db.json')
const BOT_STATE_PATH = path.join(DATA_DIR, 'bot-state.json')

/** Default credentials of the pre-created super admin used for first-time setup. */
const DEFAULT_ADMIN_USERNAME = process.env.SUPERADMIN_USERNAME || 'admin'
const DEFAULT_ADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'RyzenAdmin@2026'

const g = globalThis as unknown as { __hdDb?: HelpdeskDB }
const gg = globalThis as unknown as { __hdCommitMsg?: string }

function defaultDb(): HelpdeskDB {
  return {
    meta: { version: 2, updatedAt: new Date().toISOString(), ticketCounter: 0 },
    settings: { liveChatEnabled: true },
    users: [],
    tickets: [],
    staff: [],
    chats: [],
    audit: [],
  }
}

export function hashPassword(password: string): string {
  const secret = process.env.SESSION_SECRET || 'ryzendesk'
  return crypto.createHash('sha256').update(`${secret}:${password}`).digest('hex')
}

/**
 * Seed staff accounts from the STAFF_PASSWORDS env map (username -> password),
 * only adding what's missing. Members listed in SUPERADMIN_USERNAMES (comma
 * separated) become super_admin; when the variable is absent the first listed
 * username becomes the super admin.
 */
export function ensureStaff(db: HelpdeskDB) {
  let envPasswords: Record<string, string> = {}
  try {
    envPasswords = JSON.parse(process.env.STAFF_PASSWORDS || '{}')
  } catch {
    envPasswords = {}
  }
  const usernames = Object.keys(envPasswords)
  if (!usernames.length) return

  const superList = (process.env.SUPERADMIN_USERNAMES || usernames[0])
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

  for (const username of usernames) {
    const existing = db.staff.find((s) => s.username.toLowerCase() === username.toLowerCase())
    if (existing) continue
    const member: StaffMember = {
      username,
      displayName: username,
      passwordHash: hashPassword(envPasswords[username]),
      role: superList.includes(username.toLowerCase()) ? 'super_admin' : 'agent',
      team: 'Support',
      suspended: false,
      telegramChatId: null,
      createdAt: new Date().toISOString(),
    }
    db.staff.push(member)
  }
}

/**
 * Pre-create the bootstrap super admin for first-time setup.
 * Seeds when the roster is empty or no active super admin exists (self-healing
 * lockout recovery). The account is flagged mustChangePassword so the first
 * login walks through the initial-setup password screen.
 */
export function ensureBootstrapAdmin(db: HelpdeskDB) {
  const hasActiveSuperAdmin = db.staff.some((s) => s.role === 'super_admin' && !s.suspended)
  if (db.staff.length > 0 && hasActiveSuperAdmin) return
  const existing = db.staff.find((s) => s.username.toLowerCase() === DEFAULT_ADMIN_USERNAME.toLowerCase())
  if (existing) {
    if (existing.mustChangePassword !== true) {
      existing.mustChangePassword = true
    }
    return
  }
  db.staff.push({
    username: DEFAULT_ADMIN_USERNAME,
    displayName: 'Administrator',
    passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
    role: 'super_admin',
    team: 'Support',
    suspended: false,
    mustChangePassword: true,
    telegramChatId: null,
    createdAt: new Date().toISOString(),
  })
}

/**
 * Migrate older DB shapes to the current schema (idempotent).
 * Returns true when anything changed.
 */
export function migrateDb(db: HelpdeskDB): boolean {
  let changed = false
  const touch = () => { changed = true }

  if (!db.settings) { db.settings = { liveChatEnabled: true }; touch() }
  if (typeof db.settings.liveChatEnabled !== 'boolean') { db.settings.liveChatEnabled = true; touch() }
  if (!Array.isArray(db.chats)) { db.chats = []; touch() }
  if (!db.meta) { db.meta = { version: 2, updatedAt: new Date().toISOString(), ticketCounter: 0 }; touch() }
  if (!Array.isArray(db.users)) { db.users = []; touch() }
  if (!Array.isArray(db.tickets)) { db.tickets = []; touch() }
  if (!Array.isArray(db.staff)) { db.staff = []; touch() }
  if (!Array.isArray(db.audit)) { db.audit = []; touch() }

  // Staff fields: role / team / suspended (one-time defaults; do not override admin choices)
  for (const s of db.staff) {
    if (!s.role) {
      s.role = ['Roman', 'Agnes'].includes(s.username) ? 'super_admin' : 'agent'
      touch()
    }
    if (!s.team) { s.team = 'Support'; touch() }
    if (typeof s.suspended !== 'boolean') { s.suspended = false; touch() }
  }

  // Ticket fields: team / assignee / escalation bookkeeping
  for (const t of db.tickets) {
    if (!t.team) { t.team = TYPE_TEAM[t.type] || 'Support'; touch() }
    if (typeof t.assignee === 'undefined') { t.assignee = null; touch() }
    if (typeof t.escalationLevel === 'undefined') { t.escalationLevel = 0; touch() }
    if (!Array.isArray(t.escalations)) { t.escalations = []; touch() }
  }

  if (db.meta.version !== 2) { db.meta.version = 2; touch() }
  return changed
}

function loadLocal(): HelpdeskDB {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8')
      const db = JSON.parse(raw) as HelpdeskDB
      if (db && db.meta && Array.isArray(db.tickets)) {
        migrateDb(db)
        return db
      }
    }
  } catch {
    // corrupted local file -> start fresh; remote pull may rescue us
  }
  return defaultDb()
}

function saveLocal(db: HelpdeskDB) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = DB_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf-8')
  fs.renameSync(tmp, DB_PATH)
}

/** In-memory accessor. Local file is authoritative until remote bootstrap replaces it. */
export function getDb(): HelpdeskDB {
  if (!g.__hdDb) {
    g.__hdDb = loadLocal()
    ensureStaff(g.__hdDb)
    ensureBootstrapAdmin(g.__hdDb)
    saveLocal(g.__hdDb)
  }
  return g.__hdDb
}

export function audit(db: HelpdeskDB, actor: string, action: string, detail: string) {
  db.audit.unshift({ at: new Date().toISOString(), actor, action, detail })
  if (db.audit.length > 500) db.audit.length = 500
}

/** Generate the next ticket id: <PREFIX>-YYYY-#### (prefix configurable via TICKET_PREFIX, default RD). */
export function nextTicketId(db: HelpdeskDB): string {
  db.meta.ticketCounter += 1
  const year = new Date().getFullYear()
  const prefix = (process.env.TICKET_PREFIX || 'RD').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'RD'
  return `${prefix}-${year}-${String(db.meta.ticketCounter).padStart(4, '0')}`
}

export function randomToken(): string {
  return `zt_${crypto.randomBytes(18).toString('hex')}`
}

export function randomChatId(): string {
  return `cht_${crypto.randomBytes(6).toString('hex')}`
}

export function msgId(): string {
  return crypto.randomUUID()
}

/**
 * Mutate the DB safely: run fn, stamp updatedAt, persist locally, schedule GitHub push.
 * fn may return a commit message; otherwise a generic one is used.
 */
export function mutate(fn: (db: HelpdeskDB) => string | void): void {
  const db = getDb()
  const message = fn(db) || 'chore: update helpdesk database'
  gg.__hdCommitMsg = message
  db.meta.updatedAt = new Date().toISOString()
  saveLocal(db)
  schedulePush()
}

/**
 * Bootstrap: pull remote DB from GitHub. Remote wins when it is newer than local
 * (or when local is missing/corrupted). Ensures staff, then pushes an initial sync.
 */
export async function bootstrapFromRemote(): Promise<void> {
  try {
    const remote = await pullRemote()
    if (remote) {
      const remoteDb = remote.json as HelpdeskDB
      const local = loadLocal()
      const remoteTime = remoteDb?.meta?.updatedAt || ''
      const localTime = local?.meta?.updatedAt || ''
      if (!fs.existsSync(DB_PATH) || remoteTime >= localTime) {
        ensureStaff(remoteDb)
        ensureBootstrapAdmin(remoteDb)
        migrateDb(remoteDb)
        g.__hdDb = remoteDb
        saveLocal(remoteDb)
      }
    }
    ensureStaff(getDb())
    ensureBootstrapAdmin(getDb())
    if (migrateDb(getDb())) saveLocal(getDb())
    registerSnapshotProvider(() => ({
      json: JSON.stringify(getDb(), null, 2),
      message: gg.__hdCommitMsg || 'chore: update helpdesk database',
    }))
    // Always push once at boot so the repo reflects the freshest state.
    await pushNow()
  } catch (err) {
    console.error('[helpdesk] bootstrap sync error:', err instanceof Error ? err.message : err)
  }
}

/** Persist Telegram bot poll offset locally (not synced to GitHub). */
export function readBotState(): { offset?: number } {
  try {
    if (fs.existsSync(BOT_STATE_PATH)) return JSON.parse(fs.readFileSync(BOT_STATE_PATH, 'utf-8'))
  } catch {
    // ignore
  }
  return {}
}

export function writeBotState(state: { offset?: number }) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(BOT_STATE_PATH, JSON.stringify(state), 'utf-8')
  } catch {
    // ignore
  }
}
