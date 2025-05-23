import { NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const TOKEN_KEY = 'global_tokens_used'

export async function GET() {
  try {
    const tokens = await kv.get(TOKEN_KEY)
    const totalTokensToday = typeof tokens === 'number' ? tokens : 0
    
    return NextResponse.json({
      totalTokensToday,
      maxTokens: 1900000
    })
    
  } catch (error) {
    console.error('Error getting token count:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 