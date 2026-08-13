'use client'

import { useState, type CSSProperties, type MutableRefObject } from 'react'
import { useFileTransfer } from '../hooks/useFileTransfer'
import { FileModal } from './FileModal'
import { FileText, Music, Play, AlertCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Transfer } from '@/lib/webrtc/types'

interface FileSharePanelProps {
  roomId: string
  localUid: string
  localName: string
  presence: Record<string, { name?: string; sid?: string; [key: string]: unknown }>
  sendFileRef?: MutableRefObject<((file: File) => void) | null>
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

  if (!isSupported) return null

  // All shared files (received and active). Sent files without blobs aren't previewable directly.
  const receivedFiles = transfers.filter((t) => t.status === 'completed' && t.direction === 'received' && (t as any).objectUrl) as (Transfer & { objectUrl: string })[]
  const activeTransfers = transfers.filter((t) => t.status === 'transferring' || t.status === 'pending' || t.status === 'failed')

  if (receivedFiles.length === 0 && activeTransfers.length === 0) {
    return null
  }

  return (
    <TooltipProvider delay={200}>
      <div style={style.card}>
        <h3 style={style.cardTitle}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--cy-text-secondary)' }}>folder_zip</span>
          Shared Files
        </h3>

        <div style={style.row}>
          {/* Render received files */}
          {receivedFiles.map((f, i) => {
            const isImage = f.mimeType.startsWith('image/')
            const isVideo = f.mimeType.startsWith('video/')
            const isAudio = f.mimeType.startsWith('audio/')
            
            let icon
            let hoverContent

            if (isImage) {
              icon = <img src={f.objectUrl} alt={f.fileName} style={style.slotImg} />
              hoverContent = (
                <div style={{ padding: '4px', maxWidth: '200px' }}>
                  <img src={f.objectUrl} alt={f.fileName} style={{ width: '100%', borderRadius: '4px', marginBottom: '4px' }} />
                  <div style={{ fontSize: '12px', wordBreak: 'break-all' }}>{f.fileName}</div>
                </div>
              )
            } else if (isVideo) {
              icon = <Play size={16} />
              hoverContent = (
                <div style={{ padding: '4px', maxWidth: '200px' }}>
                  <video src={f.objectUrl} style={{ width: '100%', borderRadius: '4px', marginBottom: '4px' }} />
                  <div style={{ fontSize: '12px', wordBreak: 'break-all' }}>{f.fileName}</div>
                </div>
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
                <TooltipContent side="top" sideOffset={5} style={{ zIndex: 100 }}>
                  {hoverContent}
                </TooltipContent>
              </Tooltip>
            )
          })}

          {/* Render active transfers */}
          {activeTransfers.map((t, i) => (
            <Tooltip key={t.id || i}>
              <TooltipTrigger style={style.iconSlot}>
                {t.status === 'failed' ? <AlertCircle size={16} color="var(--cy-warning)" /> : <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--cy-text-secondary)', animation: 'pulse 2s infinite' }}>download</span>}
                {t.status === 'transferring' && (
                  <div style={{ ...style.progressOverlay, width: `${t.progress}%` }} />
                )}
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={5}>
                <div style={{ fontSize: '12px', padding: '2px' }}>
                  Receiving {t.fileName}... ({t.progress}%)
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Full screen modal */}
        {viewingFile && viewingFile.objectUrl && (
          <FileModal
            url={viewingFile.objectUrl}
            fileName={viewingFile.fileName}
            mimeType={viewingFile.mimeType}
            onClose={() => setViewingFile(null)}
          />
        )}
      </div>
    </TooltipProvider>
  )
}
