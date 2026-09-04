/**
 * Telegram bot engine.
 * - Sends notifications (new tickets, replies, status changes) to linked chats.
 * - Polls getUpdates (long-poll) and handles commands:
 *     /start, /help, /id
 *     /link <secret token>   — link a client account
 *     /staff <password>      — link a staff account
 *     /unlink                — detach chat
 *     /tickets               — list my open tickets (clients)
 */

import type { HelpdeskUser, Ticket } from './types'
import { STATUS_LABELS } from './types'
import { getDb, readBotState, writeBotState, mutate } from './db'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || ''
const API = `https://api.telegram.org/bot${BOT_TOKEN}`

const g = globalThis as unknown as {
  __hdBot?: {
    started: boolean
    offset: number
    botUsername: string | null
    mode: 'polling' | 'webhook' | 'off'
    lastError: string | null
    lastPollAt: string | null
  }
}

function bot(): NonNullable<typeof g.__hdBot> {
  if (!g.__hdBot) {
    g.__hdBot = {
      started: false,
      offset: 0,
      botUsername: null,
      mode: BOT_TOKEN ? 'polling' : 'off',
      lastError: null,
      lastPollAt: null,
    }
  }
  return g.__hdBot
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function api(method: string, body?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  if (!BOT_TOKEN) return null
  try {
    const res = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(35_000),
    })
    const data = (await res.json()) as Record<string, unknown>
    if (!data.ok) {
      bot().lastError = `${method}: ${JSON.stringify(data).slice(0, 200)}`
      return null
    }
    bot().lastError = null
    return data
  } catch (err) {
    bot().lastError = `${method}: ${err instanceof Error ? err.message : String(err)}`
    return null
  }
}

export async function sendMessage(chatId: number, html: string): Promise<boolean> {
  const res = await api('sendMessage', {
    chat_id: chatId,
    text: html,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  })
  return Boolean(res)
}

export async function getBotInfo(): Promise<{ username: string | null; mode: string; linkedStaff: number; linkedUsers: number; lastError: string | null }> {
  const b = bot()
  if (BOT_TOKEN && !b.botUsername) {
    const me = await api('getMe')
    const username = me && (me.result as { username?: string })?.username
    if (username) b.botUsername = username
  }
  const db = getDb()
  return {
    username: b.botUsername,
    mode: b.mode,
    linkedStaff: db.staff.filter((s) => s.telegramChatId).length,
    linkedUsers: db.users.filter((u) => u.telegramChatId).length,
    lastError: b.lastError,
  }
}

/* ----------------------------- notifications ----------------------------- */

export async function notifyStaff(html: string, excludeUsername?: string): Promise<void> {
  const db = getDb()
  const targets = db.staff.filter((s) => s.telegramChatId && !s.suspended && s.username !== excludeUsername)
  await Promise.allSettled(targets.map((s) => sendMessage(s.telegramChatId as number, html)))
}

/** Send a notification to a single staff member (used for escalations / assignments). */
export async function notifyStaffMember(username: string, html: string): Promise<void> {
  const db = getDb()
  const member = db.staff.find((s) => s.username.toLowerCase() === username.toLowerCase())
  if (!member || member.suspended || !member.telegramChatId) return
  await sendMessage(member.telegramChatId, html)
}

export async function notifyUser(user: HelpdeskUser, html: string): Promise<void> {
  if (!user.telegramChatId) return
  await sendMessage(user.telegramChatId, html)
}

export function ticketCard(t: Ticket): string {
  const lines = [
    `🎫 <b>${escapeHtml(t.id)}</b> — ${escapeHtml(t.subject)}`,
    `Type: <b>${escapeHtml(t.type)}</b> | Priority: <b>${escapeHtml(t.priority)}</b>`,
    `Status: <b>${escapeHtml(STATUS_LABELS[t.status])}</b>`,
    `From: ${escapeHtml(t.contact.fullName)} (<code>${escapeHtml(t.zaiId)}</code>)`,
  ]
  return lines.join('\n')
}

/* ------------------------------- commands -------------------------------- */

function findTicketText(t: Ticket): string {
  return `• <b>${escapeHtml(t.id)}</b> — ${escapeHtml(t.subject)} (${escapeHtml(STATUS_LABELS[t.status])})`
}

