'use client'

import { type CSSProperties, useEffect } from 'react'
import { getFileCategory } from '@/lib/webrtc/fileTransfer'
import { Download } from 'lucide-react'
import { WaveformPlayer } from './WaveformPlayer'

/**
 * Props for the FileModal component.
 */
interface FileModalProps {
  url: string
  fileName: string
  mimeType: string
  onClose: () => void
}

const S: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    backdropFilter: 'blur(4px)',
  },
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
  closeBtn: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  downloadBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'var(--cy-primary)',
    color: 'var(--cy-primary-foreground)',
    padding: '6px 12px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    fontSize: '13px',
    fontWeight: 500,
    transition: 'opacity 0.2s',
  },
  mediaContainer: {
    position: 'relative',
    maxWidth: '100%',
    maxHeight: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    maxWidth: '100%',
    maxHeight: 'calc(100vh - 48px)',
    objectFit: 'contain',
    borderRadius: '4px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  iframe: {
    width: '80vw',
    height: '80vh',
    backgroundColor: '#fff',
    border: 'none',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  audioTitle: {
    color: 'var(--cy-text)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '16px',
    textAlign: 'center',
    maxWidth: '300px',
    wordBreak: 'break-word',
  },
}

export const FileModal = ({ url, fileName, mimeType, onClose }: FileModalProps) => {
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

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.header} onClick={(e) => e.stopPropagation()}>
        <div style={S.title}>{fileName}</div>
        <div style={S.headerActions}>
          <a
            href={url}
            download={fileName}
            style={S.downloadBtn}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <Download size={16} />
            Download
          </a>
          <button
            style={S.closeBtn}
            onClick={onClose}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)' }}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      </div>
      
      <div style={S.mediaContainer} onClick={(e) => e.stopPropagation()}>
        {category === 'video' ? (
          <video src={url} controls autoPlay style={S.media} />
        ) : category === 'audio' ? (
          <div style={{ background: 'var(--cy-surface)', padding: '24px', borderRadius: '12px', border: '1px solid var(--cy-border)' }}>
            <WaveformPlayer url={url} fileName={fileName} />
          </div>
        ) : category === 'document' || category === 'file' ? (
          <iframe src={url} style={S.iframe} title={fileName} />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={url} alt={fileName} style={S.media} />
        )}
      </div>
    </div>
  )
}
