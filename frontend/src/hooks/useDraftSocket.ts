import { useState, useEffect, useRef, useCallback } from 'react'
import type { DraftSocketEvent } from '@/types/domain'

interface UseDraftSocketOptions {
  draftId?: string
  onVersionGap?: () => void
  onPickMade?: (event: DraftSocketEvent) => void
  onDraftEvent?: (event: DraftSocketEvent) => void
}

interface UseDraftSocketReturn {
  isConnected: boolean
  isConnecting: boolean
  draftState: DraftSocketEvent | null
  secondsRemaining: number
  serverTimeOffset: number
  reconnect: () => void
}

export function useDraftSocket({
  draftId,
  onVersionGap,
  onPickMade,
  onDraftEvent,
}: UseDraftSocketOptions): UseDraftSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [draftState, setDraftState] = useState<DraftSocketEvent | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0)

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptRef = useRef<number>(0)
  const lastVersionRef = useRef<number>(0)
  const isMountedRef = useRef<boolean>(true)
  const connectRef = useRef<() => void>(() => {})

  // Callbacks in refs to avoid recreating connect handler
  const onVersionGapRef = useRef(onVersionGap)
  const onPickMadeRef = useRef(onPickMade)
  const onDraftEventRef = useRef(onDraftEvent)

  useEffect(() => {
    onVersionGapRef.current = onVersionGap
    onPickMadeRef.current = onPickMade
    onDraftEventRef.current = onDraftEvent
  }, [onVersionGap, onPickMade, onDraftEvent])

  // 1. Precise countdown timer calculation
  useEffect(() => {
    if (!draftState || draftState.status !== 'PICKING' || !draftState.turnExpiresAt) {
      if (draftState?.status === 'PAUSED' && draftState.remainingMillis) {
        setSecondsRemaining(Math.max(0, Math.ceil(draftState.remainingMillis / 1000)))
      } else {
        setSecondsRemaining(0)
      }
      return
    }

    const updateCountdown = () => {
      if (!draftState.turnExpiresAt) return
      const serverNow = Date.now() + serverTimeOffset
      const expiresAt = new Date(draftState.turnExpiresAt).getTime()
      const diffMs = expiresAt - serverNow
      const remainingSecs = Math.max(0, Math.ceil(diffMs / 1000))
      setSecondsRemaining(remainingSecs)
    }

    updateCountdown()
    countdownIntervalRef.current = setInterval(updateCountdown, 250)

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
    }
  }, [draftState, serverTimeOffset])

  // 2. Connect WebSocket
  const connect = useCallback(() => {
    if (!draftId || typeof window === 'undefined') return

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    // Close existing socket
    if (socketRef.current) {
      socketRef.current.onopen = null
      socketRef.current.onclose = null
      socketRef.current.onerror = null
      socketRef.current.onmessage = null
      socketRef.current.close()
      socketRef.current = null
    }

    setIsConnecting(true)

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws/drafts/${draftId}`

    try {
      const ws = new WebSocket(wsUrl)
      socketRef.current = ws

      ws.onopen = () => {
        if (!isMountedRef.current) return
        setIsConnected(true)
        setIsConnecting(false)
        attemptRef.current = 0

        // Start heartbeat: ping every 15 seconds
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping')
          }
        }, 15000)
      }

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return

        // Handle pong heartbeat
        if (event.data === 'pong') return

        try {
          const payload: DraftSocketEvent = JSON.parse(event.data)

          // Clock synchronization: calculate server offset
          if (payload.serverTime) {
            const serverMs = new Date(payload.serverTime).getTime()
            const localMs = Date.now()
            setServerTimeOffset(serverMs - localMs)
          }

          // Version gap check: if version skipped more than 1, signal resync
          if (
            lastVersionRef.current > 0 &&
            payload.version > lastVersionRef.current + 1
          ) {
            onVersionGapRef.current?.()
          }
          lastVersionRef.current = payload.version

          // Update state
          setDraftState(payload)
          onDraftEventRef.current?.(payload)

          if (payload.eventType === 'PICK_MADE') {
            onPickMadeRef.current?.(payload)
          }
        } catch {
          // Non-JSON message, ignore
        }
      }

      ws.onclose = () => {
        if (!isMountedRef.current) return
        setIsConnected(false)
        setIsConnecting(false)

        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }

        // Exponential backoff reconnect
        const attempt = attemptRef.current
        const delay = Math.min(10000, 1000 * Math.pow(1.5, attempt))
        attemptRef.current = attempt + 1

        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connectRef.current()
          }
        }, delay)
      }

      ws.onerror = () => {
        // ws.onclose will be called after onerror
      }
    } catch {
      setIsConnecting(false)
      setIsConnected(false)
    }
  }, [draftId])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    isMountedRef.current = true
    connect()

    return () => {
      isMountedRef.current = false
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
      if (socketRef.current) {
        socketRef.current.onopen = null
        socketRef.current.onclose = null
        socketRef.current.onerror = null
        socketRef.current.onmessage = null
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [connect])

  const manualReconnect = useCallback(() => {
    attemptRef.current = 0
    connect()
  }, [connect])

  return {
    isConnected,
    isConnecting,
    draftState,
    secondsRemaining,
    serverTimeOffset,
    reconnect: manualReconnect,
  }
}
