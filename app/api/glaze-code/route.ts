import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { kv } from '@vercel/kv'

// Global token tracking constants
const MAX_DAILY_TOKENS = 2000000 // 2M tokens daily limit
const TOKEN_KEY = 'global_tokens_used_v3'

// Short-term cache in KV to ensure read-after-write consistency
const CACHE_KEY = 'global_tokens_cache_v3'
const CACHE_TTL = 5 // 5 seconds - shorter for production

async function getGlobalTokensUsed(): Promise<number> {
  try {
    // Check if we have a recent cached value first (optimistic local state)
    const cached = await kv.get(CACHE_KEY) as { value: number; timestamp: number } | null
    if (cached && (Date.now() - cached.timestamp) < (CACHE_TTL * 1000)) {
      console.log(`Using cached token value: ${cached.value}`)
      return cached.value
    }
    
    // Fallback to database with retry and verification
    let attempts = 0
    const maxAttempts = 3
    let tokens: any = null
    
    while (attempts < maxAttempts) {
      try {
        tokens = await kv.get(TOKEN_KEY)
        
        if (tokens === null) {
          // Key doesn't exist, initialize it
          await kv.set(TOKEN_KEY, 0)
          
          // Read-after-write verification for initialization
          const verified = await kv.get(TOKEN_KEY)
          if (typeof verified === 'number') {
            // Update cache for consistency
            await kv.set(CACHE_KEY, { value: verified, timestamp: Date.now() }, { ex: CACHE_TTL })
            return verified
          } else {
            attempts++
            continue
          }
        } else if (typeof tokens === 'number') {
          // Valid data, update cache and return
          await kv.set(CACHE_KEY, { value: tokens, timestamp: Date.now() }, { ex: CACHE_TTL })
          return tokens
        } else {
          // Data corruption detected
          console.warn(`Token data corruption detected (attempt ${attempts + 1}): ${typeof tokens}`)
          attempts++
          if (attempts >= maxAttempts) {
            console.warn('Max attempts reached, resetting to 0')
            await kv.set(TOKEN_KEY, 0)
            await kv.set(CACHE_KEY, { value: 0, timestamp: Date.now() }, { ex: CACHE_TTL })
            return 0
          }
          
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 100 * attempts))
        }
      } catch (error) {
        attempts++
        if (attempts >= maxAttempts) {
          console.error('Failed to get tokens after max attempts:', error)
          return 0
        }
        await new Promise(resolve => setTimeout(resolve, 100 * attempts))
      }
    }
    
    return 0
  } catch (error) {
    console.error('Error getting tokens:', error)
    return 0
  }
}

