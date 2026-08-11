/**
 * hooks/useImageTransfer.ts
 *
 * High-level image transfer orchestration hook.
 * Wraps useWebRTC and the file transfer engine to provide a simple API
 * for sending/receiving images with progress tracking.
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useWebRTC, type UseWebRTCReturn } from './useWebRTC'
import { sendFile, validateImage, generateTransferId, FileReceiver } from '@/lib/webrtc/fileTransfer'
import { parseIncomingMessage } from '@/lib/webrtc/dataChannel'
import type {
  Transfer,
  TransferStatus,
  ImageTransferMetadata,
} from '@/lib/webrtc/types'

export interface UseImageTransferOptions {
  roomId: string
  localUid: string
  localName: string
  presence: Record<string, { name?: string; sid?: string; [key: string]: unknown }>
  enabled?: boolean
}

export interface UseImageTransferReturn {
  /** All transfers (sent + received) for the current session. */
  transfers: Transfer[]
  /** WebRTC peer status list. */
  peers: UseWebRTCReturn['peers']
  /** Whether the browser supports WebRTC. */
  isSupported: boolean
  /** Send an image to a specific peer or all peers. */
  sendImage: (file: File, targetPeerId?: string) => Promise<void>
  /** Cancel an in-progress outgoing transfer. */
  cancelTransfer: (transferId: string) => void
  /** Download a received image. */
  downloadImage: (transfer: Transfer) => void
  /** Number of connected peers (DataChannel open). */
  connectedPeerCount: number
}

export function useImageTransfer({
  roomId,
  localUid,
  localName,
  presence,
  enabled = true,
}: UseImageTransferOptions): UseImageTransferReturn {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const abortControllersRef = useRef(new Map<string, AbortController>())
  const fileReceiversRef = useRef(new Map<string, FileReceiver>())
  const objectUrlsRef = useRef(new Set<string>())

  // Handle incoming DataChannel messages
  const handleMessage = useCallback((peerId: string, event: MessageEvent) => {
    const parsed = parseIncomingMessage(event.data)
    const receiver = fileReceiversRef.current.get(peerId)
    if (!receiver) return

    if (parsed.kind === 'control') {
      receiver.handleControlMessage(parsed.message)
    } else {
      receiver.handleBinaryData(parsed.data)
    }
  }, [])

  const webrtc = useWebRTC({
    roomId,
    localUid,
    presence,
    enabled,
    onMessage: handleMessage,
  })

  // Update transfer helper
  const updateTransfer = useCallback((transferId: string, updates: Partial<Transfer>) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? { ...t, ...updates } : t)),
    )
  }, [])

  // Create file receivers for each connected peer
  useEffect(() => {
    for (const peer of webrtc.peers) {
      if (peer.channel && !fileReceiversRef.current.has(peer.peerId)) {
        const receiver = new FileReceiver({
          onTransferStart: (metadata: ImageTransferMetadata) => {
            const newTransfer: Transfer = {
              id: metadata.transferId,
              fileName: metadata.fileName,
              fileSize: metadata.size,
              mimeType: metadata.mimeType,
              direction: 'received',
              peerId: peer.peerId,
              peerName: metadata.senderName || peer.peerName,
              status: 'transferring',
              progress: 0,
              createdAt: Date.now(),
            }
            setTransfers((prev) => [...prev, newTransfer])
          },
          onProgress: (transferId: string, bytesReceived: number, totalBytes: number) => {
            const progress = Math.round((bytesReceived / totalBytes) * 100)
            updateTransfer(transferId, { progress, status: 'transferring' })
          },
          onComplete: (transferId: string, blob: Blob, metadata: ImageTransferMetadata) => {
            const url = URL.createObjectURL(blob)
            objectUrlsRef.current.add(url)
            updateTransfer(transferId, {
              status: 'completed',
              progress: 100,
              objectUrl: url,
              blob,
            })
          },
          onError: (transferId: string, error: string) => {
            updateTransfer(transferId, { status: 'failed', error })
          },
          onCancelled: (transferId: string) => {
            updateTransfer(transferId, { status: 'cancelled' })
          },
        })
        fileReceiversRef.current.set(peer.peerId, receiver)
      }
    }

    // Clean up receivers for disconnected peers
    for (const [peerId, receiver] of fileReceiversRef.current) {
      const stillConnected = webrtc.peers.some(
        (p) => p.peerId === peerId && p.channel,
      )
      if (!stillConnected) {
        receiver.cleanup()
        fileReceiversRef.current.delete(peerId)
      }
    }
  }, [webrtc.peers, updateTransfer])

  const sendImage = useCallback(async (file: File) => {
    const validation = validateImage(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const channels = webrtc.getAllChannels()

    if (channels.length === 0) {
      throw new Error('No connected peers to send to')
    }

    const batchId = generateTransferId() // Generate once for the entire batch

    // Send to each target peer
    const sendPromises = channels.map(async ({ peerId, peerName, channel }) => {
      const transferId = generateTransferId()
      const abortController = new AbortController()
      abortControllersRef.current.set(transferId, abortController)

      const newTransfer: Transfer = {
        id: transferId,
        batchId,
        fileName: file.name || 'image',
        fileSize: file.size,
        mimeType: file.type,
        direction: 'sent',
        peerId,
        peerName,
        status: 'transferring',
        progress: 0,
        createdAt: Date.now(),
      }

      setTransfers((prev) => [...prev, newTransfer])

      try {
        await sendFile({
          channel,
          file,
          transferId,
          senderName: localName,
          onProgress: (bytesSent, totalBytes) => {
            const progress = Math.round((bytesSent / totalBytes) * 100)
            updateTransfer(transferId, { progress })
          },
          abortSignal: abortController.signal,
        })
        updateTransfer(transferId, { status: 'completed', progress: 100 })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          updateTransfer(transferId, { status: 'cancelled' })
        } else {
          const errorMsg = err instanceof Error ? err.message : 'Transfer failed'
          updateTransfer(transferId, { status: 'failed', error: errorMsg })
        }
      } finally {
        abortControllersRef.current.delete(transferId)
      }
    })

    await Promise.allSettled(sendPromises)
  }, [webrtc, localName, updateTransfer])

  const cancelTransfer = useCallback((transferId: string) => {
    const controller = abortControllersRef.current.get(transferId)
    if (controller) {
      controller.abort()
    }
  }, [])

  const downloadImage = useCallback((transfer: Transfer) => {
    const url = transfer.objectUrl
    if (!url) return
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = transfer.fileName
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
  }, [])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url)
      }
      objectUrlsRef.current.clear()
      for (const [, receiver] of fileReceiversRef.current) {
        receiver.cleanup()
      }
      fileReceiversRef.current.clear()
      for (const [, controller] of abortControllersRef.current) {
        controller.abort()
      }
      abortControllersRef.current.clear()
    }
  }, [])

  const connectedPeerCount = webrtc.peers.filter(
    (p) => p.status === 'connected' && p.channel?.readyState === 'open',
  ).length

  return {
    transfers,
    peers: webrtc.peers,
    isSupported: webrtc.isSupported,
    sendImage,
    cancelTransfer,
    downloadImage,
    connectedPeerCount,
  }
}
