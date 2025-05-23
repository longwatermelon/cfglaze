import { NextRequest, NextResponse } from 'next/server'
import { kv } from '@vercel/kv'

const TOKEN_KEY = 'global_tokens_used'

export async function POST(request: NextRequest) {
  try {
    const { secret } = await request.json()
    
    if (!secret || typeof secret !== 'string') {
      return NextResponse.json(
        { error: 'Secret is required' },
        { status: 400 }
      )
    }

    // Check if the provided secret matches the environment variable
    if (!process.env.TOKEN_RESET_SECRET) {
      return NextResponse.json(
        { error: 'Reset secret not configured' },
        { status: 500 }
      )
    }

    if (secret !== process.env.TOKEN_RESET_SECRET) {
      return NextResponse.json(
        { error: 'Invalid secret' },
        { status: 401 }
      )
    }

    // Reset the global token counter
    await kv.set(TOKEN_KEY, 0)
    
    console.log('Global tokens reset via API endpoint')
    
    return NextResponse.json({
      success: true,
      message: 'Global tokens reset successfully',
      tokensUsed: 0
    })
    
  } catch (error) {
    console.error('Error in reset-tokens endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 