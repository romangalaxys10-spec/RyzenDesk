'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { dateFnsFormat } from './format'
import { cn } from '@/lib/utils'
import {
  Loader2, Search, ShieldCheck, UserPlus, KeyRound, ShieldOff, Unlock, Trash2,
  Users, RefreshCw, Send, Copy, Check, ScrollText, Save, X, UserRoundCog,
} from 'lucide-react'

interface StaffRow {
  username: string
  displayName: string
  role: 'super_admin' | 'agent'
  team: string
  suspended: boolean
  telegramLinked: boolean
  createdAt: string
}

interface UserRow {
  zaiId: string
  fullName: string
  email: string
  discordId: string
  telegramLinked: boolean
  notes: string
  createdAt: string
  updatedAt: string
  ticketCount: number
  openCount: number
  lastTicketAt: string | null
}

interface AuditRow { at: string; actor: string; action: string; detail: string }

const TEAMS = ['Support', 'Billing', 'Technical', 'Security'] as const

export function AdminPanel({ token, me }: { token: string; me: string }) {
  const [tab, setTab] = useState<'staff' | 'clients' | 'audit'>('staff')
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [audit, setAudit] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [userQuery, setUserQuery] = useState('')
  const [oneTime, setOneTime] = useState<{ label: string; value: string } | null>(null)

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [staffRes, usersRes] = await Promise.all([
        fetch('/api/admin/staff', { headers: authHeaders, cache: 'no-store' }),
        fetch('/api/admin/users', { headers: authHeaders, cache: 'no-store' }),
      ])
      if (staffRes.ok) {
        const d = (await staffRes.json()) as { staff: StaffRow[]; audit: AuditRow[] }
        setStaff(d.staff || [])
        setAudit(d.audit || [])
      }
      if (usersRes.ok) {
        const d = (await usersRes.json()) as { users: UserRow[] }
        setUsers(d.users || [])
      }
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => { void load() }, [load])

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) =>
      `${u.zaiId} ${u.fullName} ${u.email} ${u.discordId}`.toLowerCase().includes(q),
    )
  }, [users, userQuery])

  async function staffAction(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload),
    })
    const data = (await res.json()) as Record<string, unknown> & { error?: string }
    if (!res.ok) throw new Error(data.error || 'Action failed')
    return data
  }

  async function userAction(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload),
    })
    const data = (await res.json()) as Record<string, unknown> & { error?: string }
    if (!res.ok) throw new Error(data.error || 'Action failed')
    return data
  }

  const tabBtn = (key: typeof tab, label: string, Icon: typeof Users) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
        tab === key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300',
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-950/60 p-1">
          {tabBtn('staff', 'Staff accounts', ShieldCheck)}
          {tabBtn('clients', 'Client users', Users)}
          {tabBtn('audit', 'Audit log', ScrollText)}
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} className="border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800">
          <RefreshCw className="mr-2 h-3.5 w-3.5" /> Reload
        </Button>
      </div>

      {oneTime && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <KeyRound className="h-4 w-4 text-emerald-400" />
            <span className="text-emerald-200">{oneTime.label}:</span>
            <code className="rounded bg-zinc-950 px-2 py-1 font-mono text-xs text-emerald-300">{oneTime.value}</code>
            <CopyButton value={oneTime.value} />
            <Button variant="ghost" size="sm" className="ml-auto h-7 text-emerald-300/70 hover:text-emerald-200" onClick={() => setOneTime(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="mt-1.5 text-xs text-emerald-300/70">Shown only once — copy it now and hand it over securely.</p>
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center text-zinc-500">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading admin data…
        </div>
      ) : tab === 'staff' ? (
        <StaffTab staff={staff} me={me} onAction={staffAction} onOneTime={setOneTime} onChanged={() => void load()} />
      ) : tab === 'clients' ? (
        <ClientsTab
          users={filteredUsers}
          query={userQuery}
          setQuery={setUserQuery}
          onAction={userAction}
          onOneTime={setOneTime}
          onChanged={() => void load()}
        />
      ) : (
        <AuditTab audit={audit} />
      )}
    </div>
  )
}

/* ------------------------------ Staff tab -------------------------------- */

