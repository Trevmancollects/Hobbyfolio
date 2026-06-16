import { createBillingPortalSession } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('stripe_customer_id').eq('id', user.id).single()
  if (!profile?.stripe_customer_id) return NextResponse.json({ error: 'No billing account' }, { status: 400 })

  const session = await createBillingPortalSession(profile.stripe_customer_id, process.env.NEXT_PUBLIC_APP_URL!)
  return NextResponse.json({ url: session.url })
}
