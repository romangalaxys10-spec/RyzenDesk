/**
 * Live chat support engine.
 * Chat sessions live in the main DB (auto-synced to GitHub) and support
 * a waiting -> active -> ended lifecycle between a client and one staff member.
 */

import type { ChatSession } from './types'
import { getDb, mutate, audit, randomChatId } from './db'
import { escapeHtml, notifyStaff, notifyStaffMember, notifyUser } from './telegram'

const MAX_CHAT_MESSAGES = 400

function publicChat(c: ChatSession): ChatSession {
  return c
}

/* ------------------------------- queries --------------------------------- */

export function getChat(id: string): ChatSession | null {
  return getDb().chats.find((c) => c.id === id) || null
}

export function listChatsForStaff(): ChatSession[] {
  return getDb().chats
}

export function listChatsForUser(zaiId: string): ChatSession[] {
  return getDb().chats.filter((c) => c.zaiId.toLowerCase() === zaiId.toLowerCase())
}

/** The live (waiting/active) chat for a client, if any. */
export function liveChatForUser(zaiId: string): ChatSession | null {
  return (
    getDb().chats.find(
      (c) => c.zaiId.toLowerCase() === zaiId.toLowerCase() && c.status !== 'ended',
    ) || null
  )
}

/* ------------------------------- mutations -------------------------------- */

export function startChat(zaiId: string, userName: string): ChatSession | { error: string } {
  const db = getDb()
  if (!db.settings?.liveChatEnabled) return { error: 'Live chat is currently offline.' }
  const existing = liveChatForUser(zaiId)
  if (existing) return existing

  const now = new Date().toISOString()
  const chat: ChatSession = {
    id: randomChatId(),
    zaiId,
    userName: userName || 'Client',
    status: 'waiting',
    staffUsername: null,
    messages: [
      {
        id: `${now}-sys`,
        from: 'system',
        author: 'System',
        body: 'Chat session started. A support agent will be with you shortly.',
        at: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  }

  mutate((d) => {
    d.chats.unshift(chat)
    if (d.chats.length > 200) d.chats.length = 200
    audit(d, zaiId, 'chat.started', `${chat.id} by ${userName}`)
    return `chat: ${chat.id} started by ${zaiId}`
  })

  void notifyStaff([
    '💬 <b>Live chat request</b>',
    `Client: <b>${escapeHtml(chat.userName)}</b> (<code>${escapeHtml(chat.zaiId)}</code>)`,
    `Chat ID: <code>${chat.id}</code>`,
    '',
    'Open the staff panel → Live Chats to claim it.',
  ].join('\n'))

  return chat
}

export function addChatMessage(
  chatId: string,
  from: 'user' | 'staff',
  author: string,
  body: string,
): ChatSession | null {
  const db = getDb()
  const chat = db.chats.find((c) => c.id === chatId)
  if (!chat || chat.status === 'ended') return null

  const message = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from,
    author,
    body: body.trim().slice(0, 4000),
    at: new Date().toISOString(),
  }

  mutate((d) => {
    const c = d.chats.find((x) => x.id === chatId)
    if (!c) return
    c.messages.push(message)
    if (c.messages.length > MAX_CHAT_MESSAGES) c.messages.splice(0, c.messages.length - MAX_CHAT_MESSAGES)
    c.updatedAt = message.at
    return `chat: ${chatId} message from ${from}`
  })

  // Notifications
  void (async () => {
    if (from === 'user') {
      const text = `💬 <b>Live chat message</b>\nFrom: ${escapeHtml(chat.userName)} (<code>${escapeHtml(chat.zaiId)}</code>)\nChat: <code>${chat.id}</code>${chat.staffUsername ? ` · Agent: <b>${escapeHtml(chat.staffUsername)}</b>` : ''}\n\n${escapeHtml(message.body.slice(0, 600))}`
      if (chat.staffUsername) await notifyStaffMember(chat.staffUsername, text)
      else await notifyStaff(text, author)
    } else {
      const user = getDb().users.find((u) => u.zaiId.toLowerCase() === chat.zaiId.toLowerCase())
      if (user) {
        await notifyUser(
          user,
          `💬 <b>${escapeHtml(author)} (support) wrote in live chat</b>\n\n${escapeHtml(message.body.slice(0, 600))}`,
        )
      }
    }
  })()

  return getChat(chatId)
}

export function claimChat(chatId: string, staffUsername: string): ChatSession | null {
  const db = getDb()
  const chat = db.chats.find((c) => c.id === chatId)
  if (!chat || chat.status === 'ended') return null

  const now = new Date().toISOString()
  mutate((d) => {
    const c = d.chats.find((x) => x.id === chatId)
    if (!c || c.status === 'ended') return
    const firstClaim = c.status === 'waiting' || c.staffUsername !== staffUsername
    c.staffUsername = staffUsername
    c.status = 'active'
    c.updatedAt = now
    if (firstClaim) {
      c.messages.push({
        id: `${now}-sys`,
        from: 'system',
        author: 'System',
        body: `${staffUsername} joined the chat.`,
        at: now,
      })
    }
    audit(d, staffUsername, 'chat.claimed', `${chatId}`)
    return `chat: ${chatId} claimed by ${staffUsername}`
  })

  const user = getDb().users.find((u) => u.zaiId.toLowerCase() === chat.zaiId.toLowerCase())
  if (user) {
    void notifyUser(user, `👋 <b>${escapeHtml(staffUsername)} from support joined your live chat</b>`)
  }
  return getChat(chatId)
}

export function endChat(chatId: string, endedBy: string, byRole: 'user' | 'staff'): ChatSession | null {
  const db = getDb()
  const chat = db.chats.find((c) => c.id === chatId)
  if (!chat || chat.status === 'ended') return null

  const now = new Date().toISOString()
  mutate((d) => {
    const c = d.chats.find((x) => x.id === chatId)
    if (!c || c.status === 'ended') return
    c.status = 'ended'
    c.endedBy = endedBy
    c.updatedAt = now
    c.messages.push({
      id: `${now}-sys`,
      from: 'system',
      author: 'System',
      body: `Chat ended by ${endedBy}. You can always start a new one while support is online.`,
      at: now,
    })
    audit(d, endedBy, 'chat.ended', `${chatId} (${byRole})`)
    return `chat: ${chatId} ended by ${endedBy}`
  })

  if (byRole === 'staff') {
    const user = getDb().users.find((u) => u.zaiId.toLowerCase() === chat.zaiId.toLowerCase())
    if (user) void notifyUser(user, `🔴 <b>Live chat closed</b> by ${escapeHtml(endedBy)}.`)
  }
  return getChat(chatId)
}

/** Public-safe chat for client viewers (strip other clients' data is inherent — chats are 1:1). */
export function chatForUser(chatId: string, zaiId: string): ChatSession | null {
  const chat = getChat(chatId)
  if (!chat || chat.zaiId.toLowerCase() !== zaiId.toLowerCase()) return null
  return publicChat(chat)
}
