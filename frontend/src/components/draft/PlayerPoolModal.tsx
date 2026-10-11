import React, { useState, useMemo } from 'react'
import {
  Search,
  X,
  Check,
  Sparkles,
  Loader2,
  Grid,
  List,
  Coins,
  Clock,
  Layers,
  ChevronDown,
  AlertCircle,
  Trophy,
} from 'lucide-react'
import type {
  PlayerSeason,
  DraftPickBoardItem,
  TeamDraftStatus,
  SeasonOption,
} from '@/types/domain'
import { POSITION_FILTERS, getPositionStyle, formatTurnTimer } from '@/lib/draft-utils'

interface PlayerPoolModalProps {
  isOpen: boolean
  onClose: () => void
  cards: PlayerSeason[]
  isLoading: boolean
  seasons: SeasonOption[]
  selectedPosition: string
  onSelectPosition: (pos: string) => void
  selectedSeasonId: string
  onSelectSeasonId: (seasonId: string) => void
  searchTerm: string
  onSearchChange: (search: string) => void
  sortBy: 'salary-desc' | 'salary-asc' | 'ovr-desc'
  onSortChange: (sort: 'salary-desc' | 'salary-asc' | 'ovr-desc') => void
  currentTeam?: TeamDraftStatus
  draftStatus: string
  picks: DraftPickBoardItem[]
  isMyTurn: boolean
  onMakePick: (playerSeasonIds: string[] | string, card?: PlayerSeason[] | PlayerSeason) => void
  onPreviewCard?: (card: PlayerSeason) => void
  isPickingLoading: boolean
  pickError?: string | null
  currentRound?: number
  currentTurn?: number
  secondsRemaining?: number
  selectedBatch?: PlayerSeason[]
  onToggleBatchCard?: (card: PlayerSeason) => void
  onConfirmBatch?: () => void
  onClearBatch?: () => void
  requiredPicks?: number
  roundCategory?: { label: string; count?: number; isMain?: boolean; isMainSquad?: boolean }
  isSubstituteRound?: boolean
}

