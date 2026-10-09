import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Search,
  ChevronDown,
  AlertCircle,
  Loader2,
  Sparkles,
  Maximize2,
  Layers,
  X,
} from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import type {
  PlayerSeason,
  PlayerSeasonList,
  DraftPickBoardItem,
  TeamDraftStatus,
  SeasonOption,
} from '@/types/domain'
import { POSITION_FILTERS, getPositionStyle } from '@/lib/draft-utils'
import { PlayerPoolModal } from '@/components/draft/PlayerPoolModal'

interface PlayerPoolDrawerProps {
  currentTeamId: string | null
  currentTeam?: TeamDraftStatus
  draftStatus: string
  picks: DraftPickBoardItem[]
  isMyTurn: boolean
  onMakePick: (playerSeasonId: string, card?: PlayerSeason) => void
  onPreviewCard?: (card: PlayerSeason) => void
  isPickingLoading: boolean
  pickError?: string | null
  currentRound?: number
  currentTurn?: number
  secondsRemaining?: number
}

export const PlayerPoolDrawer: React.FC<PlayerPoolDrawerProps> = ({
  currentTeam,
  draftStatus,
  picks,
  isMyTurn,
  onMakePick,
  onPreviewCard,
  isPickingLoading,
  pickError,
  currentRound,
  currentTurn,
  secondsRemaining,
}) => {
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL')
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [sortBy, setSortBy] = useState<'salary-desc' | 'salary-asc' | 'ovr-desc'>('salary-desc')
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  // Fetch available seasons for the season filter dropdown
  const { data: seasons = [] } = useQuery<SeasonOption[]>({
    queryKey: ['db-seasons'],
    queryFn: async () => {
      const res = await apiClient.get<SeasonOption[]>('/seasons')
      return res.data
    },
    staleTime: 60000,
  })

  // Set of already drafted card IDs and player IDs for fast O(1) lookup
  const draftedCardIds = useMemo(() => {
    const map = new Map<string, string>() // cardId -> teamName
    for (const p of picks) {
      map.set(p.player.playerSeasonId, p.team.name)
    }
    return map
  }, [picks])

  const draftedPlayerIds = useMemo(() => {
    const set = new Set<string>()
    for (const p of picks) {
      set.add(p.player.playerId)
    }
    return set
  }, [picks])

  // Fetch player season cards
  const { data: playerList, isLoading } = useQuery<PlayerSeasonList>({
    queryKey: ['player-seasons', selectedPosition, selectedSeasonId, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('pageSize', '100')
      if (selectedPosition !== 'ALL') {
        params.set('position', selectedPosition)
      }
      if (selectedSeasonId !== 'ALL') {
        params.set('seasonId', selectedSeasonId)
      }
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim())
      }
      const res = await apiClient.get<PlayerSeasonList>(`/player-seasons?${params.toString()}`)
      return res.data
    },
    staleTime: 30000,
  })

  // Sort and filter loaded cards
  const sortedCards = useMemo(() => {
    if (!playerList?.items) return []
    let cards = [...playerList.items]

    // Client-side season filter safeguard
    if (selectedSeasonId !== 'ALL') {
      cards = cards.filter((c) => c.season.id === selectedSeasonId)
    }

    // Client-side search enhancement (matches player name, external ID, or season code)
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase()
      cards = cards.filter(
        (c) =>
          c.player.name.toLowerCase().includes(q) ||
          c.season.code.toLowerCase().includes(q) ||
          (c.player.externalPlayerId && c.player.externalPlayerId.includes(q))
      )
    }

    cards.sort((a, b) => {
      if (sortBy === 'salary-desc') {
        return b.salary - a.salary || (b.rating || 0) - (a.rating || 0)
      }
      if (sortBy === 'salary-asc') {
        return a.salary - b.salary || (b.rating || 0) - (a.rating || 0)
      }
      if (sortBy === 'ovr-desc') {
        return (b.rating || 0) - (a.rating || 0) || b.salary - a.salary
      }
      return 0
    })

    return cards
  }, [playerList, selectedSeasonId, searchTerm, sortBy])

  const remainingBudget = currentTeam?.budgetRemaining ?? 305

  return (
    <>
      <div className="w-full bg-surface-panel border border-border-default/80 p-3 md:p-4 flex flex-col gap-3 shadow-panel">
        {/* 1. Header & Filters Row */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* Position Filter Chips */}
          <div className="flex items-center flex-wrap gap-1">
            {POSITION_FILTERS.map((pos) => {
              const isSelected = selectedPosition === pos
              return (
                <button
                  key={pos}
                  onClick={() => setSelectedPosition(pos)}
                  className={`px-2 py-1 font-mono text-[11px] uppercase font-bold transition-colors ${
                    isSelected
                      ? 'bg-neon text-black shadow-glow-neon'
                      : 'bg-surface-card text-zinc-400 hover:text-white hover:bg-surface-elevated border border-border-default'
                  }`}
                >
                  {pos}
                </button>
              )
            })}
          </div>

          {/* Search, Season, Sort Controls & Maximize Button */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Search input */}
            <div className="relative flex items-center min-w-[200px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 absolute left-2.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm tên hoặc mã mùa..."
                className="w-full bg-surface-card border border-border-default py-1.5 pl-8 pr-7 text-xs text-white font-sans placeholder:text-zinc-500 focus:outline-none focus:border-neon transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Season Select Filter */}
            <div className="relative shrink-0 flex items-center">
              <select
                value={selectedSeasonId}
                onChange={(e) => setSelectedSeasonId(e.target.value)}
                className="bg-surface-card text-zinc-200 border border-border-default py-1.5 pl-7 pr-7 font-mono text-[11px] uppercase focus:outline-none focus:border-neon cursor-pointer appearance-none"
              >
                <option value="ALL">Tất cả mùa</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                  </option>
                ))}
              </select>
              <Layers className="w-3.5 h-3.5 absolute left-2 top-2 text-amber-400 pointer-events-none" />
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2 text-zinc-400 pointer-events-none" />
            </div>

            {/* Sort Select */}
            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-surface-card text-zinc-200 border border-border-default py-1.5 px-2.5 pr-7 font-mono text-[11px] uppercase focus:outline-none focus:border-neon cursor-pointer appearance-none"
              >
                <option value="salary-desc">Lương: Cao → Thấp</option>
                <option value="salary-asc">Lương: Thấp → Cao</option>
                <option value="ovr-desc">OVR: Cao → Thấp</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2.5 text-zinc-400 pointer-events-none" />
            </div>

            {/* Maximize / Popup Fullscreen Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-surface-card hover:bg-surface-elevated border border-neon/60 text-neon hover:text-white font-mono text-[11px] uppercase font-bold transition-all shadow-sm active:scale-95 group"
              title="Mở rộng danh sách toàn màn hình (Popup)"
            >
              <Maximize2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Toàn Cảnh</span>
            </button>
          </div>
        </div>

        {/* Action Error Banner */}
        {pickError && (
          <div className="p-2 rounded bg-danger/10 border border-danger/40 text-danger text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pickError}</span>
          </div>
        )}

        {/* 2. Player Table (Expanded Height: max-h-[380px] lg:max-h-[440px]) */}
        <div className="w-full bg-surface-card border border-border-default overflow-hidden">
          {/* Table Column Header */}
          <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-app-void font-mono text-[10px] text-zinc-400 uppercase tracking-wider border-b border-border-subtle">
            <div className="col-span-5 md:col-span-4">CẦU THỦ</div>
            <div className="col-span-2 hidden md:block">MÙA GIẢI</div>
            <div className="col-span-2 text-center">VỊ TRÍ</div>
            <div className="col-span-2 text-center">OVR</div>
            <div className="col-span-3 md:col-span-2 text-center">LƯƠNG</div>
            <div className="col-span-2 md:col-span-2 text-right">THAO TÁC</div>
          </div>

          {/* Rows Container (Comfortable Scroll View) */}
          <div className="flex flex-col max-h-[380px] lg:max-h-[440px] overflow-y-auto divide-y divide-border-subtle/50">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-zinc-400 font-mono text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-neon" />
                <span>Đang quét danh sách cầu thủ...</span>
              </div>
            ) : sortedCards.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 font-mono text-xs">
                Không tìm thấy cầu thủ phù hợp trong danh sách.
              </div>
            ) : (
              sortedCards.map((card) => {
                const draftedByTeam = draftedCardIds.get(card.id)
                const isPlayerAlreadyDrafted = draftedPlayerIds.has(card.player.id)
                const isDrafted = !!draftedByTeam || isPlayerAlreadyDrafted
                const isOverBudget = card.salary > remainingBudget
                const posStyle = getPositionStyle(card.position)

                const canPick =
                  draftStatus === 'PICKING' &&
                  isMyTurn &&
                  !isDrafted &&
                  !isOverBudget &&
                  !isPickingLoading

                return (
                  <div
                    key={card.id}
                    className={`grid grid-cols-12 gap-2 px-3 py-2 items-center transition-colors ${
                      isDrafted
                        ? 'opacity-40 bg-app-void/40'
                        : 'hover:bg-surface-elevated/60'
                    }`}
                  >
                    {/* Player Name & Identity */}
                    <div className="col-span-5 md:col-span-4 flex items-center gap-2 min-w-0">
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.player.name}
                          className="w-7 h-7 object-contain shrink-0 filter drop-shadow"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-7 h-7 rounded bg-surface-panel flex items-center justify-center font-display font-bold text-xs text-zinc-300 shrink-0 border border-border-default">
                          {card.player.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div
                          className={`font-semibold text-xs leading-tight truncate ${
                            isDrafted ? 'line-through text-zinc-500' : 'text-white'
                          }`}
                        >
                          {card.player.name}
                        </div>
                        <div className="font-mono text-[9px] text-zinc-400 truncate">
                          ID: {card.player.externalPlayerId}
                        </div>
                      </div>
                    </div>

                    {/* Series Card */}
                    <div className="col-span-2 hidden md:flex items-center gap-1.5">
                      {card.season.badgeUrl && (
                        <img
                          src={card.season.badgeUrl}
                          alt={card.season.code}
                          className="w-4 h-4 object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none'
                          }}
                        />
                      )}
                      <span className="bg-surface-elevated text-zinc-300 font-mono text-[10px] px-2 py-0.5 border border-border-default font-bold">
                        {card.season.code}
                      </span>
                    </div>

                    {/* Position */}
                    <div className="col-span-2 text-center">
                      <span
                        className={`px-1.5 py-0.5 font-mono text-[10px] font-black border ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
                      >
                        {card.position}
                      </span>
                    </div>

                    {/* OVR */}
                    <div className="col-span-2 text-center font-display text-xs font-bold text-zinc-200">
                      {card.rating || '--'}
                    </div>

                    {/* Salary */}
                    <div
                      className={`col-span-3 md:col-span-2 text-center font-mono text-xs font-bold ${
                        isOverBudget ? 'text-danger' : 'text-neon'
                      }`}
                    >
                      {card.salary}.0M
                    </div>

                    {/* Pick Action Button & Preview */}
                    <div className="col-span-2 md:col-span-2 flex items-center justify-end gap-1.5">
                      {onPreviewCard && (
                        <button
                          onClick={() => onPreviewCard(card)}
                          title="Xem hiệu ứng Walkout / Reveal của thẻ này"
                          className="p-1 rounded bg-surface-card hover:bg-surface-elevated text-zinc-400 hover:text-white border border-border-default transition-all group"
                        >
                          <Sparkles className="w-3.5 h-3.5 group-hover:text-amber-400 transition-colors" />
                        </button>
                      )}
                      {isDrafted ? (
                        <span className="font-mono text-[10px] text-zinc-500 uppercase px-2 py-1">
                          ĐÃ PICK
                        </span>
                      ) : isOverBudget ? (
                        <span className="font-mono text-[10px] text-danger uppercase px-2 py-1">
                          VƯỢT LƯƠNG
                        </span>
                      ) : (
                        <button
                          onClick={() => onMakePick(card.id, card)}
                          disabled={!canPick}
                          className={`px-3 py-1 font-display text-[11px] font-bold uppercase tracking-wider transition-all ${
                            canPick
                              ? 'bg-neon text-black hover:bg-white active:scale-95 shadow-glow-neon'
                              : 'bg-surface-elevated text-zinc-600 border border-border-default cursor-not-allowed'
                          }`}
                        >
                          {isPickingLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                          ) : isMyTurn ? (
                            'PICK'
                          ) : (
                            'CHỜ'
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* 3. Panoramic Fullscreen Modal Popup */}
      <PlayerPoolModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        cards={sortedCards}
        isLoading={isLoading}
        seasons={seasons}
        selectedPosition={selectedPosition}
        onSelectPosition={setSelectedPosition}
        selectedSeasonId={selectedSeasonId}
        onSelectSeasonId={setSelectedSeasonId}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={setSortBy}
        currentTeam={currentTeam}
        draftStatus={draftStatus}
        picks={picks}
        isMyTurn={isMyTurn}
        onMakePick={onMakePick}
        onPreviewCard={onPreviewCard}
        isPickingLoading={isPickingLoading}
        pickError={pickError}
        currentRound={currentRound}
        currentTurn={currentTurn}
        secondsRemaining={secondsRemaining}
      />
    </>
  )
}
