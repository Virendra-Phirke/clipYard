/**
 * lib/webrtc/types.ts
 *
 * Shared TypeScript types and constants for the WebRTC image-transfer system.
 * Consumed by the core library, hooks, and UI components.
 */

// ─── Image validation constants ─────────────────────────────────────────────

export const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/svg+xml',
])

/** Maximum image size in bytes (10 MB). */
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024

/** Chunk size for DataChannel binary transfer (16 KB). */
export const CHUNK_SIZE = 16 * 1024

/**
 * Backpressure threshold in bytes. Pause sending when
 * `channel.bufferedAmount` exceeds this value.
 */
export const MAX_BUFFERED_AMOUNT = 1 * 1024 * 1024

// ─── Peer connection status ─────────────────────────────────────────────────

export type PeerStatus = 'connecting' | 'connected' | 'disconnected' | 'failed'

// ─── Transfer protocol messages (sent as JSON over DataChannel) ─────────────

export interface ImageTransferMetadata {
  type: 'image-start'
  transferId: string
  fileName: string
  mimeType: string
  size: number
  totalChunks: number
  senderName: string
}

export interface ImageChunkHeader {
  type: 'image-chunk'
  transferId: string
  index: number
}

export interface ImageTransferComplete {
  type: 'image-complete'
  transferId: string
}

export interface ImageTransferCancel {
  type: 'image-cancel'
  transferId: string
}

/** Discriminated union of all JSON control messages flowing through the DataChannel. */
export type DataChannelMessage =
  | ImageTransferMetadata
  | ImageChunkHeader
  | ImageTransferComplete
  | ImageTransferCancel

// ─── Local transfer state ───────────────────────────────────────────────────

export type TransferDirection = 'sent' | 'received'
export type TransferStatus = 'pending' | 'transferring' | 'completed' | 'failed' | 'cancelled'

export interface Transfer {
  id: string
  batchId?: string
  fileName: string
  fileSize: number
  mimeType: string
  direction: TransferDirection
  peerId: string
  peerName: string
  status: TransferStatus
  progress: number
  /** Object URL for completed received images. */
  objectUrl?: string
  /** Blob for completed received images (used for download). */
  blob?: Blob
  createdAt: number
  error?: string
}

// ─── WebRTC signaling messages (stored in Firebase) ─────────────────────────

export interface SignalingOffer {
  type: 'offer'
  sdp: string
}

export interface SignalingAnswer {
  type: 'answer'
  sdp: string
}

export interface SignalingCandidate {
  candidate: string
  sdpMid: string | null
  sdpMLineIndex: number | null
}

export type WebRTCSignalingMessage = SignalingOffer | SignalingAnswer | SignalingCandidate

// ─── Per-peer state tracked by useWebRTC ────────────────────────────────────

export interface PeerConnectionInfo {
  peerId: string
  peerName: string
  status: PeerStatus
  connection: RTCPeerConnection
  channel: RTCDataChannel | null
}
