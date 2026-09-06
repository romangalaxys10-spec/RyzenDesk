import React, { useEffect, useState } from 'react'
import { Megaphone, Activity, Download, GitBranch, Plus, Trash2, Save, Bot, MailPlus, MessagesSquare } from 'lucide-react'

/* --------------------------------------------------------------------------
   Admin ▸ Content & Automation
   Manages: automation rules, announcements, network status, downloads,
   system toggles (live chat, AI triage, inbound-email secret).
   All endpoints require the admin_content RBAC permission.
   -------------------------------------------------------------------------- */

interface Rule { id: string; name: string; enabled: boolean; match: 'all' | 'any'; runCount: number; conditions: Array<{ field: string; op: string; value: string }>; actions: Array<{ type: string; value: string }> }
interface Announcement { id: string; title: string; body: string; published: boolean; author: string; createdAt: string }
interface StatusComponent { id: string; name: string; status: string; description?: string; updatedAt: string }
interface DownloadItem { id: string; title: string; description: string; url: string; published: boolean; createdAt: string }

const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40'
const input = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
const card = 'bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-3'

export const ContentAutomationAdmin: React.FC = () => {
  const [rules, setRules] = useState<Rule[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [statusComponents, setStatusComponents] = useState<StatusComponent[]>([])
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [settings, setSettings] = useState<{ liveChatEnabled?: boolean; aiTriageEnabled?: boolean; emailInboundConfigured?: boolean }>({})
  const [inboundSecret, setInboundSecret] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [rulesDirty, setRulesDirty] = useState(false)

  // New-item form state
  const [newAnn, setNewAnn] = useState({ title: '', body: '' })
  const [newStatus, setNewStatus] = useState({ name: '', status: 'operational', description: '' })
  const [newDl, setNewDl] = useState({ title: '', description: '', url: '' })

  const load = async () => {
    try {
      const [r, a, s, d, st] = await Promise.all([
        fetch('/api/admin/rules').then((x) => x.json()).catch(() => []),
        fetch('/api/admin/announcements').then((x) => x.json()).catch(() => []),
        fetch('/api/admin/status-components').then((x) => x.json()).catch(() => []),
        fetch('/api/admin/downloads').then((x) => x.json()).catch(() => []),
        fetch('/api/admin/settings').then((x) => x.json()).catch(() => ({})),
      ])
      setRules(Array.isArray(r) ? r : [])
      setAnnouncements(Array.isArray(a) ? a : [])
      setStatusComponents(Array.isArray(s) ? s : [])
      setDownloads(Array.isArray(d) ? d : [])
      setSettings(st)
    } catch { /* section renders empty on 403 */ }
  }

  useEffect(() => { void load() }, [])

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 3000) }

  // Central fetch helper: never throws, always returns { ok, data }
  const api = async (path: string, method: string, body?: any): Promise<{ ok: boolean; data: any }> => {
    try {
      const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body !== undefined ? JSON.stringify(body) : undefined })
      let data: any = null
      try { data = await res.json() } catch { data = null }
      return { ok: res.ok, data }
    } catch (e: any) {
      return { ok: false, data: { error: e?.message || 'Network error' } }
    }
  }

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
    setRulesDirty(true)
  }
  const addRuleCondition = () => {
    setRules((prev) => [...prev, { id: `rule_new_${Date.now()}`, name: 'New rule', enabled: true, match: 'any', runCount: 0, conditions: [{ field: 'subject', op: 'contains', value: '' }], actions: [{ type: 'add_tag', value: '' }] } as any])
    setRulesDirty(true)
  }
  const patchRule = (id: string, patch: Partial<Rule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    setRulesDirty(true)
  }
  const saveRules = async () => {
    const { ok, data } = await api('/api/admin/rules', 'PUT', rules)
    if (ok) { setRulesDirty(false); flash('Rules saved') } else flash(data?.error || 'Save failed')
  }
  const deleteRule = async (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
    setRulesDirty(true)
  }

  const createItem = async (path: string, body: any, reset: () => void) => {
    const { ok, data } = await api(`/api/admin/${path}`, 'POST', body)
    if (ok) { reset(); flash('Created'); void load() } else flash(data?.error || 'Create failed')
  }
  const deleteItem = async (path: string, id: string) => {
    const { ok } = await api(`/api/admin/${path}/${encodeURIComponent(id)}`, 'DELETE')
    if (ok) { flash('Deleted'); void load() }
  }
  const patchItem = async (path: string, id: string, patch: any) => {
    await api(`/api/admin/${path}/${encodeURIComponent(id)}`, 'PUT', patch)
    void load()
  }
  const saveSettings = async (patch: any) => {
    const { ok, data } = await api('/api/admin/settings', 'PUT', patch)
    if (ok) { flash('Settings saved'); void load() } else flash(data?.error || 'Save failed')
  }

  return (
    <div className="space-y-4">
      {msg && <div className="p-2 rounded-lg bg-emerald-900/40 border border-emerald-700 text-emerald-300 text-xs">{msg}</div>}

      {/* System toggles */}
      <div className={card}>
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Bot className="w-4 h-4 text-indigo-400" /> Automation & Channels</h3>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <label className="flex items-center gap-2 p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
            <input type="checkbox" checked={Boolean(settings.liveChatEnabled)} onChange={(e) => saveSettings({ liveChatEnabled: e.target.checked })} className="accent-indigo-500" />
            <span className="text-slate-300 flex items-center gap-1"><MessagesSquare className="w-3.5 h-3.5" /> Live Chat</span>
          </label>
          <label className="flex items-center gap-2 p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
            <input type="checkbox" checked={Boolean(settings.aiTriageEnabled)} onChange={(e) => saveSettings({ aiTriageEnabled: e.target.checked })} className="accent-indigo-500" />
            <span className="text-slate-300 flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> AI Triage (needs GEMINI_API_KEY)</span>
          </label>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
            <span className="text-slate-300 flex items-center gap-1"><MailPlus className="w-3.5 h-3.5" /> Email Piping Secret</span>
            <div className="flex gap-1.5">
              <input value={inboundSecret} onChange={(e) => setInboundSecret(e.target.value)} placeholder={settings.emailInboundConfigured ? '•••••••• (configured)' : 'set a long random secret'} className={input} />
              <button onClick={() => saveSettings({ emailInboundSecret: inboundSecret })} disabled={!inboundSecret.trim()} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white`}><Save className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Automation rules */}
      <div className={card}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><GitBranch className="w-4 h-4 text-emerald-400" /> Automation Rules</h3>
          <div className="flex gap-2">
            <button onClick={addRuleCondition} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200`}><Plus className="w-3.5 h-3.5" /> Add Rule</button>
            <button onClick={saveRules} disabled={!rulesDirty} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}><Save className="w-3.5 h-3.5" /> Save Rules</button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">First-match-wins per rule; every enabled rule is evaluated on new tickets. Actions: set_priority, set_team, set_type, add_tag, assign.</p>
        {rules.length === 0 && <p className="text-xs text-slate-500">No rules yet — add one to auto-triage incoming tickets.</p>}
        {rules.map((r) => (
          <div key={r.id} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={r.enabled} onChange={() => toggleRule(r.id)} className="accent-emerald-500" />
              <input value={r.name} onChange={(e) => patchRule(r.id, { name: e.target.value })} className="flex-1 bg-transparent text-slate-200 text-xs font-semibold border-b border-slate-800 focus:outline-none focus:border-indigo-500" />
              <span className="text-[10px] text-slate-500">ran {r.runCount || 0}×</span>
              <button onClick={() => deleteRule(r.id)} className="text-rose-400 hover:text-rose-300" aria-label="Delete rule"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            {(r.conditions || []).map((c, i) => (
              <div key={i} className="flex flex-wrap gap-1.5 text-xs">
                <select value={c.field} onChange={(e) => patchRule(r.id, { conditions: r.conditions.map((x, j) => j === i ? { ...x, field: e.target.value } : x) } as any)} className={`${input} w-28`}>
                  {['subject', 'body', 'email', 'type', 'priority'].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={c.op} onChange={(e) => patchRule(r.id, { conditions: r.conditions.map((x, j) => j === i ? { ...x, op: e.target.value } : x) } as any)} className={`${input} w-32`}>
                  {['contains', 'equals', 'starts_with'].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <input value={c.value} onChange={(e) => patchRule(r.id, { conditions: r.conditions.map((x, j) => j === i ? { ...x, value: e.target.value } : x) } as any)} placeholder="value" className={`${input} flex-1 min-w-32`} />
              </div>
            ))}
            <div className="flex flex-wrap gap-1.5 text-xs items-center">
              <span className="text-slate-500">→ then</span>
              <select value={r.actions?.[0]?.type || 'add_tag'} onChange={(e) => patchRule(r.id, { actions: [{ type: e.target.value, value: r.actions?.[0]?.value || '' }] } as any)} className={`${input} w-36`}>
                {['set_priority', 'set_team', 'set_type', 'add_tag', 'assign'].map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <input value={r.actions?.[0]?.value || ''} onChange={(e) => patchRule(r.id, { actions: [{ type: r.actions?.[0]?.type || 'add_tag', value: e.target.value }] } as any)} placeholder="action value" className={`${input} flex-1 min-w-32`} />
            </div>
          </div>
        ))}
      </div>

      {/* Announcements */}
      <div className={card}>
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Megaphone className="w-4 h-4 text-amber-400" /> Announcements</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={newAnn.title} onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })} placeholder="Title" className={input} />
          <input value={newAnn.body} onChange={(e) => setNewAnn({ ...newAnn, body: e.target.value })} placeholder="Body" className={input} />
          <button onClick={() => createItem('announcements', { ...newAnn, published: true }, () => setNewAnn({ title: '', body: '' }))} disabled={!newAnn.title || !newAnn.body} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white shrink-0`}><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
        {announcements.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-slate-950 border border-slate-800">
            <input type="checkbox" checked={a.published} onChange={(e) => patchItem('announcements', a.id, { published: e.target.checked })} className="accent-emerald-500" />
            <span className={`flex-1 truncate ${a.published ? 'text-slate-300' : 'text-slate-500 line-through'}`}>{a.title}</span>
            <button onClick={() => deleteItem('announcements', a.id)} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      {/* Network status */}
      <div className={card}>
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-400" /> Network Status Components</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={newStatus.name} onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })} placeholder="Component name" className={input} />
          <select value={newStatus.status} onChange={(e) => setNewStatus({ ...newStatus, status: e.target.value })} className={`${input} w-40`}>
            {['operational', 'degraded', 'outage', 'maintenance'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => createItem('status-components', newStatus, () => setNewStatus({ name: '', status: 'operational', description: '' }))} disabled={!newStatus.name} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white shrink-0`}><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
        {statusComponents.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-slate-950 border border-slate-800">
            <span className="flex-1 text-slate-300 truncate">{c.name}</span>
            <select value={c.status} onChange={(e) => patchItem('status-components', c.id, { status: e.target.value })} className={`${input} w-36`}>
              {['operational', 'degraded', 'outage', 'maintenance'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => deleteItem('status-components', c.id)} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>

      {/* Downloads */}
      <div className={card}>
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Download className="w-4 h-4 text-sky-400" /> Downloads</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <input value={newDl.title} onChange={(e) => setNewDl({ ...newDl, title: e.target.value })} placeholder="Title" className={input} />
          <input value={newDl.url} onChange={(e) => setNewDl({ ...newDl, url: e.target.value })} placeholder="https:// file URL" className={input} />
          <button onClick={() => createItem('downloads', newDl, () => setNewDl({ title: '', description: '', url: '' }))} disabled={!newDl.title || !newDl.url} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white shrink-0`}><Plus className="w-3.5 h-3.5" /> Add</button>
        </div>
        {downloads.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-slate-950 border border-slate-800">
            <input type="checkbox" checked={d.published} onChange={(e) => patchItem('downloads', d.id, { published: e.target.checked })} className="accent-emerald-500" />
            <span className={`flex-1 truncate ${d.published ? 'text-slate-300' : 'text-slate-500 line-through'}`}>{d.title}</span>
            <button onClick={() => deleteItem('downloads', d.id)} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        ))}
      </div>
    </div>
  )
}