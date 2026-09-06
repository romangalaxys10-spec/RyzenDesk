export const ISSUE_TYPES = ['Billing', 'Service', 'Technical', 'Pre-sale', 'Abuse', 'Security'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TEAMS = ['Support', 'Billing', 'Technical', 'Security'] as const
export type Team = (typeof TEAMS)[number]

export type StaffRole = 'super_admin' | 'team_lead' | 'agent' | 'viewer' | 'client'

export interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  dataUrl: string
  uploadedAt: string
  uploadedBy: string
}

export interface TicketMessage {
  id: string
  from: 'user' | 'staff' | 'system'
  author: string
  body: string
  visibility: 'public' | 'internal'
  at: string
  attachments?: FileAttachment[]
}

export interface Escalation {
  id: string
  at: string
  from: string
  toMember: string
  toTeam: string
  reason: string
}

export interface TicketSLAMetadata {
  responseDueAt: string
  resolutionDueAt: string
  firstRespondedAt: string | null
  resolvedAt: string | null
  isResponseBreached: boolean
  isResolutionBreached: boolean
  warned: boolean
  /** Set once the SLA monitor has alerted on each breach type (prevents repeat notifications). */
  responseBreachNotified?: boolean
  resolutionBreachNotified?: boolean
}

export interface TicketTimeLog {
  id: string
  ticketId: string
  author: string
  minutes: number
  description: string
  isBillable: boolean
  createdAt: string
}

export interface TicketCSAT {
  rating: number // 1 - 5
  feedback?: string
  submittedAt: string
}

export interface TicketSummaryAI {
  executiveSummary: string
  rootCause: string
  sentiment: 'frustrated' | 'neutral' | 'positive' | 'urgent'
  recommendedAction: string
  generatedAt: string
}

export interface SmartReplyAI {
  title: string
  body: string
  tone: 'professional' | 'empathetic' | 'concise'
}

export interface TicketActivityEvent {
  id: string
  ticketId: string
  type:
    | 'created'
    | 'status_change'
    | 'priority_change'
    | 'assigned'
    | 'escalated'
    | 'reply'
    | 'internal_note'
    | 'tag_added'
    | 'tag_removed'
    | 'linked'
    | 'merged'
    | 'time_logged'
    | 'csat_received'
  actor: string
  actorRole: string
  details: string
  at: string
}

export interface LinkedTicket {
  ticketId: string
  relation: 'relates_to' | 'duplicate_of' | 'blocks' | 'blocked_by'
  linkedAt: string
  linkedBy: string
}

export interface SavedFilterView {
  id: string
  name: string
  isSystem?: boolean
  filters: {
    status?: TicketStatus[]
    priority?: TicketPriority[]
    team?: Team[]
    assignee?: string | null
    tags?: string[]
    unassignedOnly?: boolean
    breachedOnly?: boolean
  }
}

export interface Ticket {
  id: string
  zaiId: string
  contact: {
    zaiId: string
    fullName: string
    email: string
    discordId?: string
  }
  subject: string
  type: IssueType
  status: TicketStatus
  priority: TicketPriority
  team: Team
  assignee: string | null
  escalationLevel: number
  escalations: Escalation[]
  body: string
  reproduction?: string
  attachments?: FileAttachment[]
  messages: TicketMessage[]
  sla: TicketSLAMetadata
  tags?: string[]
  timeLogs?: TicketTimeLog[]
  csat?: TicketCSAT
  aiSummary?: TicketSummaryAI
  sentiment?: 'frustrated' | 'neutral' | 'positive' | 'urgent'
  linkedTickets?: LinkedTicket[]
  mergedInto?: string
  activityLog?: TicketActivityEvent[]
  createdAt: string
  updatedAt: string
}

export interface CannedReply {
  id: string
  title: string
  shortcut: string
  category: string
  body: string
  tags: string[]
  createdBy: string
  updatedAt: string
}

export interface SLAPolicy {
  priority: TicketPriority
  firstResponseHours: number
  resolutionHours: number
  alertMinutesBefore: number
}

export type SLAPolicyConfig = Record<TicketPriority, SLAPolicy>

// Kanban (Trello-like) Types
export interface KanbanLabel {
  id: string
  text: string
  color: string // Tailwind color class or hex
}

export interface KanbanChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface KanbanChecklist {
  id: string
  title: string
  items: KanbanChecklistItem[]
}

