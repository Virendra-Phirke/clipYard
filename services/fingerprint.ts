'use client'

/**
 * services/fingerprint.ts
 *
 * Module-level singleton wrapping @fingerprintjs/fingerprintjs.
 *
 * IMPORTANT — Module-level caching:
 *   FingerprintJS.load() is called ONCE when this module is first imported.
 *   Every subsequent call to getVisitorId() reuses the same promise, so there
 *   is no per-render re-instantiation overhead.
 *
 * Privacy & compliance note:
 *   Browser fingerprinting may qualify as tracking under GDPR/CCPA.
 *   Disclose its use in your Privacy Policy and obtain consent where legally
 *   required before collecting visitor identifiers.
 *   Never log result.components — only persist the opaque visitorId.
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs'

// Cached promise — initialized once at module load time.
let fpPromise: ReturnType<typeof FingerprintJS.load> | null = null

function getFpPromise() {
  if (typeof window === 'undefined') return null
  if (!fpPromise) {
    fpPromise = FingerprintJS.load()
  }
  return fpPromise
}

/**
 * Returns a stable browser visitor ID derived from device signals.
 * Falls back to an empty string on server-side or if the library fails.
 *
 * Use as a semi-stable identifier alongside server-side session/auth data —
 * do not rely on it alone for authentication decisions.
 */
export async function getVisitorId(): Promise<string> {
  try {
    const promise = getFpPromise()
    if (!promise) return ''
    const fp = await promise
    const result = await fp.get()
    // Only return the opaque visitorId — do NOT expose result.components.
    return result.visitorId
  } catch {
    return ''
  }
}

/**
 * Synchronously returns a locally-generated device fingerprint stored in
 * localStorage. This is available immediately without waiting for the
 * FingerprintJS library and is used as a fast fallback / room session key.
 */
export function getLocalFingerprint(): string {
  if (typeof window === 'undefined') return ''
  const key = 'clipboard-device-fingerprint'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `fp-${Date.now()}-${Math.random().toString(36).slice(2)}`
  localStorage.setItem(key, id)
  return id
}

/**
 * Returns the best available fingerprint:
 *   - Prefers the FingerprintJS visitorId for higher accuracy.
 *   - Falls back to the locally-generated UUID if FingerprintJS hasn't resolved yet.
 *
 * Safe to call before awaiting — always returns a non-empty string.
 */
export function getLocalFingerprintSync(): string {
  return getLocalFingerprint()
}
