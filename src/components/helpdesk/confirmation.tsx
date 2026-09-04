'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CopyField } from './submit-form'
import { cn } from '@/lib/utils'
import { CheckCircle2, ArrowRight, PlusCircle, Send, KeyRound, Fingerprint, RotateCcw } from 'lucide-react'

export interface ConfirmationData {
  ticketId: string
  token: string
  user: { zaiId: string; fullName: string; email: string; discordId: string }
  ticket: { id: string; subject: string; type: string; priority: string }
}

export function ConfirmationCard({
  data,
  onGoToTickets,
  onNewTicket,
}: {
  data: ConfirmationData
  onGoToTickets: () => void
  onNewTicket: () => void
}) {
  const [saved, setSaved] = useState(false)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-2xl border border-emerald-500/25 bg-zinc-900/60 shadow-[0_0_60px_rgba(16,185,129,0.08)]">
        <div className="border-b border-zinc-800 bg-emerald-500/5 px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10">
            <CheckCircle2 className="h-9 w-9 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-semibold text-zinc-100">Ticket created successfully</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Our staff has been notified. Keep the details below to track your ticket.
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <CopyField label="Ticket ID" value={data.ticketId} />
            <CopyField label="Secret Access Token" value={data.token} danger />
          </div>

          <Separator className="bg-zinc-800" />

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <KeyRound className="h-4 w-4 text-zinc-400" /> How to sign back in
            </h3>
            <ol className="list-inside list-decimal space-y-1.5 text-sm text-zinc-400">
              <li>Open RyzenDesk and choose <span className="text-zinc-200">Sign in</span>.</li>
              <li>Enter your User ID: <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-200">{data.user.zaiId}</code></li>
              <li>Paste your Secret Access Token: <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-200">{data.token.slice(0, 10)}…</code></li>
              <li>You&apos;ll see all your tickets and can open new ones anytime.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
              <Send className="h-4 w-4 text-zinc-400" /> Get updates on Telegram (optional)
            </h3>
            <p className="text-sm text-zinc-400">
              Message our bot the command below once — you&apos;ll get instant notifications about replies and status changes:
            </p>
            <code className="mt-2 block overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-xs text-emerald-300">/link {data.token}</code>
          </div>

          <Separator className="bg-zinc-800" />

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-amber-400"
            />
            <span className="text-sm text-amber-200/90">
              I have saved my Ticket ID and Secret Access Token in a safe place.
            </span>
          </label>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={onGoToTickets}
              disabled={!saved}
              className={cn(
                'min-h-11 flex-1 bg-zinc-100 text-zinc-900 hover:bg-white',
                !saved && 'cursor-not-allowed opacity-40',
              )}
            >
              <Fingerprint className="mr-2 h-4 w-4" /> Go to My Tickets
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button onClick={onNewTicket} variant="outline" className="min-h-11 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800">
              <PlusCircle className="mr-2 h-4 w-4" /> Submit Another
            </Button>
          </div>
          {!saved && (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-zinc-500">
              <RotateCcw className="h-3 w-3" /> Tick the confirmation box above to continue — it protects you from losing access.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
