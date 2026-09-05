import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import type {
  HelpdeskDB,
  Ticket,
  StaffMember,
  StaffRole,
  RolePermissions,
  SLAPolicy,
  TicketPriority,
  CannedReply,
  KanbanBoard,
  WikiSpace,
  WikiPage,
  AuditEntry,
  WebhookConfig,
  WebhookDelivery,
  EmailNotificationLog,
  InstallationSettings,
} from '../src/types'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'helpdesk-db.json')

/* ==========================================================================
   At-rest secret protection (RD-SEC-06)
   - Credential fields (SMTP password, Telegram bot token, installation lock
     key) are AES-256-GCM encrypted before the DB file is written and are
     decrypted transparently on load.
   - Customer access tokens are stored ONLY as SHA-256 digests — the plaintext
     `zt_...` token is shown once at ticket creation (and emailed) and can
     never be recovered from the database.
   ========================================================================== */

const SECRET_ENC_PREFIX = 'enc:v1:'
const TOKEN_HASH_PREFIX = 'sha256:'

function atRestKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'dev-fallback'
  return crypto.scryptSync(secret, 'ryzendesk-at-rest-v1', 32)
}

export function encryptAtRest(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', atRestKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${SECRET_ENC_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`
}

export function decryptAtRest(value: string): string {
  if (!value || !value.startsWith(SECRET_ENC_PREFIX)) return value
  try {
    const [ivB64, tagB64, payloadB64] = value.slice(SECRET_ENC_PREFIX.length).split(':')
    const decipher = crypto.createDecipheriv('aes-256-gcm', atRestKey(), Buffer.from(ivB64, 'base64'))
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(payloadB64, 'base64')), decipher.final()]).toString('utf-8')
  } catch {
    // Wrong key (e.g. SESSION_SECRET rotated) — surface an empty secret rather than crashing
    return ''
  }
}

export function hashClientToken(token: string): string {
  return `${TOKEN_HASH_PREFIX}${crypto.createHash('sha256').update(token).digest('hex')}`
}

export function isTokenHashed(token: string): boolean {
  return typeof token === 'string' && token.startsWith(TOKEN_HASH_PREFIX)
}

/** Constant-time string comparison for credential digests. */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

/** Mask encrypted/hash fields before writing the DB file to disk. */
export function sealSensitiveFields(db: HelpdeskDB): HelpdeskDB {
  const clone = JSON.parse(JSON.stringify(db)) as HelpdeskDB
  if (clone.settings?.smtp?.pass && !clone.settings.smtp.pass.startsWith(SECRET_ENC_PREFIX)) {
    clone.settings.smtp.pass = encryptAtRest(clone.settings.smtp.pass)
  }
  if (clone.settings?.telegram?.botToken && !clone.settings.telegram.botToken.startsWith(SECRET_ENC_PREFIX)) {
    clone.settings.telegram.botToken = encryptAtRest(clone.settings.telegram.botToken)
  }
  if (clone.settings?.installation?.installationLockKey && !clone.settings.installation.installationLockKey.startsWith(SECRET_ENC_PREFIX)) {
    clone.settings.installation.installationLockKey = encryptAtRest(clone.settings.installation.installationLockKey)
  }
  if (Array.isArray(clone.users)) {
    for (const u of clone.users) {
      if (u.token && !isTokenHashed(u.token)) u.token = hashClientToken(u.token)
    }
  }
  return clone
}

/** Decrypt sealed fields after reading the DB file (runtime sees plaintext). */
function unsealSensitiveFields(db: HelpdeskDB): HelpdeskDB {
  if (db.settings?.smtp?.pass) db.settings.smtp.pass = decryptAtRest(db.settings.smtp.pass)
  if (db.settings?.telegram?.botToken) db.settings.telegram.botToken = decryptAtRest(db.settings.telegram.botToken)
  if (db.settings?.installation?.installationLockKey) {
    db.settings.installation.installationLockKey = decryptAtRest(db.settings.installation.installationLockKey)
  }
  return db
}

export const DEFAULT_INSTALLATION: InstallationSettings = {
  installed: true,
  installedAt: '2026-09-04T12:00:00.000Z',
  organizationName: 'Ryzen Technologies Enterprise',
  helpdeskName: 'RyzenDesk Support Portal',
  supportEmail: 'support@ryzendesk.internal',
  baseUrl: 'http://localhost:3000',
  defaultLanguage: 'en',
  timezone: 'UTC',
  storageEngine: 'atomic_json_engine',
  seededDemoData: true,
  backupEnabled: true,
  adminCreated: true,
  installationLockKey: '',
  version: '2.4.0',
}

