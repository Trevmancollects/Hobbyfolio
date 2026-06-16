import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check plan — scanner is Pro+
  const { data: profile } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
  if (profile?.plan === 'free') return NextResponse.json({ error: 'Upgrade to Pro to use the card scanner' }, { status: 403 })

  const { imageBase64, mediaType } = await req.json()
  const msg = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: `Analyze this sports card/slab photo. Return ONLY valid JSON with no markdown:
{"player":"","year":"","set":"","cardNum":"","parallel":"","grade":"","certNum":"","condition":"Raw or Graded","notes":""}` }
      ]
    }]
  })
  const text = msg.content.find(b => b.type === 'text')?.text ?? ''
  try { return NextResponse.json(JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, '').trim())) }
  catch { return NextResponse.json({ error: 'Could not parse card' }, { status: 422 }) }
}
