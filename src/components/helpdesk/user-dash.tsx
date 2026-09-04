'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge, PriorityBadge, TypeBadge } from './badges'
import { TelegramCard } from './telegram-card'
import { ChatWidget } from './chat-widget'
import { dateFnsFormat } from './format'
import type { Ticket } from '@/lib/helpdesk/types'
import { cn } from '@/lib/utils'
import { PlusCircle, MessageSquare, ChevronRight, LogOut } from 'lucide-react'

export interface BotInfo {
  username: string | null
  mode: string
  linkedStaff: number
  linkedUsers: number
  lastError: string | null
}

export function useBotInfo() {
  const [bot, setBot] = useState<BotInfo | null>(null)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch('/api/telegram/webhook')
        const data = (await res.json()) as BotInfo
        if (alive) setBot(data)
      } catch {
        // ignore
      }
    }
    void load()
    const t = setInterval(load, 20_000)
    return () => {
      alive = false
      clearInterval(t)
    }
  }, [])
  return bot
}

export function UserDash({
  profile,
  tickets,
  loading,
  onOpenTicket,
  onNewTicket,
  onLogout,
  sessionToken,
}: {
  profile: { zaiId?: string; fullName?: string }
  tickets: Ticket[]
  loading: boolean
  onOpenTicket: (id: string) => void
  onNewTicket: () => void
  onLogout: () => void
  sessionToken?: string
}) {
  const bot = useBotInfo()
  const openCount = tickets.filter((t) => !['resolved', 'closed'].includes(t.status)).length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-100">My Tickets</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            {profile.fullName} · <span className="font-mono">{profile.zaiId}</span> · {openCount} active / {tickets.length} total
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onNewTicket} className="min-h-10 bg-zinc-100 text-zinc-900 hover:bg-white">
            <PlusCircle className="mr-2 h-4 w-4" /> New Ticket
          </Button>
          <Button onClick={onLogout} variant="outline" className="min-h-10 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>

      <TelegramCard
        botUsername={bot?.username || null}
        command="/link <your zt_… token>"
        title="Telegram notifications"
        description="Link this account to get pinged the moment support replies:"
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-14 text-center">
          <MessageSquare className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="font-medium text-zinc-300">No tickets yet</p>
          <p className="mt-1 text-sm text-zinc-500">Open your first support ticket and we&apos;ll get right on it.</p>
          <Button onClick={onNewTicket} className="mt-5 bg-zinc-100 text-zinc-900 hover:bg-white">
            <PlusCircle className="mr-2 h-4 w-4" /> Create a ticket
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => onOpenTicket(t.id)}
              className={cn(
                'group flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 text-left transition-all',
                'hover:border-zinc-600 hover:bg-zinc-800/60',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-zinc-400">{t.id}</span>
                  <StatusBadge status={t.status} />
                  <PriorityBadge priority={t.priority} />
                  <TypeBadge type={t.type} />
                </div>
                <p className="mt-1.5 truncate font-medium text-zinc-100">{t.subject}</p>
                <p className="mt-0.5 text-xs text-zinc-500">Updated {dateFnsFormat(t.updatedAt)} · {t.messages.length} messages</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-300" />
            </button>
          ))}
        </div>
      )}

      {/* Floating live chat (renders itself only while support has it enabled) */}
      {sessionToken && <ChatWidget token={sessionToken} fullName={profile.fullName} />}
    </div>
  )
}
