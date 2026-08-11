/**
 * lib/webrtc/peerConnection.ts
 *
 * Factory for RTCPeerConnection instances with centralized ICE server config.
 * STUN/TURN servers are configured via environment variables so a TURN server
 * can be added without code changes.
 */

'use client'

function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = []

  const stunUrl = process.env.NEXT_PUBLIC_STUN_SERVER || 'stun:stun.l.google.com:19302'
  if (stunUrl) {
    servers.push({ urls: stunUrl })
  }

  const turnUrl = process.env.NEXT_PUBLIC_TURN_SERVER
  if (turnUrl) {
    const username = process.env.NEXT_PUBLIC_TURN_USERNAME || ''
    const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL || ''
    servers.push({ urls: turnUrl, username, credential })
  }

  // Always have at least the default Google STUN
  if (servers.length === 0) {
    servers.push({ urls: 'stun:stun.l.google.com:19302' })
  }

  return servers
}

/**
 * Creates a new RTCPeerConnection with the configured ICE servers.
 */
export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: getIceServers() })
}

/**
 * Checks whether the current browser supports the WebRTC APIs
 * required for P2P image sharing.
 */
export function isWebRTCSupported(): boolean {
  if (typeof window === 'undefined') return false
  return (
    typeof RTCPeerConnection !== 'undefined' &&
    typeof RTCDataChannel !== 'undefined'
  )
}
