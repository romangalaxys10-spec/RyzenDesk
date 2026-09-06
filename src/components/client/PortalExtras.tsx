import React, { useEffect, useRef, useState } from 'react'
import { Megaphone, Activity, Download, MessageCircle, X, Send, CheckCircle2, AlertTriangle, Wrench } from 'lucide-react'

/* --------------------------------------------------------------------------
   Portal Extras: Announcements + Network Status + Downloads + Live Chat
   All data comes from the public content endpoints — zero auth required.
   -------------------------------------------------------------------------- */

interface Announcement { id: string; title: string; body: string; published: boolean; createdAt: string }
interface StatusComponent { id: string; name: string; status: 'operational' | 'degraded' | 'outage' | 'maintenance'; description?: string; updatedAt: string }
interface DownloadItem { id: string; title: string; description: string; url: string; published: boolean }
interface ChatThread { id: string; status: string; messages: Array<{ id: string; from: string; author: string; body: string; at: string }> }

const STATUS_STYLE: Record<string, { icon: typeof CheckCircle2; cls: string }> = {
  operational: { icon: CheckCircle2, cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  degraded: { icon: AlertTriangle, cls: 'text-amber-600 bg-amber-50 border-amber-200' },
  outage: { icon: AlertTriangle, cls: 'text-rose-600 bg-rose-50 border-rose-200' },
  maintenance: { icon: Wrench, cls: 'text-sky-600 bg-sky-50 border-sky-200' },
}

export const PortalExtras: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [status, setStatus] = useState<{ overall: string; components: StatusComponent[] } | null>(null)
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [chatOpen, setChatOpen] = useState(false)

  useEffect(() => {
    fetch('/api/announcements').then((r) => r.json()).then(setAnnouncements).catch(() => {})
    fetch('/api/status-page').then((r) => r.json()).then(setStatus).catch(() => {})
    fetch('/api/downloads').then((r) => r.json()).then(setDownloads).catch(() => {})
  }, [])

  return (
    <>
      <div className="grid md:grid-cols-3 gap-4">
        {/* Announcements */}
        <section className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-2">
            <Megaphone className="w-4 h-4 text-amber-400" /> Announcements
          </h3>
          {announcements.length === 0 ? (
            <p className="text-xs text-slate-500">No announcements right now.</p>
          ) : (
            <ul className="space-y-2">
              {announcements.slice(0, 3).map((a) => (
                <li key={a.id} className="text-xs">
                  <p className="font-semibold text-slate-300">{a.title}</p>
                  <p className="text-slate-500 line-clamp-2">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Network Status */}
        <section className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-2">
            <Activity className="w-4 h-4 text-emerald-400" /> Network Status
          </h3>
          {!status ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : (
            <ul className="space-y-1.5">
              {status.components.map((c) => {
                const st = STATUS_STYLE[c.status] || STATUS_STYLE.operational
                const Icon = st.icon
                return (
                  <li key={c.id} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg border ${st.cls}`}>
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-semibold">{c.name}</span>
                    <span className="ml-auto capitalize">{c.status}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Downloads */}
        <section className="bg-slate-900/60 rounded-xl border border-slate-800 p-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-200 mb-2">
            <Download className="w-4 h-4 text-sky-400" /> Downloads
          </h3>
          {downloads.length === 0 ? (
            <p className="text-xs text-slate-500">No downloads available.</p>
          ) : (
            <ul className="space-y-2">
              {downloads.slice(0, 3).map((d) => (
                <li key={d.id}>
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1">
                    {d.title} <External3 />
                  </a>
                  <p className="text-[11px] text-slate-500 line-clamp-1">{d.description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <LiveChatWidget open={chatOpen} setOpen={setChatOpen} />
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-20 right-4 lg:bottom-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/40 transition-transform hover:scale-105"
          aria-label="Open live chat"
        >
          <MessageCircle className="w-4 h-4" /> Live Chat
        </button>
      )}
    </>
  )
}

const External3 = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
)

/* --------------------------------------------------------------------------
   Live chat widget — anonymous or logged-in customers, REST polling (4s)
   -------------------------------------------------------------------------- */

export const LiveChatWidget: React.FC<{ open: boolean; setOpen: (v: boolean) => void }> = ({ open, setOpen }) => {
  const [thread, setThread] = useState<ChatThread | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const threadRef = useRef<ChatThread | null>(null)
  threadRef.current = thread

  // Poll while the chat is open
  useEffect(() => {
    if (!open || !thread?.id) return
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/chat/${thread.id}/messages`)
        if (res.ok) setThread(await res.json())
      } catch { /* ignore */ }
    }, 4000)
    return () => clearInterval(t)
  }, [open, thread?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread?.messages?.length])

  const start = async () => {
    if (!email.trim()) return
    setStarting(true)
    setError(null)
    try {
      const res = await fetch('/api/chat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start chat')
      setThread(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  const send = async () => {
    if (!draft.trim() || !thread?.id) return
    const body = draft
    setDraft('')
    try {
      const res = await fetch(`/api/chat/${thread.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      })
      if (res.ok) setThread(await res.json())
    } catch { /* ignore */ }
  }

  if (!open) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[92vw] max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900 flex flex-col" style={{ height: 440 }}>
      <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
        <span className="flex items-center gap-2 text-sm font-bold text-white"><MessageCircle className="w-4 h-4 text-emerald-400" /> Live Chat</span>
        <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      {!thread ? (
        <div className="p-4 space-y-3 text-xs">
          <p className="text-slate-400">Have a question before opening a ticket? Chat with our team.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" type="email" className="w-full p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          {error && <p className="text-rose-400">{error}</p>}
          <button onClick={start} disabled={starting || !email.trim()} className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-semibold">
            {starting ? 'Starting…' : 'Start Chat'}
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {thread.messages.map((m) => (
              <div key={m.id} className={`max-w-[85%] px-3 py-1.5 rounded-xl text-xs ${m.from === 'staff' ? 'ml-auto bg-emerald-700 text-white' : 'bg-slate-800 text-slate-200'}`}>
                <p className="font-semibold text-[10px] opacity-70 mb-0.5">{m.author}</p>
                {m.body}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="p-2 border-t border-slate-800 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={thread.status === 'open' ? 'Type a message…' : 'Chat closed'}
              disabled={thread.status !== 'open'}
              className="flex-1 p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button onClick={send} disabled={thread.status !== 'open' || !draft.trim()} className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white" aria-label="Send">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}