export const DEFAULT_RBAC: Record<StaffRole, RolePermissions> = {
  super_admin: {
    tickets_create: true,
    tickets_view_all: true,
    tickets_reply: true,
    tickets_internal_note: true,
    tickets_edit_status: true,
    tickets_assign: true,
    tickets_escalate: true,
    tickets_delete: true,
    canned_replies_manage: true,
    sla_manage: true,
    kanban_view: true,
    kanban_create_board: true,
    kanban_edit_cards: true,
    kanban_delete_cards: true,
    wiki_view_public: true,
    wiki_view_internal: true,
    wiki_create_edit: true,
    wiki_manage_spaces: true,
    wiki_delete: true,
    admin_manage_staff: true,
    admin_manage_rbac: true,
    admin_view_audit: true,
    admin_webhooks: true,
    admin_smtp: true,
    admin_cloud_sync: true,
    admin_deploy: true,
    analytics_view: true,
  },
  team_lead: {
    tickets_create: true,
    tickets_view_all: true,
    tickets_reply: true,
    tickets_internal_note: true,
    tickets_edit_status: true,
    tickets_assign: true,
    tickets_escalate: true,
    tickets_delete: false,
    canned_replies_manage: true,
    sla_manage: true,
    kanban_view: true,
    kanban_create_board: true,
    kanban_edit_cards: true,
    kanban_delete_cards: true,
    wiki_view_public: true,
    wiki_view_internal: true,
    wiki_create_edit: true,
    wiki_manage_spaces: true,
    wiki_delete: false,
    admin_manage_staff: false,
    admin_manage_rbac: false,
    admin_view_audit: true,
    admin_webhooks: false,
    admin_smtp: false,
    admin_cloud_sync: false,
    admin_deploy: false,
    analytics_view: true,
  },
  agent: {
    tickets_create: true,
    tickets_view_all: true,
    tickets_reply: true,
    tickets_internal_note: true,
    tickets_edit_status: true,
    tickets_assign: false,
    tickets_escalate: false,
    tickets_delete: false,
    canned_replies_manage: false,
    sla_manage: false,
    kanban_view: true,
    kanban_create_board: false,
    kanban_edit_cards: true,
    kanban_delete_cards: false,
    wiki_view_public: true,
    wiki_view_internal: true,
    wiki_create_edit: false,
    wiki_manage_spaces: false,
    wiki_delete: false,
    admin_manage_staff: false,
    admin_manage_rbac: false,
    admin_view_audit: false,
    admin_webhooks: false,
    admin_smtp: false,
    admin_cloud_sync: false,
    admin_deploy: false,
    analytics_view: true,
  },
  viewer: {
    tickets_create: false,
    tickets_view_all: true,
    tickets_reply: false,
    tickets_internal_note: false,
    tickets_edit_status: false,
    tickets_assign: false,
    tickets_escalate: false,
    tickets_delete: false,
    canned_replies_manage: false,
    sla_manage: false,
    kanban_view: true,
    kanban_create_board: false,
    kanban_edit_cards: false,
    kanban_delete_cards: false,
    wiki_view_public: true,
    wiki_view_internal: true,
    wiki_create_edit: false,
    wiki_manage_spaces: false,
    wiki_delete: false,
    admin_manage_staff: false,
    admin_manage_rbac: false,
    admin_view_audit: false,
    admin_webhooks: false,
    admin_smtp: false,
    admin_cloud_sync: false,
    admin_deploy: false,
    analytics_view: true,
  },
  client: {
    tickets_create: true,
    tickets_view_all: false,
    tickets_reply: true,
    tickets_internal_note: false,
    tickets_edit_status: false,
    tickets_assign: false,
    tickets_escalate: false,
    tickets_delete: false,
    canned_replies_manage: false,
    sla_manage: false,
    kanban_view: false,
    kanban_create_board: false,
    kanban_edit_cards: false,
    kanban_delete_cards: false,
    wiki_view_public: true,
    wiki_view_internal: false,
    wiki_create_edit: false,
    wiki_manage_spaces: false,
    wiki_delete: false,
    admin_manage_staff: false,
    admin_manage_rbac: false,
    admin_view_audit: false,
    admin_webhooks: false,
    admin_smtp: false,
    admin_cloud_sync: false,
    admin_deploy: false,
    analytics_view: false,
  },
}

export const DEFAULT_SLA_POLICIES: Record<TicketPriority, SLAPolicy> = {
  urgent: { priority: 'urgent', firstResponseHours: 1, resolutionHours: 4, alertMinutesBefore: 30 },
  high: { priority: 'high', firstResponseHours: 2, resolutionHours: 8, alertMinutesBefore: 60 },
  medium: { priority: 'medium', firstResponseHours: 4, resolutionHours: 24, alertMinutesBefore: 120 },
  low: { priority: 'low', firstResponseHours: 8, resolutionHours: 48, alertMinutesBefore: 240 },
}

