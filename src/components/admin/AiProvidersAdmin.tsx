import React, { useEffect, useState } from 'react'
import { Cpu, Zap, Plus, Trash2, Check, Radar, Play } from 'lucide-react'

/* --------------------------------------------------------------------------
   Admin ▸ AI Providers
   NVIDIA NIM first-class (auto model scan picks the fastest free model) plus
   any custom OpenAI-compatible provider. Super-admin managed; keys are
   AES-256-GCM sealed at rest and never returned by the API.
   -------------------------------------------------------------------------- */

interface AiProviderPublic {
  id: string
  name: string
  kind: 'nvidia_nim' | 'custom'
  baseUrl: string
  model: string
  enabled: boolean
  hasKey: boolean
  lastScanAt?: string
  lastScanResults?: Array<{ model: string; ms: number | null; ok: boolean }>
}

const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40'
const input = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
const card = 'bg-slate-900/60 rounded-xl border border-slate-800 p-4 space-y-3'

export const AiProvidersAdmin: React.FC = () => {
  const [providers, setProviders] = useState<AiProviderPublic[]>([])
  const [activeId, setActiveId] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [scanning, setScanning] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)

  // Add forms
  const [nimKey, setNimKey] = useState('')
  const [custom, setCustom] = useState({ name: '', baseUrl: '', apiKey: '', model: '' })

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 4000) }

  const load = async () => {
    try {
      const res = await fetch('/api/admin/ai-providers')
      if (res.ok) {
        const data = await res.json()
        setProviders(Array.isArray(data.providers) ? data.providers : [])
        setActiveId(data.activeAiProviderId || '')
      }
    } catch { /* renders empty on 403 */ }
  }
  useEffect(() => { void load() }, [])

  const api = async (path: string, method: string, body?: any) => {
    try {
      const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: body !== undefined ? JSON.stringify(body) : undefined })
      let data: any = null
      try { data = await res.json() } catch { data = null }
      return { ok: res.ok, data }
    } catch (e: any) {
      return { ok: false, data: { error: e?.message || 'Network error' } }
    }
  }

  const addNim = async () => {
    setBusy('nim')
    const { ok, data } = await api('/api/admin/ai-providers', 'POST', { name: 'NVIDIA NIM', kind: 'nvidia_nim', apiKey: nimKey })
    setBusy(null)
    if (ok) { setNimKey(''); flash('NVIDIA NIM provider added — run a scan to pick the fastest model'); void load() }
    else flash(data?.error || 'Add failed')
  }

  const addCustom = async () => {
    setBusy('custom')
    const { ok, data } = await api('/api/admin/ai-providers', 'POST', { name: custom.name, kind: 'custom', baseUrl: custom.baseUrl, apiKey: custom.apiKey, model: custom.model })
    setBusy(null)
    if (ok) { setCustom({ name: '', baseUrl: '', apiKey: '', model: '' }); flash('Custom provider added'); void load() }
    else flash(data?.error || 'Add failed')
  }

  const scan = async (id: string) => {
    setScanning(id)
    const { ok, data } = await api(`/api/admin/ai-providers/${id}/scan`, 'POST')
    setScanning(null)
    if (ok) {
      flash(`Scan done: ${data.working}/${data.scanned} models responded. Fastest: ${data.selected || 'none'} — auto-selected.`)
      void load()
    } else flash(data?.error || 'Scan failed')
  }

  const test = async (id: string) => {
    setTesting(id)
    const { ok, data } = await api(`/api/admin/ai-providers/${id}/test`, 'POST')
    setTesting(null)
    flash(ok ? `✅ Test OK — ${data.model} responded in ${data.latencyMs}ms` : `❌ Test failed: ${data.error || 'no response'}`)
  }

  const setActive = async (id: string) => {
    const { ok } = await api('/api/admin/ai-providers/active', 'PUT', { id })
    if (ok) { setActiveId(id); flash('Active provider updated') }
  }

  const remove = async (id: string) => {
    const { ok } = await api(`/api/admin/ai-providers/${id}`, 'DELETE')
    if (ok) { flash('Provider removed'); void load() }
  }

  return (
    <div className="space-y-4">
      {msg && <div className="p-2 rounded-lg bg-indigo-900/40 border border-indigo-700 text-indigo-200 text-xs">{msg}</div>}

      {/* Add NVIDIA NIM */}
      <div className={card}>
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Cpu className="w-4 h-4 text-emerald-400" /> NVIDIA NIM</h3>
        <p className="text-[11px] text-slate-500">
          Get a free API key at <a href="https://build.nvidia.com" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">build.nvidia.com</a>.
          After adding the key, run <b>Scan Models</b> — RyzenDesk probes the free catalog for latency and auto-selects the fastest working model for all AI features.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="password" value={nimKey} onChange={(e) => setNimKey(e.target.value)} placeholder="nvapi-..." className={input} />
          <button onClick={addNim} disabled={busy === 'nim' || nimKey.trim().length < 8} className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white shrink-0`}>
            <Plus className="w-3.5 h-3.5" /> {busy === 'nim' ? 'Adding…' : 'Add Key'}
          </button>
        </div>
      </div>

      {/* Add custom provider */}
      <div className={card}>
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2"><Zap className="w-4 h-4 text-violet-400" /> Custom OpenAI-Compatible Provider</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} placeholder="Name (e.g. vLLM self-hosted)" className={input} />
          <input value={custom.baseUrl} onChange={(e) => setCustom({ ...custom, baseUrl: e.target.value })} placeholder="https://host/v1" className={input} />
          <input type="password" value={custom.apiKey} onChange={(e) => setCustom({ ...custom, apiKey: e.target.value })} placeholder="API key" className={input} />
          <input value={custom.model} onChange={(e) => setCustom({ ...custom, model: e.target.value })} placeholder="Model (optional, e.g. meta/llama-3.1-8b-instruct)" className={input} />
        </div>
        <button onClick={addCustom} disabled={busy === 'custom' || !custom.name || !custom.baseUrl || custom.apiKey.length < 8} className={`${btn} bg-violet-600 hover:bg-violet-500 text-white`}>
          <Plus className="w-3.5 h-3.5" /> {busy === 'custom' ? 'Adding…' : 'Add Provider'}
        </button>
      </div>

      {/* Provider list */}
      <div className={card}>
        <h3 className="text-sm font-bold text-slate-200">Configured Providers</h3>
        {providers.length === 0 && <p className="text-xs text-slate-500">No AI providers configured yet. AI features fall back to Gemini when GEMINI_API_KEY is set, and to heuristics otherwise.</p>}
        {providers.map((p) => (
          <div key={p.id} className={`p-3 rounded-lg border space-y-2 ${activeId === p.id ? 'border-emerald-600 bg-emerald-950/20' : 'border-slate-800 bg-slate-950'}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-slate-200">{p.name}</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{p.kind === 'nvidia_nim' ? 'NVIDIA NIM' : 'custom'}</span>
              <span className="text-slate-500 font-mono truncate max-w-[240px]">{p.baseUrl}</span>
              {p.model && <span className="px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300 font-mono">{p.model}</span>}
              {activeId === p.id && <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-semibold flex items-center gap-1"><Check className="w-3 h-3" /> ACTIVE</span>}
              <span className={`ml-auto text-[10px] ${p.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>{p.enabled ? 'enabled' : 'disabled'}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeId !== p.id && (
                <button onClick={() => setActive(p.id)} className={`${btn} bg-emerald-700 hover:bg-emerald-600 text-white`}><Check className="w-3.5 h-3.5" /> Set Active</button>
              )}
              {p.kind === 'nvidia_nim' && (
                <button onClick={() => scan(p.id)} disabled={scanning === p.id} className={`${btn} bg-sky-600 hover:bg-sky-500 text-white`}>
                  <Radar className={`w-3.5 h-3.5 ${scanning === p.id ? 'animate-spin' : ''}`} /> {scanning === p.id ? 'Scanning free models…' : 'Scan Models (auto-pick fastest)'}
                </button>
              )}
              <button onClick={() => test(p.id)} disabled={testing === p.id || !p.model} className={`${btn} bg-slate-800 hover:bg-slate-700 text-slate-200`}>
                <Play className="w-3.5 h-3.5" /> {testing === p.id ? 'Testing…' : 'Test'}
              </button>
              <button onClick={() => remove(p.id)} className={`${btn} bg-rose-900/60 hover:bg-rose-800 text-rose-200 ml-auto`}><Trash2 className="w-3.5 h-3.5" /> Remove</button>
            </div>
            {p.lastScanResults && p.lastScanResults.length > 0 && (
              <div className="text-[10px] text-slate-500">
                Last scan {p.lastScanAt ? new Date(p.lastScanAt).toLocaleString() : ''}:{' '}
                {p.lastScanResults.filter((r) => r.ok).sort((a, b) => (a.ms || 0) - (b.ms || 0)).slice(0, 5).map((r) => `${r.model} (${r.ms}ms)`).join(' · ') || 'no working models'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}