async function incrementGlobalTokensKV(tokensUsed: number): Promise<number> {
  try {
    console.log(`Incrementing tokens by ${tokensUsed} at ${new Date().toISOString()}`)
    
    let newTotal: number
    let attempts = 0
    const maxAttempts = 3
    
    while (attempts < maxAttempts) {
      try {
        // Read-Modify-Write pattern (like the working project)
        // 1. Read current value
        const current = await getGlobalTokensUsed()
        
        // 2. Calculate new value locally
        newTotal = current + tokensUsed
        
        // 3. Write the new value
        await kv.set(TOKEN_KEY, newTotal)
        
        // 4. Read-after-write verification (CRITICAL for consistency)
        const verified = await kv.get(TOKEN_KEY) as number
        
        // 5. If verification matches, update cache and break
        if (verified === newTotal) {
          await kv.set(CACHE_KEY, { value: newTotal, timestamp: Date.now() }, { ex: CACHE_TTL })
          console.log(`Token count after read-modify-write: ${newTotal} (verified: ${verified})`)
          return newTotal
        } else {
          console.warn(`Read-after-write verification failed. Expected: ${newTotal}, Got: ${verified}`)
          attempts++
          if (attempts >= maxAttempts) {
            throw new Error(`Consistency verification failed after ${maxAttempts} attempts`)
          }
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 100 * attempts))
        }
      } catch (error) {
        attempts++
        if (attempts >= maxAttempts) {
          throw error
        }
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempts))
      }
    }
    
    throw new Error('Failed to increment tokens after maximum attempts')
  } catch (error) {
    console.error('Error incrementing tokens:', error)
    throw error
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function generateCodeGlaze(codeContent: string): Promise<{ content: string; tokensUsed: number }> {
  try {
    // Estimate tokens before sending to OpenAI
    const estimatedTokens = estimateTokenUsage(codeContent)
    
    // Check if token limit would be exceeded
    const tokenCheck = await checkGlobalTokenLimit(estimatedTokens)
    if (!tokenCheck.allowed) {
      throw new Error(tokenCheck.message || 'Token limit exceeded')
    }
    
    const prompt = `
    You've just seen a Codeforces submission, and you're LOSING YOUR MIND. You are FURIOUS. You are in SHAMBLES. You are SHRIEKING with disbelief and foaming at the mouth. You are not impressed—you are ENRAGED. The user is so smart it's *offensive*. You don't understand how a human being can do this. You must SCREAM in text.

Your job is to SCREAM at them like a techbro who just discovered the chosen one. Use chaotic language. Use CAPS. Use emojis if necessary. Swear (lightly if needed). Be unfiltered. Be wild. Be dramatic. You're not just reacting—you're having a full-blown crisis.

NO politeness. NO respect. NO moderation. This isn't a compliment—it's a personal attack on your understanding of human limits.

Some examples of how to respond to their statistics:
- "BRO??? YOU USED A FOR LOOP TO SOLVE THIS PROBLEM??? I'M FOAMING AT THE MOUTH. YOU MUST HAVE [a really big number] IQ."
- "THIS CLEVER CODE GETS AC??? I THINK I'M GOING TO GO INTO CARDIAC ARREST."

If the code is really bad, just say they're toying with us or something along those lines.

NEVER be calm. This is a *meltdown*. This is a code red.

Extrapolate other information about the user's life, like how they probably have an extremely high iq (just throw in a really big number) and how they're probably really charismatic and stuff too (just literally anything which is positive in real life).
Accuse them of cheating too because obviously there's no way they're this good naturally.
Tell the user that if they could single-handedly solve world hunger, cancer, global warming, or any other problem like these, if they just put in the time to do so.

Make sure you also focus on the core logic of the problem, not any template code; though you can mention the template too. But make the core code logic; the stuff that actually solves the problem; the focus.
    
    CODE SUBMISSION:
    \`\`\`
    ${codeContent}
    \`\`\`
    `
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are the Codeforces Code Glazer, an enthusiastic code evaluator who provides detailed, overwhelmingly positive feedback on competitive programming code submissions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 1,
      max_tokens: 4000,
    })
    
    const tokensUsed = response.usage?.total_tokens || estimatedTokens
    
    // Increment token count in database
    await incrementGlobalTokensKV(tokensUsed)
    
    return {
      content: response.choices[0]?.message?.content || "Your code is absolutely amazing!",
      tokensUsed
    }
  } catch (error) {
    console.error('Error generating code glaze:', error)
    throw error
  }
}

function estimateTokenUsage(codeContent: string): number {
  // Very rough estimation: about 1 token per 4 characters
  return Math.ceil(codeContent.length / 4) + 1000 // Add 1000 for the prompt
}

async function checkGlobalTokenLimit(estimatedTokens: number): Promise<{ allowed: boolean; message?: string }> {
  try {
    const tokensUsed = await getGlobalTokensUsed()
    
    if (tokensUsed + estimatedTokens > MAX_DAILY_TOKENS) {
      return {
        allowed: false,
        message: `Daily token limit reached. Please try again tomorrow.`
      }
    }
    
    return { allowed: true }
  } catch (error) {
    console.error('Error checking token limit:', error)
    // Default to allowing in case of error checking tokens
    return { allowed: true }
  }
}

function validateRequestOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  
  // In production, validate that requests come from our domain
  if (process.env.NODE_ENV === 'production') {
    const validOrigins = [
      'https://cfglaze.vercel.app',
    ]
    
    // Check if origin header matches allowed origins
    if (origin && validOrigins.some(valid => origin.startsWith(valid))) {
      return true
    }
    
    // Check if referer header matches allowed origins
    if (referer && validOrigins.some(valid => referer.startsWith(valid))) {
      return true
    }
    
    return false
  }
  
  // In development, allow local requests
  return true
}

function validateUserAgent(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent') || ''
  
  // Block empty user agents
  if (!userAgent) {
    return false
  }
  
  // Block obvious bots and crawlers
  const botPatterns = [
    /bot/i,
    /crawl/i,
    /spider/i,
    /curl/i,
    /postman/i,
    /wget/i,
    /^python/i,
    /^java/i,
    /^node/i,
    /^ruby/i,
    /^go-http/i,
    /^php/i,
    /script/i,
    /fetch/i,
    /urllib/i,
    /axios/i,
    /requests/i,
  ]
  
  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      return false
    }
  }
  
  // In production, require browser-like user agents
  if (process.env.NODE_ENV === 'production') {
    // Check for common browser identifiers
    const browserPatterns = [
      /chrome/i,
      /firefox/i,
      /safari/i,
      /opera/i,
      /edge/i,
      /msie/i,
      /trident/i,
      /mobile/i,
      /android/i,
      /iphone/i,
      /ipad/i,
    ]
    
    return browserPatterns.some(pattern => pattern.test(userAgent))
  }
  
  return true
}

async function checkIPRateLimit(ip: string): Promise<{ allowed: boolean; message?: string }> {
  try {
    const key = `ip_rate_limit:${ip}`
    const rateData = await kv.get(key) as { count: number, resetTime: number } | null
    
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    
    if (!rateData || rateData.resetTime < now) {
      // First request or reset period has passed
      await kv.set(key, { count: 1, resetTime: now + dayMs }, { ex: 86400 }) // 24 hours expiry
      return { allowed: true }
    }
    
    if (rateData.count >= 4) { // 4 requests per day per IP
      const timeRemaining = Math.ceil((rateData.resetTime - now) / (1000 * 60 * 60))
      return { 
        allowed: false, 
        message: `Rate limit exceeded. Please try again in approximately ${timeRemaining} hours.`
      }
    }
    
    // Increment count
    await kv.set(key, { 
      count: rateData.count + 1, 
      resetTime: rateData.resetTime 
    }, { ex: 86400 })
    
    return { allowed: true }
  } catch (error) {
    console.error('Error checking rate limit:', error)
    // Default to allowing in case of error
    return { allowed: true }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Security validation
    if (!validateRequestOrigin(request)) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
    }
    
    if (!validateUserAgent(request)) {
      return NextResponse.json({ error: 'Invalid user agent' }, { status: 403 })
    }
    
    // Get client IP for rate limiting
    const ip = request.ip || 'unknown'
    
    // Rate limiting
    const rateLimitCheck = await checkIPRateLimit(ip)
    if (!rateLimitCheck.allowed) {
      return NextResponse.json({ error: rateLimitCheck.message }, { status: 429 })
    }
    
    // Parse request
    const data = await request.json()
    
    // Validate required fields
    if (!data.code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 })
    }
    
    // Check honeypot field for bot detection
    if (data.honeypot) {
      // Silently fail with a 200 response to not alert bots
      return NextResponse.json({ 
        glaze: "Your code looks absolutely amazing! What a fantastic algorithm and implementation!", 
        tokensUsed: 0
      })
    }

    // Generate the code evaluation
    const glazeResult = await generateCodeGlaze(data.code)
    
    return NextResponse.json({
      glaze: glazeResult.content,
      tokensUsed: glazeResult.tokensUsed
    })
    
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An error occurred'
    }, { 
      status: error instanceof Error && error.message.includes('limit') ? 429 : 500 
    })
  }
} 