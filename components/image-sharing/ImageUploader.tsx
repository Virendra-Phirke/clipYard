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
    gap: '12px',
    padding: '32px 24px',
    borderWidth: '2px',
    borderStyle: 'dashed',
    borderColor: 'var(--cy-border)',
    borderRadius: '4px',
    backgroundColor: 'var(--cy-surface)',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    minHeight: '120px',
    userSelect: 'none',
    outline: 'none',
  },
  dropZoneActive: {
    borderColor: 'var(--cy-primary)',
    backgroundColor: 'var(--cy-surface-container)',
    transform: 'scale(1.02)',
  },
  dropZoneDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  icon: {
    fontSize: '28px',
    color: 'var(--cy-text-muted)',
  },
  label: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    textAlign: 'center',
    letterSpacing: '0.02em',
  },
  sublabel: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    lineHeight: '16px',
    color: 'var(--cy-text-muted)',
    textAlign: 'center',
    letterSpacing: '0.02em',
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
    marginTop: '8px',
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
        <span className="material-symbols-outlined" style={styles.icon}>
          add_photo_alternate
        </span>
        <span style={styles.label}>
          {isDragging ? 'Drop image here' : 'Drop image here or click to browse'}
        </span>
        <span style={styles.sublabel}>
          Ctrl+V to paste · Max 10 MB · JPEG, PNG, WebP, GIF, BMP, SVG
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
      {error && <div style={styles.error}>{error}</div>}
    </div>
  )
}
