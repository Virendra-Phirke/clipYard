'use client'

import Image from 'next/image'
import { FileSharePanel, AttachmentMenu } from '@/modules/file-transfer'
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useDebounce } from 'use-debounce'
import { QRCodeSVG } from 'qrcode.react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useTheme } from '@/components/ThemeProvider'
import {
  type Device,
  type RoomLiveState,
  type RoomRole,
  type RoomSnapshot,
  clearCachedToken,
  clearStoredHostFingerprint,
  clearUsername,
  closeRoom,
  fetchRoomSnapshot,
  getDeviceLabel,
  getParticipantPlaceholders,
  getRoomToken,
  getRoomUrl,
  getSavedUsername,
  getStoredHostFingerprint,
  isValidRoomId,
  saveText,
  saveUsername,
  sendLeaveBeacon,
  sendPresence,
  setStoredHostFingerprint,
  signInToFirebaseRoom,
  setupRoomPresenceOnDisconnect,
  subscribeToRoomClipUpdatedAt,
  subscribeToRoomPresence,
  subscribeToRoomStatus,
} from '@/services/room'
import { getLocalFingerprint } from '@/services/fingerprint'
import { PRESENCE_LIFESPAN_MS } from '@/lib/presence'
import { getFirebaseServices } from '@/lib/firebase-client'
import { cleanupSignaling } from '@/lib/webrtc/signaling'


/* ─────────────────────────────── styles ─────────────────────────────── */

const S = {
  /* layout */
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: 'Space Grotesk, sans-serif',
    color: 'var(--cy-text)',
    fontSize: '16px',
    lineHeight: '24px',
    WebkitFontSmoothing: 'antialiased',
  },
  /* header */
  header: {
    backgroundColor: 'var(--cy-surface)',
    borderBottom: '1.5px solid var(--cy-border-strong)',
    width: '100%',
    minHeight: '64px',
    padding: 'var(--header-padding)',
    boxSizing: 'border-box' as const,
  },
  logo: {
    fontFamily: 'Space Grotesk, sans-serif',
    fontSize: '24px',
    lineHeight: '32px',
    letterSpacing: '-0.01em',
    fontWeight: 700,
    color: 'var(--cy-primary-text)',
  },
  roomBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'var(--cy-surface-container)',
    padding: '4px 12px',
    borderRadius: '2px',
    border: '1.5px solid var(--cy-border)',
  },
  roomBadgeLabel: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  roomBadgeId: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '14px',
    lineHeight: '20px',
    letterSpacing: '0.02em',
    fontWeight: 500,
    color: 'var(--cy-text)',
  },
  connectedDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--cy-primary)' },
  connectedLabel: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.02em',
  },
  shareBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1.5px solid var(--cy-border)',
    borderRadius: '2px',
    color: 'var(--cy-text)',
    cursor: 'pointer',
    fontFamily: 'Space Mono, monospace',
    fontSize: '14px',
    letterSpacing: '0.02em',
    fontWeight: 500,
    transition: 'background-color 0.2s ease',
    whiteSpace: 'nowrap' as const,
  },
  main: {
    flexGrow: 1,
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
    padding: 'var(--page-padding)',
    gap: 'var(--room-grid-gap)',
    boxSizing: 'border-box' as const,
  },
  /* editor column */
  editorCol: { display: 'flex', flexDirection: 'column' as const, gap: '24px' },
  editorCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'var(--cy-surface)',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    overflow: 'hidden',
    boxShadow: '0 1px 2px 0 var(--cy-shadow)',
  },
  textarea: {
    width: '100%',
    padding: '16px',
    resize: 'none' as const,
    outline: 'none',
    fontFamily: 'Space Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text)',
    backgroundColor: 'transparent',
    border: 'none',
    minHeight: '300px',
    height: 'var(--textarea-height)',
    maxHeight: '80vh',
    boxSizing: 'border-box' as const,
  },
  editorFooter: {
    padding: '8px 16px',
    borderTop: '1.5px solid var(--cy-border-strong)',
    backgroundColor: 'var(--cy-surface-container)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontFamily: '"Space Mono", monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    flexWrap: 'wrap' as const,
    gap: '16px',
  },
  syncedDot: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--cy-primary)' },
  /* action buttons */
  actionRow: { display: 'flex', gap: '16px', flexWrap: 'wrap' as const },
  copyBtn: {
    flex: 1,
    backgroundColor: 'var(--cy-primary)',
    color: 'var(--cy-on-primary)',
    fontFamily: 'Space Mono, monospace',
    fontSize: '12px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-primary)',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    transition: 'background-color 0.2s ease',
    minWidth: '100px',
  },
  clearBtn: {
    flex: 1,
    backgroundColor: 'var(--cy-surface-container)',
    color: 'var(--cy-secondary-text)',
    fontFamily: 'Space Mono, monospace',
    fontSize: '12px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    transition: 'background-color 0.2s ease',
    minWidth: '100px',
  },
  /* sidebar */
  sidebar: { display: 'flex', flexDirection: 'column' as const, gap: '24px' },
  sideCard: {
    backgroundColor: 'var(--cy-surface)',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    padding: '20px',
  },
  sideCardAlt: {
    backgroundColor: 'var(--cy-surface-white)',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    padding: '20px',
  },
  sideCardTitle: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '14px',
    lineHeight: '20px',
    letterSpacing: '0.08em',
    fontWeight: 500,
    color: 'var(--cy-text)',
    textTransform: 'uppercase' as const,
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  deviceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontFamily: 'Space Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
  },
  deviceDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--cy-primary)', flexShrink: 0 },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1.5px solid var(--cy-border)',
    fontFamily: 'Space Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },
  infoRowLast: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    fontFamily: 'Space Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-text-secondary)',
    flexWrap: 'wrap' as const,
    gap: '4px',
  },
  qrCard: {
    backgroundColor: 'var(--cy-surface)',
    borderRadius: '4px',
    border: '1.5px solid var(--cy-border)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },
  qrTitle: {
    fontFamily: 'Space Mono, monospace',
    fontSize: '14px',
    letterSpacing: '0.08em',
    fontWeight: 500,
    color: 'var(--cy-text)',
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
  },
  qrFrame: {
    width: '192px',
    height: '192px',
    backgroundColor: 'var(--cy-surface-white)',
    border: '1.5px solid var(--cy-border)',
    padding: '8px',
    maxWidth: '100%',
  },
  /* footer */
  footer: {
    backgroundColor: 'var(--cy-surface-container)',
    borderTop: '1.5px solid var(--cy-border-strong)',
    width: '100%',
    padding: '32px 0',
    marginTop: 'auto',
  },
  footerInner: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    maxWidth: '1280px',
    margin: '0 auto',
    gap: '16px',
    fontFamily: 'Space Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: 'var(--cy-secondary-text)',
  },
  footerLink: {
    color: 'var(--cy-text-secondary)',
    textDecoration: 'none',
    transition: 'color 0.2s ease',
  },
}

