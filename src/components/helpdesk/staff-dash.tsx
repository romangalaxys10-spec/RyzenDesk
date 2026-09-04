'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge, PriorityBadge, TypeBadge, statusStyle } from './badges'
import { TelegramCard } from './telegram-card'
import { ChatConsole } from './chat-console'
import { AdminPanel } from './admin-panel'
import { useBotInfo } from './user-dash'
import { dateFnsFormat } from './format'
import type { Team } from '@/lib/helpdesk/types'
import { ISSUE_TYPES, TICKET_STATUSES, STATUS_LABELS, type Ticket } from '@/lib/helpdesk/types'
import { cn } from '@/lib/utils'
import {
  Loader2, LogOut, Search, ChevronRight, Github, RefreshCw, Database, CircleDot,
  Tickets, MessagesSquare, ShieldCheck, Headset, UserCog, TrendingUp,
} from 'lucide-react'

export interface RosterMember {
  username: string
  displayName: string
  role: string
  team: Team
  suspended: boolean
}

interface SyncStatus {
  configured: boolean
  repo: string
  pendingChanges: boolean
  pushing: boolean
  lastError: string | null
  lastPushAt: string | null
}

function useSystemStatus(enabled: boolean) {
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/system/status')
      const data = (await res.json()) as { sync: SyncStatus }
      setSync(data.sync)
    } catch {
      // ignore
    }
  }, [])
  useEffect(() => {
    if (!enabled) return
    const initial = setTimeout(() => void refresh(), 0)
    const t = setInterval(refresh, 15_000)
    return () => {
      clearTimeout(initial)
      clearInterval(t)
    }
  }, [enabled, refresh])
  return { sync, refresh }
}

