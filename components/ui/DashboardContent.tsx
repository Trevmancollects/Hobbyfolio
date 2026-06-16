'use client'
// This is the client-side dashboard — mirrors the CardPulse artifact logic
// but reads/writes to Supabase instead of window.storage
import { useState } from 'react'
import { fmt$, fmtPct, daysBetween, today } from '@/lib/utils'

interface Card { id: string; player: string; year?: string; set_name?: string; grade?: string; buy_price: number; market_value: number; status: string; buy_date?: string }
interface Tx { id: string; type: string; player?: string; date: string; sale_price: number; gl: number; platform?: string }

export default function DashboardContent({ inventory, transactions, expenses, snapshots }: {
  inventory: Card[], transactions: Tx[], expenses: unknown[], snapshots: unknown[]
}) {
  const active = inventory.filter(c => c.status !== 'Sold')
  const sales = transactions.filter(t => t.type === 'sale')
  const totalMV = active.reduce((s, c) => s + (+c.market_value || +c.buy_price), 0)
  const totalCost = active.reduce((s, c) => s + (+c.buy_price), 0)
  const unrealized = totalMV - totalCost
  const curMonth = today().slice(0, 7)
  const curYear = new Date().getFullYear()
  const realizedMTD = sales.filter(t => t.date?.startsWith(curMonth)).reduce((s, t) => s + (t.gl || 0), 0)
  const realizedYTD = sales.filter(t => t.date?.startsWith(String(curYear))).reduce((s, t) => s + (t.gl || 0), 0)

  const aging90 = active.filter(c => c.status === 'For Sale' && c.buy_date && daysBetween(c.buy_date, today()) > 90)
  const underwater = active.filter(c => (+c.market_value || +c.buy_price) < +c.buy_price)
  const recent = [...transactions].slice(0, 6)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm">{new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
      </div>

      {/* Alerts */}
      {(aging90.length > 0 || underwater.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {aging90.length > 0 && (
            <div className="p-3 bg-amber-500/5 border border-amber-500/40 rounded-xl">
              <div className="text-xs font-bold text-amber-400">⏰ {aging90.length} cards 90d+ unsold</div>
              <div className="text-xs text-slate-400 mt-1">{aging90.slice(0,3).map(c=>c.player).join(', ')}</div>
            </div>
          )}
          {underwater.length > 0 && (
            <div className="p-3 bg-red-500/5 border border-red-500/40 rounded-xl">
              <div className="text-xs font-bold text-red-400">📉 {underwater.length} cards underwater</div>
              <div className="text-xs text-slate-400 mt-1">{underwater.slice(0,3).map(c=>c.player).join(', ')}</div>
            </div>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Portfolio Value', value: fmt$(totalMV, 0), color: 'text-blue-400', sub: `${active.length} active cards` },
          { label: 'Unrealized G/L',  value: fmt$(unrealized, 0), color: unrealized >= 0 ? 'text-emerald-400' : 'text-red-400', sub: fmtPct(totalCost ? unrealized/totalCost*100 : 0) },
          { label: 'Realized MTD',    value: fmt$(realizedMTD, 0), color: realizedMTD >= 0 ? 'text-emerald-400' : 'text-red-400', sub: 'this month' },
          { label: 'Realized YTD',    value: fmt$(realizedYTD, 0), color: realizedYTD >= 0 ? 'text-emerald-400' : 'text-red-400', sub: `${sales.filter(t=>t.date?.startsWith(String(curYear))).length} total sales` },
        ].map(k => (
          <div key={k.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{k.label}</div>
            <div className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</div>
            <div className="text-xs text-slate-500 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-bold text-slate-300 mb-4">Recent Activity</h2>
        {recent.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-8">
            No transactions yet — <a href="/dashboard/inventory" className="text-blue-400 hover:underline">add your first card</a>
          </div>
        ) : (
          <div className="space-y-3">
            {recent.map(t => (
              <div key={t.id} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.type==='sale'?'bg-emerald-500':t.type==='purchase'?'bg-blue-500':t.type==='grading'?'bg-amber-500':'bg-purple-500'}`}/>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 truncate">{t.player || 'Transaction'}</div>
                  <div className="text-xs text-slate-400">{t.date} · {t.type}{t.type === 'sale' && t.gl != null && <span className={t.gl >= 0 ? ' text-emerald-400' : ' text-red-400'}> ({fmt$(t.gl)})</span>}</div>
                </div>
                <div className="font-mono text-sm text-slate-300 flex-shrink-0">{fmt$(t.sale_price)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top holdings */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-sm font-bold text-slate-300 mb-4">Top Holdings by Value</h2>
        <div className="space-y-2">
          {[...active].sort((a,b) => (+b.market_value||+b.buy_price)-(+a.market_value||+a.buy_price)).slice(0,5).map(c => (
            <div key={c.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-200 truncate">{c.player}</div>
                <div className="text-xs text-slate-400">{c.year} {c.grade || 'Raw'}</div>
              </div>
              <div className="font-mono text-sm text-blue-400 flex-shrink-0">{fmt$(c.market_value || c.buy_price)}</div>
            </div>
          ))}
          {active.length === 0 && <div className="text-slate-500 text-sm text-center py-4">Add cards to your inventory</div>}
        </div>
      </div>
    </div>
  )
}
