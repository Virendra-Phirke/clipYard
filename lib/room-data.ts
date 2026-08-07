import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ROOM_DATA_ALGORITHM = 'aes-256-gcm'

function getRoomDataSecret() {
  const secret = process.env.ROOM_DATA_SECRET?.trim() || process.env.FIREBASE_PRIVATE_KEY?.trim()
  if (!secret) throw new Error('Room data secret is not configured')
  return secret
}

function getRoomDataKey() {
  return createHash('sha256').update(getRoomDataSecret()).digest()
}

export function encryptRoomText(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ROOM_DATA_ALGORITHM, getRoomDataKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    v: 1,
    iv: iv.toString('base64'),
    data: encrypted.toString('base64'),
    tag: tag.toString('base64'),
  })
}

export function decryptRoomText(value: string) {
  if (!value) return ''

  try {
    const payload = JSON.parse(value) as { v?: number; iv?: string; data?: string; tag?: string }
    if (payload.v !== 1 || !payload.iv || payload.data === undefined || !payload.tag) return value

    const decipher = createDecipheriv(
      ROOM_DATA_ALGORITHM,
      getRoomDataKey(),
      Buffer.from(payload.iv, 'base64'),
    )
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.data, 'base64')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch {
    return value
  }
}