export function StaffDash({
  profile,
  token,
  onOpenTicket,
  onLogout,
  onRoster,
}: {
  profile: { username?: string; displayName?: string; staffRole?: string }
  token: string
  onOpenTicket: (id: string) => void
  onLogout: () => void
  onRoster?: (roster: RosterMember[]) => void
}) {
  const isSuperAdmin = profile.staffRole === 'super_admin'
  const [tab, setTab] = useState<'tickets' | 'chats' | 'admin'>('tickets')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all')
  const [roster, setRoster] = useState<RosterMember[]>([])
  const [liveChatEnabled, setLiveChatEnabled] = useState<boolean | null>(null)
  const [waitingChats, setWaitingChats] = useState(0)
  const { sync: syncState, refresh: refreshSync } = useSystemStatus(true)
  const bot = useBotInfo()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/tickets', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (res.ok) {
        const data = (await res.json()) as { tickets: Ticket[]; roster: RosterMember[] }
        setTickets(data.tickets)
        setRoster(data.roster || [])
        onRoster?.(data.roster || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [token, onRoster])

  useEffect(() => {
    void load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  // Live chat setting
  const loadChatSetting = useCallback(async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const d = (await res.json()) as { liveChatEnabled: boolean }
        setLiveChatEnabled(d.liveChatEnabled)
      }
    } catch {
      // ignore
    }
  }, [])
  useEffect(() => { void loadChatSetting() }, [loadChatSetting])

  // Lightweight poll so the Live Chats tab badge shows pending requests.
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/chats', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
        if (res.ok) {
          const d = (await res.json()) as { chats?: Array<{ status: string }> }
          setWaitingChats((d.chats || []).filter((c) => c.status === 'waiting').length)
        }
      } catch {
        // ignore
      }
    }
    void check()
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') void check() }, 8000)
    return () => clearInterval(t)
  }, [token])

  async function toggleLiveChat(enabled: boolean) {
    setLiveChatEnabled(enabled) // optimistic
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ liveChatEnabled: enabled }),
      })
      if (!res.ok) throw new Error()
    } catch {
      void loadChatSetting() // revert on failure
    }
  }

  const stats = useMemo(() => {
    const by = (s: Ticket['status']) => tickets.filter((t) => t.status === s).length
    return {
      total: tickets.length,
      open: by('open'),
      inProgress: by('in_progress'),
      waiting: by('waiting_customer'),
      urgent: tickets.filter((t) => t.priority === 'urgent' && !['resolved', 'closed'].includes(t.status)).length,
      escalated: tickets.filter((t) => t.escalationLevel > 0 && !['resolved', 'closed'].includes(t.status)).length,
      mine: profile.username ? tickets.filter((t) => t.assignee === profile.username && !['resolved', 'closed'].includes(t.status)).length : 0,
    }
  }, [tickets, profile.username])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false
      if (typeFilter !== 'all' && t.type !== typeFilter) return false
      if (assigneeFilter === 'mine' && t.assignee !== profile.username) return false
      if (assigneeFilter === 'unassigned' && t.assignee) return false
      if (assigneeFilter !== 'all' && assigneeFilter !== 'mine' && assigneeFilter !== 'unassigned' && t.assignee !== assigneeFilter) return false
      if (q) {
        const hay = `${t.id} ${t.subject} ${t.contact.fullName} ${t.contact.email} ${t.contact.zaiId} ${t.contact.discordId} ${t.assignee || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [tickets, query, statusFilter, typeFilter, assigneeFilter, profile.username])

  const statCards = [
    { label: 'All Tickets', value: stats.total, cls: 'text-zinc-100' },
    { label: 'Open', value: stats.open, cls: 'text-emerald-400' },
    { label: 'In Progress', value: stats.inProgress, cls: 'text-amber-400' },
    { label: 'Waiting on Client', value: stats.waiting, cls: 'text-purple-400' },
    { label: 'Urgent Active', value: stats.urgent, cls: 'text-red-400' },
    { label: 'Escalated', value: stats.escalated, cls: 'text-orange-400' },
    { label: 'Assigned to me', value: stats.mine, cls: 'text-sky-400' },
  ]

  const tabBtn = (key: typeof tab, label: string, Icon: typeof Tickets, badge?: number) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={cn(
        'relative inline-flex min-h-10 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        tab === key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300',
      )}
    >
      <Icon className="h-4 w-4" /> {label}
      {badge ? (
        <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-300">
          {badge}
        </span>
      ) : null}
    </button>
  )

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold text-zinc-100">Staff Console</h2>
            {isSuperAdmin ? (
              <Badge variant="outline" className="rounded-full border-amber-500/30 bg-amber-500/10 text-[11px] font-medium text-amber-300">
                <ShieldCheck className="mr-1 h-3 w-3" /> Super Admin
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full border-zinc-700 bg-zinc-900 text-[11px] text-zinc-400">
                Agent
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">
            Signed in as <span className="font-medium text-zinc-300">{profile.displayName || profile.username}</span>
            {roster.find((r) => r.username === profile.username) && (
              <> · {roster.find((r) => r.username === profile.username)!.team} team</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isSuperAdmin && (
            <label className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-2">
              <Headset className={cn('h-4 w-4', liveChatEnabled ? 'text-emerald-400' : 'text-zinc-600')} />
              <span className="text-xs font-medium text-zinc-300">Live chat</span>
              <Switch
                checked={Boolean(liveChatEnabled)}
                onCheckedChange={(v) => void toggleLiveChat(v)}
                disabled={liveChatEnabled === null}
                aria-label="Toggle live chat availability"
              />
              <span className={cn('text-[10px] font-semibold uppercase', liveChatEnabled ? 'text-emerald-400' : 'text-zinc-500')}>
                {liveChatEnabled === null ? '…' : liveChatEnabled ? 'Online' : 'Offline'}
              </span>
            </label>
          )}
          <Button onClick={() => { void load(); void refreshSync() }} variant="outline" className="min-h-10 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800">
            <RefreshCw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button onClick={onLogout} variant="outline" className="min-h-10 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1">
        {tabBtn('tickets', 'Tickets', Tickets, stats.open + stats.inProgress)}
        {tabBtn('chats', 'Live Chats', MessagesSquare, waitingChats)}
        {isSuperAdmin && tabBtn('admin', 'Admin', ShieldCheck)}
      </div>

      {tab === 'chats' ? (
        <ChatConsole token={token} me={profile.username || ''} />
      ) : tab === 'admin' && isSuperAdmin ? (
        <AdminPanel token={token} me={profile.username || ''} />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className={cn('text-2xl font-bold tabular-nums', s.cls)}>{s.value}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ID, subject, name, email, Discord, assignee…" className="border-zinc-800 bg-zinc-900/60 pl-9 text-zinc-100 placeholder:text-zinc-600" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full border-zinc-800 bg-zinc-900/60 text-zinc-200 lg:w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
                <SelectItem value="all">All statuses</SelectItem>
                {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full border-zinc-800 bg-zinc-900/60 text-zinc-200 lg:w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
                <SelectItem value="all">All types</SelectItem>
                {ISSUE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-full border-zinc-800 bg-zinc-900/60 text-zinc-200 lg:w-[180px]">
                <UserCog className="mr-1 h-3.5 w-3.5 text-zinc-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
                <SelectItem value="all">All assignees</SelectItem>
                <SelectItem value="mine">Assigned to me</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {roster.filter((r) => !r.suspended).map((r) => (
                  <SelectItem key={r.username} value={r.username}>{r.displayName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
            <div className="max-h-[540px] overflow-y-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-950/95 text-left text-xs uppercase tracking-wide text-zinc-500 backdrop-blur">
                  <tr>
                    <th className="px-4 py-3 font-medium">Ticket</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Assignee</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Loading tickets…
                      </td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">No tickets match the current filters.</td>
                    </tr>
                  )}
                  {filtered.map((t) => {
                    const assignee = roster.find((r) => r.username === t.assignee)
                    return (
                      <tr
                        key={t.id}
                        onClick={() => onOpenTicket(t.id)}
                        className="cursor-pointer border-t border-zinc-800/70 transition-colors hover:bg-zinc-800/40"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-zinc-400">{t.id}</span>
                            {t.escalationLevel > 0 && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-orange-300">
                                <TrendingUp className="h-2.5 w-2.5" /> ×{t.escalationLevel}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 max-w-[240px] truncate font-medium text-zinc-100">{t.subject}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[160px] truncate text-zinc-200">{t.contact.fullName}</div>
                          <div className="max-w-[160px] truncate text-xs text-zinc-500">{t.contact.email}</div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                        <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                        <td className="px-4 py-3">
                          {assignee ? (
                            <div>
                              <div className="text-zinc-200">{assignee.displayName}</div>
                              <div className="text-xs text-zinc-500">{assignee.team}</div>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-600">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{dateFnsFormat(t.updatedAt)}</td>
                        <td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-zinc-600" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Telegram + sync */}
          <div className="grid gap-4 lg:grid-cols-2">
            <TelegramCard
              botUsername={bot?.username || null}
              command="/staff <your staff password>"
              title="Telegram alerts for staff"
              description={`Get instant new-ticket, reply & escalation alerts. ${bot?.linkedStaff || 0} of ${roster.length || 4} staff members are currently linked.`}
            />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Github className="h-4 w-4 text-zinc-300" />
                <h3 className="text-sm font-semibold text-zinc-100">GitHub persistent sync</h3>
                <span className={cn(
                  'ml-auto inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium',
                  syncState?.lastError ? statusStyle.in_progress : syncState?.pendingChanges ? statusStyle.in_progress : statusStyle.open,
                )}>
                  <CircleDot className="h-3 w-3" />
                  {syncState?.lastError ? 'Retrying' : syncState?.pendingChanges || syncState?.pushing ? 'Syncing' : 'Synced'}
                </span>
              </div>
              <p className="text-sm text-zinc-400">Every change is committed to the private repo:</p>
              <code className="mt-3 block overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-300">
                {syncState?.repo || '…'} / {syncState?.lastPushAt ? `last commit ${dateFnsFormat(syncState.lastPushAt)}` : 'initial sync'}
              </code>
              {syncState?.lastError && (
                <p className="mt-2 text-xs text-red-400">Last error: {syncState.lastError}</p>
              )}
              <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500">
                <Database className="h-3 w-3" /> The DB is pulled from GitHub on every server boot — nothing is ever lost.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
