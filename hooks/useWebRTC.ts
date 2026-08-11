/**
 * hooks/useWebRTC.ts
 *
 * Manages a WebRTC mesh for all participants in a ClipYard room.
 * Creates one RTCPeerConnection + RTCDataChannel per remote peer.
 *
 * Deterministic initiator rule: the peer with the lexicographically
 * greater UID creates the offer. This prevents duplicate connections.
 */

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { createPeerConnection, isWebRTCSupported } from '@/lib/webrtc/peerConnection'
import { createImageChannel, setupReceivedChannel } from '@/lib/webrtc/dataChannel'
import {
  sendOffer,
  sendAnswer,
  sendCandidate,
  listenForOffer,
  listenForAnswer,
  listenForCandidates,
  cleanupSignaling,
  cleanupPeerSignaling,
} from '@/lib/webrtc/signaling'
import type { PeerStatus, PeerConnectionInfo, SignalingOffer } from '@/lib/webrtc/types'
import type { Unsubscribe } from 'firebase/database'

export interface WebRTCPeer {
  peerId: string
  peerName: string
  status: PeerStatus
  channel: RTCDataChannel | null
}

interface PeerState {
  connection: RTCPeerConnection
  channel: RTCDataChannel | null
  status: PeerStatus
  peerName: string
  unsubscribes: Unsubscribe[]
  /** Prevent processing stale offers after we already connected */
  hasConnected: boolean
  /** Track the presence instance ID to detect reloads */
  instanceId?: string
}

export interface UseWebRTCOptions {
  roomId: string
  localUid: string
  /** Presence entries keyed by uid. Used to discover peers. */
  presence: Record<string, { name?: string; sid?: string; [key: string]: unknown }>
  enabled?: boolean
  /** Called when a DataChannel receives a message from any peer. */
  onMessage?: (peerId: string, event: MessageEvent) => void
}

export interface UseWebRTCReturn {
  peers: WebRTCPeer[]
  isSupported: boolean
  getChannel: (peerId: string) => RTCDataChannel | null
  getAllChannels: () => Array<{ peerId: string; peerName: string; channel: RTCDataChannel }>
}

