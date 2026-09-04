'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ChatSession } from '@/lib/helpdesk/types'
import { cn } from '@/lib/utils'
import { dateFnsFormat } from './format'
import { MessageCircle, X, Send, Loader2, MessagesSquare, LogOut, Headset } from 'lucide-react'

interface ChatsResponse {
  chats?: ChatSession[]
  live?: ChatSession | null
  liveChatEnabled: boolean
  error?: string
}

/** Floating live-chat widget for signed-in clients. Renders nothing while chat is disabled. */
export function ChatWidget({ token, fullName }: { token: string; fullName?: string }) {
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [chat, setChat] = useState<ChatSession | null>(null)
  const [starting, setStarting] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const authHeaders = { Authorization: `Bearer ${token}` }

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/chats', { headers: authHeaders, cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as ChatsResponse
      setEnabled(Boolean(data.liveChatEnabled))
      setChat(data.live || null)
    } catch {
      // offline — keep last state
    }
  }, [token])

  useEffect(() => {
    void poll()
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') void poll() }, 4000)
    return () => clearInterval(t)
  }, [poll])

  // Fast polling while the panel is open and a chat is live
  useEffect(() => {
    if (!open || !chat || chat.status === 'ended') return
    const t = setInterval(() => { if (document.visibilityState !== 'hidden') void poll() }, 2000)
    return () => clearInterval(t)
  }, [open, chat, poll])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat?.messages.length, open])

  async function startChat() {
    setStarting(true)
    setError(null)
    try {
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'start' }),
      })
      const data = (await res.json()) as { chat?: ChatSession; error?: string }
      if (!res.ok || !data.chat) {
        setError(data.error || 'Could not start chat.')
        return
      }
      setChat(data.chat)
    } catch {
      setError('Network error.')
    } finally {
      setStarting(false)
    }
  }

  async function send() {
    if (!chat || !draft.trim()) return
    setSending(true)
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chat.id)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ body: draft.trim() }),
      })
      const data = (await res.json()) as { chat?: ChatSession; error?: string }
      if (res.ok && data.chat) {
        setChat(data.chat)
        setDraft('')
      } else {
        setError(data.error || 'Message failed.')
      }
    } catch {
      setError('Network error.')
    } finally {
      setSending(false)
    }
  }

  async function endChat() {
    if (!chat) return
    try {
      const res = await fetch(`/api/chats/${encodeURIComponent(chat.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ action: 'end' }),
      })
      const data = (await res.json()) as { chat?: ChatSession }
      if (res.ok && data.chat) setChat(data.chat)
    } catch {
      // ignore
    }
  }

  if (!enabled && !chat) return null

  const agentName = chat?.staffUsername || null
  const statusLine =
    chat?.status === 'waiting'
      ? 'Waiting for an available agent…'
      : chat?.status === 'active'
        ? `Chatting with ${agentName}`
        : chat?.status === 'ended'
          ? `Chat ended${chat.endedBy ? ` by ${chat.endedBy}` : ''}`
          : ''

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close live chat' : 'Open live chat'}
        className={cn(
          'fixed bottom-5 right-5 z-50 flex h-13 min-h-[52px] items-center gap-2 rounded-full border px-5 py-3 text-sm font-semibold shadow-xl transition-all',
          open
            ? 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800'
            : 'border-orange-500/40 bg-orange-500 text-zinc-950 hover:bg-orange-400',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {open ? 'Close chat' : 'Live chat'}
        {!open && chat?.status === 'waiting' && (
          <span className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-pulse rounded-full border-2 border-[#0a0a0a] bg-amber-400" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-5 z-50 flex h-[520px] w-[min(380px,calc(100vw-40px))] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#0d0d0d] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-4 py-3">
            <Headset className="h-4 w-4 text-emerald-400" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-zinc-100">RyzenDesk Live Support</div>
              <div className="truncate text-[11px] text-zinc-500">{statusLine || 'Typically replies within minutes'}</div>
            </div>
            {chat && chat.status !== 'ended' && (
              <Button variant="ghost" size="sm" onClick={() => void endChat()} className="ml-auto h-8 text-zinc-500 hover:text-zinc-200">
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {!chat ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
              <MessagesSquare className="h-10 w-10 text-zinc-600" />
              <div>
                <p className="font-medium text-zinc-200">Need a quick answer?</p>
                <p className="mt-1 text-sm text-zinc-500">
                  Chat live with our support team{fullName ? `, ${fullName.split(' ')[0]}` : ''}. For complex issues, please open a ticket instead.
                </p>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <Button onClick={() => void startChat()} disabled={starting} className="min-h-10 bg-orange-500 text-zinc-950 hover:bg-orange-400">
                {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
                Start live chat
              </Button>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
                {chat.messages.map((m) => {
                  if (m.from === 'system') {
                    return (
                      <div key={m.id} className="text-center text-[11px] text-zinc-600">{m.body}</div>
                    )
                  }
                  const mine = m.from === 'user'
                  return (
                    <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm',
                        mine
                          ? 'rounded-br-sm bg-orange-500/15 text-orange-50 border border-orange-500/25'
                          : 'rounded-bl-sm border border-zinc-800 bg-zinc-900 text-zinc-100',
                      )}>
                        {!mine && <div className="mb-0.5 text-[10px] font-semibold text-zinc-500">{m.author} · Support</div>}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <div className="mt-1 text-right text-[10px] text-zinc-600">{dateFnsFormat(m.at)}</div>
                      </div>
                    </div>
                  )
                })}
                {chat.status === 'waiting' && chat.messages.length <= 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2 text-xs text-zinc-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Connecting you to an agent…
                  </div>
                )}
              </div>
              {chat.status !== 'ended' ? (
                <div className="border-t border-zinc-800 p-3">
                  {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void send()
                        }
                      }}
                      placeholder="Type a message… (Enter to send)"
                      rows={1}
                      className="max-h-28 min-h-[42px] flex-1 resize-none border-zinc-800 bg-zinc-950/60 text-sm text-zinc-100 placeholder:text-zinc-600"
                    />
                    <Button onClick={() => void send()} disabled={sending || !draft.trim()} size="icon" className="h-[42px] w-[42px] shrink-0 bg-orange-500 text-zinc-950 hover:bg-orange-400" aria-label="Send message">
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-zinc-800 p-4 text-center">
                  <Button onClick={() => { setChat(null); void startChat() }} className="min-h-9 bg-orange-500 text-zinc-950 hover:bg-orange-400">
                    <MessageCircle className="mr-2 h-4 w-4" /> Start new chat
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
