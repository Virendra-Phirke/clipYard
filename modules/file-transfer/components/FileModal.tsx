'use client'

import { type CSSProperties, useEffect } from 'react'
import { getFileCategory } from '@/lib/webrtc/fileTransfer'
import { Download, X } from 'lucide-react'
import { WaveformPlayer } from './WaveformPlayer'
import { CustomVideoPlayer } from './CustomVideoPlayer'

/**
 * Props for the FileModal component.
 */
interface FileModalProps {
  url: string
  fileName: string
  mimeType: string
  blob?: Blob
  onClose: () => void
}

const S: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  audioOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    backgroundColor: 'transparent',
  },
  // Image container — holds the image + overlaid action buttons
  imageWrapper: {
    position: 'relative',
    maxWidth: '90vw',
    maxHeight: '90vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '90vh',
    objectFit: 'contain',
    borderRadius: '6px',
    display: 'block',
  },
  // Floating action buttons container — top-right of image
  actions: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    zIndex: 2,
  },
  actionBtn: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s, transform 0.15s',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    color: '#fff',
  },
  // Video/document header (kept for non-image media)
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
    zIndex: 2,
  },
  title: {
    color: '#fff',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    fontWeight: 500,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  mediaContainer: {
    position: 'relative',
    maxWidth: '100%',
    maxHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iframe: {
    width: '80vw',
    height: '80vh',
    backgroundColor: '#fff',
    border: 'none',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
}

export const FileModal = ({ url, fileName, mimeType, blob, onClose }: FileModalProps) => {
  const category = getFileCategory(mimeType)

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Prevent scrolling on body when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  // Audio — uses custom waveform player
  if (category === 'audio') {
    return (
      <div style={S.audioOverlay} onClick={onClose}>
        <div style={{ background: '#1c1c1c', padding: '16px', borderRadius: '12px', border: '1px solid var(--cy-border)' }} onClick={(e) => e.stopPropagation()}>
          <WaveformPlayer url={url} fileName={fileName} blob={blob} onClose={onClose} onDownload={handleDownload} />
        </div>
      </div>
    )
  }

  // Image — clean modal with overlaid download + close on top-right
  if (category === 'image') {
    return (
      <div style={S.overlay} onClick={onClose}>
        <div style={S.imageWrapper} onClick={(e) => e.stopPropagation()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={fileName} style={S.image} />

          {/* Download + Close overlaid on top-right of the image */}
          <div style={S.actions}>
            <button
              style={S.actionBtn}
              onClick={handleDownload}
              title="Download"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.75)'
                e.currentTarget.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.55)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <Download size={18} />
            </button>
            <button
              style={S.actionBtn}
              onClick={onClose}
              title="Close"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.75)'
                e.currentTarget.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.55)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Video / Document / Other — keep header-style layout
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.header} onClick={(e) => e.stopPropagation()}>
        <div style={S.title}>{fileName}</div>
        <div style={S.headerActions}>
          <button
            style={S.actionBtn}
            onClick={handleDownload}
            title="Download"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.75)'
              e.currentTarget.style.transform = 'scale(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.55)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            <Download size={18} />
          </button>
          <button
            style={S.actionBtn}
            onClick={onClose}
            title="Close"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.75)'
              e.currentTarget.style.transform = 'scale(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.55)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>
      
      <div style={S.mediaContainer} onClick={(e) => e.stopPropagation()}>
        {category === 'video' ? (
          <CustomVideoPlayer url={url} />
        ) : (
          <iframe src={url} style={S.iframe} title={fileName} />
        )}
      </div>
    </div>
  )
}

