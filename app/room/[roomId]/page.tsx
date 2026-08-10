'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
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
  subscribeToRoomLive,
  subscribeToRoomPresence,
} from '@/services/room'
import { getLocalFingerprint } from '@/services/fingerprint'
import { PRESENCE_LIFESPAN_MS } from '@/lib/presence'

/* ─────────────────────────────── styles ─────────────────────────────── */

const S = {
  /* layout */
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: 'Hanken Grotesk, sans-serif',
    color: '#161d1a',
    fontSize: '16px',
    lineHeight: '24px',
    WebkitFontSmoothing: 'antialiased',
  },
  /* header */
  header: {
    backgroundColor: '#f3fbf6',
    borderBottom: '1.5px solid #bdc9c3',
    width: '100%',
    height: '64px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 24px',
    maxWidth: '1280px',
    margin: '0 auto',
    boxSizing: 'border-box' as const,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '24px' },
  logo: {
    fontFamily: 'Hanken Grotesk, sans-serif',
    fontSize: '24px',
    lineHeight: '32px',
    letterSpacing: '-0.01em',
    fontWeight: 700,
    color: '#006a53',
  },
  roomBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#eef5f0',
    padding: '4px 12px',
    borderRadius: '2px',
    border: '1.5px solid #d1d9d4',
  },
  roomBadgeLabel: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: '#3e4944',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  roomBadgeId: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    lineHeight: '20px',
    letterSpacing: '0.02em',
    fontWeight: 500,
    color: '#161d1a',
  },
  connectedDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16856a' },
  connectedLabel: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: '#3e4944',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.02em',
  },
  shareBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1.5px solid #d1d9d4',
    borderRadius: '2px',
    color: '#161d1a',
    cursor: 'pointer',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    letterSpacing: '0.02em',
    fontWeight: 500,
    transition: 'background-color 0.2s ease',
  },
  /* main grid */
  main: {
    flexGrow: 1,
    maxWidth: '1280px',
    margin: '0 auto',
    width: '100%',
    padding: '32px 24px',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '24px',
    boxSizing: 'border-box' as const,
  },
  /* editor column */
  editorCol: { display: 'flex', flexDirection: 'column' as const, gap: '24px' },
  editorCard: {
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#f3fbf6',
    borderRadius: '4px',
    border: '1.5px solid #d1d9d4',
    overflow: 'hidden',
    boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
  },
  textarea: {
    width: '100%',
    padding: '16px',
    resize: 'none' as const,
    outline: 'none',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: '#161d1a',
    backgroundColor: 'transparent',
    border: 'none',
    height: '600px',
  },
  editorFooter: {
    padding: '8px 16px',
    borderTop: '1.5px solid #bdc9c3',
    backgroundColor: '#eef5f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: '#3e4944',
  },
  syncedDot: { width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16856a' },
  /* action buttons */
  actionRow: { display: 'flex', gap: '16px' },
  copyBtn: {
    flex: 1,
    backgroundColor: '#16856a',
    color: '#fdfffc',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '12px 24px',
    borderRadius: '4px',
    border: '1.5px solid #16856a',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    transition: 'background-color 0.2s ease',
  },
  clearBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    color: '#555f71',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    letterSpacing: '0.05em',
    fontWeight: 500,
    padding: '12px 24px',
    borderRadius: '4px',
    border: '1.5px solid #d1d9d4',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    transition: 'background-color 0.2s ease',
  },
  /* sidebar */
  sidebar: { display: 'flex', flexDirection: 'column' as const, gap: '24px' },
  sideCard: {
    backgroundColor: '#f3fbf6',
    borderRadius: '4px',
    border: '1.5px solid #d1d9d4',
    padding: '20px',
  },
  sideCardAlt: {
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    border: '1.5px solid #d1d9d4',
    padding: '20px',
  },
  sideCardTitle: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    lineHeight: '20px',
    letterSpacing: '0.08em',
    fontWeight: 500,
    color: '#161d1a',
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
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: '#3e4944',
  },
  deviceDot: { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#16856a', flexShrink: 0 },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1.5px solid rgba(189,201,195,0.3)',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: '#3e4944',
  },
  infoRowLast: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: '#3e4944',
  },
  qrCard: {
    backgroundColor: '#f3fbf6',
    borderRadius: '4px',
    border: '1.5px solid #d1d9d4',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
  },
  qrTitle: {
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '14px',
    letterSpacing: '0.08em',
    fontWeight: 500,
    color: '#161d1a',
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
  },
  qrFrame: {
    width: '192px',
    height: '192px',
    backgroundColor: '#ffffff',
    border: '1.5px solid #d1d9d4',
    padding: '8px',
  },
  /* footer */
  footer: {
    backgroundColor: '#eef5f0',
    borderTop: '1.5px solid #bdc9c3',
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
    fontFamily: 'JetBrains Mono, monospace',
    fontSize: '13px',
    lineHeight: '18px',
    color: '#555f71',
  },
  footerLink: {
    color: '#3e4944',
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
  const [status, setStatus] = useState<'loading' | 'ready' | 'closed' | 'error'>('loading')
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'offline'>('connecting')
  const [role, setRole] = useState<'host' | 'participant'>('participant')
  const [saved, setSaved] = useState(true)
  const [people, setPeople] = useState(1)
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  const [userName, setUserName] = useState<string | null | undefined>(undefined)
  const [nameDraft, setNameDraft] = useState('')
  const roomUrl = useMemo(() => getRoomUrl(roomId), [roomId])
  const fingerprintRef = useRef('')
  const deviceLabelRef = useRef('Browser')
  const tokenRef = useRef('')
  const dirtyRef = useRef(false)
  const textRef = useRef('')
  const lastKnownUpdatedAtRef = useRef<number | undefined>(undefined)
  const saveTimerRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<number | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const presenceUnsubRef = useRef<(() => void) | null>(null)

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

    async function handleLiveUpdate(state: RoomLiveState) {
      if (!alive) return
      if (state.status === 'closed') {
        clearStoredHostFingerprint(roomId)
        clearCachedToken(roomId)
        setStatus('closed')
        return
      }

      const now = Date.now()
      const activeEntries = Object.entries(state.presence).filter(([_, entry]) => {
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
      setConnection('connected')

      if (state.updatedAt !== undefined) {
        const previousUpdatedAt = lastKnownUpdatedAtRef.current
        if (previousUpdatedAt !== undefined && state.updatedAt !== previousUpdatedAt) {
          if (!dirtyRef.current) {
            loadSnapshot().catch(() => undefined)
          }
        }
        lastKnownUpdatedAtRef.current = state.updatedAt
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

        let effectiveRole = payload.role
        // If server says we're host, persist fingerprint. Otherwise, attempt
        // a reclaim flow when local storage indicates this device was the
        // original host (survives refresh). The reclaim endpoint will verify
        // the fingerprint against the previous host presence entry and, if
        // valid, reassign hostUid and return a new host token.
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
                // Upgrade to host token and persist it in session cache.
                payload = { ...payload, token: body.token, role: 'host' }
                tokenRef.current = body.token
                try {
                  sessionStorage.setItem(`clipboard-token-${roomId}`, JSON.stringify(payload))
                } catch {}
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
        await sendPresence(roomId, payload.token, fingerprintRef.current, deviceLabelRef.current, userName ?? '')
        await loadSnapshot()

        const handleUnload = () => sendLeaveBeacon(roomId, tokenRef.current, fingerprintRef.current)

        window.addEventListener('pagehide', handleUnload)
        window.addEventListener('beforeunload', handleUnload)

        const unsubscribe = subscribeToRoomLive(roomId, handleLiveUpdate)
        const presenceUnsub = subscribeToRoomPresence(roomId, (presence) => {
          if (!alive) return
          const now = Date.now()
          const activeEntries = Object.entries(presence || {}).filter(([_, entry]) => {
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
        })

        cleanupRef.current = () => {
          window.removeEventListener('pagehide', handleUnload)
          window.removeEventListener('beforeunload', handleUnload)
          unsubscribe()
          presenceUnsub()
          handleUnload()
        }
        presenceUnsubRef.current = presenceUnsub

        heartbeatTimerRef.current = window.setInterval(() => {
          sendPresence(roomId, payload.token, fingerprintRef.current, deviceLabelRef.current, userName ?? '')
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
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
      if (heartbeatTimerRef.current !== null) window.clearInterval(heartbeatTimerRef.current)
    }
  }, [roomId, router, userName])

  function queueSave(nextText: string) {
    textRef.current = nextText
    dirtyRef.current = true
    setText(nextText)
    setSaved(false)
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveText(roomId, tokenRef.current, textRef.current, fingerprintRef.current)
        .then(() => { dirtyRef.current = false; setSaved(true); setConnection('connected') })
        .catch(() => setConnection('offline'))
    }, 350)
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
        <div style={{ maxWidth: '360px', width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '24px', fontWeight: 700, color: '#161d1a', marginBottom: '8px' }}>
            What&apos;s your name?
          </h1>
          <p style={{ color: '#3e4944', marginBottom: '20px', fontSize: '14px' }}>
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
              border: '1.5px solid #d1d9d4',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box' as const,
            }}
          />
          <button
            id="username-continue-btn"
            onClick={submitName}
            disabled={!nameDraft.trim()}
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
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: '#3e4944', letterSpacing: '0.05em' }}>
          CONNECTING TO ROOM…
        </div>
      </Shell>
    )
  }

  if (status === 'error' || status === 'closed') {
    return (
      <Shell>
        <div style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            backgroundColor: '#e8f0eb', display: 'grid', placeItems: 'center',
            margin: '0 auto 20px',
          }}>
            <span className="material-symbols-outlined" style={{ color: '#6e7a74', fontSize: '20px' }}>wifi_off</span>
          </div>
          <h1 style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: '24px', fontWeight: 700, color: '#161d1a', marginBottom: '12px' }}>
            Room unavailable
          </h1>
          <p style={{ color: '#3e4944', marginBottom: '28px' }}>
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
      <div style={{ backgroundColor: '#f3fbf6', borderBottom: '1.5px solid #bdc9c3', position: 'sticky', top: 0, zIndex: 50 }}>
        <header style={S.header}>
          {/* Left: logo + room badge + connected */}
          <div style={S.headerLeft}>
            <button onClick={leave} style={{ ...S.logo, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              ClipYard
            </button>

            <div style={S.roomBadge}>
              <span style={S.roomBadgeLabel}>Room:</span>
              <span style={S.roomBadgeId}>{displayId}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ ...S.connectedDot, backgroundColor: isConnected ? '#16856a' : '#ba1a1a' }} />
              <span style={S.connectedLabel}>{isConnected ? 'Connected' : 'Offline'}</span>
            </div>
          </div>

          {/* Right: share */}
          <button
            id="share-btn"
            onClick={shareRoom}
            style={S.shareBtn}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eef5f0')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>share</span>
            {notice || 'SHARE'}
          </button>
        </header>
      </div>

      {/* ── Main grid ── */}
      <main style={{
        ...S.main,
        gridTemplateColumns: 'repeat(12, 1fr)',
      }}>
        {/* Editor column — 8 cols */}
        <div style={{ ...S.editorCol, gridColumn: 'span 8' }}>
          {/* Textarea card */}
          <div style={S.editorCard}>
            <textarea
              id="clipboard-textarea"
              value={text}
              onChange={(e) => queueSave(e.target.value)}
              placeholder="Paste or type text here..."
              spellCheck={false}
              style={S.textarea}
            />
            <div style={S.editorFooter}>
              <span>{charCount} CHARACTERS</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ ...S.syncedDot, backgroundColor: saved ? '#16856a' : '#e89c2a' }} />
                <span style={{ textTransform: 'uppercase' }}>{saved ? 'Synced' : 'Saving…'}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={S.actionRow}>
            <button
              id="copy-clipboard-btn"
              onClick={copyClipboard}
              style={S.copyBtn}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#006a53')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#16856a')}
            >
              {copied ? '✓ COPIED' : 'COPY CLIPBOARD'}
            </button>
            <button
              id="clear-btn"
              onClick={() => queueSave('')}
              style={S.clearBtn}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eef5f0')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              CLEAR
            </button>
          </div>
        </div>

        {/* Sidebar — 4 cols */}
        <div style={{ ...S.sidebar, gridColumn: 'span 4' }}>

          {/* Connected Devices */}
          <div style={S.sideCard}>
            <h3 style={S.sideCardTitle}>Connected Devices</h3>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', listStyle: 'none', padding: 0, margin: 0 }}>
              <li style={S.deviceItem}>
                <div style={S.deviceDot} />
                <span>
                  {userName}
                  <span style={{ color: '#6e7a74' }}> · {deviceLabelRef.current}</span>
                  &nbsp;<span style={{ color: '#6e7a74' }}>({role === 'host' ? 'HOST' : 'YOU'})</span>
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
                          {dev.deviceLabel ? <span style={{ color: '#6e7a74' }}> · {dev.deviceLabel}</span> : null}
                          &nbsp;<span style={{ color: '#6e7a74' }}>({dev.role === 'host' ? 'HOST' : 'CONNECTED'})</span>
                        </span>
                      </li>
                    ))
                : otherDeviceNames.map((name) => (
                    <li key={name} style={S.deviceItem}>
                      <div style={S.deviceDot} />
                      {name}&nbsp;
                      <span style={{ color: '#6e7a74' }}>(CONNECTED)</span>
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
                color: '#16856a',
                fontFamily: 'JetBrains Mono, monospace',
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
            <h3 style={S.sideCardTitle}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#3e4944' }}>info</span>
              Room Info
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={S.infoRow}>
                <span>ROOM:</span>
                <span style={{ fontWeight: 700, color: '#161d1a' }}>{displayId}</span>
              </div>
              <div style={S.infoRow}>
                <span>STATUS:</span>
                <span>{people} DEVICE{people !== 1 ? 'S' : ''} CONNECTED</span>
              </div>
              <div style={S.infoRowLast}>
                <span>LIFESPAN:</span>
                <span style={{ color: '#95453b' }}>EXPIRES IN 24:32</span>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div style={S.qrCard}>
            <span style={S.qrTitle}>Scan to Join</span>
            <div style={{ ...S.qrFrame, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {roomUrl ? (
                <QRCodeSVG
                  value={roomUrl}
                  size={176}
                  fgColor="#006a53"
                  bgColor="#ffffff"
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

        </div>
      </main>

      {/* ── Footer ── */}
      <footer style={S.footer}>
        <div style={S.footerInner}>
          <span>© 2024 ClipYard Technical Systems</span>
          <div style={{ display: 'flex', gap: '24px' }}>
            {['Documentation', 'API Status', 'Privacy Protocol', 'GitHub'].map((label) => (
              <a
                key={label}
                href="#"
                style={S.footerLink}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#006a53')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#3e4944')}
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

function Shell({ children }: { children: ReactNode }) {
  return (
    <main style={{
      display: 'grid',
      minHeight: '100vh',
      placeItems: 'center',
      backgroundColor: '#f3fbf6',
      padding: '20px',
    }}>
      {children}
    </main>
  )
}