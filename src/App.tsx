import React, { useState, useEffect, useCallback } from 'react'
import { I18nProvider } from './i18n/translations'
import { useSyncManager, queueMutation } from './lib/sync'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { LoginScreen } from './components/auth/LoginScreen'
import { TicketList } from './components/helpdesk/TicketList'
import { TicketDetail } from './components/helpdesk/TicketDetail'
import { TicketSubmitModal } from './components/helpdesk/TicketSubmitModal'
import { KanbanModule } from './components/kanban/KanbanModule'
import { WikiModule } from './components/wiki/WikiModule'
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard'
import { AdminConsole } from './components/admin/AdminConsole'
import { CustomerPortal } from './components/client/CustomerPortal'
import { MobileNav } from './components/common/MobileNav'
import { ToastContainer } from './components/common/ToastContainer'
import { OfflineBanner } from './components/common/OfflineBanner'
import { CommandPalette } from './components/common/CommandPalette'
import { InstallationWizard } from './components/install/InstallationWizard'
import type {
  Ticket,
  SessionUser,
  KanbanBoard,
  KanbanCard,
  WikiSpace,
  WikiPage,
  StaffMember,
  StaffRole,
  RolePermissions,
  SLAPolicyConfig,
  SMTPSettings,
  WebhookConfig,
  WebhookDelivery,
  AuditLogEntry,
  EmailNotificationLog,
  CloudSyncStatus,
  CannedReply,
  InstallationSettings,
} from './types'

