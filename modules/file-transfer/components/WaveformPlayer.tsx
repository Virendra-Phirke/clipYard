'use client'

import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
import { Play, Pause, Download, X } from 'lucide-react'
import { getAudioContext, computePeaks, drawWaveform, formatTime, getWaveformColors } from '@/lib/webrtc/audioUtils'

interface WaveformPlayerProps {
  url: string
  fileName: string
  blob?: Blob
  onClose?: () => void
  onDownload?: () => void
}

const style: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '320px',
    maxWidth: '90vw',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  topBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--cy-text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px',
    transition: 'color 0.2s',
  },
  extText: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '12px',
    fontWeight: 500,
  },
  waveformWrap: {
    position: 'relative',
    width: '100%',
    height: '40px',
    cursor: 'pointer',
    marginBottom: '8px',
  },
  audioControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  playBtn: {
    background: 'none',
    border: '1px solid var(--cy-border)',
    borderRadius: '50%',
    color: 'var(--cy-text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    transition: 'color 0.2s',
  },
  audioTime: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    color: 'var(--cy-text-secondary)',
  },
  loading: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '11px',
    color: 'var(--cy-text-secondary)',
    textAlign: 'center',
    marginTop: '12px',
    animation: 'pulse 2s infinite',
  }
}

export function WaveformPlayer({ url, fileName, blob, onClose, onDownload }: WaveformPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [loading, setLoading] = useState(true)

  const ext = fileName.split('.').pop()?.toLowerCase() || 'audio'

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number>(0)

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null)
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const startTimeRef = useRef<number>(0)
  const pausedAtRef = useRef<number>(0)

  // 1. Fetch, decode, and compute peaks
  useEffect(() => {
    let active = true
    const initAudio = async () => {
      try {
        setLoading(true)
        let arrayBuffer: ArrayBuffer
        if (blob) {
          arrayBuffer = await blob.arrayBuffer()
        } else {
          const res = await fetch(url)
          if (!res.ok) throw new Error('Network response was not ok')
          arrayBuffer = await res.arrayBuffer()
        }
        if (!active) return
        const ctx = getAudioContext()
        audioCtxRef.current = ctx
        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer)
        if (!active) return
        setAudioBuffer(decodedBuffer)
        setDuration(decodedBuffer.duration)
        setPeaks(computePeaks(decodedBuffer, 80))
        setLoading(false)
      } catch (err) {
        console.warn('Failed to decode audio for waveform preview:', err)
        setLoading(false)
      }
    }
    initAudio()
    return () => {
      active = false
    }
  }, [url])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.onended = null
        try { sourceNodeRef.current.stop() } catch (e) {}
        try { sourceNodeRef.current.disconnect() } catch (e) {}
        sourceNodeRef.current = null
      }
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // 3. RAF loop for waveform progress
  useEffect(() => {
    if (!peaks || !isPlaying || !audioCtxRef.current || !audioBuffer) return
    function tick() {
      const canvas = canvasRef.current
      if (canvas && peaks && audioCtxRef.current && audioBuffer) {
        const elapsed = audioCtxRef.current.currentTime - startTimeRef.current
        const current = pausedAtRef.current + elapsed
        setAudioCurrentTime(current)
        const progress = audioBuffer.duration ? current / audioBuffer.duration : 0
        drawWaveform(canvas, peaks as number[], progress, getWaveformColors())
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isPlaying, peaks, audioBuffer])

  // 4. Draw initial waveform when data loads
  useEffect(() => {
    if (!peaks) return
    requestAnimationFrame(() => {
      const canvas = canvasRef.current
      if (canvas) {
        drawWaveform(canvas, peaks, 0, getWaveformColors())
      }
    })
  }, [peaks])

  const togglePlay = useCallback(() => {
    if (!audioBuffer || !audioCtxRef.current) return

    if (isPlaying) {
      // Pause
      if (sourceNodeRef.current) {
        sourceNodeRef.current.onended = null
        try { sourceNodeRef.current.stop() } catch (e) {}
        try { sourceNodeRef.current.disconnect() } catch (e) {}
        sourceNodeRef.current = null
      }
      pausedAtRef.current += audioCtxRef.current.currentTime - startTimeRef.current
      setIsPlaying(false)
    } else {
      // Play
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(console.error)
      }
      const source = audioCtxRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioCtxRef.current.destination)
      
      if (pausedAtRef.current >= audioBuffer.duration) {
        pausedAtRef.current = 0
      }
      
      source.start(0, pausedAtRef.current)
      startTimeRef.current = audioCtxRef.current.currentTime
      sourceNodeRef.current = source
      
      source.onended = () => {
        if (sourceNodeRef.current === source) {
          setIsPlaying(false)
          pausedAtRef.current = 0
          setAudioCurrentTime(0)
          sourceNodeRef.current = null
        }
      }
      setIsPlaying(true)
    }
  }, [audioBuffer, isPlaying])

  const seekToTime = useCallback((newTime: number) => {
    if (!audioBuffer || !audioCtxRef.current) return
    const clampedTime = Math.min(audioBuffer.duration, Math.max(0, newTime))
    
    pausedAtRef.current = clampedTime
    setAudioCurrentTime(clampedTime)
    
    if (isPlaying) {
      if (sourceNodeRef.current) {
        sourceNodeRef.current.onended = null
        try { sourceNodeRef.current.stop() } catch (e) {}
        try { sourceNodeRef.current.disconnect() } catch (e) {}
      }
      
      // If we seek to the end, just pause
      if (clampedTime >= audioBuffer.duration) {
        setIsPlaying(false)
        pausedAtRef.current = 0
        setAudioCurrentTime(0)
        sourceNodeRef.current = null
        const canvas = canvasRef.current
        if (canvas && peaks !== null) {
          drawWaveform(canvas, peaks, 0, getWaveformColors())
        }
        return
      }

      const source = audioCtxRef.current.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioCtxRef.current.destination)
      source.start(0, clampedTime)
      startTimeRef.current = audioCtxRef.current.currentTime
      sourceNodeRef.current = source
      source.onended = () => {
        if (sourceNodeRef.current === source) {
          setIsPlaying(false)
          pausedAtRef.current = 0
          setAudioCurrentTime(0)
          sourceNodeRef.current = null
        }
      }
    }
    
    // Update canvas immediately
    const canvas = canvasRef.current
    if (canvas && peaks !== null && audioBuffer.duration > 0) {
      drawWaveform(canvas, peaks, clampedTime / audioBuffer.duration, getWaveformColors())
    }
  }, [audioBuffer, isPlaying, peaks])

  const seekWaveform = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioBuffer) return
      const rect = e.currentTarget.getBoundingClientRect()
      const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      seekToTime(fraction * audioBuffer.duration)
    },
    [audioBuffer, seekToTime],
  )

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
      
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        e.preventDefault()
        if (audioBuffer && audioCtxRef.current) {
          let current = pausedAtRef.current
          if (isPlaying) {
            current += audioCtxRef.current.currentTime - startTimeRef.current
          }
          const offset = e.code === 'ArrowRight' ? 5 : -5
          seekToTime(current + offset)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, seekToTime, audioBuffer, isPlaying])

  return (
    <div style={style.container}>
      <div style={style.topBar}>
        <button
          style={style.topBtn}
          onClick={onDownload}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--cy-text)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--cy-text-muted)' }}
        >
          <Download size={14} />
          <span style={style.extText}>{ext}</span>
        </button>
        {onClose && (
          <button
            style={style.topBtn}
            onClick={onClose}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--cy-text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--cy-text-muted)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <div style={style.loading}>Generating waveform...</div>
      ) : peaks ? (
        <>
          <div style={style.waveformWrap} onClick={seekWaveform}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
          <div style={style.audioControls}>
            <button
              style={{ ...style.playBtn, padding: isPlaying ? '6px' : '6px 4px 6px 8px' } as any}
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <span style={style.audioTime}>{formatTime(audioCurrentTime)}</span>
            <span style={{ ...style.audioTime, opacity: 0.5 }}>/</span>
            <span style={style.audioTime}>{formatTime(duration)}</span>
          </div>
        </>
      ) : (
        <div style={style.loading}>Failed to load waveform</div>
      )}
    </div>
  )
}
