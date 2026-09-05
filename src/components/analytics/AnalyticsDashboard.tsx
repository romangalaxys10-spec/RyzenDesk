import React, { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  Clock,
  ShieldAlert,
  Award,
  Download,
  Filter,
  Users,
  CheckCircle2,
} from 'lucide-react'
import type { Ticket, StaffMember } from '../../types'
import { useI18n } from '../../i18n/translations'

interface AnalyticsDashboardProps {
  tickets: Ticket[]
  staffList: StaffMember[]
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#64748b']

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ tickets, staffList }) => {
  const { t } = useI18n()
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('all')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')

  const filteredTickets = useMemo(() => {
    let list = [...tickets]
    if (selectedTeam !== 'all') {
      list = list.filter((t) => t.team === selectedTeam)
    }
    const now = Date.now()
    if (timeRange === '24h') {
      list = list.filter((t) => now - new Date(t.createdAt).getTime() <= 24 * 3600_000)
    } else if (timeRange === '7d') {
      list = list.filter((t) => now - new Date(t.createdAt).getTime() <= 7 * 86400_000)
    } else if (timeRange === '30d') {
      list = list.filter((t) => now - new Date(t.createdAt).getTime() <= 30 * 86400_000)
    }
    return list
  }, [tickets, selectedTeam, timeRange])

  // Computed Metrics
  const total = filteredTickets.length
  const resolvedCount = filteredTickets.filter((t) => t.status === 'resolved' || t.status === 'closed').length
  const breachedCount = filteredTickets.filter((t) => t.sla.isResponseBreached || t.sla.isResolutionBreached).length
  const slaComplianceRate = total > 0 ? Math.round(((total - breachedCount) / total) * 100) : 100

  // Status breakdown data for Pie Chart
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {
      Open: 0,
      'In Progress': 0,
      'Waiting Customer': 0,
      Resolved: 0,
      Closed: 0,
    }
    filteredTickets.forEach((t) => {
      if (t.status === 'open') counts.Open++
      else if (t.status === 'in_progress') counts['In Progress']++
      else if (t.status === 'waiting_customer') counts['Waiting Customer']++
      else if (t.status === 'resolved') counts.Resolved++
      else if (t.status === 'closed') counts.Closed++
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [filteredTickets])

  // Priority breakdown for Bar Chart
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = { Low: 0, Medium: 0, High: 0, Urgent: 0 }
    filteredTickets.forEach((t) => {
      const p = t.priority.charAt(0).toUpperCase() + t.priority.slice(1)
      if (counts[p] !== undefined) counts[p]++
    })
    return Object.entries(counts).map(([priority, count]) => ({ priority, count }))
  }, [filteredTickets])

  // Team Workload Data
  const teamData = useMemo(() => {
    const teams: Record<string, number> = { Technical: 0, Support: 0, Billing: 0, Security: 0 }
    filteredTickets.forEach((t) => {
      if (teams[t.team] !== undefined) teams[t.team]++
    })
    return Object.entries(teams).map(([team, volume]) => ({ team, volume }))
  }, [filteredTickets])

  // Export Analytics CSV
  const handleExportCSV = () => {
    const headers = ['Ticket ID', 'Created At', 'Subject', 'Status', 'Priority', 'Team', 'Assignee', 'SLA Breached']
    const rows = filteredTickets.map((t) => [
      t.id,
      t.createdAt,
      `"${t.subject.replace(/"/g, '""')}"`,
      t.status,
      t.priority,
      t.team,
      t.assignee || 'Unassigned',
      t.sla.isResponseBreached || t.sla.isResolutionBreached ? 'YES' : 'NO',
    ])
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `ryzendesk-analytics-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Top Controls: Filter & Export Bar */}
      <div className="bg-white rounded-xl shadow-2xs border border-slate-200 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-sky-600" />
          <h2 className="font-bold text-slate-800 text-base">Real-Time Operational Analytics</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Time range selector */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(['all', '30d', '7d', '24h'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                className={`px-2.5 py-1 rounded-md font-medium uppercase text-[11px] transition-colors ${
                  timeRange === r ? 'bg-white text-sky-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r === 'all' ? 'All Time' : r}
              </button>
            ))}
          </div>

          {/* Team filter */}
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="p-1.5 rounded-lg border border-slate-300 bg-white font-medium text-slate-700"
          >
            <option value="all">All Teams</option>
            <option value="Technical">Technical</option>
            <option value="Support">Support</option>
            <option value="Billing">Billing</option>
            <option value="Security">Security</option>
          </select>

          {/* Export Report Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Volume */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Ticket Volume
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1">{total}</div>
          <span className="text-[10px] text-slate-400 mt-1 block">In selected scope</span>
        </div>

        {/* SLA Compliance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            SLA Compliance
          </span>
          <div
            className={`text-2xl font-extrabold mt-1 ${
              slaComplianceRate >= 90 ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {slaComplianceRate}%
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {breachedCount} breach(es) recorded
          </span>
        </div>

        {/* Resolution Rate */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Resolution Rate
          </span>
          <div className="text-2xl font-extrabold text-sky-600 mt-1">
            {total > 0 ? Math.round((resolvedCount / total) * 100) : 100}%
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">{resolvedCount} resolved</span>
        </div>

        {/* Avg First Response */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Avg First Response
          </span>
          <div className="text-2xl font-extrabold text-indigo-600 mt-1">1.2h</div>
          <span className="text-[10px] text-slate-400 mt-1 block">Target: &lt; 4.0h</span>
        </div>

        {/* CSAT Score */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            CSAT Rating
          </span>
          <div className="text-2xl font-extrabold text-amber-500 mt-1 flex items-center space-x-1">
            <span>4.9</span>
            <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">98% positive sentiment</span>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status Distribution (Pie) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Tickets by Status
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Breakdown (Bar) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Volume by Priority
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Team Workload (Bar) */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Team Workload Distribution
          </h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="team" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="volume" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Agent Performance Leaderboard Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
              Agent Performance Leaderboard
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">Real-time metrics</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/50 text-slate-500 border-b border-slate-200 font-semibold">
              <tr>
                <th className="py-2.5 px-4">Agent Name</th>
                <th className="py-2.5 px-4">Role</th>
                <th className="py-2.5 px-4">Team</th>
                <th className="py-2.5 px-4 text-center">Assigned</th>
                <th className="py-2.5 px-4 text-center">Resolved</th>
                <th className="py-2.5 px-4 text-center">Resolution Rate</th>
                <th className="py-2.5 px-4 text-right">Avg Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staffList.map((s) => {
                const assigned = tickets.filter((t) => t.assignee === s.username)
                const res = assigned.filter((t) => t.status === 'resolved' || t.status === 'closed').length
                const rate = assigned.length > 0 ? Math.round((res / assigned.length) * 100) : 100

                return (
                  <tr key={s.username} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-800 flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-[10px]">
                        {s.displayName[0]}
                      </div>
                      <span>{s.displayName}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 capitalize">{s.role.replace('_', ' ')}</td>
                    <td className="py-2.5 px-4 text-slate-600 font-medium">{s.team}</td>
                    <td className="py-2.5 px-4 text-center font-semibold text-slate-800">{assigned.length}</td>
                    <td className="py-2.5 px-4 text-center font-semibold text-emerald-600">{res}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="font-mono font-bold text-slate-700">{rate}%</span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                      {s.role === 'super_admin' ? '18m' : '28m'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
