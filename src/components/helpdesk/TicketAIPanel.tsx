import React, { useState } from 'react'
import { Sparkles, Brain, CheckCircle2, MessageSquareText, RefreshCw, AlertCircle, Send } from 'lucide-react'
import type { Ticket, TicketSummaryAI, SmartReplyAI } from '../../types'
import { toast } from '../common/ToastContainer'

interface TicketAIPanelProps {
  ticket: Ticket
  onInsertSmartReply: (text: string) => void
  onUpdateTicketSummary?: (summary: TicketSummaryAI) => void
}

export const TicketAIPanel: React.FC<TicketAIPanelProps> = ({ ticket, onInsertSmartReply, onUpdateTicketSummary }) => {
  const [summary, setSummary] = useState<TicketSummaryAI | null>(ticket.aiSummary || null)
  const [smartReplies, setSmartReplies] = useState<SmartReplyAI[]>([])
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [loadingReplies, setLoadingReplies] = useState(false)

  const handleGenerateSummary = async () => {
    setLoadingSummary(true)
    try {
      const res = await fetch('/api/ai/summarize-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id }),
      })
      const data = await res.json()
      if (res.ok) {
        setSummary(data)
        if (onUpdateTicketSummary) onUpdateTicketSummary(data)
        toast.success('AI Summary Generated', 'Ticket analyzed with Gemini AI')
      } else {
        toast.error('AI Summary Failed', data.error || 'Could not analyze ticket')
      }
    } catch (err: any) {
      toast.error('Network Error', err?.message)
    } finally {
      setLoadingSummary(false)
    }
  }

  const handleLoadSmartReplies = async () => {
    setLoadingReplies(true)
    try {
      const res = await fetch('/api/ai/smart-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id }),
      })
      const data = await res.json()
      if (res.ok && data.suggestions) {
        setSmartReplies(data.suggestions)
        toast.info('Smart Replies Ready', 'Generated 3 context-aware response variations')
      }
    } catch (err: any) {
      toast.error('Smart Replies Error', err?.message)
    } finally {
      setLoadingReplies(false)
    }
  }

  const getSentimentBadge = (sent?: string) => {
    switch (sent) {
      case 'urgent':
        return <span className="bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Urgent Tone</span>
      case 'frustrated':
        return <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Frustrated</span>
      case 'positive':
        return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Satisfied / Positive</span>
      default:
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Neutral</span>
    }
  }

  return (
    <div className="bg-gradient-to-br from-sky-50/60 via-indigo-50/40 to-purple-50/30 rounded-xl border border-sky-200/80 p-3.5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-sky-500 text-white shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <span>Gemini AI Assistant</span>
              <span className="text-[9px] font-semibold bg-sky-100 text-sky-700 px-1.5 py-0.2 rounded-full border border-sky-200">
                v3.8
              </span>
            </h4>
            <p className="text-[10px] text-slate-500">Autonomous ticket synthesis & smart reply drafts</p>
          </div>
        </div>

        <button
          onClick={handleGenerateSummary}
          disabled={loadingSummary}
          className="text-xs bg-white hover:bg-sky-50 text-sky-700 border border-sky-200 px-2.5 py-1 rounded-lg font-medium shadow-2xs transition-colors flex items-center space-x-1.5 disabled:opacity-60"
        >
          <RefreshCw className={`w-3 h-3 ${loadingSummary ? 'animate-spin' : ''}`} />
          <span>{summary ? 'Re-Analyze' : 'Analyze Thread'}</span>
        </button>
      </div>

      {/* Summary Content */}
      {summary ? (
        <div className="bg-white/90 rounded-lg p-3 border border-sky-100 space-y-2.5 shadow-2xs text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Executive Summary</span>
            {getSentimentBadge(summary.sentiment)}
          </div>
          <p className="text-slate-700 leading-relaxed text-[11px]">{summary.executiveSummary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Root Cause
              </span>
              <p className="text-slate-700">{summary.rootCause}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Recommended Action
              </span>
              <p className="text-slate-700 font-medium">{summary.recommendedAction}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/60 rounded-lg p-2.5 border border-dashed border-sky-200 flex items-center justify-between text-xs text-slate-500">
          <span>Click "Analyze Thread" to generate a real-time AI summary and sentiment score.</span>
        </div>
      )}

      {/* Smart Reply Suggestions */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <MessageSquareText className="w-3 h-3 text-sky-600" />
            <span>Smart Reply Suggestions</span>
          </span>
          <button
            onClick={handleLoadSmartReplies}
            disabled={loadingReplies}
            className="text-[10px] text-sky-600 hover:text-sky-800 font-semibold hover:underline flex items-center gap-1"
          >
            {loadingReplies ? 'Generating...' : smartReplies.length > 0 ? 'Refresh Suggestions' : 'Generate Suggestions'}
          </button>
        </div>

        {smartReplies.length > 0 && (
          <div className="grid grid-cols-1 gap-1.5">
            {smartReplies.map((reply, i) => (
              <div
                key={i}
                className="bg-white/95 rounded-lg p-2.5 border border-slate-200/80 hover:border-sky-300 transition-all flex flex-col justify-between group shadow-2xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-slate-800">{reply.title}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded font-semibold bg-slate-100 text-slate-600 uppercase">
                    {reply.tone}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2 italic mb-2">"{reply.body}"</p>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      onInsertSmartReply(reply.body)
                      toast.info('Inserted into draft', 'Smart reply copied into your message composer')
                    }}
                    className="text-[10px] font-semibold bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white px-2 py-1 rounded transition-colors flex items-center gap-1 border border-sky-200"
                  >
                    <Send className="w-2.5 h-2.5" />
                    <span>Insert into reply draft</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
