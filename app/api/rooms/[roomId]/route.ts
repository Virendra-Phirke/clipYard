import { NextResponse } from 'next/server'
import { ServerValue } from 'firebase-admin/database'
import { getFirebaseAdmin } from '@/lib/firebase-admin'
import { sanitizeClipboard } from '@/lib/clipboard'
import { verifyRoomToken } from '@/lib/room-token'
import { decryptRoomText, encryptRoomText } from '@/lib/room-data'

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') || ''
  const queryToken = new URL(request.url).searchParams.get('token') || ''
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim()
  return queryToken
}

async function getRoomContext(request: Request, roomId: string) {
  const token = getBearerToken(request)
  const payload = await verifyRoomToken(token)
  if (!payload || payload.roomId !== roomId) return null
  return payload
}

export async function GET(request: Request, { params }: { params: { roomId: string } }) {
  const resolvedParams = await params
  const roomId = String(resolvedParams.roomId || '').toLowerCase()
  const payload = await getRoomContext(request, roomId)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { database } = getFirebaseAdmin()
  const roomSnapshot = await database.ref(`rooms/${roomId}`).get()
  const room = roomSnapshot.val()
  if (!room?.meta) {
    return NextResponse.json({ error: 'That room is unavailable' }, { status: 404 })
  }
  if (room.meta.status === 'closed') {
    return NextResponse.json({ roomId, status: 'closed', text: '', people: 0, role: payload.role })
  }

  const now = Date.now()
  const presence = room.presence || {}
  const people = Object.values(presence).filter((entry: any) => {
    const lastSeen = typeof entry?.lastSeen === 'number' ? entry.lastSeen : 0
    return now - lastSeen < 45000
  }).length || 1

  return NextResponse.json({
    roomId,
    status: room.meta.status,
    text: typeof room.clip?.text === 'string' ? decryptRoomText(room.clip.text) : '',
    people,
    role: payload.role,
  })
}

export async function PATCH(request: Request, { params }: { params: { roomId: string } }) {
  const resolvedParams = await params
  const roomId = String(resolvedParams.roomId || '').toLowerCase()
  const payload = await getRoomContext(request, roomId)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const nextText = sanitizeClipboard(typeof body.text === 'string' ? body.text : '')

  const { database } = getFirebaseAdmin()
  const roomSnapshot = await database.ref(`rooms/${roomId}/meta`).get()
  const meta = roomSnapshot.val()
  if (!meta || meta.status === 'closed') {
    return NextResponse.json({ error: 'That room is unavailable' }, { status: 404 })
  }

  await database.ref(`rooms/${roomId}/clip`).update({
    text: encryptRoomText(nextText),
    updatedAt: ServerValue.TIMESTAMP,
    updatedBy: payload.sid,
  })

  return NextResponse.json({ ok: true })
}

export async function POST(request: Request, { params }: { params: { roomId: string } }) {
  const resolvedParams = await params
  const roomId = String(resolvedParams.roomId || '').toLowerCase()
  const payload = await getRoomContext(request, roomId)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { database } = getFirebaseAdmin()
  await database.ref(`rooms/${roomId}/presence/${payload.sid}`).set({
    lastSeen: ServerValue.TIMESTAMP,
    role: payload.role,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request, { params }: { params: { roomId: string } }) {
  const resolvedParams = await params
  const roomId = String(resolvedParams.roomId || '').toLowerCase()
  const payload = await getRoomContext(request, roomId)
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { database } = getFirebaseAdmin()
  const roomSnapshot = await database.ref(`rooms/${roomId}/meta`).get()
  const meta = roomSnapshot.val()
  if (!meta) return NextResponse.json({ error: 'That room is unavailable' }, { status: 404 })

  if (payload.role !== 'host') {
    await database.ref(`rooms/${roomId}/presence/${payload.sid}`).remove()
    return NextResponse.json({ ok: true })
  }

  await database.ref(`rooms/${roomId}`).remove()

  return NextResponse.json({ ok: true })
}
