import 'server-only'

import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { getServerConfig } from '@/lib/config'

let adminApp: ReturnType<typeof initializeApp> | null = null

function getAdminApp() {
  if (getApps().length) return getApps()[0]
  if (adminApp) return adminApp
  const { firebase } = getServerConfig()
  adminApp = initializeApp({
    credential: cert({
      projectId: firebase.projectId,
      clientEmail: firebase.clientEmail,
      privateKey: firebase.privateKey,
    }),
    databaseURL: firebase.databaseURL,
  })
  return adminApp
}

export function getFirebaseAdmin() {
  const app = getAdminApp()
  return { auth: getAuth(app), database: getDatabase(app) }
}
