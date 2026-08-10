import 'server-only'

import { jwtVerify, SignJWT } from 'jose'
import { getServerConfig } from '@/lib/config'

export type RoomTokenPayload = {
  roomId: string
  role: 'host' | 'participant'
  sid: string
}

function getRoomTokenSecret() {
  const { jwtSecret } = getServerConfig()
  return new TextEncoder().encode(jwtSecret)
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
    return { roomId, role, sid } as RoomTokenPayload
  } catch {
    return null
  }
}
