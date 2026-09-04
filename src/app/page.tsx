'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SubmitForm, type CreateTicketResponse, type SubmitIdentity } from '@/components/helpdesk/submit-form'
import { ConfirmationCard, type ConfirmationData } from '@/components/helpdesk/confirmation'
import { LoginView, type LoginSuccess } from '@/components/helpdesk/login-view'
import { UserDash } from '@/components/helpdesk/user-dash'
import { StaffDash, type RosterMember } from '@/components/helpdesk/staff-dash'
import { TicketThread } from '@/components/helpdesk/ticket-thread'
import { SetupWizard } from '@/components/helpdesk/setup-wizard'
import { useToast } from '@/hooks/use-toast'
import type { Ticket } from '@/lib/helpdesk/types'
import { Headset, LifeBuoy, ShieldCheck, Send, Fingerprint, Ticket as TicketIcon, Github, Zap } from 'lucide-react'

 type View = 'home' | 'confirm' | 'login' | 'user' | 'staff' | 'detail'

 interface SessionState {
  token: string
  role: 'user' | 'staff'
  profile: { zaiId?: string; fullName?: string; username?: string; displayName?: string; staffRole?: string; mustChangePassword?: boolean }
}

const SESSION_KEY = 'ryzendesk_session'
const LEGACY_SESSION_KEY = 'zai_helpdesk_session'

