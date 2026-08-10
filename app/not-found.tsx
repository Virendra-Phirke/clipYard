import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page not found — ClipYard',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
}

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center', color: 'var(--cy-text)' }}>
      <div>
        <p style={{ fontSize: '14px', fontFamily: 'JetBrains Mono, monospace', marginBottom: '16px' }}>404</p>
        <h1 style={{ fontFamily: 'Hanken Grotesk, sans-serif', fontSize: 'clamp(32px, 48px, 64px)', margin: 0 }}>Page not found</h1>
        <p style={{ marginTop: '16px', color: 'var(--cy-text-secondary)', fontSize: '16px', lineHeight: '1.5' }}>
          The page you are looking for does not exist. Return to the homepage to create a new ClipYard room.
        </p>
        <a href="/" style={{ marginTop: '24px', display: 'inline-block', color: 'var(--cy-primary-text)', textDecoration: 'underline', fontFamily: 'JetBrains Mono, monospace' }}>
          Back to home
        </a>
      </div>
    </div>
  )
}
