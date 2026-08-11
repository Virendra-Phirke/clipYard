/**
 * components/image-sharing/ImageSharePanel.tsx
 *
 * Main container for P2P image sharing within a ClipYard room.
 * Renders the uploader, preview, active transfers, received images,
 * and WebRTC connection status.
 */

'use client'

import { useCallback, useState, type CSSProperties } from 'react'
import { useImageTransfer } from '@/hooks/useImageTransfer'
import ImageUploader from './ImageUploader'
import ImagePreview from './ImagePreview'
import ImageTransferCard from './ImageTransferCard'
import ReceivedImageCard from './ReceivedImageCard'
import ImageModal from './ImageModal'
import type { Transfer } from '@/lib/webrtc/types'

interface ImageSharePanelProps {
  roomId: string
  localUid: string
  localName: string
  presence: Record<string, { name?: string; sid?: string; [key: string]: unknown }>
}

const S: Record<string, CSSProperties> = {
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  title: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    lineHeight: '20px',
    letterSpacing: '0.08em',
    fontWeight: 500,
    color: 'var(--cy-text)',
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '0.04em',
    padding: '3px 10px',
    borderRadius: '2px',
    border: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-container)',
    color: 'var(--cy-text-secondary)',
    textTransform: 'uppercase',
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  unsupported: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    textAlign: 'center',
    padding: '24px 16px',
    backgroundColor: 'var(--cy-surface)',
    border: '1.5px solid var(--cy-border)',
    borderRadius: '4px',
  },
  transfersSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  subTitle: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '0.08em',
    fontWeight: 500,
    color: 'var(--cy-text-muted)',
    textTransform: 'uppercase',
  },
  receivedGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  error: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--cy-error)',
    padding: '8px 12px',
    backgroundColor: 'var(--cy-surface)',
    border: '1.5px solid var(--cy-error)',
    borderRadius: '4px',
  },
}

