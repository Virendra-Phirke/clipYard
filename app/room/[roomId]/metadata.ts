import type { Metadata } from 'next'
import { getRoomMetadata } from '@/lib/seo/config'

export async function generateMetadata({ params }: { params: { roomId: string } }): Promise<Metadata> {
  const roomId = String(params.roomId || '').toLowerCase()
  return getRoomMetadata(roomId)
}
