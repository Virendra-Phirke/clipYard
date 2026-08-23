'use client'

import { type CSSProperties } from 'react'
import { FileUp, Image, FileText, Video, Music, Sparkles } from 'lucide-react'

interface ClipboardDropOverlayProps {
  isDragging: boolean
}

const style: Record<string, CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 40,
    borderRadius: '4px',
    backgroundColor: 'rgba(0, 36, 28, 0.88)',
    backdropFilter: 'blur(8px)',
    border: '2px dashed var(--cy-primary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '24px',
    boxShadow: 'inset 0 0 32px rgba(22, 133, 106, 0.25), 0 0 20px rgba(0, 106, 83, 0.3)',
    pointerEvents: 'none', // Allow parent dropzone to capture drop
    animation: 'cy-fade-in 0.15s ease-out',
    boxSizing: 'border-box',
  },
  iconHalo: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: 'var(--cy-surface-container)',
    border: '1.5px solid var(--cy-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(110, 231, 183, 0.35)',
    color: 'var(--cy-primary)',
  },
  title: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: '20px',
    fontWeight: 700,
    color: '#ffffff',
    letterSpacing: '-0.01em',
    textAlign: 'center',
    margin: 0,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  subtitle: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '13px',
    color: 'var(--cy-primary-fixed-dim, #78d8b9)',
    letterSpacing: '0.02em',
    textAlign: 'center',
    margin: 0,
    maxWidth: '420px',
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '4px',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(110, 231, 183, 0.3)',
    fontFamily: 'Space Mono, monospace',
    fontSize: '11px',
    color: '#e5e5e5',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  footerNote: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
}

export function ClipboardDropOverlay({ isDragging }: ClipboardDropOverlayProps) {
  if (!isDragging) return null

  return (
    <div style={style.overlay} aria-hidden="true">
      <div style={style.iconHalo}>
        <FileUp size={32} className="animate-bounce" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
        <h4 style={style.title}>
          <span>◈</span> Drop to Beam to Room
        </h4>
        <p style={style.subtitle}>
          Release files here to send directly to all connected peers
        </p>
      </div>

      <div style={style.badgeRow}>
        <span style={style.badge}>
          <Image size={13} style={{ color: '#6ee7b7' }} /> Images
        </span>
        <span style={style.badge}>
          <FileText size={13} style={{ color: '#93c5fd' }} /> Documents &amp; PDFs
        </span>
        <span style={style.badge}>
          <Video size={13} style={{ color: '#fca5a5' }} /> Videos
        </span>
        <span style={style.badge}>
          <Music size={13} style={{ color: '#fde047' }} /> Audio
        </span>
      </div>

      <div style={style.footerNote}>
        <Sparkles size={12} style={{ color: 'var(--cy-primary)' }} />
        Direct P2P WebRTC Transfer • Up to 50 MB
      </div>
    </div>
  )
}
