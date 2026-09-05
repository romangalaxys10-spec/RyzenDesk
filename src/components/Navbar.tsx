import React, { useState } from 'react'
import {
  LifeBuoy,
  Ticket,
  Kanban,
  BookOpen,
  BarChart3,
  ShieldCheck,
  Globe,
  RefreshCw,
  Wifi,
  WifiOff,
  UserCheck,
  PlusCircle,
  Menu,
  X,
  ExternalLink,
} from 'lucide-react'
import { useI18n, SUPPORTED_LANGUAGES, type Language } from '../i18n/translations'
import type { StaffRole } from '../types'

interface NavbarProps {
  activeTab: 'tickets' | 'kanban' | 'wiki' | 'analytics' | 'admin' | 'portal'
  setActiveTab: (tab: 'tickets' | 'kanban' | 'wiki' | 'analytics' | 'admin' | 'portal') => void
  currentRole: StaffRole
  setCurrentRole: (role: StaffRole) => void
  isOnline: boolean
  isSyncing: boolean
  pendingCount: number
  lastSyncTime: string
  onSyncNow: () => void
  onOpenNewTicket: () => void
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentRole,
  setCurrentRole,
  isOnline,
  isSyncing,
  pendingCount,
  lastSyncTime,
  onSyncNow,
  onOpenNewTicket,
}) => {
  const { language, setLanguage, t } = useI18n()
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { id: 'tickets', label: t('nav.tickets'), icon: Ticket },
    { id: 'kanban', label: t('nav.kanban'), icon: Kanban },
    { id: 'wiki', label: t('nav.wiki'), icon: BookOpen },
    { id: 'analytics', label: t('nav.analytics'), icon: BarChart3 },
    { id: 'admin', label: t('nav.admin'), icon: ShieldCheck },
    { id: 'portal', label: t('nav.portal'), icon: ExternalLink },
  ] as const

  const roles: Array<{ id: StaffRole; label: string }> = [
    { id: 'super_admin', label: 'Super Admin' },
    { id: 'team_lead', label: 'Team Lead' },
    { id: 'agent', label: 'Agent' },
    { id: 'viewer', label: 'Viewer' },
    { id: 'client', label: 'Client / Customer' },
  ]

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-900 text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Brand Logo & Name */}
        <div className="flex items-center space-x-3">
          <button
            id="brand-logo-btn"
            onClick={() => setActiveTab('tickets')}
            className="flex items-center space-x-2.5 text-left focus:outline-none focus:ring-2 focus:ring-sky-400 rounded-lg p-1"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center shadow-inner">
              <LifeBuoy className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-sky-300 bg-clip-text text-transparent">
                RyzenDesk
              </span>
              <span className="hidden sm:inline-block ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold bg-sky-950 text-sky-300 border border-sky-800 rounded">
                ENTERPRISE
              </span>
            </div>
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1 ml-6">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  id={`nav-link-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-sky-400 font-semibold border-b-2 border-sky-400'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* Action Controls Right Side */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* New Ticket Quick Button */}
          <button
            id="nav-new-ticket-btn"
            onClick={onOpenNewTicket}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs sm:text-sm shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" />
            <span>{t('nav.newTicket')}</span>
          </button>

          {/* Offline / Cloud Sync Status Pill */}
          <button
            id="sync-status-btn"
            onClick={onSyncNow}
            title={isOnline ? `Cloud Synced. Click to sync now.` : `Offline mode with ${pendingCount} queued change(s)`}
            className={`hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              !isOnline || pendingCount > 0
                ? 'bg-amber-950/70 border-amber-700 text-amber-300 hover:bg-amber-900/60'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700/60'
            }`}
          >
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span className="hidden md:inline">
              {isOnline ? t('nav.synced') : `${t('nav.offline')} (${pendingCount})`}
            </span>
            <RefreshCw className={`w-3 h-3 ml-1 ${isSyncing ? 'animate-spin text-sky-400' : 'text-slate-400'}`} />
          </button>

          {/* Language Switcher Dropdown */}
          <div className="relative">
            <button
              id="lang-switcher-btn"
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-md text-xs sm:text-sm text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              <span>{SUPPORTED_LANGUAGES.find((l) => l.code === language)?.flag || '🇬🇧'}</span>
              <span className="hidden sm:inline uppercase text-xs font-semibold">{language}</span>
            </button>
            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    id={`lang-select-${lang.code}`}
                    onClick={() => {
                      setLanguage(lang.code)
                      setLangMenuOpen(false)
                    }}
                    className={`w-full flex items-center space-x-2 px-3 py-2 text-xs text-left hover:bg-slate-700/80 transition-colors ${
                      language === lang.code ? 'text-sky-400 font-semibold bg-slate-750' : 'text-slate-300'
                    }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RBAC Role Switcher */}
          <div className="relative">
            <button
              id="role-switcher-btn"
              onClick={() => setRoleMenuOpen(!roleMenuOpen)}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm bg-slate-800 hover:bg-slate-700/80 border border-slate-700 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-slate-200 font-medium capitalize hidden md:inline">
                {currentRole.replace('_', ' ')}
              </span>
            </button>
            {roleMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/80">
                  {t('nav.switchRole')} (Simulation)
                </div>
                {roles.map((r) => (
                  <button
                    key={r.id}
                    id={`role-select-${r.id}`}
                    onClick={() => {
                      setCurrentRole(r.id)
                      setRoleMenuOpen(false)
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-700 transition-colors ${
                      currentRole === r.id ? 'text-indigo-400 font-semibold bg-slate-700/50' : 'text-slate-300'
                    }`}
                  >
                    <span>{r.label}</span>
                    {currentRole === r.id && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <button
            id="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-b border-slate-800 px-4 pt-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  setMobileMenuOpen(false)
                }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium ${
                  isActive ? 'bg-slate-800 text-sky-400 font-bold' : 'text-slate-300 hover:bg-slate-800/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            )
          })}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Last sync: {lastSyncTime}</span>
            <button
              onClick={() => {
                onSyncNow()
                setMobileMenuOpen(false)
              }}
              className="text-sky-400 hover:underline flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t('nav.syncNow')}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  )
}
