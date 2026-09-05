import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  Ticket as TicketIcon,
  Kanban,
  BookOpen,
  Plus,
  Moon,
  Volume2,
  VolumeX,
  FileSpreadsheet,
  Settings,
  X,
  ArrowRight,
  Server,
  Wand2,
} from 'lucide-react'
import type { Ticket, KanbanBoard, WikiSpace } from '../../types'
import { isSoundEnabled, setSoundEnabled } from '../../utils/soundNotifications'
import { toast } from './ToastContainer'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  tickets: Ticket[]
  kanbanBoards: KanbanBoard[]
  wikiSpaces: WikiSpace[]
  onSelectTicket: (ticket: Ticket) => void
  onSelectTab: (tab: any) => void
  onOpenNewTicket: () => void
  onOpenInstallWizard?: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  tickets,
  kanbanBoards,
  wikiSpaces,
  onSelectTicket,
  onSelectTab,
  onOpenNewTicket,
  onOpenInstallWizard,
}) => {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [isOpen])

  // Global key listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (isOpen) onClose()
        else {
          // Trigger open via custom event or state
          const event = new CustomEvent('open-command-palette')
          window.dispatchEvent(event)
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const q = query.toLowerCase().trim()

  const filteredTickets = q
    ? tickets
        .filter(
          (t) =>
            t.id.toLowerCase().includes(q) ||
            t.subject.toLowerCase().includes(q) ||
            t.contact.fullName.toLowerCase().includes(q) ||
            t.contact.email.toLowerCase().includes(q)
        )
        .slice(0, 5)
    : tickets.slice(0, 3)

  const filteredBoards = q
    ? kanbanBoards.filter((b) => b.title.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)).slice(0, 3)
    : kanbanBoards.slice(0, 2)

  const filteredSpaces = q
    ? wikiSpaces.filter((s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)).slice(0, 3)
    : wikiSpaces.slice(0, 2)

  const handleExportCsv = () => {
    window.open('/api/tickets/export?format=csv', '_blank')
    toast.success('Export started', 'Downloading tickets CSV file')
    onClose()
  }

  const handleToggleSound = () => {
    const next = !isSoundEnabled()
    setSoundEnabled(next)
    toast.info('Sound alerts ' + (next ? 'Enabled' : 'Muted'))
    onClose()
  }

  const handleToggleTheme = () => {
    const isDark = document.documentElement.classList.contains('dark')
    if (isDark) {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('ryzendesk_theme', 'light')
      toast.info('Light mode activated')
    } else {
      document.documentElement.classList.add('dark')
      localStorage.setItem('ryzendesk_theme', 'dark')
      toast.info('Dark mode activated')
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[75vh]"
      >
        {/* Search Input */}
        <div className="p-3.5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/70">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search tickets, boards, wiki... (Ctrl+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden"
          />
          <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Results */}
        <div className="p-2 overflow-y-auto space-y-4 text-xs divide-y divide-slate-100">
          {/* Quick Actions */}
          <div className="space-y-1">
            <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold tracking-wider uppercase text-slate-400">
              Quick Actions
            </div>
            <button
              onClick={() => {
                onOpenNewTicket()
                onClose()
              }}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-sky-50 text-slate-700 hover:text-sky-700 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded bg-sky-100 text-sky-600">
                  <Plus className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-xs">Create New Ticket</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              onClick={handleExportCsv}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded bg-emerald-100 text-emerald-600">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-xs">Export All Tickets to CSV</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {onOpenInstallWizard && (
              <button
                onClick={() => {
                  onOpenInstallWizard()
                  onClose()
                }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-1 rounded bg-indigo-100 text-indigo-600">
                    <Server className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-medium text-xs">Launch Server Setup Wizard</span>
                </div>
                <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                  Admin Setup
                </span>
              </button>
            )}

            <button
              onClick={handleToggleSound}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded bg-slate-100 text-slate-600">
                  {isSoundEnabled() ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </div>
                <span className="font-medium text-xs">Toggle Notification Sound Alerts</span>
              </div>
              <span className="text-[10px] text-slate-400">{isSoundEnabled() ? 'Enabled' : 'Muted'}</span>
            </button>

            <button
              onClick={handleToggleTheme}
              className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1 rounded bg-slate-100 text-slate-600">
                  <Moon className="w-3.5 h-3.5" />
                </div>
                <span className="font-medium text-xs">Toggle Light / Dark Mode</span>
              </div>
              <span className="text-[10px] text-slate-400">Theme</span>
            </button>
          </div>

          {/* Tickets Section */}
          {filteredTickets.length > 0 && (
            <div className="pt-2 space-y-1">
              <div className="px-2 pb-0.5 text-[10px] font-bold tracking-wider uppercase text-slate-400 flex items-center justify-between">
                <span>Tickets ({filteredTickets.length})</span>
                <span className="text-[9px] text-slate-400 lowercase">click to view</span>
              </div>
              {filteredTickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    onSelectTicket(t)
                    onClose()
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <TicketIcon className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 truncate text-xs group-hover:text-sky-600">
                        <span className="font-mono text-[11px] text-slate-400 mr-1.5">{t.id}</span>
                        {t.subject}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t.contact.fullName} • {t.type} • {t.priority}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${
                      t.status === 'open'
                        ? 'bg-amber-100 text-amber-800'
                        : t.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {t.status.replace('_', ' ')}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Kanban Boards */}
          {filteredBoards.length > 0 && (
            <div className="pt-2 space-y-1">
              <div className="px-2 pb-0.5 text-[10px] font-bold tracking-wider uppercase text-slate-400">
                Kanban Boards ({filteredBoards.length})
              </div>
              {filteredBoards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    onSelectTab('kanban')
                    onClose()
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Kanban className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-medium text-slate-800 text-xs">{b.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{b.lists?.length || 0} lists</span>
                </button>
              ))}
            </div>
          )}

          {/* Wiki Spaces */}
          {filteredSpaces.length > 0 && (
            <div className="pt-2 space-y-1">
              <div className="px-2 pb-0.5 text-[10px] font-bold tracking-wider uppercase text-slate-400">
                Knowledge Wiki ({filteredSpaces.length})
              </div>
              {filteredSpaces.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onSelectTab('wiki')
                    onClose()
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-medium text-slate-800 text-xs">{s.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">{s.key}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 px-4">
          <span>Navigate with mouse or arrow keys</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  )
}
