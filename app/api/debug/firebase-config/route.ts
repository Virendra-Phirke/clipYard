import { NextResponse } from 'next/server'
import { publicConfig, getServerConfig } from '@/lib/config'

export async function GET() {
  try {
    const server = getServerConfig()
    return NextResponse.json({ public: publicConfig.firebase, server: { projectId: server.firebase.projectId, hasServerCreds: true } })
  } catch (err) {
    return NextResponse.json({ public: publicConfig.firebase, server: { hasServerCreds: false } })
  }
}
