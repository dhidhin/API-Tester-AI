/**
 * Sliding window in-memory rate limiter per IP/client
 */

interface RateLimitRecord {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitRecord>()

// Periodically clean up old entries
let lastCleanup = Date.now()
function cleanupExpired() {
  const now = Date.now()
  if (now - lastCleanup < 60000) return
  lastCleanup = now
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  resetInSeconds: number
}

export function checkRateLimit(
  clientIdentifier: string,
  limit = 60,
  windowMs = 60000
): RateLimitResult {
  cleanupExpired()

  const now = Date.now()
  const key = clientIdentifier || 'anonymous'
  const record = rateLimitStore.get(key)

  if (!record || record.resetTime < now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return {
      allowed: true,
      remaining: limit - 1,
      limit,
      resetInSeconds: Math.ceil(windowMs / 1000),
    }
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetInSeconds: Math.max(1, Math.ceil((record.resetTime - now) / 1000)),
    }
  }

  record.count++
  return {
    allowed: true,
    remaining: limit - record.count,
    limit,
    resetInSeconds: Math.max(1, Math.ceil((record.resetTime - now) / 1000)),
  }
}
