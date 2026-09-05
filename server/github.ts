import type { CloudSyncStatus } from '../src/types'
import { getDb, saveDb } from './db'
import fs from 'fs'
import path from 'path'

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
    const decoded =
      data.encoding === 'base64' ? Buffer.from(data.content, 'base64').toString('utf-8') : data.content
    const parsed = JSON.parse(decoded)

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

  syncState.pushing = true
  const db = getDb()
  const contentStr = JSON.stringify(db, null, 2)
  const base64Content = Buffer.from(contentStr, 'utf-8').toString('base64')

  try {
    const url = `${API_BASE}/repos/${GITHUB_REPO}/contents/${GITHUB_DB_PATH}`
    const body: Record<string, unknown> = {
      message: `chore(sync): automated cloud synchronization [${new Date().toISOString()}]`,
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

    return { success: true, message: 'Synchronized with GitHub successfully' }
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
