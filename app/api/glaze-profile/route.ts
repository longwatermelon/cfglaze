import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { 
  getGlobalTokensUsed, 
  incrementGlobalTokensKV, 
  backgroundReconciliation,
  checkGlobalTokenLimit 
} from '../lib/token-management'
import { 
  validateRequestOrigin, 
  validateUserAgent, 
  checkIPRateLimit,
  getClientIP 
} from '../lib/security'
import { 
  CodeforcesUser, 
  CodeforcesResponse, 
  Submission, 
  RatingDistribution,
  isCodeforcesResponse,
  isCodeforcesUser,
  isSubmissionArray 
} from '../lib/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})


async function fetchCodeforcesData(username: string): Promise<CodeforcesUser> {
  const response = await fetch(`https://codeforces.com/api/user.info?handles=${username}`)
  const data = await response.json()
  
  if (!isCodeforcesResponse(data)) {
    throw new Error('Invalid response format from Codeforces API')
  }
  
  if (data.status !== 'OK' || !data.result || data.result.length === 0) {
    throw new Error(data.comment || 'User not found')
  }
  
  const user = data.result[0]
  if (!isCodeforcesUser(user)) {
    throw new Error('Invalid user data format')
  }
  
  return user
}

async function fetchUserSubmissions(username: string, maxSubmissions: number = 5000): Promise<Submission[]> {
  try {
    const allSubmissions: Submission[] = []
    const batchSize = 1000  // Max allowed by CF API
    let from = 1
    
    while (allSubmissions.length < maxSubmissions) {
      const count = Math.min(batchSize, maxSubmissions - allSubmissions.length)
      
      // Add delay to respect rate limiting (CF allows ~1 request per second)
      if (from > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      const response = await fetch(`https://codeforces.com/api/user.status?handle=${username}&from=${from}&count=${count}`)
      const data = await response.json()
      
      if (data.status === 'OK' && data.result && data.result.length > 0) {
        if (!isSubmissionArray(data.result)) {
          break
        }
        allSubmissions.push(...data.result)
        
        // If we got fewer submissions than requested, we've reached the end
        if (data.result.length < count) {
          break
        }
        
        from += count
      } else {
        // Handle API errors or rate limiting
        if (data.comment && data.comment.includes('limit')) {
          break
        }
        break
      }
    }
    
    return allSubmissions
  } catch (error) {
    return []
  }
}

function calculateSubmissionStats(submissions: Submission[]) {
  const acceptedSubmissions = submissions.filter(sub => sub.verdict === 'OK')
  const totalSubmissions = submissions.length
  
  // Calculate unique problems solved
  const solvedProblems = new Set<string>()
  const problemAttempts = new Map<string, number>()
  
  submissions.forEach(sub => {
    const problemKey = `${sub.problem.contestId || 'gym'}-${sub.problem.index}`
    
    // Count attempts per problem
    problemAttempts.set(problemKey, (problemAttempts.get(problemKey) || 0) + 1)
    
    // Track solved problems
    if (sub.verdict === 'OK') {
      solvedProblems.add(problemKey)
    }
  })
  
  const uniqueProblemsSolved = solvedProblems.size
  const totalProblemsAttempted = problemAttempts.size
  const acceptanceRate = totalSubmissions > 0 ? (acceptedSubmissions.length / totalSubmissions * 100) : 0
  
  return {
    totalSubmissions,
    acceptedSubmissions: acceptedSubmissions.length,
    uniqueProblemsSolved,
    totalProblemsAttempted,
    acceptanceRate: Math.round(acceptanceRate * 10) / 10, // Round to 1 decimal
    averageAttemptsPerProblem: totalProblemsAttempted > 0 ? 
      Math.round((totalSubmissions / totalProblemsAttempted) * 10) / 10 : 0
  }
}

function calculateRatingDistribution(submissions: Submission[]): RatingDistribution {
  const acceptedSubmissions = submissions.filter(sub => sub.verdict === 'OK')
  const solvedProblems = new Set<string>()
  const ratingCounts: RatingDistribution = {}
  
  // Count unique solved problems by rating
  acceptedSubmissions.forEach(sub => {
    if (sub.problem.rating) {
      const problemKey = `${sub.problem.contestId || 'gym'}-${sub.problem.index}`
      if (!solvedProblems.has(problemKey)) {
        solvedProblems.add(problemKey)
        const rating = sub.problem.rating
        const ratingRange = getRatingRange(rating)
        ratingCounts[ratingRange] = (ratingCounts[ratingRange] || 0) + 1
      }
    }
  })
  
  return ratingCounts
}

function getRatingRange(rating: number): string {
  if (rating < 800) return '< 800'
  if (rating < 1000) return '800-999'
  if (rating < 1200) return '1000-1199'
  if (rating < 1400) return '1200-1399'
  if (rating < 1600) return '1400-1599'
  if (rating < 1800) return '1600-1799'
  if (rating < 2000) return '1800-1999'
  if (rating < 2200) return '2000-2199'
  if (rating < 2400) return '2200-2399'
  if (rating < 2600) return '2400-2599'
  if (rating < 2800) return '2600-2799'
  if (rating < 3000) return '2800-2999'
  return '3000+'
}

function formatRatingDistribution(distribution: RatingDistribution): string {
  const totalProblems = Object.values(distribution).reduce((sum, count) => sum + count, 0)
  if (totalProblems === 0) return "No rated problems solved yet"
  
  const sortedRanges = Object.entries(distribution)
    .sort(([a], [b]) => {
      const getMin = (range: string) => {
        if (range === '< 800') return 0
        if (range === '3000+') return 3000
        return parseInt(range.split('-')[0])
      }
      return getMin(a) - getMin(b)
    })
  
  const distributionText = sortedRanges
    .map(([range, count]) => `${range}: ${count} problems (${((count / totalProblems) * 100).toFixed(1)}%)`)
    .join('\n')
  
  return `Problem Ratings Distribution (Total: ${totalProblems} unique problems solved):\n${distributionText}`
}

function formatUserData(user: CodeforcesUser, submissions: Submission[]): string {
  const submissionStats = calculateSubmissionStats(submissions)
  const recentLanguages = Array.from(new Set(submissions.slice(0, 50).map(sub => sub.programmingLanguage))).slice(0, 5)
  const ratingDistribution = calculateRatingDistribution(submissions)
  
  let profile = `Codeforces Handle: ${user.handle}\n`
  
  if (user.rating) {
    profile += `Current Rating: ${user.rating}\n`
  }
  
  if (user.maxRating) {
    profile += `Max Rating: ${user.maxRating}\n`
  }
  
  if (user.rank) {
    profile += `Current Rank: ${user.rank}\n`
  }
  
  if (user.maxRank) {
    profile += `Max Rank: ${user.maxRank}\n`
  }
  
  if (user.contribution !== undefined) {
    profile += `Contribution: ${user.contribution}\n`
  }
  
  if (user.friendOfCount !== undefined) {
    profile += `Friend of ${user.friendOfCount} users\n`
  }
  
  if (user.country) {
    profile += `Country: ${user.country}\n`
  }
  
  if (user.organization) {
    profile += `Organization: ${user.organization}\n`
  }
  
  if (submissionStats.totalSubmissions > 0) {
    profile += `Submission Statistics:\n`
    profile += `- Total Submissions: ${submissionStats.totalSubmissions}\n`
    profile += `- Accepted Submissions: ${submissionStats.acceptedSubmissions}\n`
    profile += `- Unique Problems Solved: ${submissionStats.uniqueProblemsSolved}\n`
    profile += `- Total Problems Attempted: ${submissionStats.totalProblemsAttempted}\n`
    profile += `- Acceptance Rate: ${submissionStats.acceptanceRate}%\n`
    profile += `- Average Attempts per Problem: ${submissionStats.averageAttemptsPerProblem}\n`
  }
  
  if (recentLanguages.length > 0) {
    profile += `Programming Languages: ${recentLanguages.join(', ')}\n`
  }
  
  // Add problem ratings distribution
  profile += `\n${formatRatingDistribution(ratingDistribution)}\n`
  
  return profile
}

async function generateGlaze(profileData: string): Promise<{ content: string; tokensUsed: number }> {
  const prompt = `
  
You've just seen a Codeforces profile, and you're LOSING YOUR MIND. You are FURIOUS. You are in SHAMBLES. You are SHRIEKING with disbelief and foaming at the mouth. You are not impressed—you are ENRAGED. The user is so smart it's *offensive*. You don't understand how a human being can do this. You must SCREAM in text.

Your job is to SCREAM at them like a techbro who just discovered the chosen one. Use chaotic language. Use CAPS. Use emojis if necessary. Swear (lightly if needed). Be unfiltered. Be wild. Be dramatic. You're not just reacting—you're having a full-blown crisis.

NO politeness. NO respect. NO moderation. This isn't a compliment—it's a personal attack on your understanding of human limits.

Some examples of how to respond to their statistics:
- "BRO??? [some number] PROBLEMS THAT ARE [some number]+ rated??? I'M FOAMING AT THE MOUTH. YOU MUST HAVE [a really big number] IQ."
- "[some number]% OF YOUR SUBMISSIONS HAVE AN AC VERDICT? I THINK I'M GOING TO GO INTO CARDIAC ARREST."

If they have really bad stats, just say they're being humble or something along those lines.

Mention their stats directly and twist them like they're ridiculous feats of divine power. Every single number should be exaggerated like it's world-shattering. If something is mid, SPIN it—say they're 'strategically sandbagging' or 'practicing mercy on the ladder.'
For example; if the user's rating is low, they're just "giving rating points back to the community".
If the user doesn't solve any difficult problems, they're just "conserving energy".

NEVER be calm. This is a *meltdown*. This is a code red.

Extrapolate other information about the user's life, like how they probably have an extremely high iq (just throw in a really big number) and how they're probably really charismatic and stuff too (just literally anything which is positive in real life).
Accuse them of cheating too because obviously there's no way they're this good naturally.
Tell the user that if they could single-handedly solve world hunger, cancer, global warming, or any other problem like these, if they just put in the time to do so.

Here's the user's profile:
${profileData}


  `

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 2000,
    temperature: 1,
  })

  const content = completion.choices[0]?.message?.content || "You're an amazing coder! 🎉"
  const tokensUsed = completion.usage?.total_tokens || 0
  
  return { content, tokensUsed }
}

