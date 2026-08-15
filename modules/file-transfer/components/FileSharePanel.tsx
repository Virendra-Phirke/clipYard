'use client'

import { useState, type CSSProperties, type MutableRefObject, useEffect } from 'react'
import { useFileTransfer } from '../hooks/useFileTransfer'
import { FileModal } from './FileModal'
import { FileText, Music, Play, AlertCircle, X } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Transfer } from '@/lib/webrtc/types'

interface FileSharePanelProps {
  roomId: string
  localUid: string
  localName: string
  presence: Record<string, { name?: string; sid?: string; [key: string]: unknown }>
  sendFileRef?: MutableRefObject<((file: File) => void) | null>
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const style: Record<string, CSSProperties> = {
  card: {
    backgroundColor: 'var(--cy-surface)',
    border: '1.5px solid var(--cy-border)',
    borderRadius: '4px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  cardTitle: {
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
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  imageSlot: {
    position: 'relative',
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    overflow: 'hidden',
    backgroundColor: 'var(--cy-surface-container)',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  iconSlot: {
    position: 'relative',
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-container)',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--cy-text-secondary)',
  },
  progressOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: '4px',
    backgroundColor: 'var(--cy-primary)',
    transition: 'width 0.2s',
  },
  // Transfer progress card styles
  transferCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '10px 12px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-container)',
  },
  transferHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  transferThumb: {
    width: '36px',
    height: '36px',
    borderRadius: '4px',
    objectFit: 'cover',
    flexShrink: 0,
    border: '1px solid var(--cy-border)',
  },
  transferInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  transferFileName: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: 500,
    color: 'var(--cy-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  transferMeta: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '10px',
    lineHeight: '14px',
    color: 'var(--cy-text-muted)',
    letterSpacing: '0.02em',
  },
  barTrack: {
    width: '100%',
    height: '4px',
    backgroundColor: 'var(--cy-surface-container-high)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: 'var(--cy-primary)',
    borderRadius: '2px',
    transition: 'width 0.3s ease',
  },
  cancelBtn: {
    background: 'none',
    border: 'none',
    padding: '2px',
    cursor: 'pointer',
    color: 'var(--cy-text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'color 0.15s, background-color 0.15s',
    flexShrink: 0,
  },
  // Confirmation dialog
  confirmOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  confirmBox: {
    backgroundColor: 'var(--cy-surface)',
    border: '1.5px solid var(--cy-border)',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '340px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  confirmTitle: {
    fontFamily: 'Hanken Grotesk, sans-serif',
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--cy-text)',
  },
  confirmDesc: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
  },
  confirmActions: {
    display: 'flex',
    gap: '8px',
    justifyContent: 'flex-end',
  },
  confirmCancelBtn: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-container)',
    color: 'var(--cy-text-secondary)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'background-color 0.2s',
  },
  confirmStopBtn: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-error)',
    backgroundColor: 'var(--cy-error)',
    color: '#fff',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    transition: 'opacity 0.2s',
  },
}

