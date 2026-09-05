import React, { useState } from 'react'
import {
  Search,
  Filter,
  AlertTriangle,
  Clock,
  MessageSquare,
  Paperclip,
  Tag,
  User,
  CheckCircle2,
  ChevronRight,
  PlusCircle,
  ExternalLink,
  ShieldAlert,
  FileSpreadsheet,
  Download,
  Sparkles,
  DollarSign,
  CheckSquare,
  Square,
} from 'lucide-react'
import type { Ticket, StaffRole, AuditLogEntry, KanbanBoard, WikiPage, StaffMember } from '../../types'
import { SlaTimer } from './SlaTimer'
import { useI18n } from '../../i18n/translations'
import { BatchActionBar } from './BatchActionBar'
import { toast } from '../common/ToastContainer'

interface TicketListProps {
  tickets: Ticket[]
  onSelectTicket: (ticket: Ticket) => void
  onOpenNewTicket: () => void
  currentRole: StaffRole
  wikiPages?: WikiPage[]
  staffList?: StaffMember[]
  auditLogs?: AuditLogEntry[]
  kanbanBoards?: KanbanBoard[]
  onSwitchTab?: (tab: 'tickets' | 'kanban' | 'wiki' | 'analytics' | 'admin' | 'portal') => void
  onRefreshTickets?: () => void
}

