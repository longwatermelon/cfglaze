import { NextRequest } from 'next/server'
import { kv } from '@vercel/kv'

// Get allowed origins from environment variables with fallback to hardcoded values
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim())
  }
  
  // Fallback to default origins
  return [
    'https://cfglaze.vercel.app',
    'https://codeforces-profile-glazer.vercel.app',
  ]
}

export function validateRequestOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  
  // Allow requests from localhost in development
  if (process.env.NODE_ENV === 'development') {
    return true // Always allow in development
  }
  
  // In production, validate against expected domains
  const allowedOrigins = getAllowedOrigins()
  
  // Check if request comes from an allowed origin
  if (origin && allowedOrigins.some(allowed => origin === allowed)) {
    return true
  }
  
  // Also check referer as backup
  if (referer && allowedOrigins.some(allowed => referer.startsWith(allowed))) {
    return true
  }
  
  return false
}

export function validateUserAgent(request: NextRequest): boolean {
  const userAgent = request.headers.get('user-agent')
  
  if (!userAgent) {
    return false
  }
  
  // Allow any user agent in development
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  
  // Block obvious bot patterns
  const botPatterns = [
    /curl/i,
    /wget/i,
    /python/i,
    /node/i,
    /axios/i,
    /fetch/i,
    /postman/i,
    /insomnia/i,
    /bot/i,
    /crawler/i,
    /spider/i,
    /script/i,
    /urllib/i,
    /requests/i,
  ]
  
  if (botPatterns.some(pattern => pattern.test(userAgent))) {
    return false
  }
  
  // Require browser-like user agents
  const browserPatterns = [
    /mozilla/i,
    /webkit/i,
    /chrome/i,
    /firefox/i,
    /safari/i,
    /edge/i,
    /mobile/i,
    /android/i,
    /iphone/i,
    /ipad/i,
  ]
  
  return browserPatterns.some(pattern => pattern.test(userAgent))
}

// Simple IP-based rate limiting using KV store
export async function checkIPRateLimit(ip: string): Promise<{ allowed: boolean; message?: string }> {
  // Skip IP rate limiting in development
  if (process.env.NODE_ENV === 'development') {
    return { allowed: true }
  }
  
  const now = Date.now()
  const windowMs = 24 * 60 * 60 * 1000 // 24 hours (1 day)
  const maxRequests = 50 // Max 50 requests per day per IP
  
  const key = `ip_limit:${ip}:${Math.floor(now / windowMs)}`
  
  try {
    const current = await kv.get(key) as number || 0
    
    if (current >= maxRequests) {
      return { 
        allowed: false, 
        message: 'Daily request limit exceeded for this IP. You can make 50 requests per day.' 
      }
    }
    
    // Increment counter with expiration
    await kv.set(key, current + 1, { ex: Math.ceil(windowMs / 1000) })
    
    return { allowed: true }
  } catch (error) {
    // Fail open - allow request if KV is down/full
    // Global token limit will still protect against abuse
    return { allowed: true }
  }
}

export function getClientIP(request: NextRequest): string {
  return request.ip || 
         request.headers.get('x-forwarded-for')?.split(',')[0] || 
         request.headers.get('x-real-ip') || 
         'unknown'
}
