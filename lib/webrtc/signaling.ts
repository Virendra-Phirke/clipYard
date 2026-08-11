/**
 * lib/webrtc/signaling.ts
 *
 * Firebase Realtime Database signaling layer for WebRTC.
 * Uses the existing Firebase client config and scoped listeners
 * to exchange SDP offers/answers and ICE candidates.
 *
 * Schema (Outbox Pattern using existing presence write permissions):
 *   rooms/{roomId}/presence/{fromUid}/signalingOutbox/{toUid}/offer   → SignalingOffer
 *   rooms/{roomId}/presence/{fromUid}/signalingOutbox/{toUid}/answer  → SignalingAnswer
 *   rooms/{roomId}/presence/{fromUid}/signalingOutbox/{toUid}/candidates/{pushId} → SignalingCandidate
 */

'use client'

import { getFirebaseServices } from '@/lib/firebase-client'
import {
  ref,
  set,
  push,
  remove,
  onValue,
  onChildAdded,
  type Unsubscribe,
} from 'firebase/database'
import type { SignalingOffer, SignalingAnswer, SignalingCandidate } from './types'

// ─── Path helpers ───────────────────────────────────────────────────────────

function signalingPath(roomId: string, fromUid: string, toUid: string) {
  return `rooms/${roomId}/presence/${fromUid}/signalingOutbox/${toUid}`
}

// ─── Write operations ───────────────────────────────────────────────────────

export async function sendOffer(
  roomId: string,
  fromUid: string,
  toUid: string,
  sdp: string,
): Promise<void> {
  const { database } = getFirebaseServices()
  
  // Wipe the entire outbox for this specific peer to ensure no stale candidates or offers
  const outboxRef = ref(database, signalingPath(roomId, fromUid, toUid))
  await remove(outboxRef).catch(() => undefined)

  const offerRef = ref(database, `${signalingPath(roomId, fromUid, toUid)}/offer`)
  await set(offerRef, { type: 'offer', sdp } satisfies SignalingOffer)
}

export async function sendAnswer(
  roomId: string,
  fromUid: string,
  toUid: string,
  sdp: string,
): Promise<void> {
  const { database } = getFirebaseServices()

  // Wipe the entire outbox for this specific peer to ensure no stale candidates or answers
  const outboxRef = ref(database, signalingPath(roomId, fromUid, toUid))
  await remove(outboxRef).catch(() => undefined)

  const answerRef = ref(database, `${signalingPath(roomId, fromUid, toUid)}/answer`)
  await set(answerRef, { type: 'answer', sdp } satisfies SignalingAnswer)
}

export async function sendCandidate(
  roomId: string,
  fromUid: string,
  toUid: string,
  candidate: RTCIceCandidate,
): Promise<void> {
  const { database } = getFirebaseServices()
  const candidatesRef = ref(database, `${signalingPath(roomId, fromUid, toUid)}/candidates`)
  await push(candidatesRef, {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
  } satisfies SignalingCandidate)
}

// ─── Listen operations (scoped to specific peer pair) ───────────────────────

/**
 * Listen for an SDP offer sent TO localUid FROM remoteUid.
 * Path: rooms/{roomId}/presence/{remoteUid}/signalingOutbox/{localUid}/offer
 */
export function listenForOffer(
  roomId: string,
  localUid: string,
  remoteUid: string,
  callback: (offer: SignalingOffer) => void,
): Unsubscribe {
  const { database } = getFirebaseServices()
  const offerRef = ref(database, `${signalingPath(roomId, remoteUid, localUid)}/offer`)
  return onValue(offerRef, (snapshot) => {
    const data = snapshot.val()
    if (data && data.type === 'offer' && typeof data.sdp === 'string') {
      callback(data as SignalingOffer)
    }
  })
}

/**
 * Listen for an SDP answer sent TO localUid FROM remoteUid.
 * Path: rooms/{roomId}/presence/{remoteUid}/signalingOutbox/{localUid}/answer
 */
export function listenForAnswer(
  roomId: string,
  localUid: string,
  remoteUid: string,
  callback: (answer: SignalingAnswer) => void,
): Unsubscribe {
  const { database } = getFirebaseServices()
  const answerRef = ref(database, `${signalingPath(roomId, remoteUid, localUid)}/answer`)
  return onValue(answerRef, (snapshot) => {
    const data = snapshot.val()
    if (data && data.type === 'answer' && typeof data.sdp === 'string') {
      callback(data as SignalingAnswer)
    }
  })
}

/**
 * Listen for ICE candidates sent TO localUid FROM remoteUid.
 * Path: rooms/{roomId}/presence/{remoteUid}/signalingOutbox/{localUid}/candidates/{pushId}
 */
export function listenForCandidates(
  roomId: string,
  localUid: string,
  remoteUid: string,
  callback: (candidate: SignalingCandidate) => void,
): Unsubscribe {
  const { database } = getFirebaseServices()
  const candidatesRef = ref(
    database,
    `${signalingPath(roomId, remoteUid, localUid)}/candidates`,
  )
  return onChildAdded(candidatesRef, (snapshot) => {
    const data = snapshot.val()
    if (data && typeof data.candidate === 'string') {
      callback(data as SignalingCandidate)
    }
  })
}



// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Remove all signaling data authored by this uid (both outgoing and
 * incoming references). Called when leaving a room.
 */
export async function cleanupSignaling(roomId: string, uid: string): Promise<void> {
  const { database } = getFirebaseServices()
  // Remove outgoing signaling outbox
  const outgoingRef = ref(database, `rooms/${roomId}/presence/${uid}/signalingOutbox`)
  await remove(outgoingRef).catch(() => undefined)
}

/**
 * Remove the signaling path between two specific peers.
 */
export async function cleanupPeerSignaling(
  roomId: string,
  localUid: string,
  remoteUid: string,
): Promise<void> {
  const { database } = getFirebaseServices()
  // Remove both directions
  await Promise.all([
    remove(ref(database, `${signalingPath(roomId, localUid, remoteUid)}`)).catch(() => undefined),
    remove(ref(database, `${signalingPath(roomId, remoteUid, localUid)}`)).catch(() => undefined),
  ])
}
