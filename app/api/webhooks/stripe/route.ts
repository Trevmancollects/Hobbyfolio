import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const upd = async (cid: string, data: Record<string, unknown>) =>
  admin.from('profiles').update(data).eq('stripe_customer_id', cid)

export async function POST(req: Request) {
  const body = await req.text()
  const sig = (await headers()).get('stripe-signature')!
  let event: Stripe.Event
  try { event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!) }
  catch { return NextResponse.json({ error: 'Bad signature' }, { status: 400 }) }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session
    if (s.metadata?.userId)
      await admin.from('profiles').update({
        stripe_customer_id: s.customer, stripe_subscription_id: s.subscription,
        subscription_status: 'active',
      }).eq('id', s.metadata.userId)
  }
  else if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const pid = sub.items.data[0]?.price.id
    const plan = [process.env.STRIPE_PRICE_PRO_MONTHLY, process.env.STRIPE_PRICE_PRO_YEARLY].includes(pid) ? 'pro'
               : [process.env.STRIPE_PRICE_BUSINESS_MONTHLY, process.env.STRIPE_PRICE_BUSINESS_YEARLY].includes(pid) ? 'business'
               : 'free'
    await upd(sub.customer as string, { plan, subscription_status: sub.status, stripe_subscription_id: sub.id })
  }
  else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    await upd(sub.customer as string, { plan: 'free', subscription_status: 'canceled', stripe_subscription_id: null })
  }
  else if (event.type === 'invoice.payment_failed') {
    const inv = event.data.object as Stripe.Invoice
    await upd(inv.customer as string, { subscription_status: 'past_due' })
  }
  return NextResponse.json({ ok: true })
}
