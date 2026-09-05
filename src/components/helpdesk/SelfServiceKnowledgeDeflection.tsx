import React from 'react'
import { BookOpen, ExternalLink, Lightbulb } from 'lucide-react'
import type { WikiPage } from '../../types'

interface SelfServiceKnowledgeDeflectionProps {
  query: string
  wikiPages: WikiPage[]
  onSelectPage?: (page: WikiPage) => void
}

export const SelfServiceKnowledgeDeflection: React.FC<SelfServiceKnowledgeDeflectionProps> = ({
  query,
  wikiPages,
  onSelectPage,
}) => {
  if (!query || query.trim().length < 3) return null

  const q = query.toLowerCase().trim()
  const matchingPages = wikiPages
    .filter((p) => p.visibility !== 'restricted')
    .filter((p) => p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q))
    .slice(0, 3)

  if (matchingPages.length === 0) return null

  return (
    <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-3 space-y-2 text-xs animate-in fade-in">
      <div className="flex items-center space-x-1.5 text-sky-800 font-bold">
        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
        <span>Instant Knowledge Base Suggestions</span>
      </div>
      <p className="text-[11px] text-slate-600">
        These help articles might solve your issue right away without waiting for support:
      </p>

      <div className="space-y-1.5 pt-0.5">
        {matchingPages.map((page) => (
          <div
            key={page.id}
            onClick={() => onSelectPage && onSelectPage(page)}
            className="p-2 bg-white rounded-lg border border-sky-100 hover:border-sky-300 transition-all cursor-pointer flex items-center justify-between group shadow-2xs"
          >
            <div className="flex items-center space-x-2 min-w-0 pr-2">
              <BookOpen className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              <span className="font-semibold text-slate-800 group-hover:text-sky-600 truncate">
                {page.title}
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[10px] text-sky-600 shrink-0 font-medium">
              <span>Read article</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
