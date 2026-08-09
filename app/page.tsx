'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clipboard, Copy, Github, LockKeyhole, QrCode } from 'lucide-react'
import { isValidRoomId } from '@/lib/clipboard'

const previewText = `git clone https://github.com/example/clipyard.git
cd clipyard
npm install
npm run dev

// Database connection string
postgres://user:pass@localhost:5432/clipyard_db`

export default function Page() {
  const router = useRouter()
  const [roomId, setRoomId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function createRoom() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to create room')
      sessionStorage.setItem(`clipboard-token-${payload.roomId}`, JSON.stringify(payload))
      router.push(`/room/${payload.roomId}`)
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Unable to create room')
    } finally {
      setLoading(false)
    }
  }

  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = roomId.trim().toLowerCase()
    if (!isValidRoomId(normalized)) {
      setError('Use the 8-character room code.')
      return
    }
    router.push(`/room/${normalized}`)
  }

  async function copyPreview() {
    await navigator.clipboard.writeText(previewText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/95">
        <div className="mx-auto flex h-[70px] max-w-[1400px] items-center justify-between px-6 md:px-10 lg:px-12">
          <a href="#top" className="flex items-center gap-2 text-[21px] font-semibold tracking-[-0.04em] text-primary">
            <span className="text-lg">◆</span> ClipYard
          </a>
          <nav className="flex items-center gap-7 text-[15px]">
            <a href="#how-it-works" className="transition-colors hover:text-primary">How it works</a>
            <a href="https://github.com/mahesh2-lab/clipYard" className="transition-colors hover:text-primary">GitHub</a>
          </nav>
        </div>
      </header>

      <section id="top" className="dot-grid px-6 pb-24 pt-28 md:px-10 md:pb-32 md:pt-32 lg:px-12">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center text-center">
          <p className="eyebrow">Real-time text transfer</p>
          <h1 className="mt-7 max-w-[700px] text-balance text-5xl font-semibold leading-[1.06] tracking-[-0.055em] md:text-[56px]">Send text between your devices.</h1>
          <p className="mt-8 max-w-[680px] text-pretty text-lg leading-8 text-muted-foreground">A temporary clipboard for moving text between your laptop, phone, and desktop.<br className="hidden md:block" /> No account. No setup.</p>
          <div className="mt-11 flex flex-col items-center gap-4 sm:flex-row">
            <button onClick={createRoom} disabled={loading} className="inline-flex h-[54px] items-center justify-center bg-primary px-7 text-[16px] font-semibold text-primary-foreground shadow-[0_2px_0_rgba(0,0,0,0.16)] transition-transform hover:-translate-y-0.5 disabled:opacity-60">{loading ? 'Creating...' : 'Create Clipboard'} <span className="ml-2 text-lg">→</span></button>
            <span className="text-sm text-muted-foreground">or</span>
            <form onSubmit={joinRoom} className="flex h-[54px] w-full max-w-[395px] items-center border border-border bg-card px-5 sm:w-[395px]">
              <span className="font-mono text-sm tracking-wide">JOIN EXISTING</span>
              <span className="mx-4 h-6 w-px bg-border" />
              <input aria-label="Room code" value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="Room code" className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none placeholder:text-muted-foreground" maxLength={8} />
              <button className="font-mono text-sm font-bold text-primary" type="submit">Join →</button>
            </form>
          </div>
          {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

          <div className="mt-28 w-full max-w-[990px] border border-border bg-card text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-6 py-3.5 font-mono text-sm tracking-wide">
              <span className="flex items-center gap-3"><span className="size-2 rounded-full bg-primary" /> CLIPBOARD <span className="text-muted-foreground">•</span> CONNECTED</span>
              <span className="border border-border bg-muted px-3 py-1 text-xs">ID: K7Q9-X2MP</span>
            </div>
            <div className="relative min-h-[280px] whitespace-pre-wrap px-7 py-7 font-mono text-sm leading-6 md:min-h-[280px]">{previewText}<button aria-label="Copy preview text" onClick={copyPreview} className="absolute bottom-6 right-6 grid size-12 place-items-center border border-border bg-secondary text-foreground transition-colors hover:bg-muted">{copied ? <Check className="size-5" /> : <Copy className="size-5" />}</button></div>
            <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-7 py-3.5 font-mono text-xs tracking-wide"><span>248 CHARACTERS</span><span>SYNCED 2 DEVICES</span></div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto flex max-w-[1120px] flex-col gap-12 px-6 py-16 md:flex-row md:gap-8 md:px-10 md:py-20 lg:px-0">
        <div className="grid flex-1 gap-8 md:grid-cols-3 md:gap-6">
          <Step number="01" title="CREATE" copy="Generate a room" detail="Click create to instantly get a secure, temporary workspace." />
          <Step number="02" title="SHARE" copy="Connect devices" detail="Use the 8-character code or QR to join from any device." />
          <Step number="03" title="COPY" copy="Sync text instantly" detail="Paste on one device, copy on the other. Disappears when closed." />
        </div>
        <div className="border-t border-border pt-8 md:w-[275px] md:border-l md:border-t-0 md:pl-9 md:pt-0">
          <ul className="flex flex-col gap-4 font-mono text-xs tracking-wide"><Feature icon={<Check />} text="NO ACCOUNT REQUIRED" /><Feature icon={<Check />} text="REAL-TIME WEBSOCKET SYNC" /><Feature icon={<Check />} text="E2E ENCRYPTION OPTION" /></ul>
        </div>
      </section>

      <footer className="border-t border-border bg-secondary/40 px-6 py-8 md:px-10 lg:px-12"><div className="mx-auto flex max-w-[1400px] flex-col gap-5 md:flex-row md:items-center md:justify-between"><div className="text-xl font-semibold tracking-[-0.04em]">◆ CLIPYARD</div><div className="flex flex-col gap-3 font-mono text-xs text-muted-foreground md:flex-row md:items-center md:gap-8"><span>© 2024 ClipYard. All rights reserved.</span><span>Terms&nbsp;&nbsp; Privacy&nbsp;&nbsp; Support</span></div></div></footer>
    </main>
  )
}

function Step({ number, title, copy, detail }: { number: string; title: string; copy: string; detail: string }) {
  return <div className="border-t border-border pt-3"><p className="eyebrow">{number} {title}</p><h2 className="mt-8 text-lg font-semibold">{copy}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p></div>
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <li className="flex items-center gap-3"><span className="grid size-3.5 place-items-center rounded-full border border-primary text-primary [&_svg]:size-2.5">{icon}</span>{text}</li>
}
