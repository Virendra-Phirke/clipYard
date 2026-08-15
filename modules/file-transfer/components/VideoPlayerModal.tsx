import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Download,
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  PictureInPicture2,
  Loader2,
  HelpCircle,
  Gauge,
} from 'lucide-react';

export interface VideoPlayerModalProps {
  src: string;
  title?: string;
  poster?: string;
  autoPlay?: boolean;
  onClose: () => void;
  onDownload?: () => void;
}

interface SkipFlash {
  direction: 'forward' | 'backward';
  seconds: number;
  id: number;
}

const SKIP_SECONDS = 10;
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: 'Space / K', action: 'Play / Pause' },
  { keys: '→ / L', action: 'Forward 10s' },
  { keys: '← / J', action: 'Back 10s' },
  { keys: '↑ / ↓', action: 'Volume up / down' },
  { keys: 'M', action: 'Mute / unmute' },
  { keys: 'F', action: 'Fullscreen' },
  { keys: 'P', action: 'Picture-in-picture' },
  { keys: '0–9', action: 'Jump to 0%–90%' },
  { keys: '< / >', action: 'Speed down / up' },
  { keys: 'Esc', action: 'Close' },
];

const formatTime = (time: number): string => {
  if (!Number.isFinite(time) || time < 0) return '0:00';
  const hrs = Math.floor(time / 3600);
  const mins = Math.floor((time % 3600) / 60);
  const secs = Math.floor(time % 60);
  const paddedSecs = secs.toString().padStart(2, '0');
  if (hrs > 0) return `${hrs}:${mins.toString().padStart(2, '0')}:${paddedSecs}`;
  return `${mins}:${paddedSecs}`;
};

const getFileNameFromSrc = (url: string): string => {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    const last = pathname.split('/').filter(Boolean).pop();
    return last || 'video';
  } catch {
    return 'video';
  }
};

const iconBtnClass =
  'inline-flex h-8 items-center justify-center gap-1 rounded-full px-2 text-stone-200 ' +
  'transition hover:bg-white/10 hover:text-white focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-amber-400';

