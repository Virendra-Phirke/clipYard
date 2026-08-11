/**
 * components/image-sharing/ReceivedImageCard.tsx
 *
 * Card for a completed received image.
 * Shows preview, metadata, sender info, and download/open buttons.
 */

'use client'

import { useState, type CSSProperties } from 'react'
import type { Transfer } from '@/lib/webrtc/types'

interface ReceivedImageCardProps {
  transfer: Transfer
  onDownload: (transfer: Transfer) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const S: Record<string, CSSProperties> = {
  card: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--cy-surface)',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    borderColor: 'var(--cy-border)',
    borderRadius: '4px',
    overflow: 'hidden',
    transition: 'border-color 0.2s ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  imageContainer: {
    width: '100%',
    maxHeight: '200px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--cy-surface-container)',
    cursor: 'pointer',
  },
  img: {
    maxWidth: '100%',
    maxHeight: '200px',
    objectFit: 'contain',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  body: {
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  fileName: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text)',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: '14px',
    color: 'var(--cy-text-muted)',
    letterSpacing: '0.02em',
  },
  actions: {
    display: 'flex',
    gap: '6px',
    padding: '8px 14px',
    borderTop: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-container)',
  },
  downloadBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    backgroundColor: 'var(--cy-primary)',
    color: 'var(--cy-on-primary)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-primary)',
    cursor: 'pointer',
    textTransform: 'uppercase',
    transition: 'background-color 0.2s ease',
  },
  openBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    backgroundColor: 'transparent',
    color: 'var(--cy-secondary-text)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    cursor: 'pointer',
    textTransform: 'uppercase',
    transition: 'background-color 0.2s ease',
  },
}

export default function ReceivedImageCard({
  transfer,
  onDownload,
}: ReceivedImageCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isImgHovered, setIsImgHovered] = useState(false)

  const handleOpen = () => {
    if (transfer.objectUrl) {
      window.open(transfer.objectUrl, '_blank', 'noopener')
    }
  }

  return (
    <div
      style={{
        ...S.card,
        borderColor: isHovered ? 'var(--cy-border-strong)' : 'var(--cy-border)',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Preview thumbnail */}
      {transfer.objectUrl && (
        <div
          style={S.imageContainer}
          onClick={handleOpen}
          title="Click to open full size"
          onMouseEnter={() => setIsImgHovered(true)}
          onMouseLeave={() => setIsImgHovered(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={transfer.objectUrl}
            alt={`Received: ${transfer.fileName}`}
            style={{
              ...S.img,
              transform: isImgHovered ? 'scale(1.05)' : 'scale(1)',
            }}
          />
        </div>
      )}

      {/* File metadata */}
      <div style={S.body}>
        <div style={S.fileName} title={transfer.fileName}>
          {transfer.fileName}
        </div>
        <div style={S.meta}>
          {formatBytes(transfer.fileSize)} · From {transfer.peerName}
        </div>
      </div>

      {/* Action buttons */}
      <div style={S.actions}>
        <button
          onClick={() => onDownload(transfer)}
          style={S.downloadBtn}
          type="button"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--cy-primary-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--cy-primary)'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
            download
          </span>
          Download
        </button>
        <button
          onClick={handleOpen}
          style={S.openBtn}
          type="button"
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--cy-surface-container)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
            open_in_new
          </span>
          Open
        </button>
      </div>
    </div>
  )
}
