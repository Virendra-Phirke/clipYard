'use client'

import { useEffect, useRef, useState, useCallback, type CSSProperties } from 'react'
import { Play, Pause } from 'lucide-react'
import { getAudioContext, computePeaks, drawWaveform, formatTime, getWaveformColors } from '@/lib/webrtc/audioUtils'

interface WaveformPlayerProps {
  url: string
  fileName: string
}

const style: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    width: '320px',
    maxWidth: '90vw',
  },
  fileName: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--cy-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    marginBottom: '8px',
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
    border: 'none',
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

export function WaveformPlayer({ url, fileName }: WaveformPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [loading, setLoading] = useState(true)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number>(0)

  // 1. Fetch, decode, and compute peaks
  useEffect(() => {
    let active = true
    const initAudio = async () => {
      try {
        setLoading(true)
        const res = await fetch(url)
        const arrayBuffer = await res.arrayBuffer()
        if (!active) return
        const ctx = getAudioContext()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        if (!active) return
        setDuration(audioBuffer.duration)
        setPeaks(computePeaks(audioBuffer, 80))
        setLoading(false)
      } catch (err) {
        console.error('Failed to decode audio for waveform preview', err)
        setLoading(false)
      }
    }
    initAudio()
    return () => {
      active = false
    }
  }, [url])

  // 2. Setup standard HTMLAudioElement for actual playback
  useEffect(() => {
    const audio = new Audio(url)
    audio.preload = 'metadata'
    audioRef.current = audio

    const onPlay = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => {
      setIsPlaying(false)
      setAudioCurrentTime(0)
    }
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.pause()
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audioRef.current = null
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [url])

  // 3. RAF loop for waveform progress
  useEffect(() => {
    if (!peaks) return
    if (!isPlaying) return
    function tick() {
      const audio = audioRef.current
      const canvas = canvasRef.current
      if (audio && canvas) {
        setAudioCurrentTime(audio.currentTime)
        const progress = audio.duration ? audio.currentTime / audio.duration : 0
        drawWaveform(canvas, peaks, progress, getWaveformColors())
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [isPlaying, peaks])

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
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [])

  const seekWaveform = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const audio = audioRef.current
      if (!audio || !audio.duration) return
      const rect = e.currentTarget.getBoundingClientRect()
      const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
      audio.currentTime = fraction * audio.duration
      
      // Update canvas immediately
      const canvas = canvasRef.current
      if (canvas && peaks !== null) {
        setAudioCurrentTime(audio.currentTime)
        drawWaveform(canvas, peaks, fraction, getWaveformColors())
      }
    },
    [peaks],
  )

  return (
    <div style={style.container}>
      <div style={style.fileName}>{fileName}</div>
      {loading ? (
        <div style={style.loading}>Generating waveform...</div>
      ) : peaks ? (
        <>
          <div style={style.waveformWrap} onClick={seekWaveform}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
          <div style={style.audioControls}>
            <button
              style={style.playBtn}
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
