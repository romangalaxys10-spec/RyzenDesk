import React, { useState, useEffect } from 'react'
import {
  Plus,
  MoreHorizontal,
  Calendar,
  CheckSquare,
  Paperclip,
  MessageSquare,
  User,
  Star,
  ExternalLink,
  X,
  Trash2,
  Tag,
  Check,
  Clock,
  AlertCircle,
  Filter,
  Kanban as KanbanIcon,
  GripVertical,
  MoveRight,
} from 'lucide-react'
import type { KanbanBoard, KanbanCard, KanbanList, StaffMember, Ticket, FileAttachment } from '../../types'
import { AttachmentList, AttachmentUploader } from '../helpdesk/AttachmentViewer'
import { useI18n } from '../../i18n/translations'

interface KanbanModuleProps {
  boards: KanbanBoard[]
  staffList: StaffMember[]
  tickets: Ticket[]
  onUpdateBoard: (boardId: string, updates: Partial<KanbanBoard>) => void
  onCreateBoard: (board: { title: string; description: string; color: string; isFavorite: boolean }) => void
  onDeleteBoard: (boardId: string) => void
  onCreateCard: (boardId: string, listId: string, card: { title: string; description?: string }) => void
  onUpdateCard: (cardId: string, updates: Partial<KanbanCard> & { targetListId?: string; targetIndex?: number }) => void
  onDeleteCard: (cardId: string) => void
  onSelectTicket?: (ticket: Ticket) => void
}

