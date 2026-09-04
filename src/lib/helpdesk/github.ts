/**
 * GitHub auto-sync engine.
 * Keeps data/helpdesk-db.json in sync with a private GitHub repo.
 * - Pulls remote state on boot (remote wins if newer).
 * - Debounced push after every local mutation.
 * - Automatic SHA conflict recovery + retry with backoff.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''
const GITHUB_REPO = process.env.GITHUB_REPO || ''
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main'
const GITHUB_DB_PATH = process.env.GITHUB_DB_PATH || 'data/helpdesk-db.json'

const API_BASE = 'https://api.github.com'

export interface SyncStatus {
  configured: boolean
  repo: string
  path: string
  sha: string | null
  pendingChanges: boolean
  pushing: boolean
  lastError: string | null
  lastPushAt: string | null
  lastPullAt: string | null
  lastPushCommit: string | null
}

interface SyncEngine {
  sha: string | null
  dirty: boolean
  pushing: boolean
  lastError: string | null
  lastPushAt: string | null
  lastPullAt: string | null
  lastPushCommit: string | null
  timer: ReturnType<typeof setTimeout> | null
  retryTimer: ReturnType<typeof setTimeout> | null
}

const g = globalThis as unknown as { __hdSync?: SyncEngine }

function engine(): SyncEngine {
  if (!g.__hdSync) {
    g.__hdSync = {
      sha: null,
      dirty: false,
      pushing: false,
      lastError: null,
      lastPushAt: null,
      lastPullAt: null,
      lastPushCommit: null,
      timer: null,
      retryTimer: null,
    }
  }
  return g.__hdSync
}

function headers() {
  return {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
    'User-Agent': 'ryzendesk-sync',
  }
}

export function isConfigured(): boolean {
  return Boolean(GITHUB_TOKEN && GITHUB_REPO)
}

function fileUrl(): string {
  return `${API_BASE}/repos/${GITHUB_REPO}/contents/${GITHUB_DB_PATH}?ref=${encodeURIComponent(GITHUB_BRANCH)}`
}

/** Fetch the remote db file. Returns { json, sha } or null when the file does not exist. */
export async function pullRemote(): Promise<{ json: unknown; sha: string } | null> {
  if (!isConfigured()) return null
  const res = await fetch(fileUrl(), { headers: headers(), cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`GitHub pull failed: ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300))
  }
  const data = (await res.json()) as { sha: string; content: string; encoding: string }
  const decoded = data.encoding === 'base64'
    ? Buffer.from(data.content, 'base64').toString('utf-8')
    : data.content
  const e = engine()
  e.sha = data.sha
  e.lastPullAt = new Date().toISOString()
  return { json: JSON.parse(decoded), sha: data.sha }
}

/** Push full db JSON to the repo (create or update). */
async function pushContent(json: string, commitMessage: string): Promise<void> {
  const e = engine()
  const body: Record<string, unknown> = {
    message: commitMessage,
    content: Buffer.from(json, 'utf-8').toString('base64'),
    branch: GITHUB_BRANCH,
  }
  if (e.sha) body.sha = e.sha

  const res = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/contents/${GITHUB_DB_PATH}`, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (res.status === 409 || res.status === 422) {
    // Stale SHA: refresh and retry once.
    const remote = await pullRemote()
    if (remote) {
      e.sha = remote.sha
      body.sha = e.sha
      const retry = await fetch(`${API_BASE}/repos/${GITHUB_REPO}/contents/${GITHUB_DB_PATH}`, {
        method: 'PUT',
        headers: headers(),
        body: JSON.stringify(body),
        cache: 'no-store',
      })
      if (!retry.ok) throw new Error(`GitHub push retry failed: ${retry.status}`)
      const ok = (await retry.json()) as { content: { sha: string } }
      e.sha = ok.content?.sha || e.sha
      return
    }
  }

  if (!res.ok) {
    throw new Error(`GitHub push failed: ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300))
  }
  const data = (await res.json()) as { content: { sha: string } }
  e.sha = data.content?.sha || e.sha
}

async function flush(): Promise<void> {
  const e = engine()
  if (!e.dirty || e.pushing || !isConfigured()) return
  e.pushing = true
  try {
    const snapshot = takeSnapshot()
    if (snapshot) {
      await pushContent(snapshot.json, snapshot.message)
      e.dirty = false
      e.lastError = null
      e.lastPushAt = new Date().toISOString()
      e.lastPushCommit = snapshot.message
    }
  } catch (err) {
    e.lastError = err instanceof Error ? err.message : String(err)
    scheduleRetry(15_000)
  } finally {
    e.pushing = false
  }
}

function scheduleRetry(ms: number) {
  const e = engine()
  if (e.retryTimer) clearTimeout(e.retryTimer)
  e.retryTimer = setTimeout(() => void flush(), ms)
}

// Snapshot provider is registered by the db layer to avoid circular imports.
type SnapshotFn = () => { json: string; message: string } | null
const gg = globalThis as unknown as { __hdSnapshot?: SnapshotFn }

export function registerSnapshotProvider(fn: SnapshotFn) {
  gg.__hdSnapshot = fn
}

function takeSnapshot(): { json: string; message: string } | null {
  return gg.__hdSnapshot ? gg.__hdSnapshot() : null
}

/** Request a (debounced) push. Call after every local mutation. */
export function schedulePush() {
  const e = engine()
  if (!isConfigured()) return
  e.dirty = true
  if (e.timer) clearTimeout(e.timer)
  e.timer = setTimeout(() => void flush(), 2000)
}

export function status(): SyncStatus {
  const e = engine()
  return {
    configured: isConfigured(),
    repo: GITHUB_REPO,
    path: GITHUB_DB_PATH,
    sha: e.sha,
    pendingChanges: e.dirty,
    pushing: e.pushing,
    lastError: e.lastError,
    lastPushAt: e.lastPushAt,
    lastPullAt: e.lastPullAt,
    lastPushCommit: e.lastPushCommit,
  }
}

/** Force an immediate push (used by bootstrap and critical ops). */
export async function pushNow(): Promise<void> {
  const e = engine()
  e.dirty = true
  if (e.timer) clearTimeout(e.timer)
  await flush()
}

/** Push the README the first time so the repo is self-describing. */
export async function ensureRepoReadme(): Promise<void> {
  if (!isConfigured()) return
  const readme = `# ryzendesk-db

Persistent data store for a **RyzenDesk** helpdesk instance.

- \`helpdesk-db.json\` — full database (users, tickets, messages, staff, audit log)
- Auto-synced: every ticket creation, reply and status update is committed here automatically
- This repository is the source of truth; the helpdesk app pulls from it on boot

Do not edit manually while the helpdesk is running.
`
  const url = `${API_BASE}/repos/${GITHUB_REPO}/contents/README.md`
  const check = await fetch(`${url}?ref=${encodeURIComponent(GITHUB_BRANCH)}`, {
    headers: headers(),
    cache: 'no-store',
  })
  if (check.ok) return
  await fetch(url, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({
      message: 'docs: helpdesk data store readme',
      content: Buffer.from(readme, 'utf-8').toString('base64'),
      branch: GITHUB_BRANCH,
    }),
    cache: 'no-store',
  })
}
