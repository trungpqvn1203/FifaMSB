import React from 'react'
import { FvplPlayerCard, type FvplCardPlayer } from './FvplPlayerCard'
import { getPositionLine, type PositionLine } from '@/lib/draft-utils'
import type { RosterItem } from '@/types/domain'

interface FvplRosterBoardProps {
  teamName: string
  teamId: string
  roster: RosterItem[]
  bannedPlayerSeasonIds: Set<string>
  isCurrentTurn: boolean
  isTargetBoard: boolean
  canUserBan: boolean
  onBanPlayer: (playerSeasonId: string, player: FvplCardPlayer) => void
  onCannotBan?: (reason?: string) => void
  isActionPending?: boolean
}

export const FvplRosterBoard: React.FC<FvplRosterBoardProps> = ({
  teamName,
  teamId: _teamId,
  roster,
  bannedPlayerSeasonIds,
  isCurrentTurn,
  isTargetBoard,
  canUserBan,
  onBanPlayer,
  onCannotBan,
  isActionPending = false,
}) => {
  // Map RosterItems to FvplCardPlayer
  const cardPlayers: FvplCardPlayer[] = React.useMemo(() => {
    return roster.map((item) => ({
      playerSeasonId: item.player.playerSeasonId,
      playerId: item.player.playerId,
      name: item.player.name,
      position: item.player.position,
      rating: item.player.rating,
      salary: item.player.salary || item.salaryAtPick,
      imageUrl: item.player.imageUrl,
      seasonCode: item.player.season?.code,
      seasonBadgeUrl: item.player.season?.badgeUrl,
    }))
  }, [roster])

  // Count bans per tactical line (FW, MF, DF) on this board
  const lineBanCounts: Record<PositionLine, number> = React.useMemo(() => {
    const counts: Record<PositionLine, number> = { FW: 0, MF: 0, DF: 0 }
    for (const p of cardPlayers) {
      if (bannedPlayerSeasonIds.has(p.playerSeasonId)) {
        const line = getPositionLine(p.position)
        counts[line] = (counts[line] || 0) + 1
      }
    }
    return counts
  }, [cardPlayers, bannedPlayerSeasonIds])

  // Split into 4 rows matching FVPL 23-player layout:
  // Row 1: 6 cards (0..6)
  // Row 2: 6 cards (6..12)
  // Row 3: 6 cards (12..18)
  // Row 4: 5 cards (18..23)
  const row1 = cardPlayers.slice(0, 6)
  const row2 = cardPlayers.slice(6, 12)
  const row3 = cardPlayers.slice(12, 18)
  const row4 = cardPlayers.slice(18, 23)

  const bannedCount = cardPlayers.filter((p) =>
    bannedPlayerSeasonIds.has(p.playerSeasonId)
  ).length

  return (
    <div
      className={`relative w-full rounded-2xl p-2.5 sm:p-3.5 md:p-4 transition-all duration-300 backdrop-blur-md bg-black/60 ${
        isTargetBoard && canUserBan
          ? 'border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.35)] ring-2 ring-red-500/50 scale-[1.01]'
          : isCurrentTurn
          ? 'border-2 border-emerald-500/70 shadow-[0_0_30px_rgba(0,255,135,0.2)]'
          : 'border border-white/10 opacity-80'
      }`}
      data-purpose="fvpl-roster-board"
    >
      {/* Board Header Status Strip */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 mb-2.5 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-black uppercase tracking-wider text-white text-xs sm:text-sm md:text-base">
            {teamName}
          </span>
          {isTargetBoard && canUserBan ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.8)] border border-red-300 animate-pulse flex items-center gap-1">
              <span>🎯</span> MỤC TIÊU CẤM (BẤM VÀO ĐÂY)
            </span>
          ) : isCurrentTurn ? (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider bg-[#00FF87] text-black shadow-[0_0_15px_rgba(0,255,135,0.7)] flex items-center gap-1">
              <span>🛡️</span> ĐANG CHỌN CẤM (LƯỢT NÀY)
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-400 border border-white/5">
              CHỜ ĐỐI THỦ
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-zinc-400 font-mono text-[11px] shrink-0">
          <span>
            Bị cấm:{' '}
            <strong className="text-red-400 font-bold">{bannedCount}</strong>
          </span>
          <span className="text-zinc-600">|</span>
          <span>
            Tổng: <strong className="text-zinc-200">{cardPlayers.length}</strong>
          </span>
        </div>
      </div>

      {/* Tactical Line Ban Limits Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 py-1 px-2.5 rounded-lg bg-black/40 border border-white/5 mb-2 text-[10px] sm:text-xs">
        <div className="flex items-center gap-1 text-zinc-400 font-mono text-[10px] uppercase">
          <span>Giới hạn cấm/tuyến (Tối đa 2):</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 border transition-all ${
              lineBanCounts.FW >= 2
                ? 'bg-red-500/25 border-red-500/60 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                : lineBanCounts.FW === 1
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-zinc-800/80 border-white/5 text-zinc-400'
            }`}
            title="Tiền đạo: ST, CF, LW, RW"
          >
            <span>FW (Tiền đạo):</span>
            <span className={lineBanCounts.FW >= 2 ? 'text-red-400 font-black' : 'text-zinc-200'}>
              {lineBanCounts.FW}/2
            </span>
            {lineBanCounts.FW >= 2 && <span>🔒</span>}
          </div>

          <div
            className={`px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 border transition-all ${
              lineBanCounts.MF >= 2
                ? 'bg-red-500/25 border-red-500/60 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                : lineBanCounts.MF === 1
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-zinc-800/80 border-white/5 text-zinc-400'
            }`}
            title="Tiền vệ: CAM, CM, CDM, LM, RM"
          >
            <span>MF (Tiền vệ):</span>
            <span className={lineBanCounts.MF >= 2 ? 'text-red-400 font-black' : 'text-zinc-200'}>
              {lineBanCounts.MF}/2
            </span>
            {lineBanCounts.MF >= 2 && <span>🔒</span>}
          </div>

          <div
            className={`px-2 py-0.5 rounded font-mono font-bold flex items-center gap-1 border transition-all ${
              lineBanCounts.DF >= 2
                ? 'bg-red-500/25 border-red-500/60 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                : lineBanCounts.DF === 1
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                : 'bg-zinc-800/80 border-white/5 text-zinc-400'
            }`}
            title="Hậu vệ / GK: CB, LB, RB, LWB, RWB, GK"
          >
            <span>DF (Hậu vệ):</span>
            <span className={lineBanCounts.DF >= 2 ? 'text-red-400 font-black' : 'text-zinc-200'}>
              {lineBanCounts.DF}/2
            </span>
            {lineBanCounts.DF >= 2 && <span>🔒</span>}
          </div>
        </div>
      </div>

      {/* Helper instruction subtitle */}
      <div className="text-[11px] mb-2 px-1 font-sans">
        {isTargetBoard && canUserBan ? (
          <span className="text-red-300 font-medium flex items-center gap-1">
            👉 <strong>Đến lượt bạn:</strong> Bấm vào 1 thẻ cầu thủ bên dưới để CẤM đối thủ sử dụng! (Chỉ cấm 1 thẻ/lượt, tối đa 2 thẻ/tuyến)
          </span>
        ) : isCurrentTurn ? (
          <span className="text-emerald-400 font-medium">
            🛡️ Đội hình đội bạn được bảo vệ. Hãy nhìn sang bảng đối thủ để cấm cầu thủ của họ!
          </span>
        ) : (
          <span className="text-zinc-500 font-medium">
            ⏳ Đang chờ đối thủ hoàn thành lượt cấm của họ...
          </span>
        )}
      </div>

      {/* 23 Cards Grid Container (4 rows: 6-6-6-5) */}
      <div className="flex flex-col gap-1.5 md:gap-2 w-full">
        {/* ROW 1: 6 Cards */}
        <div className="grid grid-cols-6 gap-1 md:gap-2 w-full">
          {row1.map((player) => {
            const line = getPositionLine(player.position)
            const isLineMaxed = isTargetBoard && lineBanCounts[line] >= 2
            return (
              <FvplPlayerCard
                key={player.playerSeasonId}
                player={player}
                isBanned={bannedPlayerSeasonIds.has(player.playerSeasonId)}
                canBan={isTargetBoard && canUserBan}
                isLineMaxed={isLineMaxed}
                onBan={() => onBanPlayer(player.playerSeasonId, player)}
                onCannotBan={onCannotBan}
                isActionPending={isActionPending}
              />
            )
          })}
        </div>

        {/* ROW 2: 6 Cards */}
        <div className="grid grid-cols-6 gap-1 md:gap-2 w-full">
          {row2.map((player) => {
            const line = getPositionLine(player.position)
            const isLineMaxed = isTargetBoard && lineBanCounts[line] >= 2
            return (
              <FvplPlayerCard
                key={player.playerSeasonId}
                player={player}
                isBanned={bannedPlayerSeasonIds.has(player.playerSeasonId)}
                canBan={isTargetBoard && canUserBan}
                isLineMaxed={isLineMaxed}
                onBan={() => onBanPlayer(player.playerSeasonId, player)}
                onCannotBan={onCannotBan}
                isActionPending={isActionPending}
              />
            )
          })}
        </div>

        {/* ROW 3: 6 Cards */}
        <div className="grid grid-cols-6 gap-1 md:gap-2 w-full">
          {row3.map((player) => {
            const line = getPositionLine(player.position)
            const isLineMaxed = isTargetBoard && lineBanCounts[line] >= 2
            return (
              <FvplPlayerCard
                key={player.playerSeasonId}
                player={player}
                isBanned={bannedPlayerSeasonIds.has(player.playerSeasonId)}
                canBan={isTargetBoard && canUserBan}
                isLineMaxed={isLineMaxed}
                onBan={() => onBanPlayer(player.playerSeasonId, player)}
                onCannotBan={onCannotBan}
                isActionPending={isActionPending}
              />
            )
          })}
        </div>

        {/* ROW 4: 5 Cards (Centered) */}
        <div className="flex justify-center gap-1 md:gap-2 w-full">
          {row4.map((player) => {
            const line = getPositionLine(player.position)
            const isLineMaxed = isTargetBoard && lineBanCounts[line] >= 2
            return (
              <div
                key={player.playerSeasonId}
                className="w-[calc(100%/6-0.35rem)] max-w-[86px]"
              >
                <FvplPlayerCard
                  player={player}
                  isBanned={bannedPlayerSeasonIds.has(player.playerSeasonId)}
                  canBan={isTargetBoard && canUserBan}
                  isLineMaxed={isLineMaxed}
                  onBan={() => onBanPlayer(player.playerSeasonId, player)}
                  onCannotBan={onCannotBan}
                  isActionPending={isActionPending}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
export default FvplRosterBoard