/* ──────────────────────────────── page ──────────────────────────────── */

export default function RoomPage() {
  const params = useParams<{ roomId: string }>()
  const router = useRouter()
  const roomId = String(params.roomId || '').toLowerCase()
  const displayId = roomId.toUpperCase()

  const [text, setText] = useState('')
  const [debouncedText] = useDebounce(text, 1000)
  const [status, setStatus] = useState<'loading' | 'ready' | 'closed' | 'error'>('loading')
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'offline'>('connecting')
  const [role, setRole] = useState<'host' | 'participant'>('participant')
  const [saved, setSaved] = useState(true)
  const [people, setPeople] = useState(1)
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [userName, setUserName] = useState<string | null | undefined>(undefined)
  const [nameDraft, setNameDraft] = useState('')
  const [lifespanMs, setLifespanMs] = useState<number>(PRESENCE_LIFESPAN_MS)
  const roomUrl = useMemo(() => getRoomUrl(roomId), [roomId])
  const fingerprintRef = useRef('')
  const deviceLabelRef = useRef('Browser')
  const tokenRef = useRef('')
  const dirtyRef = useRef(false)
  const textRef = useRef('')
  const lastKnownUpdatedAtRef = useRef<number | undefined>(undefined)
  
  const instanceId = useMemo(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return Math.random().toString(36).substring(2, 15)
  }, [])

  const heartbeatTimerRef = useRef<number | null>(null)
  const lifespanTimerRef = useRef<number | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const latestPresenceRef = useRef<Record<string, any>>({})
  const firebaseUidRef = useRef('')
  const [presenceMap, setPresenceMap] = useState<Record<string, { name?: string; sid?: string; [key: string]: unknown }>>({})

  // Ref that FileSharePanel populates with its sendFile, so AttachmentMenu can trigger transfers
  const sendFileRef = useRef<((file: File) => void) | null>(null)
  const handleAttachmentFiles = useCallback((files: File[]) => {
    files.forEach((f) => sendFileRef.current?.(f))
  }, [])

  const [serverDevices, setServerDevices] = useState<Device[]>([])

  // Honest placeholders for other connected devices ("Participant 2", etc.) as fallback
  const otherDeviceNames = useMemo(
    () => getParticipantPlaceholders(Math.max(0, people - 1)),
    [people],
  )

  useEffect(() => {
    fingerprintRef.current = getLocalFingerprint()
    deviceLabelRef.current = getDeviceLabel()
    setUserName(getSavedUsername())
  }, [])

  function submitName() {
    const trimmed = nameDraft.trim().slice(0, 24)
    if (!trimmed) return
    saveUsername(trimmed)
    setUserName(trimmed)
  }

  function changeName() {
    clearUsername()
    setNameDraft('')
    setUserName(null)
  }

  useEffect(() => {
    if (!userName) return
    if (!isValidRoomId(roomId)) { router.replace('/'); return }
    let alive = true

    async function loadSnapshot() {
      try {
        const payload = await fetchRoomSnapshot(roomId, tokenRef.current, fingerprintRef.current)
        if (!alive) return
        if (payload.status === 'closed') {
          clearStoredHostFingerprint(roomId)
          clearCachedToken(roomId)
          setStatus('closed')
          return
        }
        setPeople(Math.max(1, payload.people || 1))
        if (Array.isArray(payload.devices)) {
          setServerDevices(payload.devices)
        }
        if (!dirtyRef.current && payload.text !== textRef.current) {
          textRef.current = payload.text
          setText(payload.text)
          setSaved(true)
        }
        setStatus('ready')
        setConnection('connected')
      } catch (error) {
        if (!alive) return
        const statusCode = error instanceof Error && 'status' in error
          ? Number((error as Error & { status?: number }).status) : 0
        if (statusCode === 404) {
          clearStoredHostFingerprint(roomId)
          clearCachedToken(roomId)
          setStatus('closed')
          return
        }
        setConnection('offline')
        throw error
      }
    }

    function handlePresence(presence: Record<string, any>) {
      if (!alive) return
      const now = Date.now()
      latestPresenceRef.current = presence || {}
      const presenceEntries = Object.entries(presence || {})

      const activeEntries = presenceEntries.filter(([_, entry]) => {
        const lastSeen = typeof entry?.lastSeen === 'number' ? entry.lastSeen : 0
        return now - lastSeen < PRESENCE_LIFESPAN_MS
      })

      setPeople(Math.max(1, activeEntries.length))
      setServerDevices(
        activeEntries.map(([sid, entry]) => ({
          sid,
          fingerprint: entry.fingerprint || sid,
          name: entry.name || (entry.role === 'host' ? 'Host' : 'Participant'),
          deviceLabel: entry.deviceLabel || 'Browser',
          role: entry.role || 'participant',
        })),
      )
      // Update presence map for WebRTC (keyed by uid)
      const pMap: Record<string, { name?: string; sid?: string; [key: string]: unknown }> = {}
      for (const [sid, entry] of activeEntries) {
        pMap[sid] = { ...(entry as Record<string, unknown>), sid }
      }
      setPresenceMap(pMap)
      setConnection('connected')
    }

    function handleClipUpdatedAt(updatedAt?: number) {
      if (!alive) return
      const previousUpdatedAt = lastKnownUpdatedAtRef.current
      if (previousUpdatedAt !== undefined && updatedAt !== undefined && updatedAt !== previousUpdatedAt) {
        if (!dirtyRef.current) {
          loadSnapshot().catch(() => undefined)
        }
      }
      lastKnownUpdatedAtRef.current = updatedAt
    }

    function handleStatus(status: 'open' | 'closed') {
      if (!alive) return
      if (status === 'closed') {
        clearStoredHostFingerprint(roomId)
        clearCachedToken(roomId)
        setStatus('closed')
      }
    }

    async function connect() {
      try {
        let payload = await getRoomToken(roomId, fingerprintRef.current, userName ?? '', deviceLabelRef.current)
        tokenRef.current = payload.token

        try {
          await signInToFirebaseRoom(payload.firebaseToken)
        } catch {
          clearCachedToken(roomId)
          payload = await getRoomToken(roomId, fingerprintRef.current, userName ?? '', deviceLabelRef.current, true)
          tokenRef.current = payload.token
          await signInToFirebaseRoom(payload.firebaseToken)
        }

        // Capture Firebase auth UID for WebRTC signaling
        const { auth: fbAuth } = getFirebaseServices()
        firebaseUidRef.current = fbAuth.currentUser?.uid || ''

        let effectiveRole = payload.role
        if (effectiveRole === 'host') {
          setStoredHostFingerprint(roomId, fingerprintRef.current)
        } else if (getStoredHostFingerprint(roomId) === fingerprintRef.current) {
          try {
            const reclaimResp = await fetch(`/api/rooms/${roomId}/reclaim?token=${encodeURIComponent(payload.token)}`, {
              method: 'POST',
              headers: { 'x-device-fingerprint': fingerprintRef.current },
            })
            if (reclaimResp.ok) {
              const body = await reclaimResp.json().catch(() => ({}))
              if (body?.token) {
                payload = { ...payload, token: body.token, role: 'host' }
                tokenRef.current = body.token
                try {
                  sessionStorage.setItem(`clipboard-token-${roomId}`, JSON.stringify(payload))
                } catch { }
                setStoredHostFingerprint(roomId, fingerprintRef.current)
                effectiveRole = 'host'
              }
            }
          } catch {
            // ignore reclaim errors — we'll continue as participant
          }
        }
        setRole(effectiveRole)
        setConnection('connected')
        await sendPresence(roomId, payload.token, fingerprintRef.current, deviceLabelRef.current, userName ?? '', instanceId)
        await loadSnapshot()

        const handleUnload = () => sendLeaveBeacon(roomId, tokenRef.current, fingerprintRef.current)

        window.addEventListener('pagehide', handleUnload)
        window.addEventListener('beforeunload', handleUnload)

        const cleanupPresenceOnDisconnect = setupRoomPresenceOnDisconnect(roomId)
        const presenceUnsubscribe = subscribeToRoomPresence(roomId, handlePresence)
        const statusUnsubscribe = subscribeToRoomStatus(roomId, handleStatus)
        const clipUnsubscribe = subscribeToRoomClipUpdatedAt(roomId, handleClipUpdatedAt)

        cleanupRef.current = () => {
          window.removeEventListener('pagehide', handleUnload)
          window.removeEventListener('beforeunload', handleUnload)
          presenceUnsubscribe()
          statusUnsubscribe()
          clipUnsubscribe()
          cleanupPresenceOnDisconnect()
          handleUnload()
          if (lifespanTimerRef.current !== null) window.clearInterval(lifespanTimerRef.current)
          // Clean up WebRTC signaling data
          if (firebaseUidRef.current) {
            cleanupSignaling(roomId, firebaseUidRef.current).catch(() => undefined)
          }
        }

        setConnection('connected')

        lifespanTimerRef.current = window.setInterval(() => {
          const now = Date.now()
          const activeEntries = Object.entries(latestPresenceRef.current).filter(([_, entry]) => {
            const lastSeen = typeof entry?.lastSeen === 'number' ? entry.lastSeen : 0
            return now - lastSeen < PRESENCE_LIFESPAN_MS
          })
          if (activeEntries.length > 0) {
            const nextLifespan = Math.max(
              0,
              PRESENCE_LIFESPAN_MS - (now - Math.min(...activeEntries.map(([_, entry]) => entry.lastSeen || now))),
            )
            setLifespanMs(nextLifespan)
          } else {
            setLifespanMs(0)
          }
        }, 1000)

        heartbeatTimerRef.current = window.setInterval(() => {
          sendPresence(roomId, payload.token, fingerprintRef.current, deviceLabelRef.current, userName ?? '', instanceId)
            .catch(() => setConnection('offline'))
        }, 5000)
      } catch (error) {
        if (!alive) return
        setStatus('error')
        setNotice(error instanceof Error ? error.message : 'Unable to connect')
      }
    }

    connect()

    return () => {
      alive = false
      cleanupRef.current?.()
      if (heartbeatTimerRef.current !== null) window.clearInterval(heartbeatTimerRef.current)
    }
  }, [roomId, router, userName])

  useEffect(() => {
    // Only auto-save if there's a local un-saved change and we have a token
    if (!userName || !dirtyRef.current || !tokenRef.current) return
    
    let alive = true
    saveText(roomId, tokenRef.current, debouncedText, fingerprintRef.current)
      .then(() => {
        if (!alive) return
        dirtyRef.current = false
        setSaved(true)
        setConnection('connected')
      })
      .catch(() => {
        if (!alive) return
        setConnection('offline')
      })
      
    return () => { alive = false }
  }, [debouncedText, roomId, userName])

  function handleTextChange(nextText: string) {
    textRef.current = nextText
    dirtyRef.current = true
    setText(nextText)
    setSaved(false)
  }

  async function copyClipboard() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  async function shareRoom() {
    await navigator.clipboard.writeText(roomUrl)
    setNotice('Room link copied!')
    setTimeout(() => setNotice(''), 2000)
  }

  async function leave() {
    const token = tokenRef.current
    if (role === 'host' && token) {
      await closeRoom(roomId, token, fingerprintRef.current).catch(() => undefined)
    } else if (token) {
      sendLeaveBeacon(roomId, token, fingerprintRef.current)
    }
    clearStoredHostFingerprint(roomId)
    clearCachedToken(roomId)
    router.push('/')
  }

  /* ── name prompt ── */
  if (userName === undefined) {
    return <Shell><div /></Shell>
  }

  if (!userName) {
    return (
      <Shell>
        <div style={{ maxWidth: '360px', width: '100%', textAlign: 'center', padding: '0 16px' }}>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '24px', fontWeight: 700, color: 'var(--cy-text)', marginBottom: '8px' }}>
            What&apos;s your name?
          </h1>
          <p style={{ color: 'var(--cy-text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
            Other people in this room will see this so they know it&apos;s you.
          </p>
          <input
            id="username-input"
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitName() }}
            placeholder="e.g. Sarah"
            maxLength={24}
            style={{
              width: '100%',
              padding: '12px 16px',
              marginBottom: '16px',
              borderRadius: '4px',
              border: '1.5px solid var(--cy-border)',
              fontFamily: 'Space Mono, monospace',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box' as const,
              backgroundColor: 'var(--cy-surface-white)',
              color: 'var(--cy-text)',
            }}
          />
          <button
            id="username-continue-btn"
            onClick={submitName}
            disabled={!nameDraft.trim()}
            className="cy-btn-primary"
            style={{ ...S.copyBtn, flex: 'none', width: '100%', opacity: nameDraft.trim() ? 1 : 0.5, cursor: nameDraft.trim() ? 'pointer' : 'not-allowed' }}
          >
            Continue
          </button>
        </div>
      </Shell>
    )
  }

  /* ── loading / error states ── */
  if (status === 'loading') {
    return (
      <Shell>
        <div style={{ fontFamily: 'Space Mono, monospace', fontSize: '13px', color: 'var(--cy-text-secondary)', letterSpacing: '0.05em' }}>
          CONNECTING TO ROOM…
        </div>
      </Shell>
    )
  }

  if (status === 'error' || status === 'closed') {
    return (
      <Shell>
        <div style={{ maxWidth: '400px', textAlign: 'center', padding: '0 16px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: 'var(--cy-surface-container-high)', display: 'grid', placeItems: 'center',
            margin: '0 auto 20px',
          }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--cy-text-muted)', fontSize: '20px' }}>wifi_off</span>
          </div>
          <h1 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '24px', fontWeight: 700, color: 'var(--cy-text)', marginBottom: '12px' }}>
            Room unavailable
          </h1>
          <p style={{ color: 'var(--cy-text-secondary)', marginBottom: '28px' }}>
            {notice || 'This room was closed or no longer exists.'}
          </p>
          <button
            onClick={() => router.push('/')}
            style={{ ...S.copyBtn, flex: 'none' }}
          >
            Back to home
          </button>
        </div>
      </Shell>
    )
  }

  const isConnected = connection === 'connected'
  const charCount = text.length

  /* ── main UI ── */
  return (
    <div style={S.page}>

      {/* ── Header ── */}
      <div style={{ backgroundColor: 'var(--cy-surface)', borderBottom: '1.5px solid var(--cy-border-strong)', position: 'sticky', top: 0, zIndex: 50 }}>
        <header className="cy-room-header" style={S.header}>
          <div className="cy-room-header-left">
            {/* Logo */}
            <div className="cy-header-logo">
              <button onClick={leave} style={{ ...S.logo, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                ClipYard
              </button>
            </div>

            {/* Room info */}
            <div className="cy-header-info">
              <div style={S.roomBadge}>
                <span style={S.roomBadgeLabel} className="cy-hide-mobile">Room:</span>
                <span style={S.roomBadgeId}>{displayId}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ ...S.connectedDot, backgroundColor: isConnected ? 'var(--cy-primary)' : 'var(--cy-error)' }} />
                <span style={S.connectedLabel}>{isConnected ? 'Connected' : 'Offline'}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="cy-header-actions">
            <ThemeToggle />
            <button
              id="share-btn"
              onClick={shareRoom}
              className="cy-btn-ghost"
              style={S.shareBtn}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>share</span>
              <span className="cy-hide-mobile">{notice || 'SHARE'}</span>
            </button>
          </div>
        </header>
      </div>

      {/* ── Main grid ── */}
      <main className="cy-room-grid" style={S.main}>
        {/* Editor column — 8 cols on desktop, full on mobile */}
        <div className="cy-room-editor" style={S.editorCol}>
          {/* Textarea card */}
          <div style={S.editorCard}>
            <textarea
              id="clipboard-textarea"
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Paste or type text here..."
              spellCheck={false}
              style={S.textarea}
            />
            <div style={S.editorFooter}>
              {/* Left: attachment menu + character count */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto' }}>
                {firebaseUidRef.current && (
                  <AttachmentMenu
                    onFilesSelected={handleAttachmentFiles}
                  />
                )}
                <span>{charCount} CHARACTERS</span>
              </div>
              {/* Center: synced indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', flex: '1 1 auto' }}>
                <div style={{ ...S.syncedDot, backgroundColor: saved ? 'var(--cy-primary)' : 'var(--cy-warning)' }} />
                <span style={{ textTransform: 'uppercase' }}>{saved ? 'Synced' : 'Saving…'}</span>
              </div>
              {/* Right: connected peers with hover popup */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: '1 1 auto' }}>
                <PeersIndicator
                  people={people}
                  userName={userName ?? ''}
                  role={role}
                  deviceLabel={deviceLabelRef.current}
                  serverDevices={serverDevices}
                  localFingerprint={fingerprintRef.current}
                  otherDeviceNames={otherDeviceNames}
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={S.actionRow}>
            <button
              id="copy-clipboard-btn"
              onClick={copyClipboard}
              className="cy-btn-primary"
              style={S.copyBtn}
            >
              {copied ? '✓ COPIED' : 'COPY CLIPBOARD'}
            </button>
            <button
              id="clear-btn"
              onClick={() => handleTextChange('')}
              className="cy-btn-secondary"
              style={S.clearBtn}
            >
              CLEAR
            </button>
          </div>

          {/* The FileSharePanel was moved to the sidebar */}
        </div>

        {/* Sidebar — 4 cols on desktop, full on mobile */}
        <div className="cy-room-sidebar" style={S.sidebar}>

          {/* Connected Devices */}
          <div style={S.sideCard}>
            <h3 style={S.sideCardTitle}>Connected Devices</h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={S.deviceItem}>
                <div style={S.deviceDot} />
                <span>
                  {userName}
                  <span style={{ color: 'var(--cy-text-muted)' }}> · {deviceLabelRef.current}</span>
                  &nbsp;<span style={{ color: 'var(--cy-text-muted)' }}>({role === 'host' ? 'HOST' : 'YOU'})</span>
                </span>
              </li>
              {serverDevices.length > 0
                ? serverDevices
                  .filter((dev) => dev.fingerprint !== fingerprintRef.current)
                  .map((dev, idx) => (
                    <li key={dev.sid || idx} style={S.deviceItem}>
                      <div style={S.deviceDot} />
                      <span>
                        {dev.name || `Participant ${idx + 2}`}
                        {dev.deviceLabel ? <span style={{ color: 'var(--cy-text-muted)' }}> · {dev.deviceLabel}</span> : null}
                        &nbsp;<span style={{ color: 'var(--cy-text-muted)' }}>({dev.role === 'host' ? 'HOST' : 'CONNECTED'})</span>
                      </span>
                    </li>
                  ))
                : otherDeviceNames.map((name) => (
                  <li key={name} style={S.deviceItem}>
                    <div style={S.deviceDot} />
                    {name}&nbsp;
                    <span style={{ color: 'var(--cy-text-muted)' }}>(CONNECTED)</span>
                  </li>
                ))}
            </ul>
            <button
              id="change-name-btn"
              onClick={changeName}
              style={{
                marginTop: '12px',
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--cy-primary)',
                fontFamily: 'Space Mono, monospace',
                fontSize: '12px',
                letterSpacing: '0.02em',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Not you? Change name
            </button>
          </div>

          {/* Room Info */}
          <div style={S.sideCardAlt}>
            <h3 style={{ ...S.sideCardTitle, justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: 'var(--cy-text-secondary)' }}>info</span>
                Room Info
              </div>
              <QrHoverIcon roomUrl={roomUrl} />
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={S.infoRow}>
                <span>ROOM:</span>
                <span style={{ fontWeight: 700, color: 'var(--cy-text)' }}>{displayId}</span>
              </div>
              <div style={S.infoRow}>
                <span>STATUS:</span>
                <span>{people} DEVICE{people !== 1 ? 'S' : ''} CONNECTED</span>
              </div>
              {/* <div style={S.infoRowLast}>
                <span>LIFESPAN:</span>
                <span style={{ color: 'var(--cy-lifespan)' }}>
                  {lifespanMs > 0
                    ? `EXPIRES IN ${String(Math.floor(lifespanMs / 60000)).padStart(2, '0')}:${String(
                        Math.floor((lifespanMs % 60000) / 1000),
                      ).padStart(2, '0')}`
                    : 'EXPIRED'}
                </span>
              </div> */}
            </div>
          </div>

          {/* Shared Files (replaces the hidden one) */}
          {firebaseUidRef.current && (
            <FileSharePanel
              roomId={roomId}
              localUid={firebaseUidRef.current}
              localName={userName ?? ''}
              presence={presenceMap}
              sendFileRef={sendFileRef}
            />
          )}

        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={S.footer}>
        <div className="cy-footer-inner" style={S.footerInner}>
          <span>© 2024 ClipYard Technical Systems</span>
          <div className="cy-footer-links">
            {['Documentation', 'API Status', 'Privacy Protocol', 'GitHub'].map((label) => (
              <a
                key={label}
                href="#"
                style={S.footerLink}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cy-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--cy-text-secondary)')}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ── PeersIndicator: compact peer count with hover popover ── */
function PeersIndicator({
  people,
  userName,
  role,
  deviceLabel,
  serverDevices,
  localFingerprint,
  otherDeviceNames,
}: {
  people: number
  userName: string
  role: 'host' | 'participant'
  deviceLabel: string
  serverDevices: Device[]
  localFingerprint: string
  otherDeviceNames: string[]
}) {
  const [hovered, setHovered] = useState(false)

  const otherDevices = serverDevices.filter((d) => d.fingerprint !== localFingerprint)
  const otherCount = Math.max(0, people - 1)

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '2px 8px',
          borderRadius: '2px',
          border: '1.5px solid var(--cy-border)',
          backgroundColor: 'var(--cy-surface-container)',
          cursor: 'default',
          fontFamily: 'Space Mono, monospace',
          fontSize: '11px',
          lineHeight: '14px',
          letterSpacing: '0.04em',
          color: 'var(--cy-text-secondary)',
          textTransform: 'uppercase' as const,
          whiteSpace: 'nowrap' as const,
        }}
      >
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: otherCount > 0 ? 'var(--cy-primary)' : 'var(--cy-text-muted)', flexShrink: 0 }} />
        {otherCount > 0
          ? `${otherCount} P2P Connected`
          : 'No P2P'}
      </div>

      {/* Hover popover */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            right: 0,
            minWidth: '180px',
            maxWidth: '260px',
            backgroundColor: 'var(--cy-surface)',
            border: '1.5px solid var(--cy-border)',
            borderRadius: '4px',
            padding: '10px 12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 30,
            fontFamily: 'Space Mono, monospace',
            fontSize: '12px',
            lineHeight: '16px',
            color: 'var(--cy-text-secondary)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--cy-text)', marginBottom: '8px' }}>
            Connected Devices
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Other devices */}
            {otherDevices.length > 0
              ? otherDevices.map((dev, idx) => (
                <li key={dev.sid || idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--cy-primary)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {dev.name || `Participant ${idx + 2}`}
                    {dev.deviceLabel ? <span style={{ color: 'var(--cy-text-muted)' }}> · {dev.deviceLabel}</span> : null}
                    &nbsp;<span style={{ color: 'var(--cy-text-muted)' }}>({dev.role === 'host' ? 'HOST' : 'CONNECTED'})</span>
                  </span>
                </li>
              ))
              : otherDeviceNames.map((name) => (
                <li key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--cy-primary)', flexShrink: 0 }} />
                  <span>{name}&nbsp;<span style={{ color: 'var(--cy-text-muted)' }}>(CONNECTED)</span></span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ── QR click icon: small icon that opens a centered modal with QR ── */
function QrHoverIcon({ roomUrl }: { roomUrl: string }) {
  const [showModal, setShowModal] = useState(false)
  const { theme } = useTheme()

  useEffect(() => {
    if (!showModal) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showModal])

  return (
    <>
      <span
        className="material-symbols-outlined"
        style={{
          fontSize: '18px',
          color: 'var(--cy-text-muted)',
          cursor: 'pointer',
          transition: 'color 0.15s ease',
        }}
        onClick={() => setShowModal(true)}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--cy-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--cy-text-muted)' }}
      >
        qr_code_2
      </span>

      {/* Centered modal overlay — no backdrop filter */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--cy-surface)',
              border: '1.5px solid var(--cy-border)',
              borderRadius: '8px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                background: 'none',
                border: 'none',
                color: 'var(--cy-text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--cy-text)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--cy-text-muted)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span>
            </button>

            <span
              style={{
                fontFamily: 'Space Mono, monospace',
                fontSize: '14px',
                letterSpacing: '0.08em',
                fontWeight: 500,
                color: 'var(--cy-text)',
                textTransform: 'uppercase',
              }}
            >
              Scan to Join
            </span>
            <div
              style={{
                width: '200px',
                height: '200px',
                backgroundColor: 'var(--cy-surface-white)',
                border: '1.5px solid var(--cy-border)',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {roomUrl && (
                <QRCodeSVG
                  value={roomUrl}
                  size={184}
                  fgColor={theme === 'dark' ? '#78d8b9' : '#006a53'}
                  bgColor={theme === 'dark' ? '#1c1c1c' : '#ffffff'}
                  level="M"
                  style={{ width: '100%', height: '100%' }}
                />
              )}
            </div>
            <span
              style={{
                fontFamily: 'Space Mono, monospace',
                fontSize: '11px',
                color: 'var(--cy-text-muted)',
                letterSpacing: '0.02em',
              }}
            >
              Point your phone camera at this code
            </span>
          </div>
        </div>
      )}
    </>
  )
}

/* ── QR Card extracted so it can access useTheme ── */
function QrCard({ roomUrl }: { roomUrl: string }) {
  const { theme } = useTheme()
  return (
    <div style={S.qrCard}>
      <span style={S.qrTitle}>Scan to Join</span>
      <div style={{ ...S.qrFrame, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {roomUrl ? (
          <QRCodeSVG
            value={roomUrl}
            size={176}
            fgColor={theme === 'dark' ? '#78d8b9' : '#006a53'}
            bgColor={theme === 'dark' ? '#1c1c1c' : '#ffffff'}
            level="M"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Image
            src="/qr-placeholder.png"
            alt="QR code to join this room"
            width={176}
            height={176}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
      </div>
    </div>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main style={{
      display: 'grid',
      minHeight: '100vh',
      placeItems: 'center',
      backgroundColor: 'var(--cy-surface)',
      padding: '20px',
    }}>
      {children}
    </main>
  )
}