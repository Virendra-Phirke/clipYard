'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ImageIcon,
  Camera,
  Music,
  FileText,
  Plus,
  SwitchCamera,
  Download,
  X,
} from 'lucide-react'
import {
  getAudioContext,
  computePeaks,
} from '@/lib/webrtc/audioUtils'
import { WaveformPlayer } from './WaveformPlayer'

/* ────────────────────────────── Types ────────────────────────────── */

interface AttachmentMenuProps {
  /** Called with each file the user selects / captures. */
  onFilesSelected: (files: File[]) => void
  disabled?: boolean
}

interface ImageAttachment {
  type: 'image'
  dataUrl: string
  fileName: string
  file: File
}

interface AudioAttachment {
  type: 'audio'
  objectUrl: string
  fileName: string
  file: File
  duration: number
  peaksSmall: number[]
  peaksLarge: number[]
}

interface DocumentAttachment {
  type: 'document'
  objectUrl: string
  fileName: string
  ext: string
  file: File
}

type Attachment = ImageAttachment | AudioAttachment | DocumentAttachment

/* ─────────────────────── Canvas / Waveform Utils ─────────────────────── */

const MAX_ATTACHMENTS = 5

/* ─────────────────────────── Inline Styles ─────────────────────────── */

const style: Record<string, CSSProperties> = {
  triggerBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '2rem',
    width: '2rem',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    background: 'transparent',
    color: 'var(--cy-text)',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    flexShrink: 0,
  },
  row: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginLeft: '8px',
    flexWrap: 'wrap' as const,
  },
  imageSlot: {
    position: 'relative',
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    border: '1px solid var(--cy-border)',
    overflow: 'hidden',
    cursor: 'pointer',
    flexShrink: 0,
  },
  slotImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    display: 'block',
  },
  audioSlot: {
    position: 'relative',
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    border: '1px solid var(--cy-border)',
    background: 'var(--cy-surface-container)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docSlot: {
    position: 'relative',
    width: '32px',
    height: '32px',
    borderRadius: '4px',
    border: '1px solid var(--cy-border)',
    background: 'var(--cy-surface-container)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    gap: '1px',
  },
  docExt: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '7px',
    fontWeight: 600,
    letterSpacing: '0.02em',
    color: 'var(--cy-text-muted)',
    textTransform: 'uppercase' as const,
    lineHeight: 1,
    maxWidth: '28px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  removeBtn: {
    position: 'absolute',
    top: '-4px',
    right: '-4px',
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    border: '1px solid var(--cy-border)',
    background: 'var(--cy-surface)',
    color: 'var(--cy-text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    padding: 0,
    zIndex: 2,
  },
  /* Camera dialog */
  cameraWrap: {
    width: '100%',
    aspectRatio: '4 / 3',
    borderRadius: '8px',
    background: 'var(--cy-surface-container)',
    overflow: 'hidden',
    position: 'relative',
  },
  cameraVideo: {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    transform: 'scaleX(-1)',
  },
  cameraVideoRear: {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    transform: 'none',
  },
  cameraControls: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '12px',
  },
  shutterBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '3rem',
    height: '3rem',
    borderRadius: '50%',
    border: '3px solid var(--cy-border)',
    background: 'var(--cy-surface)',
    cursor: 'pointer',
    padding: 0,
    transition: 'transform 0.1s ease',
  },
  shutterInner: {
    width: '2.25rem',
    height: '2.25rem',
    borderRadius: '50%',
    background: 'var(--cy-text)',
  },
  switchBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2rem',
    height: '2rem',
    borderRadius: '50%',
    border: '1px solid var(--cy-border)',
    background: 'var(--cy-surface)',
    color: 'var(--cy-text)',
    cursor: 'pointer',
  },
}

/* ═══════════════════════════ COMPONENT ═══════════════════════════ */

