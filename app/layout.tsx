import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CardPulse — Sports Card Business Manager',
  description: 'Track inventory, P&L, taxes, and grading ROI for your card business.',
  manifest: '/manifest.json',
  themeColor: '#0a0f1e',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'CardPulse' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-200 antialiased">
        {children}
      </body>
    </html>
  )
}
