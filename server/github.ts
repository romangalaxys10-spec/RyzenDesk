import crypto from 'crypto'
import type { CloudSyncStatus } from '../src/types'
import { getDb, saveDb } from './db'
import fs from 'fs'
import path from 'path'

/* ==========================================================================
   Git-backed Cloud Sync — AES-256-GCM encrypted at rest in the repository.

   The JSON database (tickets, CRM users, staff password hashes, webhook
   secrets, SMTP credentials, audit trails) is sensitive. It is NEVER pushed
   in cleartext: every push is wrapped in an authenticated encryption envelope
   keyed by scrypt(SESSION_SECRET | ENCRYPTION_KEY).

   Pull transparently decrypts new envelopes and still accepts legacy
   cleartext snapshots (they are re-encrypted on the next push).
   ========================================================================== */

function resolveGithubToken(): string {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim()
  try {
    const tokenFile = path.resolve(process.cwd(), '.github_token')
    if (fs.existsSync(tokenFile)) {
      return fs.readFileSync(tokenFile, 'utf-8').trim()
    }
  } catch {}
  return ''
}

const GITHUB_TOKEN = resolveGithubToken()
const GITHUB_REPO = process.env.GITHUB_REPO || 'romangalaxys10-spec/RyzenDesk'
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'
const GITHUB_DB_PATH = process.env.GITHUB_DB_PATH || 'data/helpdesk-db.json'
const API_BASE = 'https://api.github.com'

const ENVELOPE_FORMAT = 'ryzendesk-encrypted-db'
const ENVELOPE_VERSION = 1

function deriveKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET || 'dev-fallback'
  // Fixed, versioned salt: the secret itself is the confidential component.
  return crypto.scryptSync(secret, 'ryzendesk-cloud-sync-v1', 32)
}

function isKnownDefaultSecret(): boolean {
  const secret = process.env.ENCRYPTION_KEY || process.env.SESSION_SECRET
  return !secret || secret === 'dev-fallback' || secret === 'change-me'
}

function encryptDbPayload(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    format: ENVELOPE_FORMAT,
    version: ENVELOPE_VERSION,
    alg: 'aes-256-gcm',
    kdf: 'scrypt(SESSION_SECRET|ENCRYPTION_KEY)',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    payload: encrypted.toString('base64'),
  })
}

function decryptDbPayload(raw: string): { ok: true; plaintext: string; wasEncrypted: boolean } | { ok: false; error: string } {
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Remote snapshot is not valid JSON' }
  }
  if (parsed && parsed.format === ENVELOPE_FORMAT) {
    try {
      const iv = Buffer.from(parsed.iv, 'base64')
      const tag = Buffer.from(parsed.tag, 'base64')
      const payload = Buffer.from(parsed.payload, 'base64')
      const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), iv)
      decipher.setAuthTag(tag)
      const decrypted = Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf-8')
      return { ok: true, plaintext: decrypted, wasEncrypted: true }
    } catch {
      return {
        ok: false,
        error:
          'Unable to decrypt remote snapshot (ENCRYPTION_KEY/SESSION_SECRET mismatch with the key used at push time)',
      }
    }
  }
  // Legacy cleartext snapshot — accepted for backward compatibility.
  return { ok: true, plaintext: raw, wasEncrypted: false }
}

let syncState: CloudSyncStatus = {
  configured: Boolean(GITHUB_TOKEN && GITHUB_REPO),
  repo: GITHUB_REPO,
  branch: GITHUB_BRANCH,
  path: GITHUB_DB_PATH,
  sha: null,
  pendingChanges: false,
  pushing: false,
  isOnline: true,
  lastSyncAt: new Date().toISOString(),
  lastError: null,
  encrypted: true,
}

let pushTimeout: ReturnType<typeof setTimeout> | null = null

function headers() {
  return {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'RyzenDesk-Cloud-Sync',
  }
}

export function getSyncStatus(): CloudSyncStatus {
  return { ...syncState }
}

