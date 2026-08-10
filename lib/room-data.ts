import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { getServerConfig } from '@/lib/config'

const ALGORITHM = 'aes-256-gcm'

function getRoomDataKey(): Buffer {
  const { roomDataSecret } = getServerConfig()
  return createHash('sha256').update(roomDataSecret).digest()
}

export function encryptRoomText(value: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, getRoomDataKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return JSON.stringify({
    v: 1,
    iv: iv.toString('base64'),
    data: encrypted.toString('base64'),
    tag: tag.toString('base64'),
  })
}

export function decryptRoomText(value: string): string {
  if (!value) return ''
  try {
    const payload = JSON.parse(value) as { v?: number; iv?: string; data?: string; tag?: string }
    if (payload.v !== 1 || !payload.iv || payload.data === undefined || !payload.tag) return value
    const decipher = createDecipheriv(
      ALGORITHM,
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
    return ''
  }
}
