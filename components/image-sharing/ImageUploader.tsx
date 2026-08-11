/**
 * components/image-sharing/ImageUploader.tsx
 *
 * Drop zone + file picker + clipboard paste handler for image selection.
 * Validates image type and size immediately on selection.
 */

'use client'

import { useCallback, useRef, useState, useEffect, type CSSProperties } from 'react'
import { validateImage } from '@/lib/webrtc/fileTransfer'

interface ImageUploaderProps {
  onImageSelected: (file: File) => void
  disabled?: boolean
}

const styles: Record<string, CSSProperties> = {
  dropZone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '48px 24px',
    borderWidth: '2px',
    borderStyle: 'dashed',
    borderColor: 'var(--cy-border)',
    borderRadius: '12px',
    backgroundColor: 'var(--cy-surface)',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
    minHeight: '180px',
    userSelect: 'none',
    outline: 'none',
    position: 'relative',
    overflow: 'hidden',
  },
  dropZoneActive: {
    borderColor: 'var(--cy-primary)',
    backgroundColor: 'var(--cy-surface-container)',
    transform: 'scale(1.02)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
  },
  dropZoneDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    transform: 'none',
  },
  iconContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: 'var(--cy-surface-container)',
    color: 'var(--cy-text-secondary)',
    transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.3s ease, color 0.3s ease',
  },
  iconContainerHovered: {
    transform: 'scale(1.1) translateY(-4px)',
    backgroundColor: 'var(--cy-surface-container-high, rgba(255,255,255,0.05))',
    color: 'var(--cy-text-primary)',
  },
  iconContainerActive: {
    transform: 'scale(1.15) translateY(2px)',
    backgroundColor: 'var(--cy-primary)',
    color: 'var(--cy-background)',
  },
  label: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--cy-text-primary)',
    textAlign: 'center',
    letterSpacing: '0.01em',
  },
  labelHighlight: {
    color: 'var(--cy-primary)',
  },
  sublabel: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    lineHeight: '1.6',
    color: 'var(--cy-text-muted)',
    textAlign: 'center',
    letterSpacing: '0.02em',
    maxWidth: '280px',
  },
  error: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    lineHeight: '16px',
    color: 'var(--cy-error)',
    padding: '10px 14px',
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    border: '1.5px solid var(--cy-error)',
    borderRadius: '6px',
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
}

export default function ImageUploader({ onImageSelected, disabled }: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragCounterRef = useRef(0)

  const processFile = useCallback((file: File) => {
    setError(null)
    const validation = validateImage(file)
    if (!validation.valid) {
      setError(validation.error || 'Invalid image')
      return
    }
    onImageSelected(file)
  }, [onImageSelected])

  const handleClick = () => {
    if (disabled) return
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    // Reset so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    dragCounterRef.current++
    if (dragCounterRef.current === 1) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
    if (disabled) return

    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  // Clipboard paste handler
  useEffect(() => {
    if (disabled) return

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) processFile(file)
          return
        }
      }
      // Non-image paste — don't interfere with the clipboard textarea
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [disabled, processFile])

  const zoneStyle: CSSProperties = {
    ...styles.dropZone,
    ...(isDragging ? styles.dropZoneActive : {}),
    ...(!isDragging && isHovered && !disabled ? { borderColor: 'var(--cy-border-strong)', backgroundColor: 'var(--cy-surface-container-low)' } : {}),
    ...(isFocused && !disabled ? { boxShadow: '0 0 0 2px var(--cy-background), 0 0 0 4px var(--cy-primary)' } : {}),
    ...(disabled ? styles.dropZoneDisabled : {}),
  }

  return (
    <div>
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={zoneStyle}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
        aria-label="Select or drop an image to share"
      >
        <div style={{
          ...styles.iconContainer,
          ...(isHovered && !isDragging && !disabled ? styles.iconContainerHovered : {}),
          ...(isDragging && !disabled ? styles.iconContainerActive : {})
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>
            {isDragging ? 'file_download' : 'add_photo_alternate'}
          </span>
        </div>
        
        <span style={styles.label}>
          {isDragging ? 'Drop it like it\'s hot!' : (
            <>Drop image here or <span style={styles.labelHighlight}>click to browse</span></>
          )}
        </span>
        <span style={styles.sublabel}>
          Paste (Ctrl+V) · Max 10 MB <br/>
          JPEG, PNG, WebP, GIF, SVG
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/svg+xml"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          aria-hidden
          tabIndex={-1}
        />
      </div>
      {error && (
        <div style={styles.error}>
          <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>error</span>
          {error}
        </div>
      )}
    </div>
  )
}