export const KanbanModule: React.FC<KanbanModuleProps> = ({
  boards,
  staffList,
  tickets,
  onUpdateBoard,
  onCreateBoard,
  onDeleteBoard,
  onCreateCard,
  onUpdateCard,
  onDeleteCard,
  onSelectTicket,
}) => {
  const { t } = useI18n()
  const [activeBoardId, setActiveBoardId] = useState<string>(boards[0]?.id || '')
  const [selectedCard, setSelectedCard] = useState<KanbanCard | null>(null)
  const [newCardListId, setNewCardListId] = useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [newListTitle, setNewListTitle] = useState('')
  const [showAddList, setShowAddList] = useState(false)
  const [createBoardOpen, setCreateBoardOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')

  // Drag and drop state
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [draggedFromListId, setDraggedFromListId] = useState<string | null>(null)
  const [dragOverListId, setDragOverListId] = useState<string | null>(null)
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'top' | 'bottom' | null>(null)

  // New Board Form State
  const [newBoardTitle, setNewBoardTitle] = useState('')
  const [newBoardDesc, setNewBoardDesc] = useState('')
  const [newBoardColor, setNewBoardColor] = useState('#0284c7')

  // Card detail comment text
  const [commentText, setCommentText] = useState('')
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [newChecklistItem, setNewChecklistItem] = useState('')
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null)

  // Ensure valid board object (ignore error payloads or malformed objects)
  const validBoards = boards.filter((b) => b && typeof b === 'object' && b.id && Array.isArray(b.lists))
  const activeBoard = validBoards.find((b) => b.id === activeBoardId) || validBoards[0]

  // Keep activeBoardId synchronized when boards are loaded or changed
  useEffect(() => {
    if (validBoards.length > 0 && (!activeBoardId || !validBoards.some((b) => b.id === activeBoardId))) {
      setActiveBoardId(validBoards[0].id)
    }
  }, [validBoards, activeBoardId])

  // Create-board modal, extracted so the "no boards" empty state can render it too.
  // If this stayed below the early return, clicking "Create First Board" would flip
  // createBoardOpen to true but the modal markup would never be mounted (React
  // returns the empty state again before reaching it).
  const createBoardModal = createBoardOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-5 space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
          <KanbanIcon className="w-5 h-5 text-sky-600" />
          <span>Create Kanban Board</span>
        </h3>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Board Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Infrastructure Sprint"
              value={newBoardTitle}
              onChange={(e) => setNewBoardTitle(e.target.value)}
              className="w-full p-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Description</label>
            <input
              type="text"
              placeholder="Purpose of this board..."
              value={newBoardDesc}
              onChange={(e) => setNewBoardDesc(e.target.value)}
              className="w-full p-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Theme Color</label>
            <div className="flex items-center space-x-2">
              {['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0f172a'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewBoardColor(c)}
                  className={`w-6 h-6 rounded-full border-2 ${newBoardColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setCreateBoardOpen(false)}
            className="px-3 py-1.5 border rounded-md text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!newBoardTitle.trim()) return
              onCreateBoard({
                title: newBoardTitle.trim(),
                description: newBoardDesc.trim(),
                color: newBoardColor,
                isFavorite: false,
              })
              setCreateBoardOpen(false)
              setNewBoardTitle('')
              setNewBoardDesc('')
            }}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-semibold"
          >
            Create Board
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (!activeBoard) {
    return (
      <>
        <div className="text-center py-12">
          <KanbanIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">No Kanban Boards Available</h2>
          <p className="mt-1 text-sm text-slate-500">Create your first board to start organising tickets and work.</p>
          <button
            onClick={() => setCreateBoardOpen(true)}
            className="mt-3 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-semibold text-sm"
          >
            Create First Board
          </button>
        </div>
        {createBoardModal}
      </>
    )
  }

  // Handle adding list to board
  const handleAddList = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListTitle.trim()) return
    const updatedLists = [
      ...activeBoard.lists,
      {
        id: `list_${Date.now()}`,
        boardId: activeBoard.id,
        title: newListTitle.trim(),
        order: activeBoard.lists.length,
        cards: [],
      },
    ]
    onUpdateBoard(activeBoard.id, { lists: updatedLists })
    setNewListTitle('')
    setShowAddList(false)
  }

  // Handle adding card
  const handleAddCard = (listId: string) => {
    if (!newCardTitle.trim()) return
    onCreateCard(activeBoard.id, listId, { title: newCardTitle.trim() })
    setNewCardTitle('')
    setNewCardListId(null)
  }

  // Card Detail Checklists
  const handleAddChecklist = () => {
    if (!selectedCard || !newChecklistTitle.trim()) return
    const newCl = {
      id: `cl_${Date.now()}`,
      title: newChecklistTitle.trim(),
      items: [],
    }
    const updated = {
      ...selectedCard,
      checklists: [...selectedCard.checklists, newCl],
    }
    setSelectedCard(updated)
    onUpdateCard(selectedCard.id, { checklists: updated.checklists })
    setNewChecklistTitle('')
  }

  const handleToggleChecklistItem = (clId: string, itemId: string) => {
    if (!selectedCard) return
    const updatedCls = selectedCard.checklists.map((cl) => {
      if (cl.id !== clId) return cl
      return {
        ...cl,
        items: cl.items.map((it) => (it.id === itemId ? { ...it, completed: !it.completed } : it)),
      }
    })
    const updated = { ...selectedCard, checklists: updatedCls }
    setSelectedCard(updated)
    onUpdateCard(selectedCard.id, { checklists: updatedCls })
  }

  const handleAddChecklistItem = (clId: string) => {
    if (!selectedCard || !newChecklistItem.trim()) return
    const updatedCls = selectedCard.checklists.map((cl) => {
      if (cl.id !== clId) return cl
      return {
        ...cl,
        items: [
          ...cl.items,
          {
            id: `item_${Date.now()}`,
            text: newChecklistItem.trim(),
            completed: false,
          },
        ],
      }
    })
    const updated = { ...selectedCard, checklists: updatedCls }
    setSelectedCard(updated)
    onUpdateCard(selectedCard.id, { checklists: updatedCls })
    setNewChecklistItem('')
    setActiveChecklistId(null)
  }

  // Add Comment to card
  const handleAddComment = () => {
    if (!selectedCard || !commentText.trim()) return
    const newComment = {
      id: `comm_${Date.now()}`,
      author: 'Roman (Staff)',
      body: commentText.trim(),
      createdAt: new Date().toISOString(),
    }
    const updatedComments = [newComment, ...selectedCard.comments]
    const updated = { ...selectedCard, comments: updatedComments }
    setSelectedCard(updated)
    onUpdateCard(selectedCard.id, { comments: updatedComments })
    setCommentText('')
  }

  // Add Attachment to card
  const handleAddAttachmentsToCard = (newAtts: FileAttachment[]) => {
    if (!selectedCard) return
    const updatedAtts = [...(selectedCard.attachments || []), ...newAtts]
    const updated = { ...selectedCard, attachments: updatedAtts }
    setSelectedCard(updated)
    onUpdateCard(selectedCard.id, { attachments: updatedAtts })
  }

  return (
    <div className="space-y-4 max-w-full">
      {/* Board Navigation Header */}
      <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Board Switcher tabs */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          {validBoards.map((b) => (
            <button
              key={b.id}
              onClick={() => setActiveBoardId(b.id)}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeBoard.id === b.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
              <span>{b.title}</span>
              {b.isFavorite && <Star className="w-3 h-3 text-amber-400 fill-amber-400 ml-1" />}
            </button>
          ))}

          <button
            onClick={() => setCreateBoardOpen(true)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Board</span>
          </button>
        </div>

        {/* Board Actions */}
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Filter cards..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs w-36 sm:w-48 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
          <button
            onClick={() => onUpdateBoard(activeBoard.id, { isFavorite: !activeBoard.isFavorite })}
            className={`p-2 rounded-lg border text-xs ${
              activeBoard.isFavorite ? 'bg-amber-50 border-amber-300 text-amber-600' : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <Star className={`w-4 h-4 ${activeBoard.isFavorite ? 'fill-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Board Canvas (Horizontal Scrollable) */}
      <div className="flex items-start space-x-4 overflow-x-auto pb-6 pt-1 min-h-[70vh]">
        {(activeBoard.lists || []).map((list) => {
          const listCards = (list.cards || []).filter(
            (c) =>
              !searchFilter ||
              c.title?.toLowerCase().includes(searchFilter.toLowerCase()) ||
              c.description?.toLowerCase().includes(searchFilter.toLowerCase()) ||
              (c.labels || []).some((l) => (l.text || (l as any).name || '').toLowerCase().includes(searchFilter.toLowerCase()))
          )

          const isListDragTarget = dragOverListId === list.id

          return (
            <div
              key={list.id}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                if (dragOverListId !== list.id) {
                  setDragOverListId(list.id)
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOverListId === list.id) setDragOverListId(null)
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (!draggedCardId) return
                // Dropping on list container directly moves card to end of list
                onUpdateCard(draggedCardId, { targetListId: list.id, targetIndex: (list.cards || []).length })
                setDraggedCardId(null)
                setDraggedFromListId(null)
                setDragOverListId(null)
                setDragOverCardId(null)
                setDropPosition(null)
              }}
              className={`w-72 sm:w-80 shrink-0 rounded-xl border flex flex-col max-h-[80vh] shadow-2xs transition-all duration-150 ${
                isListDragTarget
                  ? 'bg-sky-50/70 border-sky-400 ring-2 ring-sky-400/40'
                  : 'bg-slate-100/90 border-slate-200/80'
              }`}
            >
              {/* List Header */}
              <div className="p-3 font-semibold text-xs text-slate-800 flex items-center justify-between border-b border-slate-200/60 bg-slate-50/90 rounded-t-xl">
                <div className="flex items-center space-x-2">
                  <span>{list.title}</span>
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] flex items-center justify-center font-bold">
                    {listCards.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete list "${list.title}" and its cards?`)) {
                      onUpdateBoard(activeBoard.id, {
                        lists: activeBoard.lists.filter((l) => l.id !== list.id),
                      })
                    }
                  }}
                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200/60"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Cards Scrollable Container */}
              <div className="p-2 space-y-2 overflow-y-auto flex-1 min-h-[90px]">
                {listCards.length === 0 && (
                  <div
                    className={`h-20 rounded-lg border-2 border-dashed flex items-center justify-center text-[11px] font-medium transition-colors ${
                      isListDragTarget
                        ? 'border-sky-400 bg-sky-100/60 text-sky-800'
                        : 'border-slate-200 text-slate-400 bg-slate-50/40'
                    }`}
                  >
                    {isListDragTarget ? 'Drop card here' : 'Empty list • Drag cards here'}
                  </div>
                )}

                {listCards.map((card, cardIndex) => {
                  const completedChecklistItems = (card.checklists || []).reduce(
                    (acc, cl) => acc + (cl.items || []).filter((it) => (it as any).completed || (it as any).done).length,
                    0
                  )
                  const totalChecklistItems = (card.checklists || []).reduce((acc, cl) => acc + (cl.items || []).length, 0)
                  const isOverdue = card.dueDate && new Date(card.dueDate).getTime() < Date.now() && !card.completed
                  const isBeingDragged = draggedCardId === card.id
                  const isDropTargetTop = dragOverCardId === card.id && dropPosition === 'top'
                  const isDropTargetBottom = dragOverCardId === card.id && dropPosition === 'bottom'

                  return (
                    <React.Fragment key={card.id}>
                      {/* Drop insertion line indicator above card */}
                      {isDropTargetTop && (
                        <div className="h-1 w-full bg-sky-500 rounded-full my-1 shadow-xs animate-pulse" />
                      )}

                      <div
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', card.id)
                          e.dataTransfer.effectAllowed = 'move'
                          setDraggedCardId(card.id)
                          setDraggedFromListId(list.id)
                        }}
                        onDragEnd={() => {
                          setDraggedCardId(null)
                          setDraggedFromListId(null)
                          setDragOverListId(null)
                          setDragOverCardId(null)
                          setDropPosition(null)
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          e.dataTransfer.dropEffect = 'move'
                          if (draggedCardId === card.id) return

                          const rect = e.currentTarget.getBoundingClientRect()
                          const relY = e.clientY - rect.top
                          const pos = relY < rect.height / 2 ? 'top' : 'bottom'

                          if (dragOverCardId !== card.id || dropPosition !== pos) {
                            setDragOverCardId(card.id)
                            setDropPosition(pos)
                            setDragOverListId(list.id)
                          }
                        }}
                        onDragLeave={(e) => {
                          if (dragOverCardId === card.id && !e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDragOverCardId(null)
                            setDropPosition(null)
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (!draggedCardId || draggedCardId === card.id) return

                          const targetIndex = dropPosition === 'top' ? cardIndex : cardIndex + 1
                          onUpdateCard(draggedCardId, {
                            targetListId: list.id,
                            targetIndex,
                          })

                          setDraggedCardId(null)
                          setDraggedFromListId(null)
                          setDragOverListId(null)
                          setDragOverCardId(null)
                          setDropPosition(null)
                        }}
                        onClick={() => setSelectedCard(card)}
                        className={`bg-white rounded-lg p-3 border transition-all cursor-grab active:cursor-grabbing space-y-2 group select-none ${
                          isBeingDragged
                            ? 'opacity-30 border-dashed border-sky-400 bg-sky-50/50 scale-[0.98]'
                            : 'border-slate-200 hover:border-sky-400 hover:shadow-xs'
                        }`}
                      >
                        {/* Top row: labels and subtle grip handle */}
                        <div className="flex items-center justify-between gap-1">
                          {card.labels && card.labels.length > 0 ? (
                            <div className="flex flex-wrap gap-1 flex-1">
                              {card.labels.map((lbl) => (
                                <span
                                  key={lbl.id}
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded text-white"
                                  style={{ backgroundColor: lbl.color }}
                                >
                                  {lbl.text || (lbl as any).name || 'Label'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="flex-1" />
                          )}
                          <div
                            title="Drag to reorder or move"
                            className="text-slate-300 group-hover:text-slate-500 p-0.5 rounded hover:bg-slate-100 transition-colors"
                          >
                            <GripVertical className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        {/* Card Title */}
                        <h4 className="text-xs font-semibold text-slate-800 leading-snug group-hover:text-sky-600">
                          {card.title}
                        </h4>

                        {/* Linked Ticket Badge */}
                        {card.ticketId && (
                          <div className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                            <ExternalLink className="w-2.5 h-2.5" />
                            <span>{card.ticketId}</span>
                          </div>
                        )}

                        {/* Bottom stats row */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                          <div className="flex items-center space-x-2">
                            {/* Due date */}
                            {card.dueDate && (
                              <span
                                className={`flex items-center space-x-0.5 ${
                                  card.completed
                                    ? 'text-emerald-600'
                                    : isOverdue
                                    ? 'text-rose-600 font-bold'
                                    : 'text-slate-500'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                <span>{new Date(card.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                              </span>
                            )}

                            {/* Checklist count */}
                            {totalChecklistItems > 0 && (
                              <span
                                className={`flex items-center space-x-0.5 ${
                                  completedChecklistItems === totalChecklistItems
                                    ? 'text-emerald-600 font-semibold'
                                    : 'text-slate-500'
                                }`}
                              >
                                <CheckSquare className="w-3 h-3" />
                                <span>
                                  {completedChecklistItems}/{totalChecklistItems}
                                </span>
                              </span>
                            )}

                            {/* Attachments count */}
                            {card.attachments && card.attachments.length > 0 && (
                              <span className="flex items-center space-x-0.5 text-slate-500">
                                <Paperclip className="w-3 h-3" />
                                <span>{card.attachments.length}</span>
                              </span>
                            )}

                            {/* Comments count */}
                            {card.comments && card.comments.length > 0 && (
                              <span className="flex items-center space-x-0.5 text-slate-500">
                                <MessageSquare className="w-3 h-3" />
                                <span>{card.comments.length}</span>
                              </span>
                            )}
                          </div>

                          {/* Assignees avatars */}
                          {card.assignees && card.assignees.length > 0 && (
                            <div className="flex -space-x-1">
                              {card.assignees.slice(0, 3).map((a) => (
                                <div
                                  key={a}
                                  title={a}
                                  className="w-5 h-5 rounded-full bg-indigo-100 border border-white text-indigo-700 text-[9px] flex items-center justify-center font-bold uppercase"
                                >
                                  {a[0]}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Drop insertion line indicator below card */}
                      {isDropTargetBottom && (
                        <div className="h-1 w-full bg-sky-500 rounded-full my-1 shadow-xs animate-pulse" />
                      )}
                    </React.Fragment>
                  )
                })}

                {/* Add Card Inline Form */}
                {newCardListId === list.id ? (
                  <div className="bg-white p-2.5 rounded-lg border border-sky-400 shadow-2xs space-y-2">
                    <textarea
                      rows={2}
                      autoFocus
                      placeholder="Enter a title for this card..."
                      value={newCardTitle}
                      onChange={(e) => setNewCardTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          handleAddCard(list.id)
                        }
                      }}
                      className="w-full text-xs p-2 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => handleAddCard(list.id)}
                        className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold"
                      >
                        Add Card
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCardListId(null)
                          setNewCardTitle('')
                        }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setNewCardListId(list.id)}
                    className="w-full py-1.5 px-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 flex items-center space-x-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add a card</span>
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Add Another List Column */}
        {showAddList ? (
          <form
            onSubmit={handleAddList}
            className="w-72 shrink-0 bg-slate-100 p-3 rounded-xl border border-slate-200 space-y-2"
          >
            <input
              type="text"
              autoFocus
              placeholder="Enter list title..."
              value={newListTitle}
              onChange={(e) => setNewListTitle(e.target.value)}
              className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white"
            />
            <div className="flex items-center space-x-2">
              <button
                type="submit"
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg"
              >
                Add List
              </button>
              <button
                type="button"
                onClick={() => setShowAddList(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowAddList(true)}
            className="w-72 shrink-0 h-12 rounded-xl border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-100 flex items-center justify-center space-x-1 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add another list</span>
          </button>
        )}
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="space-y-1">
                <input
                  type="text"
                  value={selectedCard.title}
                  onChange={(e) => {
                    const title = e.target.value
                    setSelectedCard({ ...selectedCard, title })
                    onUpdateCard(selectedCard.id, { title })
                  }}
                  className="font-bold text-lg text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-sky-500 focus:outline-none w-full"
                />
                <div className="text-xs text-slate-500">
                  in list{' '}
                  <span className="font-semibold text-slate-700">
                    {activeBoard.lists.find((l) => l.id === selectedCard.listId)?.title}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCard(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Quick Actions Bar */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                {/* Move to list dropdown */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Move List</span>
                  <select
                    value={selectedCard.listId}
                    onChange={(e) => {
                      const targetListId = e.target.value
                      onUpdateCard(selectedCard.id, { targetListId })
                      setSelectedCard({ ...selectedCard, listId: targetListId })
                    }}
                    className="p-1.5 rounded border border-slate-300 bg-white font-medium text-slate-700"
                  >
                    {activeBoard.lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Due Date Picker */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Due Date</span>
                  <input
                    type="date"
                    value={selectedCard.dueDate ? selectedCard.dueDate.slice(0, 10) : ''}
                    onChange={(e) => {
                      const dueDate = e.target.value ? new Date(e.target.value).toISOString() : undefined
                      setSelectedCard({ ...selectedCard, dueDate })
                      onUpdateCard(selectedCard.id, { dueDate })
                    }}
                    className="p-1.5 rounded border border-slate-300 bg-white font-medium"
                  />
                </div>

                {/* Completed Checkbox */}
                <div className="flex items-center space-x-1.5 pt-4">
                  <input
                    type="checkbox"
                    id="card-completed-chk"
                    checked={Boolean(selectedCard.completed)}
                    onChange={(e) => {
                      const completed = e.target.checked
                      setSelectedCard({ ...selectedCard, completed })
                      onUpdateCard(selectedCard.id, { completed })
                    }}
                    className="w-4 h-4 rounded text-sky-600"
                  />
                  <label htmlFor="card-completed-chk" className="font-semibold text-slate-700 cursor-pointer">
                    Mark Completed
                  </label>
                </div>

                {/* Linked Ticket picker */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Link Ticket</span>
                  <select
                    value={selectedCard.ticketId || ''}
                    onChange={(e) => {
                      const ticketId = e.target.value || undefined
                      setSelectedCard({ ...selectedCard, ticketId })
                      onUpdateCard(selectedCard.id, { ticketId })
                    }}
                    className="p-1.5 rounded border border-slate-300 bg-white font-medium"
                  >
                    <option value="">None</option>
                    {tickets.map((tkt) => (
                      <option key={tkt.id} value={tkt.id}>
                        {tkt.id} - {tkt.subject.slice(0, 24)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Delete Card Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Delete this card?')) {
                      onDeleteCard(selectedCard.id)
                      setSelectedCard(null)
                    }
                  }}
                  className="ml-auto text-rose-600 hover:text-rose-700 flex items-center space-x-1 font-semibold p-1.5 rounded hover:bg-rose-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Card</span>
                </button>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="font-bold uppercase tracking-wider text-slate-500 text-[11px]">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={selectedCard.description || ''}
                  placeholder="Add a more detailed description..."
                  onChange={(e) => {
                    const description = e.target.value
                    setSelectedCard({ ...selectedCard, description })
                  }}
                  onBlur={() => onUpdateCard(selectedCard.id, { description: selectedCard.description })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-slate-50/50 focus:bg-white focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {/* Checklists Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-1">
                  <span className="font-bold uppercase tracking-wider text-slate-500 text-[11px] flex items-center space-x-1.5">
                    <CheckSquare className="w-4 h-4 text-sky-600" />
                    <span>Checklists ({selectedCard.checklists.length})</span>
                  </span>
                </div>

                {selectedCard.checklists.map((cl) => {
                  const completed = cl.items.filter((i) => i.completed).length
                  const total = cl.items.length
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

                  return (
                    <div key={cl.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{cl.title}</span>
                        <span className="text-slate-500 font-mono text-[11px]">
                          {completed}/{total} ({pct}%)
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Items */}
                      <div className="space-y-1 pt-1">
                        {(cl.items || []).map((it) => {
                          const isDone = Boolean((it as any).completed || (it as any).done)
                          return (
                            <div
                              key={it.id}
                              onClick={() => handleToggleChecklistItem(cl.id, it.id)}
                              className="flex items-center space-x-2 p-1 rounded hover:bg-slate-100 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isDone}
                                readOnly
                                className="w-4 h-4 text-sky-600 rounded"
                              />
                              <span className={isDone ? 'line-through text-slate-400' : 'text-slate-700'}>
                                {it.text}
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Add item inline */}
                      {activeChecklistId === cl.id ? (
                        <div className="flex items-center space-x-2 pt-1">
                          <input
                            type="text"
                            autoFocus
                            placeholder="Add an item..."
                            value={newChecklistItem}
                            onChange={(e) => setNewChecklistItem(e.target.value)}
                            className="flex-1 p-1.5 border rounded text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddChecklistItem(cl.id)}
                            className="px-3 py-1 bg-sky-600 text-white rounded text-xs font-semibold"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveChecklistId(null)}
                            className="p-1 text-slate-400"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveChecklistId(cl.id)}
                          className="text-xs font-medium text-sky-600 hover:underline pt-1 block"
                        >
                          + Add an item
                        </button>
                      )}
                    </div>
                  )
                })}

                {/* Add new checklist form */}
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="New checklist title..."
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    className="p-2 border rounded-lg text-xs flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklist}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold"
                  >
                    Add Checklist
                  </button>
                </div>
              </div>

              {/* Attachments Section */}
              <div className="space-y-2">
                <span className="font-bold uppercase tracking-wider text-slate-500 text-[11px] flex items-center space-x-1.5">
                  <Paperclip className="w-4 h-4 text-sky-600" />
                  <span>Attachments</span>
                </span>
                <AttachmentUploader onFilesAdded={handleAddAttachmentsToCard} />
                {selectedCard.attachments && selectedCard.attachments.length > 0 && (
                  <AttachmentList
                    attachments={selectedCard.attachments}
                    onDelete={(id) => {
                      const updated = (selectedCard.attachments || []).filter((a) => a.id !== id)
                      setSelectedCard({ ...selectedCard, attachments: updated })
                      onUpdateCard(selectedCard.id, { attachments: updated })
                    }}
                  />
                )}
              </div>

              {/* Comments / Activity Feed */}
              <div className="space-y-3">
                <span className="font-bold uppercase tracking-wider text-slate-500 text-[11px] flex items-center space-x-1.5">
                  <MessageSquare className="w-4 h-4 text-sky-600" />
                  <span>Activity & Discussion</span>
                </span>

                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 p-2 rounded-lg border border-slate-300 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddComment}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold"
                  >
                    Post
                  </button>
                </div>

                <div className="space-y-2 pt-2">
                  {selectedCard.comments.map((cm) => (
                    <div key={cm.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span className="font-semibold text-slate-800">{cm.author}</span>
                        <span>{new Date(cm.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-slate-700 text-xs">{cm.body}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create New Board Modal (shared with the empty-state branch above) */}
      {createBoardModal}
    </div>
  )
}
