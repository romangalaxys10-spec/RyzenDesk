import React, { useState } from 'react'
import {
  ShieldCheck,
  Users,
  Mail,
  Webhook as WebhookIcon,
  FileCheck2,
  Clock,
  MessageSquare,
  Github,
  Plus,
  Check,
  Send,
  Download,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Trash2,
  Shield,
  Radio,
  Server,
  Wand2,
  Building2,
  Megaphone,
  Cpu,
} from 'lucide-react'
import { ContentAutomationAdmin } from './ContentAutomationAdmin'
import { AiProvidersAdmin } from './AiProvidersAdmin'
import type {
  StaffMember,
  StaffRole,
  Team,
  RolePermissions,
  SLAPolicyConfig,
  SMTPSettings,
  WebhookConfig,
  WebhookDelivery,
  AuditLogEntry,
  EmailNotificationLog,
  CloudSyncStatus,
  CannedReply,
  InstallationSettings,
} from '../../types'
import { useI18n } from '../../i18n/translations'

interface AdminConsoleProps {
  staffList: StaffMember[]
  onAddStaff: (staff: Partial<StaffMember>) => void
  onUpdateStaff: (username: string, updates: Partial<StaffMember>) => void
  rbac: Record<StaffRole, RolePermissions>
  onSaveRbac: (rbac: Record<StaffRole, RolePermissions>) => void
  slaPolicies: SLAPolicyConfig
  onSaveSla: (sla: SLAPolicyConfig) => void
  smtp: SMTPSettings
  onSaveSmtp: (smtp: SMTPSettings) => void
  onTestSmtp: (email: string) => Promise<{ success: boolean; log?: EmailNotificationLog }>
  emailLogs: EmailNotificationLog[]
  webhooks: WebhookConfig[]
  webhookDeliveries: WebhookDelivery[]
  onAddWebhook: (wh: Partial<WebhookConfig>) => void
  onDeleteWebhook: (id: string) => void
  onTestWebhook: (id: string) => Promise<any>
  auditLogs: AuditLogEntry[]
  syncStatus: CloudSyncStatus
  onPushRemote: () => Promise<any>
  onPullRemote: () => Promise<any>
  cannedReplies: CannedReply[]
  onCreateCannedReply: (reply: Partial<CannedReply>) => void
  onDeleteCannedReply: (id: string) => void
  installationSettings?: InstallationSettings
  onOpenInstallWizard?: () => void
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  staffList,
  onAddStaff,
  onUpdateStaff,
  rbac,
  onSaveRbac,
  slaPolicies,
  onSaveSla,
  smtp,
  onSaveSmtp,
  onTestSmtp,
  emailLogs,
  webhooks,
  webhookDeliveries,
  onAddWebhook,
  onDeleteWebhook,
  onTestWebhook,
  auditLogs,
  syncStatus,
  onPushRemote,
  onPullRemote,
  cannedReplies,
  onCreateCannedReply,
  onDeleteCannedReply,
  installationSettings,
  onOpenInstallWizard,
}) => {
  const { t } = useI18n()
  const [activeTab, setActiveTab] = useState<
    'rbac' | 'staff' | 'canned' | 'sla' | 'smtp' | 'webhooks' | 'audit' | 'github' | 'installer' | 'content' | 'ai'
  >('rbac')

  // RBAC Matrix local state
  const [localRbac, setLocalRbac] = useState<Record<StaffRole, RolePermissions>>(rbac)
  const [rbacSaved, setRbacSaved] = useState(false)

  // Staff Modal state
  const [newStaffModal, setNewStaffModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [newStaffRole, setNewStaffRole] = useState<StaffRole>('agent')
  const [newStaffTeam, setNewStaffTeam] = useState<Team>('Support')
  const [newStaffEmail, setNewStaffEmail] = useState('')

  // SMTP Settings form
  const [smtpForm, setSmtpForm] = useState<SMTPSettings>(smtp)
  const [testEmailAddr, setTestEmailAddr] = useState('lead@ryzendesk.internal')
  const [testEmailStatus, setTestEmailStatus] = useState<string | null>(null)
  const [smtpSaved, setSmtpSaved] = useState(false)

  // Webhook Form
  const [newWhModal, setNewWhModal] = useState(false)
  const [newWhName, setNewWhName] = useState('')
  const [newWhUrl, setNewWhUrl] = useState('')
  const [newWhEvents, setNewWhEvents] = useState<string[]>(['ticket.created', 'ticket.resolved'])
  const [testingWhId, setTestingWhId] = useState<string | null>(null)

  // SLA Form
  const [slaForm, setSlaForm] = useState<SLAPolicyConfig>(slaPolicies)
  const [slaSaved, setSlaSaved] = useState(false)

  // Canned Reply Form
  const [newCannedModal, setNewCannedModal] = useState(false)
  const [cannedTitle, setCannedTitle] = useState('')
  const [cannedShortcut, setCannedShortcut] = useState('')
  const [cannedCat, setCannedCat] = useState('General')
  const [cannedBody, setCannedBody] = useState('')

  // Audit filter
  const [auditModuleFilter, setAuditModuleFilter] = useState('')
  const [auditActorFilter, setAuditActorFilter] = useState('')

  // Deploy Codebase state
  const [deployingCodebase, setDeployingCodebase] = useState(false)
  const [deployOutput, setDeployOutput] = useState<{ success: boolean; message: string } | null>(null)

  // Installer tab state
  const [preflightData, setPreflightData] = useState<any>(null)
  const [loadingPreflight, setLoadingPreflight] = useState(false)
  const [resettingInstall, setResettingInstall] = useState(false)
  const [resetMessage, setResetMessage] = useState<string | null>(null)

  const handleRunDiagnostics = async () => {
    setLoadingPreflight(true)
    try {
      const res = await fetch('/api/install/preflight')
      const data = await res.json()
      setPreflightData(data)
    } catch (e: any) {
      setPreflightData({ passed: false, error: e.message })
    } finally {
      setLoadingPreflight(false)
    }
  }

  const handleResetInstallation = async () => {
    if (!window.confirm('Are you sure you want to reset the installation state? This will reactivate the initial setup wizard on the next reload.')) {
      return
    }
    setResettingInstall(true)
    try {
      const res = await fetch('/api/install/reset', { method: 'POST' })
      const data = await res.json()
      setResetMessage(data.message || 'Installation reset successfully.')
      if (onOpenInstallWizard) {
        setTimeout(() => {
          onOpenInstallWizard()
        }, 800)
      }
    } catch (e: any) {
      setResetMessage(`Reset error: ${e.message}`)
    } finally {
      setResettingInstall(false)
    }
  }

  const handleDeployCodebase = async () => {
    setDeployingCodebase(true)
    setDeployOutput(null)
    try {
      const res = await fetch('/api/admin/deploy-codebase', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setDeployOutput({
          success: true,
          message: 'All codebase updates successfully committed and pushed to GitHub repository!',
        })
      } else {
        setDeployOutput({
          success: false,
          message: data.error || 'Deployment failed to complete.',
        })
      }
    } catch (err: any) {
      setDeployOutput({
        success: false,
        message: err.message || 'Network error during deployment.',
      })
    } finally {
      setDeployingCodebase(false)
    }
  }

  const handleRbacToggle = (role: StaffRole, permKey: keyof RolePermissions) => {
    setLocalRbac((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permKey]: !prev[role][permKey],
      },
    }))
  }

  const handleSaveRbacMatrix = () => {
    onSaveRbac(localRbac)
    setRbacSaved(true)
    setTimeout(() => setRbacSaved(false), 2500)
  }

  const handleSaveSmtpSettings = (e: React.FormEvent) => {
    e.preventDefault()
    onSaveSmtp(smtpForm)
    setSmtpSaved(true)
    setTimeout(() => setSmtpSaved(false), 2500)
  }

  const handleRunSmtpTest = async () => {
    setTestEmailStatus('Dispatching verification email...')
    try {
      const res = await onTestSmtp(testEmailAddr)
      if (res.success) {
        setTestEmailStatus('✅ Notification delivered successfully!')
      } else {
        setTestEmailStatus('⚠️ Notification logged in simulated mode.')
      }
    } catch (err) {
      setTestEmailStatus(`❌ Delivery failed: ${String(err)}`)
    }
  }

  const rbacKeys: Array<{ key: keyof RolePermissions; label: string }> = [
    { key: 'tickets_create', label: 'Create Tickets' },
    { key: 'tickets_view_all', label: 'View All Tickets' },
    { key: 'tickets_reply', label: 'Post Public Ticket Replies' },
    { key: 'tickets_internal_note', label: 'Post Internal Staff Notes' },
    { key: 'tickets_edit_status', label: 'Update Ticket Status & Priority' },
    { key: 'tickets_assign', label: 'Reassign Tickets' },
    { key: 'tickets_escalate', label: 'Escalate Tickets' },
    { key: 'tickets_delete', label: 'Delete Tickets' },
    { key: 'canned_replies_manage', label: 'Manage Canned Replies' },
    { key: 'sla_manage', label: 'Modify SLA Policies' },
    { key: 'kanban_view', label: 'View Kanban Boards' },
    { key: 'kanban_create_board', label: 'Create Kanban Boards' },
    { key: 'kanban_edit_cards', label: 'Edit & Move Kanban Cards' },
    { key: 'kanban_delete_cards', label: 'Delete Kanban Cards' },
    { key: 'wiki_view_public', label: 'View Public Knowledge Base' },
    { key: 'wiki_view_internal', label: 'View Internal Documentation' },
    { key: 'wiki_create_edit', label: 'Create & Edit Wiki Pages' },
    { key: 'wiki_manage_spaces', label: 'Create & Manage Wiki Spaces' },
    { key: 'wiki_delete', label: 'Delete Wiki Pages' },
    { key: 'admin_manage_staff', label: 'Manage Staff Roster' },
    { key: 'admin_manage_rbac', label: 'Configure RBAC Matrix' },
    { key: 'admin_view_audit', label: 'View Audit Logs' },
    { key: 'admin_webhooks', label: 'Configure Webhooks & Zapier' },
    { key: 'admin_smtp', label: 'Configure SMTP Email Delivery' },
    { key: 'admin_cloud_sync', label: 'Trigger GitHub Cloud Sync' },
    { key: 'admin_content', label: 'Manage Content & Automation Rules' },
    { key: 'analytics_view', label: 'View Real-Time Analytics' },
  ]

  const roles: StaffRole[] = ['super_admin', 'team_lead', 'agent', 'viewer', 'client']

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-400 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">Enterprise Administration Console</h1>
            <p className="text-xs text-slate-400">
              Manage RBAC security rules, SMTP email triggers, Webhooks, SLA timers, and compliance audit logs.
            </p>
          </div>
        </div>

        {/* Cloud Sync Status Indicator */}
        <div className="flex items-center space-x-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
          <Github className="w-4 h-4 text-sky-400" />
          <span>Sync: {syncStatus.repo}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center space-x-1 overflow-x-auto pb-1 border-b border-slate-200">
        {[
          { id: 'rbac', label: 'Granular RBAC', icon: Shield },
          { id: 'staff', label: 'Staff Roster', icon: Users },
          { id: 'canned', label: 'Canned Replies', icon: MessageSquare },
          { id: 'sla', label: 'SLA Policies', icon: Clock },
          { id: 'smtp', label: 'Email & SMTP', icon: Mail },
          { id: 'webhooks', label: 'Webhooks & Zapier', icon: WebhookIcon },
          { id: 'audit', label: 'Audit Logs', icon: FileCheck2 },
          { id: 'content', label: 'Content & Automation', icon: Megaphone },
          { id: 'ai', label: 'AI Providers', icon: Cpu },
          { id: 'github', label: 'Cloud Sync', icon: Github },
          { id: 'installer', label: 'Server Setup Wizard', icon: Server },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-white text-indigo-700 border-t-2 border-indigo-600 border-x border-slate-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* TAB CONTENT */}

      {/* 1. GRANULAR RBAC SETTINGS */}
      {activeTab === 'rbac' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Enterprise Role-Based Access Control (RBAC)</h3>
              <p className="text-xs text-slate-500">
                Grant or restrict fine-grained operational permissions per role across all system modules.
              </p>
            </div>
            <button
              onClick={handleSaveRbacMatrix}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
            >
              {rbacSaved ? <Check className="w-4 h-4 text-emerald-300" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{rbacSaved ? 'Matrix Saved!' : 'Save RBAC Permissions'}</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-[10px]">Permission</th>
                  {roles.map((r) => (
                    <th key={r} className="py-2.5 px-3 text-center capitalize font-bold">
                      {r.replace('_', ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rbacKeys.map((item) => (
                  <tr key={item.key} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{item.label}</td>
                    {roles.map((r) => {
                      const enabled = localRbac[r]?.[item.key]
                      return (
                        <td key={r} className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={Boolean(enabled)}
                            onChange={() => handleRbacToggle(r, item.key)}
                            disabled={r === 'super_admin' && item.key === 'admin_manage_rbac'}
                            className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. STAFF ROSTER */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Staff & Agent Roster</h3>
              <p className="text-xs text-slate-500">Configure team assignments, roles, and status.</p>
            </div>
            <button
              onClick={() => setNewStaffModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staff</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Display Name</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Team</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Telegram Chat ID</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffList.map((s) => (
                  <tr key={s.username} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">@{s.username}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">{s.displayName}</td>
                    <td className="py-2.5 px-3">
                      <select
                        value={s.role}
                        onChange={(e) => onUpdateStaff(s.username, { role: e.target.value as StaffRole })}
                        className="p-1 border rounded text-xs bg-white"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={s.team}
                        onChange={(e) => onUpdateStaff(s.username, { team: e.target.value as Team })}
                        className="p-1 border rounded text-xs bg-white"
                      >
                        <option value="Technical">Technical</option>
                        <option value="Support">Support</option>
                        <option value="Billing">Billing</option>
                        <option value="Security">Security</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{s.email}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">
                      {s.telegramChatId ? s.telegramChatId : 'None'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => onUpdateStaff(s.username, { suspended: !s.suspended })}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          s.suspended
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                      >
                        {s.suspended ? 'Suspended' : 'Active'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CANNED REPLIES */}
      {activeTab === 'canned' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Canned Reply Templates</h3>
              <p className="text-xs text-slate-500">
                Pre-defined responses for instant insertion via shortcuts (e.g. /investigating).
              </p>
            </div>
            <button
              onClick={() => setNewCannedModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Template</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cannedReplies.map((c) => (
              <div key={c.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-slate-800 text-xs">{c.title}</span>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <span className="font-mono text-[11px] font-bold text-sky-700 bg-sky-100 px-1.5 rounded">
                        {c.shortcut}
                      </span>
                      <span className="text-[10px] text-slate-400">{c.category}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteCannedReply(c.id)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="p-2 bg-white rounded border border-slate-200 text-xs font-mono text-slate-700 max-h-24 overflow-y-auto whitespace-pre-wrap">
                  {c.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. SLA POLICIES */}
      {activeTab === 'sla' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Service Level Agreement (SLA) Targets</h3>
              <p className="text-xs text-slate-500">
                Configure required first-response and resolution target thresholds in hours.
              </p>
            </div>
            <button
              onClick={() => {
                onSaveSla(slaForm)
                setSlaSaved(true)
                setTimeout(() => setSlaSaved(false), 2500)
              }}
              className="flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
            >
              {slaSaved ? <Check className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              <span>{slaSaved ? 'Policies Saved!' : 'Save SLA Targets'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            {(['urgent', 'high', 'medium', 'low'] as const).map((p) => {
              const pol = slaForm[p]
              return (
                <div key={p} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <span className="font-bold uppercase tracking-wider text-slate-700 block text-xs">
                    {p} Priority
                  </span>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">
                      First Response (Hours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={pol.firstResponseHours}
                      onChange={(e) =>
                        setSlaForm({
                          ...slaForm,
                          [p]: { ...pol, firstResponseHours: parseFloat(e.target.value) || 1 },
                        })
                      }
                      className="w-full p-2 border rounded-md bg-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">
                      Resolution Target (Hours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={pol.resolutionHours}
                      onChange={(e) =>
                        setSlaForm({
                          ...slaForm,
                          [p]: { ...pol, resolutionHours: parseFloat(e.target.value) || 1 },
                        })
                      }
                      className="w-full p-2 border rounded-md bg-white font-mono"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 5. SMTP & EMAIL NOTIFICATIONS */}
      {activeTab === 'smtp' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">SMTP Email Dispatch Configuration</h3>
                <p className="text-xs text-slate-500">
                  Sends customer receipts, staff reply alerts, and SLA breach warnings via SMTP alongside Telegram.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    smtpForm.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {smtpForm.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveSmtpSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">SMTP Host</label>
                <input
                  type="text"
                  placeholder="smtp.mailgun.org or smtp.sendgrid.net"
                  value={smtpForm.host}
                  onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">SMTP Port</label>
                <input
                  type="number"
                  placeholder="587"
                  value={smtpForm.port}
                  onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value) || 587 })}
                  className="w-full p-2 border rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">SMTP Username</label>
                <input
                  type="text"
                  placeholder="postmaster@ryzendesk.internal"
                  value={smtpForm.user}
                  onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">From Address</label>
                <input
                  type="text"
                  placeholder="RyzenDesk Support <support@ryzendesk.internal>"
                  value={smtpForm.fromAddress}
                  onChange={(e) => setSmtpForm({ ...smtpForm, fromAddress: e.target.value })}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div className="sm:col-span-2 flex items-center justify-between pt-2 border-t border-slate-100">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpForm.enabled}
                    onChange={(e) => setSmtpForm({ ...smtpForm, enabled: e.target.checked })}
                    className="w-4 h-4 text-sky-600 rounded"
                  />
                  <span className="font-semibold text-slate-700">Enable SMTP Notification Delivery</span>
                </label>

                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold shadow-xs"
                >
                  {smtpSaved ? 'Saved!' : 'Save Configuration'}
                </button>
              </div>
            </form>

            {/* Test Email Dispatch Tester */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block">
                Test Email Dispatcher
              </span>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  placeholder="Recipient email address..."
                  value={testEmailAddr}
                  onChange={(e) => setTestEmailAddr(e.target.value)}
                  className="flex-1 p-2 text-xs border rounded-lg bg-white"
                />
                <button
                  type="button"
                  onClick={handleRunSmtpTest}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Email</span>
                </button>
              </div>
              {testEmailStatus && (
                <div className="text-xs font-medium text-slate-700 bg-white p-2 rounded border">
                  {testEmailStatus}
                </div>
              )}
            </div>
          </div>

          {/* Email Notification Logs Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 font-bold text-xs text-slate-700">
              Recent Email Notification Dispatch Logs ({emailLogs.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Recipient</th>
                    <th className="py-2 px-3">Event</th>
                    <th className="py-2 px-3">Subject</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {emailLogs.slice(0, 15).map((em) => (
                    <tr key={em.id}>
                      <td className="py-2 px-3 text-slate-400">{new Date(em.at).toLocaleTimeString()}</td>
                      <td className="py-2 px-3 font-mono font-medium text-slate-800">{em.to}</td>
                      <td className="py-2 px-3">
                        <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {em.event}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700 truncate max-w-xs">{em.subject}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                          {em.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. WEBHOOKS & ZAPIER */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Webhook & Zapier Integrations</h3>
                <p className="text-xs text-slate-500">
                  Broadcast real-time HMAC-signed events to Zapier, Slack, or custom automation endpoints.
                </p>
              </div>
              <button
                onClick={() => setNewWhModal(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Webhook</span>
              </button>
            </div>

            <div className="space-y-3">
              {webhooks.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">No active webhooks configured.</div>
              ) : (
                webhooks.map((wh) => (
                  <div
                    key={wh.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-xs">{wh.name}</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.2 rounded">
                          ACTIVE
                        </span>
                      </div>
                      <div className="font-mono text-xs text-slate-600 truncate max-w-md">{wh.targetUrl}</div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {wh.events.map((ev) => (
                          <span
                            key={ev}
                            className="text-[10px] font-mono bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={async () => {
                          setTestingWhId(wh.id)
                          await onTestWebhook(wh.id)
                          setTestingWhId(null)
                        }}
                        disabled={testingWhId === wh.id}
                        className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 flex items-center space-x-1"
                      >
                        <Radio className="w-3 h-3 text-sky-600" />
                        <span>{testingWhId === wh.id ? 'Pinging...' : 'Send Test Ping'}</span>
                      </button>
                      <button
                        onClick={() => onDeleteWebhook(wh.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Webhook Delivery Logs */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50 font-bold text-xs text-slate-700">
              Recent Webhook Deliveries ({webhookDeliveries.length})
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3">Webhook</th>
                    <th className="py-2 px-3">Event</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Latency</th>
                    <th className="py-2 px-3 text-right">Response</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {webhookDeliveries.slice(0, 15).map((del) => (
                    <tr key={del.id}>
                      <td className="py-2 px-3 text-slate-400">{new Date(del.at).toLocaleTimeString()}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{del.webhookName}</td>
                      <td className="py-2 px-3 font-mono text-[10px] text-sky-700">{del.event}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            del.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {del.statusCode}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-500">{del.durationMs}ms</td>
                      <td className="py-2 px-3 text-right text-slate-600 truncate max-w-xs">
                        {del.responseSummary}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. COMPLIANCE AUDIT LOGS */}
      {activeTab === 'content' && <ContentAutomationAdmin />}

      {activeTab === 'ai' && <AiProvidersAdmin />}

      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Compliance & Security Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Immutable record of all administrative, staff, and customer mutations.
              </p>
            </div>
            <a
              href="/api/admin/audit/export"
              target="_blank"
              rel="noreferrer"
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit CSV</span>
            </a>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <input
              type="text"
              placeholder="Filter by Actor username..."
              value={auditActorFilter}
              onChange={(e) => setAuditActorFilter(e.target.value)}
              className="p-1.5 border rounded-lg bg-slate-50"
            />
            <select
              value={auditModuleFilter}
              onChange={(e) => setAuditModuleFilter(e.target.value)}
              className="p-1.5 border rounded-lg bg-white"
            >
              <option value="">All Modules</option>
              <option value="tickets">Tickets</option>
              <option value="kanban">Kanban</option>
              <option value="wiki">Wiki</option>
              <option value="staff">Staff</option>
              <option value="rbac">RBAC</option>
              <option value="smtp">SMTP</option>
              <option value="webhooks">Webhooks</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Actor</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Module</th>
                  <th className="py-2.5 px-3">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs
                  .filter((l) => (!auditModuleFilter || l.module === auditModuleFilter) &&
                    (!auditActorFilter || l.actor.toLowerCase().includes(auditActorFilter.toLowerCase())))
                  .slice(0, 50)
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.at).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{log.actor}</td>
                      <td className="py-2 px-3 text-slate-500 capitalize">{log.actorRole}</td>
                      <td className="py-2 px-3 font-mono text-[11px] font-bold text-sky-800">{log.action}</td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-mono">
                          {log.module}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-700">{log.detail}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. CLOUD SYNC */}
      {activeTab === 'github' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
          <div className="border-b pb-3 border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">GitHub Cloud Synchronization Engine</h3>
            <p className="text-xs text-slate-500">
              Synchronizes local file database with the specified private repository.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                Repository Target
              </span>
              <div className="flex items-center space-x-2">
                <Github className="w-5 h-5 text-slate-800" />
                <span className="font-mono font-bold text-slate-900">{syncStatus.repo}</span>
              </div>
              <div className="text-slate-500">Branch: <strong className="font-mono">{syncStatus.branch}</strong></div>
              <div className="text-slate-500">Path: <strong className="font-mono">{syncStatus.path}</strong></div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                Sync Engine Status
              </span>
              <div className="text-slate-600">
                Last Synced: <strong>{new Date(syncStatus.lastSyncAt).toLocaleString()}</strong>
              </div>
              <div className="text-slate-600">
                Commit SHA: <strong className="font-mono text-sky-700">{syncStatus.sha?.slice(0, 8) || 'Initial'}</strong>
              </div>
              {syncStatus.lastError && (
                <div className="text-rose-600 font-medium">Notice: {syncStatus.lastError}</div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <button
              onClick={onPushRemote}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Push Data to GitHub</span>
            </button>
            <button
              onClick={onPullRemote}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Pull Data from GitHub</span>
            </button>
          </div>

          {/* Full Codebase Deployment Section */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                  <Github className="w-4 h-4 text-slate-700" />
                  <span>Full Codebase GitHub Deployment</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stages all updated files, generates a clean commit, and pushes all application code to the remote repository.
                </p>
              </div>
              <button
                onClick={handleDeployCodebase}
                disabled={deployingCodebase}
                className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-2 text-white shadow-2xs transition-colors cursor-pointer ${
                  deployingCodebase
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${deployingCodebase ? 'animate-spin' : ''}`} />
                <span>{deployingCodebase ? 'Pushing Code to GitHub...' : 'Deploy Updates to GitHub'}</span>
              </button>
            </div>

            {deployOutput && (
              <div
                className={`p-3 rounded-lg text-xs font-medium border mt-3 ${
                  deployOutput.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {deployOutput.message}
              </div>
            )}

            <div className="mt-3 p-3 bg-slate-900 rounded-lg text-slate-200 font-mono text-[11px] space-y-1">
              <div className="text-slate-400 text-[10px] uppercase font-sans font-bold tracking-wider">Terminal CLI Commands:</div>
              <div className="text-emerald-400"># Push all code updates via npm script:</div>
              <div>$ npm run deploy</div>
              <div className="text-slate-400 mt-1"># Or execute the bash deployment script:</div>
              <div>$ ./scripts/deploy.sh</div>
            </div>
          </div>
        </div>
      )}

      {/* 9. SERVER SETUP WIZARD & DEPLOYMENT PANEL */}
      {activeTab === 'installer' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-6">
          {/* Header section with status banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Server Setup Wizard & Deployment Center</h3>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {installationSettings?.installed ? 'SYSTEM INSTALLED & LOCKED' : 'SETUP PENDING'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Manage host environment parameters, inspect pre-flight diagnostics, or relaunch the self-hosted setup wizard.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunDiagnostics}
                disabled={loadingPreflight}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPreflight ? 'animate-spin text-indigo-600' : ''}`} />
                <span>Run Diagnostics</span>
              </button>

              <button
                onClick={onOpenInstallWizard}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <Wand2 className="w-4 h-4" />
                <span>Launch Setup Wizard</span>
              </button>
            </div>
          </div>

          {resetMessage && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{resetMessage}</span>
            </div>
          )}

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Organization</span>
              <span className="font-bold text-sm text-slate-900 mt-1 block truncate">
                {installationSettings?.organizationName || 'Ryzen Technologies'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block truncate">
                {installationSettings?.helpdeskName || 'RyzenDesk Support'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Storage Engine</span>
              <span className="font-bold text-sm text-indigo-700 font-mono mt-1 block">
                {installationSettings?.storageEngine === 'atomic_json_engine'
                  ? 'Atomic JSON Engine'
                  : 'Cloud Git Mirror'}
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold mt-0.5 block">
                ACID Disk Persistence Active
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Installed Timestamp</span>
              <span className="font-bold text-sm text-slate-800 mt-1 block">
                {installationSettings?.installedAt
                  ? new Date(installationSettings.installedAt).toLocaleDateString()
                  : 'Pre-configured'}
              </span>
              <span className="text-[11px] text-slate-500 mt-0.5 block font-mono">
                Version {installationSettings?.version || '2.3.0'}
              </span>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Master Lock Key</span>
              <span className="font-mono text-xs text-slate-700 font-bold mt-1 block truncate">
                {installationSettings?.installationLockKey || 'rd_lock_verified'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Cryptographic security lock active
              </span>
            </div>
          </div>

          {/* Real-time Diagnostics Output */}
          {preflightData && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Real-time Environment Probe Results ({preflightData.platform || 'Linux'})</span>
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                    preflightData.passed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {preflightData.passed ? 'Passed All Critical Checks' : 'Review Warnings'}
                </span>
              </div>

              {preflightData.checks && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {preflightData.checks.map((c: any) => (
                    <div key={c.id} className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-800 block">{c.name}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{c.value}</span>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          c.status === 'pass'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Re-run and Maintenance Controls */}
          <div className="p-4 border border-slate-200 rounded-xl space-y-3">
            <h4 className="font-bold text-xs text-slate-800">Server Administration & Maintenance Options</h4>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={onOpenInstallWizard}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Re-run Configuration Wizard</span>
              </button>

              <button
                onClick={handleResetInstallation}
                disabled={resettingInstall}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold border border-rose-200 transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{resettingInstall ? 'Resetting...' : 'Reset Installation State'}</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Re-running the configuration wizard allows you to update your organization profile, primary support address, or switch between evaluation demo data and clean production mode without modifying config files directly.
            </p>
          </div>
        </div>
      )}

      {/* Add Staff Modal */}
      {newStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <Users className="w-5 h-5 text-sky-600" />
              <span>Add Staff Member</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. sarah"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Role</label>
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value as StaffRole)}
                  className="w-full p-2 border rounded-md bg-white"
                >
                  <option value="agent">Agent</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Team</label>
                <select
                  value={newStaffTeam}
                  onChange={(e) => setNewStaffTeam(e.target.value as Team)}
                  className="w-full p-2 border rounded-md bg-white"
                >
                  <option value="Support">Support</option>
                  <option value="Technical">Technical</option>
                  <option value="Billing">Billing</option>
                  <option value="Security">Security</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  placeholder="sarah@ryzendesk.internal"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setNewStaffModal(false)}
                className="px-3 py-1.5 border rounded-md text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newUsername.trim() || !newDisplayName.trim()) return
                  onAddStaff({
                    username: newUsername.trim(),
                    displayName: newDisplayName.trim(),
                    role: newStaffRole,
                    team: newStaffTeam,
                    email: newStaffEmail.trim(),
                  })
                  setNewStaffModal(false)
                  setNewUsername('')
                  setNewDisplayName('')
                  setNewStaffEmail('')
                }}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-semibold"
              >
                Save Staff
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Webhook Modal */}
      {newWhModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <WebhookIcon className="w-5 h-5 text-sky-600" />
              <span>Configure Webhook Endpoint</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Webhook Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Zapier Ticket Sync"
                  value={newWhName}
                  onChange={(e) => setNewWhName(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Payload URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  value={newWhUrl}
                  onChange={(e) => setNewWhUrl(e.target.value)}
                  className="w-full p-2 border rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Subscribed Events</label>
                <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg border">
                  {[
                    'ticket.created',
                    'ticket.resolved',
                    'ticket.escalated',
                    'sla.breached',
                    'kanban.card_moved',
                    'wiki.page_created',
                  ].map((ev) => (
                    <label key={ev} className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newWhEvents.includes(ev)}
                        onChange={(e) => {
                          if (e.target.checked) setNewWhEvents([...newWhEvents, ev])
                          else setNewWhEvents(newWhEvents.filter((x) => x !== ev))
                        }}
                        className="rounded text-sky-600"
                      />
                      <span className="font-mono text-[10px]">{ev}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setNewWhModal(false)}
                className="px-3 py-1.5 border rounded-md text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newWhName.trim() || !newWhUrl.trim()) return
                  onAddWebhook({
                    name: newWhName.trim(),
                    targetUrl: newWhUrl.trim(),
                    events: newWhEvents,
                  })
                  setNewWhModal(false)
                  setNewWhName('')
                  setNewWhUrl('')
                }}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-semibold"
              >
                Save Webhook
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Canned Reply Modal */}
      {newCannedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-sky-600" />
              <span>Create Canned Reply Template</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Investigation in Progress"
                  value={cannedTitle}
                  onChange={(e) => setCannedTitle(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Shortcut (e.g. /logs)</label>
                <input
                  type="text"
                  required
                  placeholder="/investigating"
                  value={cannedShortcut}
                  onChange={(e) => setCannedShortcut(e.target.value)}
                  className="w-full p-2 border rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  placeholder="Technical, Billing, General..."
                  value={cannedCat}
                  onChange={(e) => setCannedCat(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Body Text</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Hi {{customer_name}}, thank you for contacting us..."
                  value={cannedBody}
                  onChange={(e) => setCannedBody(e.target.value)}
                  className="w-full p-2 border rounded-md font-mono text-[11px]"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setNewCannedModal(false)}
                className="px-3 py-1.5 border rounded-md text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!cannedTitle.trim() || !cannedBody.trim()) return
                  onCreateCannedReply({
                    title: cannedTitle.trim(),
                    shortcut: cannedShortcut.trim(),
                    category: cannedCat.trim(),
                    body: cannedBody.trim(),
                    tags: ['general'],
                  })
                  setNewCannedModal(false)
                  setCannedTitle('')
                  setCannedShortcut('')
                  setCannedBody('')
                }}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-semibold"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