export function AttachmentMenu({ onFilesSelected, disabled }: AttachmentMenuProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const photosInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  /* Camera state */
  const [cameraOpen, setCameraOpen] = useState(false)
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)

  /* Image preview dialog */
  const [previewImage, setPreviewImage] = useState<ImageAttachment | null>(null)

  /* Audio player state */
  const [playingAudio, setPlayingAudio] = useState<AudioAttachment | null>(null)

  /* ── file inputs ── */
  const addAttachment = useCallback(
    (att: Attachment) => {
      setAttachments((prev) => {
        if (prev.length >= MAX_ATTACHMENTS) return prev
        return [...prev, att]
      })
      onFilesSelected([att.file])
    },
    [onFilesSelected],
  )

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => {
      const copy = [...prev]
      const removed = copy.splice(index, 1)[0]
      if (removed && 'objectUrl' in removed) URL.revokeObjectURL(removed.objectUrl)
      return copy
    })
  }, [])

  /* Photos & videos */
  const handlePhotos = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      files.forEach((file) => {
        const reader = new FileReader()
        reader.onload = (ev) => {
          addAttachment({
            type: 'image',
            dataUrl: ev.target?.result as string,
            fileName: file.name,
            file,
          })
        }
        reader.readAsDataURL(file)
      })
      if (photosInputRef.current) photosInputRef.current.value = ''
    },
    [addAttachment],
  )

  /* Audio */
  const handleAudio = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      for (const file of files) {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const ctx = getAudioContext()
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
          addAttachment({
            type: 'audio',
            objectUrl: URL.createObjectURL(file),
            fileName: file.name,
            file,
            duration: audioBuffer.duration,
            peaksSmall: computePeaks(audioBuffer, 20),
            peaksLarge: computePeaks(audioBuffer, 80),
          })
        } catch {
          // Skip files that can't be decoded
        }
      }
      if (audioInputRef.current) audioInputRef.current.value = ''
    },
    [addAttachment],
  )

  /* Documents */
  const handleDocument = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      files.forEach((file) => {
        const ext = (file.name.split('.').pop() || 'file').slice(0, 4)
        addAttachment({
          type: 'document',
          objectUrl: URL.createObjectURL(file),
          fileName: file.name,
          ext,
          file,
        })
      })
      if (docInputRef.current) docInputRef.current.value = ''
    },
    [addAttachment],
  )

  /* ── Camera ── */
  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop())
      cameraStreamRef.current = null
    }
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = null
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(
    async (facing: 'user' | 'environment') => {
      stopCamera()
      setCameraError(null)
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: false,
        })
        cameraStreamRef.current = stream
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
        }
        setCameraReady(true)

        // Check for multiple cameras
        if (navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices()
          setHasMultipleCameras(
            devices.filter((d) => d.kind === 'videoinput').length > 1,
          )
        }
      } catch (err: any) {
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Camera access was denied.'
            : 'No camera could be found.',
        )
      }
    },
    [stopCamera],
  )

  const openCamera = useCallback(() => {
    setFacingMode('user')
    setCameraOpen(true)
  }, [])

  useEffect(() => {
    if (cameraOpen) {
      startCamera(facingMode)
    }
    return () => {
      if (cameraOpen) stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen, facingMode])

  const capturePhoto = useCallback(() => {
    const video = cameraVideoRef.current
    const canvas = captureCanvasRef.current
    if (!video || !canvas || !cameraStreamRef.current) return
    const w = video.videoWidth
    const h = video.videoHeight
    if (!w || !h) return
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (facingMode === 'user') {
      ctx.translate(w, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, w, h)
    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `photo-${Date.now()}.png`, { type: 'image/png' })
      const dataUrl = canvas.toDataURL('image/png')
      addAttachment({ type: 'image', dataUrl, fileName: file.name, file })
      setCameraOpen(false)
    }, 'image/png')
  }, [facingMode, addAttachment])

  const downloadAttachment = useCallback((att: Attachment) => {
    const url = att.type === 'image' ? att.dataUrl : att.objectUrl
    const link = document.createElement('a')
    link.href = url
    link.download = att.fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }, [])

  const isFull = attachments.length >= MAX_ATTACHMENTS

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={disabled || isFull}
            style={{
              ...style.triggerBtn,
              opacity: disabled || isFull ? 0.4 : 1,
              cursor: disabled || isFull ? 'not-allowed' : 'pointer',
            }}
            aria-label="Attach file"
            id="attachment-menu-trigger"
          >
            <Plus size={16} />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" sideOffset={8} align="start">
            <DropdownMenuItem style={{ padding: 0 }}>
              <label htmlFor="attach-photos" style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer', padding: '0.25rem 0.375rem' }}>
                <ImageIcon size={16} className="text-muted-foreground" style={{ marginRight: '8px' }} />
                Photos &amp; videos
              </label>
            </DropdownMenuItem>
            <DropdownMenuItem
              id="attach-camera"
              onSelect={(e) => {
                if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
                  openCamera()
                } else {
                  // Fallback: don't close the menu, let the user click the photos option
                  photosInputRef.current?.click()
                }
              }}
            >
              <Camera size={16} className="text-muted-foreground" style={{ marginRight: '8px' }} />
              Camera
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem style={{ padding: 0 }}>
              <label htmlFor="attach-audio" style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer', padding: '0.25rem 0.375rem' }}>
                <Music size={16} className="text-muted-foreground" style={{ marginRight: '8px' }} />
                Audio
              </label>
            </DropdownMenuItem>
            <DropdownMenuItem style={{ padding: 0 }}>
              <label htmlFor="attach-document" style={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer', padding: '0.25rem 0.375rem' }}>
                <FileText size={16} className="text-muted-foreground" style={{ marginRight: '8px' }} />
                Document
              </label>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hidden file inputs */}
        <input
          id="attach-photos"
          ref={photosInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          style={{ display: 'none' }}
          onChange={handlePhotos}
        />
        <input
          id="attach-audio"
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleAudio}
        />
        <input
          id="attach-document"
          ref={docInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.zip,.rar,.odt,.odp,.ods"
          multiple
          style={{ display: 'none' }}
          onChange={handleDocument}
        />

        {/* Thumbnail row */}
        {attachments.length > 0 && (
          <div style={style.row}>
            {attachments.map((att, i) => {
              if (att.type === 'image') {
                return (
                  <div
                    key={`img-${i}`}
                    style={style.imageSlot}
                    onClick={() => setPreviewImage(att)}
                    title={att.fileName}
                  >
                    <img
                      src={att.dataUrl}
                      alt={att.fileName}
                      style={style.slotImg}
                    />
                    <button
                      style={style.removeBtn as CSSProperties}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeAttachment(i)
                      }}
                      aria-label="Remove"
                    >
                      <X size={8} />
                    </button>
                  </div>
                )
              }
              if (att.type === 'audio') {
                return (
                  <div
                    key={`aud-${i}`}
                    style={style.audioSlot}
                    onClick={() => setPlayingAudio(att)}
                    title={att.fileName}
                  >
                    <Music size={14} style={{ color: 'var(--cy-text-muted)' }} />
                    <button
                      style={style.removeBtn as CSSProperties}
                      onClick={(e) => {
                        e.stopPropagation()
                        removeAttachment(i)
                      }}
                      aria-label="Remove"
                    >
                      <X size={8} />
                    </button>
                  </div>
                )
              }
              /* document */
              return (
                <div
                  key={`doc-${i}`}
                  style={style.docSlot}
                  onClick={() => downloadAttachment(att)}
                  title={att.fileName}
                >
                  <FileText size={12} style={{ color: 'var(--cy-text-muted)' }} />
                  <span style={style.docExt}>{att.ext}</span>
                  <button
                    style={style.removeBtn as CSSProperties}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeAttachment(i)
                    }}
                    aria-label="Remove"
                  >
                    <X size={8} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Hidden capture canvas */}
      <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

      {/* ── Camera Dialog ── */}
      <Dialog open={cameraOpen} onOpenChange={(open) => { if (!open) setCameraOpen(false) }}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogTitle>Take a Photo</DialogTitle>
          <div style={style.cameraWrap}>
            {cameraError ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  padding: '16px',
                  textAlign: 'center',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '13px',
                  color: 'var(--cy-text-muted)',
                }}
              >
                {cameraError}
              </div>
            ) : (
              <video
                ref={cameraVideoRef}
                autoPlay
                playsInline
                muted
                style={
                  facingMode === 'user'
                    ? style.cameraVideo
                    : style.cameraVideoRear
                }
              />
            )}
          </div>
          <div style={style.cameraControls}>
            {hasMultipleCameras && (
              <button
                style={style.switchBtn}
                onClick={() =>
                  setFacingMode((f) =>
                    f === 'user' ? 'environment' : 'user',
                  )
                }
                aria-label="Switch camera"
              >
                <SwitchCamera size={16} />
              </button>
            )}
            <button
              style={style.shutterBtn}
              onClick={capturePhoto}
              disabled={!cameraReady}
              aria-label="Take photo"
            >
              <div style={style.shutterInner} />
            </button>
            {/* Spacer for centering */}
            {hasMultipleCameras && <div style={{ width: '2rem' }} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Image Preview Dialog ── */}
      <Dialog
        open={!!previewImage}
        onOpenChange={(open) => { if (!open) setPreviewImage(null) }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogTitle className="sr-only">Image Preview</DialogTitle>
          {previewImage && (
            <>
              <img
                src={previewImage.dataUrl}
                alt={previewImage.fileName}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  borderRadius: '8px',
                  objectFit: 'contain',
                }}
              />
              <button
                onClick={() => downloadAttachment(previewImage)}
                style={{
                  ...style.switchBtn,
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                }}
                aria-label="Download"
              >
                <Download size={14} />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Audio Player Dialog ── */}
      {playingAudio && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent'
          }}
          onClick={() => setPlayingAudio(null)}
        >
          <div style={{ background: '#1c1c1c', padding: '16px', borderRadius: '12px', border: '1px solid var(--cy-border)' }} onClick={(e) => e.stopPropagation()}>
            <WaveformPlayer 
              url={playingAudio.objectUrl} 
              fileName={playingAudio.fileName} 
              blob={playingAudio.file} 
              onClose={() => setPlayingAudio(null)} 
              onDownload={() => downloadAttachment(playingAudio)}
            />
          </div>
        </div>
      )}
    </>
  )
}
