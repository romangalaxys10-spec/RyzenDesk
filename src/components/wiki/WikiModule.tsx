import React, { useState } from 'react'
import {
  BookOpen,
  Folder,
  FileText,
  Search,
  Plus,
  Edit3,
  History,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Check,
  Eye,
  Lock,
  Globe,
  Tag,
  ArrowLeft,
  Calendar,
  User,
  ExternalLink,
  ChevronRight,
  List,
} from 'lucide-react'
import type { WikiSpace, WikiPage, WikiRevision, StaffRole } from '../../types'
import { useI18n } from '../../i18n/translations'

interface WikiModuleProps {
  spaces: WikiSpace[]
  pages: WikiPage[]
  currentRole: StaffRole
  currentUsername: string
  onCreateSpace: (space: { name: string; key: string; description: string; isPrivate: boolean }) => void
  onCreatePage: (page: { spaceId: string; title: string; content: string; visibility: 'public' | 'internal' | 'restricted' }) => void
  onUpdatePage: (pageId: string, updates: { title?: string; content?: string; summary?: string; visibility?: 'public' | 'internal' | 'restricted' }) => void
  onRollbackPage: (pageId: string, revisionId: string) => void
  onVotePage: (pageId: string, helpful: boolean) => void
}

export const WikiModule: React.FC<WikiModuleProps> = ({
  spaces,
  pages,
  currentRole,
  currentUsername,
  onCreateSpace,
  onCreatePage,
  onUpdatePage,
  onRollbackPage,
  onVotePage,
}) => {
  const { t } = useI18n()
  const [activeSpaceId, setActiveSpaceId] = useState<string>(spaces[0]?.id || '')
  const [selectedPageId, setSelectedPageId] = useState<string>(pages[0]?.id || '')
  const [isEditing, setIsEditing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showNewSpaceModal, setShowNewSpaceModal] = useState(false)
  const [showNewPageModal, setShowNewPageModal] = useState(false)

  // Editor states
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editVisibility, setEditVisibility] = useState<'public' | 'internal' | 'restricted'>('internal')
  const [editSummary, setEditSummary] = useState('')
  const [previewMode, setPreviewMode] = useState(false)

  // New Space Form
  const [spaceName, setSpaceName] = useState('')
  const [spaceKey, setSpaceKey] = useState('')
  const [spaceDesc, setSpaceDesc] = useState('')
  const [spacePrivate, setSpacePrivate] = useState(false)

  // New Page Form
  const [newPageTitle, setNewPageTitle] = useState('')
  const [newPageSpaceId, setNewPageSpaceId] = useState('')
  const [newPageVisibility, setNewPageVisibility] = useState<'public' | 'internal' | 'restricted'>('internal')

  const canEdit = currentRole !== 'viewer' && currentRole !== 'client'

  const activeSpace = spaces.find((s) => s.id === activeSpaceId) || spaces[0]
  const spacePages = pages.filter((p) => p.spaceId === activeSpace?.id)

  const selectedPage = pages.find((p) => p.id === selectedPageId) || spacePages[0] || pages[0]

  const filteredPages = searchQuery
    ? pages.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : spacePages

  const handleStartEdit = () => {
    if (!selectedPage) return
    setEditTitle(selectedPage.title)
    setEditContent(selectedPage.content)
    setEditVisibility(selectedPage.visibility)
    setEditSummary('')
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    if (!selectedPage) return
    onUpdatePage(selectedPage.id, {
      title: editTitle,
      content: editContent,
      visibility: editVisibility,
      summary: editSummary || 'Page content updated',
    })
    setIsEditing(false)
  }

  // Generate Table of Contents from markdown headings
  const generateToc = (content: string) => {
    const lines = content.split('\n')
    const headings: Array<{ level: number; text: string }> = []
    for (const line of lines) {
      const match = line.match(/^(#{1,3})\s+(.+)$/)
      if (match) {
        headings.push({
          level: match[1].length,
          text: match[2].trim(),
        })
      }
    }
    return headings
  }

  const toc = selectedPage ? generateToc(selectedPage.content) : []

  // Insert markdown helper in editor
  const insertMd = (prefix: string, suffix: string = '') => {
    setEditContent((prev) => `${prev}\n${prefix}Heading / Text${suffix}\n`)
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Top Search & Spaces Header */}
      <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Space navigation pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          {spaces.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSpaceId(s.id)
                const first = pages.find((p) => p.spaceId === s.id)
                if (first) setSelectedPageId(first.id)
              }}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeSpace?.id === s.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-sky-400" />
              <span>{s.name}</span>
              <span className="text-[10px] opacity-70 font-mono">[{s.key}]</span>
            </button>
          ))}

          {canEdit && (
            <button
              onClick={() => setShowNewSpaceModal(true)}
              className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Space</span>
            </button>
          )}
        </div>

        {/* Global Wiki Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search documentation & KB..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:w-64 pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Main Layout: Left Page Directory Tree | Right Document Content */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left Sidebar: Pages Index */}
        <div className="md:col-span-4 lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-2xs p-4 flex flex-col h-[75vh]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {searchQuery ? 'Search Results' : `${activeSpace?.name} Pages`}
            </span>
            {canEdit && (
              <button
                onClick={() => {
                  setNewPageSpaceId(activeSpace?.id || spaces[0]?.id)
                  setShowNewPageModal(true)
                }}
                className="p-1 rounded-md bg-sky-50 text-sky-600 hover:bg-sky-100 text-xs font-semibold flex items-center space-x-1"
                title="New Page"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Page</span>
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 space-y-1 pt-2">
            {filteredPages.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No pages found in this space.
              </div>
            ) : (
              filteredPages.map((p) => {
                const isSelected = selectedPage?.id === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPageId(p.id)
                      setIsEditing(false)
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-sky-50 text-sky-800 font-semibold border-l-3 border-sky-600'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <FileText className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-sky-600' : 'text-slate-400'}`} />
                      <span className="truncate">{p.title}</span>
                    </div>
                    {p.visibility === 'public' ? (
                      <Globe className="w-3 h-3 text-emerald-500 shrink-0 ml-1" title="Public KB" />
                    ) : (
                      <Lock className="w-3 h-3 text-slate-400 shrink-0 ml-1" title="Internal Only" />
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Content Area: Document Reader or Editor */}
        <div className="md:col-span-8 lg:col-span-9 bg-white rounded-xl border border-slate-200 shadow-2xs p-6 flex flex-col min-h-[75vh]">
          {isEditing ? (
            /* EDITOR VIEW */
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="font-bold text-slate-800 text-sm">Editing Page</h3>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setPreviewMode(!previewMode)}
                    className="px-3 py-1.5 rounded-md border text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center space-x-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{previewMode ? 'Raw Markdown' : 'Split Preview'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-md border text-xs text-slate-600 hover:bg-slate-100 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEdit}
                    className="px-4 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs"
                  >
                    Save & Publish
                  </button>
                </div>
              </div>

              {/* Title & Visibility */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Page Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-2 text-sm font-semibold border rounded-lg focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Visibility</label>
                  <select
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(e.target.value as any)}
                    className="w-full p-2 text-xs border rounded-lg bg-white"
                  >
                    <option value="internal">Internal (Staff Only)</option>
                    <option value="public">Public (Help Center KB)</option>
                    <option value="restricted">Restricted (Admins Only)</option>
                  </select>
                </div>
              </div>

              {/* Quick Markdown Toolbar */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50 border rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => insertMd('# ')}
                  className="px-2 py-1 rounded bg-white border text-slate-700 font-bold hover:bg-slate-100"
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => insertMd('## ')}
                  className="px-2 py-1 rounded bg-white border text-slate-700 font-bold hover:bg-slate-100"
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={() => insertMd('**', '**')}
                  className="px-2 py-1 rounded bg-white border text-slate-700 font-bold hover:bg-slate-100"
                >
                  Bold
                </button>
                <button
                  type="button"
                  onClick={() => insertMd('```bash\n', '\n```')}
                  className="px-2 py-1 rounded bg-white border text-slate-700 font-mono hover:bg-slate-100"
                >
                  Code
                </button>
                <button
                  type="button"
                  onClick={() => insertMd('> 💡 **Notice:** ')}
                  className="px-2 py-1 rounded bg-white border text-slate-700 hover:bg-slate-100"
                >
                  Callout
                </button>
                <button
                  type="button"
                  onClick={() => insertMd('- [ ] ')}
                  className="px-2 py-1 rounded bg-white border text-slate-700 hover:bg-slate-100"
                >
                  Checklist
                </button>
              </div>

              {/* Editor Workspace */}
              <div className={`grid ${previewMode ? 'grid-cols-2 gap-4' : 'grid-cols-1'} flex-1`}>
                <textarea
                  rows={16}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-3 font-mono text-xs border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  placeholder="Write documentation content in Markdown..."
                />
                {previewMode && (
                  <div className="p-4 border rounded-lg bg-white overflow-y-auto max-h-[50vh] prose prose-sm text-xs whitespace-pre-wrap">
                    {editContent}
                  </div>
                )}
              </div>

              {/* Version revision summary note */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Change Summary Note</label>
                <input
                  type="text"
                  placeholder="Briefly describe what changed (e.g. Added section on escalation workflows)..."
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  className="w-full p-2 text-xs border rounded-lg"
                />
              </div>
            </div>
          ) : selectedPage ? (
            /* READER VIEW */
            <div className="space-y-5 flex-1 flex flex-col">
              {/* Header & Meta */}
              <div className="border-b border-slate-200 pb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                    <span>Spaces</span>
                    <ChevronRight className="w-3 h-3" />
                    <span>{activeSpace?.name}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="font-semibold text-slate-700">{selectedPage.title}</span>
                  </div>

                  {canEdit && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowHistoryModal(true)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <History className="w-3.5 h-3.5 text-slate-500" />
                        <span>History ({selectedPage.revisions.length})</span>
                      </button>
                      <button
                        onClick={handleStartEdit}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Page</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <h1 className="text-2xl font-bold text-slate-900">{selectedPage.title}</h1>
                  <span
                    className={`inline-flex items-center space-x-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      selectedPage.visibility === 'public'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {selectedPage.visibility === 'public' ? (
                      <Globe className="w-3 h-3" />
                    ) : (
                      <Lock className="w-3 h-3" />
                    )}
                    <span className="capitalize">{selectedPage.visibility}</span>
                  </span>
                </div>

                <div className="flex items-center space-x-4 text-xs text-slate-500 pt-1">
                  <span className="flex items-center space-x-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Author: {selectedPage.author}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Updated {new Date(selectedPage.updatedAt).toLocaleDateString()}</span>
                  </span>
                </div>
              </div>

              {/* Table of contents bar (if headings exist) */}
              {toc.length > 1 && (
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                  <span className="font-bold text-slate-600 flex items-center space-x-1">
                    <List className="w-3.5 h-3.5 text-sky-600" />
                    <span>Table of Contents</span>
                  </span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {toc.map((h, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-white border border-slate-200 text-sky-700 hover:underline cursor-pointer"
                      >
                        {h.text}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Rendered Document Body */}
              <div className="prose prose-slate max-w-none text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans flex-1 py-2">
                {selectedPage.content}
              </div>

              {/* Helpfulness Voting Bar */}
              <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium">Was this documentation article helpful?</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => onVotePage(selectedPage.id, true)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span>Yes ({selectedPage.helpfulVotes})</span>
                  </button>
                  <button
                    onClick={() => onVotePage(selectedPage.id, false)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span>No ({selectedPage.unhelpfulVotes})</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-sm">
              Select or create a page to view documentation.
            </div>
          )}
        </div>
      </div>

      {/* Revision History & Rollback Modal */}
      {showHistoryModal && selectedPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[80vh] flex flex-col p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <History className="w-5 h-5 text-sky-600" />
              <span>Version History & Rollback</span>
            </h3>

            <div className="overflow-y-auto space-y-2 flex-1 text-xs">
              {selectedPage.revisions.map((rev, index) => (
                <div
                  key={rev.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800">
                        Version {selectedPage.revisions.length - index}
                      </span>
                      {index === 0 && (
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded text-[10px]">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div className="text-slate-600">{rev.summary}</div>
                    <div className="text-[11px] text-slate-400">
                      By {rev.author} at {new Date(rev.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {index !== 0 && canEdit && (
                    <button
                      onClick={() => {
                        if (confirm('Rollback page to this historical version?')) {
                          onRollbackPage(selectedPage.id, rev.id)
                          setShowHistoryModal(false)
                        }
                      }}
                      className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center space-x-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Rollback</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-1.5 border rounded-lg text-xs font-medium text-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Space Modal */}
      {showNewSpaceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <Folder className="w-5 h-5 text-sky-600" />
              <span>Create Documentation Space</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Space Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Infrastructure Runbooks"
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Space Key (3-4 uppercase chars)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. INFRA"
                  value={spaceKey}
                  onChange={(e) => setSpaceKey(e.target.value.toUpperCase())}
                  className="w-full p-2 border rounded-md font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Purpose of this space..."
                  value={spaceDesc}
                  onChange={(e) => setSpaceDesc(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowNewSpaceModal(false)}
                className="px-3 py-1.5 border rounded-md text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!spaceName.trim() || !spaceKey.trim()) return
                  onCreateSpace({
                    name: spaceName.trim(),
                    key: spaceKey.trim(),
                    description: spaceDesc.trim(),
                    isPrivate: spacePrivate,
                  })
                  setShowNewSpaceModal(false)
                  setSpaceName('')
                  setSpaceKey('')
                  setSpaceDesc('')
                }}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-semibold"
              >
                Create Space
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Page Modal */}
      {showNewPageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
              <FileText className="w-5 h-5 text-sky-600" />
              <span>Create New Page</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Target Space</label>
                <select
                  value={newPageSpaceId}
                  onChange={(e) => setNewPageSpaceId(e.target.value)}
                  className="w-full p-2 border rounded-md bg-white"
                >
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.key})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Page Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Incident Response Protocol"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  className="w-full p-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Visibility</label>
                <select
                  value={newPageVisibility}
                  onChange={(e) => setNewPageVisibility(e.target.value as any)}
                  className="w-full p-2 border rounded-md bg-white"
                >
                  <option value="internal">Internal (Staff Only)</option>
                  <option value="public">Public (Help Center KB)</option>
                  <option value="restricted">Restricted (Admins Only)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowNewPageModal(false)}
                className="px-3 py-1.5 border rounded-md text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!newPageTitle.trim()) return
                  onCreatePage({
                    spaceId: newPageSpaceId,
                    title: newPageTitle.trim(),
                    content: `# ${newPageTitle.trim()}\n\nWrite documentation content here...`,
                    visibility: newPageVisibility,
                  })
                  setShowNewPageModal(false)
                  setNewPageTitle('')
                }}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-semibold"
              >
                Create Page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
