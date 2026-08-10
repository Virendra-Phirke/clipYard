/**
 * lib/config.ts
 *
 * Centralized configuration module. All process.env / NEXT_PUBLIC_* accesses
 * should go through this file so that missing vars are caught at startup, not
 * scattered silently across the codebase.
 *
 * Server-only vars are guarded by 'server-only' imports in their consumers.
 * Public vars (NEXT_PUBLIC_*) are safe to import in any module.
 */

// ─── Public / Client-safe config ────────────────────────────────────────────

export const publicConfig = {
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
  },
} as const

// ─── Server-only config ──────────────────────────────────────────────────────
// Import this only in server-side modules (API routes, Server Components).
// Next.js will tree-shake NEXT_PUBLIC_* at build time; the rest are runtime-only.

export function getServerConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY
  const privateKey = rawPrivateKey?.replace(/\\n/g, '\n') ?? ''

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing required Firebase server credentials. ' +
        'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in .env.local.',
    )
  }

  // ROOM_DATA_SECRET is preferred; fall back to derived key from private key
  // when not explicitly set (backwards compat).
  const roomDataSecret = process.env.ROOM_DATA_SECRET?.trim() || rawPrivateKey?.trim()
  if (!roomDataSecret) {
    throw new Error(
      'Missing ROOM_DATA_SECRET. ' +
        'Add ROOM_DATA_SECRET=<random-32-char-string> to .env.local.',
    )
  }

  // JWT_SECRET is preferred for signing room tokens.
  const jwtSecret = process.env.JWT_SECRET?.trim() || rawPrivateKey?.trim()
  if (!jwtSecret) {
    throw new Error(
      'Missing JWT_SECRET. ' +
        'Add JWT_SECRET=<random-32-char-string> to .env.local.',
    )
  }

  return {
    firebase: {
      projectId,
      clientEmail,
      privateKey,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? '',
    },
    roomDataSecret,
    jwtSecret,
  }
}
