import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export const PLANS = {
  free: { name: 'Free', cardLimit: 50, price: 0 },
  pro: {
    name: 'Pro',
    cardLimit: Infinity,
    monthly: { priceId: process.env.STRIPE_PRICE_PRO_MONTHLY!, amount: 999 },
    yearly:  { priceId: process.env.STRIPE_PRICE_PRO_YEARLY!,  amount: 7900 },
  },
  business: {
    name: 'Business',
    cardLimit: Infinity,
    monthly: { priceId: process.env.STRIPE_PRICE_BUSINESS_MONTHLY!, amount: 1999 },
    yearly:  { priceId: process.env.STRIPE_PRICE_BUSINESS_YEARLY!,  amount: 15900 },
  },
}

export async function createCheckoutSession({
  customerId,
  priceId,
  userId,
  returnUrl,
}: {
  customerId?: string
  priceId: string
  userId: string
  returnUrl: string
}) {
  return stripe.checkout.sessions.create({
    customer: customerId,
    customer_creation: customerId ? undefined : 'always',
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${returnUrl}/dashboard?upgraded=1`,
    cancel_url: `${returnUrl}/dashboard/billing`,
    metadata: { userId },
    subscription_data: { metadata: { userId } },
    allow_promotion_codes: true,
  })
}

export async function createBillingPortalSession(customerId: string, returnUrl: string) {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${returnUrl}/dashboard/billing`,
  })
}