export async function pullRemote(): Promise<boolean> {
  if (!syncState.configured) return false

  try {
    const url = `${API_BASE}/repos/${GITHUB_REPO}/contents/${GITHUB_DB_PATH}?ref=${encodeURIComponent(GITHUB_BRANCH)}`
    const res = await fetch(url, { headers: headers(), cache: 'no-store' })

    if (res.status === 404) {
      console.log(`Remote DB file ${GITHUB_DB_PATH} not found on ${GITHUB_REPO}; will initialize on next push.`)
      return false
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.warn(`GitHub pull response ${res.status}: ${errText.slice(0, 150)}`)
      syncState.lastError = `Pull failed: ${res.status}`
      return false
    }

    const data = (await res.json()) as { sha: string; content: string; encoding: string }
    const encoded =
      data.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf-8') : data.content

    const decrypted = decryptDbPayload(encoded)
    if (decrypted.ok === false) {
      syncState.lastError = decrypted.error
      console.error(`[cloud-sync] ${decrypted.error}`)
      return false
    }

    const parsed = JSON.parse(decrypted.plaintext)
    if (!decrypted.wasEncrypted) {
      console.log('[cloud-sync] Remote snapshot was legacy cleartext — it will be re-encrypted on the next push.')
    }

    syncState.sha = data.sha
    syncState.lastSyncAt = new Date().toISOString()
    syncState.lastError = null

    // Merge or update local db
    saveDb(parsed)
    return true
  } catch (err) {
    syncState.lastError = err instanceof Error ? err.message : String(err)
    return false
  }
}

export async function pushRemoteNow(): Promise<{ success: boolean; message: string }> {
  if (!syncState.configured) {
    return { success: false, message: 'GitHub credentials or repo not configured' }
  }

  if (process.env.NODE_ENV === 'production' && isKnownDefaultSecret()) {
    const msg =
      'Refusing to push: SESSION_SECRET/ENCRYPTION_KEY is not configured. Set a strong secret so the database snapshot is encrypted before it leaves this server.'
    syncState.lastError = msg
    console.error(`[cloud-sync] ${msg}`)
    return { success: false, message: msg }
  }

  syncState.pushing = true
  const db = getDb()
  const contentStr = JSON.stringify(db, null, 2)
  const encryptedEnvelope = encryptDbPayload(contentStr)
  const base64Content = Buffer.from(encryptedEnvelope, 'utf-8').toString('base64')

  try {
    const url = `${API_BASE}/repos/${GITHUB_REPO}/contents/${GITHUB_DB_PATH}`
    const body: Record<string, unknown> = {
      message: `chore(sync): encrypted database snapshot [${new Date().toISOString()}]`,
      content: base64Content,
      branch: GITHUB_BRANCH,
    }

    if (syncState.sha) {
      body.sha = syncState.sha
    }

    const res = await fetch(url, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      // Check if conflict 409
      if (res.status === 409) {
        await pullRemote()
      }
      syncState.pushing = false
      syncState.lastError = `GitHub push failed: ${res.status} ${errText.slice(0, 100)}`
      return { success: false, message: syncState.lastError }
    }

    const data = (await res.json()) as { content?: { sha: string } }
    if (data.content?.sha) {
      syncState.sha = data.content.sha
    }

    syncState.pushing = false
    syncState.pendingChanges = false
    syncState.lastSyncAt = new Date().toISOString()
    syncState.lastError = null

    return { success: true, message: 'Encrypted database synchronized with GitHub successfully' }
  } catch (err) {
    syncState.pushing = false
    syncState.lastError = err instanceof Error ? err.message : String(err)
    return { success: false, message: syncState.lastError }
  }
}

export function scheduleCloudPush(): void {
  syncState.pendingChanges = true
  if (pushTimeout) clearTimeout(pushTimeout)
  pushTimeout = setTimeout(() => {
    void pushRemoteNow()
  }, 3000)
}