export function seedDatabase(): HelpdeskDB {
  const now = new Date()
  const iso = now.toISOString()
  const oneHourAgo = new Date(now.getTime() - 3600_000).toISOString()
  const threeHoursAgo = new Date(now.getTime() - 3 * 3600_000).toISOString()
  const fiveHoursAgo = new Date(now.getTime() - 5 * 3600_000).toISOString()
  const yesterday = new Date(now.getTime() - 24 * 3600_000).toISOString()

  return {
    meta: {
      version: 3,
      updatedAt: iso,
      ticketCounter: 104,
    },
    settings: {
      liveChatEnabled: true,
      installation: { ...DEFAULT_INSTALLATION },
      smtp: {
        host: 'smtp.sendgrid.net',
        port: 587,
        user: 'apikey',
        pass: '',
        from: 'notifications@ryzendesk.internal',
        secure: false,
        enabled: false,
      },
      telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        enabled: true,
      },
      slaPolicies: DEFAULT_SLA_POLICIES,
      rbac: DEFAULT_RBAC,
    },
    users: [
      {
        zaiId: 'usr_sarah',
        fullName: 'Sarah Jenkins',
        email: 'sarah.j@acmecorp.io',
        token: 'zt_acme_83921',
        telegramChatId: null,
        createdAt: yesterday,
        updatedAt: yesterday,
        notes: 'Enterprise Tier Customer - Acme Corp Infrastructure Lead',
      },
      {
        zaiId: 'usr_marcus',
        fullName: 'Marcus Vance',
        email: 'mvance@fintech-global.com',
        token: 'zt_fin_44021',
        telegramChatId: null,
        createdAt: yesterday,
        updatedAt: yesterday,
        notes: 'Requires PCI-DSS compliance verification on all tickets',
      },
    ],
    tickets: [
      {
        id: 'RD-2026-0101',
        zaiId: 'usr_sarah',
        contact: {
          zaiId: 'usr_sarah',
          fullName: 'Sarah Jenkins',
          email: 'sarah.j@acmecorp.io',
          discordId: 'sarah_j#1029',
        },
        subject: 'Production API Gateway intermittent 502 Bad Gateway timeouts',
        type: 'Technical',
        status: 'in_progress',
        priority: 'urgent',
        team: 'Technical',
        assignee: 'roman',
        escalationLevel: 1,
        escalations: [
          {
            id: 'esc_1',
            at: threeHoursAgo,
            from: 'alex',
            toMember: 'roman',
            toTeam: 'Technical',
            reason: 'Level 2 architecture review required for edge envoy ingress',
          },
        ],
        body: 'Starting today at 06:00 UTC, our EU edge instances have been encountering intermittent 502 responses when calling the token verification endpoint. Network packet inspection points to upstream connection resets.',
        reproduction: 'curl -v -H "Authorization: Bearer test_token" https://api.acme.internal/v2/gateway/healthcheck repeats reset error 1 in 10 times.',
        attachments: [
          {
            id: 'att_101',
            name: 'envoy_error_dump.log',
            size: 24576,
            type: 'text/plain',
            dataUrl: 'data:text/plain;base64,W0VSUk9SXSBVcHN0cmVhbSBjb25uZWN0aW9uIGZhaWx1cmUgZm9yIEVVLXdlc3QtMyBlbmRwb2ludDogZXZlbnQgcmVzZXQgYnkgcGVlcg==',
            uploadedAt: threeHoursAgo,
            uploadedBy: 'Sarah Jenkins',
          },
        ],
        messages: [
          {
            id: 'msg_1',
            from: 'staff',
            author: 'alex',
            body: 'Hello Sarah, thank you for reaching out. We have reproduced the timeout on the EU edge pool and are investigating envoy circuit breaker thresholds.',
            visibility: 'public',
            at: twoHoursAgo(now),
          },
          {
            id: 'msg_2',
            from: 'staff',
            author: 'roman',
            body: 'Internal note: checked Prometheus graphs. Connection pool exhaustion on node-c3 cluster during cron backups.',
            visibility: 'internal',
            at: oneHourAgo,
          },
        ],
        sla: {
          responseDueAt: new Date(now.getTime() + 1800_000).toISOString(),
          resolutionDueAt: new Date(now.getTime() + 7200_000).toISOString(),
          firstRespondedAt: twoHoursAgo(now),
          resolvedAt: null,
          isResponseBreached: false,
          isResolutionBreached: false,
          warned: false,
        },
        tags: ['api-gateway', 'envoy', 'edge-timeout', 'p1-incident'],
        createdAt: threeHoursAgo,
        updatedAt: oneHourAgo,
      },
      {
        id: 'RD-2026-0102',
        zaiId: 'usr_marcus',
        contact: {
          zaiId: 'usr_marcus',
          fullName: 'Marcus Vance',
          email: 'mvance@fintech-global.com',
        },
        subject: 'Monthly invoice discrepancy regarding dedicated bandwidth addon',
        type: 'Billing',
        status: 'open',
        priority: 'high',
        team: 'Billing',
        assignee: 'elena',
        escalationLevel: 0,
        escalations: [],
        body: 'Our latest statement RD-INV-8829 shows a charge for 10Gbps unmetered line, but we downgraded to 5Gbps effective the 15th of last month. Please adjust credit note.',
        reproduction: 'See attached invoice PDF reference',
        messages: [],
        sla: {
          responseDueAt: new Date(now.getTime() - 900_000).toISOString(), // breached slightly for demonstration
          resolutionDueAt: new Date(now.getTime() + 14400_000).toISOString(),
          firstRespondedAt: null,
          resolvedAt: null,
          isResponseBreached: true,
          isResolutionBreached: false,
          warned: true,
        },
        tags: ['invoice', 'addon', 'credit-adjustment'],
        createdAt: fiveHoursAgo,
        updatedAt: fiveHoursAgo,
      },
      {
        id: 'RD-2026-0103',
        zaiId: 'usr_sarah',
        contact: {
          zaiId: 'usr_sarah',
          fullName: 'Sarah Jenkins',
          email: 'sarah.j@acmecorp.io',
        },
        subject: 'Request for custom SSL cipher suite configuration on private load balancers',
        type: 'Security',
        status: 'resolved',
        priority: 'medium',
        team: 'Security',
        assignee: 'roman',
        escalationLevel: 0,
        escalations: [],
        body: 'We need to enforce TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384 as mandatory for corporate compliance auditing next week.',
        messages: [
          {
            id: 'msg_3',
            from: 'staff',
            author: 'roman',
            body: 'Hi Sarah, the custom TLS cipher suite policy has been provisioned on your dedicated tenant profile. Verified A+ grade on test SSL Labs scan.',
            visibility: 'public',
            at: oneHourAgo,
          },
        ],
        sla: {
          responseDueAt: new Date(now.getTime() + 7200_000).toISOString(),
          resolutionDueAt: new Date(now.getTime() + 43200_000).toISOString(),
          firstRespondedAt: twoHoursAgo(now),
          resolvedAt: oneHourAgo,
          isResponseBreached: false,
          isResolutionBreached: false,
          warned: false,
        },
        tags: ['ssl', 'security', 'ciphers', 'compliance'],
        createdAt: yesterday,
        updatedAt: oneHourAgo,
      },
    ],
    cannedReplies: [
      {
        id: 'cr_1',
        title: 'Initial Investigation Greeting',
        shortcut: '/investigating',
        category: 'General',
        body: 'Hello {{customer_name}},\n\nThank you for reaching out regarding ticket {{ticket_id}} ("{{ticket_subject}}").\n\nOur engineering team has begun investigating this issue. We will update you with actionable findings within the next update window.\n\nBest regards,\n{{agent_name}}\nRyzenDesk Support Operations',
        tags: ['greeting', 'investigation', 'first-response'],
        createdBy: 'admin',
        updatedAt: yesterday,
      },
      {
        id: 'cr_2',
        title: 'Network Diagnostic Log Request',
        shortcut: '/logs',
        category: 'Technical',
        body: 'Hello {{customer_name}},\n\nTo help isolate the exact packet drop or gateway behavior, could you please provide:\n1. Full traceroute/MTR log towards our edge IP\n2. Request timestamp with matching X-Request-ID response header\n3. Client-side curl verbose output (`curl -vvv`)\n\nYou can attach these files directly to this ticket thread.\n\nThank you,\n{{agent_name}}',
        tags: ['logs', 'diagnostics', 'curl'],
        createdBy: 'roman',
        updatedAt: yesterday,
      },
      {
        id: 'cr_3',
        title: 'Invoice / Billing Adjustment Processed',
        shortcut: '/credit',
        category: 'Billing',
        body: 'Hello {{customer_name}},\n\nWe have reviewed the billing records for ticket {{ticket_id}}. A prorated credit adjustment has been applied to your ledger balance. You will see this reflected on your next statement.\n\nThank you for your patience.\n{{agent_name}}\nBilling Department',
        tags: ['billing', 'invoice', 'credit'],
        createdBy: 'elena',
        updatedAt: yesterday,
      },
      {
        id: 'cr_4',
        title: 'Resolution and Confirmation Notice',
        shortcut: '/resolved',
        category: 'Resolution',
        body: 'Hello {{customer_name}},\n\nThe fix for {{ticket_id}} has been deployed to production and verified by our monitoring systems. Please let us know if everything is running smoothly on your end, or feel free to reply if you need any additional assistance.\n\nBest regards,\n{{agent_name}}',
        tags: ['resolved', 'close', 'success'],
        createdBy: 'admin',
        updatedAt: yesterday,
      },
    ],
    kanbanBoards: [
      {
        id: 'board_ops',
        title: 'Support Operations & Escalations',
        description: 'Triage, escalation tracking, and high-impact incident resolution board',
        color: '#0284c7',
        isFavorite: true,
        createdAt: yesterday,
        updatedAt: iso,
        lists: [
          {
            id: 'list_backlog',
            boardId: 'board_ops',
            title: 'Triage & Inflow',
            order: 0,
            cards: [
              {
                id: 'card_1',
                listId: 'list_backlog',
                title: 'Review firewall rate-limit alerts on UK cluster',
                description: 'Surge in TCP SYN flood attempts detected on port 443. Verify failover drop rules.',
                labels: [{ id: 'lbl_sec', text: 'Security', color: 'red' }],
                assignees: ['roman'],
                dueDate: new Date(now.getTime() + 86400_000).toISOString(),
                completed: false,
                checklists: [
                  {
                    id: 'chk_1',
                    title: 'Mitigation Steps',
                    items: [
                      { id: 'ci_1', text: 'Inspect Cloudflare firewall event logs', done: true },
                      { id: 'ci_2', text: 'Deploy iptables ban rule', done: true },
                      { id: 'ci_3', text: 'Verify upstream transit routing', done: false },
                    ],
                  },
                ],
                attachments: [],
                comments: [
                  { id: 'cm_1', author: 'roman', body: 'Rate limiting rules updated in edge nginx configs.', createdAt: threeHoursAgo },
                ],
                ticketId: 'RD-2026-0101',
                order: 0,
                createdAt: yesterday,
                updatedAt: threeHoursAgo,
              },
            ],
          },
          {
            id: 'list_progress',
            boardId: 'board_ops',
            title: 'In Progress (Active Ops)',
            order: 1,
            cards: [
              {
                id: 'card_2',
                listId: 'list_progress',
                title: 'Deploy Envoy connection pool hotfix to EU-West-3',
                description: 'Scale upstream worker threads and adjust keepalive timeouts from 15s to 60s.',
                labels: [
                  { id: 'lbl_urg', text: 'Urgent', color: 'orange' },
                  { id: 'lbl_inf', text: 'Infra', color: 'blue' },
                ],
                assignees: ['alex', 'roman'],
                dueDate: new Date(now.getTime() + 7200_000).toISOString(),
                completed: false,
                checklists: [
                  {
                    id: 'chk_2',
                    title: 'Deployment Checklist',
                    items: [
                      { id: 'ci_4', text: 'Dry-run configuration in staging cluster', done: true },
                      { id: 'ci_5', text: 'Rolling restart of ingress pods', done: false },
                      { id: 'ci_6', text: 'Run synthetic load test suite', done: false },
                    ],
                  },
                ],
                attachments: [],
                comments: [],
                ticketId: 'RD-2026-0101',
                order: 0,
                createdAt: threeHoursAgo,
                updatedAt: oneHourAgo,
              },
            ],
          },
          {
            id: 'list_review',
            boardId: 'board_ops',
            title: 'Review & Verification',
            order: 2,
            cards: [
              {
                id: 'card_3',
                listId: 'list_review',
                title: 'Audit PCI-DSS 4.0 TLS cipher compliance',
                description: 'Verify all cipher sets comply with strict Q3 financial transaction specs.',
                labels: [{ id: 'lbl_comp', text: 'Compliance', color: 'emerald' }],
                assignees: ['elena'],
                dueDate: new Date(now.getTime() + 172800_000).toISOString(),
                completed: false,
                checklists: [],
                attachments: [],
                comments: [],
                ticketId: 'RD-2026-0103',
                order: 0,
                createdAt: yesterday,
                updatedAt: yesterday,
              },
            ],
          },
          {
            id: 'list_done',
            boardId: 'board_ops',
            title: 'Completed',
            order: 3,
            cards: [
              {
                id: 'card_4',
                listId: 'list_done',
                title: 'Update edge SSL certificate wildcard renewal',
                description: 'Certbot automatic renewal verified across all 14 geographic edge pop servers.',
                labels: [{ id: 'lbl_done', text: 'Verified', color: 'slate' }],
                assignees: ['alex'],
                dueDate: yesterday,
                completed: true,
                checklists: [],
                attachments: [],
                comments: [],
                order: 0,
                createdAt: yesterday,
                updatedAt: yesterday,
              },
            ],
          },
        ],
      },
      {
        id: 'board_sprint',
        title: 'Platform Engineering Sprint 28',
        description: 'Roadmap features: SLA engine, Trello boards, Confluence wiki, i18n & webhooks',
        color: '#7c3aed',
        isFavorite: false,
        createdAt: yesterday,
        updatedAt: iso,
        lists: [
          {
            id: 'list_sprint_todo',
            boardId: 'board_sprint',
            title: 'Sprint Backlog',
            order: 0,
            cards: [
              {
                id: 'card_s1',
                listId: 'list_sprint_todo',
                title: 'Implement Zapier webhook retry backoff',
                description: 'Ensure 3 retry attempts with exponential backoff on HTTP 5xx responses.',
                labels: [{ id: 'lbl_api', text: 'API', color: 'purple' }],
                assignees: ['roman'],
                completed: false,
                checklists: [],
                attachments: [],
                comments: [],
                order: 0,
                createdAt: yesterday,
                updatedAt: yesterday,
              },
            ],
          },
          {
            id: 'list_sprint_done',
            boardId: 'board_sprint',
            title: 'Shipped to Production',
            order: 1,
            cards: [
              {
                id: 'card_s2',
                listId: 'list_sprint_done',
                title: 'Multi-language dictionary support (en, es, fr, de, ja, zh, ru)',
                description: 'Full i18n translation coverage across tickets, wiki, kanban, and analytics.',
                labels: [{ id: 'lbl_i18n', text: 'i18n', color: 'emerald' }],
                assignees: ['admin'],
                completed: true,
                checklists: [],
                attachments: [],
                comments: [],
                order: 0,
                createdAt: yesterday,
                updatedAt: yesterday,
              },
            ],
          },
        ],
      },
    ],
    wikiSpaces: [
      {
        id: 'sp_support',
        key: 'SUP',
        name: 'Support Operations Playbooks',
        description: 'Runbooks, SLA escalations, triage guidelines, and incident response matrices.',
        icon: 'LifeBuoy',
        isPrivate: false,
        createdAt: yesterday,
      },
      {
        id: 'sp_eng',
        key: 'ENG',
        name: 'Infrastructure & Engineering Specs',
        description: 'Architecture blueprints, API specifications, and cloud edge configurations.',
        icon: 'Server',
        isPrivate: false,
        createdAt: yesterday,
      },
      {
        id: 'sp_public',
        key: 'KB',
        name: 'Public Customer Knowledge Base',
        description: 'Self-service guides, FAQs, billing documentation, and setup tutorials.',
        icon: 'BookOpen',
        isPrivate: false,
        createdAt: yesterday,
      },
    ],
    wikiPages: [
      {
        id: 'page_sla_playbook',
        spaceId: 'sp_support',
        parentId: null,
        title: 'SLA Escalation Matrix & Incident Protocol',
        slug: 'sla-escalation-matrix',
        author: 'admin',
        visibility: 'internal',
        helpfulVotes: 14,
        unhelpfulVotes: 0,
        content: `# SLA Escalation Matrix & Incident Protocol

## 1. Overview
RyzenDesk enforces strict automated SLA tracking to ensure maximum customer trust and transparency.

### Priority Thresholds
| Priority | First Response SLA | Resolution SLA | Alert Window |
| :--- | :--- | :--- | :--- |
| **Urgent** | 1 hour | 4 hours | 30 minutes |
| **High** | 2 hours | 8 hours | 1 hour |
| **Medium** | 4 hours | 24 hours | 2 hours |
| **Low** | 8 hours | 48 hours | 4 hours |

> **Crucial Rule:** Any ticket that approaches 75% of its response deadline must be escalated to the On-Call Team Lead immediately.

## 2. Escalation Workflow
1. **Tier 1 (Triage):** Verify customer credentials, reproduce steps, assign appropriate category.
2. **Tier 2 (Investigation):** Review diagnostic attachments, consult related Kanban task cards.
3. **Tier 3 (Super Admin / Security Lead):** Direct code or cluster intervention.

\`\`\`bash
# Diagnostic command for live connection testing
curl -Iv https://api.ryzendesk.internal/healthz
\`\`\`

## 3. Post-Mortem Documentation
All breached tickets automatically log a compliance audit entry. Team leads must publish a brief resolution summary to this wiki.`,
        revisions: [
          {
            id: 'rev_1',
            pageId: 'page_sla_playbook',
            author: 'admin',
            summary: 'Initial SLA policy documentation',
            content: '# SLA Escalation Matrix\nInitial draft for team review.',
            createdAt: yesterday,
          },
          {
            id: 'rev_2',
            pageId: 'page_sla_playbook',
            author: 'admin',
            summary: 'Added concrete response thresholds and diagnostic curl snippet',
            content: `# SLA Escalation Matrix & Incident Protocol\n\n## 1. Overview...`,
            createdAt: oneHourAgo,
          },
        ],
        createdAt: yesterday,
        updatedAt: oneHourAgo,
      },
      {
        id: 'page_kb_first_steps',
        spaceId: 'sp_public',
        parentId: null,
        title: 'Getting Started with Your RyzenDesk Portal',
        slug: 'getting-started-customer-portal',
        author: 'admin',
        visibility: 'public',
        helpfulVotes: 42,
        unhelpfulVotes: 1,
        content: `# Getting Started with Your RyzenDesk Portal

Welcome to RyzenDesk! Our helpdesk platform allows you to submit requests, track resolution progress in real-time, and securely share diagnostics.

## How to Submit a Ticket
1. Click **Submit Ticket** from the navigation bar.
2. Enter your email and project details.
3. Select the appropriate **Category** and **Priority**.
4. Drag and drop any relevant error screenshots or log dumps into the attachments field.
5. Save your generated **Access Token** to check status anytime without passwords!

## Understanding Ticket Statuses
- **Open:** Your ticket has been logged and queued for our engineering team.
- **In Progress:** An engineer is actively analyzing or applying a fix.
- **Waiting on Customer:** We have asked for clarification or diagnostic logs.
- **Resolved:** The requested change has been deployed.

*Need immediate help? Reach out to our 24/7 on-call Telegram bot or emergency hotline.*`,
        revisions: [
          {
            id: 'rev_kb1',
            pageId: 'page_kb_first_steps',
            author: 'admin',
            summary: 'Published initial public customer guide',
            content: `# Getting Started with Your RyzenDesk Portal\n...`,
            createdAt: yesterday,
          },
        ],
        createdAt: yesterday,
        updatedAt: yesterday,
      },
    ],
    staff: [
      {
        username: 'admin',
        displayName: 'Super Administrator',
        role: 'super_admin',
        team: 'Support',
        email: 'admin@ryzendesk.internal',
        suspended: false,
        mustChangePassword: false,
        telegramChatId: 100128931,
        createdAt: yesterday,
      },
      {
        username: 'roman',
        displayName: 'Roman Galaxy',
        role: 'team_lead',
        team: 'Technical',
        email: 'roman@ryzendesk.internal',
        suspended: false,
        mustChangePassword: false,
        telegramChatId: 200481920,
        createdAt: yesterday,
      },
      {
        username: 'alex',
        displayName: 'Alex Rivers',
        role: 'agent',
        team: 'Technical',
        email: 'alex.r@ryzendesk.internal',
        suspended: false,
        mustChangePassword: false,
        telegramChatId: null,
        createdAt: yesterday,
      },
      {
        username: 'elena',
        displayName: 'Elena Rostova',
        role: 'agent',
        team: 'Billing',
        email: 'elena@ryzendesk.internal',
        suspended: false,
        mustChangePassword: false,
        telegramChatId: null,
        createdAt: yesterday,
      },
    ],
    audit: [
      {
        id: 'aud_1',
        at: yesterday,
        actor: 'admin',
        actorRole: 'super_admin',
        action: 'SYSTEM_BOOTSTRAP',
        module: 'system',
        detail: 'RyzenDesk enterprise system initialized with default RBAC and SLA matrices.',
        ip: '127.0.0.1',
      },
      {
        id: 'aud_2',
        at: threeHoursAgo,
        actor: 'alex',
        actorRole: 'agent',
        action: 'TICKET_ESCALATED',
        module: 'tickets',
        entityId: 'RD-2026-0101',
        detail: 'Escalated ticket RD-2026-0101 to Roman (Technical Team) for L2 edge review.',
        ip: '192.168.1.14',
      },
      {
        id: 'aud_3',
        at: twoHoursAgo(now),
        actor: 'roman',
        actorRole: 'team_lead',
        action: 'KANBAN_CARD_MOVED',
        module: 'kanban',
        entityId: 'card_2',
        detail: 'Moved Envoy connection pool card into "In Progress (Active Ops)".',
        ip: '192.168.1.28',
      },
    ],
    webhooks: [
      {
        id: 'wh_zapier_1',
        name: 'Zapier Slack Alert Pipeline',
        targetUrl: 'https://hooks.zapier.com/hooks/catch/192834/rd_tickets',
        secret: 'whsec_99381204812398410293',
        active: true,
        events: ['ticket.created', 'ticket.resolved', 'sla.breached'],
        createdAt: yesterday,
        lastFiredAt: threeHoursAgo,
      },
    ],
    webhookDeliveries: [
      {
        id: 'del_1',
        webhookId: 'wh_zapier_1',
        webhookName: 'Zapier Slack Alert Pipeline',
        event: 'ticket.created',
        payload: '{"ticketId":"RD-2026-0101","subject":"Production API Gateway intermittent 502","priority":"urgent"}',
        statusCode: 200,
        success: true,
        responseSummary: 'OK {"status":"received"}',
        durationMs: 142,
        at: threeHoursAgo,
      },
    ],
    emailLogs: [
      {
        id: 'em_1',
        to: 'sarah.j@acmecorp.io',
        subject: '[RD-2026-0101] Support Ticket Received: Production API Gateway',
        event: 'ticket.created',
        status: 'sent',
        at: threeHoursAgo,
        previewBody: 'Thank you Sarah, your ticket RD-2026-0101 has been received and routed to Technical Team.',
      },
      {
        id: 'em_2',
        to: 'roman@ryzendesk.internal',
        subject: '[ALERT] Ticket RD-2026-0101 Escalated to Technical Team',
        event: 'ticket.escalated',
        status: 'sent',
        at: threeHoursAgo,
        previewBody: 'Alex has escalated ticket RD-2026-0101 to you with reason: Level 2 architecture review.',
      },
    ],
  }
}

