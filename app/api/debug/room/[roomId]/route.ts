import { NextResponse } from 'next/server'
import { getFirebaseAdmin } from '@/lib/firebase-admin'

export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  try {
    const roomId = String(params.roomId || '').toLowerCase()
    const { database } = getFirebaseAdmin()
    const snap = await database.ref(`rooms/${roomId}`).get()
    const val = snap.val()
    if (!val) return NextResponse.json({ exists: false })
    return NextResponse.json({ exists: true, meta: val.meta || null, clip: val.clip || null, presence: val.presence || null })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
