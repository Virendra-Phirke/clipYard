import { NextResponse } from 'next/server'
import { getFirebaseAdmin } from '@/lib/firebase-admin'
import { publicConfig } from '@/lib/config'

export async function GET() {
  try {
    const uid = `debug-${crypto.randomUUID()}`
    const { auth } = getFirebaseAdmin()
    const customToken = await auth.createCustomToken(uid)

    const apiKey = publicConfig.firebase.apiKey
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    })

    const body = await resp.json().catch(() => ({ error: 'invalid-json' }))
    return NextResponse.json({ status: resp.status, ok: resp.ok, body })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
