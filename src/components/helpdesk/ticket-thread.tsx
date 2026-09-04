'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge, PriorityBadge, TypeBadge } from './badges'
import { STATUS_LABELS, PRIORITY_LABELS, TICKET_STATUSES, TICKET_PRIORITIES, TEAMS, TEAM_LABELS, type Ticket, type Team } from '@/lib/helpdesk/types'
import { cn } from '@/lib/utils'
import { dateFnsFormat } from './format'
import { ArrowLeft, Send, StickyNote, Loader2, Mail, Gamepad2, Fingerprint, RefreshCw, TrendingUp, UserCog, History, X } from 'lucide-react'

export interface RosterMember {
  username: string
  displayName: string
  role: string
  team: Team
  suspended: boolean
}

export function TicketThread({
  ticket,
  viewer,
  onBack,
  onReply,
  onUpdate,
  onEscalate,
  roster = [],
  busy,
}: {
  ticket: Ticket
  viewer: 'user' | 'staff'
  onBack: () => void
  onReply: (body: string, visibility: 'public' | 'internal') => Promise<boolean>
  onUpdate?: (patch: { status?: string; priority?: string; assignee?: string | null; team?: string }) => Promise<boolean>
  onEscalate?: (toMember: string, toTeam: Team, reason: string) => Promise<boolean>
  roster?: RosterMember[]
  busy?: boolean
}) {
  const [reply, setReply] = useState('')
  const [internal, setInternal] = useState(false)
  const [sending, setSending] = useState(false)
  const [showEscalate, setShowEscalate] = useState(false)

  async function send() {
    if (!reply.trim()) return
    setSending(true)
    const ok = await onReply(reply.trim(), internal ? 'internal' : 'public')
    setSending(false)
    if (ok) setReply('')
  }

  const activeRoster = roster.filter((m) => !m.suspended)

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack} className="border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <h2 className="font-mono text-lg font-semibold text-zinc-100">{ticket.id}</h2>
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        <TypeBadge type={ticket.type} />
        {ticket.escalationLevel > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-medium text-orange-300">
            <TrendingUp className="h-3 w-3" /> Escalated ×{ticket.escalationLevel}
          </span>
        )}
        {viewer === 'staff' && (
          <Button variant="ghost" size="sm" onClick={onBack} className="ml-auto hidden text-zinc-500 sm:inline-flex" aria-hidden>
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-lg font-semibold leading-snug text-zinc-100">{ticket.subject}</h3>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>Opened {dateFnsFormat(ticket.createdAt)}</span>
          <span>Updated {dateFnsFormat(ticket.updatedAt)}</span>
          {ticket.team && <span>Team: <span className="text-zinc-400">{ticket.team}</span></span>}
          {viewer === 'staff' && (
            <span>Assignee: <span className="text-zinc-400">{ticket.assignee || 'Unassigned'}</span></span>
          )}
        </div>

        {viewer === 'staff' && ticket.contact && (
          <div className="mt-4 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Fingerprint className="h-4 w-4 shrink-0 text-zinc-500" />
              <span className="font-mono text-xs">{ticket.contact.zaiId}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Mail className="h-4 w-4 shrink-0 text-zinc-500" />
              <a href={`mailto:${ticket.contact.email}`} className="truncate hover:text-zinc-100">{ticket.contact.email}</a>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-300 sm:col-span-2">
              <Gamepad2 className="h-4 w-4 shrink-0 text-zinc-500" />
              <span className="text-zinc-400">{ticket.contact.discordId || 'No Discord ID provided'}</span>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-300">
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Description</div>
            <p className="whitespace-pre-wrap">{ticket.body}</p>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Steps to re-create</div>
            <p className="whitespace-pre-wrap">{ticket.reproduction}</p>
          </div>
        </div>
      </div>

      {/* Escalation history (staff only) */}
      {viewer === 'staff' && ticket.escalations?.length > 0 && (
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-300">
            <History className="h-3.5 w-3.5" /> Escalation history
          </div>
          <div className="space-y-2">
            {ticket.escalations.map((e) => (
              <div key={e.id} className="rounded-lg border border-orange-500/15 bg-zinc-950/40 px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                  <span className="font-semibold text-zinc-200">{e.from}</span>
                  <span>→</span>
                  <span className="font-semibold text-orange-300">{e.toMember}</span>
                  <span className="text-zinc-500">({e.toTeam} team)</span>
                  <span className="ml-auto text-zinc-600">{dateFnsFormat(e.at)}</span>
                </div>
                {e.reason && <p className="mt-1 text-xs text-zinc-400">{e.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {viewer === 'staff' && onUpdate && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Manage</span>
          <Select value={ticket.status} onValueChange={(v) => void onUpdate({ status: v })}>
            <SelectTrigger className="w-[170px] border-zinc-800 bg-zinc-950/60 text-zinc-200"><SelectValue /></SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
              {TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ticket.priority} onValueChange={(v) => void onUpdate({ priority: v })}>
            <SelectTrigger className="w-[130px] border-zinc-800 bg-zinc-950/60 text-zinc-200"><SelectValue /></SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
              {TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ticket.team || 'Support'} onValueChange={(v) => void onUpdate({ team: v })}>
            <SelectTrigger className="w-[160px] border-zinc-800 bg-zinc-950/60 text-zinc-200"><SelectValue /></SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
              {TEAMS.map((t) => <SelectItem key={t} value={t}>{TEAM_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select
            value={ticket.assignee || 'unassigned'}
            onValueChange={(v) => void onUpdate({ assignee: v === 'unassigned' ? null : v })}
          >
            <SelectTrigger className="w-[170px] border-zinc-800 bg-zinc-950/60 text-zinc-200">
              <UserCog className="mr-1 h-3.5 w-3.5 text-zinc-500" />
              <SelectValue placeholder="Assign to…" />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {activeRoster.map((m) => (
                <SelectItem key={m.username} value={m.username}>
                  {m.displayName} · {m.team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {onEscalate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEscalate((v) => !v)}
              className="ml-auto border-orange-500/30 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 hover:text-orange-200"
            >
              {showEscalate ? <><X className="mr-1.5 h-4 w-4" /> Cancel</> : <><TrendingUp className="mr-1.5 h-4 w-4" /> Escalate</>}
            </Button>
          )}
        </div>
      )}

      {viewer === 'staff' && showEscalate && onEscalate && (
        <EscalatePanel
          ticket={ticket}
          roster={activeRoster}
          onDone={async (toMember, toTeam, reason) => {
            const ok = await onEscalate(toMember, toTeam, reason)
            if (ok) setShowEscalate(false)
            return ok
          }}
        />
      )}

      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Conversation ({ticket.messages.length})</h4>
        {ticket.messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-zinc-500">
            No replies yet — the conversation starts here.
          </div>
        )}
        {ticket.messages.map((m) => {
          if (m.from === 'system') {
            return (
              <div key={m.id} className="flex justify-center">
                <div className="max-w-[90%] rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 px-4 py-2 text-center text-xs text-zinc-400">
                  <span className="mr-2 text-zinc-600">{dateFnsFormat(m.at)}</span>
                  {m.body}
                </div>
              </div>
            )
          }
          const isStaff = m.from === 'staff'
          const isInternal = m.visibility === 'internal'
          return (
            <div key={m.id} className={cn('flex', isStaff ? 'justify-start' : 'justify-end')}>
              <div className={cn(
                'max-w-[85%] rounded-2xl border px-4 py-3 sm:max-w-[75%]',
                isInternal
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : isStaff
                    ? 'border-zinc-800 bg-zinc-900/80'
                    : 'border-emerald-500/20 bg-emerald-500/5',
              )}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn('font-semibold', isStaff ? 'text-zinc-200' : 'text-emerald-300')}>{m.author}</span>
                  <span className="text-zinc-600">{isStaff ? 'Staff' : 'Client'} · {dateFnsFormat(m.at)}</span>
                  {isInternal && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                      <StickyNote className="h-3 w-3" /> Internal note
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-zinc-200">{m.body}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        {viewer === 'staff' && (
          <label className="mb-3 flex w-fit cursor-pointer items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-4 w-4 accent-amber-400" />
            <StickyNote className="h-3.5 w-3.5 text-amber-400" /> Internal note (not visible to the client)
          </label>
        )}
        <Textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={viewer === 'staff' ? 'Write a reply to the client…' : 'Write a reply to our support team…'}
          rows={3}
          className="min-h-[80px] resize-y border-zinc-800 bg-zinc-950/60 text-zinc-100 placeholder:text-zinc-600"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">{reply.length}/8000</p>
          <Button onClick={() => void send()} disabled={sending || busy || !reply.trim()} className="min-h-10 bg-zinc-100 text-zinc-900 hover:bg-white">
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {internal ? 'Save Note' : 'Send Reply'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function EscalatePanel({
  ticket,
  roster,
  onDone,
}: {
  ticket: Ticket
  roster: RosterMember[]
  onDone: (toMember: string, toTeam: Team, reason: string) => Promise<boolean>
}) {
  const initialTeam = ticket.team || 'Support'
  const [team, setTeam] = useState<Team>(initialTeam)
  const [member, setMember] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const teamMembers = roster.filter((m) => m.team === team)
  const otherMembers = roster.filter((m) => m.team !== team)

  async function submit() {
    setError(null)
    if (!member) {
      setError('Choose the staff member who should take over this ticket.')
      return
    }
    setBusy(true)
    const ok = await onDone(member, team, reason.trim())
    setBusy(false)
    if (!ok) setError('Escalation failed. Please try again.')
  }

  return (
    <div className="space-y-4 rounded-2xl border border-orange-500/25 bg-zinc-900/70 p-5">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-orange-400" />
        <h4 className="text-sm font-semibold text-zinc-100">Escalate {ticket.id}</h4>
        <span className="ml-auto text-xs text-zinc-500">Priority will be raised and the target member pinged on Telegram.</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-zinc-300">Target team</Label>
          <Select value={team} onValueChange={(v) => { setTeam(v as Team); setMember('') }}>
            <SelectTrigger className="border-zinc-800 bg-zinc-950/60 text-zinc-200"><SelectValue /></SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
              {TEAMS.map((t) => <SelectItem key={t} value={t}>{TEAM_LABELS[t]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-zinc-300">Escalate to member</Label>
          <Select value={member} onValueChange={setMember}>
            <SelectTrigger className="border-zinc-800 bg-zinc-950/60 text-zinc-200"><SelectValue placeholder="Choose member…" /></SelectTrigger>
            <SelectContent className="border-zinc-800 bg-zinc-950 text-zinc-200">
              {teamMembers.length > 0 && (
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500">{team} team</div>
              )}
              {teamMembers.map((m) => (
                <SelectItem key={m.username} value={m.username}>
                  {m.displayName} ({m.role === 'super_admin' ? 'Super Admin' : 'Agent'})
                </SelectItem>
              ))}
              {otherMembers.length > 0 && (
                <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500">Other teams</div>
              )}
              {otherMembers.map((m) => (
                <SelectItem key={m.username} value={m.username}>
                  {m.displayName} · {m.team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-zinc-300">Reason / context for the other team</Label>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Why is this being escalated? What has been tried so far? What does the target team need to know?"
          className="resize-y border-zinc-800 bg-zinc-950/60 text-zinc-100 placeholder:text-zinc-600"
        />
      </div>
      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>}
      <div className="flex justify-end">
        <Button onClick={() => void submit()} disabled={busy} className="min-h-10 bg-orange-500 text-zinc-950 hover:bg-orange-400">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
          Escalate ticket
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        Escalation reassigns the ticket, bumps priority (2nd escalation → urgent) and adds an internal system note.
      </p>
    </div>
  )
}
