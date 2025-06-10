import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const TOKEN_KEY = 'global_tokens_used_v3'
const MAX_DAILY_TOKENS = 2000000 // 2M tokens daily limit

export async function GET(request: NextRequest) {
  try {
    // Simple token count retrieval
    const tokens = await kv.get(TOKEN_KEY) as number | null
    const totalTokensToday = tokens || 0
    
    return NextResponse.json({
      totalTokensToday,
      maxDailyTokens: MAX_DAILY_TOKENS,
      remainingTokens: Math.max(0, MAX_DAILY_TOKENS - totalTokensToday),
      percentageUsed: ((totalTokensToday / MAX_DAILY_TOKENS) * 100).toFixed(2),
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch token count' },
      { status: 500 }
    )
  }
} 