export function AppContent() {
  const syncManager = useSyncManager()
  const [activeTab, setActiveTab] = useState<
    'tickets' | 'kanban' | 'wiki' | 'analytics' | 'admin' | 'portal'
  >('tickets')

  // Session state — the authenticated identity comes from the server, never the client
  const [authChecked, setAuthChecked] = useState(false)
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [currentRole, setCurrentRole] = useState<StaffRole>('super_admin')
  const [currentUsername, setCurrentUsername] = useState('roman')

  // Installation & Setup Wizard State
  const [installationSettings, setInstallationSettings] = useState<InstallationSettings | null>(null)
  const [isInstallWizardOpen, setIsInstallWizardOpen] = useState(false)

  // Core Data Stores
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [kanbanBoards, setKanbanBoards] = useState<KanbanBoard[]>([])
  const [wikiSpaces, setWikiSpaces] = useState<WikiSpace[]>([])
  const [wikiPages, setWikiPages] = useState<WikiPage[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [rbacMatrix, setRbacMatrix] = useState<Record<StaffRole, RolePermissions>>({} as any)
  const [slaPolicies, setSlaPolicies] = useState<SLAPolicyConfig>({} as any)
  const [smtpSettings, setSmtpSettings] = useState<SMTPSettings>({} as any)
  const [emailLogs, setEmailLogs] = useState<EmailNotificationLog[]>([])
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([])
  const [webhookDeliveries, setWebhookDeliveries] = useState<WebhookDelivery[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [cannedReplies, setCannedReplies] = useState<CannedReply[]>([])
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>({
    configured: true,
    repo: 'romangalaxys10-spec/RyzenDesk',
    branch: 'main',
    path: 'data/helpdesk-db.json',
    sha: null,
    pendingChanges: false,
    pushing: false,
    isOnline: true,
    lastSyncAt: new Date().toISOString(),
    lastError: null,
  })

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [globalSearchTerm, setGlobalSearchTerm] = useState('')

  // Fetch initial state from server
  const fetchAllData = useCallback(async () => {
    try {
      const [
        tRes,
        kRes,
        wsRes,
        wpRes,
        sRes,
        rRes,
        slaRes,
        smtpRes,
        whRes,
        audRes,
        crRes,
        statRes,
        installRes,
      ] = await Promise.all([
        fetch('/api/tickets').then((r) => r.json()).catch(() => []),
        fetch('/api/kanban/boards').then((r) => r.json()).catch(() => []),
        fetch('/api/wiki/spaces').then((r) => r.json()).catch(() => []),
        fetch('/api/wiki/pages').then((r) => r.json()).catch(() => []),
        fetch('/api/admin/staff').then((r) => r.json()).catch(() => []),
        fetch('/api/admin/rbac').then((r) => r.json()).catch(() => ({})),
        fetch('/api/admin/sla').then((r) => r.json()).catch(() => ({})),
        fetch('/api/admin/smtp').then((r) => r.json()).catch(() => ({ smtp: {}, logs: [] })),
        fetch('/api/admin/webhooks').then((r) => r.json()).catch(() => ({ webhooks: [], deliveries: [] })),
        fetch('/api/admin/audit').then((r) => r.json()).catch(() => []),
        fetch('/api/canned-replies').then((r) => r.json()).catch(() => []),
        fetch('/api/system/status').then((r) => r.json()).catch(() => ({})),
        fetch('/api/install/status').then((r) => r.json()).catch(() => ({})),
      ])

      if (Array.isArray(tRes)) setTickets(tRes)
      if (Array.isArray(kRes)) setKanbanBoards(kRes)
      if (Array.isArray(wsRes)) setWikiSpaces(wsRes)
      if (Array.isArray(wpRes)) setWikiPages(wpRes)
      if (Array.isArray(sRes)) setStaffList(sRes)
      if (rRes && Object.keys(rRes).length > 0) setRbacMatrix(rRes)
      if (slaRes && Object.keys(slaRes).length > 0) setSlaPolicies(slaRes)
      if (smtpRes.smtp) {
        setSmtpSettings(smtpRes.smtp)
        setEmailLogs(smtpRes.logs || [])
      }
      if (whRes.webhooks) {
        setWebhooks(whRes.webhooks)
        setWebhookDeliveries(whRes.deliveries || [])
      }
      if (Array.isArray(audRes)) setAuditLogs(audRes)
      if (Array.isArray(crRes)) setCannedReplies(crRes)
      if (statRes.sync) setCloudSyncStatus(statRes.sync)
      if (installRes && installRes.settings) {
        setInstallationSettings(installRes.settings)
        if (installRes.installed === false) {
          setIsInstallWizardOpen(true)
        }
      }
    } catch (err) {
      console.warn('Initial data load error or offline mode', err)
    } finally {
      setLoadingInitial(false)
    }
  }, [])

  useEffect(() => {
    void fetchAllData()
  }, [fetchAllData])

  /* ==========================================================================
     SESSION BOOTSTRAP & AUTH HANDLERS
     ========================================================================== */

  // Boot: resolve the current session before rendering the console
  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled && data.user) {
            setSessionUser(data.user)
            setCurrentRole(data.user.role)
            setCurrentUsername(data.user.username)
          }
        }
      } catch {
        /* server unreachable — fall through to login */
      } finally {
        if (!cancelled) setAuthChecked(true)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const handleLoginSuccess = useCallback(
    (user: SessionUser) => {
      setSessionUser(user)
      setCurrentRole(user.role)
      setCurrentUsername(user.username)
      setLoadingInitial(true)
      void fetchAllData()
    },
    [fetchAllData]
  )

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      /* ignore network errors on logout */
    }
    setSessionUser(null)
    setActiveTab('tickets')
    setSelectedTicket(null)
  }, [])

  /* ==========================================================================
     TICKET HANDLERS
     ========================================================================== */

  const handleSubmitTicket = async (payload: any) => {
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      setTickets((prev) => [data.ticket, ...prev])
      return data
    } catch (err) {
      // Offline fallback
      const offlineId = `RD-2026-${String(tickets.length + 1).padStart(4, '0')}`
      const offlineTicket: Ticket = {
        id: offlineId,
        zaiId: `usr_${Date.now()}`,
        contact: payload.contact,
        subject: payload.subject,
        type: payload.type,
        status: 'open',
        priority: payload.priority,
        team: payload.team,
        assignee: null,
        escalationLevel: 0,
        escalations: [],
        body: payload.body,
        reproduction: payload.reproduction,
        attachments: payload.attachments || [],
        messages: [],
        sla: {
          responseDueAt: new Date(Date.now() + 4 * 3600_000).toISOString(),
          resolutionDueAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
          firstRespondedAt: null,
          resolvedAt: null,
          isResponseBreached: false,
          isResolutionBreached: false,
          warned: false,
        },
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      queueMutation('create_ticket', offlineTicket)
      setTickets((prev) => [offlineTicket, ...prev])
      return { ticket: offlineTicket, secretToken: 'zt_offline_mode' }
    }
  }

  const handleUpdateTicket = async (ticketId: string, updates: Partial<Ticket>) => {
    // Optimistic update
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t))
    )
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket((prev) => (prev ? { ...prev, ...updates } : null))
    }

    try {
      await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, actor: currentUsername }),
      })
    } catch {
      queueMutation('update_ticket', { id: ticketId, ...updates })
    }
  }

  const handleAddMessage = async (ticketId: string, msg: any) => {
    const newMsgObj = {
      id: `msg_${Date.now()}`,
      from: msg.from,
      author: msg.author,
      body: msg.body,
      visibility: msg.visibility,
      at: new Date().toISOString(),
      attachments: msg.attachments || [],
    }

    // Optimistic update
    setTickets((prev) =>
      prev.map((t) => {
        if (t.id !== ticketId) return t
        const updatedMsgs = [...t.messages, newMsgObj]
        let firstRespondedAt = t.sla.firstRespondedAt
        if (msg.from === 'staff' && msg.visibility === 'public' && !firstRespondedAt) {
          firstRespondedAt = new Date().toISOString()
        }
        return {
          ...t,
          messages: updatedMsgs,
          sla: { ...t.sla, firstRespondedAt },
          updatedAt: new Date().toISOString(),
        }
      })
    )

    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket((prev) =>
        prev
          ? {
              ...prev,
              messages: [...prev.messages, newMsgObj],
              sla: {
                ...prev.sla,
                firstRespondedAt:
                  msg.from === 'staff' && msg.visibility === 'public' && !prev.sla.firstRespondedAt
                    ? new Date().toISOString()
                    : prev.sla.firstRespondedAt,
              },
            }
          : null
      )
    }

    try {
      await fetch(`/api/tickets/${ticketId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msg),
      })
    } catch {
      queueMutation('add_message', { ticketId, ...msg })
    }
  }

  const handleEscalateTicket = async (ticketId: string, toMember: string, toTeam: string, reason: string) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: currentUsername, toMember, toTeam, reason }),
      })
      const updatedTicket = await res.json()
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? updatedTicket : t)))
      setSelectedTicket(updatedTicket)
    } catch (err) {
      console.error(err)
    }
  }

  /* ==========================================================================
     KANBAN HANDLERS
     ========================================================================== */

  const handleUpdateBoard = async (boardId: string, updates: Partial<KanbanBoard>) => {
    setKanbanBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, ...updates } : b)))
    try {
      await fetch(`/api/kanban/boards/${boardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    } catch {
      queueMutation('update_board', { id: boardId, ...updates })
    }
  }

  const handleCreateBoard = async (board: any) => {
    try {
      const res = await fetch('/api/kanban/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(board),
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        console.error('Failed to create board:', errData.error || res.statusText)
        return
      }
      const newB = await res.json()
      if (newB && newB.id && Array.isArray(newB.lists)) {
        setKanbanBoards((prev) => [...prev, newB])
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteBoard = async (boardId: string) => {
    setKanbanBoards((prev) => prev.filter((b) => b.id !== boardId))
    try {
      await fetch(`/api/kanban/boards/${boardId}`, { method: 'DELETE' })
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateCard = async (boardId: string, listId: string, card: any) => {
    try {
      const res = await fetch('/api/kanban/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, listId, ...card }),
      })
      const newCard = await res.json()
      setKanbanBoards((prev) =>
        prev.map((b) => {
          if (b.id !== boardId) return b
          return {
            ...b,
            lists: b.lists.map((l) => (l.id === listId ? { ...l, cards: [...l.cards, newCard] } : l)),
          }
        })
      )
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdateCard = async (
    cardId: string,
    updates: Partial<KanbanCard> & { targetListId?: string; targetIndex?: number }
  ) => {
    // Optimistic update across all boards
    setKanbanBoards((prev) =>
      prev.map((b) => {
        const cardList = b.lists.find((l) => l.cards.some((c) => c.id === cardId))
        if (!cardList) return b

        const card = cardList.cards.find((c) => c.id === cardId)!
        const updatedCard = { ...card, ...updates, updatedAt: new Date().toISOString() }
        const targetListId = updates.targetListId || cardList.id
        const targetIndex = updates.targetIndex

        if (targetListId !== cardList.id) {
          updatedCard.listId = targetListId
          return {
            ...b,
            lists: b.lists.map((l) => {
              if (l.id === cardList.id) {
                return { ...l, cards: l.cards.filter((c) => c.id !== cardId) }
              }
              if (l.id === targetListId) {
                const newCards = [...l.cards]
                if (typeof targetIndex === 'number' && targetIndex >= 0) {
                  newCards.splice(targetIndex, 0, updatedCard)
                } else {
                  newCards.push(updatedCard)
                }
                return { ...l, cards: newCards }
              }
              return l
            }),
          }
        } else if (typeof targetIndex === 'number' && targetIndex >= 0) {
          const remaining = cardList.cards.filter((c) => c.id !== cardId)
          remaining.splice(targetIndex, 0, updatedCard)
          return {
            ...b,
            lists: b.lists.map((l) => (l.id === cardList.id ? { ...l, cards: remaining } : l)),
          }
        } else {
          return {
            ...b,
            lists: b.lists.map((l) => ({
              ...l,
              cards: l.cards.map((c) => (c.id === cardId ? updatedCard : c)),
            })),
          }
        }
      })
    )

    try {
      await fetch(`/api/kanban/cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    } catch {
      queueMutation('update_card', { id: cardId, ...updates })
    }
  }

  const handleDeleteCard = async (cardId: string) => {
    setKanbanBoards((prev) =>
      prev.map((b) => ({
        ...b,
        lists: b.lists.map((l) => ({
          ...l,
          cards: l.cards.filter((c) => c.id !== cardId),
        })),
      }))
    )
    try {
      await fetch(`/api/kanban/cards/${cardId}`, { method: 'DELETE' })
    } catch (err) {
      console.error(err)
    }
  }

  // Quick link Ticket to Kanban Card
  const handleLinkTicketToKanban = (ticket: Ticket) => {
    const firstBoard = kanbanBoards[0]
    if (!firstBoard || !firstBoard.lists[0]) return
    handleCreateCard(firstBoard.id, firstBoard.lists[0].id, {
      title: `[${ticket.id}] ${ticket.subject}`,
      description: ticket.body,
      ticketId: ticket.id,
    })
    setActiveTab('kanban')
  }

  /* ==========================================================================
     WIKI HANDLERS
     ========================================================================== */

  const handleCreateSpace = async (space: any) => {
    try {
      const res = await fetch('/api/wiki/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(space),
      })
      const newS = await res.json()
      setWikiSpaces((prev) => [...prev, newS])
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreatePage = async (page: any) => {
    try {
      const res = await fetch('/api/wiki/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...page, author: currentUsername }),
      })
      const newP = await res.json()
      setWikiPages((prev) => [...prev, newP])
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdatePage = async (pageId: string, updates: any) => {
    setWikiPages((prev) =>
      prev.map((p) => (p.id === pageId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p))
    )
    try {
      await fetch(`/api/wiki/pages/${pageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...updates, author: currentUsername }),
      })
    } catch {
      queueMutation('save_wiki', { id: pageId, ...updates })
    }
  }

  const handleRollbackPage = async (pageId: string, revisionId: string) => {
    try {
      const res = await fetch(`/api/wiki/pages/${pageId}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revisionId, author: currentUsername }),
      })
      const updatedP = await res.json()
      setWikiPages((prev) => prev.map((p) => (p.id === pageId ? updatedP : p)))
    } catch (err) {
      console.error(err)
    }
  }

  const handleVotePage = async (pageId: string, helpful: boolean) => {
    setWikiPages((prev) =>
      prev.map((p) => {
        if (p.id !== pageId) return p
        return {
          ...p,
          helpfulVotes: helpful ? p.helpfulVotes + 1 : p.helpfulVotes,
          unhelpfulVotes: !helpful ? p.unhelpfulVotes + 1 : p.unhelpfulVotes,
        }
      })
    )
    try {
      await fetch(`/api/wiki/pages/${pageId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ helpful }),
      })
    } catch {}
  }

  /* ==========================================================================
     ADMIN & INTEGRATION HANDLERS
     ========================================================================== */

  const handleAddStaff = async (staff: Partial<StaffMember>) => {
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staff),
      })
      const newS = await res.json()
      setStaffList((prev) => [...prev, newS])
    } catch (err) {
      console.error(err)
    }
  }

  const handleUpdateStaff = async (username: string, updates: Partial<StaffMember>) => {
    setStaffList((prev) => prev.map((s) => (s.username === username ? { ...s, ...updates } : s)))
    try {
      await fetch(`/api/admin/staff/${username}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveRbac = async (newRbac: Record<StaffRole, RolePermissions>) => {
    setRbacMatrix(newRbac)
    try {
      await fetch('/api/admin/rbac', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRbac),
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveSla = async (newSla: SLAPolicyConfig) => {
    setSlaPolicies(newSla)
    try {
      await fetch('/api/admin/sla', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSla),
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleSaveSmtp = async (newSmtp: SMTPSettings) => {
    setSmtpSettings(newSmtp)
    try {
      await fetch('/api/admin/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSmtp),
      })
    } catch (err) {
      console.error(err)
    }
  }

  const handleTestSmtp = async (email: string) => {
    const res = await fetch('/api/admin/smtp/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetEmail: email }),
    })
    const data = await res.json()
    if (data.log) {
      setEmailLogs((prev) => [data.log, ...prev])
    }
    return data
  }

  const handleAddWebhook = async (wh: Partial<WebhookConfig>) => {
    try {
      const res = await fetch('/api/admin/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wh),
      })
      const newWh = await res.json()
      setWebhooks((prev) => [...prev, newWh])
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteWebhook = async (id: string) => {
    setWebhooks((prev) => prev.filter((w) => w.id !== id))
    try {
      await fetch(`/api/admin/webhooks/${id}`, { method: 'DELETE' })
    } catch (err) {
      console.error(err)
    }
  }

  const handleTestWebhook = async (id: string) => {
    const res = await fetch(`/api/admin/webhooks/${id}/test`, { method: 'POST' })
    const data = await res.json()
    if (data.delivery) {
      setWebhookDeliveries((prev) => [data.delivery, ...prev])
    }
    return data
  }

  const handlePushRemote = async () => {
    const res = await fetch('/api/sync/push', { method: 'POST' })
    const data = await res.json()
    await syncManager.triggerSync()
    return data
  }

  const handlePullRemote = async () => {
    const res = await fetch('/api/sync/pull', { method: 'POST' })
    const data = await res.json()
    await fetchAllData()
    return data
  }

  const handleCreateCannedReply = async (reply: Partial<CannedReply>) => {
    try {
      const res = await fetch('/api/canned-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...reply, actor: currentUsername }),
      })
      const newR = await res.json()
      setCannedReplies((prev) => [newR, ...prev])
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteCannedReply = async (id: string) => {
    setCannedReplies((prev) => prev.filter((r) => r.id !== id))
    try {
      await fetch(`/api/canned-replies/${id}`, { method: 'DELETE' })
    } catch (err) {
      console.error(err)
    }
  }

  const openTicketsCount = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length

  // Session gate — nothing renders until the server confirms who the user is
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
          Establishing secure session…
        </div>
      </div>
    )
  }

  if (!sessionUser) {
    return <LoginScreen onLogin={handleLoginSuccess} />
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex font-sans selection:bg-indigo-600 selection:text-white">
      {/* Deep Slate Left Sidebar (Desktop Persistent + Mobile Drawer) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab)
          setSelectedTicket(null)
        }}
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        isOnline={syncManager.isOnline}
        isSyncing={syncManager.isSyncing}
        pendingCount={syncManager.pendingCount}
        lastSyncTime={syncManager.lastSyncTime}
        onSyncNow={syncManager.triggerSync}
        sessionUser={sessionUser}
        openTicketsCount={openTicketsCount}
        onOpenInstallWizard={() => setIsInstallWizardOpen(true)}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Offline connectivity & sync banner */}
        <OfflineBanner isOnline={syncManager.isOnline} pendingMutationsCount={syncManager.pendingCount} />

        {/* Crisp Header Bar */}
        <Header
          onOpenMobileMenu={() => setMobileDrawerOpen(true)}
          onOpenNewTicket={() => setIsSubmitModalOpen(true)}
          isOnline={syncManager.isOnline}
          isSyncing={syncManager.isSyncing}
          onSyncNow={syncManager.triggerSync}
          sessionUser={sessionUser}
          onLogout={handleLogout}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab)
            setSelectedTicket(null)
          }}
          breachedCount={tickets.filter((t) => t.sla.isResponseBreached || t.sla.isResolutionBreached).length}
          searchTerm={globalSearchTerm}
          onSearchChange={setGlobalSearchTerm}
          onOpenInstallWizard={() => setIsInstallWizardOpen(true)}
        />

        {/* Workspace Canvas */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-24 lg:pb-8">
          {/* TICKETS TAB */}
          {activeTab === 'tickets' && (
            selectedTicket ? (
              <TicketDetail
                ticket={selectedTicket}
                onBack={() => setSelectedTicket(null)}
                onUpdateTicket={handleUpdateTicket}
                onAddMessage={handleAddMessage}
                onEscalate={handleEscalateTicket}
                onLinkToKanban={handleLinkTicketToKanban}
                allTickets={tickets}
                onTicketsUpdated={setTickets}
                currentRole={currentRole}
                currentUsername={currentUsername}
                staffList={staffList}
                cannedReplies={cannedReplies}
              />
            ) : (
              <TicketList
                tickets={tickets}
                onSelectTicket={(t) => setSelectedTicket(t)}
                onOpenNewTicket={() => setIsSubmitModalOpen(true)}
                currentRole={currentRole}
                wikiPages={wikiPages}
                staffList={staffList}
                auditLogs={auditLogs}
                kanbanBoards={kanbanBoards}
                onSwitchTab={(tab) => {
                  setActiveTab(tab)
                  setSelectedTicket(null)
                }}
              />
            )
          )}

        {/* KANBAN TAB */}
        {activeTab === 'kanban' && (
          <KanbanModule
            boards={kanbanBoards}
            staffList={staffList}
            tickets={tickets}
            onUpdateBoard={handleUpdateBoard}
            onCreateBoard={handleCreateBoard}
            onDeleteBoard={handleDeleteBoard}
            onCreateCard={handleCreateCard}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onSelectTicket={(t) => {
              setSelectedTicket(t)
              setActiveTab('tickets')
            }}
          />
        )}

        {/* WIKI TAB */}
        {activeTab === 'wiki' && (
          <WikiModule
            spaces={wikiSpaces}
            pages={wikiPages}
            currentRole={currentRole}
            currentUsername={currentUsername}
            onCreateSpace={handleCreateSpace}
            onCreatePage={handleCreatePage}
            onUpdatePage={handleUpdatePage}
            onRollbackPage={handleRollbackPage}
            onVotePage={handleVotePage}
          />
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard tickets={tickets} staffList={staffList} />
        )}

        {/* ADMIN TAB */}
        {activeTab === 'admin' && (
          <AdminConsole
            staffList={staffList}
            onAddStaff={handleAddStaff}
            onUpdateStaff={handleUpdateStaff}
            rbac={rbacMatrix}
            onSaveRbac={handleSaveRbac}
            slaPolicies={slaPolicies}
            onSaveSla={handleSaveSla}
            smtp={smtpSettings}
            onSaveSmtp={handleSaveSmtp}
            onTestSmtp={handleTestSmtp}
            emailLogs={emailLogs}
            webhooks={webhooks}
            webhookDeliveries={webhookDeliveries}
            onAddWebhook={handleAddWebhook}
            onDeleteWebhook={handleDeleteWebhook}
            onTestWebhook={handleTestWebhook}
            auditLogs={auditLogs}
            syncStatus={cloudSyncStatus}
            onPushRemote={handlePushRemote}
            onPullRemote={handlePullRemote}
            cannedReplies={cannedReplies}
            onCreateCannedReply={handleCreateCannedReply}
            onDeleteCannedReply={handleDeleteCannedReply}
            installationSettings={installationSettings || undefined}
            onOpenInstallWizard={() => setIsInstallWizardOpen(true)}
          />
        )}

        {/* CLIENT PORTAL TAB */}
        {activeTab === 'portal' && (
          <CustomerPortal
            tickets={tickets}
            wikiPages={wikiPages}
            onSelectTicket={(t) => {
              setSelectedTicket(t)
              setActiveTab('tickets')
            }}
            onOpenNewTicket={() => setIsSubmitModalOpen(true)}
            onSelectWikiPage={(p) => {
              setActiveTab('wiki')
            }}
          />
        )}
      </main>
      </div>

      {/* Responsive Mobile Bottom Navigation Bar */}
      <MobileNav
        activeTab={activeTab}
        setActiveTab={(t) => {
          setActiveTab(t)
          setSelectedTicket(null)
        }}
        onOpenNewTicket={() => setIsSubmitModalOpen(true)}
        openTicketsCount={openTicketsCount}
      />

      {/* Global New Ticket Modal */}
      <TicketSubmitModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        wikiPages={wikiPages}
        onSelectWikiPage={(p) => {
          setActiveTab('wiki')
        }}
        onSubmitTicket={handleSubmitTicket}
        onViewTicket={(t) => {
          setSelectedTicket(t)
          setActiveTab('tickets')
        }}
      />

      {/* Global Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette
        tickets={tickets}
        wikiPages={wikiPages}
        onSelectTicket={(t) => {
          setSelectedTicket(t)
          setActiveTab('tickets')
        }}
        onSelectWikiPage={(p) => {
          setActiveTab('wiki')
        }}
        onSwitchTab={(tab) => {
          setActiveTab(tab)
          setSelectedTicket(null)
        }}
        onOpenNewTicket={() => setIsSubmitModalOpen(true)}
        onOpenInstallWizard={() => setIsInstallWizardOpen(true)}
      />

      {/* Self-Hosted Server Setup & Installation Wizard */}
      <InstallationWizard
        isOpen={isInstallWizardOpen}
        onClose={() => setIsInstallWizardOpen(false)}
        currentSettings={installationSettings || undefined}
        onInstallationComplete={(newSettings, newAdminUsername) => {
          setInstallationSettings(newSettings)
          setIsInstallWizardOpen(false)
          if (newAdminUsername) {
            setCurrentRole('super_admin')
          }
          void fetchAllData()
        }}
        isReconfigureMode={Boolean(installationSettings?.installed)}
      />

      {/* System Toast Notification System */}
      <ToastContainer />
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  )
}
