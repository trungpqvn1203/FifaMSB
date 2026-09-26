import { useState, useEffect, useRef, useCallback } from 'react'
import type { MatchSocketEvent } from '@/types/domain'

interface UseMatchSocketOptions {
  matchId?: string
  onMatchEvent?: (event: MatchSocketEvent) => void
  onBanChange?: () => void
}

interface UseMatchSocketReturn {
  isConnected: boolean
  isConnecting: boolean
  matchState: MatchSocketEvent | null
  secondsRemaining: number
  serverTimeOffset: number
  reconnect: () => void
  setMatchState: React.Dispatch<React.SetStateAction<MatchSocketEvent | null>>
}

export function useMatchSocket({
  matchId,
  onMatchEvent,
  onBanChange,
}: UseMatchSocketOptions): UseMatchSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [matchState, setMatchState] = useState<MatchSocketEvent | null>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(0)
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0)

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptRef = useRef<number>(0)
  const isMountedRef = useRef<boolean>(true)
  const connectRef = useRef<() => void>(() => {})

  const onMatchEventRef = useRef(onMatchEvent)
  const onBanChangeRef = useRef(onBanChange)

  useEffect(() => {
    onMatchEventRef.current = onMatchEvent
    onBanChangeRef.current = onBanChange
  }, [onMatchEvent, onBanChange])

  // 1. Countdown timer calculation
  useEffect(() => {
    if (!matchState || matchState.status !== 'BAN_PHASE' || !matchState.banExpiresAt) {
      if (matchState?.status === 'BANS_LOCKED' || matchState?.status === 'COMPLETED') {
        setSecondsRemaining(0)
      }
      return
    }

    const updateCountdown = () => {
      if (!matchState.banExpiresAt) return
      const serverNow = Date.now() + serverTimeOffset
      const expiresAt = new Date(matchState.banExpiresAt).getTime()
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
  }, [matchState, serverTimeOffset])

  // 2. Connect WebSocket
  const connect = useCallback(() => {
    if (!matchId || typeof window === 'undefined') return

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

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
    const wsUrl = `${protocol}//${host}/ws/matches/${matchId}`

    try {
      const ws = new WebSocket(wsUrl)
      socketRef.current = ws

      ws.onopen = () => {
        if (!isMountedRef.current) return
        setIsConnected(true)
        setIsConnecting(false)
        attemptRef.current = 0

        // Heartbeat every 15s
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping')
          }
        }, 15000)
      }

      ws.onmessage = (event) => {
        if (!isMountedRef.current) return
        if (event.data === 'pong') return

        try {
          const data = JSON.parse(event.data) as MatchSocketEvent

          // Compute server time offset
          if (data.serverTime) {
            const serverMs = new Date(data.serverTime).getTime()
            const localMs = Date.now()
            setServerTimeOffset(serverMs - localMs)
          }

          setMatchState((prev) => {
            // Keep local private bans if spectator broadcast masked them
            if (
              prev &&
              data.status === 'BAN_PHASE' &&
              data.bans.length === 0 &&
              prev.bans.length > 0
            ) {
              return {
                ...data,
                bans: prev.bans,
              }
            }
            return data
          })

          if (data.eventType && onMatchEventRef.current) {
            onMatchEventRef.current(data)
          }

          if (
            (data.eventType === 'BAN_SUBMITTED' ||
              data.eventType === 'BAN_DELETED' ||
              data.eventType === 'BANS_CONFIRMED' ||
              data.eventType === 'BANS_LOCKED') &&
            onBanChangeRef.current
          ) {
            onBanChangeRef.current()
          }
        } catch {
          // Ignore parse errors
        }
      }

      ws.onclose = (event) => {
        if (!isMountedRef.current) return
        setIsConnected(false)
        setIsConnecting(false)

        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }

        if (event.code !== 1000 && event.code !== 1008) {
          const delay = Math.min(1000 * 2 ** attemptRef.current, 15000)
          attemptRef.current += 1
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMountedRef.current) {
              connectRef.current()
            }
          }, delay)
        }
      }

      ws.onerror = () => {
        if (!isMountedRef.current) return
        setIsConnected(false)
        setIsConnecting(false)
      }
    } catch {
      setIsConnecting(false)
      setIsConnected(false)
    }
  }, [matchId])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    isMountedRef.current = true
    connect()

    return () => {
      isMountedRef.current = false
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current)
      }
      if (socketRef.current) {
        socketRef.current.onopen = null
        socketRef.current.onclose = null
        socketRef.current.onerror = null
        socketRef.current.onmessage = null
        socketRef.current.close(1000, 'Component unmounted')
        socketRef.current = null
      }
    }
  }, [connect])

  const reconnect = useCallback(() => {
    attemptRef.current = 0
    connect()
  }, [connect])

  return {
    isConnected,
    isConnecting,
    matchState,
    secondsRemaining,
    serverTimeOffset,
    reconnect,
    setMatchState,
  }
}