function twoHoursAgo(now: Date): string {
  return new Date(now.getTime() - 2 * 3600_000).toISOString()
}

// In-memory reference with automatic local file persistence
let cachedDb: HelpdeskDB | null = null

/**
 * Idempotent schema migration for persisted databases.
 * Guarantees the RBAC matrix contains every documented permission key
 * (filling missing keys from DEFAULT_RBAC) so server-side enforcement
 * never encounters undefined permissions after upgrades.
 */
function migrateDb(db: HelpdeskDB): HelpdeskDB {
  if (!db.settings) db.settings = seedDatabase().settings
  if (!db.settings.installation) db.settings.installation = { ...DEFAULT_INSTALLATION }
  if (!db.settings.rbac) db.settings.rbac = JSON.parse(JSON.stringify(DEFAULT_RBAC))

  for (const role of Object.keys(DEFAULT_RBAC) as StaffRole[]) {
    if (!db.settings.rbac[role]) {
      db.settings.rbac[role] = { ...DEFAULT_RBAC[role] }
      continue
    }
    for (const [perm, value] of Object.entries(DEFAULT_RBAC[role])) {
      if (typeof db.settings.rbac[role][perm as keyof RolePermissions] === 'undefined') {
        db.settings.rbac[role][perm as keyof RolePermissions] = value
      }
    }
  }

  // Normalize legacy plaintext customer tokens to irreversible SHA-256 digests
  if (Array.isArray(db.users)) {
    for (const u of db.users) {
      if (u.token && !isTokenHashed(u.token)) u.token = hashClientToken(u.token)
    }
  }
  return db
}

