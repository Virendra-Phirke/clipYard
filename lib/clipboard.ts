export const MAX_CLIPBOARD_LENGTH = 100_000
export const ROOM_ID_PATTERN = /^[a-z0-9]{8}$/

export function isValidRoomId(value: string) {
  return ROOM_ID_PATTERN.test(value.trim().toLowerCase())
}

export function normalizeRoomId(value: string) {
  return value.trim().toLowerCase()
}

export function sanitizeClipboard(value: string) {
  return value.slice(0, MAX_CLIPBOARD_LENGTH)
}

export function createRoomId() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 8)
}

export function getRoomUrl(roomId: string) {
  if (typeof window === 'undefined') return `/room/${roomId}`
  return `${window.location.origin}/room/${roomId}`
}
