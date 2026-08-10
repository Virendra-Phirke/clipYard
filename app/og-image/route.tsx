import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const title = url.searchParams.get('title') || 'ClipYard'
  const subtitle = url.searchParams.get('subtitle') || 'Real-Time Text Transfer'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '72px',
          background: '#f3fbf6',
          color: '#161d1a',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ fontSize: '48px', fontWeight: 700, marginBottom: '24px' }}>{title}</div>
        <div style={{ fontSize: '28px', fontWeight: 500, color: '#3e4944' }}>{subtitle}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '48px' }}>
          <div style={{ width: '64px', height: '64px', background: '#006a53', borderRadius: '18px' }} />
          <div style={{ fontSize: '20px', fontWeight: 600 }}>ClipYard</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  )
}