export function getDb(): HelpdeskDB {
  if (cachedDb) return cachedDb

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8')
      cachedDb = JSON.parse(raw) as HelpdeskDB
      cachedDb = unsealSensitiveFields(cachedDb)
      cachedDb = migrateDb(cachedDb)
      return cachedDb
    }
  } catch (err) {
    console.error('Failed reading DB from disk, creating seed DB:', err)
  }

  cachedDb = migrateDb(seedDatabase())
  saveDb(cachedDb)
  return cachedDb
}

export function saveDb(db: HelpdeskDB): void {
  db.meta.updatedAt = new Date().toISOString()
  cachedDb = db
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(sealSensitiveFields(db), null, 2), 'utf-8')
  } catch (err) {
    console.error('Failed writing DB to disk:', err)
  }
}

export function logAudit(
  actor: string,
  actorRole: string,
  action: string,
  module: AuditEntry['module'],
  detail: string,
  entityId?: string,
  ip?: string
): void {
  const db = getDb()
  const entry: AuditEntry = {
    id: `aud_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    at: new Date().toISOString(),
    actor,
    actorRole,
    action,
    module,
    entityId,
    detail,
    ip: ip || '127.0.0.1',
  }
  db.audit.unshift(entry)
  if (db.audit.length > 500) db.audit.pop()
  saveDb(db)
}
