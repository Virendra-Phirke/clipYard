'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useWebRTC, type UseWebRTCReturn } from '@/hooks/useWebRTC'
import { sendFile, validateFile, generateTransferId, FileReceiver } from '@/lib/webrtc/fileTransfer'
import { parseIncomingMessage } from '@/lib/webrtc/dataChannel'
import { getFilesByRoom, saveFileToDB } from '@/lib/webrtc/db'
import type {
  Transfer,
  FileTransferMetadata,
} from '@/lib/webrtc/types'

export interface UseFileTransferOptions {
  roomId: string
  localUid: string
  localName: string
  presence: Record<string, { name?: string; sid?: string; [key: string]: unknown }>
  enabled?: boolean
}

export interface UseFileTransferReturn {
  transfers: Transfer[]
  peers: UseWebRTCReturn['peers']
  isSupported: boolean
  sendFile: (file: File) => void
  cancelTransfer: (transferId: string) => void
  downloadFile: (transfer: Transfer) => void
  connectedPeerCount: number
}

interface TransferQueueItem {
  id: string
  file: File
}

export function useFileTransfer({
  roomId,
  localUid,
  localName,
  presence,
  enabled = true,
}: UseFileTransferOptions): UseFileTransferReturn {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const abortControllersRef = useRef(new Map<string, AbortController>())
  const fileReceiversRef = useRef(new Map<string, FileReceiver>())
  const objectUrlsRef = useRef(new Set<string>())
  const [hasLoadedDB, setHasLoadedDB] = useState(false)
  
  // Queue state for sending sequentially
  const [sendQueue, setSendQueue] = useState<TransferQueueItem[]>([])
  const [isProcessingQueue, setIsProcessingQueue] = useState(false)

  // Load persisted files from IndexedDB on mount
  useEffect(() => {
    if (!roomId || hasLoadedDB) return

    getFilesByRoom(roomId).then((storedFiles) => {
      const restoredTransfers: Transfer[] = storedFiles.map((f) => {
        const url = URL.createObjectURL(f.blob)
        objectUrlsRef.current.add(url)

        return {
          id: f.id,
          fileName: f.fileName,
          fileSize: f.fileSize,
          mimeType: f.mimeType,
          category: f.category || 'file',
          direction: 'received',
          peerId: f.peerId,
          peerName: f.peerName,
          status: 'completed',
          progress: 100,
          createdAt: f.createdAt,
          objectUrl: url,
          blob: f.blob,
        }
      })

      if (restoredTransfers.length > 0) {
        setTransfers((prev) => {
          const existingIds = new Set(prev.map(t => t.id))
          const newTransfers = restoredTransfers.filter(t => !existingIds.has(t.id))
          return [...prev, ...newTransfers]
        })
      }
      setHasLoadedDB(true)
    }).catch(console.error)
  }, [roomId, hasLoadedDB])

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
      prev.map((t) => {
        if (t.id !== transferId) return t
        const updated = { ...t, ...updates }
        
        // Calculate Speed & ETA
        if (updated.status === 'transferring' && updated.progress > 0 && updated.progress < 100) {
          const elapsedSeconds = (Date.now() - updated.createdAt) / 1000
          if (elapsedSeconds > 0.5) { // Wait a bit before calculating speed
            const bytesTransferred = (updated.progress / 100) * updated.fileSize
            const speed = bytesTransferred / elapsedSeconds
            const remainingBytes = updated.fileSize - bytesTransferred
            const eta = speed > 0 ? remainingBytes / speed : 0
            updated.speed = speed
            updated.eta = eta
          }
        } else if (updated.status === 'completed' || updated.status === 'failed' || updated.status === 'cancelled') {
          updated.speed = undefined
          updated.eta = undefined
        }
        
        return updated
      }),
    )
  }, [])

  // Create file receivers for each connected peer
  useEffect(() => {
    for (const peer of webrtc.peers) {
      if (peer.channel && !fileReceiversRef.current.has(peer.peerId)) {
        const receiver = new FileReceiver({
          onTransferStart: (metadata: FileTransferMetadata) => {
            const newTransfer: Transfer = {
              id: metadata.transferId,
              fileName: metadata.fileName,
              fileSize: metadata.size,
              mimeType: metadata.mimeType,
              category: metadata.category,
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
          onComplete: (transferId: string, blob: Blob, metadata: FileTransferMetadata) => {
            const url = URL.createObjectURL(blob)
            objectUrlsRef.current.add(url)
            updateTransfer(transferId, {
              status: 'completed',
              progress: 100,
              objectUrl: url,
              blob,
            })

            // Persist to IndexedDB
            saveFileToDB({
              id: metadata.transferId,
              roomId,
              fileName: metadata.fileName,
              fileSize: metadata.size,
              mimeType: metadata.mimeType,
              category: metadata.category,
              blob,
              createdAt: Date.now(),
              peerId: peer.peerId,
              peerName: metadata.senderName || peer.peerName,
            }).catch(console.error)
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
  }, [webrtc.peers, updateTransfer, roomId])

  // Queue processing effect
  useEffect(() => {
    if (sendQueue.length === 0 || isProcessingQueue) return

    const processNext = async () => {
      setIsProcessingQueue(true)
      const currentItem = sendQueue[0]
      const channels = webrtc.getAllChannels()

      if (channels.length === 0) {
        updateTransfer(currentItem.id, { status: 'failed', error: 'No connected peers' })
      } else {
        // Send to each target peer concurrently, but wait for all to finish before next file
        const sendPromises = channels.map(async ({ peerId, peerName, channel }) => {
          // Note: In a real system you'd want a transfer ID per peer, 
          // or group them by batchId. For simplicity, reusing id here.
          const transferId = generateTransferId()
          const abortController = new AbortController()
          abortControllersRef.current.set(transferId, abortController)

          const newTransfer: Transfer = {
            id: transferId,
            batchId: currentItem.id, // Group them by the queue item ID
            fileName: currentItem.file.name || 'file',
            fileSize: currentItem.file.size,
            mimeType: currentItem.file.type,
            // Temporarily mapping category on client, though fileTransfer engine does it too
            category: 'file', // updateTransfer will pick up the real category from DB or we can just leave it since the sender doesn't show their own category deeply, actually let's set it
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
              file: currentItem.file,
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
      }

      setSendQueue(q => q.slice(1))
      setIsProcessingQueue(false)
    }

    processNext()
  }, [sendQueue, isProcessingQueue, webrtc, localName, updateTransfer])

  const queueFile = useCallback((file: File) => {
    const validation = validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const batchId = generateTransferId()
    setSendQueue(prev => [...prev, { id: batchId, file }])
  }, [])

  const cancelTransfer = useCallback((transferId: string) => {
    const controller = abortControllersRef.current.get(transferId)
    if (controller) {
      controller.abort()
    }
  }, [])

  const downloadFile = useCallback((transfer: Transfer) => {
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
    sendFile: queueFile,
    cancelTransfer,
    downloadFile,
    connectedPeerCount,
  }
}
