import { createCheckoutSession, PLANS } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan, interval } = await req.json()
  const planData = PLANS[plan as keyof typeof PLANS] as { monthly?: { priceId: string }, yearly?: { priceId: string } }
  if (!planData) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const priceId = interval === 'yearly' ? planData.yearly?.priceId : planData.monthly?.priceId
  if (!priceId) return NextResponse.json({ error: 'Invalid interval' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  const session = await createCheckoutSession({
    customerId: profile?.stripe_customer_id ?? undefined,
    priceId,
    userId: user.id,
    returnUrl: process.env.NEXT_PUBLIC_APP_URL!,
  })

  return NextResponse.json({ url: session.url })
}