const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  src,
  title,
  poster,
  autoPlay = true,
  onClose,
  onDownload,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFlashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centerFlashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<{ time: number; x: number } | null>(null);
  const [skipFlash, setSkipFlash] = useState<SkipFlash | null>(null);
  const [centerFlash, setCenterFlash] = useState<'play' | 'pause' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flashCenter = useCallback((state: 'play' | 'pause') => {
    setCenterFlash(state);
    if (centerFlashTimeout.current) clearTimeout(centerFlashTimeout.current);
    centerFlashTimeout.current = setTimeout(() => setCenterFlash(null), 500);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => setError('This video could not be played.'));
    } else {
      video.pause();
    }
  }, []);

  const seekBy = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(Math.max(video.currentTime + delta, 0), video.duration);
    setSkipFlash({
      direction: delta > 0 ? 'forward' : 'backward',
      seconds: Math.abs(delta),
      id: Date.now(),
    });
    if (skipFlashTimeout.current) clearTimeout(skipFlashTimeout.current);
    skipFlashTimeout.current = setTimeout(() => setSkipFlash(null), 650);
  }, []);

  const seekToRatio = useCallback((ratio: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(Math.max(ratio, 0), 1) * video.duration;
  }, []);

  const changeVolume = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.min(Math.max(video.volume + delta, 0), 1);
    video.volume = next;
    video.muted = next === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch {
      // Picture-in-picture not supported in this browser — fail silently.
    }
  }, []);

  const changePlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (video) video.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  }, []);

  const cyclePlaybackRate = useCallback((direction: 1 | -1) => {
    setPlaybackRate((current) => {
      const idx = PLAYBACK_SPEEDS.indexOf(current);
      const next = PLAYBACK_SPEEDS[Math.min(Math.max(idx + direction, 0), PLAYBACK_SPEEDS.length - 1)];
      if (videoRef.current) videoRef.current.playbackRate = next;
      return next;
    });
  }, []);

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
      return;
    }
    const link = document.createElement('a');
    link.href = src;
    link.download = title || getFileNameFromSrc(src);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [onDownload, src, title]);

  const wakeControls = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  const handleVideoAreaClick = useCallback(() => {
    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current);
      clickTimeout.current = null;
      toggleFullscreen();
    } else {
      clickTimeout.current = setTimeout(() => {
        togglePlay();
        clickTimeout.current = null;
      }, 220);
    }
  }, [toggleFullscreen, togglePlay]);

  const getRatioFromClientX = useCallback((clientX: number) => {
    const bar = progressRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
  }, []);

  const handleSeekMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingSeek(true);
      seekToRatio(getRatioFromClientX(e.clientX));
    },
    [getRatioFromClientX, seekToRatio],
  );

  const handleSeekTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsDraggingSeek(true);
      const touch = e.touches[0];
      if (touch) seekToRatio(getRatioFromClientX(touch.clientX));
    },
    [getRatioFromClientX, seekToRatio],
  );

  const handleSeekHover = useCallback(
    (e: React.MouseEvent) => {
      const bar = progressRef.current;
      if (!bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
      setHoverPreview({ time: (x / rect.width) * duration, x });
    },
    [duration],
  );

  useEffect(() => {
    if (!isDraggingSeek) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      if (clientX != null) seekToRatio(getRatioFromClientX(clientX));
    };
    const handleUp = () => setIsDraggingSeek(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDraggingSeek, seekToRatio, getRatioFromClientX]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      flashCenter('play');
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
      hideControlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    };
    const onPause = () => {
      setIsPlaying(false);
      flashCenter('pause');
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
      setShowControls(true);
    };
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration);
    const onVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => setIsBuffering(false);
    const onLoadedData = () => setIsBuffering(false);
    const onProgress = () => {
      if (video.buffered.length > 0 && video.duration) {
        const end = video.buffered.end(video.buffered.length - 1);
        setBuffered((end / video.duration) * 100);
      }
    };
    const onErrorEvt = () => {
      setIsBuffering(false);
      setError('This video could not be loaded.');
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('volumechange', onVolumeChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('progress', onProgress);
    video.addEventListener('error', onErrorEvt);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('volumechange', onVolumeChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('error', onErrorEvt);
    };
  }, [flashCenter]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      // Allow shortcuts to work even if a button is focused, but skip inputs
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.key) {
        case ' ':
          // Let buttons handle space natively (e.g. if user tabbed to Mute)
          if (tag === 'BUTTON') return;
          e.preventDefault();
          togglePlay();
          wakeControls();
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          wakeControls();
          break;
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault();
          seekBy(SKIP_SECONDS);
          wakeControls();
          break;
        case 'ArrowLeft':
        case 'j':
        case 'J':
          e.preventDefault();
          seekBy(-SKIP_SECONDS);
          wakeControls();
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(0.05);
          wakeControls();
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(-0.05);
          wakeControls();
          break;
        case 'm':
        case 'M':
          toggleMute();
          wakeControls();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          wakeControls();
          break;
        case 'p':
        case 'P':
          togglePiP();
          break;
        case '?':
          setShowShortcuts((v) => !v);
          break;
        case 'Escape':
          if (!document.fullscreenElement) onClose();
          break;
        case '<':
          cyclePlaybackRate(-1);
          break;
        case '>':
          cyclePlaybackRate(1);
          break;
        default:
          if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
            seekToRatio(Number(e.key) / 10);
            wakeControls();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlay,
    seekBy,
    changeVolume,
    toggleMute,
    toggleFullscreen,
    togglePiP,
    cyclePlaybackRate,
    seekToRatio,
    onClose,
    wakeControls,
  ]);

  useEffect(
    () => () => {
      if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
      if (clickTimeout.current) clearTimeout(clickTimeout.current);
      if (skipFlashTimeout.current) clearTimeout(skipFlashTimeout.current);
      if (centerFlashTimeout.current) clearTimeout(centerFlashTimeout.current);
    },
    [],
  );

  const playedPct = duration ? (currentTime / duration) * 100 : 0;
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Video player'}
      className="fixed inset-0 z-50 select-none bg-black"
      onMouseMove={wakeControls}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        playsInline
        className="h-full w-full object-contain"
        onClick={handleVideoAreaClick}
      />

      {isBuffering && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-amber-400/90 motion-reduce:animate-none" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-stone-950/95 px-6 text-center">
          <p className="text-sm text-stone-200">{error}</p>
        </div>
      )}

      {centerFlash && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div key={centerFlash} className="animate-center-flash rounded-full bg-black/50 p-6">
            {centerFlash === 'play' ? (
              <Play className="h-9 w-9 fill-white text-white" />
            ) : (
              <Pause className="h-9 w-9 fill-white text-white" />
            )}
          </div>
        </div>
      )}

      {skipFlash && !error && (
        <div
          key={skipFlash.id}
          className={`pointer-events-none absolute inset-y-0 flex w-1/3 items-center ${
            skipFlash.direction === 'forward'
              ? 'right-0 justify-end pr-10 md:pr-20'
              : 'left-0 justify-start pl-10 md:pl-20'
          }`}
        >
          <div className="flex animate-skip-flash flex-col items-center gap-1 text-white">
            {skipFlash.direction === 'forward' ? (
              <RotateCw className="h-7 w-7" />
            ) : (
              <RotateCcw className="h-7 w-7" />
            )}
            <span className="text-sm font-medium">{skipFlash.seconds}s</span>
          </div>
        </div>
      )}

      {!isPlaying && !isBuffering && !error && !centerFlash && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/20 transition hover:bg-black/60 hover:ring-amber-400/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Play className="ml-1 h-7 w-7 fill-white" />
        </button>
      )}

      <div
        className={`absolute inset-x-0 top-0 flex items-start justify-between gap-4 bg-gradient-to-b from-black/80 to-transparent p-4 transition-opacity duration-300 motion-reduce:transition-none ${
          showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="min-w-0 pt-1">
          {title && <h2 className="truncate text-sm font-medium text-stone-100 md:text-base">{title}</h2>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            aria-label="Download video"
            title="Download"
            className="rounded-full bg-white/10 p-2.5 text-stone-200 backdrop-blur transition hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="rounded-full bg-white/10 p-2.5 text-stone-200 backdrop-blur transition hover:bg-red-500/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        className={`absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/85 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 motion-reduce:transition-none ${
          showControls ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div
          ref={progressRef}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
          tabIndex={0}
          className="group relative h-3 cursor-pointer"
          onMouseDown={handleSeekMouseDown}
          onTouchStart={handleSeekTouchStart}
          onMouseMove={handleSeekHover}
          onMouseLeave={() => setHoverPreview(null)}
        >
          {hoverPreview && (
            <div
              className="pointer-events-none absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded bg-stone-900 px-1.5 py-0.5 text-[11px] text-stone-100 shadow ring-1 ring-white/10"
              style={{ left: hoverPreview.x }}
            >
              {formatTime(hoverPreview.time)}
            </div>
          )}
          <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-white/20" />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/35"
            style={{ width: `${buffered}%` }}
          />
          <div
            className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-amber-400"
            style={{ width: `${playedPct}%` }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 opacity-0 shadow transition-opacity group-hover:opacity-100"
            style={{ left: `${playedPct}%` }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            title="Play/Pause (Space)"
            className={iconBtnClass}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
          </button>

          <button
            type="button"
            onClick={() => seekBy(-SKIP_SECONDS)}
            aria-label="Back 10 seconds"
            title="Back 10s (←)"
            className={iconBtnClass}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => seekBy(SKIP_SECONDS)}
            aria-label="Forward 10 seconds"
            title="Forward 10s (→)"
            className={iconBtnClass}
          >
            <RotateCw className="h-4 w-4" />
          </button>

          <button type="button" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'} title="Mute (M)" className={iconBtnClass}>
            <VolumeIcon className="h-5 w-5" />
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const v = Number(e.target.value);
              const video = videoRef.current;
              if (video) {
                video.volume = v;
                video.muted = v === 0;
              }
            }}
            aria-label="Volume"
            style={{ accentColor: '#fbbf24' }}
            className="h-1 w-16 cursor-pointer sm:w-20"
          />

          <span className="ml-1 whitespace-nowrap text-xs tabular-nums text-stone-300">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSpeedMenu((v) => !v)}
              aria-label="Playback speed"
              title="Playback speed (< / >)"
              className={`${iconBtnClass} text-xs font-medium`}
            >
              <Gauge className="h-4 w-4" />
              {playbackRate}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-24 overflow-hidden rounded-lg bg-stone-900/95 py-1 text-xs shadow-lg ring-1 ring-white/10 backdrop-blur">
                {PLAYBACK_SPEEDS.map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => changePlaybackRate(speed)}
                    className={`block w-full px-3 py-1.5 text-left hover:bg-white/10 ${
                      speed === playbackRate ? 'text-amber-400' : 'text-stone-200'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={togglePiP}
            aria-label="Picture in picture"
            title="Picture-in-picture (P)"
            className={iconBtnClass}
          >
            <PictureInPicture2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setShowShortcuts((v) => !v)}
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            className={iconBtnClass}
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            title="Fullscreen (F)"
            className={iconBtnClass}
          >
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {showShortcuts && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-stone-900 p-5 text-stone-200 ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Keyboard shortcuts</h3>
              <button
                type="button"
                onClick={() => setShowShortcuts(false)}
                aria-label="Close shortcuts"
                className={iconBtnClass}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-1.5 text-sm">
              {SHORTCUTS.map((s) => (
                <li key={s.action} className="flex items-center justify-between gap-4">
                  <span className="text-stone-400">{s.action}</span>
                  <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-stone-200">{s.keys}</kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <style>{`
        @keyframes skip-flash {
          0% { opacity: 0; transform: scale(0.85); }
          20% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1); }
        }
        .animate-skip-flash { animation: skip-flash 650ms ease-out; }

        @keyframes center-flash {
          0% { opacity: 0; transform: scale(0.7); }
          30% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1); }
        }
        .animate-center-flash { animation: center-flash 500ms ease-out; }

        @media (prefers-reduced-motion: reduce) {
          .animate-skip-flash, .animate-center-flash { animation: none; }
        }
      `}</style>
    </div>
  );
};

export default VideoPlayerModal;
