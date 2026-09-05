import React from 'react'
import {
  Ticket,
  Kanban,
  BookOpen,
  BarChart3,
  ShieldCheck,
  Webhook,
  ExternalLink,
  X,
  UserCheck,
  RefreshCw,
  Layers,
  Server,
} from 'lucide-react'
import { useI18n } from '../../i18n/translations'
import type { StaffRole } from '../../types'

interface SidebarProps {
  activeTab: 'tickets' | 'kanban' | 'wiki' | 'analytics' | 'admin' | 'portal'
  setActiveTab: (tab: 'tickets' | 'kanban' | 'wiki' | 'analytics' | 'admin' | 'portal') => void
  isOpen: boolean
  onClose: () => void
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncTime: string
  onSyncNow: () => void
  currentRole: StaffRole
  setCurrentRole: (role: StaffRole) => void
  openTicketsCount: number
  onOpenInstallWizard?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  isOnline,
  isSyncing,
  pendingCount,
  onSyncNow,
  currentRole,
  setCurrentRole,
  openTicketsCount,
  onOpenInstallWizard,
}) => {
  const { t } = useI18n()

  const roles: Array<{ id: StaffRole; label: string }> = [
    { id: 'super_admin', label: 'Super Admin' },
    { id: 'team_lead', label: 'Team Lead' },
    { id: 'agent', label: 'Agent' },
    { id: 'viewer', label: 'Viewer' },
    { id: 'client', label: 'Client / Customer' },
  ]

  const mainNavItems = [
    {
      id: 'tickets' as const,
      label: 'Ticket Queue',
      icon: Ticket,
      badge: openTicketsCount > 0 ? openTicketsCount : undefined,
    },
    {
      id: 'kanban' as const,
      label: 'Team Board (Kanban)',
      icon: Kanban,
    },
    {
      id: 'wiki' as const,
      label: 'Knowledge Wiki',
      icon: BookOpen,
    },
    {
      id: 'analytics' as const,
      label: 'Reports & Analytics',
      icon: BarChart3,
    },
    {
      id: 'portal' as const,
      label: 'Customer Portal',
      icon: ExternalLink,
    },
  ]

  const adminNavItems = [
    {
      id: 'admin' as const,
      label: 'RBAC & Compliance',
      icon: ShieldCheck,
    },
    {
      id: 'admin' as const,
      label: 'Integrations & Sync',
      icon: Webhook,
    },
  ]

  const content = (
    <aside className="w-64 bg-[#0F172A] text-slate-400 flex flex-col shrink-0 min-h-full select-none">
      {/* Brand Header */}
      <div className="p-6 flex items-center justify-between">
        <button
          onClick={() => {
            setActiveTab('tickets')
            onClose()
          }}
          className="flex items-center gap-3 text-left focus:outline-none group cursor-pointer"
        >
          <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center text-white font-bold text-lg shadow-sm group-hover:bg-indigo-400 transition-colors">
            R
          </div>
          <div>
            <span className="text-white font-semibold text-xl tracking-tight">RyzenDesk</span>
            <span className="block text-[9px] font-bold text-indigo-400 tracking-wider uppercase -mt-0.5">
              Enterprise
            </span>
          </div>
        </button>

        {/* Mobile close button */}
        <button
          onClick={onClose}
          className="lg:hidden p-1 text-slate-400 hover:text-white rounded-md focus:outline-none"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 px-4 space-y-1 mt-2 overflow-y-auto">
        {mainNavItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.label}
              onClick={() => {
                setActiveTab(item.id)
                onClose()
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md font-medium text-sm transition-colors text-left cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}

        {/* System Admin Category divider */}
        <div className="pt-5 pb-2 text-xs font-bold text-slate-500 uppercase tracking-widest px-3">
          System Admin
        </div>

        {adminNavItems.map((item, idx) => {
          const Icon = item.icon
          const isActive = activeTab === 'admin'
          return (
            <button
              key={item.label}
              onClick={() => {
                setActiveTab('admin')
                onClose()
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium text-sm transition-colors text-left cursor-pointer ${
                isActive && idx === 0
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          )
        })}

        {/* Staff Role Switcher in Sidebar */}
        <div className="pt-6 px-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Active Role</span>
          </div>
          <select
            value={currentRole}
            onChange={(e) => setCurrentRole(e.target.value as StaffRole)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Server Setup Wizard Link */}
        {onOpenInstallWizard && (
          <div className="pt-3 px-3">
            <button
              onClick={() => {
                onOpenInstallWizard()
                onClose()
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <span>Server Setup Wizard</span>
            </button>
          </div>
        )}
      </nav>

      {/* Cloud Sync Active Status at bottom */}
      <div className="p-4 mt-auto border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{isOnline ? 'Cloud Sync Active' : `Offline (${pendingCount})`}</span>
          </div>
          <button
            onClick={onSyncNow}
            title="Trigger remote sync"
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:flex shrink-0 min-h-screen border-r border-slate-800 sticky top-0 h-screen overflow-hidden">
        {content}
      </div>

      {/* Mobile Backdrop & Drawer */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0F172A] shadow-2xl z-10">
            {content}
          </div>
        </div>
      )}
    </>
  )
}
