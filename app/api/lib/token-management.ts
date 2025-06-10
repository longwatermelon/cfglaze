import { kv } from '@vercel/kv'

// Global token tracking constants
export const MAX_DAILY_TOKENS = 2000000 // 2M tokens daily limit
export const TOKEN_KEY = 'global_tokens_used_v3'

// Short-term cache in KV to ensure read-after-write consistency
const CACHE_KEY = 'global_tokens_cache_v3'
const CACHE_TTL = 5 // 5 seconds - shorter for production

export async function getGlobalTokensUsed(): Promise<number> {
  try {
    // Check if we have a recent cached value first (optimistic local state)
    const cached = await kv.get(CACHE_KEY) as { value: number; timestamp: number } | null
    if (cached && (Date.now() - cached.timestamp) < (CACHE_TTL * 1000)) {
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
          attempts++
          if (attempts >= maxAttempts) {
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
          return 0
        }
        await new Promise(resolve => setTimeout(resolve, 100 * attempts))
      }
    }
    
    return 0
  } catch (error) {
    return 0
  }
}

export async function incrementGlobalTokensKV(tokensUsed: number): Promise<number> {
  try {
    let newTotal: number
    let attempts = 0
    const maxAttempts = 3
    
    while (attempts < maxAttempts) {
      try {
        // Read-Modify-Write pattern
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
          return newTotal
        } else {
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
    throw error
  }
}

export async function backgroundReconciliation(): Promise<void> {
  try {
    // Clear cache to force fresh read from database
    await kv.del(CACHE_KEY)
    
    // Get fresh value from database
    const dbValue = await kv.get(TOKEN_KEY) as number | null
    
    if (dbValue !== null && typeof dbValue === 'number') {
      // Update cache with fresh value
      await kv.set(CACHE_KEY, { value: dbValue, timestamp: Date.now() }, { ex: CACHE_TTL })
    } else {
      await kv.set(TOKEN_KEY, 0)
      await kv.set(CACHE_KEY, { value: 0, timestamp: Date.now() }, { ex: CACHE_TTL })
    }
  } catch (error) {
    // Silent failure for background task
  }
}

export async function checkGlobalTokenLimit(estimatedTokens: number): Promise<{ allowed: boolean; message?: string }> {
  const currentTokens = await getGlobalTokensUsed()
  
  if (currentTokens + estimatedTokens > MAX_DAILY_TOKENS) {
    return { 
      allowed: false, 
      message: `Daily token limit reached. Please try again tomorrow. Used: ${currentTokens}/${MAX_DAILY_TOKENS}` 
    }
  }
  
  return { allowed: true }
}