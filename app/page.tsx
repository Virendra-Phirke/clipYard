'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Clipboard, Link2, LockKeyhole } from 'lucide-react'
import { isValidRoomId } from '@/lib/clipboard'

export default function Page() {
  const router = useRouter()
  const [roomId, setRoomId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function createRoom() {
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to create room')
      sessionStorage.setItem(`clipboard-token-${payload.roomId}`, JSON.stringify(payload))
      router.push(`/room/${payload.roomId}`)
    } catch (exception) { setError(exception instanceof Error ? exception.message : 'Unable to create room') } finally { setLoading(false) }
  }

  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const normalized = roomId.trim().toLowerCase()
    if (!isValidRoomId(normalized)) { setError('Use the 8-character room code.'); return }
    router.push(`/room/${normalized}`)
  }

  return <main className="min-h-screen bg-background"><div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6 md:px-8 md:py-8"><header className="flex items-center justify-between"><div className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight"><span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"><Clipboard className="size-4" /></span>cliproom</div><span className="text-xs text-muted-foreground">Private by default</span></header><div className="flex flex-1 items-center py-20"><div className="grid w-full gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center"><section><p className="mb-5 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-600" />Real-time clipboard</p><h1 className="max-w-xl text-balance font-mono text-4xl font-semibold leading-tight tracking-[-0.04em] md:text-6xl">Move text between devices, without sending it anywhere.</h1><p className="mt-6 max-w-lg text-pretty leading-7 text-muted-foreground">A temporary shared room for snippets, notes, and everything you need to get from one screen to another.</p><div className="mt-9 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-2"><LockKeyhole className="size-3.5" />No account required</span><span className="inline-flex items-center gap-2"><Link2 className="size-3.5" />Share by link</span></div></section><section className="rounded-xl border bg-card p-5 shadow-sm md:p-7"><div className="mb-6"><h2 className="font-mono text-lg font-semibold">Open a room</h2><p className="mt-1 text-sm text-muted-foreground">Start fresh or join an existing room.</p></div><button onClick={createRoom} disabled={loading} className="flex w-full items-center justify-between rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"><span>{loading ? 'Creating room…' : 'Create new room'}</span><ArrowRight className="size-4" /></button><div className="my-6 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div><form onSubmit={joinRoom} className="flex gap-2"><label htmlFor="room-code" className="sr-only">Room code</label><input id="room-code" value={roomId} onChange={(event) => { setRoomId(event.target.value); setError('') }} maxLength={8} placeholder="Enter room code" className="min-w-0 flex-1 rounded-md border bg-transparent px-3 py-3 font-mono text-sm uppercase outline-none ring-offset-background placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" /><button type="submit" className="rounded-md border px-4 py-3 text-sm font-medium transition-colors hover:bg-muted">Join</button></form>{error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}</section></div></div><footer className="flex justify-between border-t pt-5 text-xs text-muted-foreground"><span>Text is synced live while the room is open.</span><span className="hidden sm:block">cliproom / 2026</span></footer></div></main>
}