export default function Home() {
  const { toast } = useToast()
  const [view, setView] = useState<View>('home')
  const [session, setSession] = useState<SessionState | null>(null)
  const [userTickets, setUserTickets] = useState<Ticket[]>([])
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null)
  const [identity, setIdentity] = useState<SubmitIdentity | null>(null)
  const [roster, setRoster] = useState<RosterMember[]>([])

  /* ---------------------------- session storage ---------------------------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY) || localStorage.getItem(LEGACY_SESSION_KEY)
      if (raw) {
        const s = JSON.parse(raw) as SessionState
        if (s && s.token && (s.role === 'user' || s.role === 'staff')) {
          setSession(s)
          setView(s.role === 'staff' ? 'staff' : 'user')
          localStorage.setItem(SESSION_KEY, JSON.stringify(s))
          localStorage.removeItem(LEGACY_SESSION_KEY)
          // Validate staff sessions against the live DB (role changes / suspensions).
          if (s.role === 'staff') {
            void (async () => {
              try {
                const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${s.token}` } })
                if (!res.ok) {
                  persistSession(null)
                  setView('home')
                  return
                }
                const d = (await res.json()) as { profile: { username?: string; displayName?: string; staffRole?: string; mustChangePassword?: boolean } }
                setSession((prev) => (prev && prev.token === s.token ? { ...prev, profile: { ...prev.profile, ...d.profile } } : prev))
              } catch {
                // network hiccup — keep session
              }
            })()
          }
        } else {
          localStorage.removeItem(SESSION_KEY)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  const persistSession = useCallback((s: SessionState | null) => {
    setSession(s)
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
      else localStorage.removeItem(SESSION_KEY)
    } catch {
      // ignore
    }
  }, [])

  /* -------------------------------- loading -------------------------------- */
  const loadUserTickets = useCallback(async (token: string) => {
    setTicketsLoading(true)
    try {
      const res = await fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = (await res.json()) as { tickets: Ticket[] }
        setUserTickets(data.tickets || [])
      } else {
        persistSession(null)
        setView('home')
      }
    } finally {
      setTicketsLoading(false)
    }
  }, [persistSession])

  const openTicketDetail = useCallback(async (id: string) => {
    if (!session) return
    setDetailLoading(true)
    setView('detail')
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      })
      if (res.ok) {
        const data = (await res.json()) as { ticket: Ticket }
        setDetailTicket(data.ticket)
      } else {
        toast({ title: 'Could not load ticket', description: 'It may have been closed or removed.', variant: 'destructive' })
        setView(session.role === 'staff' ? 'staff' : 'user')
      }
    } finally {
      setDetailLoading(false)
    }
  }, [session, toast])

  useEffect(() => {
    if (session?.role === 'user' && view === 'user') void loadUserTickets(session.token)
  }, [session, view, loadUserTickets])

  /* --------------------------------- actions -------------------------------- */
  async function replyToTicket(body: string, visibility: 'public' | 'internal'): Promise<boolean> {
    if (!session || !detailTicket) return false
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(detailTicket.id)}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ body, visibility }),
      })
      const data = (await res.json()) as { ticket?: Ticket; error?: string }
      if (!res.ok || !data.ticket) {
        toast({ title: 'Reply failed', description: data.error || 'Please try again.', variant: 'destructive' })
        return false
      }
      setDetailTicket(data.ticket)
      if (session.role === 'user') void loadUserTickets(session.token)
      toast({ title: visibility === 'internal' ? 'Internal note saved' : 'Reply sent' })
      return true
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
      return false
    }
  }

  async function updateTicket(patch: { status?: string; priority?: string; assignee?: string | null; team?: string }): Promise<boolean> {
    if (!session || !detailTicket || session.role !== 'staff') return false
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(detailTicket.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify(patch),
      })
      const data = (await res.json()) as { ticket?: Ticket; error?: string }
      if (!res.ok || !data.ticket) {
        toast({ title: 'Update failed', description: data.error || 'Please try again.', variant: 'destructive' })
        return false
      }
      setDetailTicket(data.ticket)
      toast({ title: 'Ticket updated' })
      return true
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
      return false
    }
  }

  async function escalateTicket(toMember: string, toTeam: string, reason: string): Promise<boolean> {
    if (!session || !detailTicket || session.role !== 'staff') return false
    try {
      const res = await fetch(`/api/tickets/${encodeURIComponent(detailTicket.id)}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
        body: JSON.stringify({ toMember, toTeam, reason }),
      })
      const data = (await res.json()) as { ticket?: Ticket; error?: string }
      if (!res.ok || !data.ticket) {
        toast({ title: 'Escalation failed', description: data.error || 'Please try again.', variant: 'destructive' })
        return false
      }
      setDetailTicket(data.ticket)
      toast({ title: `Ticket escalated to ${toMember}`, description: 'Priority raised and the target member notified.' })
      return true
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
      return false
    }
  }

  function onCreated(res: CreateTicketResponse) {
    setConfirmation({ ticketId: res.ticketId, token: res.token, user: res.user, ticket: res.ticket })
    setIdentity({ zaiId: res.user.zaiId, fullName: res.user.fullName, email: res.user.email, discordId: res.user.discordId })
    persistSession({ token: res.session, role: 'user', profile: { zaiId: res.user.zaiId, fullName: res.user.fullName } })
    setView('confirm')
  }

  function onLoginSuccess(r: LoginSuccess) {
    persistSession({ token: r.session, role: r.role, profile: r.profile })
    toast({ title: `Welcome back, ${r.profile.fullName || r.profile.displayName || 'there'}!` })
    setView(r.role === 'staff' ? 'staff' : 'user')
  }

  function logout() {
    persistSession(null)
    setUserTickets([])
    setDetailTicket(null)
    setIdentity(null)
    setRoster([])
    setView('home')
    toast({ title: 'Signed out' })
  }

  function goHome() {
    setView(session ? (session.role === 'staff' ? 'staff' : 'user') : 'home')
  }

  function startNewTicket() {
    if (session?.role === 'user') setIdentity({ zaiId: session.profile.zaiId || '', fullName: session.profile.fullName || '', email: '', discordId: '' })
    setView('home')
  }

  /* ---------------------------------- render --------------------------------- */
  const navBtn = 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/70 min-h-9'
  // Forced first-login setup: staff flagged mustChangePassword cannot see anything else.
  const setupForced = session?.role === 'staff' && Boolean(session.profile.mustChangePassword)

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-zinc-100">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-[#0a0a0a]/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <button onClick={goHome} className="flex items-center gap-2.5" aria-label="RyzenDesk home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="RyzenDesk logo" className="h-8 w-8 rounded-lg" />
            <span className="text-base font-semibold tracking-tight">Ryzen<span className="text-orange-400">Desk</span></span>
          </button>
          <nav className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={goHome} className={navBtn}>
              <Headset className="mr-1.5 h-4 w-4" /> Home
            </Button>
            {session?.role === 'user' && (
              <Button variant="ghost" size="sm" onClick={() => setView('user')} className={navBtn}>
                <TicketIcon className="mr-1.5 h-4 w-4" /> My Tickets
              </Button>
            )}
            {session?.role === 'staff' && (
              <Button variant="ghost" size="sm" onClick={() => setView('staff')} className={navBtn}>
                <ShieldCheck className="mr-1.5 h-4 w-4" /> Console
              </Button>
            )}
            {!session && (
              <Button size="sm" onClick={() => setView('login')} className="min-h-9 bg-zinc-100 text-zinc-900 hover:bg-white">
                <Fingerprint className="mr-1.5 h-4 w-4" /> Sign in
              </Button>
            )}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {setupForced && session ? (
          <SetupWizard
            username={session.profile.username || 'admin'}
            token={session.token}
            onDone={(p) => {
              setSession((prev) => (prev ? { ...prev, profile: { ...prev.profile, ...p } } : prev))
              setView('staff')
              toast({ title: 'Setup complete', description: 'Your password is set — welcome aboard!' })
            }}
          />
        ) : (
        <>
        {view === 'home' && (
          <div className="space-y-10">
            {/* Hero */}
            <section className="text-center">
              <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-1.5 text-xs text-zinc-400">
                <Zap className="h-3.5 w-3.5 text-orange-400" /> Free &amp; open-source · Token-based support desk
              </div>
              <h1 className="mx-auto max-w-2xl text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
                Submit a ticket.
                <br />
                <span className="text-zinc-400">We&apos;ve got you covered.</span>
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-base text-zinc-400">
                Billing, service, technical or security — your support team is notified instantly
                on Telegram. Customers track everything with a personal access token — no passwords required.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Button size="lg" onClick={() => document.getElementById('submit-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="min-h-11 bg-zinc-100 text-zinc-900 hover:bg-white">
                  <LifeBuoy className="mr-2 h-4 w-4" /> Create a ticket
                </Button>
                <Button size="lg" variant="outline" onClick={() => setView('login')} className="min-h-11 border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800">
                  <Fingerprint className="mr-2 h-4 w-4" /> I have a token
                </Button>
              </div>
            </section>

            {/* How it works */}
            <section className="grid gap-4 sm:grid-cols-3">
              {[
                { icon: LifeBuoy, title: '1 · Submit', text: 'Fill in your User ID, contact details and describe the issue with re-creation steps.' },
                { icon: Fingerprint, title: '2 · Get your token', text: 'Receive a Ticket ID + secret access token instantly. Both are required to sign back in.' },
                { icon: Send, title: '3 · Track & chat', text: 'Sign in with User ID + token anytime. Staff replies arrive here and on Telegram.' },
              ].map((s) => (
                <div key={s.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                  <s.icon className="mb-3 h-5 w-5 text-orange-400" />
                  <h3 className="font-semibold text-zinc-100">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">{s.text}</p>
                </div>
              ))}
            </section>

            {/* Form */}
            <section id="submit-form" className="mx-auto max-w-3xl scroll-mt-24">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-semibold">Ticket submission</h2>
                <p className="mt-1 text-sm text-zinc-500">Fields marked <span className="text-red-400">*</span> are required</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-8">
                <SubmitForm identity={identity} onCreated={onCreated} />
              </div>
            </section>
          </div>
        )}

        {view === 'confirm' && confirmation && (
          <ConfirmationCard
            data={confirmation}
            onGoToTickets={() => setView('user')}
            onNewTicket={() => { setConfirmation(null); startNewTicket() }}
          />
        )}

        {view === 'login' && <LoginView onSuccess={onLoginSuccess} onBack={goHome} />}

        {view === 'user' && session?.role === 'user' && (
          <UserDash
            profile={session.profile}
            tickets={userTickets}
            loading={ticketsLoading}
            onOpenTicket={(id) => void openTicketDetail(id)}
            onNewTicket={startNewTicket}
            onLogout={logout}
            sessionToken={session.token}
          />
        )}

        {view === 'staff' && session?.role === 'staff' && (
          <StaffDash
            profile={session.profile}
            token={session.token}
            onOpenTicket={(id) => void openTicketDetail(id)}
            onLogout={logout}
            onRoster={setRoster}
          />
        )}

        {view === 'detail' && (
          detailLoading ? (
            <div className="mx-auto max-w-4xl space-y-4">
              <div className="h-10 w-40 animate-pulse rounded-lg bg-zinc-900" />
              <div className="h-48 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
              <div className="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/40" />
            </div>
          ) : detailTicket && session ? (
            <TicketThread
              ticket={detailTicket}
              viewer={session.role}
              onBack={() => setView(session.role === 'staff' ? 'staff' : 'user')}
              onReply={replyToTicket}
              onUpdate={session.role === 'staff' ? updateTicket : undefined}
              onEscalate={session.role === 'staff' ? escalateTicket : undefined}
              roster={roster}
            />
          ) : (
            <p className="text-center text-zinc-500">Ticket not found.</p>
          )
        )}
        </>
        )}
      </main>

      {/* Footer — sticks to bottom */}
      <footer className="mt-auto border-t border-zinc-800/80 bg-[#0a0a0a] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-zinc-500 sm:flex-row sm:px-6">
          <p className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="RyzenDesk logo" className="h-5 w-5 rounded" />
            <span>Ryzen<span className="font-semibold text-zinc-400">Desk</span> — free &amp; open-source token-based helpdesk</span>
          </p>
          <p className="flex items-center gap-1.5">
            <Github className="h-3.5 w-3.5" /> Data auto-synced to your GitHub repo · Telegram notifications built-in
          </p>
        </div>
      </footer>
    </div>
  )
}
