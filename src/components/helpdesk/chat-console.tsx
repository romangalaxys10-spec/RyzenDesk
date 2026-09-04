'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { ChatSession } from '@/lib/helpdesk/types'
import { cn } from '@/lib/utils'
import { dateFnsFormat } from './format'
import { Loader2, MessagesSquare, Hand, PhoneOff, RefreshCw, Send, CircleDot, User } from 'lucide-react'

export function ChatConsole({ token, me }: { token: string; me: string }) {
  const [chats, setChats] = useState<ChatSession[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/chats', { headers: authHeaders, cache: 'no-store' })
      if (res.ok) {
        const data = (await res.json()) as { chats: ChatSession[] }
        setChats(data.chats || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => {
    void load()
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') void load() }, 3000)
    return () => clearInterval(t)
  }, [load])

  const active = chats.find((c) => c.id === activeId) || null

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [active?.messages.length, activeId])

  async function claim(chatId: string) {
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ action: 'claim' }),
    })
    if (res.ok) {
      const data = (await res.json()) as { chat: ChatSession }
      setChats((prev) => prev.map((c) => (c.id === chatId ? data.chat : c)))
      setActiveId(chatId)
    }
  }

  async function end(chatId: string) {
    const res = await fetch(`/api/chats/${encodeURIComponent(chatId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ action: 'end' }),
    })
    if (res.ok) {
      const data = (await res.json()) as { chat: ChatSession }
      setChats((prev) => prev.map((c) => (c.id === chatId ? data.chat : c)))
    }
  }

  async function send() {
    if (!active || !draft.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(active.id)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ body: draft.trim() }),
      })
      const data = (await res.json()) as { chat?: ChatSession; error?: string }
      if (res.ok && data.chat) {
        setChats((prev) => prev.map((c) => (c.id === active.id ? data.chat! : c)))
        setDraft('')
      }
    } finally {
      setSending(false)
    }
  }

  const waiting = chats.filter((c) => c.status === 'waiting')
  const activeChats = chats.filter((c) => c.status === 'active')
  const ended = chats.filter((c) => c.status === 'ended').slice(0, 10)

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Chat list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">Conversations</h3>
          <Button variant="ghost" size="sm" onClick={() => void load()} className="h-8 text-zinc-500 hover:text-zinc-200">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ChatGroup
          title={`Waiting (${waiting.length})`}
          tone="text-amber-400"
          chats={waiting}
          loading={loading}
          activeId={activeId}
          onSelect={setActiveId}
          subtitle={(c) => 'Unclaimed — respond now'}
        />
        <ChatGroup
          title={`Active (${activeChats.length})`}
          tone="text-emerald-400"
          chats={activeChats}
          loading={false}
          activeId={activeId}
          onSelect={setActiveId}
          subtitle={(c) => (c.staffUsername === me ? 'Yours' : `Agent: ${c.staffUsername || '—'}`)}
        />
        <ChatGroup
          title={`Recent ended (${ended.length})`}
          tone="text-zinc-500"
          chats={ended}
          loading={false}
          activeId={activeId}
          onSelect={setActiveId}
          subtitle={(c) => `Ended by ${c.endedBy || '—'}`}
        />
      </div>

      {/* Conversation */}
      {active ? (
        <div className="flex h-[600px] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60">
          <div className="flex flex-wrap items-center gap-3 border-b border-zinc-800 bg-zinc-950/50 px-4 py-3">
            <User className="h-4 w-4 text-zinc-500" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-zinc-100">{active.userName}</div>
              <div className="truncate font-mono text-[11px] text-zinc-500">{active.zaiId}</div>
            </div>
            <Badge variant="outline" className={cn(
              'ml-auto rounded-full',
              active.status === 'waiting' && 'border-amber-500/30 bg-amber-500/10 text-amber-400',
              active.status === 'active' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
              active.status === 'ended' && 'border-zinc-700 bg-zinc-900 text-zinc-500',
            )}>
              {active.status === 'waiting' ? 'Waiting' : active.status === 'active' ? 'Active' : 'Ended'}
            </Badge>
            <span className="text-[11px] text-zinc-600">started {dateFnsFormat(active.createdAt)}</span>
            {active.status !== 'ended' && (
              <div className="flex gap-2">
                {active.staffUsername !== me && (
                  <Button size="sm" onClick={() => void claim(active.id)} className="h-8 bg-emerald-500 text-zinc-950 hover:bg-emerald-400">
                    <Hand className="mr-1.5 h-3.5 w-3.5" /> Claim
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => void end(active.id)} className="h-8 border-zinc-800 bg-zinc-900 hover:bg-zinc-800">
                  <PhoneOff className="mr-1.5 h-3.5 w-3.5" /> End
                </Button>
              </div>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
            {active.messages.map((m) => {
              if (m.from === 'system') {
                return <div key={m.id} className="text-center text-[11px] text-zinc-600">{m.body}</div>
              }
              const mine = m.from === 'staff'
              return (
                <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm',
                    mine
                      ? 'rounded-br-sm border border-sky-500/25 bg-sky-500/10 text-sky-50'
                      : 'rounded-bl-sm border border-zinc-800 bg-zinc-900 text-zinc-100',
                  )}>
                    <div className={cn('mb-0.5 text-[10px] font-semibold', mine ? 'text-sky-300' : 'text-emerald-300')}>
                      {m.author}{!mine && ' (client)'}
                    </div>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <div className="mt-1 text-right text-[10px] text-zinc-600">{dateFnsFormat(m.at)}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {active.status !== 'ended' ? (
            <div className="flex items-end gap-2 border-t border-zinc-800 p-3">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                placeholder={active.status === 'waiting' ? 'Claim the chat to reply…' : 'Reply to the client… (Enter to send)'}
                rows={1}
                disabled={active.status === 'waiting'}
                className="max-h-28 min-h-[42px] flex-1 resize-none border-zinc-800 bg-zinc-950/60 text-sm text-zinc-100 placeholder:text-zinc-600"
              />
              <Button
                onClick={() => void send()}
                disabled={sending || !draft.trim() || active.status === 'waiting'}
                size="icon"
                className="h-[42px] w-[42px] shrink-0 bg-sky-500 text-zinc-950 hover:bg-sky-400"
                aria-label="Send reply"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <div className="border-t border-zinc-800 px-4 py-3 text-center text-xs text-zinc-500">
              This chat has ended. The client can start a new one anytime.
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-[600px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-800 text-center">
          <MessagesSquare className="h-10 w-10 text-zinc-600" />
          <p className="text-sm text-zinc-500">Select a conversation to view it.</p>
          <p className="flex items-center gap-1.5 text-xs text-zinc-600">
            <CircleDot className="h-3 w-3 text-emerald-500" /> Auto-refreshes every 3 seconds
          </p>
        </div>
      )}
    </div>
  )
}

function ChatGroup({
  title,
  tone,
  chats,
  loading,
  activeId,
  onSelect,
  subtitle,
}: {
  title: string
  tone: string
  chats: ChatSession[]
  loading: boolean
  activeId: string | null
  onSelect: (id: string) => void
  subtitle: (c: ChatSession) => string
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-4 text-center text-xs text-zinc-600">
        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
      </div>
    )
  }
  if (chats.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-800/70 px-3 py-2.5 text-[11px] text-zinc-600">
        {title} — none
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      <div className={cn('px-1 text-[11px] font-semibold uppercase tracking-wide', tone)}>{title}</div>
      {chats.map((c) => {
        const last = [...c.messages].reverse().find((m) => m.from !== 'system')
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
              activeId === c.id
                ? 'border-zinc-600 bg-zinc-800/70'
                : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-800/40',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-zinc-100">{c.userName}</span>
              {c.status === 'waiting' && <span className="ml-auto h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />}
              {c.status === 'active' && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-emerald-400" />}
            </div>
            <div className="mt-0.5 truncate text-xs text-zinc-500">{last ? last.body : 'No messages yet'}</div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-600">
              <span className="font-mono">{c.id}</span>
              <span>{dateFnsFormat(c.updatedAt)}</span>
            </div>
            <div className="mt-0.5 truncate text-[10px] text-zinc-600">{subtitle(c)}</div>
          </button>
        )
      })}
    </div>
  )
}
