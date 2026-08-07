import { NextResponse } from 'next/server'
import { getFirebaseAdmin } from '@/lib/firebase-admin'
import { isValidRoomId, normalizeRoomId } from '@/lib/clipboard'
import { signRoomToken } from '@/lib/room-token'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const roomId = normalizeRoomId(typeof body.roomId === 'string' ? body.roomId : '')
    if (!isValidRoomId(roomId)) return NextResponse.json({ error: 'Enter a valid room code' }, { status: 400 })
    const { auth, database } = getFirebaseAdmin()
    const snapshot = await database.ref(`rooms/${roomId}/meta`).get()
    const meta = snapshot.val()
    if (!meta || meta.status !== 'open') return NextResponse.json({ error: 'That room is unavailable' }, { status: 404 })
    const participantUid = crypto.randomUUID()
    return NextResponse.json({ roomId, token: await signRoomToken({ roomId, role: 'participant', sid: participantUid }), role: 'participant' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to join room' }, { status: 503 })
  }
}
