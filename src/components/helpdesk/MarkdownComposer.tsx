import React, { useState } from 'react'
import {
  Bold,
  Italic,
  Code,
  Quote,
  List,
  Link,
  Eye,
  Edit3,
  Bookmark,
} from 'lucide-react'
import type { CannedReply } from '../../types'

interface MarkdownComposerProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  cannedReplies?: CannedReply[]
  onOpenCannedModal?: () => void
  clientName?: string
  ticketId?: string
}

export const MarkdownComposer: React.FC<MarkdownComposerProps> = ({
  value,
  onChange,
  placeholder = 'Write a message or internal note (Markdown supported)...',
  cannedReplies = [],
  onOpenCannedModal,
  clientName = 'Customer',
  ticketId = '',
}) => {
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [showMacroMenu, setShowMacroMenu] = useState(false)

  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('composer-textarea') as HTMLTextAreaElement
    if (!textarea) {
      onChange(value + prefix + suffix)
      return
    }

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.substring(start, end)
    const replacement = prefix + (selected || 'text') + suffix
    const nextVal = value.substring(0, start) + replacement + value.substring(end)
    onChange(nextVal)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected ? selected.length : 4))
    }, 10)
  }

  const insertCanned = (reply: CannedReply) => {
    let text = reply.body
    text = text.replace(/\{\{client_name\}\}/gi, clientName)
    text = text.replace(/\{\{ticket_id\}\}/gi, ticketId)
    onChange(value ? `${value}\n\n${text}` : text)
    setShowMacroMenu(false)
  }

  // Simple Markdown renderer for Preview tab
  const renderSimpleMarkdown = (text: string) => {
    if (!text.trim()) return <p className="text-slate-400 italic">Nothing to preview</p>
    const lines = text.split('\n')

    return (
      <div className="space-y-2 text-xs text-slate-800">
        {lines.map((line, idx) => {
          if (line.startsWith('> ')) {
            return (
              <blockquote key={idx} className="border-l-2 border-slate-300 pl-2.5 py-0.5 text-slate-600 italic">
                {line.slice(2)}
              </blockquote>
            )
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div key={idx} className="flex items-start space-x-1.5 ml-2">
                <span className="text-slate-400">•</span>
                <span>{line.slice(2)}</span>
              </div>
            )
          }
          if (line.startsWith('```')) {
            return (
              <pre key={idx} className="bg-slate-800 text-slate-100 p-2 rounded text-[11px] font-mono overflow-x-auto">
                {line.replace(/```/g, '')}
              </pre>
            )
          }
          return <p key={idx} className="min-h-[1em]">{line}</p>
        })}
      </div>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500/20 transition-all">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-1.5 bg-slate-50 border-b border-slate-200 text-xs">
        {/* Formatting Buttons */}
        <div className="flex items-center space-x-0.5">
          <button
            type="button"
            onClick={() => insertFormatting('**', '**')}
            title="Bold (**text**)"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('*', '*')}
            title="Italic (*text*)"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('`', '`')}
            title="Inline Code (`code`)"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('> ')}
            title="Quote (> quote)"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('- ')}
            title="List (- item)"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('[Link](', ')')}
            title="Link ([title](url))"
            className="p-1.5 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Link className="w-3.5 h-3.5" />
          </button>

          {/* Quick Macro / Canned Replies Dropdown */}
          {cannedReplies.length > 0 && (
            <div className="relative inline-block ml-1">
              <button
                type="button"
                onClick={() => setShowMacroMenu((prev) => !prev)}
                title="Insert Canned Response Macro"
                className="px-2 py-1 rounded bg-white hover:bg-sky-50 text-sky-700 font-semibold border border-sky-200 text-[11px] flex items-center gap-1 transition-colors"
              >
                <Bookmark className="w-3 h-3 text-sky-600" />
                <span>Quick Macro</span>
              </button>

              {showMacroMenu && (
                <div className="absolute left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1 z-30 divide-y divide-slate-100 animate-in fade-in">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Canned Macros
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {cannedReplies.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => insertCanned(r)}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-50 transition-colors"
                      >
                        <div className="font-semibold text-xs text-slate-800">{r.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">{r.body}</div>
                      </button>
                    ))}
                  </div>
                  {onOpenCannedModal && (
                    <div className="p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMacroMenu(false)
                          onOpenCannedModal()
                        }}
                        className="w-full text-center text-[10px] font-medium text-sky-600 hover:underline"
                      >
                        Manage Canned Templates →
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab switch */}
        <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-[11px] font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
              tab === 'write' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            <span>Write</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={`px-2 py-0.5 rounded transition-all flex items-center gap-1 ${
              tab === 'preview' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'hover:text-slate-900'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Editor Area */}
      {tab === 'write' ? (
        <textarea
          id="composer-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className="w-full p-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden resize-y min-h-[90px]"
        />
      ) : (
        <div className="p-3 min-h-[90px] bg-slate-50/50 max-h-60 overflow-y-auto">
          {renderSimpleMarkdown(value)}
        </div>
      )}
    </div>
  )
}
