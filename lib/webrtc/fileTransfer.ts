/**
 * lib/webrtc/fileTransfer.ts
 *
 * Chunked file transfer engine for WebRTC DataChannel.
 *
 * Sending: slices a File into CHUNK_SIZE chunks with backpressure control.
 * Receiving: collects chunks keyed by transferId and reconstructs a Blob.
 */

'use client'

import {
  ALLOWED_IMAGE_TYPES,
  CHUNK_SIZE,
  MAX_BUFFERED_AMOUNT,
  MAX_IMAGE_SIZE,
  type ImageTransferMetadata,
  type ImageTransferComplete,
  type ImageTransferCancel,
  type ImageChunkHeader,
  type DataChannelMessage,
} from './types'
import { sendControlMessage } from './dataChannel'

// ─── Validation ─────────────────────────────────────────────────────────────

export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `Unsupported image type: ${file.type || 'unknown'}. Allowed: JPEG, PNG, WebP, GIF, BMP, SVG.`,
    }
  }
  if (file.size > MAX_IMAGE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    const limitMB = (MAX_IMAGE_SIZE / (1024 * 1024)).toFixed(0)
    return {
      valid: false,
      error: `Image is too large (${sizeMB} MB). Maximum allowed size is ${limitMB} MB.`,
    }
  }
  if (file.size === 0) {
    return { valid: false, error: 'Image file is empty.' }
  }
  return { valid: true }
}

// ─── Transfer ID ────────────────────────────────────────────────────────────

export function generateTransferId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// ─── Sending ────────────────────────────────────────────────────────────────

export interface SendFileOptions {
  channel: RTCDataChannel
  file: File
  transferId: string
  senderName: string
  onProgress?: (bytesSent: number, totalBytes: number) => void
  abortSignal?: AbortSignal
}

/**
 * Send a file over a DataChannel using chunked transfer with backpressure.
 *
 * Protocol:
 *   1. JSON metadata message (image-start)
 *   2. For each chunk: JSON header (image-chunk) + binary ArrayBuffer
 *   3. JSON completion message (image-complete)
 */
export async function sendFile({
  channel,
  file,
  transferId,
  senderName,
  onProgress,
  abortSignal,
}: SendFileOptions): Promise<void> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

  // 1. Send metadata
  const metadata: ImageTransferMetadata = {
    type: 'image-start',
    transferId,
    fileName: file.name || 'image',
    mimeType: file.type,
    size: file.size,
    totalChunks,
    senderName,
  }
  sendControlMessage(channel, metadata)

  // 2. Send chunks with backpressure
  const arrayBuffer = await file.arrayBuffer()
  let offset = 0
  let chunkIndex = 0

  while (offset < file.size) {
    // Check for cancellation
    if (abortSignal?.aborted) {
      const cancel: ImageTransferCancel = { type: 'image-cancel', transferId }
      sendControlMessage(channel, cancel)
      throw new DOMException('Transfer cancelled', 'AbortError')
    }

    // Check channel state
    if (channel.readyState !== 'open') {
      throw new Error('DataChannel closed during transfer')
    }

    // Backpressure: wait if buffer is too full
    if (channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      await waitForBufferDrain(channel)
    }

    const end = Math.min(offset + CHUNK_SIZE, file.size)
    const chunkData = arrayBuffer.slice(offset, end)

    // Send chunk header (JSON)
    const chunkHeader: ImageChunkHeader = {
      type: 'image-chunk',
      transferId,
      index: chunkIndex,
    }
    sendControlMessage(channel, chunkHeader)

    // Send chunk data (binary)
    channel.send(chunkData)

    offset = end
    chunkIndex++
    onProgress?.(offset, file.size)
  }

  // 3. Send completion
  const complete: ImageTransferComplete = { type: 'image-complete', transferId }
  sendControlMessage(channel, complete)
}

/**
 * Returns a promise that resolves when the DataChannel's bufferedAmount
 * drops below the threshold, using the `bufferedamountlow` event.
 */
function waitForBufferDrain(channel: RTCDataChannel): Promise<void> {
  return new Promise<void>((resolve) => {
    channel.bufferedAmountLowThreshold = MAX_BUFFERED_AMOUNT / 2
    const handler = () => {
      channel.removeEventListener('bufferedamountlow', handler)
      resolve()
    }
    channel.addEventListener('bufferedamountlow', handler)

    // Fallback: poll in case the event doesn't fire (some browser edge cases)
    const fallback = setInterval(() => {
      if (channel.bufferedAmount <= MAX_BUFFERED_AMOUNT / 2) {
        clearInterval(fallback)
        channel.removeEventListener('bufferedamountlow', handler)
        resolve()
      }
    }, 100)

    // Safety: clear poll on resolution
    const originalResolve = resolve
    void originalResolve // consumed by the closure above
  })
}