export function useWebRTC({
  roomId,
  localUid,
  presence,
  enabled = true,
  onMessage,
}: UseWebRTCOptions): UseWebRTCReturn {
  const supported = isWebRTCSupported()
  const peerStatesRef = useRef(new Map<string, PeerState>())
  const onMessageRef = useRef(onMessage)
  onMessageRef.current = onMessage
  const [peerList, setPeerList] = useState<WebRTCPeer[]>([])
  /** Tracks which peers we've already initiated or responded to, to avoid double connections */
  const processedPeersRef = useRef(new Set<string>())

  // Update peer list state for consumers
  const syncPeerList = useCallback(() => {
    const list: WebRTCPeer[] = []
    for (const [peerId, state] of peerStatesRef.current) {
      list.push({
        peerId,
        peerName: state.peerName,
        status: state.status,
        channel: state.channel,
      })
    }
    setPeerList(list)
  }, [])

  const updatePeerStatus = useCallback((peerId: string, status: PeerStatus) => {
    const state = peerStatesRef.current.get(peerId)
    if (state) {
      state.status = status
      if (status === 'connected') state.hasConnected = true
      syncPeerList()
    }
  }, [syncPeerList])

  // Set up the channel message handler
  const attachChannelHandlers = useCallback((peerId: string, channel: RTCDataChannel) => {
    channel.onmessage = (event) => {
      onMessageRef.current?.(peerId, event)
    }
    channel.onopen = () => {
      const state = peerStatesRef.current.get(peerId)
      if (state) {
        state.channel = channel
        updatePeerStatus(peerId, 'connected')
      }
    }
    channel.onclose = () => {
      updatePeerStatus(peerId, 'disconnected')
    }
    channel.onerror = () => {
      updatePeerStatus(peerId, 'failed')
    }
  }, [updatePeerStatus])

  // Set up event handlers on a peer connection
  const attachConnectionHandlers = useCallback((peerId: string, pc: RTCPeerConnection) => {
    pc.onconnectionstatechange = () => {
      const csMap: Record<string, PeerStatus> = {
        connecting: 'connecting',
        connected: 'connected',
        disconnected: 'disconnected',
        failed: 'failed',
        closed: 'disconnected',
      }
      const mapped = csMap[pc.connectionState]
      if (mapped) updatePeerStatus(peerId, mapped)
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        updatePeerStatus(peerId, 'failed')
      }
    }

    // Handle incoming DataChannel from the answerer side
    pc.ondatachannel = (event) => {
      const channel = event.channel
      setupReceivedChannel(channel)
      attachChannelHandlers(peerId, channel)
      const state = peerStatesRef.current.get(peerId)
      if (state) {
        state.channel = channel
        syncPeerList()
      }
    }
  }, [updatePeerStatus, attachChannelHandlers, syncPeerList])

  const initiatePeer = useCallback(async (
    peerId: string,
    peerName: string,
    instanceId?: string,
  ) => {
    if (peerStatesRef.current.has(peerId)) return
    if (!localUid || !roomId) return

    const pc = createPeerConnection()
    const channel = createImageChannel(pc)
    const unsubscribes: Unsubscribe[] = []

    const state: PeerState = {
      connection: pc,
      channel,
      status: 'connecting',
      peerName,
      unsubscribes,
      hasConnected: false,
      instanceId,
    }
    peerStatesRef.current.set(peerId, state)
    syncPeerList()

    attachConnectionHandlers(peerId, pc)
    attachChannelHandlers(peerId, channel)

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendCandidate(roomId, localUid, peerId, event.candidate).catch(console.error)
      }
    }

    // Listen for answer
    const answerUnsub = listenForAnswer(roomId, localUid, peerId, async (answer) => {
      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
        }
      } catch (err) {
        console.error(`[WebRTC] Failed to set remote answer for ${peerId}:`, err)
      }
    })
    unsubscribes.push(answerUnsub)

    // Listen for ICE candidates from remote
    const candidatesUnsub = listenForCandidates(roomId, localUid, peerId, async (candidate) => {
      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        }
      } catch (err) {
        console.error(`[WebRTC] Failed to add ICE candidate from ${peerId}:`, err)
      }
    })
    unsubscribes.push(candidatesUnsub)

    // Create and send offer
    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      if (offer.sdp) {
        await sendOffer(roomId, localUid, peerId, offer.sdp)
      }
    } catch (err) {
      console.error(`[WebRTC] Failed to create offer for ${peerId}:`, err)
      updatePeerStatus(peerId, 'failed')
    }
  }, [roomId, localUid, syncPeerList, attachConnectionHandlers, attachChannelHandlers, updatePeerStatus])

  const respondToPeer = useCallback(async (
    peerId: string,
    peerName: string,
    offer: SignalingOffer,
    instanceId?: string,
  ) => {
    if (peerStatesRef.current.has(peerId)) return
    if (!localUid || !roomId) return

    const pc = createPeerConnection()
    const unsubscribes: Unsubscribe[] = []

    const state: PeerState = {
      connection: pc,
      channel: null,
      status: 'connecting',
      peerName,
      unsubscribes,
      hasConnected: false,
      instanceId,
    }
    peerStatesRef.current.set(peerId, state)
    syncPeerList()

    attachConnectionHandlers(peerId, pc)

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendCandidate(roomId, localUid, peerId, event.candidate).catch(console.error)
      }
    }

    // Listen for ICE candidates from remote
    const candidatesUnsub = listenForCandidates(roomId, localUid, peerId, async (candidate) => {
      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        }
      } catch (err) {
        console.error(`[WebRTC] Failed to add ICE candidate from ${peerId}:`, err)
      }
    })
    unsubscribes.push(candidatesUnsub)

    // Set remote offer and create answer
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      if (answer.sdp) {
        await sendAnswer(roomId, localUid, peerId, answer.sdp)
      }
    } catch (err) {
      console.error(`[WebRTC] Failed to respond to offer from ${peerId}:`, err)
      updatePeerStatus(peerId, 'failed')
    }
  }, [roomId, localUid, syncPeerList, attachConnectionHandlers, updatePeerStatus])

  // Tear down a single peer connection
  const destroyPeer = useCallback((peerId: string) => {
    const state = peerStatesRef.current.get(peerId)
    if (!state) return
    state.unsubscribes.forEach((unsub) => { try { unsub() } catch { /* ignore */ } })
    try { state.channel?.close() } catch { /* ignore */ }
    try { state.connection.close() } catch { /* ignore */ }
    peerStatesRef.current.delete(peerId)
    processedPeersRef.current.delete(peerId)
    if (roomId && localUid) {
      cleanupPeerSignaling(roomId, localUid, peerId).catch(() => undefined)
    }
    syncPeerList()
  }, [roomId, localUid, syncPeerList])

  // Main effect: watch presence and set up WebRTC connections
  useEffect(() => {
    if (!enabled || !supported || !localUid || !roomId) return

    const presenceUids = Object.keys(presence).filter((uid) => uid !== localUid)

    // Detect stale sessions (e.g. peer reloaded tab but kept same UID)
    for (const uid of presenceUids) {
      const state = peerStatesRef.current.get(uid)
      const currentInstanceId = presence[uid]?.instanceId as string | undefined
      if (state && state.instanceId && currentInstanceId && state.instanceId !== currentInstanceId) {
        console.log(`[WebRTC] Peer ${uid} reloaded (instanceId changed). Tearing down old connection.`)
        destroyPeer(uid)
      }
    }

    // Connect to new peers
    for (const uid of presenceUids) {
      if (peerStatesRef.current.has(uid)) continue
      if (processedPeersRef.current.has(uid)) continue

      const peerName = (presence[uid]?.name as string) || 'Participant'
      const instanceId = presence[uid]?.instanceId as string | undefined

      // Deterministic initiator: higher UID creates the offer
      if (localUid > uid) {
        processedPeersRef.current.add(uid)
        initiatePeer(uid, peerName, instanceId).catch(console.error)
      }
      // If localUid < uid, we wait for their offer (handled by listenForIncomingOffers)
    }

    // Clean up peers that left
    for (const [peerId] of peerStatesRef.current) {
      if (!presenceUids.includes(peerId)) {
        destroyPeer(peerId)
      }
    }
  }, [enabled, supported, localUid, roomId, presence, initiatePeer, destroyPeer])

  // Listen for incoming offers from peers with higher UIDs (the initiators)
  useEffect(() => {
    if (!enabled || !supported || !localUid || !roomId) return

    const unsubs: Unsubscribe[] = []
    const presenceUids = Object.keys(presence).filter((uid) => uid !== localUid)

    for (const uid of presenceUids) {
      if (peerStatesRef.current.has(uid)) continue
      if (processedPeersRef.current.has(uid)) continue

      // Higher UIDs are initiators; we listen for their offer
      if (localUid < uid) {
        const peerName = (presence[uid]?.name as string) || 'Participant'
        const instanceId = presence[uid]?.instanceId as string | undefined
        const unsub = listenForOffer(roomId, localUid, uid, (offer) => {
          if (peerStatesRef.current.has(uid)) return
          if (processedPeersRef.current.has(uid)) return

          processedPeersRef.current.add(uid)
          respondToPeer(uid, peerName, offer, instanceId).catch(console.error)
        })
        unsubs.push(unsub)
      }
    }

    return () => {
      unsubs.forEach((unsub) => unsub())
    }
  }, [enabled, supported, localUid, roomId, presence, respondToPeer])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const [peerId] of peerStatesRef.current) {
        const state = peerStatesRef.current.get(peerId)
        if (state) {
          state.unsubscribes.forEach((unsub) => { try { unsub() } catch { /* ignore */ } })
          try { state.channel?.close() } catch { /* ignore */ }
          try { state.connection.close() } catch { /* ignore */ }
        }
      }
      peerStatesRef.current.clear()
      processedPeersRef.current.clear()
      if (roomId && localUid) {
        cleanupSignaling(roomId, localUid).catch(() => undefined)
      }
    }
  }, [roomId, localUid])

  const getChannel = useCallback((peerId: string): RTCDataChannel | null => {
    return peerStatesRef.current.get(peerId)?.channel ?? null
  }, [])

  const getAllChannels = useCallback((): Array<{ peerId: string; peerName: string; channel: RTCDataChannel }> => {
    const result: Array<{ peerId: string; peerName: string; channel: RTCDataChannel }> = []
    for (const [peerId, state] of peerStatesRef.current) {
      if (state.channel && state.channel.readyState === 'open') {
        result.push({ peerId, peerName: state.peerName, channel: state.channel })
      }
    }
    return result
  }, [])

  return {
    peers: peerList,
    isSupported: supported,
    getChannel,
    getAllChannels,
  }
}
