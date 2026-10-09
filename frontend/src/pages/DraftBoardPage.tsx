import React, { useState, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react'
import { apiClient, ApiError } from '@/lib/api-client'
import { useAuth } from '@/context/AuthContext'
import { useDraftSocket } from '@/hooks/useDraftSocket'
import { DraftHeader } from '@/components/draft/DraftHeader'
import { DraftTeamHeader } from '@/components/draft/DraftTeamHeader'
import { DraftMatrix } from '@/components/draft/DraftMatrix'
import { WarRoomSidebar } from '@/components/draft/WarRoomSidebar'
import { PlayerPoolDrawer } from '@/components/draft/PlayerPoolDrawer'
import { PlayerPickReveal, type RevealPlayerData } from '@/components/draft/PlayerPickReveal'
import type {
  DraftDetail,
  DraftPickBoardItem,
  Tournament,
  DraftSocketEvent,
  PlayerSeason,
} from '@/types/domain'

export const DraftBoardPage: React.FC = () => {
  const { tournamentId, draftId: routeDraftId } = useParams<{
    tournamentId?: string
    draftId?: string
  }>()

  const { user, isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const [revealedPlayer, setRevealedPlayer] = useState<RevealPlayerData | null>(null)
  const [lastPickedCard, setLastPickedCard] = useState<PlayerSeason | null>(null)

  // 1. Resolve Tournament or Draft Detail
  // If we arrived via /tournaments/:tournamentId/draft, fetch via /tournaments/:id/draft
  const {
    data: initialDraft,
    isLoading: isDraftLoading,
    error: draftError,
  } = useQuery<DraftDetail>({
    queryKey: ['draft-detail', routeDraftId || tournamentId],
    queryFn: async () => {
      if (routeDraftId) {
        const res = await apiClient.get<DraftDetail>(`/drafts/${routeDraftId}`)
        return res.data
      }
      const res = await apiClient.get<DraftDetail>(`/tournaments/${tournamentId}/draft`)
      return res.data
    },
    refetchOnWindowFocus: true,
  })

  const effectiveDraftId = initialDraft?.id || routeDraftId
  const effectiveTournamentId = initialDraft?.tournamentId || tournamentId

  // 2. Fetch Tournament metadata for title
  const { data: tournament } = useQuery<Tournament>({
    queryKey: ['tournament', effectiveTournamentId],
    queryFn: async () => {
      const res = await apiClient.get<Tournament>(`/tournaments/${effectiveTournamentId}`)
      return res.data
    },
    enabled: !!effectiveTournamentId,
  })

  // 3. Fetch Initial Draft Picks
  const { data: picks = [] } = useQuery<DraftPickBoardItem[]>({
    queryKey: ['draft-picks', effectiveDraftId],
    queryFn: async () => {
      if (!effectiveDraftId) return []
      const res = await apiClient.get<DraftPickBoardItem[]>(`/drafts/${effectiveDraftId}/picks`)
      return res.data
    },
    enabled: !!effectiveDraftId,
  })

  // Callback for when version gap is detected or pick is made
  const handleResync = useCallback(() => {
    if (effectiveDraftId) {
      queryClient.invalidateQueries({ queryKey: ['draft-picks', effectiveDraftId] })
      queryClient.invalidateQueries({ queryKey: ['draft-detail', effectiveDraftId] })
    }
  }, [effectiveDraftId, queryClient])

  const handlePickMade = useCallback(
    (event: DraftSocketEvent) => {
      if (effectiveDraftId) {
        queryClient.invalidateQueries({ queryKey: ['draft-picks', effectiveDraftId] })
        queryClient.invalidateQueries({ queryKey: ['draft-detail', effectiveDraftId] })
      }

      if (event.pickedPlayer) {
        const isMyTeamPick = Boolean(user?.teamId && event.currentTeamId === user.teamId)
        const teamName = event.teams?.find((t) => t.id === event.currentTeamId)?.name || 'ĐỘI DRAFT'
        setRevealedPlayer({
          name: event.pickedPlayer.name,
          position: event.pickedPlayer.position,
          rating: event.pickedPlayer.rating,
          salary: event.pickedPlayer.salary,
          imageUrl: event.pickedPlayer.imageUrl,
          externalPlayerId: event.pickedPlayer.externalPlayerId,
          seasonCode: event.pickedPlayer.season?.code,
          seasonBadgeUrl: event.pickedPlayer.season?.badgeUrl,
          teamName,
          isMyPick: isMyTeamPick,
          roundNumber: event.currentRound,
          turnNumber: event.currentTurn,
        })
      }
    },
    [effectiveDraftId, queryClient, user]
  )

  // 4. WebSocket Realtime Hook
  const {
    isConnected,
    isConnecting,
    draftState: socketState,
    secondsRemaining,
  } = useDraftSocket({
    draftId: effectiveDraftId,
    onVersionGap: handleResync,
    onPickMade: handlePickMade,
  })

  // Merge HTTP initial draft with latest WebSocket snapshot
  const activeStatus = socketState?.status || initialDraft?.status || 'PICKING'
  const activeRound = socketState?.currentRound || initialDraft?.currentRound || 1
  const activeTurn = socketState?.currentTurn || initialDraft?.currentTurn || 1
  const activeTeamId = socketState ? socketState.currentTeamId : initialDraft?.currentTeamId || null
  const activeVersion = socketState?.version ?? initialDraft?.version ?? 1

  const teams = useMemo(() => {
    if (socketState?.teams && socketState.teams.length > 0) {
      return socketState.teams
    }
    return initialDraft?.teams || []
  }, [socketState?.teams, initialDraft?.teams])

  const budgetCap = Number(initialDraft?.rulesSnapshot?.budget || 305)
  const rosterSize = Number(initialDraft?.rulesSnapshot?.rosterSize || 24)

  // Current active team
  const currentTeam = useMemo(() => {
    return teams.find((t) => t.id === activeTeamId)
  }, [teams, activeTeamId])

  // Is it the current user's turn?
  const isMyTurn = useMemo(() => {
    if (!activeTeamId) return false
    if (isAdmin) return true // Admin can assist or test pick
    if (user?.role === 'TEAM_USER' && user.teamId) {
      return user.teamId === activeTeamId
    }
    return false
  }, [activeTeamId, isAdmin, user])

  // 5. Make Pick Mutation
  const makePickMutation = useMutation({
    mutationFn: async (playerSeasonId: string) => {
      if (!effectiveDraftId) throw new Error('No draft ID')
      const res = await apiClient.post(`/drafts/${effectiveDraftId}/picks`, {
        playerSeasonId,
        expectedVersion: activeVersion,
      })
      return res.data
    },
    onSuccess: () => {
      setActionError(null)
      if (lastPickedCard) {
        setRevealedPlayer({
          name: lastPickedCard.player.name,
          position: lastPickedCard.position,
          rating: lastPickedCard.rating,
          salary: lastPickedCard.salary,
          imageUrl: lastPickedCard.imageUrl,
          externalPlayerId: lastPickedCard.player.externalPlayerId,
          seasonCode: lastPickedCard.season.code,
          seasonBadgeUrl: lastPickedCard.season.badgeUrl,
          teamName: currentTeam?.name || 'ĐỘI CỦA BẠN',
          isMyPick: true,
          roundNumber: activeRound,
          turnNumber: activeTurn,
        })
      }
      handleResync()
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setActionError(err.message)
      } else {
        setActionError('Không thể gửi lượt pick. Vui lòng thử lại.')
      }
    },
  })

  const handleMakePick = (playerSeasonId: string, card?: PlayerSeason) => {
    if (card) {
      setLastPickedCard(card)
    }
    makePickMutation.mutate(playerSeasonId)
  }

  const handlePreviewCard = (card: PlayerSeason) => {
    setRevealedPlayer({
      name: card.player.name,
      position: card.position,
      rating: card.rating,
      salary: card.salary,
      imageUrl: card.imageUrl,
      externalPlayerId: card.player.externalPlayerId,
      seasonCode: card.season.code,
      seasonBadgeUrl: card.season.badgeUrl,
      teamName: currentTeam?.name || 'CHẾ ĐỘ XEM TRƯỚC',
      isMyPick: true,
      roundNumber: activeRound,
      turnNumber: activeTurn,
    })
  }

  // 6. Admin Action Mutations
  const pauseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/drafts/${effectiveDraftId}/pause`)
      return res.data
    },
    onSuccess: () => handleResync(),
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Không thể tạm dừng phiên Draft'),
  })

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/drafts/${effectiveDraftId}/resume`)
      return res.data
    },
    onSuccess: () => handleResync(),
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Không thể tiếp tục phiên Draft'),
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/drafts/${effectiveDraftId}/cancel`)
      return res.data
    },
    onSuccess: () => handleResync(),
    onError: (err) => setActionError(err instanceof ApiError ? err.message : 'Không thể huỷ phiên Draft'),
  })

  const isActionLoading =
    pauseMutation.isPending || resumeMutation.isPending || cancelMutation.isPending

  if (isDraftLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-app-void text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-neon animate-spin" />
          <span className="font-mono text-xs text-zinc-400 uppercase tracking-wider">
            Đang vào phòng Draft...
          </span>
        </div>
      </div>
    )
  }

  if (draftError || !initialDraft) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-app-void text-white p-6 gap-4">
        <div className="p-4 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Không tìm thấy phiên Draft hoặc giải đấu chưa sẵn sàng bắt đầu Draft.</span>
        </div>
        <Link
          to={effectiveTournamentId ? `/tournaments/${effectiveTournamentId}` : '/tournaments'}
          className="inline-flex items-center gap-2 px-4 py-2 bg-surface-card border border-border-default hover:bg-surface-elevated text-xs font-mono uppercase"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Giải Đấu
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-app-void text-white flex flex-col selection:bg-neon selection:text-black">
      {/* 1. Header HUD with Turn Clock and Controls */}
      <DraftHeader
        tournamentId={effectiveTournamentId}
        tournamentName={tournament?.name}
        draftStatus={activeStatus}
        currentRound={activeRound}
        currentTurn={activeTurn}
        secondsRemaining={secondsRemaining}
        isConnected={isConnected}
        isConnecting={isConnecting}
        isAdmin={isAdmin}
        onPause={() => pauseMutation.mutate()}
        onResume={() => resumeMutation.mutate()}
        onCancel={() => cancelMutation.mutate()}
        isActionLoading={isActionLoading}
      />

      {/* Main Broadcast Draft Arena */}
      <main className="flex-1 w-full px-4 md:px-6 py-3 flex flex-col gap-3">
        {/* Top Arena: Draft Board (9 Cols) + War Room Sidebar (3 Cols) */}
        <div className="grid grid-cols-12 gap-3 items-start">
          {/* Draft Board Matrix Container (9 Cols) */}
          <div className="col-span-12 lg:col-span-9 bg-surface-panel border border-border-default/80 p-2.5 shadow-panel flex flex-col gap-1 overflow-hidden">
            {/* Team Headers */}
            <DraftTeamHeader
              teams={teams}
              currentTeamId={activeTeamId}
              budgetCap={budgetCap}
              currentRound={activeRound}
              currentTurn={activeTurn}
            />

            {/* Matrix Grid */}
            <DraftMatrix
              teams={teams}
              picks={picks}
              totalRounds={rosterSize}
              currentRound={activeRound}
              currentTurn={activeTurn}
              currentTeamId={activeTeamId}
              status={activeStatus}
            />
          </div>

          {/* Right Sidebar: War Room Feeds (3 Cols) */}
          <div className="col-span-12 lg:col-span-3">
            <WarRoomSidebar
              teams={teams}
              currentTeamId={activeTeamId}
              secondsRemaining={secondsRemaining}
              status={activeStatus}
            />
          </div>
        </div>

        {/* Lower Section: Tactical Player Draft Pool */}
        <div className="w-full">
          <PlayerPoolDrawer
            currentTeamId={activeTeamId}
            currentTeam={currentTeam}
            draftStatus={activeStatus}
            picks={picks}
            isMyTurn={isMyTurn}
            onMakePick={handleMakePick}
            onPreviewCard={handlePreviewCard}
            isPickingLoading={makePickMutation.isPending}
            pickError={actionError}
            currentRound={activeRound}
            currentTurn={activeTurn}
            secondsRemaining={secondsRemaining}
          />
        </div>
      </main>

      {/* Broadcast Footer */}
      <footer className="w-full bg-app-void border-t border-border-default/40 py-2 px-4 md:px-6 flex items-center justify-between font-mono text-[10px] text-zinc-500">
        <div className="flex items-center gap-4">
          <span>KÊNH PHÁT TRỰC TIẾP: ARENA 01</span>
          <span className="text-zinc-700">//</span>
          <span>GIAO THỨC: WEBSOCKET REALTIME ENGINE</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-neon">ĐANG PHÁT TRỰC TIẾP</span>
          <span>© 2026 FC ONLINE PRO DRAFT</span>
        </div>
      </footer>

      {/* Walkout / Reveal Showcase Overlay */}
      <PlayerPickReveal
        data={revealedPlayer}
        onDismiss={() => setRevealedPlayer(null)}
      />
    </div>
  )
}