async function handleCommand(chatId: number, text: string): Promise<void> {
  const trimmed = text.trim()
  const [rawCmd, ...args] = trimmed.split(/\s+/)
  const cmd = rawCmd.toLowerCase().replace(/@.*$/, '')
  const db = getDb()

  if (cmd === '/start' || cmd === '/help') {
    await sendMessage(
      chatId,
      [
        '🤖 <b>RyzenDesk Support Bot</b>',
        '',
        'I deliver ticket notifications for your RyzenDesk helpdesk.',
        '',
        '<b>Commands</b>',
        '• <code>/link &lt;secret token&gt;</code> — link your client account (use the zt_... token from your ticket confirmation)',
        '• <code>/staff &lt;password&gt;</code> — link a staff account (use your staff password)',
        '• <code>/tickets</code> — list your open tickets',
        '• <code>/unlink</code> — detach this chat',
        '• <code>/id</code> — show this chat ID',
      ].join('\n'),
    )
    return
  }

  if (cmd === '/id') {
    await sendMessage(chatId, `Chat ID: <code>${chatId}</code>`)
    return
  }

  if (cmd === '/unlink') {
    let found = false
    mutate((d) => {
      const su = d.staff.find((s) => s.telegramChatId === chatId)
      if (su) {
        su.telegramChatId = null
        found = true
        return `telegram: staff ${su.username} unlinked`
      }
      const uu = d.users.find((u) => u.telegramChatId === chatId)
      if (uu) {
        uu.telegramChatId = null
        found = true
        return `telegram: user ${uu.zaiId} unlinked`
      }
    })
    await sendMessage(chatId, found ? '✅ Chat unlinked.' : 'This chat was not linked.')
    return
  }

  if (cmd === '/link') {
    const token = args[0] || ''
    const user = db.users.find((u) => u.token === token)
    if (!user) {
      await sendMessage(chatId, '❌ Unknown token. Use the <code>zt_...</code> secret token from your ticket confirmation.')
      return
    }
    mutate((d) => {
      const u = d.users.find((x) => x.token === token)
      if (u) {
        u.telegramChatId = chatId
        return `telegram: user ${u.zaiId} linked`
      }
    })
    await sendMessage(chatId, `✅ Linked! You will now receive updates for tickets of <b>${escapeHtml(user.fullName)}</b>.`)
    return
  }

  if (cmd === '/staff') {
    const crypto = await import('crypto')
    const secret = process.env.SESSION_SECRET || 'ryzendesk'
    const hash = crypto.createHash('sha256').update(`${secret}:${args[0] || ''}`).digest('hex')
    const member = db.staff.find((s) => s.passwordHash === hash)
    if (!member) {
      await sendMessage(chatId, '❌ Invalid staff password.')
      return
    }
    mutate((d) => {
      const s = d.staff.find((x) => x.username === member.username)
      if (s) {
        s.telegramChatId = chatId
        return `telegram: staff ${s.username} linked`
      }
    })
    await sendMessage(chatId, `✅ Staff linked: <b>${escapeHtml(member.displayName)}</b>. You will receive new-ticket alerts here.`)
    return
  }

  if (cmd === '/tickets') {
    const user = db.users.find((u) => u.telegramChatId === chatId)
    if (!user) {
      await sendMessage(chatId, 'Link your account first with <code>/link &lt;token&gt;</code>.')
      return
    }
    const mine = db.tickets.filter((t) => t.zaiId === user.zaiId && !['closed', 'resolved'].includes(t.status))
    if (!mine.length) {
      await sendMessage(chatId, 'You have no open tickets. 🎉')
      return
    }
    await sendMessage(chatId, ['📋 <b>Your open tickets</b>', '', ...mine.map(findTicketText)].join('\n'))
    return
  }

  await sendMessage(chatId, 'Unknown command. Send /help to see what I can do.')
}

/* -------------------------------- updates -------------------------------- */

async function processUpdate(update: Record<string, unknown>): Promise<void> {
  const msg = update.message as { chat?: { id?: number }; text?: string } | undefined
  const chatId = msg?.chat?.id
  const text = msg?.text
  if (!chatId || !text) return
  try {
    await handleCommand(chatId, text)
  } catch (err) {
    console.error('[telegram] command error:', err instanceof Error ? err.message : err)
  }
}

async function pollOnce(): Promise<boolean> {
  const b = bot()
  const res = await api('getUpdates', {
    offset: b.offset,
    timeout: 25,
    allowed_updates: ['message'],
  })
  if (!res) return false
  const updates = (res.result as Array<Record<string, unknown>>) || []
  for (const u of updates) {
    b.offset = (Number(u.update_id) || 0) + 1
    await processUpdate(u)
  }
  if (updates.length) writeBotState({ offset: b.offset })
  b.lastPollAt = new Date().toISOString()
  return true
}

export async function startPoller(): Promise<void> {
  const b = bot()
  if (b.started || !BOT_TOKEN) return
  b.started = true

  // Prefer polling: drop any webhook so getUpdates works.
  await api('deleteWebhook', { drop_pending_updates: false })
  const me = await api('getMe')
  const username = me && (me.result as { username?: string })?.username
  if (username) b.botUsername = username

  const state = readBotState()
  b.offset = state.offset || 0

  const loop = async () => {
    while (bot().started) {
      let ok = false
      try {
        ok = await pollOnce()
      } catch (err) {
        bot().lastError = err instanceof Error ? err.message : String(err)
      }
      if (!ok) await new Promise((r) => setTimeout(r, 8000))
    }
  }
  void loop()
  console.log('[telegram] poller started for bot', username || '(unknown)')
}

export function stopPoller(): void {
  const b = bot()
  b.started = false
}

/** Accept a Telegram webhook update (alternative to polling). */
export async function handleWebhookUpdate(update: Record<string, unknown>): Promise<void> {
  bot().mode = 'webhook'
  await processUpdate(update)
}
