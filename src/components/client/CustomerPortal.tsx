import React, { useState } from 'react'
import {
  LifeBuoy,
  Key,
  Search,
  Ticket as TicketIcon,
  PlusCircle,
  Clock,
  MessageSquare,
  BookOpen,
  ArrowRight,
  ExternalLink,
} from 'lucide-react'
import type { Ticket, WikiPage } from '../../types'
import { SlaTimer } from '../helpdesk/SlaTimer'
import { useI18n } from '../../i18n/translations'
import { PortalExtras } from './PortalExtras'

interface CustomerPortalProps {
  tickets: Ticket[]
  wikiPages: WikiPage[]
  onSelectTicket: (ticket: Ticket) => void
  onOpenNewTicket: () => void
  onSelectWikiPage: (page: WikiPage) => void
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  tickets,
  wikiPages,
  onSelectTicket,
  onOpenNewTicket,
  onSelectWikiPage,
}) => {
  const { t } = useI18n()
  const [tokenInput, setTokenInput] = useState('')
  const [activeCustomerEmail, setActiveCustomerEmail] = useState<string | null>(null)
  const [searchKb, setSearchKb] = useState('')

  // Public Knowledge Base articles
  const publicArticles = wikiPages.filter(
    (p) =>
      p.visibility === 'public' &&
      (!searchKb ||
        p.title.toLowerCase().includes(searchKb.toLowerCase()) ||
        p.content.toLowerCase().includes(searchKb.toLowerCase()))
  )

  // Filtered customer tickets
  const customerTickets = activeCustomerEmail
    ? tickets.filter((t) => t.contact.email.toLowerCase() === activeCustomerEmail.toLowerCase())
    : []

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!tokenInput.trim()) return

    // If matches ticket id directly
    const directMatch = tickets.find(
      (t) => t.id.toLowerCase() === tokenInput.trim().toLowerCase()
    )
    if (directMatch) {
      onSelectTicket(directMatch)
      return
    }

    // Lookup by email
    setActiveCustomerEmail(tokenInput.trim())
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Announcements, Network Status, Downloads + Live Chat */}
      <PortalExtras />

      {/* Hero Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 text-white rounded-2xl p-8 border border-slate-800 shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center space-x-2 bg-sky-500/20 border border-sky-400/40 px-3 py-1 rounded-full text-xs text-sky-300 font-semibold">
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>RyzenDesk Customer Help Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            How can our engineering team help you today?
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Search our knowledge base documentation, track existing support tickets, or submit a new inquiry.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenNewTicket}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-transform active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-slate-950" />
              <span>Submit a Support Request</span>
            </button>
          </div>
        </div>
      </div>

      {/* Ticket Lookup by Access Token or Email */}
      <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-5 space-y-4">
        <div className="flex items-center space-x-2">
          <Key className="w-4 h-4 text-sky-600" />
          <h3 className="font-bold text-slate-800 text-sm">Track Your Existing Tickets</h3>
        </div>
        <form onSubmit={handleLookup} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="Enter Ticket ID (e.g. RD-2026-0001) or customer email address..."
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="flex-1 p-2.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 cursor-pointer"
          >
            <span>Look Up Ticket</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </form>

        {activeCustomerEmail && (
          <div className="space-y-3 pt-2">
            <div className="text-xs text-slate-500 flex items-center justify-between">
              <span>
                Found <strong className="text-slate-800">{customerTickets.length}</strong> ticket(s) for{' '}
                <strong className="text-sky-700">{activeCustomerEmail}</strong>
              </span>
              <button
                onClick={() => setActiveCustomerEmail(null)}
                className="text-sky-600 hover:underline"
              >
                Clear
              </button>
            </div>

            <div className="space-y-2">
              {customerTickets.map((tkt) => (
                <div
                  key={tkt.id}
                  onClick={() => onSelectTicket(tkt)}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-sky-400 bg-slate-50/50 hover:bg-white transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {tkt.id}
                      </span>
                      <span className="text-xs font-semibold text-slate-800">{tkt.subject}</span>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-500">
                      <span>Status: <strong className="capitalize">{tkt.status}</strong></span>
                      <span>•</span>
                      <span>Created {new Date(tkt.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <SlaTimer sla={tkt.sla} status={tkt.status} compact />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Public Knowledge Base Search */}
      <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-sky-600" />
            <h3 className="font-bold text-slate-800 text-sm">Knowledge Base & FAQ Articles</h3>
          </div>
          <span className="text-xs text-slate-400">Public Self-Service</span>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search guides, setup tutorials, billing questions..."
            value={searchKb}
            onChange={(e) => setSearchKb(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {publicArticles.map((article) => (
            <div
              key={article.id}
              onClick={() => onSelectWikiPage(article)}
              className="p-3.5 rounded-xl border border-slate-200 hover:border-sky-400 bg-slate-50/50 hover:bg-white transition-all cursor-pointer space-y-1.5 group"
            >
              <h4 className="font-bold text-xs text-slate-800 group-hover:text-sky-600 transition-colors flex items-center justify-between">
                <span>{article.title}</span>
                <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-sky-500" />
              </h4>
              <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed">
                {article.content.slice(0, 140)}...
              </p>
              <div className="text-[10px] text-slate-400 flex items-center space-x-2 pt-1">
                <span>👍 {article.helpfulVotes} helpful</span>
                <span>•</span>
                <span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
