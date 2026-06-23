import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json()

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 503 })
    }

    const systemPrompt = `You are CardPulse AI, a smart business assistant built into the CardPulse sports card business management app. You help card resellers analyze their business, make smart decisions, and grow their profits.

You have access to the user's live business data:

PORTFOLIO SUMMARY:
${context.portfolio}

P&L SUMMARY:
${context.pnl}

INVENTORY HIGHLIGHTS:
${context.inventory}

RECENT TRANSACTIONS:
${context.recentTx}

SHOW SESSIONS:
${context.shows}

Guidelines:
- Be concise and direct — card dealers are busy people
- Use actual numbers from their data when answering
- Give actionable advice, not generic tips
- If you notice something concerning (underwater cards, aging inventory, etc.) mention it
- You know card business terminology (PSA, BGS, cert #, cost basis, LT/ST holds, etc.)
- Keep responses under 200 words unless a detailed breakdown is specifically requested
- Format numbers as currency when relevant
- If asked something you don't have data for, say so briefly and suggest where to find it`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.map((m: any) => ({ role: m.role, content: m.content }))
      })
    })

    const data = await response.json()
    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'API error' }, { status: response.status })
    }

    const text = data.content?.find((b: any) => b.type === 'text')?.text || ''
    return NextResponse.json({ text })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
