'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Check, Clipboard, Copy, LogOut, Users, Wifi, WifiOff } from 'lucide-react'
import { getRoomUrl, isValidRoomId, sanitizeClipboard } from '@/lib/clipboard'

type RoomTokenPayload = { token: string; role: 'host' | 'participant' }
type RoomState = { roomId: string; status: 'open' | 'closed'; text: string; people: number }

const pendingConnections = new Map<string, Promise<RoomTokenPayload>>()

async function fetchRoomState(roomId: string, token: string) {
  const response = await fetch(`/api/rooms/${roomId}?token=${encodeURIComponent(token)}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error || 'Unable to connect') as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return payload as RoomState
}

async function sendRoomPresence(roomId: string, token: string) {
  await fetch(`/api/rooms/${roomId}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ type: 'presence' }),
  })
}

async function saveRoomText(roomId: string, token: string, text: string) {
  const response = await fetch(`/api/rooms/${roomId}?token=${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text: sanitizeClipboard(text) }),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to save text')
}

async function closeRoom(roomId: string, token: string) {
  const response = await fetch(`/api/rooms/${roomId}?token=${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${token}`,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Unable to close room')
}

function getRoomToken(roomId: string, signalRoomId: string) {
  const existing = sessionStorage.getItem(`clipboard-token-${roomId}`)
  if (existing) return Promise.resolve(JSON.parse(existing) as RoomTokenPayload)

  const pending = pendingConnections.get(roomId)
  if (pending) return pending

  const request = fetch('/api/rooms/join', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomId: signalRoomId }),
  })
    .then(async (response) => {
      const nextPayload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(nextPayload.error || 'That room is unavailable')
      const payload = nextPayload as RoomTokenPayload
      sessionStorage.setItem(`clipboard-token-${roomId}`, JSON.stringify(payload))
      return payload
    })
    .finally(() => {
      pendingConnections.delete(roomId)
    })

  pendingConnections.set(roomId, request)
  return request
}

export default function RoomPage() {
  const params = useParams<{ roomId: string }>()
  const router = useRouter()
  const roomId = String(params.roomId || '').toLowerCase()
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'loading' | 'ready' | 'closed' | 'error'>('loading')
  const [connection, setConnection] = useState<'connecting' | 'connected' | 'offline'>('connecting')
  const [role, setRole] = useState<'host' | 'participant'>('participant')
  const [saved, setSaved] = useState(true)
  const [people, setPeople] = useState(1)
  const [notice, setNotice] = useState('')
  const roomUrl = useMemo(() => getRoomUrl(roomId), [roomId])
  const tokenRef = useRef('')
  const dirtyRef = useRef(false)
  const textRef = useRef('')
  const saveTimerRef = useRef<number | null>(null)
  const pollTimerRef = useRef<number | null>(null)
  const heartbeatTimerRef = useRef<number | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isValidRoomId(roomId)) {
      router.replace('/')
      return
    }

    let alive = true

    async function loadSnapshot() {
      try {
        const payload = await fetchRoomState(roomId, tokenRef.current)
        if (!alive) return
        if (payload.status === 'closed') {
          sessionStorage.removeItem(`clipboard-token-${roomId}`)
          setStatus('closed')
          return
        }
        setPeople(Math.max(1, payload.people || 1))
        if (!dirtyRef.current && payload.text !== textRef.current) {
          textRef.current = payload.text
          setText(payload.text)
          setSaved(true)
        }
        setStatus('ready')
        setConnection('connected')
      } catch (error) {
        if (!alive) return
        const statusCode = error instanceof Error && 'status' in error ? Number((error as Error & { status?: number }).status) : 0
        if (statusCode === 404) {
          sessionStorage.removeItem(`clipboard-token-${roomId}`)
          setStatus('closed')
          return
        }
        setConnection('offline')
        throw error
      }
    }

    async function connect() {
      try {
        const payload = await getRoomToken(roomId, roomId)

        tokenRef.current = payload.token
        setRole(payload.role)
        setConnection('connected')
        await sendRoomPresence(roomId, payload.token)
        await loadSnapshot()

        cleanupRef.current = () => {
          const token = tokenRef.current
          if (!token) return
          const url = `/api/rooms/${roomId}?token=${encodeURIComponent(token)}`
          if (payload.role === 'host') {
            void fetch(url, { method: 'DELETE', headers: { authorization: `Bearer ${token}` }, keepalive: true })
            return
          }
          void fetch(url, { method: 'DELETE', headers: { authorization: `Bearer ${token}` }, keepalive: true })
        }

        pollTimerRef.current = window.setInterval(() => {
          loadSnapshot().catch(() => undefined)
        }, 1500)

        heartbeatTimerRef.current = window.setInterval(() => {
          sendRoomPresence(roomId, payload.token).catch(() => setConnection('offline'))
        }, 15000)
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
      if (pollTimerRef.current !== null) window.clearInterval(pollTimerRef.current)
      if (heartbeatTimerRef.current !== null) window.clearInterval(heartbeatTimerRef.current)
    }
  }, [roomId, router])

  function queueSave(nextText: string) {
    textRef.current = nextText
    dirtyRef.current = true
    setText(nextText)
    setSaved(false)
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      saveRoomText(roomId, tokenRef.current, textRef.current)
        .then(() => {
          dirtyRef.current = false
          setSaved(true)
          setConnection('connected')
        })
        .catch(() => setConnection('offline'))
    }, 250)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(roomUrl)
    setNotice('Link copied')
  }

  async function leave() {
    const token = tokenRef.current
    if (role === 'host' && token) {
      await closeRoom(roomId, token).catch(() => undefined)
    } else if (token) {
      await fetch(`/api/rooms/${roomId}?token=${encodeURIComponent(token)}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => undefined)
    }
    sessionStorage.removeItem(`clipboard-token-${roomId}`)
    router.push('/')
  }

  if (status === 'loading') {
    return <Shell><div className="animate-pulse text-muted-foreground">Connecting to room…</div></Shell>
  }

  if (status === 'error' || status === 'closed') {
    return <Shell><div className="max-w-md text-center"><div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-muted"><WifiOff className="size-5 text-muted-foreground" /></div><h1 className="font-mono text-2xl font-semibold">Room unavailable</h1><p className="mt-3 text-muted-foreground">{notice || 'This room was closed or no longer exists.'}</p><button className="mt-7 text-sm font-medium underline underline-offset-4" onClick={() => router.push('/')}>Back to home</button></div></Shell>
  }

  return <main className="min-h-screen bg-background"><header className="mx-auto flex max-w-5xl items-center justify-between border-b px-5 py-4 md:px-8"><button onClick={leave} className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight"><span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"><Clipboard className="size-4" /></span>cliproom</button><div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="hidden items-center gap-1.5 sm:flex"><Users className="size-3.5" />{people} online</span><span className="flex items-center gap-1.5">{connection === 'connected' ? <Wifi className="size-3.5 text-emerald-600" /> : <WifiOff className="size-3.5" />}{connection === 'connected' ? 'Live' : 'Offline'}</span></div></header><div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-8 md:px-8 md:py-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground">Room</p><h1 className="mt-2 font-mono text-3xl font-semibold tracking-tight">{roomId}</h1></div><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{saved ? 'Saved' : 'Saving…'}</span>{saved ? <Check className="size-4 text-emerald-600" /> : <span className="size-2 animate-pulse rounded-full bg-amber-500" />}</div></div><section className="overflow-hidden rounded-xl border bg-card shadow-sm"><label htmlFor="clipboard" className="sr-only">Shared clipboard text</label><textarea id="clipboard" value={text} onChange={(event) => queueSave(event.target.value)} placeholder="Paste something here…" spellCheck={false} className="min-h-[48vh] w-full resize-y bg-transparent p-5 font-mono text-sm leading-7 outline-none placeholder:text-muted-foreground/60 md:min-h-[52vh] md:p-7" /></section><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{notice || 'Text is synced live while the room is open.'}</p><div className="flex items-center gap-2"><button onClick={copyLink} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"><Copy className="size-4" />Copy link</button><button onClick={leave} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"><LogOut className="size-4" />Leave</button></div></div></div></main>
}

function Shell({ children }: { children: ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-background px-5">{children}</main>
}