export const PlayerPoolModal: React.FC<PlayerPoolModalProps> = ({
  isOpen,
  onClose,
  cards,
  isLoading,
  seasons,
  selectedPosition,
  onSelectPosition,
  selectedSeasonId,
  onSelectSeasonId,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
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
  selectedBatch = [],
  onToggleBatchCard,
  onConfirmBatch,
  onClearBatch,
  requiredPicks = 1,
  roundCategory,
  isSubstituteRound = false,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')

  // Set of already drafted card IDs and player IDs
  const draftedCardIds = useMemo(() => {
    const map = new Map<string, string>()
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

  // Filter and sort loaded cards
  const sortedCards = useMemo(() => {
    let result = [...cards]

    // Client-side season filter in case not yet filtered by query
    if (selectedSeasonId !== 'ALL') {
      result = result.filter((c) => c.season.id === selectedSeasonId)
    }

    // Client-side search enhancement (matches player name, ID, or season code)
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase()
      result = result.filter(
        (c) =>
          c.player.name.toLowerCase().includes(q) ||
          c.season.code.toLowerCase().includes(q) ||
          (c.player.externalPlayerId && c.player.externalPlayerId.includes(q))
      )
    }

    result.sort((a, b) => {
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

    return result
  }, [cards, selectedSeasonId, searchTerm, sortBy])

  const remainingBudget = currentTeam?.budgetRemaining ?? 305
  const currentBatchSalary = selectedBatch.reduce((sum, c) => sum + c.salary, 0)

  if (!isOpen) return null

  const handlePickAndClose = (card: PlayerSeason) => {
    onMakePick(card.id, card)
    onClose()
  }

  const handleConfirmBatchAndClose = () => {
    onConfirmBatch?.()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1440px] h-[92vh] bg-surface-panel border border-border-default/90 rounded-xl shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Modal Top HUD Header */}
        <header className="px-4 py-3 bg-surface-card border-b border-border-default flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Left Title & Round indicator */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded bg-neon/10 border border-neon/30 text-neon">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-sm sm:text-base md:text-lg uppercase tracking-wide text-white truncate">
                  TOÀN CẢNH BỂ CẦU THỦ THI ĐẤU
                </h2>
                <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border-default font-mono text-[10px] text-zinc-400 uppercase">
                  {sortedCards.length} CẦU THỦ
                </span>
                {(currentRound !== undefined || currentTurn !== undefined) && (
                  <span className="px-2 py-0.5 rounded bg-surface-elevated border border-border-default font-mono text-[10px] text-neon uppercase font-bold">
                    VÒNG {currentRound || 1} · LƯỢT {currentTurn || 1}
                  </span>
                )}
              </div>
              <p className="font-mono text-[11px] text-zinc-400 truncate">
                Xem toàn cảnh, lọc theo mùa giải và chọn cầu thủ trực tiếp vào đội hình
              </p>
            </div>
          </div>

          {/* Center Info: Budget & Live Turn Timer */}
          <div className="flex items-center gap-3">
            {/* Live Clock HUD */}
            {secondsRemaining !== undefined && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-elevated border border-border-default">
                <Clock className="w-4 h-4 text-warning animate-pulse" />
                <div className="flex flex-col leading-none">
                  <span className="font-mono text-[9px] text-zinc-400 uppercase">THỜI GIAN LƯỢT</span>
                  <span className="font-mono text-sm font-bold text-white">
                    {formatTurnTimer(secondsRemaining)}
                  </span>
                </div>
              </div>
            )}

            {/* Budget Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface-elevated border border-border-default">
              <Coins className="w-4 h-4 text-neon" />
              <div className="flex flex-col leading-none">
                <span className="font-mono text-[9px] text-zinc-400 uppercase">QUỸ LƯƠNG CÒN</span>
                <span className="font-mono text-sm font-bold text-neon">
                  {remainingBudget}.0M
                </span>
              </div>
            </div>

            {/* Turn Status Pill */}
            <div
              className={`px-3 py-1.5 rounded font-mono text-xs font-bold uppercase border flex items-center gap-1.5 ${
                isMyTurn
                  ? 'bg-neon/15 border-neon text-neon text-shadow-neon'
                  : 'bg-surface-elevated border-border-default text-zinc-400'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isMyTurn ? 'bg-neon animate-ping' : 'bg-zinc-500'
                }`}
              />
              <span>{isMyTurn ? 'LƯỢT CỦA BẠN' : 'ĐANG CHỜ LƯỢT'}</span>
            </div>
          </div>

          {/* Right Action: View Toggle & Close */}
          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex items-center p-0.5 rounded bg-surface-elevated border border-border-default">
              <button
                onClick={() => setViewMode('table')}
                title="Dạng bảng chi tiết"
                className={`p-1.5 rounded font-mono text-xs flex items-center gap-1 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-surface-panel text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
                <span className="hidden md:inline">Bảng</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="Dạng lưới thẻ bài"
                className={`p-1.5 rounded font-mono text-xs flex items-center gap-1 transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-surface-panel text-white shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span className="hidden md:inline">Thẻ</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              title="Đóng (ESC)"
              className="p-1.5 rounded bg-surface-elevated hover:bg-surface-card border border-border-default text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 2. Filters & Search Control Bar */}
        <div className="p-3 bg-surface-card/60 border-b border-border-default flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
          {/* Position Chips */}
          <div className="flex items-center flex-wrap gap-1">
            {POSITION_FILTERS.map((pos) => {
              const isSelected = selectedPosition === pos
              return (
                <button
                  key={pos}
                  onClick={() => onSelectPosition(pos)}
                  className={`px-2.5 py-1 font-mono text-[11px] uppercase font-bold transition-all rounded-sm ${
                    isSelected
                      ? 'bg-neon text-black shadow-glow-neon scale-105'
                      : 'bg-surface-card text-zinc-400 hover:text-white hover:bg-surface-elevated border border-border-default'
                  }`}
                >
                  {pos}
                </button>
              )
            })}
          </div>

          {/* Search, Season, & Sort Controls */}
          <div className="flex items-center flex-wrap gap-2">
            {/* Search Input */}
            <div className="relative flex items-center min-w-[240px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 absolute left-2.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Tìm tên hoặc mã mùa (Son, 23UCL, ICON)..."
                className="w-full bg-surface-card border border-border-default py-1.5 pl-8 pr-7 text-xs text-white font-sans placeholder:text-zinc-500 focus:outline-none focus:border-neon transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Season Filter Dropdown */}
            <div className="relative shrink-0 flex items-center">
              <div className="relative">
                <select
                  value={selectedSeasonId}
                  onChange={(e) => onSelectSeasonId(e.target.value)}
                  className="bg-surface-card text-zinc-200 border border-border-default py-1.5 pl-7 pr-7 font-mono text-[11px] uppercase focus:outline-none focus:border-neon cursor-pointer appearance-none"
                >
                  <option value="ALL">Tất cả mùa giải</option>
                  {seasons.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </option>
                  ))}
                </select>
                <Layers className="w-3.5 h-3.5 absolute left-2 top-2 text-amber-400 pointer-events-none" />
                <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2 text-zinc-400 pointer-events-none" />
              </div>
            </div>

            {/* Sort Dropdown */}
            <div className="relative shrink-0">
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value as any)}
                className="bg-surface-card text-zinc-200 border border-border-default py-1.5 px-2.5 pr-7 font-mono text-[11px] uppercase focus:outline-none focus:border-neon cursor-pointer appearance-none"
              >
                <option value="salary-desc">Lương: Cao đến Thấp</option>
                <option value="salary-asc">Lương: Thấp đến Cao</option>
                <option value="ovr-desc">OVR: Cao đến Thấp</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2 text-zinc-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Action Error Banner */}
        {pickError && (
          <div className="p-2.5 mx-4 mt-2 rounded bg-danger/10 border border-danger/40 text-danger text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pickError}</span>
          </div>
        )}

        {/* 3. Main Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-400 font-mono text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-neon" />
              <span>Đang tải danh sách thẻ cầu thủ...</span>
            </div>
          ) : sortedCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-500 font-mono text-xs gap-2">
              <span>Không tìm thấy cầu thủ phù hợp với bộ lọc hiện tại.</span>
              <button
                onClick={() => {
                  onSelectPosition('ALL')
                  onSelectSeasonId('ALL')
                  onSearchChange('')
                }}
                className="px-3 py-1 bg-surface-elevated border border-border-default text-zinc-300 hover:text-white text-xs mt-2"
              >
                Đặt lại tất cả bộ lọc
              </button>
            </div>
          ) : viewMode === 'table' ? (
            /* =================== VIEW MODE: DETAILED TABLE =================== */
            <div className="w-full bg-surface-card border border-border-default overflow-hidden rounded shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-app-void font-mono text-[10px] text-zinc-400 uppercase tracking-wider border-b border-border-subtle sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">CẦU THỦ</th>
                    <th className="py-2.5 px-3">MÙA GIẢI</th>
                    <th className="py-2.5 px-3 text-center">VỊ TRÍ</th>
                    <th className="py-2.5 px-3 text-center">OVR</th>
                    <th className="py-2.5 px-3 text-center">LƯƠNG</th>
                    <th className="py-2.5 px-3 text-center">TRẠNG THÁI</th>
                    <th className="py-2.5 px-3 text-right">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/50 text-xs">
                  {sortedCards.map((card) => {
                    const draftedByTeam = draftedCardIds.get(card.id)
                    const isPlayerAlreadyDrafted = draftedPlayerIds.has(card.player.id)
                    const isDrafted = Boolean(draftedByTeam || isPlayerAlreadyDrafted)

                    const isSelectedInBatch = selectedBatch.some((c) => c.id === card.id)
                    const isSamePlayerInBatch =
                      !isSelectedInBatch &&
                      selectedBatch.some((c) => c.player.id === card.player.id)
                    const effectiveRemaining = isSelectedInBatch
                      ? remainingBudget - (currentBatchSalary - card.salary)
                      : remainingBudget - currentBatchSalary

                    const isOverBudget = !isSubstituteRound && card.salary > effectiveRemaining
                    const posStyle = getPositionStyle(card.position)

                    const canPick =
                      draftStatus === 'PICKING' &&
                      isMyTurn &&
                      !isDrafted &&
                      !isOverBudget &&
                      !isPickingLoading &&
                      !isSamePlayerInBatch

                    return (
                      <tr
                        key={card.id}
                        className={`transition-colors ${
                          isDrafted
                            ? 'opacity-40 bg-app-void/40'
                            : isSelectedInBatch
                            ? 'bg-neon/10 border-l-2 border-neon'
                            : 'hover:bg-surface-elevated/70'
                        }`}
                      >
                        {/* Player Name & Photo */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-3">
                            {card.imageUrl ? (
                              <img
                                src={card.imageUrl}
                                alt={card.player.name}
                                className="w-9 h-9 object-contain shrink-0 filter drop-shadow"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none'
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded bg-surface-panel flex items-center justify-center font-display font-bold text-xs text-zinc-300 shrink-0 border border-border-default">
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
                              <div className="font-mono text-[10px] text-zinc-400">
                                ID: {card.player.externalPlayerId}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Season Badge & Code */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {card.season.badgeUrl && (
                              <img
                                src={card.season.badgeUrl}
                                alt={card.season.code}
                                className="w-5 h-5 object-contain shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none'
                                }}
                              />
                            )}
                            <span className="bg-surface-elevated text-zinc-200 font-mono text-[11px] px-2 py-0.5 border border-border-default font-bold">
                              {card.season.code}
                            </span>
                          </div>
                        </td>

                        {/* Position */}
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 font-mono text-[10px] font-black border rounded-sm ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
                          >
                            {card.position}
                          </span>
                        </td>

                        {/* OVR Rating */}
                        <td className="py-2.5 px-3 text-center font-display text-sm font-black text-zinc-100">
                          {card.rating || '--'}
                        </td>

                        {/* Salary */}
                        <td className="py-2.5 px-3 text-center font-mono text-xs font-bold">
                          <span
                            className={
                              isSubstituteRound
                                ? 'text-zinc-300'
                                : isOverBudget
                                ? 'text-danger'
                                : 'text-neon'
                            }
                          >
                            {card.salary}.0M
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center">
                          {isDrafted ? (
                            <span className="font-mono text-[10px] text-zinc-500 uppercase px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700">
                              ĐÃ PICK {draftedByTeam ? `(${draftedByTeam})` : ''}
                            </span>
                          ) : isOverBudget ? (
                            <span className="font-mono text-[10px] text-danger uppercase px-2 py-0.5 rounded bg-danger/10 border border-danger/30">
                              VƯỢT LƯƠNG
                            </span>
                          ) : isSamePlayerInBatch ? (
                            <span className="font-mono text-[10px] text-amber-400 uppercase px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                              TRÙNG CT
                            </span>
                          ) : isSelectedInBatch ? (
                            <span className="font-mono text-[10px] text-neon uppercase px-2 py-0.5 rounded bg-neon/10 border border-neon/30 font-bold">
                              ĐÃ CHỌN
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-zinc-400 uppercase px-2 py-0.5 rounded bg-surface-elevated border border-border-default">
                              SẴN SÀNG
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {onPreviewCard && (
                              <button
                                onClick={() => onPreviewCard(card)}
                                title="Xem hiệu ứng Walkout / Reveal thẻ này"
                                className="p-1.5 rounded bg-surface-card hover:bg-surface-elevated text-zinc-400 hover:text-white border border-border-default transition-all group"
                              >
                                <Sparkles className="w-3.5 h-3.5 group-hover:text-amber-400 transition-colors" />
                              </button>
                            )}

                            {isDrafted ? (
                              <span className="font-mono text-[10px] text-zinc-500 uppercase px-3 py-1">
                                KHÔNG KHẢ DỤNG
                              </span>
                            ) : isOverBudget ? (
                              <span className="font-mono text-[10px] text-danger uppercase px-3 py-1">
                                QUÁ QUỸ LƯƠNG
                              </span>
                            ) : isSamePlayerInBatch ? (
                              <span className="font-mono text-[10px] text-amber-400 uppercase px-3 py-1">
                                TRÙNG CẦU THỦ
                              </span>
                            ) : requiredPicks === 1 ? (
                              <button
                                onClick={() => handlePickAndClose(card)}
                                disabled={!canPick}
                                className={`px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-all rounded-sm ${
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
                                  'CHỜ LƯỢT'
                                )}
                              </button>
                            ) : isSelectedInBatch ? (
                              <button
                                onClick={() => onToggleBatchCard?.(card)}
                                className="px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider bg-neon text-black hover:bg-red-500 hover:text-white transition-all shadow-glow-neon flex items-center gap-1 rounded-sm active:scale-95"
                                title="Nhấn để bỏ chọn thẻ này"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>ĐÃ CHỌN</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => onToggleBatchCard?.(card)}
                                disabled={!canPick || selectedBatch.length >= requiredPicks}
                                className={`px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-all rounded-sm ${
                                  canPick && selectedBatch.length < requiredPicks
                                    ? 'bg-surface-elevated text-neon border border-neon/50 hover:bg-neon hover:text-black active:scale-95'
                                    : 'bg-surface-elevated text-zinc-600 border border-border-default cursor-not-allowed'
                                }`}
                              >
                                {selectedBatch.length >= requiredPicks
                                  ? `ĐỦ ${requiredPicks}`
                                  : '+ CHỌN'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* =================== VIEW MODE: CARD GRID =================== */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {sortedCards.map((card) => {
                const draftedByTeam = draftedCardIds.get(card.id)
                const isPlayerAlreadyDrafted = draftedPlayerIds.has(card.player.id)
                const isDrafted = Boolean(draftedByTeam || isPlayerAlreadyDrafted)

                const isSelectedInBatch = selectedBatch.some((c) => c.id === card.id)
                const isSamePlayerInBatch =
                  !isSelectedInBatch &&
                  selectedBatch.some((c) => c.player.id === card.player.id)
                const effectiveRemaining = isSelectedInBatch
                  ? remainingBudget - (currentBatchSalary - card.salary)
                  : remainingBudget - currentBatchSalary

                const isOverBudget = !isSubstituteRound && card.salary > effectiveRemaining
                const posStyle = getPositionStyle(card.position)

                const canPick =
                  draftStatus === 'PICKING' &&
                  isMyTurn &&
                  !isDrafted &&
                  !isOverBudget &&
                  !isPickingLoading &&
                  !isSamePlayerInBatch

                return (
                  <div
                    key={card.id}
                    className={`relative rounded-lg p-2.5 bg-surface-card border transition-all flex flex-col justify-between group overflow-hidden ${
                      isDrafted
                        ? 'opacity-40 border-border-subtle bg-app-void/60'
                        : isSelectedInBatch
                        ? 'border-neon bg-neon/10 shadow-glow-neon/30'
                        : isOverBudget
                        ? 'border-border-default hover:border-danger/40'
                        : 'border-border-default hover:border-neon hover:shadow-glow-neon/20 hover:-translate-y-1'
                    }`}
                  >
                    {/* Top Row: OVR, Position & Season */}
                    <div className="flex items-start justify-between z-10">
                      <div className="flex flex-col leading-none">
                        <span className="font-display font-black text-xl text-white">
                          {card.rating || '--'}
                        </span>
                        <span
                          className={`mt-0.5 px-1.5 py-0.2 font-mono text-[9px] font-black uppercase rounded ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
                        >
                          {card.position}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
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
                        <span className="font-mono text-[10px] text-amber-400 font-bold">
                          {card.season.code}
                        </span>
                      </div>
                    </div>

                    {/* Center: Player Image */}
                    <div className="w-full h-24 my-1 flex items-center justify-center relative overflow-hidden">
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt={card.player.name}
                          className="h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none'
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-surface-panel border border-border-default flex items-center justify-center font-display font-bold text-sm text-zinc-300">
                          {card.player.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Bottom: Player Name & Salary */}
                    <div className="z-10 flex flex-col gap-1">
                      <div
                        className="font-display font-bold text-xs text-white uppercase truncate text-center"
                        title={card.player.name}
                      >
                        {card.player.name}
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono px-1 py-0.5 rounded bg-surface-elevated/70">
                        <span className="text-zinc-400">LƯƠNG:</span>
                        <span
                          className={`font-bold ${
                            isSubstituteRound
                              ? 'text-zinc-300'
                              : isOverBudget
                              ? 'text-danger'
                              : 'text-neon'
                          }`}
                        >
                          {card.salary}.0M
                        </span>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-1 mt-1">
                        {onPreviewCard && (
                          <button
                            onClick={() => onPreviewCard(card)}
                            title="Xem hiệu ứng"
                            className="p-1 rounded bg-surface-elevated hover:bg-surface-panel text-zinc-400 hover:text-white border border-border-default transition-colors shrink-0"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isDrafted ? (
                          <span className="w-full text-center py-1 font-mono text-[9px] text-zinc-500 uppercase bg-zinc-800/40 rounded">
                            ĐÃ CHỌN
                          </span>
                        ) : isOverBudget ? (
                          <span className="w-full text-center py-1 font-mono text-[9px] text-danger uppercase bg-danger/10 rounded">
                            VƯỢT LƯƠNG
                          </span>
                        ) : isSamePlayerInBatch ? (
                          <span className="w-full text-center py-1 font-mono text-[9px] text-amber-400 uppercase bg-amber-400/10 rounded">
                            TRÙNG CT
                          </span>
                        ) : requiredPicks === 1 ? (
                          <button
                            onClick={() => handlePickAndClose(card)}
                            disabled={!canPick}
                            className={`w-full py-1 font-display text-[11px] font-bold uppercase tracking-wider rounded transition-all ${
                              canPick
                                ? 'bg-neon text-black hover:bg-white active:scale-95 shadow-glow-neon'
                                : 'bg-surface-elevated text-zinc-600 border border-border-default cursor-not-allowed'
                            }`}
                          >
                            {isPickingLoading ? (
                              <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                            ) : isMyTurn ? (
                              'PICK'
                            ) : (
                              'CHỜ'
                            )}
                          </button>
                        ) : isSelectedInBatch ? (
                          <button
                            onClick={() => onToggleBatchCard?.(card)}
                            className="w-full py-1 font-display text-[11px] font-bold uppercase tracking-wider bg-neon text-black hover:bg-red-500 hover:text-white transition-all shadow-glow-neon flex items-center justify-center gap-1 rounded active:scale-95"
                            title="Nhấn để bỏ chọn thẻ này"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>ĐÃ CHỌN</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => onToggleBatchCard?.(card)}
                            disabled={!canPick || selectedBatch.length >= requiredPicks}
                            className={`w-full py-1 font-display text-[11px] font-bold uppercase tracking-wider transition-all rounded ${
                              canPick && selectedBatch.length < requiredPicks
                                ? 'bg-surface-elevated text-neon border border-neon/50 hover:bg-neon hover:text-black active:scale-95'
                                : 'bg-surface-elevated text-zinc-600 border border-border-default cursor-not-allowed'
                            }`}
                          >
                            {selectedBatch.length >= requiredPicks
                              ? `ĐỦ ${requiredPicks}`
                              : '+ CHỌN'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sticky Batch Selection Modal Footer */}
        {requiredPicks > 1 && (
          <footer className="px-4 py-2.5 bg-surface-card border-t border-neon/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neon/10 border border-neon/30 text-neon font-mono text-xs font-bold uppercase">
                <span>Vòng {currentRound} • {roundCategory?.label || 'Đá chính'}</span>
                <span className="text-zinc-500">|</span>
                <span>Cần chọn {requiredPicks} thẻ</span>
                <span className="text-white font-mono font-black ml-1">
                  ({selectedBatch.length}/{requiredPicks})
                </span>
              </div>

              {/* Selected chips */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedBatch.map((card) => (
                  <div
                    key={card.id}
                    className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded bg-surface-elevated border border-border-default text-xs font-semibold text-white shadow-sm"
                  >
                    <span>{card.player.name}</span>
                    <span className="text-[10px] font-mono text-neon font-bold">
                      {card.salary}M
                    </span>
                    <button
                      onClick={() => onToggleBatchCard?.(card)}
                      className="p-0.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white"
                      title="Bỏ chọn"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {Array.from({
                  length: Math.max(0, requiredPicks - selectedBatch.length),
                }).map((_, idx) => (
                  <div
                    key={idx}
                    className="px-2 py-0.5 rounded border border-dashed border-zinc-600 text-zinc-500 font-mono text-[11px]"
                  >
                    + Vị trí {selectedBatch.length + idx + 1}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {selectedBatch.length > 0 && onClearBatch && (
                <button
                  onClick={onClearBatch}
                  className="px-2.5 py-1 text-xs font-mono text-zinc-400 hover:text-white hover:bg-surface-elevated rounded transition-colors"
                >
                  Hủy chọn
                </button>
              )}
              <button
                onClick={handleConfirmBatchAndClose}
                disabled={
                  selectedBatch.length !== requiredPicks || !isMyTurn || isPickingLoading
                }
                className={`px-4 py-1.5 rounded-sm font-display text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                  selectedBatch.length === requiredPicks && isMyTurn && !isPickingLoading
                    ? 'bg-neon text-black hover:bg-white shadow-glow-neon active:scale-95 cursor-pointer'
                    : 'bg-surface-elevated text-zinc-500 border border-border-default cursor-not-allowed'
                }`}
              >
                {isPickingLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                )}
                <span>
                  XÁC NHẬN CHỌN ({selectedBatch.length}/{requiredPicks})
                </span>
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}
