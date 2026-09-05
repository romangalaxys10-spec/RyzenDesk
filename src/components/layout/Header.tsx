import React, { useState } from 'react'
import {
  Search,
  Bell,
  Menu,
  Plus,
  RefreshCw,
  Check,
  AlertTriangle,
  Server,
} from 'lucide-react'
import { useI18n, SUPPORTED_LANGUAGES, type Language } from '../../i18n/translations'
import type { StaffRole } from '../../types'

interface HeaderProps {
  onOpenMobileMenu: () => void
  onOpenNewTicket: () => void
  isOnline: boolean
  isSyncing: boolean
  onSyncNow: () => void
  currentRole: StaffRole
  setCurrentRole: (role: StaffRole) => void
  activeTab: string
  setActiveTab: (tab: any) => void
  breachedCount: number
  searchTerm?: string
  onSearchChange?: (val: string) => void
  onOpenInstallWizard?: () => void
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  onOpenNewTicket,
  isOnline,
  isSyncing,
  onSyncNow,
  currentRole,
  activeTab,
  setActiveTab,
  breachedCount,
  searchTerm = '',
  onSearchChange,
  onOpenInstallWizard,
}) => {
  const { language, setLanguage, t } = useI18n()
  const [showNotifications, setShowNotifications] = useState(false)

  // Primary languages to show in the compact segment control
  const primaryLangs: Language[] = ['en', 'es', 'de', 'fr']

  // Role initials
  const getRoleInitials = (role: StaffRole) => {
    switch (role) {
      case 'super_admin':
        return 'SA'
      case 'team_lead':
        return 'TL'
      case 'agent':
        return 'AG'
      case 'viewer':
        return 'VW'
      case 'client':
        return 'CL'
      default:
        return 'AD'
    }
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 sticky top-0 z-30 select-none shadow-2xs">
      {/* Left side: Mobile menu toggle + Global Search input */}
      <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-xl">
        <button
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg focus:outline-none"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="relative w-full max-w-xs sm:max-w-sm lg:max-w-md">
          <input
            type="text"
            placeholder="Search tickets, wiki, or audit logs..."
            value={searchTerm}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 placeholder:text-slate-400 text-slate-800 transition-all"
          />
          <Search className="w-4 h-4 absolute left-3 top-2 sm:top-2.5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Right side: Language pills, Sync, Notifications, + New Ticket, Profile */}
      <div className="flex items-center gap-2 sm:gap-4 lg:gap-6">
        {/* Language Segment Control */}
        <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200/60">
          {primaryLangs.map((l) => {
            const isSelected = language === l
            return (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white rounded shadow-xs text-indigo-600'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {l.toUpperCase()}
              </button>
            )
          })}
        </div>

        {/* Sync Trigger Button */}
        <button
          onClick={onSyncNow}
          title={isOnline ? 'Cloud Synced - Click to sync now' : 'Working offline'}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : 'text-slate-400'}`} />
          <span className="hidden xl:inline">{isOnline ? 'Synced' : 'Offline'}</span>
        </button>

        {/* Server Setup Wizard Quick Button */}
        {onOpenInstallWizard && (
          <button
            onClick={onOpenInstallWizard}
            title="Launch Server Setup Wizard"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer transition-colors"
          >
            <Server className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden lg:inline">Server Setup</span>
          </button>
        )}

        {/* New Ticket Quick Button */}
        <button
          onClick={onOpenNewTicket}
          className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs transition-all active:scale-95 font-semibold text-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span className="hidden sm:inline">+ New Ticket</span>
          <span className="sm:hidden">New</span>
        </button>

        {/* Notifications Popover Toggle */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative focus:outline-none transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {breachedCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs font-bold text-slate-800">
                <span>System Notifications</span>
                <span className="text-[10px] text-slate-400 font-normal">Real-time alerts</span>
              </div>
              <div className="py-2 space-y-2 text-xs">
                {breachedCount > 0 ? (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">{breachedCount} SLA Breach Alert(s)</span>
                      <p className="text-[11px] text-rose-600 mt-0.5">Tickets require immediate supervisor escalation.</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>All service level agreements are healthy.</span>
                  </div>
                )}
                <div className="p-2 bg-slate-50 rounded-lg text-slate-600 flex items-center justify-between text-[11px]">
                  <span>Cloud Database</span>
                  <span className="font-semibold text-emerald-600">Connected</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar Pill */}
        <div
          title={`Active Role: ${currentRole.replace('_', ' ')}`}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-indigo-100 border border-indigo-200 overflow-hidden flex items-center justify-center text-indigo-700 font-bold text-xs sm:text-sm shadow-2xs"
        >
          {getRoleInitials(currentRole)}
        </div>
      </div>
    </header>
  )
}