// ─── Receiving ──────────────────────────────────────────────────────────────

export interface IncomingTransfer {
  metadata: ImageTransferMetadata
  chunks: ArrayBuffer[]
  receivedChunks: number
  bytesReceived: number
  /** The next expected chunk header (index). */
  nextExpectedIndex: number
}

export interface FileReceiverCallbacks {
  onTransferStart: (metadata: ImageTransferMetadata) => void
  onProgress: (transferId: string, bytesReceived: number, totalBytes: number) => void
  onComplete: (transferId: string, blob: Blob, metadata: ImageTransferMetadata) => void
  onError: (transferId: string, error: string) => void
  onCancelled: (transferId: string) => void
}

/**
 * Stateful receiver that collects incoming chunks and reconstructs images.
 * Create one instance per peer DataChannel.
 */
export class FileReceiver {
  private transfers = new Map<string, IncomingTransfer>()
  /** Tracks whether we're expecting a binary chunk for a specific transferId. */
  private pendingBinaryFor: string | null = null
  private callbacks: FileReceiverCallbacks

  constructor(callbacks: FileReceiverCallbacks) {
    this.callbacks = callbacks
  }

  /**
   * Handle an incoming control message.
   */
  handleControlMessage(message: DataChannelMessage): void {
    switch (message.type) {
      case 'image-start':
        this.handleStart(message as unknown as ImageTransferMetadata)
        break
      case 'image-chunk':
        this.handleChunkHeader(message as unknown as ImageChunkHeader)
        break
      case 'image-complete':
        this.handleComplete(message as unknown as ImageTransferComplete)
        break
      case 'image-cancel':
        this.handleCancel(message as unknown as ImageTransferCancel)
        break
    }
  }

  /**
   * Handle incoming binary data (a chunk payload).
   */
  handleBinaryData(data: ArrayBuffer): void {
    const transferId = this.pendingBinaryFor
    if (!transferId) {
      console.warn('[FileReceiver] Received binary data without pending chunk header')
      return
    }
    this.pendingBinaryFor = null

    const transfer = this.transfers.get(transferId)
    if (!transfer) {
      console.warn(`[FileReceiver] No active transfer for id: ${transferId}`)
      return
    }

    transfer.chunks.push(data)
    transfer.receivedChunks++
    transfer.bytesReceived += data.byteLength

    this.callbacks.onProgress(
      transferId,
      transfer.bytesReceived,
      transfer.metadata.size,
    )
  }

  /**
   * Clean up all active transfers. Called when the channel closes.
   */
  cleanup(): void {
    for (const [transferId] of this.transfers) {
      this.callbacks.onError(transferId, 'Connection lost during transfer')
    }
    this.transfers.clear()
    this.pendingBinaryFor = null
  }

  private handleStart(metadata: ImageTransferMetadata): void {
    // Guard against duplicate transfer IDs
    if (this.transfers.has(metadata.transferId)) {
      console.warn(`[FileReceiver] Duplicate transferId: ${metadata.transferId}`)
      return
    }

    this.transfers.set(metadata.transferId, {
      metadata,
      chunks: [],
      receivedChunks: 0,
      bytesReceived: 0,
      nextExpectedIndex: 0,
    })

    this.callbacks.onTransferStart(metadata)
  }

  private handleChunkHeader(header: ImageChunkHeader): void {
    const transfer = this.transfers.get(header.transferId)
    if (!transfer) {
      console.warn(`[FileReceiver] Chunk for unknown transfer: ${header.transferId}`)
      return
    }
    // Mark that the next binary message belongs to this transfer
    this.pendingBinaryFor = header.transferId
    transfer.nextExpectedIndex = header.index + 1
  }

  private handleComplete(msg: ImageTransferComplete): void {
    const transfer = this.transfers.get(msg.transferId)
    if (!transfer) return

    const blob = new Blob(transfer.chunks, { type: transfer.metadata.mimeType })
    this.transfers.delete(msg.transferId)

    this.callbacks.onComplete(msg.transferId, blob, transfer.metadata)
  }

  private handleCancel(msg: ImageTransferCancel): void {
    if (this.transfers.has(msg.transferId)) {
      this.transfers.delete(msg.transferId)
      this.callbacks.onCancelled(msg.transferId)
    }
  }
}
