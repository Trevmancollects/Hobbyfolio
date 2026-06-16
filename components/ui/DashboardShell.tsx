'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

const NAV = [
  { href: '/dashboard',            label: 'Dashboard',    icon: '▦' },
  { href: '/dashboard/inventory',  label: 'Inventory',    icon: '⊞' },
  { href: '/dashboard/transactions', label: 'Transactions', icon: '⇄' },
  { href: '/dashboard/pnl',        label: 'P&L',          icon: '∿' },
  { href: '/dashboard/tax',        label: 'Tax Center',   icon: '%' },
  { href: '/dashboard/tools',      label: 'Tools',        icon: '⚙' },
  { href: '/dashboard/journal',    label: 'Journal',      icon: '✎' },
  { href: '/dashboard/billing',    label: 'Billing',      icon: '💳' },
]

export default function DashboardShell({
  children, user, profile
}: {
  children: React.ReactNode
  user: User
  profile: Record<string, unknown> | null
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const plan = (profile?.plan as string) ?? 'free'

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:sticky top-0 h-screen z-30 flex flex-col bg-slate-900 border-r border-slate-800 transition-transform duration-200 w-56',
        open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-800">
          <div className="holo-border w-9 h-9 rounded-xl p-[1.5px] flex-shrink-0">
            <div className="bg-slate-900 rounded-lg w-full h-full flex items-center justify-center text-lg">🃏</div>
          </div>
          <div>
            <div className="font-bold text-white text-sm">CardPulse</div>
            <div className={cn('text-xs capitalize font-medium',
              plan === 'pro' ? 'text-blue-400' : plan === 'business' ? 'text-purple-400' : 'text-slate-500'
            )}>{plan}</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                pathname === n.href
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              )}>
              <span className="text-base">{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className="text-xs text-slate-500 truncate">{user.email}</div>
          <button onClick={signOut} className="w-full text-left text-xs text-slate-500 hover:text-slate-300 cursor-pointer transition-colors">
            Sign out
          </button>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setOpen(false)}/>}

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="holo-border w-7 h-7 rounded-lg p-[1px]">
            <div className="bg-slate-900 rounded-md w-full h-full flex items-center justify-center text-sm">🃏</div>
          </div>
          <span className="font-bold text-white text-sm">CardPulse</span>
        </div>
        <button onClick={() => setOpen(o => !o)} className="text-slate-400 text-xl cursor-pointer">☰</button>
      </div>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-x-hidden lg:pt-0 pt-14">
        <div className="max-w-6xl mx-auto px-4 py-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
