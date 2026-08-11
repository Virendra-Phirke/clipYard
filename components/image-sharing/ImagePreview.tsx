/**
 * components/image-sharing/ImagePreview.tsx
 *
 * Pre-send preview card showing thumbnail, metadata, peer selector,
 * and send/remove buttons.
 */

'use client'

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { WebRTCPeer } from '@/hooks/useWebRTC'

interface ImagePreviewProps {
  file: File
  peers: WebRTCPeer[]
  onSend: (targetPeerId?: string) => void
  onRemove: () => void
  sending?: boolean
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
    transition: 'border-color 0.2s ease',
  },
  imageContainer: {
    width: '100%',
    maxHeight: '240px',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--cy-surface-container)',
  },
  img: {
    maxWidth: '100%',
    maxHeight: '240px',
    objectFit: 'contain',
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  meta: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
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
  fileInfo: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--cy-text-muted)',
    letterSpacing: '0.02em',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1.5px solid var(--cy-border)',
    backgroundColor: 'var(--cy-surface-container)',
  },
  sendBtn: {
    flex: 1,
    backgroundColor: 'var(--cy-primary)',
    color: 'var(--cy-on-primary)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-primary)',
    cursor: 'pointer',
    textTransform: 'uppercase',
    transition: 'background-color 0.2s ease',
  },
  removeBtn: {
    backgroundColor: 'transparent',
    color: 'var(--cy-secondary-text)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    cursor: 'pointer',
    textTransform: 'uppercase',
    transition: 'background-color 0.2s ease',
  },
}

export default function ImagePreview({
  file,
  peers,
  onSend,
  onRemove,
  sending,
}: ImagePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null)
  const [isImgHovered, setIsImgHovered] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const urlRef = useRef<string | null>(null)

  const connectedPeers = useMemo(
    () => peers.filter((p) => p.status === 'connected' && p.channel?.readyState === 'open'),
    [peers],
  )

  // Create preview URL
  useEffect(() => {
    const url = URL.createObjectURL(file)
    urlRef.current = url
    setPreviewUrl(url)

    // Get dimensions
    const img = new Image()
    img.onload = () => {
      setDimensions({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = url

    return () => {
      URL.revokeObjectURL(url)
      urlRef.current = null
    }
  }, [file])

  const handleSend = () => {
    if (sending) return
    onSend()
  }

  const noPeers = connectedPeers.length === 0

  return (
    <div
      style={{
        ...S.card,
        borderColor: isHovered ? 'var(--cy-border-strong)' : 'var(--cy-border)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Thumbnail */}
      {previewUrl && (
        <div
          style={S.imageContainer}
          onMouseEnter={() => setIsImgHovered(true)}
          onMouseLeave={() => setIsImgHovered(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={`Preview of ${file.name}`}
            style={{
              ...S.img,
              transform: isImgHovered ? 'scale(1.02)' : 'scale(1)',
            }}
          />
        </div>
      )}

      {/* Metadata */}
      <div style={S.meta}>
        <div style={S.fileName} title={file.name}>{file.name || 'image'}</div>
        <div style={S.fileInfo}>
          {formatBytes(file.size)}
          {dimensions ? ` · ${dimensions.w}×${dimensions.h}` : ''}
        </div>
      </div>

      {/* Actions */}
      <div style={S.actions}>
        <button
          onClick={onRemove}
          style={S.removeBtn}
          disabled={sending}
          type="button"
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--cy-surface-container)' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
        >
          Remove
        </button>
        <button
          onClick={handleSend}
          style={{
            ...S.sendBtn,
            opacity: noPeers || sending ? 0.5 : 1,
            cursor: noPeers || sending ? 'not-allowed' : 'pointer',
          }}
          disabled={noPeers || sending}
          type="button"
          title={noPeers ? 'No peers connected' : undefined}
          onMouseEnter={(e) => {
            if (!noPeers && !sending) e.currentTarget.style.backgroundColor = 'var(--cy-primary-hover)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--cy-primary)'
          }}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
