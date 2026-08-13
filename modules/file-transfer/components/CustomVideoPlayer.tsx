'use client'

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize } from 'lucide-react'
import { formatTime } from '@/lib/webrtc/audioUtils'

interface CustomVideoPlayerProps {
  url: string
}

export function CustomVideoPlayer({ url }: CustomVideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const [showControls, setShowControls] = useState(true)
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Overlay animation state
  const [overlayIcon, setOverlayIcon] = useState<React.ReactNode | null>(null)
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const showOverlayIcon = useCallback((icon: React.ReactNode) => {
    setOverlayIcon(icon)
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current)
    overlayTimeoutRef.current = setTimeout(() => {
      setOverlayIcon(null)
    }, 500) // fast fade
  }, [])

  const handleMouseMove = useCallback(() => {
    setShowControls(true)
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current)
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 2500)
  }, [isPlaying])

  useEffect(() => {
    if (isPlaying) {
      handleMouseMove()
    } else {
      setShowControls(true)
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current)
    }
  }, [isPlaying, handleMouseMove])

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current)
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current)
    }
  }, [])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play().catch(console.error)
      showOverlayIcon(<Play size={48} color="white" />)
    } else {
      video.pause()
      showOverlayIcon(<Pause size={48} color="white" />)
    }
  }, [showOverlayIcon])

  const handleSeek = useCallback((amount: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + amount))
  }, [])

  const handleVolume = useCallback((amount: number) => {
    const video = videoRef.current
    if (!video) return
    const newVol = Math.max(0, Math.min(1, volume + amount))
    setVolume(newVol)
    video.volume = newVol
    if (newVol > 0 && isMuted) {
      setIsMuted(false)
      video.muted = false
    }
    
    // Show appropriate icon
    if (newVol === 0) showOverlayIcon(<VolumeX size={48} color="white" />)
    else if (newVol < 0.5) showOverlayIcon(<Volume1 size={48} color="white" />)
    else showOverlayIcon(<Volume2 size={48} color="white" />)
  }, [volume, isMuted, showOverlayIcon])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !isMuted
    setIsMuted(!isMuted)
    showOverlayIcon(!isMuted ? <VolumeX size={48} color="white" /> : <Volume2 size={48} color="white" />)
  }, [isMuted, showOverlayIcon])

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(console.error)
    } else {
      document.exitFullscreen().catch(console.error)
    }
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'arrowleft':
        case 'j':
          e.preventDefault()
          handleSeek(-10)
          break
        case 'arrowright':
        case 'l':
          e.preventDefault()
          handleSeek(10)
          break
        case 'arrowup':
          e.preventDefault()
          handleVolume(0.1)
          break
        case 'arrowdown':
          e.preventDefault()
          handleVolume(-0.1)
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'f':
          e.preventDefault()
          toggleFullscreen()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, handleSeek, handleVolume, toggleMute, toggleFullscreen])

  // Video event handlers
  const onTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const onLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      // Play automatically
      videoRef.current.play().catch(console.error)
    }
  }

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    if (videoRef.current) {
      videoRef.current.currentTime = pos * duration
    }
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { if (isPlaying) setShowControls(false) }}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        cursor: showControls ? 'default' : 'none',
      }}
    >
      <video
        ref={videoRef}
        src={url}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        style={{
          width: '100%',
          height: '100%',
          maxHeight: isFullscreen ? '100vh' : 'calc(100vh - 48px)',
          objectFit: 'contain',
        }}
      />

      {/* Center Animation Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          opacity: overlayIcon ? 1 : 0,
          transition: 'opacity 0.3s ease-out',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '24px',
          borderRadius: '50%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {overlayIcon}
      </div>

      {/* Control Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div
          onClick={handleProgressBarClick}
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: 'rgba(255,255,255,0.3)',
            borderRadius: '3px',
            cursor: 'pointer',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              backgroundColor: 'var(--cy-primary, #3b82f6)',
              borderRadius: '3px',
              width: `${duration ? (currentTime / duration) * 100 : 0}%`,
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        {/* Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={togglePlay}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={toggleMute}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
              >
                {isMuted || volume === 0 ? <VolumeX size={20} /> : volume < 0.5 ? <Volume1 size={20} /> : <Volume2 size={20} />}
              </button>
              {/* Volume Slider */}
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  const v = videoRef.current
                  if (v) {
                    v.volume = val
                    setVolume(val)
                    if (val > 0 && isMuted) {
                      v.muted = false
                      setIsMuted(false)
                    }
                  }
                }}
                style={{
                  width: '80px',
                  accentColor: 'var(--cy-primary, #3b82f6)',
                  cursor: 'pointer',
                }}
              />
            </div>

            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', opacity: 0.8 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div>
            <button
              onClick={toggleFullscreen}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
