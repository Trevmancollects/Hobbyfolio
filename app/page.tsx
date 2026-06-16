import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Nav */}
      <nav className="border-b border-slate-800 px-6 py-4 flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="holo-border w-9 h-9 rounded-xl p-[1.5px]">
            <div className="bg-slate-950 rounded-lg w-full h-full flex items-center justify-center text-lg">🃏</div>
          </div>
          <span className="font-bold text-xl text-white">CardPulse</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-slate-400 hover:text-white text-sm transition-colors">Sign In</Link>
          <Link href="/auth/signup" className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Start Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          Built for serious card resellers
        </div>
        <h1 className="text-5xl sm:text-6xl font-black text-white leading-tight mb-6">
          Your card business,<br/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
            finally organized
          </span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
          Inventory tracking, P&L dashboards, grading ROI calculator, tax center with Schedule C export — everything a card vendor needs in one place.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/auth/signup" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3.5 rounded-xl font-semibold text-lg transition-colors shadow-lg shadow-blue-500/20">
            Start Free — 50 cards
          </Link>
          <Link href="#pricing" className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-8 py-3.5 rounded-xl font-semibold text-lg transition-colors border border-slate-700">
            See Pricing
          </Link>
        </div>
        <p className="text-slate-600 text-sm mt-4">No credit card required · Free forever up to 50 cards</p>
      </section>

      {/* Feature grid */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            ['📊','Grading ROI Calculator','Enter a raw value, get a SUBMIT or PASS verdict based on gem rates, break-even analysis, and expected value across PSA 9/10 outcomes.'],
            ['💰','One-Click Sell Flow','Hit Sell on any card — auto-fills platform fees, calculates net proceeds and G/L, creates the transaction, and marks the card sold.'],
            ['📷','Slab Scanner','Photograph a PSA or BGS slab and Claude reads the label — player, year, set, grade, cert number all extracted automatically.'],
            ['%','Tax Center','Short vs long-term G/L split, collectibles 28% rate, mileage log at IRS rate, Schedule C export your accountant can use.'],
            ['🏪','Show Mode','Minimal fast-entry UI for buying at shows. Scan or type, enter price, next card.'],
            ['📥','Smart Import','Upload your existing Google Sheet, Card Ladder CSV, or Excel file. Smart Merge deduplicates across multiple uploads.'],
          ].map(([icon, title, desc]) => (
            <div key={title} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="text-2xl mb-3">{icon}</div>
              <div className="font-semibold text-white mb-2">{title}</div>
              <div className="text-sm text-slate-400 leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-4xl mx-auto px-6 pb-24">
        <h2 className="text-3xl font-bold text-white text-center mb-12">Simple pricing</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name:'Free', price:'$0', period:'forever', features:['Up to 50 cards','Basic inventory tracking','P&L dashboard','CSV import'], cta:'Get Started', href:'/auth/signup', highlight:false },
            { name:'Pro', price:'$9.99', period:'/month', features:['Unlimited cards','Full tax center + Schedule C','Slab scanner (AI)','Google Sheets import','Mileage log','Offer tracker + Journal','Cloud sync all devices'], cta:'Start Pro', href:'/auth/signup?plan=pro', highlight:true },
            { name:'Business', price:'$19.99', period:'/month', features:['Everything in Pro','Multiple portfolios','Team member access','Priority support','Early access to new features'], cta:'Start Business', href:'/auth/signup?plan=business', highlight:false },
          ].map(p => (
            <div key={p.name} className={`rounded-2xl p-6 border ${p.highlight ? 'border-blue-500/50 bg-blue-500/10' : 'border-slate-800 bg-slate-900'}`}>
              {p.highlight && <div className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wider">Most Popular</div>}
              <div className="text-xl font-bold text-white mb-1">{p.name}</div>
              <div className="mb-4"><span className="text-3xl font-black text-white">{p.price}</span><span className="text-slate-400 text-sm">{p.period}</span></div>
              <ul className="space-y-2 mb-6">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="text-emerald-400">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href={p.href} className={`block text-center py-2.5 rounded-lg font-medium text-sm transition-colors ${p.highlight ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-slate-500 text-sm mt-6">Annual billing saves 34% · Cancel anytime · 7-day free trial on paid plans</p>
      </section>

      <footer className="border-t border-slate-800 px-6 py-8 text-center text-slate-600 text-sm max-w-7xl mx-auto">
        © 2025 CardPulse · Built for card resellers, by a card reseller
      </footer>
    </div>
  )
}