export interface KanbanComment {
  id: string
  author: string
  body: string
  createdAt: string
}

export interface KanbanCard {
  id: string
  listId: string
  title: string
  description: string
  labels: KanbanLabel[]
  assignees: string[]
  dueDate?: string
  completed: boolean
  checklists: KanbanChecklist[]
  attachments: FileAttachment[]
  comments: KanbanComment[]
  ticketId?: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface KanbanList {
  id: string
  boardId: string
  title: string
  order: number
  cards: KanbanCard[]
}

export interface KanbanBoard {
  id: string
  title: string
  description: string
  color: string
  isFavorite: boolean
  lists: KanbanList[]
  createdAt: string
  updatedAt: string
}

// Wiki (Confluence-like) Types
export interface WikiRevision {
  id: string
  pageId: string
  author: string
  summary: string
  content: string
  createdAt: string
}

export interface WikiPage {
  id: string
  spaceId: string
  parentId: string | null
  title: string
  slug: string
  content: string
  author: string
  visibility: 'public' | 'internal' | 'restricted'
  helpfulVotes: number
  unhelpfulVotes: number
  revisions: WikiRevision[]
  createdAt: string
  updatedAt: string
}

export interface WikiSpace {
  id: string
  key: string
  name: string
  description: string
  icon: string
  isPrivate: boolean
  createdAt: string
}

// Granular RBAC Permissions
export interface RolePermissions {
  tickets_create: boolean
  tickets_view_all: boolean
  tickets_reply: boolean
  tickets_internal_note: boolean
  tickets_edit_status: boolean
  tickets_assign: boolean
  tickets_escalate: boolean
  tickets_delete: boolean
  canned_replies_manage: boolean
  sla_manage: boolean
  kanban_view: boolean
  kanban_create_board: boolean
  kanban_edit_cards: boolean
  kanban_delete_cards: boolean
  wiki_view_public: boolean
  wiki_view_internal: boolean
  wiki_create_edit: boolean
  wiki_manage_spaces: boolean
  wiki_delete: boolean
  admin_manage_staff: boolean
  admin_manage_rbac: boolean
  admin_view_audit: boolean
  admin_webhooks: boolean
  admin_smtp: boolean
  admin_cloud_sync: boolean
  admin_deploy: boolean
  /** Manage announcements, network status components, downloads & automation rules */
  admin_content: boolean
  analytics_view: boolean
}

/* ==========================================================================
   Content, Automation & Live Chat (WHMCS/Kayako parity)
   ========================================================================== */

export interface Announcement {
  id: string
  title: string
  body: string
  published: boolean
  author: string
  createdAt: string
  updatedAt: string
}

export type ComponentStatus = 'operational' | 'degraded' | 'outage' | 'maintenance'

export interface StatusComponent {
  id: string
  name: string
  status: ComponentStatus
  description?: string
  updatedAt: string
}

export interface DownloadItem {
  id: string
  title: string
  description: string
  url: string
  published: boolean
  createdAt: string
}

export type RuleField = 'subject' | 'body' | 'email' | 'type' | 'priority'
export type RuleOperator = 'contains' | 'equals' | 'starts_with'
export type RuleActionType = 'set_priority' | 'set_team' | 'set_type' | 'add_tag' | 'assign'

export interface SupportRuleCondition {
  field: RuleField
  op: RuleOperator
  value: string
}

export interface SupportRuleAction {
  type: RuleActionType
  value: string
}

export interface SupportRule {
  id: string
  name: string
  enabled: boolean
  match: 'all' | 'any'
  conditions: SupportRuleCondition[]
  actions: SupportRuleAction[]
  runCount: number
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  from: 'client' | 'staff'
  author: string
  body: string
  at: string
}

export interface ChatThread {
  id: string
  clientEmail: string
  clientName: string
  status: 'open' | 'closed'
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
}

export interface CustomerContext {
  email: string
  fullName: string
  tickets: Ticket[]
  totals: {
    count: number
    open: number
    resolved: number
    avgCsat: number | null
    firstSeen: string | null
    lastTicketAt: string | null
  }
  portalUser: { zaiId: string; createdAt: string; hasToken: boolean } | null
}

export interface StaffMember {
  username: string
  displayName: string
  passwordHash?: string
  role: StaffRole
  team: Team
  email: string
  suspended: boolean
  mustChangePassword?: boolean
  telegramChatId: number | null
  createdAt: string
}

export interface HelpdeskUser {
  zaiId: string
  fullName: string
  email: string
  token: string
  telegramChatId: number | null
  createdAt: string
  updatedAt: string
  notes?: string
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  actorRole: string
  action: string
  module: 'tickets' | 'kanban' | 'wiki' | 'staff' | 'rbac' | 'system' | 'webhooks' | 'smtp' | 'chat' | 'content'
  entityId?: string
  detail: string
  ip?: string
}

export type AuditLogEntry = AuditEntry

export interface WebhookConfig {
  id: string
  name: string
  targetUrl: string
  secret: string
  active: boolean
  events: string[]
  createdAt: string
  lastFiredAt?: string
}

export interface WebhookDelivery {
  id: string
  webhookId: string
  webhookName: string
  event: string
  payload: string
  statusCode: number
  success: boolean
  responseSummary: string
  durationMs: number
  at: string
}

export interface SMTPSettings {
  host: string
  port: number
  user: string
  pass: string
  from: string
  secure: boolean
  enabled: boolean
}

export interface EmailNotificationLog {
  id: string
  to: string
  subject: string
  event: string
  status: 'sent' | 'simulated' | 'failed'
  at: string
  previewBody: string
}

export interface TelegramSettings {
  botToken: string
  enabled: boolean
}

export interface SystemPreflightCheck {
  id: string
  name: string
  category: 'runtime' | 'storage' | 'network' | 'services'
  status: 'pass' | 'warning' | 'fail'
  required: boolean
  value: string
  recommendation?: string
}

export interface InstallationPreflightResult {
  passed: boolean
  nodeVersion: string
  platform: string
  arch: string
  memoryMb: {
    heapUsed: number
    heapTotal: number
    rss: number
  }
  uptimeSec: number
  checks: SystemPreflightCheck[]
  timestamp: string
}

export interface InstallationSettings {
  installed: boolean
  installedAt: string | null
  organizationName: string
  helpdeskName: string
  supportEmail: string
  baseUrl: string
  defaultLanguage: string
  timezone: string
  storageEngine: 'atomic_json_engine' | 'cloud_sync_engine'
  seededDemoData: boolean
  backupEnabled: boolean
  adminCreated: boolean
  installationLockKey: string
  version: string
}

export interface InstallationConfig {
  organizationName: string
  helpdeskName: string
  supportEmail: string
  baseUrl: string
  defaultLanguage: string
  timezone: string
  storageEngine: 'atomic_json_engine' | 'cloud_sync_engine'
  seedDemoData: boolean
  backupEnabled: boolean
  admin: {
    username: string
    displayName: string
    email: string
    password?: string
    recoveryToken?: string
  }
  smtp?: SMTPSettings
  telegram?: TelegramSettings
  geminiApiKey?: string
}

export interface SessionUser {
  kind: 'staff' | 'client'
  username: string
  displayName: string
  role: StaffRole
  email: string
  zaiId?: string
  mustChangePassword?: boolean
  /** Live RBAC matrix row for this user's role (returned by /api/auth/me). */
  permissions?: RolePermissions
}

export interface CloudSyncStatus {
  configured: boolean
  repo: string
  branch: string
  path: string
  sha: string | null
  pendingChanges: boolean
  pushing: boolean
  encrypted?: boolean
  isOnline: boolean
  lastSyncAt: string | null
  lastError: string | null
}

export interface HelpdeskDB {
  meta: {
    version: number
    updatedAt: string
    ticketCounter: number
  }
  settings: {
    liveChatEnabled: boolean
    aiTriageEnabled?: boolean
    emailInboundSecret?: string
    installation?: InstallationSettings
    smtp: SMTPSettings
    telegram: TelegramSettings
    slaPolicies: Record<TicketPriority, SLAPolicy>
    rbac: Record<StaffRole, RolePermissions>
  }
  users: HelpdeskUser[]
  tickets: Ticket[]
  cannedReplies: CannedReply[]
  kanbanBoards: KanbanBoard[]
  wikiSpaces: WikiSpace[]
  wikiPages: WikiPage[]
  staff: StaffMember[]
  audit: AuditEntry[]
  webhooks: WebhookConfig[]
  webhookDeliveries: WebhookDelivery[]
  emailLogs: EmailNotificationLog[]
  announcements: Announcement[]
  statusComponents: StatusComponent[]
  downloads: DownloadItem[]
  rules: SupportRule[]
  chats: ChatThread[]
}
