'use client'
import { useState } from 'react'

const PLANS = [
  { id:'pro', name:'Pro', monthly:9.99, yearly:79, features:['Unlimited cards','Full tax center + Schedule C','Slab scanner','Google Sheets import','Mileage log','Offer tracker + Journal','Cloud sync'] },
  { id:'business', name:'Business', monthly:19.99, yearly:159, features:['Everything in Pro','Multiple portfolios','Team member access','Priority support','Early access'] },
]

export default function BillingPage() {
  const [interval, setInterval] = useState<'monthly'|'yearly'>('monthly')
  const [loading, setLoading] = useState<string|null>(null)

  const subscribe = async (planId: string) => {
    setLoading(planId)
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planId, interval }),
    })
    const { url } = await res.json()
    if (url) window.location.href = url
    setLoading(null)
  }

  const openPortal = async () => {
    const res = await fetch('/api/billing-portal', { method: 'POST' })
    const { url } = await res.json()
    if (url) window.location.href = url
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-slate-400 text-sm mt-1">Upgrade to unlock unlimited cards, the slab scanner, and full tax tools.</p>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center gap-3">
        <span className={`text-sm ${interval==='monthly'?'text-white':'text-slate-500'}`}>Monthly</span>
        <button onClick={()=>setInterval(i=>i==='monthly'?'yearly':'monthly')}
          className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${interval==='yearly'?'bg-blue-600':'bg-slate-700'}`}>
          <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${interval==='yearly'?'translate-x-7':'translate-x-1'}`}/>
        </button>
        <span className={`text-sm ${interval==='yearly'?'text-white':'text-slate-500'}`}>Annual <span className="text-emerald-400 font-medium">Save 34%</span></span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Free */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="text-lg font-bold text-white mb-1">Free</div>
          <div className="text-3xl font-black text-white mb-4">$0</div>
          <ul className="space-y-2 mb-5">
            {['Up to 50 cards','Basic P&L','CSV import'].map(f=>(
              <li key={f} className="flex items-center gap-2 text-sm text-slate-300"><span className="text-slate-500">✓</span>{f}</li>
            ))}
          </ul>
          <div className="text-xs text-slate-500 text-center">Your current plan</div>
        </div>

        {PLANS.map(p=>(
          <div key={p.id} className="bg-blue-500/10 border border-blue-500/40 rounded-2xl p-5">
            <div className="text-lg font-bold text-white mb-1">{p.name}</div>
            <div className="text-3xl font-black text-white mb-1">
              ${interval==='yearly'?p.yearly:p.monthly}
              <span className="text-base font-normal text-slate-400">/{interval==='yearly'?'yr':'mo'}</span>
            </div>
            {interval==='yearly'&&<div className="text-xs text-emerald-400 mb-3">${(p.monthly*12-p.yearly).toFixed(0)} saved vs monthly</div>}
            <ul className="space-y-2 mb-5">
              {p.features.map(f=>(
                <li key={f} className="flex items-center gap-2 text-sm text-slate-300"><span className="text-emerald-400">✓</span>{f}</li>
              ))}
            </ul>
            <button onClick={()=>subscribe(p.id)} disabled={loading===p.id}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer">
              {loading===p.id?'Loading...':`Start ${p.name}`}
            </button>
          </div>
        ))}
      </div>

      <div className="pt-2">
        <button onClick={openPortal} className="text-sm text-slate-400 hover:text-slate-200 underline cursor-pointer">
          Manage subscription / View invoices
        </button>
      </div>
    </div>
  )
}