export default function ImageSharePanel({
  roomId,
  localUid,
  localName,
  presence,
}: ImageSharePanelProps) {
  const {
    transfers,
    peers,
    isSupported,
    sendImage,
    cancelTransfer,
    downloadImage,
    connectedPeerCount,
  } = useImageTransfer({
    roomId,
    localUid,
    localName,
    presence,
    enabled: true,
  })

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewingImage, setViewingImage] = useState<Transfer | null>(null)

  const handleImageSelected = useCallback((file: File) => {
    setError(null)
    setPendingFile(file)
  }, [])

  const handleSend = useCallback(async (targetPeerId?: string) => {
    if (!pendingFile) return
    setSending(true)
    setError(null)
    try {
      await sendImage(pendingFile, targetPeerId)
      setPendingFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send image')
    } finally {
      setSending(false)
    }
  }, [pendingFile, sendImage])

  const handleRemove = useCallback(() => {
    setPendingFile(null)
    setError(null)
  }, [])

  const handleCancelBatch = useCallback((batchId: string) => {
    // Find all transfers in this batch and cancel them
    transfers.filter((t) => t.batchId === batchId || t.id === batchId).forEach((t) => {
      cancelTransfer(t.id)
    })
  }, [transfers, cancelTransfer])

  // Categorize transfers
  const activeTransfers = transfers.filter(
    (t) => t.status === 'transferring' || t.status === 'pending',
  )
  const completedReceived = transfers.filter(
    (t) => t.status === 'completed' && t.direction === 'received',
  )
  const failedTransfers = transfers.filter((t) => t.status === 'failed')
  
  // Aggregate completed sent transfers by batchId so the summary count is accurate
  const completedSent = transfers.filter(
    (t) => t.status === 'completed' && t.direction === 'sent',
  )
  const uniqueCompletedSentBatches = new Set(
    completedSent.map((t) => t.batchId || t.id)
  )

  // Group active sent transfers by batchId
  const activeSentGroups = new Map<string, Transfer[]>()
  const activeReceived: Transfer[] = []
  
  for (const t of activeTransfers) {
    if (t.direction === 'sent') {
      const bId = t.batchId || t.id
      const group = activeSentGroups.get(bId) || []
      group.push(t)
      activeSentGroups.set(bId, group)
    } else {
      activeReceived.push(t)
    }
  }

  // Create aggregated transfers for rendering
  const aggregatedActiveTransfers = [
    ...activeReceived,
    ...Array.from(activeSentGroups.values()).map(group => {
      // Calculate aggregate progress
      const totalProgress = group.reduce((sum, t) => sum + t.progress, 0)
      const avgProgress = Math.round(totalProgress / group.length)
      // Return a merged representation
      return {
        ...group[0],
        id: group[0].batchId || group[0].id, // use batchId as key for rendering and cancelling
        progress: avgProgress,
        peerName: `Everyone (${group.length})`,
      }
    })
  ]

  // Connection status
  const hasAnyPeer = peers.length > 0
  const statusColor = connectedPeerCount > 0
    ? 'var(--cy-primary)'
    : hasAnyPeer
      ? 'var(--cy-warning)'
      : 'var(--cy-text-muted)'
  const statusLabel = connectedPeerCount > 0
    ? `P2P Connected (${connectedPeerCount})`
    : hasAnyPeer
      ? 'Connecting…'
      : 'Waiting for peers'

  if (!isSupported) {
    return (
      <div style={S.section}>
        <div style={S.title}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--cy-text-secondary)' }}>
            image
          </span>
          Image Sharing
        </div>
        <div style={S.unsupported}>
          Your browser does not support peer-to-peer image sharing.
          <br />
          Please use a modern version of Chrome, Edge, Firefox, or Safari.
        </div>
      </div>
    )
  }

  return (
    <div style={S.section}>
      {/* Header */}
      <div style={S.sectionHeader}>
        <div style={S.title}>
          <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--cy-text-secondary)' }}>
            image
          </span>
          Image Sharing
        </div>
        <div style={S.statusBadge}>
          <div style={{ ...S.dot, backgroundColor: statusColor }} />
          {statusLabel}
        </div>
      </div>

      {/* Uploader (hidden when a file is already staged) */}
      {!pendingFile && (
        <ImageUploader
          onImageSelected={handleImageSelected}
          disabled={sending}
        />
      )}

      {/* Error */}
      {error && <div style={S.error}>{error}</div>}

      {/* Pending preview */}
      {pendingFile && (
        <ImagePreview
          file={pendingFile}
          peers={peers}
          onSend={handleSend}
          onRemove={handleRemove}
          sending={sending}
        />
      )}

      {/* Active transfers */}
      {aggregatedActiveTransfers.length > 0 && (
        <div style={S.transfersSection}>
          <div style={S.subTitle}>Active Transfers</div>
          {aggregatedActiveTransfers.map((t) => (
            <ImageTransferCard
              key={t.id}
              transfer={t}
              onCancel={t.direction === 'sent' ? handleCancelBatch : cancelTransfer}
            />
          ))}
        </div>
      )}

      {/* Failed transfers */}
      {failedTransfers.length > 0 && (
        <div style={S.transfersSection}>
          {failedTransfers.map((t) => (
            <ImageTransferCard
              key={t.id}
              transfer={t}
            />
          ))}
        </div>
      )}

      {/* Received images */}
      {completedReceived.length > 0 && (
        <div style={S.transfersSection}>
          <div style={S.subTitle}>Received Images</div>
          <div style={S.receivedGrid}>
            {completedReceived.map((t) => (
              <ReceivedImageCard
                key={t.id}
                transfer={t}
                onDownload={downloadImage}
                onView={setViewingImage}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sent summary */}
      {uniqueCompletedSentBatches.size > 0 && (
        <div style={S.transfersSection}>
          <div style={S.subTitle}>
            {uniqueCompletedSentBatches.size} image{uniqueCompletedSentBatches.size !== 1 ? 's' : ''} sent
          </div>
        </div>
      )}

      {/* Full screen modal */}
      {viewingImage && viewingImage.objectUrl && (
        <ImageModal
          url={viewingImage.objectUrl}
          fileName={viewingImage.fileName}
          onClose={() => setViewingImage(null)}
        />
      )}
    </div>
  )
}