function StaffTab({
  staff,
  me,
  onAction,
  onOneTime,
  onChanged,
}: {
  staff: StaffRow[]
  me: string
  onAction: (p: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  onOneTime: (v: { label: string; value: string } | null) => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [nUsername, setNUsername] = useState('')
  const [nDisplayName, setNDisplayName] = useState('')
  const [nPassword, setNPassword] = useState('')
  const [nRole, setNRole] = useState<'super_admin' | 'agent'>('agent')
  const [nTeam, setNTeam] = useState<string>('Support')

  async function run(key: string, payload: Record<string, unknown>, oneTimeLabel?: string) {
    setBusy(key); setError(null)
    try {
      const data = await onAction(payload)
      if (oneTimeLabel && data && typeof data.newPassword === 'string') {
        onOneTime({ label: oneTimeLabel, value: data.newPassword as string })
      }
      onChanged()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function create() {
    setError(null)
    if (!nUsername.trim() || nPassword.length < 6) {
      setError('Username and a password of at least 6 characters are required.')
      return
    }
    setBusy('create')
    try {
      await onAction({
        action: 'create',
        username: nUsername.trim(),
        displayName: nDisplayName.trim() || nUsername.trim(),
        password: nPassword,
        role: nRole,
        team: nTeam,
      })
      setNUsername(''); setNDisplayName(''); setNPassword(''); setShowCreate(false)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {staff.length} team member{staff.length === 1 ? '' : 's'} · Super admins manage everything below.
        </p>
        <Button onClick={() => setShowCreate((v) => !v)} className="min-h-9 bg-zinc-100 text-zinc-900 hover:bg-white">
          {showCreate ? <><X className="mr-2 h-4 w-4" /> Cancel</> : <><UserPlus className="mr-2 h-4 w-4" /> Add staff</>}
        </Button>
      </div>

      {showCreate && (
        <div className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-zinc-300">Username</Label>
            <Input value={nUsername} onChange={(e) => setNUsername(e.target.value)} placeholder="e.g. Nova" className="border-zinc-800 bg-zinc-950/60 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Display name</Label>
            <Input value={nDisplayName} onChange={(e) => setNDisplayName(e.target.value)} placeholder="Shown to clients" className="border-zinc-800 bg-zinc-950/60 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Password (min 6 chars)</Label>
            <Input value={nPassword} onChange={(e) => setNPassword(e.target.value)} placeholder="Set an initial password" className="border-zinc-800 bg-zinc-950/60 font-mono text-zinc-100" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-zinc-300">Role</Label>
              <Select value={nRole} onValueChange={(v) => setNRole(v as 'super_admin' | 'agent')}>
                <SelectTrigger className="border-zinc-800 bg-zinc-950/60 text-zinc-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">Team</Label>
              <Select value={nTeam} onValueChange={setNTeam}>
                <SelectTrigger className="border-zinc-800 bg-zinc-950/60 text-zinc-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
                  {TEAMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={() => void create()} disabled={busy !== null} className="min-h-10 bg-zinc-100 text-zinc-900 hover:bg-white">
              {busy === 'create' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Create account
            </Button>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-zinc-950/80 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Member</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Team</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Telegram</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr key={m.username} className="border-t border-zinc-800/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-zinc-100">
                      {m.displayName}
                      {m.username === me && <Badge variant="outline" className="rounded-full border-sky-500/30 bg-sky-500/10 text-[10px] text-sky-300">you</Badge>}
                    </div>
                    <div className="text-xs text-zinc-500">@{m.username} · since {dateFnsFormat(m.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={m.role}
                      disabled={m.username === me || busy !== null}
                      onValueChange={(v) => void run(`role-${m.username}`, { action: 'setRole', username: m.username, role: v })}
                    >
                      <SelectTrigger className="h-8 w-[130px] border-zinc-800 bg-zinc-950/60 text-zinc-200"><SelectValue /></SelectTrigger>
                      <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
                        <SelectItem value="agent">Agent</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      value={m.team}
                      disabled={busy !== null}
                      onValueChange={(v) => void run(`team-${m.username}`, { action: 'setTeam', username: m.username, team: v })}
                    >
                      <SelectTrigger className="h-8 w-[120px] border-zinc-800 bg-zinc-950/60 text-zinc-200"><SelectValue /></SelectTrigger>
                      <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
                        {TEAMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn(
                      'rounded-full',
                      m.suspended ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                    )}>
                      {m.suspended ? 'Suspended' : 'Active'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {m.telegramLinked ? <span className="text-sky-300">Linked</span> : <span className="text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        variant="outline" size="sm" disabled={busy !== null}
                        className="h-8 border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800"
                        onClick={() => void run(`pw-${m.username}`, { action: 'resetPassword', username: m.username }, `New password for ${m.displayName}`)}
                      >
                        <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset password
                      </Button>
                      {m.username !== me && (
                        <>
                          <Button
                            variant="outline" size="sm" disabled={busy !== null}
                            className="h-8 border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800"
                            onClick={() => void run(`sus-${m.username}`, { action: 'setSuspended', username: m.username, suspended: !m.suspended })}
                          >
                            {m.suspended ? <><Unlock className="mr-1 h-3.5 w-3.5" /> Restore</> : <><ShieldOff className="mr-1 h-3.5 w-3.5" /> Suspend</>}
                          </Button>
                          <Button
                            variant="outline" size="sm" disabled={busy !== null}
                            className="h-8 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                            onClick={() => { if (confirm(`Delete staff account "${m.displayName}"? This cannot be undone.`)) void run(`del-${m.username}`, { action: 'delete', username: m.username }) }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- Clients tab ------------------------------- */

function ClientsTab({
  users,
  query,
  setQuery,
  onAction,
  onOneTime,
  onChanged,
}: {
  users: UserRow[]
  query: string
  setQuery: (v: string) => void
  onAction: (p: Record<string, unknown>) => Promise<Record<string, unknown> | null>
  onOneTime: (v: { label: string; value: string } | null) => void
  onChanged: () => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [eName, setEName] = useState('')
  const [eEmail, setEEmail] = useState('')
  const [eDiscord, setEDiscord] = useState('')
  const [eNotes, setENotes] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [nZaiId, setNZaiId] = useState('')
  const [nName, setNName] = useState('')
  const [nEmail, setNEmail] = useState('')
  const [nDiscord, setNDiscord] = useState('')

  async function run(key: string, payload: Record<string, unknown>, oneTimeLabel?: string) {
    setBusy(key); setError(null)
    try {
      const data = await onAction(payload)
      if (oneTimeLabel && data && typeof data.token === 'string') {
        onOneTime({ label: oneTimeLabel, value: data.token as string })
      }
      onChanged()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
      return false
    } finally {
      setBusy(null)
    }
  }

  function startEdit(u: UserRow) {
    setEditing(u.zaiId)
    setEName(u.fullName); setEEmail(u.email); setEDiscord(u.discordId); setENotes(u.notes || '')
  }

  async function saveEdit(zaiId: string) {
    const ok = await run(`edit-${zaiId}`, {
      action: 'updateContact', zaiId, fullName: eName, email: eEmail, discordId: eDiscord, notes: eNotes,
    })
    if (ok) setEditing(null)
  }

  async function createClient() {
    setError(null)
    if (!nZaiId.trim() || nName.trim().length < 2 || !nEmail.trim()) {
      setError('User ID, full name and email are required.')
      return
    }
    setBusy('create')
    try {
      const data = await onAction({ action: 'create', zaiId: nZaiId.trim(), fullName: nName.trim(), email: nEmail.trim(), discordId: nDiscord.trim() })
      if (data && typeof data.token === 'string') {
        onOneTime({ label: `Access token for ${nName.trim()}`, value: data.token as string })
      }
      setNZaiId(''); setNName(''); setNEmail(''); setNDiscord(''); setShowCreate(false)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search clients by ID, name, email, Discord…" className="border-zinc-800 bg-zinc-950/60 pl-9 text-zinc-100 placeholder:text-zinc-600" />
        </div>
        <Button onClick={() => setShowCreate((v) => !v)} className="min-h-9 bg-zinc-100 text-zinc-900 hover:bg-white">
          {showCreate ? <><X className="mr-2 h-4 w-4" /> Cancel</> : <><UserRoundCog className="mr-2 h-4 w-4" /> Add client</>}
        </Button>
      </div>

      {showCreate && (
        <div className="grid gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-zinc-300">User ID</Label>
            <Input value={nZaiId} onChange={(e) => setNZaiId(e.target.value)} className="border-zinc-800 bg-zinc-950/60 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Full name</Label>
            <Input value={nName} onChange={(e) => setNName(e.target.value)} className="border-zinc-800 bg-zinc-950/60 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Email</Label>
            <Input value={nEmail} onChange={(e) => setNEmail(e.target.value)} className="border-zinc-800 bg-zinc-950/60 text-zinc-100" />
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Discord ID (optional)</Label>
            <Input value={nDiscord} onChange={(e) => setNDiscord(e.target.value)} className="border-zinc-800 bg-zinc-950/60 text-zinc-100" />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between">
            <p className="text-xs text-zinc-500">A secret access token is generated automatically — share it with the client.</p>
            <Button onClick={() => void createClient()} disabled={busy !== null} className="min-h-10 bg-zinc-100 text-zinc-900 hover:bg-white">
              {busy === 'create' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRoundCog className="mr-2 h-4 w-4" />}
              Create client
            </Button>
          </div>
        </div>
      )}

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-zinc-950/80 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Tickets</th>
                <th className="px-4 py-3 font-medium">Telegram</th>
                <th className="px-4 py-3 font-medium">Last activity</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-zinc-500">No clients match.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.zaiId} className="border-t border-zinc-800/70 align-top">
                  <td className="px-4 py-3">
                    {editing === u.zaiId ? (
                      <div className="space-y-2">
                        <Input value={eName} onChange={(e) => setEName(e.target.value)} placeholder="Full name" className="h-8 border-zinc-800 bg-zinc-950/60 text-zinc-100" />
                        <Input value={eDiscord} onChange={(e) => setEDiscord(e.target.value)} placeholder="Discord" className="h-8 border-zinc-800 bg-zinc-950/60 text-zinc-100" />
                        <Input value={eNotes} onChange={(e) => setENotes(e.target.value)} placeholder="CRM notes…" className="h-8 border-zinc-800 bg-zinc-950/60 text-zinc-100" />
                      </div>
                    ) : (
                      <>
                        <div className="font-medium text-zinc-100">{u.fullName}</div>
                        <div className="font-mono text-xs text-zinc-500">{u.zaiId}</div>
                        {u.notes && <div className="mt-1 max-w-[220px] truncate text-xs text-zinc-500" title={u.notes}>📝 {u.notes}</div>}
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editing === u.zaiId ? (
                      <Input value={eEmail} onChange={(e) => setEEmail(e.target.value)} placeholder="Email" className="h-8 border-zinc-800 bg-zinc-950/60 text-zinc-100" />
                    ) : (
                      <>
                        <div className="max-w-[200px] truncate text-zinc-300">{u.email}</div>
                        <div className="max-w-[200px] truncate text-xs text-zinc-500">{u.discordId || 'No Discord'}</div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-zinc-200">{u.ticketCount} total</div>
                    <div className="text-xs text-zinc-500">{u.openCount} active</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.telegramLinked
                      ? <Badge variant="outline" className="rounded-full border-sky-500/30 bg-sky-500/10 text-[10px] text-sky-300"><Send className="mr-1 h-3 w-3" /> Linked</Badge>
                      : <span className="text-xs text-zinc-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {u.lastTicketAt ? dateFnsFormat(u.lastTicketAt) : 'No tickets yet'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {editing === u.zaiId ? (
                        <>
                          <Button size="sm" disabled={busy !== null} className="h-8 bg-emerald-500 text-zinc-950 hover:bg-emerald-400" onClick={() => void saveEdit(u.zaiId)}>
                            {busy === `edit-${u.zaiId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />} Save
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 text-zinc-500" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" /></Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" disabled={busy !== null} className="h-8 border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800" onClick={() => startEdit(u)}>
                            <UserRoundCog className="mr-1 h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button
                            variant="outline" size="sm" disabled={busy !== null}
                            className="h-8 border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800"
                            onClick={() => { if (confirm(`Reset the access token for ${u.fullName}? The old token stops working immediately.`)) void run(`tok-${u.zaiId}`, { action: 'resetToken', zaiId: u.zaiId }, `New access token for ${u.fullName}`) }}
                          >
                            <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset token
                          </Button>
                          {u.telegramLinked && (
                            <Button variant="outline" size="sm" disabled={busy !== null} className="h-8 border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800" onClick={() => void run(`tg-${u.zaiId}`, { action: 'unlinkTelegram', zaiId: u.zaiId })}>
                              Unlink TG
                            </Button>
                          )}
                          <Button
                            variant="outline" size="sm" disabled={busy !== null}
                            className="h-8 border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                            onClick={() => { if (confirm(`Delete client ${u.fullName}? Their ${u.ticketCount} ticket(s) will be KEPT unless you confirm cascading.`)) { const cascade = confirm('Also delete ALL their tickets and chats? OK = yes, Cancel = keep tickets.'); void run(`del-${u.zaiId}`, { action: 'delete', zaiId: u.zaiId, cascadeTickets: cascade }) } }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ Audit tab -------------------------------- */

function AuditTab({ audit }: { audit: AuditRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
      <div className="max-h-[560px] overflow-y-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 bg-zinc-950/90 text-left text-xs uppercase tracking-wide text-zinc-500 backdrop-blur">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {audit.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-zinc-500">No audit entries yet.</td></tr>
            )}
            {audit.map((a, i) => (
              <tr key={`${a.at}-${i}`} className="border-t border-zinc-800/70">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-500">{dateFnsFormat(a.at)}</td>
                <td className="px-4 py-2.5 font-medium text-zinc-200">{a.actor}</td>
                <td className="px-4 py-2.5">
                  <code className="rounded bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-400">{a.action}</code>
                </td>
                <td className="px-4 py-2.5 text-zinc-400">{a.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-300 hover:text-emerald-200"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value) } catch { /* ignore */ }
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      aria-label="Copy to clipboard"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}
