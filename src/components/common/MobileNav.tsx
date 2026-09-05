import React from 'react'
import { Ticket, Kanban, BookOpen, BarChart3, ShieldCheck, Plus, ExternalLink } from 'lucide-react'
import { useI18n } from '../../i18n/translations'
import type { SessionUser } from '../../types'

interface MobileNavProps {
  activeTab: 'tickets' | 'kanban' | 'wiki' | 'analytics' | 'admin' | 'portal'
  setActiveTab: (tab: 'tickets' | 'kanban' | 'wiki' | 'analytics' | 'admin' | 'portal') => void
  onOpenNewTicket: () => void
  openTicketsCount: number
  sessionUser?: SessionUser | null
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenNewTicket,
  openTicketsCount,
  sessionUser,
}) => {
  const { t } = useI18n()
  const isClient = sessionUser?.kind === 'client'

  const tabs: Array<{
    id: 'tickets' | 'kanban' | 'wiki' | 'analytics' | 'admin' | 'portal'
    label: string
    icon: any
    badge?: number
  }> = isClient
    ? [
        { id: 'portal', label: 'Portal', icon: ExternalLink },
        { id: 'tickets', label: 'My Tickets', icon: Ticket, badge: openTicketsCount },
        // Clients can see the team board when the RBAC matrix grants kanban_view.
        ...(sessionUser?.permissions?.kanban_view === false
          ? []
          : [{ id: 'kanban' as const, label: 'Kanban', icon: Kanban }]),
        { id: 'wiki', label: 'Help Base', icon: BookOpen },
      ]
    : [
        { id: 'tickets', label: 'Tickets', icon: Ticket, badge: openTicketsCount },
        // Match the desktop sidebar: respect the server-side kanban_view RBAC permission.
        ...(sessionUser?.permissions?.kanban_view === false
          ? []
          : [{ id: 'kanban' as const, label: 'Kanban', icon: Kanban }]),
        { id: 'wiki', label: 'Wiki', icon: BookOpen },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'admin', label: 'Admin', icon: ShieldCheck },
      ]

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1 flex items-center justify-around shadow-2xl safe-area-bottom">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[48px] min-w-[48px] flex flex-col items-center justify-center p-1 rounded-lg transition-colors relative ${
              isActive ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1 rounded-full min-w-[14px] text-center">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">{tab.label}</span>
          </button>
        )
      })}

      {/* Quick Add floating-style button */}
      <button
        onClick={onOpenNewTicket}
        aria-label="New Ticket"
        className="min-h-[44px] min-w-[44px] -mt-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>
    </div>
  )
}
