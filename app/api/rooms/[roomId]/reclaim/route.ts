import { NextResponse } from 'next/server'
import { getFirebaseAdmin } from '@/lib/firebase-admin'
import { verifyRoomToken, signRoomToken } from '@/lib/room-token'

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') || ''
  const queryToken = new URL(request.url).searchParams.get('token') || ''
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return queryToken
}

export async function POST(request: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const roomId = String((await params).roomId || '').toLowerCase()
  const token = getBearerToken(request)
  const payload = await verifyRoomToken(token)
  if (!payload || payload.roomId !== roomId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const fingerprint = request.headers.get('x-device-fingerprint') || ''
  if (!fingerprint) return NextResponse.json({ error: 'Missing fingerprint' }, { status: 400 })

  const { database } = getFirebaseAdmin()
  const metaSnap = await database.ref(`rooms/${roomId}/meta`).get()
  const meta = metaSnap.val()
  if (!meta) return NextResponse.json({ error: 'That room is unavailable' }, { status: 404 })

  const presenceSnap = await database.ref(`rooms/${roomId}/presence`).get()
  const presence = presenceSnap.val() || {}

  // Find an existing presence entry that matches the fingerprint and was the
  // previously-recorded host (meta.hostUid). This proves the requester is the
  // original host returning from a refresh.
  let matched = false
  for (const [sid, entry] of Object.entries(presence)) {
    const e = entry as any
    if (String(e.fingerprint || '') === String(fingerprint) && String(sid) === String(meta.hostUid)) {
      matched = true
      break
    }
  }

  if (!matched) return NextResponse.json({ error: 'Host fingerprint mismatch' }, { status: 403 })

  // Reassign host to the current SID (the caller) and issue a host token.
  await database.ref(`rooms/${roomId}/meta/hostUid`).set(payload.sid)
  const newToken = await signRoomToken({ roomId, role: 'host', sid: payload.sid })
  return NextResponse.json({ token: newToken })
}
