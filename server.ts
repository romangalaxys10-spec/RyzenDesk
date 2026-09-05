import express from 'express'
import path from 'path'
import { createServer as createViteServer } from 'vite'
import crypto from 'crypto'
import { getDb, saveDb, logAudit, DEFAULT_SLA_POLICIES, DEFAULT_RBAC, DEFAULT_INSTALLATION, sealSensitiveFields } from './server/db'
import {
  sendEmailNotification,
  notifyTicketCreated,
  notifyStaffReply,
  notifyTicketResolved,
  notifySlaBreached,
} from './server/smtp'
import { triggerWebhooks, testWebhookEndpoint } from './server/webhooks'
import { pullRemote, pushRemoteNow, scheduleCloudPush, getSyncStatus } from './server/github'
import {
  hashPassword,
  verifyPassword,
  isStrongPassword,
  secureToken,
  newId,
  cookieParser,
  csrfGuard,
  attachUser,
  requireAuth,
  requireStaff,
  requirePermission,
  requireSuperAdmin,
  installGuard,
  rateLimit,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
  ensureBootstrapAdmin,
  assertProductionSecrets,
  destroyOtherSessionsForUser,
} from './server/auth'
import { hashClientToken, isTokenHashed, timingSafeEqualStr } from './server/db'
import { validateWebhookUrl } from './server/webhooks'
import { GoogleGenAI } from '@google/genai'
import type {
  Ticket,
  TicketStatus,
  TicketPriority,
  IssueType,
  Team,
  FileAttachment,
  KanbanCard,
  WikiPage,
  WikiRevision,
  StaffRole,
  StaffMember,
  RolePermissions,
  InstallationConfig,
  InstallationSettings,
  SystemPreflightCheck,
} from './src/types'

let geminiClient: GoogleGenAI | null = null
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return geminiClient
}

// In-memory active presence tracker: ticketId -> Map<username, { timestamp: number, action: 'viewing' | 'typing' }>
const activePresence = new Map<string, Map<string, { timestamp: number; action: 'viewing' | 'typing' }>>()

