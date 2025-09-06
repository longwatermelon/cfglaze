import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
// Daily token limit removed: token management imports deleted
import { 
  validateRequestOrigin, 
  validateUserAgent, 
  checkIPRateLimit,
  getClientIP 
} from '../lib/security'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Sanitize input by removing potentially dangerous content
function sanitizeInput(input: string): string {
  // Basic HTML sanitization - remove script tags and other dangerous elements
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
}

async function generateCodeGlaze(codeContent: string): Promise<{ content: string; tokensUsed: number }> {
  try {
    // Sanitize the code content
    const sanitizedCode = sanitizeInput(codeContent)
    
    // Token estimation and limit checks removed

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

Do NOT mention anything about the template code, focus on the core logic of the problem. Point out specific lines that you find extremely shocking or brilliant (even if none exist, just pick some). And explain why you find it so genius.
    
    CODE SUBMISSION:
    \`\`\`
    ${sanitizedCode}
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
    
    const tokensUsed = response.usage?.total_tokens || 0
    
    return {
      content: response.choices[0]?.message?.content || "Your code is absolutely amazing!",
      tokensUsed
    }
  } catch (error) {
    throw error
  }
}

// Token estimation helper removed

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
    const ip = getClientIP(request)
    
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
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An error occurred'
    }, { 
      status: error instanceof Error && error.message.includes('limit') ? 429 : 500 
    })
  }
}