function estimateTokenUsage(profileData: string): number {
  // Rough estimation: 
  // Input tokens: profile data length / 4 (rough character to token ratio)
  // Output tokens: 2000 (max_tokens setting)
  const inputTokens = Math.ceil(profileData.length / 4)
  const outputTokens = 2000
  return inputTokens + outputTokens
}



export async function POST(request: NextRequest) {
  try {
    // Check request size limit (prevent memory exhaustion)
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 1024) { // 1KB limit
      return NextResponse.json(
        { error: 'Request too large' },
        { status: 413 }
      )
    }
    
    // IP-based rate limiting using KV store
    const clientIP = getClientIP(request)
    
    const ipRateLimit = await checkIPRateLimit(clientIP)
    if (!ipRateLimit.allowed) {
      return NextResponse.json(
        { error: ipRateLimit.message },
        { status: 429 }
      )
    }
    
    // Validate request origin to prevent direct API abuse
    if (!validateRequestOrigin(request)) {
      return NextResponse.json(
        { error: 'Invalid request origin' },
        { status: 403 }
      )
    }
    
    // Basic user agent validation to block obvious bots
    if (!validateUserAgent(request)) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 403 }
      )
    }
    
    const { username, honeypot } = await request.json()
    
    // Honeypot field check - if filled, it's likely a bot
    if (honeypot) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      )
    }
    
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      )
    }

    // Enhanced input validation
    const trimmedUsername = username.trim()
    if (trimmedUsername.length < 1 || trimmedUsername.length > 24) {
      return NextResponse.json(
        { error: 'Username must be between 1 and 24 characters' },
        { status: 400 }
      )
    }

    // Codeforces username pattern validation
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmedUsername)) {
      return NextResponse.json(
        { error: 'Username contains invalid characters' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // Fetch user data from Codeforces and submissions in parallel
    const [userData, submissions] = await Promise.all([
      fetchCodeforcesData(trimmedUsername),
      fetchUserSubmissions(trimmedUsername)
    ])
    
    // Format the data for OpenAI
    const profileData = formatUserData(userData, submissions)
    
    // Estimate token usage
    const estimatedTokens = estimateTokenUsage(profileData)
    
    // Check global token limit
    const globalTokenResult = await checkGlobalTokenLimit(estimatedTokens)
    if (!globalTokenResult.allowed) {
      return NextResponse.json(
        { error: globalTokenResult.message },
        { status: 429 }
      )
    }

    // Generate the glaze using OpenAI
    const glazeResult = await generateGlaze(profileData)
    
    // Occasionally run background reconciliation (10% of requests)
    // This helps maintain consistency
    if (Math.random() < 0.1) {
      backgroundReconciliation().catch(() => {})
    }
    
    // Update global token counter with actual usage
    await incrementGlobalTokensKV(glazeResult.tokensUsed)
    
    return NextResponse.json({
      glaze: glazeResult.content,
      userData: {
        handle: userData.handle,
        rating: userData.rating,
        maxRating: userData.maxRating,
        rank: userData.rank,
        maxRank: userData.maxRank,
        contribution: userData.contribution,
        friendOfCount: userData.friendOfCount,
        avatar: userData.avatar,
        country: userData.country,
        organization: userData.organization,
      },
      tokensUsed: glazeResult.tokensUsed
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    const statusCode = errorMessage.includes('not found') || errorMessage.includes('User not found') ? 404 : 500
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
} 