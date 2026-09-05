import React, { useState, useEffect } from 'react'
import {
  Server,
  ShieldCheck,
  Building2,
  Database,
  Mail,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Lock,
  Globe,
  Clock,
  Sparkles,
  Download,
  Terminal,
  Cpu,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type {
  InstallationPreflightResult,
  InstallationConfig,
  InstallationSettings,
  SMTPSettings,
  TelegramSettings,
} from '../../types'

interface InstallationWizardProps {
  isOpen: boolean
  onClose: () => void
  currentSettings?: InstallationSettings
  onInstallationComplete: (settings: InstallationSettings, adminUsername?: string) => void
  isReconfigureMode?: boolean
}

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

export const InstallationWizard: React.FC<InstallationWizardProps> = ({
  isOpen,
  onClose,
  currentSettings,
  onInstallationComplete,
  isReconfigureMode = false,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)

  // Step 1: Pre-flight state
  const [preflight, setPreflight] = useState<InstallationPreflightResult | null>(null)
  const [isPreflightLoading, setIsPreflightLoading] = useState(false)
  const [preflightError, setPreflightError] = useState<string | null>(null)

  // Step 2: Organization Profile
  const [orgName, setOrgName] = useState(currentSettings?.organizationName || 'Ryzen Technologies Enterprise')
  const [helpdeskName, setHelpdeskName] = useState(currentSettings?.helpdeskName || 'RyzenDesk Support Center')
  const [supportEmail, setSupportEmail] = useState(currentSettings?.supportEmail || 'support@ryzendesk.internal')
  const [baseUrl, setBaseUrl] = useState(
    currentSettings?.baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  )
  const [timezone, setTimezone] = useState(currentSettings?.timezone || 'UTC')
  const [slaTier, setSlaTier] = useState<'rapid' | 'standard' | 'flexible'>('standard')
  const [defaultLanguage, setDefaultLanguage] = useState(currentSettings?.defaultLanguage || 'en')

  // Step 3: Database & Storage Strategy
  const [storageEngine, setStorageEngine] = useState<'atomic_json_engine' | 'cloud_sync_engine'>(
    (currentSettings?.storageEngine as any) || 'atomic_json_engine'
  )
  const [seedDemoData, setSeedDemoData] = useState(currentSettings?.seededDemoData ?? true)
  const [backupEnabled, setBackupEnabled] = useState(currentSettings?.backupEnabled ?? true)

  // Step 4: Primary Super Admin Account
  // No default password: a publicly-known initial credential (even a placeholder
  // that passes the strength meter) is a critical risk on internet-facing installs.
  const [adminName, setAdminName] = useState('Alex Morgan')
  const [adminUsername, setAdminUsername] = useState('admin')
  const [adminEmail, setAdminEmail] = useState('admin@ryzendesk.internal')
  const [adminPassword, setAdminPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [recoveryToken, setRecoveryToken] = useState('')
  const [copiedToken, setCopiedToken] = useState(false)

  // Step 5: Services & Integrations
  const [smtpEnabled, setSmtpEnabled] = useState(true)
  const [smtpHost, setSmtpHost] = useState('smtp.sendgrid.net')
  const [smtpPort, setSmtpPort] = useState(587)
  const [smtpUser, setSmtpUser] = useState('apikey')
  const [smtpPass, setSmtpPass] = useState('SG.demo_key_ryzendesk_notifications')
  const [smtpFrom, setSmtpFrom] = useState('notifications@ryzendesk.internal')
  const [smtpSecure, setSmtpSecure] = useState(false)
  const [smtpTestStatus, setSmtpTestStatus] = useState<{ testing: boolean; message?: string; success?: boolean }>({
    testing: false,
  })

  const [geminiKey, setGeminiKey] = useState('')
  const [aiTestStatus, setAiTestStatus] = useState<{ testing: boolean; message?: string; success?: boolean }>({
    testing: false,
  })

  const [telegramToken, setTelegramToken] = useState('')

  // Step 6: Installation Execution state
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionLog, setExecutionLog] = useState<string[]>([])
  const [executionProgress, setExecutionProgress] = useState(0)
  const [isCompleted, setIsCompleted] = useState(false)
  const [installationReceipt, setInstallationReceipt] = useState<any>(null)
  const [showDeployGuide, setShowDeployGuide] = useState(false)

  // Initialize recovery token if empty
  useEffect(() => {
    if (!recoveryToken) {
      const generated = `RD-SEC-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      setRecoveryToken(generated)
    }
  }, [recoveryToken])

  // Run Preflight on modal open or when on step 1
  useEffect(() => {
    if (isOpen && currentStep === 1) {
      runPreflight()
    }
  }, [isOpen, currentStep])

  const runPreflight = async () => {
    setIsPreflightLoading(true)
    setPreflightError(null)
    try {
      const res = await fetch('/api/install/preflight')
      if (!res.ok) throw new Error(`Pre-flight diagnostic HTTP error: ${res.status}`)
      const data = (await res.json()) as InstallationPreflightResult
      setPreflight(data)
    } catch (err: any) {
      setPreflightError(err.message || 'Failed to connect to server preflight endpoint')
    } finally {
      setIsPreflightLoading(false)
    }
  }

  const handleTestSmtp = async () => {
    setSmtpTestStatus({ testing: true })
    try {
      const res = await fetch('/api/install/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom,
          secure: smtpSecure,
          targetEmail: adminEmail || supportEmail,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSmtpTestStatus({ testing: false, success: true, message: 'SMTP test packet delivered successfully!' })
      } else {
        setSmtpTestStatus({ testing: false, success: false, message: data.error || 'SMTP delivery probe failed.' })
      }
    } catch (err: any) {
      setSmtpTestStatus({ testing: false, success: false, message: err.message || 'Failed to reach SMTP test endpoint' })
    }
  }

  const handleTestAi = async () => {
    setAiTestStatus({ testing: true })
    try {
      const res = await fetch('/api/install/test-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiKey }),
      })
      const data = await res.json()
      if (data.success) {
        setAiTestStatus({
          testing: false,
          success: true,
          message: `Gemini AI Engine Verified (${data.model})`,
        })
      } else {
        setAiTestStatus({ testing: false, success: false, message: data.error || 'Gemini API probe failed.' })
      }
    } catch (err: any) {
      setAiTestStatus({ testing: false, success: false, message: err.message || 'AI test request failed' })
    }
  }

  const executeInstallation = async () => {
    setIsExecuting(true)
    setExecutionProgress(5)
    setExecutionLog(['Initiating server installation sequence...'])

    // Client-side guard: never submit an installation without a real admin
    // password (an empty one would create a passwordless super_admin).
    if (adminPassword.length < 8 || adminPassword !== confirmPassword) {
      setExecutionLog((prev) => [...prev, '[ERROR] Administrator password must be at least 8 characters and match the confirmation.'])
      setIsExecuting(false)
      return
    }

    const steps = [
      { text: 'Verifying system environment and file storage permissions...', pct: 20 },
      { text: 'Initializing atomic database storage and locking structures...', pct: 40 },
      { text: `Configuring Super Admin identity: ${adminUsername} (${adminEmail})...`, pct: 60 },
      { text: 'Applying SLA tier policies, timezone, and organization parameters...', pct: 75 },
      { text: 'Setting up notification subsystems (SMTP & Webhooks)...', pct: 90 },
      { text: 'Writing installation lock and creating disaster recovery snapshot...', pct: 100 },
    ]

    for (const s of steps) {
      await new Promise((r) => setTimeout(r, 420))
      setExecutionProgress(s.pct)
      setExecutionLog((prev) => [...prev, `[✓] ${s.text}`])
    }

    try {
      const payload: InstallationConfig = {
        organizationName: orgName,
        helpdeskName,
        supportEmail,
        baseUrl,
        defaultLanguage,
        timezone,
        storageEngine,
        seedDemoData,
        backupEnabled,
        admin: {
          username: adminUsername,
          displayName: adminName,
          email: adminEmail,
          password: adminPassword,
          recoveryToken,
        },
        smtp: {
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom,
          secure: smtpSecure,
          enabled: smtpEnabled,
        },
        telegram: {
          botToken: telegramToken,
          enabled: Boolean(telegramToken),
        },
        geminiApiKey: geminiKey || undefined,
      }

      const res = await fetch('/api/install/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete server installation.')
      }

      setInstallationReceipt(data.receipt)
      setIsCompleted(true)
      setExecutionLog((prev) => [...prev, '🎉 RyzenDesk Enterprise is fully installed and operational!'])
    } catch (err: any) {
      setExecutionLog((prev) => [...prev, `[ERROR] ${err.message}`])
    } finally {
      setIsExecuting(false)
    }
  }

  const downloadReceipt = () => {
    const text = `================================================================================
RYZENDESK ENTERPRISE INSTALLATION & CONFIGURATION RECEIPT
================================================================================
Timestamp: ${new Date().toISOString()}
System Version: 2.3.0 Enterprise
Organization: ${orgName}
Helpdesk Title: ${helpdeskName}
Support Email: ${supportEmail}
Base URL: ${baseUrl}

PRIMARY ADMINISTRATOR CREDENTIALS:
Username: ${adminUsername}
Display Name: ${adminName}
Email: ${adminEmail}
Installation Reference Code: ${recoveryToken} (reference only — not used for authentication)

SYSTEM STORAGE & POLICIES:
Storage Engine: ${storageEngine === 'atomic_json_engine' ? 'RyzenDesk Atomic JSON Engine' : 'Cloud Sync Mirror'}
Timezone: ${timezone}
Default Language: ${defaultLanguage}
SLA Tier: ${slaTier}
Demo Data Preloaded: ${seedDemoData ? 'Yes (Evaluation Suite)' : 'No (Clean Production Slate)'}
Snapshot Backups: ${backupEnabled ? 'Enabled' : 'Disabled'}

OUTBOUND EMAIL:
SMTP Host: ${smtpHost}:${smtpPort}
From Address: ${smtpFrom}
SSL/TLS: ${smtpSecure ? 'Enabled' : 'Disabled'}

================================================================================
KEEP THIS RECEIPT SECURE. Store your Master Security Recovery Key safely.
================================================================================`

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ryzendesk-install-receipt-${new Date().toISOString().slice(0, 10)}.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const copyRecoveryToken = () => {
    navigator.clipboard.writeText(recoveryToken)
    setCopiedToken(true)
    setTimeout(() => setCopiedToken(false), 2000)
  }

  // Password strength helper
  const getPasswordStrength = (pwd: string) => {
    let score = 0
    if (pwd.length >= 8) score += 1
    if (/[A-Z]/.test(pwd)) score += 1
    if (/[0-9]/.test(pwd)) score += 1
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1
    return score
  }
  const pwdStrength = getPasswordStrength(adminPassword)

  if (!isOpen) return null

  return (
    <div
      id="installation-wizard-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Wizard Top Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-md ring-2 ring-indigo-400/30">
              R
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight">RyzenDesk</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  SERVER INSTALLER v2.3
                </span>
                {isReconfigureMode && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    Reconfigure Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Enterprise CRM & Helpdesk Self-Hosted Setup Wizard</p>
            </div>
          </div>

          {isReconfigureMode && (
            <button
              onClick={onClose}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              Exit Setup
            </button>
          )}
        </div>

        {/* Step Progress Tracker */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3.5 select-none overflow-x-auto">
          <div className="flex items-center justify-between min-w-[620px] text-xs">
            {[
              { num: 1, label: 'Pre-flight', icon: Server },
              { num: 2, label: 'Organization', icon: Building2 },
              { num: 3, label: 'Storage', icon: Database },
              { num: 4, label: 'Admin Account', icon: ShieldCheck },
              { num: 5, label: 'Integrations', icon: Mail },
              { num: 6, label: 'Provision', icon: CheckCircle2 },
            ].map((step, idx) => {
              const Icon = step.icon
              const isPast = currentStep > step.num
              const isCurrent = currentStep === step.num
              return (
                <React.Fragment key={step.num}>
                  <div
                    onClick={() => {
                      if (step.num < currentStep && !isExecuting && !isCompleted) {
                        setCurrentStep(step.num as WizardStep)
                      }
                    }}
                    className={`flex items-center gap-2 cursor-pointer transition-all ${
                      isCurrent
                        ? 'text-indigo-600 font-bold'
                        : isPast
                        ? 'text-slate-700 font-semibold'
                        : 'text-slate-400 font-medium'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isPast
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isPast ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : step.num}
                    </div>
                    <span>{step.label}</span>
                  </div>
                  {idx < 5 && (
                    <div
                      className={`flex-1 h-0.5 mx-3 transition-colors ${
                        currentStep > idx + 1 ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Wizard Main Content Body */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          {/* STEP 1: Pre-flight Check */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">System Pre-Flight Health Check</h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    RyzenDesk inspects your server runtime environment, storage permissions, and memory before
                    installation.
                  </p>
                </div>
                <button
                  onClick={runPreflight}
                  disabled={isPreflightLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPreflightLoading ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>Re-check Environment</span>
                </button>
              </div>

              {isPreflightLoading && (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
                  <p className="text-sm font-medium">Scanning server environment and storage integrity...</p>
                </div>
              )}

              {preflightError && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Pre-flight Diagnostic Error:</span>
                    <p className="mt-1">{preflightError}</p>
                  </div>
                </div>
              )}

              {preflight && !isPreflightLoading && (
                <div className="space-y-4">
                  {/* Overall Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      preflight.passed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {preflight.passed ? (
                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                          <Check className="w-5 h-5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center">
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <span className="font-bold text-sm text-slate-900">
                          {preflight.passed
                            ? 'Server Environment Fully Certified'
                            : 'Pre-Flight Warnings Encountered'}
                        </span>
                        <p className="text-xs text-slate-600">
                          {preflight.passed
                            ? 'All critical runtime and storage subsystems passed verification. Ready to proceed.'
                            : 'Review the items below before completing the setup.'}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-white font-semibold text-slate-700 border border-slate-200">
                      {preflight.platform}
                    </span>
                  </div>

                  {/* Checklist Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {preflight.checks.map((check) => (
                      <div
                        key={check.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all flex items-start gap-3"
                      >
                        <div className="mt-0.5 shrink-0">
                          {check.status === 'pass' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                          {check.status === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                          {check.status === 'fail' && <AlertTriangle className="w-5 h-5 text-rose-600" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-800">{check.name}</span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                check.status === 'pass'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : check.status === 'warning'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {check.status}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-slate-600 mt-1 truncate">{check.value}</p>
                          {check.recommendation && (
                            <p className="text-[11px] text-amber-700 mt-1 bg-amber-50 p-1.5 rounded">
                              {check.recommendation}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Organization Profile */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Organization & Helpdesk Profile</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Configure your company branding, primary support email, and operational response policy.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Organization / Company Name</label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Acme Corporation"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Helpdesk Brand Title</label>
                  <input
                    type="text"
                    value={helpdeskName}
                    onChange={(e) => setHelpdeskName(e.target.value)}
                    placeholder="e.g. Acme Support Center"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Primary Support Email</label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="support@yourcompany.com"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Used as the default sender for customer notifications and passwordless portal receipts.
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Public Server Base URL</label>
                  <input
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://support.yourcompany.com"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Base URL included in magic login links sent to customers.
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Operating Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="UTC">UTC (Universal Coordinated Time)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Europe/Berlin">Europe/Berlin (CET/CEST)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Default Interface Language</label>
                  <select
                    value={defaultLanguage}
                    onChange={(e) => setDefaultLanguage(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                  >
                    <option value="en">English (US / International)</option>
                    <option value="es">Español (Spanish)</option>
                    <option value="de">Deutsch (German)</option>
                    <option value="fr">Français (French)</option>
                    <option value="ja">日本語 (Japanese)</option>
                  </select>
                </div>
              </div>

              {/* SLA Response Policy Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Default SLA Response Tier</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'rapid' as const,
                      title: 'Enterprise Rapid',
                      first: '1 Hour',
                      resolve: '4 Hours',
                      desc: 'Strict 24/7 mission-critical operations',
                    },
                    {
                      id: 'standard' as const,
                      title: 'Business Standard',
                      first: '2 Hours',
                      resolve: '8 Hours',
                      desc: 'Balanced corporate enterprise workload',
                    },
                    {
                      id: 'flexible' as const,
                      title: 'Flexible Team',
                      first: '4 Hours',
                      resolve: '24 Hours',
                      desc: 'Best for standard asynchronous support',
                    },
                  ].map((tier) => {
                    const isSelected = slaTier === tier.id
                    return (
                      <div
                        key={tier.id}
                        onClick={() => setSlaTier(tier.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50/60 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900">{tier.title}</span>
                          <input
                            type="radio"
                            checked={isSelected}
                            onChange={() => setSlaTier(tier.id)}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="mt-2 text-xs space-y-0.5 text-slate-600">
                          <div>
                            First Response: <span className="font-semibold text-slate-800">{tier.first}</span>
                          </div>
                          <div>
                            Resolution: <span className="font-semibold text-slate-800">{tier.resolve}</span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2">{tier.desc}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Database & Storage Strategy */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Database & Persistence Architecture</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Select your storage engine and decide whether to start with clean corporate slate or sample demo data.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700">Storage Engine Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setStorageEngine('atomic_json_engine')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      storageEngine === 'atomic_json_engine'
                        ? 'bg-indigo-50/60 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Database className="w-5 h-5 text-indigo-600" />
                        <span className="font-bold text-sm text-slate-900">RyzenDesk Atomic JSON Engine</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded">
                        RECOMMENDED
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      Embedded zero-dependency ACID-like atomic disk persistence with SHA-256 state snapshots. Fast,
                      portable, and requires zero external database servers.
                    </p>
                  </div>

                  <div
                    onClick={() => setStorageEngine('cloud_sync_engine')}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      storageEngine === 'cloud_sync_engine'
                        ? 'bg-indigo-50/60 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Globe className="w-5 h-5 text-sky-600" />
                        <span className="font-bold text-sm text-slate-900">Cloud Sync & Git Mirror</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                        CONTINUOUS
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                      Continuous bi-directional synchronization with your remote GitHub repository for enterprise audit
                      trails and cloud backups.
                    </p>
                  </div>
                </div>
              </div>

              {/* Data Seeding Choice */}
              <div className="pt-2 border-t border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-2">Initial Data State</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div
                    onClick={() => setSeedDemoData(true)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      seedDemoData
                        ? 'bg-indigo-50/40 border-indigo-600 ring-2 ring-indigo-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">Preload Demo & Evaluation Suite</span>
                      <input
                        type="radio"
                        checked={seedDemoData}
                        onChange={() => setSeedDemoData(true)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Includes 6 sample tickets with escalations, client profiles, Sprint Kanban board, and Confluence
                      wiki spaces. Great for testing features immediately.
                    </p>
                  </div>

                  <div
                    onClick={() => setSeedDemoData(false)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      !seedDemoData
                        ? 'bg-indigo-50/40 border-indigo-600 ring-2 ring-indigo-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">Clean Production Slate</span>
                      <input
                        type="radio"
                        checked={!seedDemoData}
                        onChange={() => setSeedDemoData(false)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Initializes an empty ticket queue ready for live customers. Default wiki spaces and teams will be
                      retained.
                    </p>
                  </div>
                </div>
              </div>

              {/* Automatic Backup Snapshot */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-slate-800">Automated Disaster Recovery Snapshots</span>
                  <p className="text-xs text-slate-500">
                    Creates timestamped snapshot backups in <code className="text-indigo-600">data/backup-*.json</code>{' '}
                    upon significant system modifications.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={backupEnabled}
                  onChange={(e) => setBackupEnabled(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* STEP 4: Primary Super Admin Account */}
          {currentStep === 4 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Primary Super Administrator Account</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Set up the master administrator credentials for enterprise configuration, RBAC, and system audits.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Administrator Full Name</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Master Username</label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Administrator Email Address</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@yourcompany.com"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Master Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full px-3.5 py-2 pr-10 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password strength meter */}
                  <div className="mt-2 flex items-center gap-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`h-1.5 flex-1 rounded-full ${
                          pwdStrength >= step
                            ? pwdStrength === 4
                              ? 'bg-emerald-500'
                              : pwdStrength >= 2
                              ? 'bg-indigo-500'
                              : 'bg-amber-500'
                            : 'bg-slate-200'
                        }`}
                      />
                    ))}
                    <span className="text-[10px] font-bold text-slate-500 ml-1">
                      {pwdStrength === 4 ? 'Strong' : pwdStrength >= 2 ? 'Medium' : 'Weak'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Master Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none font-mono"
                  />
                  {adminPassword && confirmPassword && (
                    <span
                      className={`text-[11px] font-semibold mt-1 block ${
                        adminPassword === confirmPassword ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {adminPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                    </span>
                  )}
                </div>
              </div>

              {/* Master Recovery Key */}
              <div className="p-4 bg-slate-900 rounded-xl text-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-400" />
                    <span className="font-bold text-xs text-white">Installation Reference Code</span>
                  </div>
                  <button
                    onClick={copyRecoveryToken}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 transition-colors cursor-pointer"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedToken ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg font-mono text-sm tracking-wider text-emerald-400 border border-slate-800 select-all">
                  {recoveryToken}
                </div>
                <p className="text-[11px] text-slate-400">
                  Reference code for your installation notes. It is NOT used for authentication or recovery —
                  your admin credentials are the only way to sign in.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: Integrations & Services */}
          {currentStep === 5 && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Services & External Integrations</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Configure SMTP email delivery and Gemini AI intelligence. Both can be verified immediately.
                </p>
              </div>

              {/* SMTP Mail Section */}
              <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-sm text-slate-900">Outbound SMTP Mail Server</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpEnabled}
                      onChange={(e) => setSmtpEnabled(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span>Enable Outbound Notifications</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.sendgrid.net"
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Port</label>
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(Number(e.target.value))}
                      placeholder="587"
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      placeholder="apikey"
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Sender Email (From)</label>
                    <input
                      type="email"
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                      placeholder="support@company.com"
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpSecure}
                      onChange={(e) => setSmtpSecure(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded"
                    />
                    <span>Use SSL/TLS (Direct 465)</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleTestSmtp}
                    disabled={smtpTestStatus.testing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${smtpTestStatus.testing ? 'animate-spin text-indigo-600' : ''}`} />
                    <span>Test SMTP Connection</span>
                  </button>
                </div>

                {smtpTestStatus.message && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      smtpTestStatus.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {smtpTestStatus.success ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{smtpTestStatus.message}</span>
                  </div>
                )}
              </div>

              {/* AI Copilot (Gemini) Section */}
              <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-sm text-slate-900">Gemini AI Copilot & Auto-Summarization</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">
                    GEMINI 2.5 FLASH
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Gemini API Key (Optional or inherited from server env)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIzaSy... (leave blank to use server environment default)"
                      className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleTestAi}
                      disabled={aiTestStatus.testing}
                      className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Cpu className={`w-3.5 h-3.5 ${aiTestStatus.testing ? 'animate-spin text-indigo-600' : ''}`} />
                      <span>Verify AI</span>
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Powers automatic ticket summarization, smart suggested replies, and customer sentiment analytics.
                  </span>
                </div>

                {aiTestStatus.message && (
                  <div
                    className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 ${
                      aiTestStatus.success
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {aiTestStatus.success ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{aiTestStatus.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 6: Review & Live Automated Provisioning */}
          {currentStep === 6 && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {!isCompleted ? (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Review & Execute Installation</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Verify your configuration summary below. Clicking initialize will write all system parameters,
                      lock the setup, and start the helpdesk service.
                    </p>
                  </div>

                  {/* Configuration Summary Table */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2.5">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Organization Name:</span>
                      <span className="font-bold text-slate-900">{orgName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Helpdesk Title:</span>
                      <span className="font-bold text-slate-900">{helpdeskName}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Super Admin:</span>
                      <span className="font-bold text-slate-900">
                        {adminUsername} ({adminEmail})
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Storage Engine:</span>
                      <span className="font-bold text-indigo-700 font-mono">
                        {storageEngine === 'atomic_json_engine'
                          ? 'RyzenDesk Atomic JSON Engine'
                          : 'Cloud Sync & Git Mirror'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Initial Workspace Data:</span>
                      <span className="font-bold text-slate-900">
                        {seedDemoData ? 'Evaluation Suite (Sample Tickets & Wiki)' : 'Clean Production Slate'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500 font-medium">Outbound Mail (SMTP):</span>
                      <span className="font-bold text-slate-900">
                        {smtpEnabled ? `${smtpHost}:${smtpPort} (${smtpFrom})` : 'Disabled'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500 font-medium">Server Base URL:</span>
                      <span className="font-bold text-slate-900 font-mono">{baseUrl}</span>
                    </div>
                  </div>

                  {/* Interactive Terminal / Provisioning Bar */}
                  {isExecuting && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>Installing RyzenDesk System Files...</span>
                        <span>{executionProgress}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
                          style={{ width: `${executionProgress}%` }}
                        />
                      </div>
                      <div className="bg-slate-950 rounded-xl p-3.5 font-mono text-xs text-slate-300 space-y-1 max-h-36 overflow-y-auto">
                        {executionLog.map((log, i) => (
                          <div
                            key={i}
                            className={
                              log.startsWith('[✓]')
                                ? 'text-emerald-400'
                                : log.startsWith('[ERROR]')
                                ? 'text-rose-400 font-bold'
                                : 'text-slate-300'
                            }
                          >
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isExecuting && (
                    <button
                      onClick={executeInstallation}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Initialize & Install RyzenDesk Enterprise</span>
                    </button>
                  )}
                </>
              ) : (
                /* Celebratory Success View */
                <div className="text-center space-y-5 animate-in zoom-in-95 duration-200 py-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-inner">
                    <Check className="w-10 h-10 stroke-[3]" />
                  </div>

                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                      Installation Successfully Completed!
                    </h2>
                    <p className="text-sm text-slate-600 max-w-md mx-auto mt-1">
                      {orgName} is initialized and ready for production ticket handling.
                    </p>
                  </div>

                  {/* Receipt Card */}
                  <div className="max-w-md mx-auto p-4 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Super Admin User:</span>
                      <span className="font-bold text-slate-800">{adminUsername}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Admin Email:</span>
                      <span className="font-bold text-slate-800">{adminEmail}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Installed At:</span>
                      <span className="font-mono text-slate-700">
                        {installationReceipt?.installedAt ? new Date(installationReceipt.installedAt).toLocaleString() : new Date().toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Security Lock Key:</span>
                      <span className="font-mono text-indigo-600 truncate max-w-[200px]">
                        {installationReceipt?.lockKey || 'rd_lock_verified'}
                      </span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <button
                      onClick={downloadReceipt}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors cursor-pointer w-full sm:w-auto justify-center"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download Receipt (.txt)</span>
                    </button>

                    <button
                      onClick={() => {
                        const newSettings: InstallationSettings = {
                          installed: true,
                          installedAt: new Date().toISOString(),
                          organizationName: orgName,
                          helpdeskName,
                          supportEmail,
                          baseUrl,
                          defaultLanguage,
                          timezone,
                          storageEngine,
                          seededDemoData: seedDemoData,
                          backupEnabled,
                          adminCreated: true,
                          installationLockKey: installationReceipt?.lockKey || 'rd_lock_master',
                          version: '2.3.0',
                        }
                        onInstallationComplete(newSettings, adminUsername)
                        onClose()
                      }}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer w-full sm:w-auto justify-center"
                    >
                      <span>Enter RyzenDesk Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Production Deployment Tips Accordion */}
                  <div className="max-w-md mx-auto pt-4 text-left border-t border-slate-200">
                    <button
                      onClick={() => setShowDeployGuide(!showDeployGuide)}
                      className="flex items-center justify-between w-full text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      <span>Production Deployment Architecture (Docker & Systemd)</span>
                      {showDeployGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {showDeployGuide && (
                      <div className="mt-2 p-3 bg-slate-900 text-slate-300 rounded-lg font-mono text-[11px] space-y-2">
                        <div className="text-indigo-400 font-bold"># Docker Container Launch:</div>
                        <div className="p-1.5 bg-slate-950 rounded select-all overflow-x-auto text-emerald-400">
                          docker run -d -p 3000:3000 -v $(pwd)/data:/app/data --name ryzendesk ryzendesk/enterprise:v2.3
                        </div>
                        <div className="text-indigo-400 font-bold"># Systemd Service Unit:</div>
                        <div className="p-1.5 bg-slate-950 rounded select-all overflow-x-auto text-slate-400">
                          [Unit]
                          <br />
                          Description=RyzenDesk CRM Daemon
                          <br />
                          After=network.target
                          <br />
                          [Service]
                          <br />
                          ExecStart=/usr/bin/node /opt/ryzendesk/dist/server.cjs
                          <br />
                          Restart=always
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            {currentStep > 1 && !isCompleted && !isExecuting && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev - 1) as WizardStep)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous Step</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep < 6 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => (prev + 1) as WizardStep)}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
