'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name } }
    })
    if (error) { setError(error.message); setLoading(false) }
    else setDone(true)
  }

  if (done) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">📧</div>
        <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
        <p className="text-slate-400 text-sm">We sent a confirmation link to <strong className="text-slate-200">{email}</strong>. Click it to activate your account.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="holo-border w-12 h-12 rounded-2xl p-[1.5px] mx-auto mb-4">
            <div className="bg-slate-950 rounded-xl w-full h-full flex items-center justify-center text-2xl">🃏</div>
          </div>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 text-sm mt-1">Free forever up to 50 cards</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <form onSubmit={handleSignup} className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Full Name</label>
              <input type="text" value={name} onChange={e=>setName(e.target.value)} required
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-medium block mb-1">Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500"/>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer">
              {loading ? 'Creating account...' : 'Create Free Account'}
            </button>
            <p className="text-center text-xs text-slate-500">
              Already have an account? <Link href="/auth/login" className="text-blue-400">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
