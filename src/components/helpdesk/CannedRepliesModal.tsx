import React, { useState } from 'react'
import { Search, Sparkles, X, Check, Tag } from 'lucide-react'
import type { CannedReply, Ticket } from '../../types'

interface CannedRepliesModalProps {
  isOpen: boolean
  onClose: () => void
  cannedReplies: CannedReply[]
  ticket: Ticket
  currentAgent: string
  onSelectReply: (populatedText: string) => void
}

export const CannedRepliesModal: React.FC<CannedRepliesModalProps> = ({
  isOpen,
  onClose,
  cannedReplies,
  ticket,
  currentAgent,
  onSelectReply,
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('All')

  if (!isOpen) return null

  const categories = ['All', ...Array.from(new Set(cannedReplies.map((r) => r.category)))]

  const filtered = cannedReplies.filter((r) => {
    const matchesCat = selectedCategory === 'All' || r.category === selectedCategory
    const q = searchTerm.toLowerCase()
    const matchesSearch =
      r.title.toLowerCase().includes(q) ||
      r.shortcut.toLowerCase().includes(q) ||
      r.body.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q))
    return matchesCat && matchesSearch
  })

  const populateVariables = (rawBody: string) => {
    return rawBody
      .replace(/{{customer_name}}/g, ticket.contact.fullName)
      .replace(/{{ticket_id}}/g, ticket.id)
      .replace(/{{ticket_subject}}/g, ticket.subject)
      .replace(/{{agent_name}}/g, currentAgent)
      .replace(/{{team_name}}/g, ticket.team)
      .replace(/{{priority}}/g, ticket.priority.toUpperCase())
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-sky-600" />
            <h3 className="font-semibold text-slate-800 text-base">Select Canned Reply Template</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Categories Filter */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by title, shortcut (e.g. /logs) or keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              autoFocus
            />
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-sky-600 text-white font-medium'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Templates List */}
        <div className="overflow-y-auto p-4 space-y-3 flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No matching canned responses found.
            </div>
          ) : (
            filtered.map((reply) => {
              const populated = populateVariables(reply.body)
              return (
                <div
                  key={reply.id}
                  className="group p-3.5 rounded-lg border border-slate-200 hover:border-sky-400 hover:shadow-xs transition-all bg-slate-50/50 hover:bg-white"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-800 text-sm">{reply.title}</span>
                        <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-mono text-[11px] font-semibold">
                          {reply.shortcut}
                        </span>
                        <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {reply.category}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 mt-1">
                        {reply.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center text-[10px] text-slate-500 bg-slate-200/70 px-1.5 py-0.2 rounded"
                          >
                            <Tag className="w-2.5 h-2.5 mr-0.5" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onSelectReply(populated)
                        onClose()
                      }}
                      className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center space-x-1 transition-transform active:scale-95 shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Use Template</span>
                    </button>
                  </div>

                  {/* Populated Preview */}
                  <div className="mt-2.5 p-2 rounded bg-slate-100 text-slate-700 text-xs font-mono whitespace-pre-wrap border border-slate-200 max-h-32 overflow-y-auto">
                    {populated}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex justify-between items-center">
          <span>Variables like &#123;&#123;customer_name&#125;&#125; are replaced automatically.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded border border-slate-300 hover:bg-slate-200 text-slate-700 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
