'use client'

export function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  if (audioBuffer.numberOfChannels === 1) return audioBuffer.getChannelData(0)
  const ch0 = audioBuffer.getChannelData(0)
  const ch1 = audioBuffer.getChannelData(1)
  const out = new Float32Array(ch0.length)
  for (let i = 0; i < ch0.length; i++) out[i] = (ch0[i] + ch1[i]) / 2
  return out
}

export function computePeaks(audioBuffer: AudioBuffer, numPeaks: number): number[] {
  const data = mixToMono(audioBuffer)
  const blockSize = Math.max(1, Math.floor(data.length / numPeaks))
  const peaks = new Array(numPeaks).fill(0)
  for (let i = 0; i < numPeaks; i++) {
    const start = i * blockSize
    let max = 0
    for (let j = 0; j < blockSize; j++) {
      const v = Math.abs(data[start + j] || 0)
      if (v > max) max = v
    }
    peaks[i] = max
  }
  return peaks
}

export function drawWaveform(
  canvas: HTMLCanvasElement,
  peaks: number[],
  progress = 0,
  colors: { active: string; muted: string }
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth || canvas.width
  const cssH = canvas.clientHeight || canvas.height
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = cssW * dpr
    canvas.height = cssH * dpr
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  const gap = 1.5
  const barWidth = Math.max(1, cssW / peaks.length - gap)
  const progressIndex = Math.floor(progress * peaks.length)

  peaks.forEach((p, i) => {
    const barH = Math.max(2, p * cssH)
    const x = i * (barWidth + gap)
    const y = (cssH - barH) / 2
    ctx.fillStyle = i <= progressIndex ? colors.active : colors.muted
    ctx.fillRect(x, y, barWidth, barH)
  })
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function getWaveformColors(): { active: string; muted: string } {
  if (typeof document === 'undefined') return { active: '#000', muted: '#999' }
  const style = getComputedStyle(document.documentElement)
  const fg = style.getPropertyValue('--cy-text').trim() || '#000'
  const mu = style.getPropertyValue('--cy-text-muted').trim() || '#999'
  return { active: fg, muted: mu }
}

/* Shared AudioContext — lazily created */
let _sharedAudioCtx: AudioContext | null = null
export function getAudioContext(): AudioContext {
  if (!_sharedAudioCtx) {
    _sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  return _sharedAudioCtx
}
