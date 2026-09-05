import React, { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return (
      localStorage.getItem('ryzendesk_theme') === 'dark' ||
      (!localStorage.getItem('ryzendesk_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
    )
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('ryzendesk_theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('ryzendesk_theme', 'light')
    }
  }, [isDark])

  return (
    <button
      onClick={() => setIsDark((prev) => !prev)}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex items-center justify-center border border-slate-200/70"
    >
      {isDark ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-600" />}
    </button>
  )
}