export const TicketList: React.FC<TicketListProps> = ({
  tickets,
  onSelectTicket,
  onOpenNewTicket,
  wikiPages = [],
  staffList = [],
  auditLogs = [],
  kanbanBoards = [],
  onSwitchTab,
  onRefreshTickets,
}) => {
  const { t } = useI18n()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [teamFilter, setTeamFilter] = useState<string>('all')
  const [slaFilter, setSlaFilter] = useState<string>('all')
  const [activeQuickView, setActiveQuickView] = useState<'all' | 'unassigned' | 'sla_risk' | 'urgent'>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const handleToggleSelectAll = () => {
    if (selectedIds.length === filteredTickets.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredTickets.map((t) => t.id))
    }
  }

  const handleToggleSelectTicket = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const handleBulkUpdate = async (action: string, value: string) => {
    const res = await fetch('/api/tickets/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketIds: selectedIds,
        action,
        value,
        actor: 'Admin',
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed bulk update')
    }
    setSelectedIds([])
    if (onRefreshTickets) onRefreshTickets()
    else window.location.reload()
  }

  const filteredTickets = tickets.filter((tkt) => {
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      !searchTerm ||
      tkt.id.toLowerCase().includes(q) ||
      tkt.subject.toLowerCase().includes(q) ||
      tkt.contact.fullName.toLowerCase().includes(q) ||
      tkt.contact.email.toLowerCase().includes(q) ||
      tkt.tags?.some((tag) => tag.toLowerCase().includes(q))

    const matchesStatus = statusFilter === 'all' || tkt.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || tkt.priority === priorityFilter
    const matchesTeam = teamFilter === 'all' || tkt.team === teamFilter

    let matchesSla = true
    if (slaFilter === 'breached') {
      matchesSla = tkt.sla.isResponseBreached || tkt.sla.isResolutionBreached
    } else if (slaFilter === 'warning') {
      const now = Date.now()
      const respDiff = new Date(tkt.sla.responseDueAt).getTime() - now
      const resolDiff = new Date(tkt.sla.resolutionDueAt).getTime() - now
      matchesSla =
        tkt.status !== 'resolved' &&
        tkt.status !== 'closed' &&
        ((!tkt.sla.firstRespondedAt && respDiff > 0 && respDiff < 1800_000) ||
          (resolDiff > 0 && resolDiff < 3600_000))
    } else if (slaFilter === 'ok') {
      matchesSla = !tkt.sla.isResponseBreached && !tkt.sla.isResolutionBreached
    }

    let matchesQuickView = true
    if (activeQuickView === 'unassigned') {
      matchesQuickView = !tkt.assignedAgentId
    } else if (activeQuickView === 'sla_risk') {
      matchesQuickView = tkt.sla.isResponseBreached || tkt.sla.isResolutionBreached
    } else if (activeQuickView === 'urgent') {
      matchesQuickView = tkt.priority === 'urgent' || tkt.priority === 'high'
    }

    const matchesTag = !selectedTag || tkt.tags?.includes(selectedTag)

    return matchesSearch && matchesStatus && matchesPriority && matchesTeam && matchesSla && matchesQuickView && matchesTag
  })

  // Computed counts for the Professional Polish stat metrics
  const totalCount = tickets.length
  const openCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length
  const breachedCount = tickets.filter((t) => t.sla.isResponseBreached || t.sla.isResolutionBreached).length
  const wikiCount = wikiPages.length > 0 ? wikiPages.length : 128
  const onlineAgents = staffList.length > 0 ? staffList.length : 14
  const totalAgents = staffList.length > 0 ? staffList.length + 1 : 15

  // Default sample audit logs if none loaded yet
  const displayAuditLogs =
    auditLogs.length > 0
      ? auditLogs.slice(0, 3)
      : [
          {
            id: '1',
            timestamp: new Date().toISOString(),
            actor: 'Admin',
            action: 'RBAC Matrix Updated: Support Tier 1',
            module: 'Access',
          },
          {
            id: '2',
            timestamp: new Date(Date.now() - 3600_000).toISOString(),
            actor: 'System',
            action: 'New Webhook Endpoint Added',
            module: 'Integrations',
          },
          {
            id: '3',
            timestamp: new Date(Date.now() - 10800_000).toISOString(),
            actor: 'T. Chen',
            action: 'Wiki Article Published: REST API Docs',
            module: 'Wiki',
          },
        ]

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 4 Professional Polish Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            Open Tickets
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-900">{openCount}</span>
            <span className="text-emerald-500 text-sm font-medium mb-1">-12% vs last week</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            SLA At Risk
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-rose-600">
              {breachedCount < 10 ? `0${breachedCount}` : breachedCount}
            </span>
            <span className="text-rose-400 text-sm font-medium mb-1">Critical priority</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            Knowledge Base
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-900">{wikiCount}</span>
            <span className="text-slate-400 text-sm font-medium mb-1">Articles published</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
          <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
            Agent Status
          </div>
          <div className="flex items-end gap-3">
            <span className="text-3xl font-bold text-slate-900">
              {onlineAgents}/{totalAgents}
            </span>
            <span className="text-emerald-500 text-sm font-medium mb-1">Online now</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Support Tickets (col-8) + Side Widgets (col-4) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Active Support Tickets */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col overflow-hidden">
            {/* Table Header Bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <h2 className="font-bold text-slate-800 text-base">Active Support Tickets</h2>
                <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                  {filteredTickets.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Export dropdown */}
                <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
                  <a
                    href="/api/tickets/export?format=csv"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-1 font-medium transition-colors"
                    title="Download CSV"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>CSV</span>
                  </a>
                  <span className="w-px h-4 bg-slate-200" />
                  <a
                    href="/api/tickets/export?format=json"
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1.5 hover:bg-slate-50 text-slate-700 flex items-center gap-1 font-medium transition-colors"
                    title="Download JSON"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-600" />
                    <span>JSON</span>
                  </a>
                </div>

                <button
                  onClick={() => {
                    setStatusFilter('all')
                    setPriorityFilter('all')
                    setTeamFilter('all')
                    setSlaFilter('all')
                    setSearchTerm('')
                    setSelectedTag(null)
                    setActiveQuickView('all')
                  }}
                  className="text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-white bg-slate-100 text-slate-700 transition-all cursor-pointer"
                >
                  Reset
                </button>
                <button
                  onClick={onOpenNewTicket}
                  className="text-xs font-semibold px-3 py-1.5 bg-indigo-600 text-white rounded-lg shadow-xs hover:bg-indigo-700 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>+ New Ticket</span>
                </button>
              </div>
            </div>

            {/* Quick Views & Saved Filter Tabs */}
            <div className="px-6 py-2 border-b border-slate-100 bg-slate-50/70 flex items-center gap-2 overflow-x-auto text-xs font-semibold">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1">Views:</span>
              <button
                onClick={() => setActiveQuickView('all')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeQuickView === 'all'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                All Tickets ({tickets.length})
              </button>
              <button
                onClick={() => setActiveQuickView('unassigned')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeQuickView === 'unassigned'
                    ? 'bg-white text-indigo-700 shadow-2xs border border-indigo-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                Unassigned ({tickets.filter((t) => !t.assignedAgentId).length})
              </button>
              <button
                onClick={() => setActiveQuickView('sla_risk')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeQuickView === 'sla_risk'
                    ? 'bg-white text-rose-700 shadow-2xs border border-rose-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                SLA Risk ({breachedCount})
              </button>
              <button
                onClick={() => setActiveQuickView('urgent')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeQuickView === 'urgent'
                    ? 'bg-white text-amber-700 shadow-2xs border border-amber-100'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                Urgent & High ({tickets.filter((t) => t.priority === 'urgent' || t.priority === 'high').length})
              </button>
              {selectedTag && (
                <div className="flex items-center gap-1 bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md text-[11px]">
                  <span>Tag: #{selectedTag}</span>
                  <button onClick={() => setSelectedTag(null)} className="hover:text-sky-950 font-bold ml-1">
                    ×
                  </button>
                </div>
              )}
            </div>

            {/* Filter Dropdown Bar */}
            <div className="p-4 border-b border-slate-100 bg-white space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder={t('tickets.searchPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-1.5 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">{t('tickets.allStatuses')}</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting_customer">Waiting on Customer</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>

                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">{t('tickets.allPriorities')}</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>

                  <select
                    value={slaFilter}
                    onChange={(e) => setSlaFilter(e.target.value)}
                    className={`px-2.5 py-1.5 rounded-lg border font-semibold ${
                      slaFilter === 'breached'
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : slaFilter === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'border-slate-200 bg-white text-slate-700'
                    }`}
                  >
                    <option value="all">{t('tickets.slaAll')}</option>
                    <option value="breached">🚨 Breached</option>
                    <option value="warning">⚠️ Warning</option>
                    <option value="ok">✅ On Track</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Tickets Table / List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold sticky top-0">
                  <tr>
                    <th className="px-4 py-3 border-b border-slate-100 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filteredTickets.length > 0 && selectedIds.length === filteredTickets.length}
                        onChange={handleToggleSelectAll}
                        className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-3 border-b border-slate-100">Subject & ID</th>
                    <th className="px-6 py-3 border-b border-slate-100">Status</th>
                    <th className="px-6 py-3 border-b border-slate-100">Priority</th>
                    <th className="px-6 py-3 border-b border-slate-100">SLA Timer</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-slate-100">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-700">No tickets match selected filters</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Try adjusting search terms or resetting filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((tkt) => {
                      const isUrgent = tkt.priority === 'urgent'
                      const isHigh = tkt.priority === 'high'
                      const isSelected = selectedIds.includes(tkt.id)
                      const totalTimeMins = (tkt.timeLogs || []).reduce((acc, curr) => acc + curr.minutes, 0)

                      return (
                        <tr
                          key={tkt.id}
                          onClick={() => onSelectTicket(tkt)}
                          className={`hover:bg-slate-50 transition-colors group cursor-pointer ${
                            isSelected ? 'bg-indigo-50/40' : ''
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => handleToggleSelectTicket(tkt.id, e as any)}
                              className="rounded text-indigo-600 focus:ring-0 cursor-pointer"
                            />
                          </td>

                          {/* Subject & ID */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {tkt.subject}
                              </span>
                              {tkt.sentiment === 'urgent' && (
                                <span className="bg-rose-100 text-rose-700 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                                  Urgent Tone
                                </span>
                              )}
                              {tkt.sentiment === 'frustrated' && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                                  Frustrated
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                              <span className="font-mono font-medium text-slate-500">#{tkt.id}</span>
                              <span>•</span>
                              <span>Opened by {tkt.contact.fullName}</span>
                              {tkt.assignedAgentId && (
                                <>
                                  <span>•</span>
                                  <span className="text-slate-600 font-medium flex items-center gap-0.5">
                                    <User className="w-3 h-3 text-slate-400" />
                                    {tkt.assignedAgentId}
                                  </span>
                                </>
                              )}
                              {totalTimeMins > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-mono text-[10px] flex items-center gap-0.5 border border-emerald-200">
                                    <Clock className="w-2.5 h-2.5" />
                                    {Math.floor(totalTimeMins / 60)}h {totalTimeMins % 60}m
                                  </span>
                                </>
                              )}
                              {tkt.attachments && tkt.attachments.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-slate-500">
                                    <Paperclip className="w-3 h-3" />
                                    {tkt.attachments.length}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Tags */}
                            {tkt.tags && tkt.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {tkt.tags.map((tag) => (
                                  <button
                                    key={tag}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setSelectedTag(tag)
                                    }}
                                    className="text-[10px] bg-slate-100 hover:bg-sky-100 text-slate-600 hover:text-sky-700 px-1.5 py-0.2 rounded transition-colors"
                                  >
                                    #{tag}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {tkt.status === 'in_progress' ? (
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-[11px] font-bold rounded-full border border-amber-100">
                                In Progress
                              </span>
                            ) : tkt.status === 'open' ? (
                              <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[11px] font-bold rounded-full border border-blue-100">
                                Open
                              </span>
                            ) : tkt.status === 'resolved' ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[11px] font-bold rounded-full border border-emerald-100">
                                Resolved
                              </span>
                            ) : tkt.status === 'waiting_customer' ? (
                              <span className="px-2.5 py-1 bg-purple-50 text-purple-600 text-[11px] font-bold rounded-full border border-purple-100">
                                Waiting Client
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-bold rounded-full border border-slate-200">
                                Backlog
                              </span>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {isUrgent ? (
                              <span className="text-rose-600 font-bold flex items-center gap-1.5 text-xs">
                                <span className="w-1.5 h-1.5 bg-rose-600 rounded-full animate-pulse" />
                                Urgent
                              </span>
                            ) : isHigh ? (
                              <span className="text-amber-600 font-bold flex items-center gap-1.5 text-xs">
                                <span className="w-1.5 h-1.5 bg-amber-600 rounded-full" />
                                High
                              </span>
                            ) : (
                              <span className="text-slate-500 font-bold flex items-center gap-1.5 text-xs">
                                <span className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                                {tkt.priority.charAt(0).toUpperCase() + tkt.priority.slice(1)}
                              </span>
                            )}
                          </td>

                          {/* SLA Timer */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <SlaTimer sla={tkt.sla} status={tkt.status} compact />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Compliance Audit Log & Team Kanban Highlight Card */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          {/* Compliance Audit Log Widget */}
          <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 flex flex-col">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center justify-between">
              <span>Compliance Audit Log</span>
              <button
                onClick={() => onSwitchTab?.('admin')}
                className="text-[10px] text-indigo-600 font-semibold hover:underline cursor-pointer"
              >
                View All
              </button>
            </h3>

            <div className="space-y-4 overflow-y-auto pr-1 max-h-56">
              {displayAuditLogs.map((item, idx) => {
                const barColor =
                  idx === 0
                    ? 'bg-indigo-500'
                    : idx === 1
                    ? 'bg-amber-400'
                    : 'bg-slate-300'

                return (
                  <div key={item.id || idx} className="flex gap-3">
                    <div className={`w-1 h-8 ${barColor} rounded-full mt-1 shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-900 font-semibold truncate">
                        {item.action}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.actor} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Module: {item.module}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Team Kanban Sprint Card */}
          <div className="bg-indigo-900 text-white p-5 rounded-xl shadow-md border border-indigo-950 flex-1 relative overflow-hidden flex flex-col justify-between">
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-base text-white">Team Kanban • Sprint 04</h3>
                <button
                  onClick={() => onSwitchTab?.('kanban')}
                  className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <span>Board</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-indigo-200 mb-4">
                Distributed team collaboration is active.
              </p>

              {/* Team Avatars */}
              <div className="flex -space-x-2 mb-6">
                <div className="w-7 h-7 rounded-full bg-amber-400 border-2 border-indigo-900 flex items-center justify-center text-[10px] font-bold text-slate-900 shadow-xs">
                  JD
                </div>
                <div className="w-7 h-7 rounded-full bg-emerald-400 border-2 border-indigo-900 flex items-center justify-center text-[10px] font-bold text-slate-900 shadow-xs">
                  TC
                </div>
                <div className="w-7 h-7 rounded-full bg-rose-400 border-2 border-indigo-900 flex items-center justify-center text-[10px] font-bold text-slate-900 shadow-xs">
                  RG
                </div>
                <div className="w-7 h-7 rounded-full bg-indigo-700 border-2 border-indigo-900 flex items-center justify-center text-[10px] font-bold text-white shadow-xs">
                  +4
                </div>
              </div>

              {/* Sprint Items */}
              <div className="space-y-2">
                <button
                  onClick={() => onSwitchTab?.('kanban')}
                  className="w-full text-left bg-white/10 hover:bg-white/15 p-2 rounded text-[11px] font-medium transition-colors cursor-pointer"
                >
                  In Review: SMTP Notification Fix
                </button>
                <button
                  onClick={() => onSwitchTab?.('kanban')}
                  className="w-full text-left bg-white/10 hover:bg-white/15 p-2 rounded text-[11px] font-medium transition-colors cursor-pointer"
                >
                  To Do: Mobile UI Layout Refactor
                </button>
                <button
                  onClick={() => onSwitchTab?.('kanban')}
                  className="w-full text-left bg-white/10 hover:bg-white/15 p-2 rounded text-[11px] font-medium opacity-50 transition-colors cursor-pointer"
                >
                  Done: Canned Replies Database
                </button>
              </div>
            </div>

            {/* Glowing Accent Blur Circle */}
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Floating Batch Action Bar for Bulk Ticket Operations */}
      <BatchActionBar
        selectedCount={selectedIds.length}
        selectedIds={selectedIds}
        staffMembers={staffList}
        onClearSelection={() => setSelectedIds([])}
        onBulkUpdate={handleBulkUpdate}
      />
    </div>
  )
}
