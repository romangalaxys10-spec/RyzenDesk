'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { ISSUE_TYPES, type IssueType } from '@/lib/helpdesk/types'
import { typeIcons } from './badges'
import { cn } from '@/lib/utils'
import { Loader2, Send, ShieldCheck, Copy, Check } from 'lucide-react'

export interface SubmitIdentity {
  zaiId: string
  fullName: string
  email: string
  discordId: string
}

export interface CreateTicketResponse {
  ok: boolean
  ticketId: string
  token: string
  isNewUser: boolean
  user: SubmitIdentity
  ticket: { id: string; subject: string; type: IssueType; priority: string }
  session: string
  error?: string
}

export function SubmitForm({
  identity,
  onCreated,
}: {
  identity?: SubmitIdentity | null
  onCreated: (res: CreateTicketResponse) => void
}) {
  const [zaiId, setZaiId] = useState(identity?.zaiId || '')
  const [fullName, setFullName] = useState(identity?.fullName || '')
  const [email, setEmail] = useState(identity?.email || '')
  const [discordId, setDiscordId] = useState(identity?.discordId || '')
  const [type, setType] = useState<IssueType | ''>('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [reproduction, setReproduction] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lockIdentity = Boolean(identity?.zaiId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!type) {
      setError('Please choose the type of issue')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zaiId, fullName, email, discordId, type, subject, body, reproduction }),
      })
      const data = (await res.json()) as CreateTicketResponse
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      toast({ title: 'Ticket submitted', description: `${data.ticketId} was created successfully.` })
      onCreated(data)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const inputCls = 'bg-zinc-900/60 border-zinc-800 focus-visible:ring-zinc-500 text-zinc-100'

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="zaiId" className="text-zinc-300">User ID <span className="text-red-400">*</span></Label>
          <Input id="zaiId" required value={zaiId} onChange={(e) => setZaiId(e.target.value)} placeholder="e.g. 6f3a9c2b-… or your customer handle" className={inputCls} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fullName" className="text-zinc-300">Full Name <span className="text-red-400">*</span></Label>
          <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className={inputCls} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" className="text-zinc-300">Registered Email <span className="text-red-400">*</span></Label>
          <Input id="email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputCls} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="discordId" className="text-zinc-300">Discord ID <span className="text-zinc-500">(optional)</span></Label>
          <Input id="discordId" value={discordId} onChange={(e) => setDiscordId(e.target.value)} placeholder="username#0000 or numeric ID" className={inputCls} />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-zinc-300">Type of Issue <span className="text-red-400">*</span></Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ISSUE_TYPES.map((t) => {
            const Icon = typeIcons[t]
            const active = type === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'border-zinc-100 bg-zinc-100 text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.15)]'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/60',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {t}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subject" className="text-zinc-300">Subject <span className="text-red-400">*</span></Label>
        <Input id="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary of the problem" maxLength={200} className={inputCls} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body" className="text-zinc-300">Describe the Issue <span className="text-red-400">*</span></Label>
        <Textarea id="body" required value={body} onChange={(e) => setBody(e.target.value)} placeholder="What happened? What did you expect? Include error messages, screenshots links, affected product (chat / API / subscription)…" rows={5} className={cn(inputCls, 'min-h-[120px] resize-y')} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reproduction" className="text-zinc-300">How to Re-create the Issue <span className="text-red-400">*</span></Label>
        <Textarea id="reproduction" required value={reproduction} onChange={(e) => setReproduction(e.target.value)} placeholder={'Step 1: Go to …\nStep 2: Click …\nStep 3: See error …'} rows={4} className={cn(inputCls, 'min-h-[96px] resize-y')} />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs text-zinc-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          Your secret access token is generated once and shown after submission — store it safely.
        </p>
        <Button type="submit" disabled={busy} className="min-h-11 bg-zinc-100 text-zinc-900 hover:bg-white sm:min-w-[160px]">
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Submit Ticket
        </Button>
      </div>
    </form>
  )
}

export function CopyField({ label, value, mono = true, danger = false }: { label: string; value: string; mono?: boolean; danger?: boolean }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = value
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="flex items-stretch gap-2">
        <div className={cn('flex-1 truncate rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm text-zinc-100', mono && 'font-mono')}>
          {value}
        </div>
        <Button type="button" variant="outline" size="icon" onClick={copy} aria-label={`Copy ${label}`} className="shrink-0 border-zinc-800 bg-zinc-900 hover:bg-zinc-800">
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      {danger && <p className="text-xs text-red-400/90">⚠ This token is shown only once. Save it now — you need it to sign back in.</p>}
    </div>
  )
}
