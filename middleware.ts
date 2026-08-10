import { NextRequest, NextResponse } from 'next/server'

/**
 * middleware.ts
 *
 * Next.js Edge Middleware that runs on every matched request.
 *
 * Responsibilities:
 *   1. Attach OWASP-recommended security headers to all responses.
 *   2. Apply a sliding-window IP rate limiter on sensitive API endpoints
 *      to mitigate brute-force attacks and room-flooding abuse.
 *
 * Rate limiting uses an in-memory Map (per Edge worker instance).
 * For production deployments with multiple workers, replace with an
 * external store (e.g., Upstash Redis via @upstash/ratelimit).
 */

// ─── Rate limiter ─────────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number
  windowStart: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

const RATE_LIMITED_PATHS = ['/api/rooms/join', '/api/rooms']

// Allow at most LIMIT requests per WINDOW_MS per IP on rate-limited endpoints.
const LIMIT = 20
const WINDOW_MS = 60_000 // 1 minute

function isRateLimited(ip: string, path: string): boolean {
  // Only apply rate limiting to the specified paths (exact or prefix match).
  if (!RATE_LIMITED_PATHS.some((p) => path === p || path.startsWith(p + '/'))) {
    return false
  }

  const now = Date.now()
  const key = `${ip}:${path}`
  const entry = rateLimitStore.get(key)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    // New window.
    rateLimitStore.set(key, { count: 1, windowStart: now })
    return false
  }

  entry.count += 1
  if (entry.count > LIMIT) return true

  return false
}

// Periodically prune stale entries to prevent memory growth.
// Edge runtime doesn't support setInterval — we prune inline every ~100 checks.
let pruneCounter = 0
function maybePrune() {
  if (++pruneCounter < 100) return
  pruneCounter = 0
  const now = Date.now()
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowStart > WINDOW_MS * 2) {
      rateLimitStore.delete(key)
    }
  }
}

// ─── Security headers ─────────────────────────────────────────────────────────

function applySecurityHeaders(response: NextResponse): NextResponse {
  const h = response.headers

  // Prevent clickjacking.
  h.set('X-Frame-Options', 'DENY')

  // Stop browsers from MIME-sniffing the content type.
  h.set('X-Content-Type-Options', 'nosniff')

  // Control referrer information sent with requests.
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Restrict browser feature access.
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Enforce HTTPS for 1 year (only effective in production over HTTPS).
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

  // Basic Content-Security-Policy. Tighten further in production by removing
  // 'unsafe-inline' once all inline styles are moved to CSS modules / classes.
  h.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com",
      "frame-ancestors 'none'",
    ].join('; '),
  )

  return response
}

// ─── Middleware entry point ───────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  maybePrune()

  const { pathname } = request.nextUrl

  // Determine the real client IP (works behind Vercel / standard proxies).
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '0.0.0.0'

  // Rate-limit check.
  if (isRateLimited(ip, pathname)) {
    return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'content-type': 'application/json',
        'retry-after': '60',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  const response = NextResponse.next()
  return applySecurityHeaders(response)
}

export const config = {
  // Apply middleware to all routes except Next.js internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
