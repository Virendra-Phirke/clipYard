import 'server-only'

import { jwtVerify, SignJWT } from 'jose'

export type RoomTokenPayload = {
  roomId: string
  role: 'host' | 'participant'
  sid: string
}

function getRoomTokenSecret() {
  const secret = process.env.FIREBASE_PRIVATE_KEY?.trim()
  if (!secret) throw new Error('Room token secret is not configured')
  return new TextEncoder().encode(secret)
}

export async function signRoomToken(payload: RoomTokenPayload) {
  return new SignJWT({ roomId: payload.roomId, role: payload.role, sid: payload.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(getRoomTokenSecret())
}

export async function verifyRoomToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, getRoomTokenSecret())
    const roomId = typeof payload.roomId === 'string' ? payload.roomId : ''
    const role = payload.role === 'host' || payload.role === 'participant' ? payload.role : ''
    const sid = typeof payload.sid === 'string' ? payload.sid : ''
    if (!roomId || !role || !sid) return null
    return { roomId, role, sid }
  } catch {
    return null
  }
}