export function FileSharePanel({
  roomId,
  localUid,
  localName,
  presence,
  sendFileRef,
}: FileSharePanelProps) {
  const {
    transfers,
    isSupported,
    sendFile,
    cancelTransfer,
  } = useFileTransfer({
    roomId,
    localUid,
    localName,
    presence,
  })

  // Wire up the ref so AttachmentMenu can trigger sends
  if (sendFileRef) {
    sendFileRef.current = sendFile
  }

  const [viewingFile, setViewingFile] = useState<(Transfer & { objectUrl: string }) | null>(null)
  const [cancelConfirm, setCancelConfirm] = useState<{ transferId: string; fileName: string } | null>(null)

  // Close confirm dialog on Escape
  useEffect(() => {
    if (!cancelConfirm) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCancelConfirm(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cancelConfirm])

  if (!isSupported) return null

  // All shared files (received and active). Sent files without blobs aren't previewable directly.
  const receivedFiles = transfers.filter((t) => t.status === 'completed' && t.direction === 'received' && (t as any).objectUrl) as (Transfer & { objectUrl: string })[]
  const activeTransfers = transfers.filter((t) => t.status === 'transferring' || t.status === 'pending')
  const failedTransfers = transfers.filter((t) => t.status === 'failed')

  if (receivedFiles.length === 0 && activeTransfers.length === 0 && failedTransfers.length === 0) {
    return null
  }

  const handleCancelRequest = (transferId: string, fileName: string) => {
    setCancelConfirm({ transferId, fileName })
  }

  const handleConfirmCancel = () => {
    if (cancelConfirm) {
      cancelTransfer(cancelConfirm.transferId)
      setCancelConfirm(null)
    }
  }

  return (
    <TooltipProvider delay={200}>
      <div style={style.card}>
        <h3 style={style.cardTitle}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--cy-text-secondary)' }}>folder_zip</span>
          Shared Files
        </h3>

        {/* Active transfers — shown as inline progress cards */}
        {activeTransfers.map((t) => {
          const isSending = t.direction === 'sent'
          const progress = Math.min(100, Math.max(0, t.progress))
          const sent = Math.round((t.fileSize * progress) / 100)
          
          return (
            <div key={t.id} style={style.transferCard}>
              <div style={style.transferHeader}>
                <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'var(--cy-primary)', flexShrink: 0 }}>
                  {isSending ? 'upload' : 'download'}
                </span>
                <div style={style.transferInfo}>
                  <div style={style.transferFileName} title={t.fileName}>{t.fileName}</div>
                  <div style={style.transferMeta}>
                    {isSending ? 'Sending' : 'Receiving'}… {progress}% · {formatBytes(sent)} / {formatBytes(t.fileSize)}
                    {t.speed !== undefined && ` · ${formatBytes(t.speed)}/s`}
                  </div>
                </div>
                {isSending && (
                  <button
                    style={style.cancelBtn}
                    onClick={() => handleCancelRequest(t.id, t.fileName)}
                    title="Cancel transfer"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--cy-error)'
                      e.currentTarget.style.backgroundColor = 'var(--cy-surface-container-high)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--cy-text-muted)'
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div style={style.barTrack}>
                <div style={{
                  ...style.barFill,
                  width: `${progress}%`,
                  boxShadow: progress > 0 && progress < 100 ? '0 0 6px var(--cy-primary)' : 'none',
                }} />
              </div>
            </div>
          )
        })}

        {/* Failed transfers */}
        {failedTransfers.map((t) => (
          <div key={t.id} style={{ ...style.transferCard, borderColor: 'var(--cy-error)' }}>
            <div style={style.transferHeader}>
              <AlertCircle size={16} color="var(--cy-error)" style={{ flexShrink: 0 }} />
              <div style={style.transferInfo}>
                <div style={style.transferFileName}>{t.fileName}</div>
                <div style={{ ...style.transferMeta, color: 'var(--cy-error)' }}>
                  {t.error || 'Transfer failed'}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Completed received files — compact thumbnails */}
        {receivedFiles.length > 0 && (
          <div style={style.row}>
            {receivedFiles.map((f, i) => {
              const isImage = f.mimeType.startsWith('image/')
              const isVideo = f.mimeType.startsWith('video/')
              const isAudio = f.mimeType.startsWith('audio/')
              
              let icon
              let hoverContent

              if (isImage) {
                icon = <img src={f.objectUrl} alt={f.fileName} style={style.slotImg} />
                hoverContent = (
                  <img src={f.objectUrl} alt={f.fileName} style={{ maxWidth: '200px', borderRadius: '4px', display: 'block' }} />
                )
              } else if (isVideo) {
                icon = <Play size={16} />
                hoverContent = (
                  <video src={f.objectUrl} style={{ maxWidth: '200px', borderRadius: '4px', display: 'block' }} />
                )
              } else if (isAudio) {
                icon = <Music size={16} />
                hoverContent = <div style={{ fontSize: '12px', padding: '2px', wordBreak: 'break-all' }}>{f.fileName}</div>
              } else {
                icon = <FileText size={16} />
                hoverContent = <div style={{ fontSize: '12px', padding: '2px', wordBreak: 'break-all' }}>{f.fileName}</div>
              }

              return (
                <Tooltip key={f.id || i}>
                  <TooltipTrigger
                    style={isImage ? style.imageSlot : style.iconSlot}
                    onClick={() => setViewingFile(f)}
                  >
                    {icon}
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5} style={{ zIndex: 100, padding: 0, overflow: 'hidden', borderRadius: '6px' }}>
                    {hoverContent}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        )}

        {/* Full screen modal */}
        {viewingFile && viewingFile.objectUrl && (
          <FileModal
            url={viewingFile.objectUrl}
            fileName={viewingFile.fileName}
            mimeType={viewingFile.mimeType}
            blob={viewingFile.blob}
            onClose={() => setViewingFile(null)}
          />
        )}

        {/* Cancel confirmation dialog */}
        {cancelConfirm && (
          <div style={style.confirmOverlay} onClick={() => setCancelConfirm(null)}>
            <div style={style.confirmBox} onClick={(e) => e.stopPropagation()}>
              <div style={style.confirmTitle}>Cancel Transfer?</div>
              <div style={style.confirmDesc}>
                Are you sure you want to cancel sending &quot;{cancelConfirm.fileName}&quot;? This cannot be undone.
              </div>
              <div style={style.confirmActions}>
                <button
                  style={style.confirmCancelBtn}
                  onClick={() => setCancelConfirm(null)}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--cy-surface-container-high)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--cy-surface-container)' }}
                >
                  Keep Sending
                </button>
                <button
                  style={style.confirmStopBtn}
                  onClick={handleConfirmCancel}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                >
                  Cancel Transfer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
