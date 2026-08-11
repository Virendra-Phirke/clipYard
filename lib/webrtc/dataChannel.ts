/**
 * lib/webrtc/dataChannel.ts
 *
 * DataChannel creation, configuration, and message parsing utilities.
 * Provides a thin abstraction so the hooks and transfer engine don't
 * deal with raw channel setup details.
 */

'use client'

import type { DataChannelMessage } from './types'

const CHANNEL_LABEL = 'file-transfer'

/**
 * Create a DataChannel on the given peer connection for image transfer.
 * The initiator (offerer) calls this before creating the SDP offer.
 */
export function createImageChannel(pc: RTCPeerConnection): RTCDataChannel {
  const channel = pc.createDataChannel(CHANNEL_LABEL, { ordered: true })
  channel.binaryType = 'arraybuffer'
  return channel
}

/**
 * Configure a received DataChannel (from `pc.ondatachannel`).
 */
export function setupReceivedChannel(channel: RTCDataChannel): void {
  channel.binaryType = 'arraybuffer'
}

/**
 * Send a JSON control message through the DataChannel.
 */
export function sendControlMessage(
  channel: RTCDataChannel,
  message: DataChannelMessage,
): void {
  channel.send(JSON.stringify(message))
}

/**
 * Parse an incoming DataChannel message.
 *
 * Returns either:
 * - `{ kind: 'control', message: DataChannelMessage }` for JSON control messages
 * - `{ kind: 'binary', data: ArrayBuffer }` for binary chunk data
 */
export function parseIncomingMessage(
  data: string | ArrayBuffer,
):
  | { kind: 'control'; message: DataChannelMessage }
  | { kind: 'binary'; data: ArrayBuffer } {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data) as DataChannelMessage
      return { kind: 'control', message: parsed }
    } catch {
      // Malformed JSON — treat as unknown, log and ignore
      console.warn('[WebRTC] Received unparseable string message')
      return { kind: 'control', message: { type: 'file-cancel', transferId: '' } }
    }
  }
  return { kind: 'binary', data }
}