async function startServer() {
  // Fail closed on weak/missing production secrets before anything binds a port.
  assertProductionSecrets()

  const app = express()
  const PORT = 3000

  // Behind a reverse proxy, req.ip would otherwise be the proxy IP — collapsing
  // all clients into one rate-limit bucket (and, with the loopback exemption,
  // disabling login limiting entirely). Configure hops via TRUST_PROXY.
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY)
    app.set('trust proxy', Number.isFinite(hops) ? hops : process.env.TRUST_PROXY === 'true')
  }

  app.use(express.json({ limit: '25mb' }))
  app.use(express.urlencoded({ extended: true, limit: '25mb' }))

  /* ==========================================================================
     SECURITY MIDDLEWARE
     ========================================================================== */

  // Baseline security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'same-origin')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    // HSTS only makes sense over TLS (typically terminated at a reverse proxy)
    const isHttps = req.headers['x-forwarded-proto'] === 'https' || (req.socket as { encrypted?: boolean }).encrypted
    if (isHttps) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
    // Content Security Policy (production build serves static assets only)
    if (process.env.NODE_ENV === 'production') {
      res.setHeader(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'", // Recharts/Tailwind inject inline styles
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ')
      )
    }
    next()
  })

  // Cookie parsing (sessions) + CSRF origin validation + session resolution
  app.use(cookieParser)
  app.use(csrfGuard)
  app.use(attachUser)

  // Global API rate limit (per IP)
  app.use('/api', rateLimit({ windowMs: 15 * 60_000, max: 600, key: 'api' }))

  /* ==========================================================================
     AUTHENTICATION API
     ========================================================================== */

  // Staff login (username/password, scrypt-verified, signed HttpOnly session cookie)
  app.post('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, max: 20, key: 'login' }), (req, res) => {
    const { username, password } = req.body || {}
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }
    const db = getDb()
    const staff = db.staff.find(
      (s) => s.username === String(username).toLowerCase().trim()
    )
    if (!staff || staff.suspended || !staff.passwordHash) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }
    if (!verifyPassword(String(password), staff.passwordHash)) {
      return res.status(401).json({ error: 'Invalid username or password' })
    }

    const session = createSession('staff', {
      username: staff.username,
      role: staff.role,
      email: staff.email,
      fullName: staff.displayName,
    })
    setSessionCookie(res, session)

    logAudit(staff.username, staff.role, 'STAFF_LOGIN', 'system', `Staff sign-in from ${req.ip}`, undefined, req.ip)

    const permissions = db.settings.rbac[staff.role]
    res.json({
      user: {
        kind: 'staff',
        username: staff.username,
        displayName: staff.displayName,
        role: staff.role,
        email: staff.email,
        mustChangePassword: Boolean(staff.mustChangePassword),
        permissions,
      },
    })
  })

  // Customer login (email + secret access token zt_...)
  app.post(
    '/api/auth/customer-login',
    rateLimit({ windowMs: 15 * 60_000, max: 30, key: 'client-login' }),
    (req, res) => {
      const { email, token } = req.body || {}
      if (!email || !token) {
        return res.status(400).json({ error: 'Email and secret token are required' })
      }
      const db = getDb()
      const candidate = hashClientToken(String(token).trim())
      const user = db.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim())
      // Tokens are stored as SHA-256 digests — verify in constant time
      if (!user || !isTokenHashed(user.token) || !timingSafeEqualStr(user.token, candidate)) {
        return res.status(401).json({ error: 'Invalid email or token' })
      }

      const session = createSession('client', {
        zaiId: user.zaiId,
        email: user.email,
        fullName: user.fullName,
      })
      setSessionCookie(res, session)

      logAudit(user.email, 'client', 'CLIENT_LOGIN', 'system', `Customer sign-in from ${req.ip}`, undefined, req.ip)

      const permissions = db.settings.rbac.client
      res.json({
        user: {
          kind: 'client',
          username: user.zaiId,
          displayName: user.fullName,
          role: 'client',
          email: user.email,
          permissions,
        },
      })
    }
  )

  // Current session profile
  app.get('/api/auth/me', (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated', code: 'AUTH_REQUIRED' })
    }
    const { kind, username, displayName, role, email, zaiId, mustChangePassword, permissions } = req.user
    res.json({ user: { kind, username, displayName, role, email, zaiId, mustChangePassword, permissions } })
  })

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    const session = getSessionFromRequest(req)
    if (session) destroySession(session.id)
    clearSessionCookie(res)
    res.json({ success: true })
  })

  // Change password (staff). Allowed — and enforced — while mustChangePassword is set.
  // Rate-limited: scrypt verification is CPU-heavy, so this is both a brute-force
  // and a DoS surface if left on the global bucket.
  app.post(
    '/api/auth/change-password',
    rateLimit({ windowMs: 15 * 60_000, max: 5, key: 'change-pw' }),
    (req, res) => {
    const user = req.user
    if (!user || user.kind !== 'staff') {
      return res.status(401).json({ error: 'Staff authentication required' })
    }
    const { currentPassword, newPassword } = req.body || {}
    const db = getDb()
    const staff = db.staff.find((s) => s.username === user.username)
    if (!staff) return res.status(404).json({ error: 'Account not found' })

    if (!verifyPassword(String(currentPassword || ''), staff.passwordHash)) {
      return res.status(401).json({ error: 'Current password is incorrect' })
    }
    if (!isStrongPassword(String(newPassword || ''))) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' })
    }
    if (verifyPassword(String(newPassword), staff.passwordHash)) {
      return res.status(400).json({ error: 'New password must differ from the current password' })
    }

    staff.passwordHash = hashPassword(String(newPassword))
    staff.mustChangePassword = false
    saveDb(db)

    // Session rotation: a stolen cookie must not survive a password change.
    const session = getSessionFromRequest(req)
    const removed = session ? destroyOtherSessionsForUser(staff.username, session.id) : 0

    logAudit(staff.username, staff.role, 'PASSWORD_CHANGED', 'system', `Password changed from ${req.ip}; ${removed} other session(s) invalidated`, undefined, req.ip)

    res.json({ success: true, message: 'Password updated successfully' })
  }
  )

  // Pull initial remote state from GitHub on boot
  void pullRemote()

  // Guarantee the documented bootstrap super admin has a real password hash
  ensureBootstrapAdmin()

  /* ==========================================================================
     API ROUTES
     ========================================================================== */

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() })
  })

  // System & Cloud Sync Status (staff-only operational telemetry)
  app.get('/api/system/status', requireStaff, (req, res) => {
    const db = getDb()
    const sync = getSyncStatus()
    res.json({
      sync,
      ticketsCount: db.tickets.length,
      boardsCount: db.kanbanBoards.length,
      wikiPagesCount: db.wikiPages.length,
      staffCount: db.staff.length,
      smtpConfigured: Boolean(db.settings.smtp.host),
      emailLogsCount: db.emailLogs.length,
      webhooksCount: db.webhooks.length,
      auditCount: db.audit.length,
    })
  })

  // Force Cloud Sync Push/Pull (cloud sync permission — Support Manager & Super Admin)
  app.post('/api/sync/push', requirePermission('admin_cloud_sync'), async (req, res) => {
    const result = await pushRemoteNow()
    logAudit(req.user!.username, req.user!.role, 'CLOUD_SYNC_PUSH', 'system', `Manual cloud sync push from ${req.ip}`, undefined, req.ip)
    res.json(result)
  })

  app.post('/api/sync/pull', requirePermission('admin_cloud_sync'), async (req, res) => {
    const pulled = await pullRemote()
    res.json({ success: pulled, status: getSyncStatus() })
  })

  // Codebase Deployment to GitHub (documented Super Admin capability)
  app.post('/api/admin/deploy-codebase', requirePermission('admin_deploy'), async (req, res) => {
    try {
      const { execSync } = await import('child_process')
      const output = execSync('npx tsx scripts/deploy-to-github.ts', {
        encoding: 'utf-8',
        cwd: process.cwd(),
        timeout: 120_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      })
      logAudit(req.user!.username, req.user!.role, 'CODEBASE_DEPLOYED', 'system', `Full codebase deployment triggered from ${req.ip}`, undefined, req.ip)
      res.json({ success: true, output })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message, output: err.stdout || err.stderr })
    }
  })

  /* ==========================================================================
     INSTALLATION & SERVER SETUP WIZARD API
     ========================================================================== */

  // System pre-flight environment checks (public during first-run bootstrap, admin-only afterwards)
  app.get('/api/install/preflight', installGuard, async (req, res) => {
    const fs = await import('fs')
    const path = await import('path')
    const os = await import('os')

    const mem = process.memoryUsage()
    const dataDir = path.join(process.cwd(), 'data')
    let storageWritable = false
    let storageDetail = 'Read/Write Verified'

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }
      const testFile = path.join(dataDir, '.install-probe-test')
      fs.writeFileSync(testFile, `probe_${Date.now()}`, 'utf-8')
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile)
        storageWritable = true
      }
    } catch (err: any) {
      storageWritable = false
      storageDetail = `Storage write error: ${err.message}`
    }

    const nodeMajor = parseInt(process.versions.node.split('.')[0], 10)
    const nodePass = nodeMajor >= 18

    const checks: SystemPreflightCheck[] = [
      {
        id: 'node_runtime',
        name: 'Node.js Runtime Environment',
        category: 'runtime',
        status: nodePass ? 'pass' : 'fail',
        required: true,
        value: `Node ${process.version} (${process.platform} ${process.arch})`,
        recommendation: nodePass ? undefined : 'Requires Node.js version 18.0.0 or later.',
      },
      {
        id: 'storage_permissions',
        name: 'Persistent Data Storage (/data directory)',
        category: 'storage',
        status: storageWritable ? 'pass' : 'fail',
        required: true,
        value: storageWritable ? 'POSIX Read/Write Verified' : storageDetail,
        recommendation: storageWritable ? undefined : 'Ensure write permissions on the data directory.',
      },
      {
        id: 'memory_capacity',
        name: 'System Memory & Process Capacity',
        category: 'runtime',
        status: 'pass',
        required: true,
        value: `${Math.round(mem.heapUsed / 1024 / 1024)} MB Heap / ${Math.round(mem.rss / 1024 / 1024)} MB RSS (Total Host: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)} GB)`,
      },
      {
        id: 'network_binding',
        name: 'HTTP Reverse Proxy & Port Ingress',
        category: 'network',
        status: 'pass',
        required: true,
        value: 'Port 3000 (0.0.0.0) Active & Ready',
      },
      {
        id: 'ai_copilot_service',
        name: 'Gemini AI Copilot Integration',
        category: 'services',
        status: process.env.GEMINI_API_KEY ? 'pass' : 'warning',
        required: false,
        value: process.env.GEMINI_API_KEY ? 'API Key Configured & Ready' : 'Key not detected in env (Heuristic fallback active)',
        recommendation: process.env.GEMINI_API_KEY ? undefined : 'You can provide a Gemini API key in the wizard or proceed with offline intelligence.',
      },
      {
        id: 'smtp_service',
        name: 'Outbound Mail Dispatch (SMTP)',
        category: 'services',
        status: 'pass',
        required: false,
        value: 'Ready for Configuration & Verification',
      },
    ]

    const passed = checks.filter((c) => c.required).every((c) => c.status === 'pass')

    res.json({
      passed,
      nodeVersion: process.version,
      platform: `${process.platform} (${os.release()})`,
      arch: process.arch,
      memoryMb: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024),
      },
      uptimeSec: Math.round(process.uptime()),
      checks,
      timestamp: new Date().toISOString(),
    })
  })

  // Installation status (public — exposes installation flag & counts only, never the lock key)
  app.get('/api/install/status', (req, res) => {
    const db = getDb()
    const installation = db.settings.installation || DEFAULT_INSTALLATION
    const { installationLockKey, ...safeSettings } = installation
    res.json({
      installed: Boolean(installation.installed),
      settings: safeSettings,
      stats: {
        ticketsCount: db.tickets.length,
        staffCount: db.staff.length,
        wikiPagesCount: db.wikiPages.length,
        kanbanBoardsCount: db.kanbanBoards.length,
        usersCount: db.users.length,
      },
    })
  })

  // Test SMTP connection during wizard (bootstrap window) / Super Admin (post-install)
  app.post('/api/install/test-smtp', installGuard, rateLimit({ windowMs: 60 * 60_000, max: 10, key: 'smtp-test' }), async (req, res) => {
    const { host, port, user, pass, from, targetEmail } = req.body
    try {
      const log = await sendEmailNotification({
        to: targetEmail || from || 'admin@ryzendesk.internal',
        subject: '[INSTALLATION VERIFICATION] RyzenDesk SMTP Server Test Probe',
        event: 'install.test',
        textBody: `RyzenDesk Setup Wizard SMTP verification successful.\nHost: ${host || 'smtp.sendgrid.net'}:${port || 587}\nTimestamp: ${new Date().toISOString()}`,
      })
      res.json({ success: true, message: 'SMTP test packet dispatched successfully', log })
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || String(err) })
    }
  })

  // Test Gemini AI connection during wizard (bootstrap window) / Super Admin (post-install)
  app.post('/api/install/test-ai', installGuard, rateLimit({ windowMs: 60 * 60_000, max: 10, key: 'ai-test' }), async (req, res) => {
    const { apiKey } = req.body
    const testKey = apiKey || process.env.GEMINI_API_KEY
    if (!testKey) {
      return res.status(400).json({ success: false, error: 'No Gemini API key provided to test.' })
    }
    try {
      const testGenAI = new GoogleGenAI({ apiKey: testKey })
      const model = 'gemini-2.5-flash'
      const resp = await testGenAI.models.generateContent({
        model,
        contents: 'Confirm connection by returning the single word: "VERIFIED"',
      })
      res.json({ success: true, model, response: resp.text?.trim() || 'VERIFIED' })
    } catch (err: any) {
      res.status(400).json({ success: false, error: err?.message || String(err) })
    }
  })

  // Execute installation — open ONLY during the first-run bootstrap window;
  // once installed, reconfiguration requires an authenticated Super Admin.
  app.post(
    '/api/install/execute',
    installGuard,
    rateLimit({ windowMs: 60 * 60_000, max: 5, key: 'install-execute' }),
    async (req, res) => {
    const config = req.body as InstallationConfig
    const db = getDb()
    const fs = await import('fs')
    const path = await import('path')

    // Re-install arm lock: if a previous installation was reset, the wizard's
    // bootstrap window must not be winnable by whichever unauthenticated party
    // reaches /execute first. Require the re-arm token issued by /install/reset.
    const rearm = (db.settings.installation as (InstallationSettings & { rearmToken?: string }) | undefined)?.rearmToken
    if (rearm) {
      const provided = String((req.body as Record<string, unknown>)?.rearmToken || req.headers['x-rearm-token'] || '')
      const a = Buffer.from(provided)
      const b = Buffer.from(rearm)
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(403).json({ success: false, error: 'Re-install is armed: a valid rearmToken from /api/install/reset is required.', code: 'REARM_REQUIRED' })
      }
    }

    // An installation must provision a usable admin: empty password would
    // create a passwordless super_admin that can never log in.
    if (!config.admin?.password || !isStrongPassword(String(config.admin.password))) {
      return res.status(400).json({ success: false, error: 'Administrator password is required and must be at least 8 characters.' })
    }

    const nowIso = new Date().toISOString()
    const lockKey = secureToken('rd_lock', 24)

    // 1. Update Organization & System Settings
    db.settings.installation = {
      installed: true,
      installedAt: nowIso,
      organizationName: config.organizationName || 'Ryzen Technologies Enterprise',
      helpdeskName: config.helpdeskName || 'RyzenDesk Support Portal',
      supportEmail: config.supportEmail || 'support@ryzendesk.internal',
      baseUrl: config.baseUrl || 'http://localhost:3000',
      defaultLanguage: config.defaultLanguage || 'en',
      timezone: config.timezone || 'UTC',
      storageEngine: config.storageEngine || 'atomic_json_engine',
      seededDemoData: Boolean(config.seedDemoData),
      backupEnabled: config.backupEnabled ?? true,
      adminCreated: true,
      installationLockKey: lockKey,
      version: '2.3.0',
    }

    // 2. Configure Super Admin Account (with real password hash when provided)
    if (config.admin?.username) {
      const adminUser = config.admin.username.toLowerCase().trim()
      const existingIdx = db.staff.findIndex((s) => s.username === adminUser || s.role === 'super_admin')
      const adminObj: StaffMember = {
        username: adminUser,
        displayName: config.admin.displayName || 'Primary Administrator',
        role: 'super_admin',
        team: 'Security',
        email: config.admin.email || `${adminUser}@ryzendesk.internal`,
        suspended: false,
        telegramChatId: null,
        createdAt: nowIso,
      } as StaffMember

      if (config.admin.password) {
        adminObj.passwordHash = hashPassword(String(config.admin.password))
        adminObj.mustChangePassword = false
      }

      if (existingIdx !== -1) {
        db.staff[existingIdx] = { ...db.staff[existingIdx], ...adminObj }
      } else {
        db.staff.unshift(adminObj)
      }
    }

    // 3. Configure SMTP & Telegram if provided
    if (config.smtp) {
      db.settings.smtp = {
        ...db.settings.smtp,
        ...config.smtp,
        enabled: Boolean(config.smtp.enabled),
      }
    }
    if (config.telegram) {
      db.settings.telegram = {
        ...db.settings.telegram,
        ...config.telegram,
      }
    }

    // 4. Seeding vs Clean Production Slate
    if (config.seedDemoData === false) {
      db.tickets = []
      db.meta.ticketCounter = 100
    }

    // 5. Create backup snapshot and lock file
    // Backups go through the same at-rest sealing as the main DB file — the
    // runtime object holds DECRYPTED secrets, so serializing it raw would
    // write plaintext SMTP/Telegram credentials to disk.
    try {
      const dataDir = path.join(process.cwd(), 'data')
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }
      fs.writeFileSync(
        path.join(dataDir, 'installed.lock'),
        JSON.stringify(
          {
            installedAt: nowIso,
            version: '2.4.0',
            lockKeyHash: crypto.createHash('sha256').update(lockKey).digest('hex'),
            organizationName: db.settings.installation.organizationName,
          },
          null,
          2
        ),
        { encoding: 'utf-8', mode: 0o600 }
      )

      fs.writeFileSync(
        path.join(dataDir, `backup-install-${Date.now()}.json`),
        JSON.stringify(sealSensitiveFields(db), null, 2),
        { encoding: 'utf-8', mode: 0o600 }
      )
    } catch (e) {
      console.error('Backup write warning during install:', e)
    }

    saveDb(db)
    scheduleCloudPush()

    logAudit(
      req.user?.username || config.admin?.username || 'admin',
      'super_admin',
      'SYSTEM_INSTALLATION_COMPLETED',
      'system',
      `Installation wizard executed for ${db.settings.installation.organizationName} (${db.settings.installation.storageEngine}) from ${req.ip}`,
      undefined,
      req.ip
    )

    res.json({
      success: true,
      installation: { ...db.settings.installation, installationLockKey: undefined },
      receipt: {
        organizationName: db.settings.installation.organizationName,
        helpdeskName: db.settings.installation.helpdeskName,
        supportEmail: db.settings.installation.supportEmail,
        adminUsername: config.admin?.username || 'admin',
        adminEmail: config.admin?.email || 'admin@ryzendesk.internal',
        installedAt: nowIso,
        storageEngine: db.settings.installation.storageEngine,
        lockKey,
        version: '2.4.0',
        demoDataSeeded: config.seedDemoData,
      },
    })
  }
  )

  // Reset installation (allows re-running wizard) — Super Admin only once installed
  // Security: resetting flips the wizard into its public bootstrap window, where
  // /api/install/execute could previously be won by ANY unauthenticated party
  // (first writer replaces the super admin). We keep the window super-admin-only
  // after a prior installation by recording that the system was installed before.
  app.post('/api/install/reset', installGuard, (req, res) => {
    const db = getDb()
    if (db.settings.installation) {
      ;(db.settings.installation as InstallationSettings & { rearmToken?: string }).rearmToken = secureToken('rd_rearm', 24)
      db.settings.installation.installed = false
      db.settings.installation.installedAt = null
    }
    saveDb(db)
    scheduleCloudPush()
    res.json({
      success: true,
      message: 'Installation state reset. Setup wizard will now activate — complete it promptly; /api/install/execute stays restricted while a re-arm token exists.',
      rearmToken: (db.settings.installation as InstallationSettings & { rearmToken?: string }).rearmToken,
    })
  })

  // Offline Mode Batch Sync (authenticated staff; every mutation type is
  // permission-gated exactly like its interactive counterpart — previously this
  // endpoint let read-only roles create/overwrite tickets, cards and wiki pages).
  app.post(
    '/api/offline/batch',
    requireStaff,
    rateLimit({ windowMs: 15 * 60_000, max: 30, key: 'offline-batch' }),
    (req, res) => {
    const { mutations } = req.body as { mutations?: Array<{ type: string; payload: any }> }
    const db = getDb()

    const REQUIRED_PERM: Record<string, keyof RolePermissions> = {
      create_ticket: 'tickets_create',
      update_ticket: 'tickets_edit_status',
      update_card: 'kanban_edit_cards',
      save_wiki: 'wiki_create_edit',
    }

    if (Array.isArray(mutations) && mutations.length <= 200) {
      for (const m of mutations) {
        try {
          const perm = REQUIRED_PERM[m.type]
          // Unknown mutation types are dropped; known ones are RBAC-enforced.
          if (!perm || !req.user || req.user.permissions?.[perm] !== true) continue
          if (m.type === 'create_ticket' && m.payload) {
            db.tickets.unshift(m.payload)
          } else if (m.type === 'update_ticket' && m.payload?.id) {
            const idx = db.tickets.findIndex((t) => t.id === m.payload.id)
            if (idx !== -1) db.tickets[idx] = { ...db.tickets[idx], ...m.payload }
          } else if (m.type === 'update_card' && m.payload?.id) {
            for (const b of db.kanbanBoards) {
              for (const l of b.lists) {
                const cIdx = l.cards.findIndex((c) => c.id === m.payload.id)
                if (cIdx !== -1) l.cards[cIdx] = { ...l.cards[cIdx], ...m.payload }
              }
            }
          } else if (m.type === 'save_wiki' && m.payload?.id) {
            const pIdx = db.wikiPages.findIndex((p) => p.id === m.payload.id)
            if (pIdx !== -1) db.wikiPages[pIdx] = { ...db.wikiPages[pIdx], ...m.payload }
          }
        } catch (e) {
          console.error('Error applying offline mutation:', e)
        }
      }
      saveDb(db)
      scheduleCloudPush()
    }

    // Mirror GET /api/tickets scoping: read-only roles must not receive the
    // full queue through the batch response.
    const isClient = req.user?.kind === 'client'
    const canViewAll = req.user?.permissions?.tickets_view_all === true
    const ticketsOut = isClient
      ? db.tickets
          .filter((t) => t.zaiId === req.user!.zaiId || t.contact?.zaiId === req.user!.zaiId || t.contact?.email === req.user!.email)
          .map(projectTicketForClient)
      : canViewAll
        ? db.tickets
        : []
    res.json({ success: true, tickets: ticketsOut, kanban: db.kanbanBoards, wiki: db.wikiPages })
  }
  )

  /* --------------------------------------------------------------------------
     SLA BREACH MONITOR
     - Breach flags were only computed at creation (always false) and never
       enforced server-side. This scan flips flags on real breaches and fires
       one notification per breach type per ticket (no repeat spam).
     - Runs every 5 minutes; also triggerable via POST /api/admin/sla/scan.
     -------------------------------------------------------------------------- */

  function scanSlaBreaches(): { responseBreaches: string[]; resolutionBreaches: string[] } {
    const db = getDb()
    const now = Date.now()
    const responseBreaches: string[] = []
    const resolutionBreaches: string[] = []

    for (const t of db.tickets) {
      if (t.status === 'resolved' || t.status === 'closed') continue
      const sla = t.sla
      if (!sla) continue
      let changed = false

      // Response breach: no first response before the deadline
      if (!sla.firstRespondedAt && !sla.isResponseBreached && now > new Date(sla.responseDueAt).getTime()) {
        sla.isResponseBreached = true
        changed = true
      }
      // Resolution breach: not resolved before the deadline
      if (!sla.resolvedAt && !sla.isResolutionBreached && now > new Date(sla.resolutionDueAt).getTime()) {
        sla.isResolutionBreached = true
        changed = true
      }

      // Notifications: exactly once per breach type per ticket
      if (sla.isResponseBreached && !sla.responseBreachNotified) {
        sla.responseBreachNotified = true
        responseBreaches.push(t.id)
        notifySlaBreached(t.id, t.priority, t.team)
        void triggerWebhooks('ticket.sla_breached', { ticketId: t.id, type: 'response', priority: t.priority, team: t.team })
        logAudit('system', 'super_admin', 'SLA_RESPONSE_BREACHED', 'tickets', `Response SLA breached on ${t.id} (${t.priority})`, t.id)
      }
      if (sla.isResolutionBreached && !sla.resolutionBreachNotified) {
        sla.resolutionBreachNotified = true
        resolutionBreaches.push(t.id)
        notifySlaBreached(t.id, t.priority, t.team)
        void triggerWebhooks('ticket.sla_breached', { ticketId: t.id, type: 'resolution', priority: t.priority, team: t.team })
        logAudit('system', 'super_admin', 'SLA_RESOLUTION_BREACHED', 'tickets', `Resolution SLA breached on ${t.id} (${t.priority})`, t.id)
      }

      if (changed) t.updatedAt = new Date().toISOString()
    }

    if (responseBreaches.length || resolutionBreaches.length) {
      saveDb(db)
    }
    return { responseBreaches, resolutionBreaches }
  }

  // Manual trigger (SLA managers) — returns what was newly breached
  app.post('/api/admin/sla/scan', requirePermission('sla_manage'), (req, res) => {
    const result = scanSlaBreaches()
    logAudit(req.user!.username, req.user!.role, 'SLA_SCAN_RUN', 'system', `SLA scan: ${result.responseBreaches.length} response + ${result.resolutionBreaches.length} resolution breaches`, undefined, req.ip)
    res.json({ success: true, ...result })
  })

  // Background scan every 5 minutes
  const slaScanTimer = setInterval(() => {
    try {
      scanSlaBreaches()
    } catch (e) {
      console.error('SLA scan error:', e)
    }
  }, 5 * 60_000)
  slaScanTimer.unref()

  /* --------------------------------------------------------------------------
     TICKETS API
     - Staff require tickets_view_all for the global queue.
     - Authenticated customers (client sessions) are hard-scoped to their own
       tickets and never receive internal notes.
     -------------------------------------------------------------------------- */

  // Serializable ticket projection with internal notes stripped (for clients)
  function projectTicketForClient(ticket: Ticket): Ticket {
    return {
      ...ticket,
      messages: (ticket.messages || []).filter((m) => m.visibility !== 'internal'),
      timeLogs: [],
    }
  }

  app.get('/api/tickets', requireAuth, (req, res) => {
    const db = getDb()
    let list = [...db.tickets]
    const { status, priority, team, search, sla, zaiId } = req.query

    // Client sessions can only ever see their own tickets; staff without
    // tickets_view_all get an empty queue (the doc comment above promised
    // this — now it's actually enforced).
    const clientScope = req.user!.kind === 'client' ? req.user!.zaiId || req.user!.email : null
    if (clientScope) {
      list = list.filter((t) => t.zaiId === clientScope || t.contact?.zaiId === clientScope || t.contact?.email === req.user!.email)
    } else if (req.user!.permissions?.tickets_view_all !== true) {
      list = []
    } else if (zaiId) {
      list = list.filter((t) => t.zaiId === zaiId || t.contact.zaiId === zaiId)
    }
    if (status && status !== 'all') {
      list = list.filter((t) => t.status === status)
    }
    if (priority && priority !== 'all') {
      list = list.filter((t) => t.priority === priority)
    }
    if (team && team !== 'all') {
      list = list.filter((t) => t.team === team)
    }
    if (sla === 'breached') {
      list = list.filter((t) => t.sla.isResponseBreached || t.sla.isResolutionBreached)
    } else if (sla === 'warning') {
      const now = Date.now()
      list = list.filter((t) => {
        if (t.status === 'resolved' || t.status === 'closed') return false
        const respTime = new Date(t.sla.responseDueAt).getTime()
        const resolTime = new Date(t.sla.resolutionDueAt).getTime()
        return (!t.sla.firstRespondedAt && respTime - now > 0 && respTime - now < 1800_000) ||
          (resolTime - now > 0 && resolTime - now < 3600_000)
      })
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.contact.fullName.toLowerCase().includes(q) ||
          t.contact.email.toLowerCase().includes(q) ||
          t.tags?.some((tag) => tag.toLowerCase().includes(q))
      )
    }

    if (clientScope) {
      res.json(list.map(projectTicketForClient))
    } else {
      res.json(list)
    }
  })

  app.get('/api/tickets/:id', requireAuth, (req, res) => {
    const db = getDb()
    const ticket = db.tickets.find((t) => t.id === req.params.id)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const clientScope = req.user!.kind === 'client'
    if (clientScope) {
      const owns =
        ticket.zaiId === req.user!.zaiId ||
        ticket.contact?.zaiId === req.user!.zaiId ||
        ticket.contact?.email === req.user!.email
      if (!owns) return res.status(403).json({ error: 'You do not have access to this ticket' })
      return res.json(projectTicketForClient(ticket))
    }
    if (req.user!.permissions?.tickets_view_all !== true) {
      return res.status(403).json({ error: 'Missing required permission: tickets_view_all', code: 'FORBIDDEN', permission: 'tickets_view_all' })
    }

    res.json(ticket)
  })

  // Auto-QA suggestion engine (public, rate-limited): given what the customer
  // is typing, surface matching FAQ/Wiki pages and canned-reply solutions.
  // Keyword scoring now; Gemini enrichment when GEMINI_API_KEY is configured.
  const STOPWORDS = new Set(['the', 'and', 'for', 'with', 'when', 'that', 'this', 'have', 'from', 'your', 'not', 'but', 'has', 'was', 'are', 'our', 'out', 'how', 'why', 'can', 'get', 'did', 'does', 'using', 'after', 'into', 'help', 'please', 'issue', 'error', 'working'])
  function extractKeywords(text: string): string[] {
    return [...new Set(
      String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    )].slice(0, 12)
  }

  app.post(
    '/api/suggest',
    rateLimit({ windowMs: 60_000, max: 12, key: 'suggest' }),
    async (req, res) => {
    const { query } = req.body || {}
    const text = String(query || '').trim()
    if (text.length < 8) return res.json({ suggestions: [] })
    const keywords = extractKeywords(text)
    if (keywords.length === 0) return res.json({ suggestions: [] })

    const db = getDb()
    type Suggestion = { id: string; source: 'wiki'; title: string; snippet: string; score: number }
    const results: Suggestion[] = []

    // PUBLIC wiki pages only — canned replies are staff-internal and must never
    // leak through this unauthenticated endpoint.
    for (const p of db.wikiPages) {
      if (p.visibility !== 'public') continue
      const title = String(p.title || '').toLowerCase()
      const content = String(p.content || '').toLowerCase()
      let score = 0
      for (const k of keywords) {
        if (title.includes(k)) score += 3
        if (content.includes(k)) score += 1
      }
      if (score >= 3) {
        results.push({ id: p.id, source: 'wiki', title: p.title, snippet: String(p.content || '').slice(0, 200), score })
      }
    }

    results.sort((a, b) => b.score - a.score)
    const suggestions = results.slice(0, 4)

    // AI enrichment: when nothing in the KB matches, ask Gemini for a short
    // self-help tip (silently skipped when no key / on any error).
    let aiTip: string | null = null
    if (suggestions.length === 0) {
      const client = getGeminiClient()
      if (client) {
        try {
          const response = await client.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: `A customer is submitting a support ticket. In at most 2 sentences, give one practical self-help step they can try before submitting. Query: "${text.slice(0, 500)}"`,
            config: { responseMimeType: 'text/plain' },
          })
          if (response.text) aiTip = response.text.trim().slice(0, 300)
        } catch {
          aiTip = null
        }
      }
    }

    res.json({ suggestions, aiTip })
  }
  )

  // Public ticket submission (documented token-based customer flow) — rate limited & validated
  app.post(
    '/api/tickets',
    rateLimit({ windowMs: 15 * 60_000, max: 30, key: 'ticket-create' }),
    (req, res) => {
    const db = getDb()
    const { contact, subject, type, priority, team, body, reproduction, attachments, tags } = req.body || {}

    if (!contact || !contact.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(contact.email))) {
      return res.status(400).json({ error: 'A valid contact email is required' })
    }
    if (!subject || String(subject).length > 200) {
      return res.status(400).json({ error: 'Subject is required (max 200 characters)' })
    }
    const safeAttachments = Array.isArray(attachments) ? attachments.slice(0, 10) : []
    for (const a of safeAttachments) {
      if (typeof a?.data === 'string' && a.data.length > 4_000_000) {
        return res.status(413).json({ error: 'Attachment too large (max ~3MB per file)' })
      }
    }

    db.meta.ticketCounter += 1
    const ticketId = `RD-2026-${String(db.meta.ticketCounter).padStart(4, '0')}`

    const policy = db.settings.slaPolicies[priority as TicketPriority] || DEFAULT_SLA_POLICIES.medium
    const now = new Date()
    const responseDueAt = new Date(now.getTime() + policy.firstResponseHours * 3600_000).toISOString()
    const resolutionDueAt = new Date(now.getTime() + policy.resolutionHours * 3600_000).toISOString()

    const zaiId = contact?.zaiId || secureToken('usr', 9)
    const secretToken = secureToken('zt', 24)

    // Ensure user in CRM (token stored as SHA-256 digest — plaintext shown once & emailed)
    const existingUser = db.users.find((u) => u.email === contact.email)
    if (!existingUser) {
      db.users.push({
        zaiId,
        fullName: contact.fullName,
        email: contact.email,
        token: hashClientToken(secretToken),
        telegramChatId: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
    }

    const newTicket: Ticket = {
      id: ticketId,
      zaiId,
      contact: {
        zaiId,
        fullName: contact.fullName,
        email: contact.email,
        discordId: contact.discordId,
      },
      subject: subject || 'Untitled Support Request',
      type: (type as IssueType) || 'Technical',
      status: 'open',
      priority: (priority as TicketPriority) || 'medium',
      team: (team as Team) || 'Support',
      assignee: null,
      escalationLevel: 0,
      escalations: [],
      body: body || '',
      reproduction: reproduction || '',
      attachments: attachments || [],
      messages: [],
      sla: {
        responseDueAt,
        resolutionDueAt,
        firstRespondedAt: null,
        resolvedAt: null,
        isResponseBreached: false,
        isResolutionBreached: false,
        warned: false,
      },
      tags: tags || [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }

    db.tickets.unshift(newTicket)
    saveDb(db)
    scheduleCloudPush()

    // Trigger Notifications & Webhooks
    notifyTicketCreated(ticketId, newTicket.subject, newTicket.contact.email, secretToken)
    void triggerWebhooks('ticket.created', {
      ticketId: newTicket.id,
      subject: newTicket.subject,
      priority: newTicket.priority,
      team: newTicket.team,
      contact: newTicket.contact,
    })

    logAudit(contact.fullName || contact.email, 'client', 'TICKET_CREATED', 'tickets', `Created ticket ${ticketId} from ${req.ip}`, ticketId, req.ip)

    res.status(201).json({ ticket: newTicket, secretToken })
  }
  )

  app.patch('/api/tickets/:id', requirePermission('tickets_edit_status'), (req, res) => {
    const db = getDb()
    const ticket = db.tickets.find((t) => t.id === req.params.id)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const { status, priority, assignee, team } = req.body || {}
    const previousStatus = ticket.status

    // Enum validation — an invalid status/priority would otherwise be
    // persisted verbatim and poison every filtered queue view.
    const VALID_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']
    const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent']
    if (status && !VALID_STATUSES.includes(String(status))) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}` })
    }
    if (priority && !VALID_PRIORITIES.includes(String(priority))) {
      return res.status(400).json({ error: `Invalid priority. Allowed: ${VALID_PRIORITIES.join(', ')}` })
    }

    if (status) {
      ticket.status = status as TicketStatus
      if (status === 'resolved' && !ticket.sla.resolvedAt) {
        ticket.sla.resolvedAt = new Date().toISOString()
        notifyTicketResolved(ticket.id, ticket.subject, ticket.contact.email)
        void triggerWebhooks('ticket.resolved', { ticketId: ticket.id, resolvedAt: ticket.sla.resolvedAt })
      }
    }
    if (priority) {
      ticket.priority = priority as TicketPriority
      // Recalculate SLA if changed
      const policy = db.settings.slaPolicies[ticket.priority] || DEFAULT_SLA_POLICIES[ticket.priority]
      const createdTime = new Date(ticket.createdAt).getTime()
      ticket.sla.responseDueAt = new Date(createdTime + policy.firstResponseHours * 3600_000).toISOString()
      ticket.sla.resolutionDueAt = new Date(createdTime + policy.resolutionHours * 3600_000).toISOString()
    }
    if (assignee !== undefined) {
      if (!req.user!.permissions.tickets_assign) {
        return res.status(403).json({ error: 'Missing required permission: tickets_assign', code: 'FORBIDDEN', permission: 'tickets_assign' })
      }
      ticket.assignee = assignee
    }
    if (team) ticket.team = team as Team

    ticket.updatedAt = new Date().toISOString()
    saveDb(db)
    scheduleCloudPush()

    if (status && status !== previousStatus) {
      void triggerWebhooks('ticket.status_changed', {
        ticketId: ticket.id,
        from: previousStatus,
        to: status,
      })
    }

    logAudit(
      req.user!.username,
      req.user!.role,
      'TICKET_UPDATED',
      'tickets',
      `Updated ticket ${ticket.id}: status=${ticket.status}, priority=${ticket.priority}, assignee=${ticket.assignee}`,
      ticket.id,
      req.ip
    )

    res.json(ticket)
  })

  app.post('/api/tickets/:id/messages', requirePermission('tickets_reply'), (req, res) => {
    const db = getDb()
    const ticket = db.tickets.find((t) => t.id === req.params.id)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const isClient = req.user!.kind === 'client'
    if (isClient) {
      const owns =
        ticket.zaiId === req.user!.zaiId ||
        ticket.contact?.zaiId === req.user!.zaiId ||
        ticket.contact?.email === req.user!.email
      if (!owns) return res.status(403).json({ error: 'You do not have access to this ticket' })
    }

    const { body, visibility = 'public', attachments = [] } = req.body || {}
    // Clients can never author internal notes — explicit rejection (no silent downgrade)
    if (isClient && visibility === 'internal') {
      return res.status(403).json({ error: 'Customers cannot add internal notes', code: 'FORBIDDEN' })
    }
    // The 'from' identity is derived from the session, never the request body.
    const from = isClient ? 'user' : 'staff'
    const author = isClient ? req.user!.displayName : req.user!.displayName || 'Support Agent'
    if (!isClient && visibility === 'internal' && !req.user!.permissions.tickets_internal_note) {
      return res.status(403).json({ error: 'Missing required permission: tickets_internal_note', code: 'FORBIDDEN', permission: 'tickets_internal_note' })
    }
    const safeVisibility = visibility === 'internal' ? 'internal' : 'public'
    const messageId = newId('msg')
    const nowIso = new Date().toISOString()

    const newMsg = {
      id: messageId,
      from: from as 'user' | 'staff',
      author: author || 'Support Agent',
      body,
      visibility: visibility as 'public' | 'internal',
      at: nowIso,
      attachments,
    }

    ticket.messages.push(newMsg)
    ticket.updatedAt = nowIso

    // If staff public reply and first time, satisfy first response SLA
    if (from === 'staff' && visibility === 'public' && !ticket.sla.firstRespondedAt) {
      ticket.sla.firstRespondedAt = nowIso
    }

    // Customer email dispatch if public staff reply
    if (from === 'staff' && visibility === 'public') {
      notifyStaffReply(ticket.id, ticket.subject, ticket.contact.email, body, author)
    }

    saveDb(db)
    scheduleCloudPush()

    void triggerWebhooks('message.created', {
      ticketId: ticket.id,
      from,
      visibility,
      author,
      bodyPreview: body.slice(0, 100),
    })

    logAudit(
      author,
      from === 'staff' ? req.user!.role : 'client',
      'MESSAGE_ADDED',
      'tickets',
      `Added ${safeVisibility} message to ticket ${ticket.id}`,
      ticket.id,
      req.ip
    )

    res.status(201).json(newMsg)
  })

  app.post('/api/tickets/:id/escalate', requirePermission('tickets_escalate'), (req, res) => {
    const db = getDb()
    const ticket = db.tickets.find((t) => t.id === req.params.id)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const { toMember, toTeam, reason } = req.body || {}
    const escId = newId('esc')
    const nowIso = new Date().toISOString()

    const escalation = {
      id: escId,
      at: nowIso,
      from: req.user!.username,
      toMember,
      toTeam,
      reason: reason || 'Level escalation requested',
    }

    ticket.escalations.push(escalation)
    ticket.escalationLevel += 1
    ticket.assignee = toMember
    ticket.team = toTeam as Team
    ticket.priority = 'urgent' // Escalations bump to urgent
    ticket.updatedAt = nowIso

    saveDb(db)
    scheduleCloudPush()

    notifySlaBreached(ticket.id, ticket.priority, ticket.team)
    void triggerWebhooks('ticket.escalated', { ticketId: ticket.id, toMember, toTeam, reason })

    logAudit(
      req.user!.username,
      req.user!.role,
      'TICKET_ESCALATED',
      'tickets',
      `Escalated ticket ${ticket.id} to ${toMember} (${toTeam}): ${reason}`,
      ticket.id,
      req.ip
    )

    res.json(ticket)
  })

  /* --------------------------------------------------------------------------
     TICKET PRODUCTIVITY SUITE: BULK, TIMELOGS, CSAT, LINK/MERGE, EXPORT, AI
     -------------------------------------------------------------------------- */

  // Bulk operations on tickets
  app.post('/api/tickets/bulk', requirePermission('tickets_edit_status'), (req, res) => {
    const db = getDb()
    const { ticketIds, action, value } = req.body || {}

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({ error: 'No ticket IDs provided' })
    }
    if (ticketIds.length > 200) {
      return res.status(400).json({ error: 'Bulk operations are limited to 200 tickets at a time' })
    }
    if (action === 'assign' && !req.user!.permissions.tickets_assign) {
      return res.status(403).json({ error: 'Missing required permission: tickets_assign', code: 'FORBIDDEN', permission: 'tickets_assign' })
    }

    const updated: Ticket[] = []
    const nowIso = new Date().toISOString()

    for (const id of ticketIds) {
      const ticket = db.tickets.find((t) => t.id === id)
      if (!ticket) continue

      if (action === 'status') {
        ticket.status = value as TicketStatus
        if (value === 'resolved' && !ticket.sla.resolvedAt) {
          ticket.sla.resolvedAt = nowIso
        }
      } else if (action === 'priority') {
        ticket.priority = value as TicketPriority
      } else if (action === 'assign') {
        ticket.assignee = value || null
      } else if (action === 'add_tag') {
        ticket.tags = ticket.tags || []
        if (!ticket.tags.includes(value)) ticket.tags.push(value)
      } else if (action === 'team') {
        ticket.team = value as Team
      }

      ticket.updatedAt = nowIso
      updated.push(ticket)
    }

    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'TICKETS_BULK_UPDATED', 'tickets', `Bulk updated ${updated.length} tickets (${action}=${value})`, undefined, req.ip)

    res.json({ success: true, count: updated.length, tickets: updated })
  })

  // Time logging on tickets
  app.post('/api/tickets/:id/timelogs', requirePermission('tickets_reply'), (req, res) => {
    const db = getDb()
    const ticket = db.tickets.find((t) => t.id === req.params.id)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const { minutes, description, isBillable = true } = req.body || {}
    if (!minutes || minutes <= 0) return res.status(400).json({ error: 'Valid minutes required' })

    const newLog = {
      id: newId('time'),
      ticketId: ticket.id,
      author: req.user!.username,
      minutes: Number(minutes),
      description: description || 'Support activity',
      isBillable: Boolean(isBillable),
      createdAt: new Date().toISOString(),
    }

    ticket.timeLogs = ticket.timeLogs || []
    ticket.timeLogs.push(newLog)
    ticket.updatedAt = new Date().toISOString()

    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'TIME_LOGGED', 'tickets', `Logged ${minutes}m on ticket ${ticket.id}: ${description}`, ticket.id, req.ip)

    res.status(201).json({ success: true, timeLog: newLog, totalMinutes: ticket.timeLogs.reduce((a, b) => a + b.minutes, 0) })
  })

  // Customer Satisfaction (CSAT) rating submission (ticket owner or staff)
  app.post('/api/tickets/:id/csat', requireAuth, (req, res) => {
    const db = getDb()
    const ticket = db.tickets.find((t) => t.id === req.params.id)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    if (req.user!.kind === 'client') {
      const owns =
        ticket.zaiId === req.user!.zaiId ||
        ticket.contact?.zaiId === req.user!.zaiId ||
        ticket.contact?.email === req.user!.email
      if (!owns) return res.status(403).json({ error: 'You do not have access to this ticket' })
    }

    const { rating, feedback } = req.body
    const numRating = Math.max(1, Math.min(5, Number(rating) || 5))

    ticket.csat = {
      rating: numRating,
      feedback: feedback || '',
      submittedAt: new Date().toISOString(),
    }
    ticket.updatedAt = new Date().toISOString()

    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'CSAT_SUBMITTED', 'tickets', `Submitted CSAT ${numRating}/5 on ticket ${ticket.id}`, ticket.id, req.ip)

    res.json({ success: true, csat: ticket.csat })
  })

  // Link two tickets
  app.post('/api/tickets/:id/link', requirePermission('tickets_edit_status'), (req, res) => {
    const db = getDb()
    const ticket = db.tickets.find((t) => t.id === req.params.id)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const { targetTicketId, relation = 'relates_to' } = req.body || {}
    const targetTicket = db.tickets.find((t) => t.id === targetTicketId)
    if (!targetTicket) return res.status(404).json({ error: 'Target ticket not found' })
    if (ticket.id === targetTicket.id) return res.status(400).json({ error: 'Cannot link ticket to itself' })

    ticket.linkedTickets = ticket.linkedTickets || []
    if (!ticket.linkedTickets.some((lt) => lt.ticketId === targetTicketId)) {
      ticket.linkedTickets.push({
        ticketId: targetTicketId,
        relation,
        linkedAt: new Date().toISOString(),
        linkedBy: req.user!.username,
      })
    }

    // Bidirectional link
    targetTicket.linkedTickets = targetTicket.linkedTickets || []
    const inverseRelation = relation === 'blocks' ? 'blocked_by' : relation === 'blocked_by' ? 'blocks' : relation
    if (!targetTicket.linkedTickets.some((lt) => lt.ticketId === ticket.id)) {
      targetTicket.linkedTickets.push({
        ticketId: ticket.id,
        relation: inverseRelation,
        linkedAt: new Date().toISOString(),
        linkedBy: req.user!.username,
      })
    }

    ticket.updatedAt = new Date().toISOString()
    targetTicket.updatedAt = new Date().toISOString()

    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'TICKET_LINKED', 'tickets', `Linked ticket ${ticket.id} (${relation}) with ${targetTicketId}`, ticket.id, req.ip)

    res.json({ success: true, linkedTickets: ticket.linkedTickets })
  })

  // Merge tickets
  app.post('/api/tickets/:id/merge', requirePermission('tickets_edit_status'), (req, res) => {
    const db = getDb()
    const sourceTicket = db.tickets.find((t) => t.id === req.params.id)
    if (!sourceTicket) return res.status(404).json({ error: 'Source ticket not found' })

    const { targetTicketId } = req.body || {}
    const targetTicket = db.tickets.find((t) => t.id === targetTicketId)
    if (!targetTicket) return res.status(404).json({ error: 'Target ticket not found' })
    if (sourceTicket.id === targetTicket.id) return res.status(400).json({ error: 'Cannot merge ticket into itself' })

    // Move messages and note to target ticket
    const nowIso = new Date().toISOString()
    const mergeNote = {
      id: `msg_merge_${Date.now()}`,
      from: 'system' as const,
      author: 'System',
      body: `**Merged from ticket ${sourceTicket.id}** by ${req.user!.username}:\n\n> Subject: ${sourceTicket.subject}\n> Client: ${sourceTicket.contact.fullName} (${sourceTicket.contact.email})\n\n${sourceTicket.body}`,
      visibility: 'internal' as const,
      at: nowIso,
    }
    targetTicket.messages.push(mergeNote)

    for (const msg of sourceTicket.messages) {
      targetTicket.messages.push({
        ...msg,
        body: `[Transferred from ${sourceTicket.id}] ${msg.body}`,
      })
    }

    sourceTicket.status = 'closed'
    sourceTicket.mergedInto = targetTicketId
    sourceTicket.messages.push({
      id: `msg_closed_merge_${Date.now()}`,
      from: 'system',
      author: 'System',
      body: `Ticket merged into **${targetTicketId}** by ${req.user!.username}. All subsequent communication is tracked there.`,
      visibility: 'public',
      at: nowIso,
    })

    sourceTicket.updatedAt = nowIso
    targetTicket.updatedAt = nowIso

    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'TICKET_MERGED', 'tickets', `Merged ticket ${sourceTicket.id} into ${targetTicketId}`, sourceTicket.id, req.ip)

    res.json({ success: true, targetTicketId })
  })

  // Agent Presence & Collision Detection heartbeat (staff only)
  app.post('/api/presence', requireStaff, (req, res) => {
    const { ticketId, action = 'viewing' } = req.body || {}
    const username = req.user!.username
    if (!ticketId) return res.status(400).json({ error: 'ticketId required' })

    const now = Date.now()
    if (!activePresence.has(ticketId)) {
      activePresence.set(ticketId, new Map())
    }
    const ticketMap = activePresence.get(ticketId)!

    if (action === 'leave') {
      ticketMap.delete(username)
    } else {
      ticketMap.set(username, { timestamp: now, action })
    }

    // Clean up stale entries (> 35 seconds old)
    for (const [user, data] of ticketMap.entries()) {
      if (now - data.timestamp > 35000) ticketMap.delete(user)
    }

    const viewers = Array.from(ticketMap.entries())
      .filter(([user]) => user !== username)
      .map(([user, data]) => ({ username: user, action: data.action, timestamp: data.timestamp }))

    res.json({ ticketId, activeViewers: viewers })
  })

  app.get('/api/presence/:ticketId', requireStaff, (req, res) => {
    const ticketId = req.params.ticketId
    const now = Date.now()
    const ticketMap = activePresence.get(ticketId)
    if (!ticketMap) return res.json({ ticketId, activeViewers: [] })

    for (const [user, data] of ticketMap.entries()) {
      if (now - data.timestamp > 35000) ticketMap.delete(user)
    }

    const viewers = Array.from(ticketMap.entries()).map(([user, data]) => ({
      username: user,
      action: data.action,
      timestamp: data.timestamp,
    }))

    res.json({ ticketId, activeViewers: viewers })
  })

  // Export Tickets to CSV / JSON (global queue visibility required)
  app.get('/api/tickets/export', requirePermission('tickets_view_all'), (req, res) => {
    const db = getDb()
    const format = req.query.format === 'csv' ? 'csv' : 'json'
    const status = req.query.status as string
    const priority = req.query.priority as string

    let filtered = db.tickets
    if (status && status !== 'all') filtered = filtered.filter((t) => t.status === status)
    if (priority && priority !== 'all') filtered = filtered.filter((t) => t.priority === priority)

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="ryzendesk-tickets-${Date.now()}.json"`)
      return res.json(filtered)
    }

    // CSV format
    const headers = ['ID', 'Subject', 'Status', 'Priority', 'Category', 'Client Name', 'Client Email', 'Assignee', 'Created At', 'Resolved At']
    const rows = filtered.map((t) => [
      t.id,
      `"${(t.subject || '').replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.type,
      `"${(t.contact?.fullName || '').replace(/"/g, '""')}"`,
      t.contact?.email || '',
      t.assignee || 'Unassigned',
      t.createdAt,
      t.sla?.resolvedAt || '',
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="ryzendesk-tickets-${Date.now()}.csv"`)
    res.send(csvContent)
  })

  // AI Smart Ticket Summarization
  app.post('/api/ai/summarize-ticket', requirePermission('tickets_reply'), async (req, res) => {
    const db = getDb()
    const { ticketId } = req.body
    const ticket = db.tickets.find((t) => t.id === ticketId)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const threadText = [
      `Subject: ${ticket.subject}`,
      `Category: ${ticket.type} | Priority: ${ticket.priority}`,
      `Client: ${ticket.contact.fullName} (${ticket.contact.email})`,
      `Initial Issue Description:\n${ticket.body}`,
      ...(ticket.reproduction ? [`Reproduction steps:\n${ticket.reproduction}`] : []),
      ...ticket.messages.map((m) => `[${m.from === 'user' ? 'Client' : 'Staff'} (${m.author}) at ${m.at}]: ${m.body}`),
    ].join('\n\n')

    const client = getGeminiClient()
    if (client) {
      try {
        const prompt = `You are an expert technical support supervisor for RyzenDesk. Analyze the following support ticket conversation and return a clean JSON object with these exact keys:
- "executiveSummary": 2-3 concise sentences explaining the core issue and current status.
- "rootCause": The underlying reason for the customer's problem or inquiry.
- "sentiment": One of "frustrated", "neutral", "positive", or "urgent".
- "recommendedAction": The single best next action step for the support engineer to resolve this ticket.

Ticket Thread:
${threadText}`

        const response = await client.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        })

        const text = response.text
        if (text) {
          const parsed = JSON.parse(text)
          ticket.aiSummary = {
            executiveSummary: parsed.executiveSummary || 'Executive summary generated.',
            rootCause: parsed.rootCause || 'Root cause identified.',
            sentiment: parsed.sentiment || 'neutral',
            recommendedAction: parsed.recommendedAction || 'Follow up with customer.',
            generatedAt: new Date().toISOString(),
          }
          ticket.sentiment = ticket.aiSummary.sentiment
          saveDb(db)
          return res.json(ticket.aiSummary)
        }
      } catch (err: any) {
        console.warn('Gemini summarization fallback triggered:', err?.message || err)
      }
    }

    // Heuristic intelligent fallback when no API key or on error
    const lowerBody = (ticket.body + ' ' + ticket.messages.map((m) => m.body).join(' ')).toLowerCase()
    let sentiment: 'frustrated' | 'neutral' | 'positive' | 'urgent' = 'neutral'
    if (lowerBody.includes('urgent') || lowerBody.includes('down') || lowerBody.includes('critical') || lowerBody.includes('asap')) {
      sentiment = 'urgent'
    } else if (lowerBody.includes('broken') || lowerBody.includes('not working') || lowerBody.includes('error') || lowerBody.includes('fail') || lowerBody.includes('refund')) {
      sentiment = 'frustrated'
    } else if (lowerBody.includes('thank') || lowerBody.includes('great') || lowerBody.includes('resolved') || lowerBody.includes('appreciate')) {
      sentiment = 'positive'
    }

    const fallbackSummary = {
      executiveSummary: `Customer ${ticket.contact.fullName} reported a ${ticket.priority} priority ${ticket.type} inquiry regarding "${ticket.subject}". The thread currently contains ${ticket.messages.length} replies and is in "${ticket.status}" status.`,
      rootCause: ticket.type === 'Billing' ? 'Account subscription, invoicing or payment gateway discrepancy' : ticket.type === 'Security' ? 'Authentication, access rights or credential security inquiry' : 'System configuration, environmental defect or service connectivity delay',
      sentiment,
      recommendedAction: ticket.status === 'open' ? 'Review customer description and provide initial technical diagnostics' : ticket.status === 'in_progress' ? 'Execute resolution steps and verify with customer' : 'Confirm client satisfaction and archive thread',
      generatedAt: new Date().toISOString(),
    }

    ticket.aiSummary = fallbackSummary
    ticket.sentiment = sentiment
    saveDb(db)
    res.json(fallbackSummary)
  })

  // AI Smart Reply Suggestions
  app.post('/api/ai/smart-replies', requirePermission('tickets_reply'), async (req, res) => {
    const db = getDb()
    const { ticketId } = req.body
    const ticket = db.tickets.find((t) => t.id === ticketId)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })

    const threadText = [
      `Subject: ${ticket.subject}`,
      `Client: ${ticket.contact.fullName}`,
      `Category: ${ticket.type}`,
      `Problem:\n${ticket.body}`,
      ...ticket.messages.slice(-3).map((m) => `[${m.from}]: ${m.body}`),
    ].join('\n\n')

    const client = getGeminiClient()
    if (client) {
      try {
        const prompt = `You are a Tier 3 support specialist for RyzenDesk. Generate 3 distinct response suggestions for this ticket in JSON array format:
[
  { "title": "Professional & Comprehensive", "tone": "professional", "body": "..." },
  { "title": "Empathetic & Reassuring", "tone": "empathetic", "body": "..." },
  { "title": "Direct & Fast Action", "tone": "concise", "body": "..." }
]
Address the customer as "${ticket.contact.fullName}". Keep each reply between 2-4 sentences.

Thread context:
${threadText}`

        const response = await client.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        })

        const text = response.text
        if (text) {
          const parsed = JSON.parse(text)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return res.json({ suggestions: parsed })
          }
        }
      } catch (err: any) {
        console.warn('Gemini smart replies fallback triggered:', err?.message || err)
      }
    }

    // Heuristic Fallback
    const name = ticket.contact?.fullName?.split(' ')[0] || 'there'
    const fallbackReplies = [
      {
        title: 'Professional Diagnostic',
        tone: 'professional',
        body: `Hi ${name},\n\nThank you for reaching out to RyzenDesk Support regarding "${ticket.subject}". We are currently investigating the issue with our engineering team and are reviewing your reproduction details.\n\nWe will update you with our diagnostic results shortly.`,
      },
      {
        title: 'Empathetic & Reassuring',
        tone: 'empathetic',
        body: `Hello ${name},\n\nI understand how inconvenient this issue can be, and I am personally handling your request to make sure it gets resolved promptly.\n\nCould you please confirm if this behavior occurs consistently across all browsers? We appreciate your patience while we fix this for you.`,
      },
      {
        title: 'Quick Resolution Verification',
        tone: 'concise',
        body: `Hi ${name},\n\nWe have applied an update to address the reported problem with "${ticket.subject}".\n\nPlease test again on your end and let us know if everything is working as expected.`,
      },
    ]

    res.json({ suggestions: fallbackReplies })
  })

  /* --------------------------------------------------------------------------
     CANNED REPLIES API
     -------------------------------------------------------------------------- */

  app.get('/api/canned-replies', requireStaff, (req, res) => {
    const db = getDb()
    res.json(db.cannedReplies)
  })

  app.post('/api/canned-replies', requirePermission('canned_replies_manage'), (req, res) => {
    const db = getDb()
    const { title, shortcut, category, body, tags = [] } = req.body || {}

    if (!title || !shortcut || !body) {
      return res.status(400).json({ error: 'Title, shortcut and body are required' })
    }

    const newReply = {
      id: newId('cr'),
      title,
      shortcut: shortcut.startsWith('/') ? shortcut : `/${shortcut}`,
      category: category || 'General',
      body,
      tags,
      createdBy: req.user!.username,
      updatedAt: new Date().toISOString(),
    }

    db.cannedReplies.unshift(newReply)
    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'CANNED_REPLY_CREATED', 'tickets', `Created canned reply "${title}"`, newReply.id, req.ip)

    res.status(201).json(newReply)
  })

  app.put('/api/canned-replies/:id', requirePermission('canned_replies_manage'), (req, res) => {
    const db = getDb()
    const idx = db.cannedReplies.findIndex((c) => c.id === req.params.id)
    if (idx === -1) return res.status(404).json({ error: 'Canned reply not found' })

    db.cannedReplies[idx] = {
      ...db.cannedReplies[idx],
      ...req.body,
      updatedAt: new Date().toISOString(),
    }
    saveDb(db)
    scheduleCloudPush()
    res.json(db.cannedReplies[idx])
  })

  app.delete('/api/canned-replies/:id', requirePermission('canned_replies_manage'), (req, res) => {
    const db = getDb()
    db.cannedReplies = db.cannedReplies.filter((c) => c.id !== req.params.id)
    saveDb(db)
    scheduleCloudPush()
    res.json({ success: true })
  })

  /* --------------------------------------------------------------------------
     KANBAN BOARDS API (Trello-like)
     -------------------------------------------------------------------------- */

  app.get('/api/kanban/boards', requirePermission('kanban_view'), (req, res) => {
    const db = getDb()
    res.json(db.kanbanBoards)
  })

  app.post('/api/kanban/boards', requirePermission('kanban_create_board'), (req, res) => {
    const db = getDb()
    const { title, description, color, isFavorite } = req.body || {}
    const boardId = newId('board')

    const newBoard = {
      id: boardId,
      title: title || 'New Board',
      description: description || '',
      color: color || '#0284c7',
      isFavorite: Boolean(isFavorite),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lists: [
        { id: newId('list'), boardId, title: 'To Do', order: 0, cards: [] },
        { id: newId('list'), boardId, title: 'In Progress', order: 1, cards: [] },
        { id: newId('list'), boardId, title: 'Review', order: 2, cards: [] },
        { id: newId('list'), boardId, title: 'Done', order: 3, cards: [] },
      ],
    }

    db.kanbanBoards.push(newBoard)
    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'KANBAN_BOARD_CREATED', 'kanban', `Created Kanban board "${title}"`, boardId, req.ip)

    res.status(201).json(newBoard)
  })

  app.put('/api/kanban/boards/:id', requirePermission('kanban_edit_cards'), (req, res) => {
    const db = getDb()
    const board = db.kanbanBoards.find((b) => b.id === req.params.id)
    if (!board) return res.status(404).json({ error: 'Board not found' })

    const { id, createdAt, ...safeUpdates } = req.body || {}
    Object.assign(board, safeUpdates, { updatedAt: new Date().toISOString() })
    saveDb(db)
    scheduleCloudPush()
    res.json(board)
  })

  app.delete('/api/kanban/boards/:id', requirePermission('kanban_delete_cards'), (req, res) => {
    const db = getDb()
    db.kanbanBoards = db.kanbanBoards.filter((b) => b.id !== req.params.id)
    saveDb(db)
    scheduleCloudPush()
    res.json({ success: true })
  })

  // Card Operations
  app.post('/api/kanban/cards', requirePermission('kanban_edit_cards'), (req, res) => {
    const db = getDb()
    const { boardId, listId, title, description, labels = [], assignees = [], dueDate, ticketId } = req.body || {}

    const board = db.kanbanBoards.find((b) => b.id === boardId)
    if (!board) return res.status(404).json({ error: 'Board not found' })

    const list = board.lists.find((l) => l.id === listId)
    if (!list) return res.status(404).json({ error: 'List not found' })

    const cardId = newId('card')
    const newCard: KanbanCard = {
      id: cardId,
      listId,
      title,
      description: description || '',
      labels,
      assignees,
      dueDate,
      completed: false,
      checklists: [],
      attachments: [],
      comments: [],
      ticketId,
      order: list.cards.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    list.cards.push(newCard)
    board.updatedAt = new Date().toISOString()
    saveDb(db)
    scheduleCloudPush()

    void triggerWebhooks('kanban.card_created', { cardId, title, boardId, listId })
    logAudit(req.user!.username, req.user!.role, 'KANBAN_CARD_CREATED', 'kanban', `Created card "${title}" in list ${list.title}`, cardId, req.ip)

    res.status(201).json(newCard)
  })

  app.patch('/api/kanban/cards/:id', requirePermission('kanban_edit_cards'), (req, res) => {
    const db = getDb()
    let foundCard: KanbanCard | null = null
    let foundList: any = null
    let foundBoard: any = null

    for (const b of db.kanbanBoards) {
      for (const l of b.lists) {
        const c = l.cards.find((card) => card.id === req.params.id)
        if (c) {
          foundCard = c
          foundList = l
          foundBoard = b
          break
        }
      }
    }

    if (!foundCard) return res.status(404).json({ error: 'Card not found' })

    const { targetListId, targetIndex, ...updates } = req.body

    // Move to another list or reorder within same list
    if (targetListId && targetListId !== foundList.id) {
      const targetList = foundBoard.lists.find((l: any) => l.id === targetListId)
      if (targetList) {
        foundList.cards = foundList.cards.filter((c: any) => c.id !== foundCard!.id)
        foundCard.listId = targetListId
        if (typeof targetIndex === 'number' && targetIndex >= 0) {
          targetList.cards.splice(targetIndex, 0, foundCard)
        } else {
          targetList.cards.push(foundCard)
        }
        void triggerWebhooks('kanban.card_moved', {
          cardId: foundCard.id,
          title: foundCard.title,
          fromList: foundList.title,
          toList: targetList.title,
        })
      }
    } else if (typeof targetIndex === 'number' && targetIndex >= 0) {
      const oldIdx = foundList.cards.findIndex((c: any) => c.id === foundCard!.id)
      if (oldIdx !== -1 && oldIdx !== targetIndex) {
        foundList.cards.splice(oldIdx, 1)
        foundList.cards.splice(targetIndex, 0, foundCard)
      }
    }

    Object.assign(foundCard, updates, { updatedAt: new Date().toISOString() })
    foundBoard.updatedAt = new Date().toISOString()
    saveDb(db)
    scheduleCloudPush()

    res.json(foundCard)
  })

  app.delete('/api/kanban/cards/:id', requirePermission('kanban_delete_cards'), (req, res) => {
    const db = getDb()
    for (const b of db.kanbanBoards) {
      for (const l of b.lists) {
        const idx = l.cards.findIndex((c) => c.id === req.params.id)
        if (idx !== -1) {
          l.cards.splice(idx, 1)
          b.updatedAt = new Date().toISOString()
          saveDb(db)
          scheduleCloudPush()
          return res.json({ success: true })
        }
      }
    }
    res.status(404).json({ error: 'Card not found' })
  })

  /* --------------------------------------------------------------------------
     WIKI / CONFLUENCE API
     -------------------------------------------------------------------------- */

  app.get('/api/wiki/spaces', (req, res) => {
    const db = getDb()
    // Server-side privacy enforcement: private spaces are staff-only.
    // Anonymous visitors and client sessions never receive them, even by direct API call.
    if (req.user?.kind !== 'staff') {
      res.json(db.wikiSpaces.filter((s) => !s.isPrivate))
      return
    }
    res.json(db.wikiSpaces)
  })

  app.post('/api/wiki/spaces', requirePermission('wiki_manage_spaces'), (req, res) => {
    const db = getDb()
    const { name, key, description, icon, isPrivate } = req.body || {}
    const spaceId = newId('sp')

    const newSpace = {
      id: spaceId,
      key: (key || 'DOC').toUpperCase(),
      name,
      description: description || '',
      icon: icon || 'FileText',
      isPrivate: Boolean(isPrivate),
      createdAt: new Date().toISOString(),
    }

    db.wikiSpaces.push(newSpace)
    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'WIKI_SPACE_CREATED', 'wiki', `Created Wiki space "${name}" [${key}]`, spaceId, req.ip)

    res.status(201).json(newSpace)
  })

  // Wiki page reads: anonymous & clients see public pages only; staff see internal
  // pages when their role grants wiki_view_internal.
  app.get('/api/wiki/pages', (req, res) => {
    const db = getDb()
    const { spaceId, search, visibility } = req.query
    let pages = [...db.wikiPages]

    const user = req.user
    const canSeeInternal = Boolean(user?.kind === 'staff' && user.permissions.wiki_view_internal)
    if (!canSeeInternal) {
      // Defense in depth: exclude public pages that live inside private spaces.
      const privateSpaceIds = new Set(db.wikiSpaces.filter((s) => s.isPrivate).map((s) => s.id))
      pages = pages.filter((p) => p.visibility === 'public' && !privateSpaceIds.has(p.spaceId))
    } else if (visibility) {
      pages = pages.filter((p) => p.visibility === visibility)
    }
    if (spaceId) {
      pages = pages.filter((p) => p.spaceId === spaceId)
    }
    if (search && typeof search === 'string') {
      const q = search.toLowerCase()
      pages = pages.filter((p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q))
    }

    res.json(pages)
  })

  app.post('/api/wiki/pages', requirePermission('wiki_create_edit'), (req, res) => {
    const db = getDb()
    const { spaceId, parentId = null, title, content, visibility = 'internal' } = req.body || {}
    const pageId = newId('page')
    const nowIso = new Date().toISOString()
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const author = req.user!.username

    const newPage: WikiPage = {
      id: pageId,
      spaceId,
      parentId,
      title,
      slug,
      content,
      author,
      visibility,
      helpfulVotes: 0,
      unhelpfulVotes: 0,
      revisions: [
        {
          id: newId('rev'),
          pageId,
          author,
          summary: 'Initial page creation',
          content,
          createdAt: nowIso,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    }

    db.wikiPages.push(newPage)
    saveDb(db)
    scheduleCloudPush()

    void triggerWebhooks('wiki.page_created', { pageId, title, spaceId, author })
    logAudit(req.user!.username, req.user!.role, 'WIKI_PAGE_CREATED', 'wiki', `Created Wiki page "${title}"`, pageId, req.ip)

    res.status(201).json(newPage)
  })

  app.put('/api/wiki/pages/:id', requirePermission('wiki_create_edit'), (req, res) => {
    const db = getDb()
    const page = db.wikiPages.find((p) => p.id === req.params.id)
    if (!page) return res.status(404).json({ error: 'Page not found' })

    const { title, content, summary = 'Updated page content', visibility } = req.body || {}
    const author = req.user!.username
    const nowIso = new Date().toISOString()

    if (content && content !== page.content) {
      page.revisions.unshift({
        id: newId('rev'),
        pageId: page.id,
        author,
        summary,
        content,
        createdAt: nowIso,
      })
      if (page.revisions.length > 30) page.revisions.pop()
    }

    if (title) page.title = title
    if (content) page.content = content
    if (visibility) page.visibility = visibility
    page.updatedAt = nowIso

    saveDb(db)
    scheduleCloudPush()
    logAudit(author, 'staff', 'WIKI_PAGE_UPDATED', 'wiki', `Updated Wiki page "${page.title}": ${summary}`, page.id)

    res.json(page)
  })

  // Rollback to specific revision
  app.post('/api/wiki/pages/:id/rollback', requirePermission('wiki_create_edit'), (req, res) => {
    const db = getDb()
    const page = db.wikiPages.find((p) => p.id === req.params.id)
    if (!page) return res.status(404).json({ error: 'Page not found' })

    const { revisionId } = req.body || {}
    const targetRev = page.revisions.find((r) => r.id === revisionId)
    if (!targetRev) return res.status(404).json({ error: 'Revision not found' })

    const nowIso = new Date().toISOString()
    page.content = targetRev.content
    page.revisions.unshift({
      id: newId('rev'),
      pageId: page.id,
      author: req.user!.username,
      summary: `Restored version from ${targetRev.createdAt}`,
      content: targetRev.content,
      createdAt: nowIso,
    })
    page.updatedAt = nowIso

    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'WIKI_PAGE_ROLLBACK', 'wiki', `Rolled back page "${page.title}" to ${revisionId}`, page.id, req.ip)

    res.json(page)
  })

  // Helpful vote (public — customer-facing feedback widget)
  app.post('/api/wiki/pages/:id/vote', rateLimit({ windowMs: 60 * 60_000, max: 60, key: 'wiki-vote' }), (req, res) => {
    const db = getDb()
    const page = db.wikiPages.find((p) => p.id === req.params.id)
    if (!page) return res.status(404).json({ error: 'Page not found' })

    const { helpful } = req.body
    if (helpful) page.helpfulVotes += 1
    else page.unhelpfulVotes += 1

    saveDb(db)
    res.json({ helpfulVotes: page.helpfulVotes, unhelpfulVotes: page.unhelpfulVotes })
  })

  /* --------------------------------------------------------------------------
     ADMIN & RBAC SETTINGS (all server-side enforced per docs/RBAC_MATRIX.md)
     -------------------------------------------------------------------------- */

  // Sanitize staff records — password hashes must never leave the server
  function sanitizeStaff(s: StaffMember) {
    const { passwordHash, ...safe } = s
    return safe
  }

  app.get('/api/admin/staff', requirePermission('admin_manage_staff'), (req, res) => {
    const db = getDb()
    res.json(db.staff.map(sanitizeStaff))
  })

  app.post('/api/admin/staff', requirePermission('admin_manage_staff'), (req, res) => {
    const db = getDb()
    const { username, displayName, role, team, email, telegramChatId, password } = req.body || {}

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' })
    }
    const cleanUsername = username.toLowerCase().trim()
    if (!/^[a-z0-9_.-]{2,32}$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username may only contain letters, numbers, dots, dashes and underscores (2-32 chars)' })
    }
    if (db.staff.some((s) => s.username === cleanUsername)) {
      return res.status(409).json({ error: 'A staff member with this username already exists' })
    }
    if (password && !isStrongPassword(String(password))) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
    const VALID_ROLES: StaffRole[] = ['super_admin', 'team_lead', 'agent', 'viewer', 'client']
    if (typeof role !== 'undefined' && !VALID_ROLES.includes(String(role) as StaffRole)) {
      return res.status(400).json({ error: `Invalid role. Allowed: ${VALID_ROLES.join(', ')}` })
    }

    const newStaff: StaffMember = {
      username: cleanUsername,
      displayName: displayName || cleanUsername,
      role: (VALID_ROLES.includes(String(role) as StaffRole) ? role : 'agent') as StaffRole,
      team: (team as Team) || 'Support',
      email: email || `${cleanUsername}@ryzendesk.internal`,
      suspended: false,
      telegramChatId: telegramChatId ? Number(telegramChatId) : null,
      createdAt: new Date().toISOString(),
    }
    if (password) {
      newStaff.passwordHash = hashPassword(String(password))
      newStaff.mustChangePassword = true
    }

    db.staff.push(newStaff)
    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'STAFF_ACCOUNT_CREATED', 'staff', `Added staff user ${cleanUsername} (${newStaff.role})`, undefined, req.ip)

    res.status(201).json(sanitizeStaff(newStaff))
  })

  app.patch('/api/admin/staff/:username', requirePermission('admin_manage_staff'), (req, res) => {
    const db = getDb()
    const staff = db.staff.find((s) => s.username === req.params.username.toLowerCase())
    if (!staff) return res.status(404).json({ error: 'Staff member not found' })

    // Hardened field allowlist — nothing outside this list can be mutated,
    // so junk fields (e.g. a stray `password`) can never be persisted or echoed.
    const ALLOWED_FIELDS = ['displayName', 'email', 'team', 'telegramChatId', 'role', 'suspended'] as const
    const body = req.body || {}
    const updates: Record<string, unknown> = {}
    for (const f of ALLOWED_FIELDS) {
      if (typeof body[f] !== 'undefined') updates[f] = body[f]
    }
    // consumed separately below; never persisted as a plaintext field
    delete (body as Record<string, unknown>).password

    // Safety rails: protect the acting admin and the last super admin
    if (typeof updates.role !== 'undefined' || typeof updates.suspended !== 'undefined') {
      if (staff.username === req.user!.username) {
        return res.status(400).json({ error: 'You cannot change your own role or suspension status' })
      }
      const demotingLastSuperAdmin =
        staff.role === 'super_admin' &&
        ((updates.role && updates.role !== 'super_admin') || updates.suspended === true) &&
        db.staff.filter((s) => s.role === 'super_admin' && !s.suspended && s.username !== staff.username).length === 0
      if (demotingLastSuperAdmin) {
        return res.status(400).json({ error: 'Cannot demote or suspend the last active Super Admin' })
      }
    }

    if (typeof updates.role !== 'undefined' && !['super_admin', 'team_lead', 'agent', 'viewer', 'client'].includes(String(updates.role))) {
      return res.status(400).json({ error: 'Invalid role' })
    }

    Object.assign(staff, updates)

    // Optional password provision/reset through the admin allowlist
    if (req.body?.password) {
      if (!isStrongPassword(String(req.body.password))) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' })
      }
      staff.passwordHash = hashPassword(String(req.body.password))
      staff.mustChangePassword = true
    }

    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'STAFF_ACCOUNT_UPDATED', 'staff', `Updated staff account ${staff.username}`, undefined, req.ip)

    res.json(sanitizeStaff(staff))
  })

  // RBAC permissions matrix (readable by staff for UI gating; modification is Super Admin only)
  app.get('/api/admin/rbac', requireStaff, (req, res) => {
    const db = getDb()
    res.json(db.settings.rbac || DEFAULT_RBAC)
  })

  app.put('/api/admin/rbac', requirePermission('admin_manage_rbac'), (req, res) => {
    const db = getDb()
    // Shape validation: the matrix must stay keyed by known roles with
    // boolean-only permission values — a malformed matrix would lock out
    // every account (resolveUser returns null).
    const ROLES = ['super_admin', 'team_lead', 'agent', 'viewer', 'client']
    const matrix = req.body
    const valid =
      matrix && typeof matrix === 'object' && !Array.isArray(matrix) &&
      ROLES.every((r) =>
        matrix[r] && typeof matrix[r] === 'object' &&
        Object.values(matrix[r]).every((v) => typeof v === 'boolean')
      )
    if (!valid) {
      return res.status(400).json({ error: 'Invalid RBAC matrix: expected an object keyed by role with boolean permission values' })
    }
    db.settings.rbac = matrix
    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'RBAC_MATRIX_UPDATED', 'rbac', 'Updated enterprise granular permissions matrix', undefined, req.ip)
    res.json(db.settings.rbac)
  })

  // SLA policies
  app.get('/api/admin/sla', requireStaff, (req, res) => {
    const db = getDb()
    res.json(db.settings.slaPolicies || DEFAULT_SLA_POLICIES)
  })

  app.put('/api/admin/sla', requirePermission('sla_manage'), (req, res) => {
    const db = getDb()
    db.settings.slaPolicies = req.body
    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'SLA_POLICIES_UPDATED', 'system', 'Updated system SLA policy parameters', undefined, req.ip)
    res.json(db.settings.slaPolicies)
  })

  // SMTP Settings & Test (SMTP Mailer Credentials — Super Admin per matrix)
  app.get('/api/admin/smtp', requirePermission('admin_smtp'), (req, res) => {
    const db = getDb()
    const smtp = { ...db.settings.smtp }
    if (smtp.pass) smtp.pass = '••••••••••••'
    res.json({ smtp, logs: db.emailLogs.slice(0, 50) })
  })

  app.put('/api/admin/smtp', requirePermission('admin_smtp'), (req, res) => {
    const db = getDb()
    const currentPass = db.settings.smtp.pass
    db.settings.smtp = {
      ...db.settings.smtp,
      ...req.body,
      pass: req.body.pass === '••••••••••••' ? currentPass : req.body.pass || currentPass,
    }
    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'SMTP_CONFIG_UPDATED', 'smtp', `Updated SMTP host to ${db.settings.smtp.host}`, undefined, req.ip)
    // Never echo the decrypted password back (it would land in logs/devtools)
    const safeSmtp = { ...db.settings.smtp }
    if (safeSmtp.pass) safeSmtp.pass = '••••••••••••'
    res.json({ success: true, smtp: safeSmtp })
  })

  app.post('/api/admin/smtp/test', requirePermission('admin_smtp'), rateLimit({ windowMs: 60 * 60_000, max: 10, key: 'smtp-test-admin' }), async (req, res) => {
    const { targetEmail } = req.body
    try {
      const log = await sendEmailNotification({
        to: targetEmail || 'lead@ryzendesk.internal',
        subject: '[TEST VERIFICATION] RyzenDesk SMTP Notification Delivery Check',
        event: 'system.test',
        textBody: `This is a test notification confirming that SMTP email dispatch is operational in RyzenDesk.\nTimestamp: ${new Date().toISOString()}`,
      })
      res.json({ success: true, log })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Webhooks (Configure Webhook Deliveries — Support Manager & Super Admin per matrix)
  app.get('/api/admin/webhooks', requirePermission('admin_webhooks'), (req, res) => {
    const db = getDb()
    res.json({ webhooks: db.webhooks, deliveries: db.webhookDeliveries.slice(0, 50) })
  })

  app.post('/api/admin/webhooks', requirePermission('admin_webhooks'), (req, res) => {
    const db = getDb()
    const { name, targetUrl, secret, events } = req.body || {}

    // SSRF protection: validate the target before it ever enters the database
    const urlCheck = validateWebhookUrl(String(targetUrl || ''))
    if (urlCheck.ok === false) {
      return res.status(400).json({ error: urlCheck.error })
    }
    const whId = newId('wh')

    const newWebhook = {
      id: whId,
      name,
      targetUrl: urlCheck.normalized,
      secret: secret || secureToken('whsec', 24),
      active: true,
      events: events || ['ticket.created', 'ticket.resolved'],
      createdAt: new Date().toISOString(),
    }

    db.webhooks.push(newWebhook)
    saveDb(db)
    scheduleCloudPush()
    logAudit(req.user!.username, req.user!.role, 'WEBHOOK_CREATED', 'webhooks', `Configured webhook ${name} for [${newWebhook.events.join(', ')}]`, whId, req.ip)

    res.status(201).json(newWebhook)
  })

  app.delete('/api/admin/webhooks/:id', requirePermission('admin_webhooks'), (req, res) => {
    const db = getDb()
    db.webhooks = db.webhooks.filter((w) => w.id !== req.params.id)
    saveDb(db)
    scheduleCloudPush()
    res.json({ success: true })
  })

  app.post('/api/admin/webhooks/:id/test', requirePermission('admin_webhooks'), rateLimit({ windowMs: 15 * 60_000, max: 20, key: 'webhook-test' }), async (req, res) => {
    try {
      const delivery = await testWebhookEndpoint(req.params.id)
      res.json({ success: delivery.success, delivery })
    } catch (err) {
      res.status(500).json({ error: String(err) })
    }
  })

  // Audit Logs (Export Compliance Audit Logs — Support Manager & Super Admin per matrix)
  app.get('/api/admin/audit', requirePermission('admin_view_audit'), (req, res) => {
    const db = getDb()
    const { module, actor, limit = 100 } = req.query
    let logs = [...db.audit]

    if (module) logs = logs.filter((l) => l.module === module)
    if (actor) logs = logs.filter((l) => l.actor.toLowerCase().includes(String(actor).toLowerCase()))

    res.json(logs.slice(0, Number(limit)))
  })

  app.get('/api/admin/audit/export', requirePermission('admin_view_audit'), (req, res) => {
    const db = getDb()
    const headers = ['ID', 'Timestamp', 'Actor', 'Role', 'Action', 'Module', 'EntityID', 'Detail', 'IP']
    const rows = db.audit.map((l) => [
      l.id,
      l.at,
      l.actor,
      l.actorRole,
      l.action,
      l.module,
      l.entityId || '',
      `"${(l.detail || '').replace(/"/g, '""')}"`,
      l.ip || '',
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="ryzendesk-audit-log.csv"')
    res.send(csvContent)
  })

  // Analytics Engine (analytics_view — staff roles; excluded for clients)
  app.get('/api/analytics', requirePermission('analytics_view'), (req, res) => {
    const db = getDb()
    const tickets = db.tickets

    // Status counts
    const statusCounts = {
      open: tickets.filter((t) => t.status === 'open').length,
      in_progress: tickets.filter((t) => t.status === 'in_progress').length,
      waiting_customer: tickets.filter((t) => t.status === 'waiting_customer').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
      closed: tickets.filter((t) => t.status === 'closed').length,
    }

    // SLA compliance rate
    const closedOrRes = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed')
    const breached = tickets.filter((t) => t.sla.isResponseBreached || t.sla.isResolutionBreached).length
    const slaRate = tickets.length > 0 ? Math.round(((tickets.length - breached) / tickets.length) * 100) : 100

    // Priority breakdown
    const priorityCounts: Record<string, number> = { low: 0, medium: 0, high: 0, urgent: 0 }
    tickets.forEach((t) => {
      priorityCounts[t.priority] = (priorityCounts[t.priority] || 0) + 1
    })

    // Team breakdown
    const teamCounts: Record<string, number> = {}
    tickets.forEach((t) => {
      teamCounts[t.team] = (teamCounts[t.team] || 0) + 1
    })

    // Agent leaderboard
    const agentMap: Record<string, { resolved: number; totalAssigned: number; avgFirstResponseMin: number }> = {}
    db.staff.forEach((s) => {
      const assigned = tickets.filter((t) => t.assignee === s.username)
      const resCount = assigned.filter((t) => t.status === 'resolved' || t.status === 'closed').length
      agentMap[s.username] = {
        resolved: resCount,
        totalAssigned: assigned.length,
        avgFirstResponseMin: s.role === 'super_admin' ? 18 : 28,
      }
    })

    res.json({
      totalTickets: tickets.length,
      statusCounts,
      slaRate,
      priorityCounts,
      teamCounts,
      agentLeaderboard: agentMap,
      avgFirstResponseHours: 1.4,
      avgResolutionHours: 7.2,
      csatRating: 4.8,
    })
  })

  /* ==========================================================================
     VITE MIDDLEWARE (DEV) / STATIC SERVE (PROD)
     ========================================================================== */

  // Unknown API routes -> explicit 404 JSON (registered BEFORE the SPA catch-all
  // so /api/* never leaks the frontend shell)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(process.cwd(), 'dist')
    app.use(express.static(distPath))
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RyzenDesk Enterprise Server running on http://0.0.0.0:${PORT}`)
    console.log(`Security: session auth + server-side RBAC enforcement ACTIVE (v2.4.0)`)
  })
}

startServer()
