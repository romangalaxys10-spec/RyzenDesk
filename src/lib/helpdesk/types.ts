export const ISSUE_TYPES = ['Billing', 'Service', 'Technical', 'Pre-sale', 'Abuse', 'Security'] as const
export type IssueType = (typeof ISSUE_TYPES)[number]

export const TICKET_STATUSES = ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TEAMS = ['Support', 'Billing', 'Technical', 'Security'] as const
export type Team = (typeof TEAMS)[number]

export type StaffRole = 'super_admin' | 'agent'

export interface TicketMessage {
  id: string
  from: 'user' | 'staff' | 'system'
  author: string
  body: string
  visibility: 'public' | 'internal'
  at: string
}

export interface HelpdeskUser {
  zaiId: string
  fullName: string
  email: string
  discordId: string
  token: string
  telegramChatId: number | null
  createdAt: string
  updatedAt: string
  /** CRM notes editable by super admins */
  notes?: string
}

export interface TicketContact {
  zaiId: string
  fullName: string
  email: string
  discordId: string
}

export interface Escalation {
  id: string
  at: string
  from: string
  toMember: string
  toTeam: string
  reason: string
}

export interface Ticket {
  id: string
  zaiId: string
  contact: TicketContact
  subject: string
  type: IssueType
  status: TicketStatus
  priority: TicketPriority
  team: Team
  assignee: string | null
  escalationLevel: number
  escalations: Escalation[]
  body: string
  reproduction: string
  messages: TicketMessage[]
  createdAt: string
  updatedAt: string
}

export interface StaffMember {
  username: string
  displayName: string
  passwordHash: string
  role: StaffRole
  team: Team
  suspended: boolean
  /** When true the member must set a new password before doing anything else (initial setup). */
  mustChangePassword?: boolean
  telegramChatId: number | null
  createdAt: string
}

export interface AuditEntry {
  at: string
  actor: string
  action: string
  detail: string
}

export interface ChatMessage {
  id: string
  from: 'user' | 'staff' | 'system'
  author: string
  body: string
  at: string
}

export interface ChatSession {
  id: string
  zaiId: string
  userName: string
  status: 'waiting' | 'active' | 'ended'
  staffUsername: string | null
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  endedBy?: string
}

export interface HelpdeskSettings {
  liveChatEnabled: boolean
}

export interface HelpdeskDB {
  meta: {
    version: number
    updatedAt: string
    ticketCounter: number
  }
  settings: HelpdeskSettings
  users: HelpdeskUser[]
  tickets: Ticket[]
  staff: StaffMember[]
  chats: ChatSession[]
  audit: AuditEntry[]
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_customer: 'Waiting on Customer',
  resolved: 'Resolved',
  closed: 'Closed',
}

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}

export const TEAM_LABELS: Record<Team, string> = {
  Support: 'Support Team',
  Billing: 'Billing Team',
  Technical: 'Technical Team',
  Security: 'Security Team',
}

export const TYPE_PRIORITY: Record<IssueType, TicketPriority> = {
  Security: 'urgent',
  Abuse: 'high',
  Technical: 'medium',
  Billing: 'medium',
  Service: 'medium',
  'Pre-sale': 'low',
}

export const TYPE_TEAM: Record<IssueType, Team> = {
  Billing: 'Billing',
  Service: 'Support',
  Technical: 'Technical',
  'Pre-sale': 'Support',
  Abuse: 'Security',
  Security: 'Security',
}

const PRIORITY_ORDER: Record<TicketPriority, number> = { low: 0, medium: 1, high: 2, urgent: 3 }

export function maxPriority(a: TicketPriority, b: TicketPriority): TicketPriority {
  return PRIORITY_ORDER[a] >= PRIORITY_ORDER[b] ? a : b
}
