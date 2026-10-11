import React, { useState, useMemo } from 'react'
import { getPositionStyle, getPositionLine, LINE_NAME_VI } from '@/lib/draft-utils'

export interface FvplCardPlayer {
  playerSeasonId: string
  playerId?: string
  name: string
  position: string
  rating?: number | null
  salary: number
  imageUrl?: string | null
  externalPlayerId?: string | null
  seasonCode?: string
  seasonBadgeUrl?: string | null
}

interface FvplPlayerCardProps {
  player: FvplCardPlayer
  isBanned?: boolean
  canBan?: boolean
  isLineMaxed?: boolean
  onBan?: () => void
  onCannotBan?: (reason?: string) => void
  isActionPending?: boolean
  size?: 'normal' | 'large'
}

export const FvplPlayerCard: React.FC<FvplPlayerCardProps> = ({
  player,
  isBanned = false,
  canBan = false,
  isLineMaxed = false,
  onBan,
  onCannotBan,
  isActionPending = false,
  size = 'normal',
}) => {
  const [imageErrorLevel, setImageErrorLevel] = useState<number>(0)

  // Calculate fallback player image from CDN if direct URL fails
  const imageSrc = useMemo(() => {
    const spid = player.externalPlayerId?.trim()

    // Level 0: Direct provided imageUrl
    if (imageErrorLevel === 0 && player.imageUrl) {
      return player.imageUrl
    }
    // Level 1: Nexon Action Shot CDN
    if (imageErrorLevel <= 1 && spid && /^\d+$/.test(spid)) {
      return `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spid}.png`
    }
    // Level 2: Nexon Portrait CDN
    if (imageErrorLevel <= 2 && spid && /^\d+$/.test(spid)) {
      return `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/players/p${spid}.png`
    }
    return null
  }, [player, imageErrorLevel])

  const posStyle = getPositionStyle(player.position)
  const isLarge = size === 'large'

  return (
    <div
      onClick={() => {
        if (isActionPending) return
        if (isBanned) {
          onCannotBan?.(`Cầu thủ ${player.name} đã bị cấm thi đấu trước đó!`)
          return
        }
        if (!canBan) {
          onCannotBan?.(`Chưa tới lượt cấm của đội bạn hoặc không thể cấm cầu thủ này lúc này!`)
          return
        }
        if (isLineMaxed) {
          const line = getPositionLine(player.position)
          const lineName = LINE_NAME_VI[line] || line
          onCannotBan?.(`Đã cấm tối đa 2 cầu thủ tuyến ${lineName} (${player.position})! Hãy chọn cầu thủ thuộc tuyến khác.`)
          return
        }
        if (onBan) {
          onBan()
        }
      }}
      className={`relative group select-none transition-all duration-200 ${
        isLarge
          ? 'w-[180px] h-[260px] md:w-[210px] md:h-[300px]'
          : 'w-full aspect-[1/1.42] min-w-[54px] max-w-[86px]'
      } ${
        isBanned
          ? 'grayscale contrast-125 opacity-35 brightness-75 ring-1 ring-red-500/50 cursor-not-allowed'
          : canBan && isLineMaxed
          ? 'opacity-40 grayscale-[40%] ring-1 ring-amber-500/30 cursor-not-allowed'
          : canBan
          ? 'hover:scale-105 hover:z-20 cursor-pointer ring-1 ring-emerald-500/40 hover:ring-2 hover:ring-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.6)]'
          : 'ring-1 ring-white/10'
      } rounded-md overflow-hidden bg-gradient-to-b from-[#1c2333] via-[#0f141d] to-[#0a0d14] flex flex-col justify-between p-1 shadow-md`}
      data-purpose="fvpl-player-card"
    >
      {/* 1. TOP METRICS: OVR & Position Badge */}
      <div className="flex items-start justify-between w-full z-10 leading-none">
        <div className="flex flex-col items-start">
          <span
            className={`font-black font-mono tracking-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] ${
              isLarge ? 'text-2xl md:text-3xl' : 'text-xs md:text-sm'
            }`}
          >
            {player.rating || 100}
          </span>
          <span
            className={`font-black tracking-wider px-1 py-0.5 rounded-[2px] leading-none uppercase ${posStyle.bg} ${posStyle.text} border ${posStyle.border} ${
              isLarge ? 'text-xs md:text-sm mt-1' : 'text-[8px] md:text-[9px] mt-0.5'
            }`}
          >
            {player.position || 'ST'}
          </span>
        </div>

        {/* Season Code or Badge */}
        <div className="flex flex-col items-end">
          {player.seasonBadgeUrl ? (
            <img
              src={player.seasonBadgeUrl}
              alt={player.seasonCode || ''}
              className={`object-contain ${isLarge ? 'w-6 h-6' : 'w-3.5 h-3.5'}`}
            />
          ) : (
            <span
              className={`font-mono font-bold text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${
                isLarge ? 'text-xs' : 'text-[8px]'
              }`}
            >
              {player.seasonCode || 'ICON'}
            </span>
          )}
        </div>
      </div>

      {/* 2. PLAYER CUTOUT PORTRAIT / AVATAR */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden z-0">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={player.name}
            onError={() => setImageErrorLevel((prev) => prev + 1)}
            className={`object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] transition-transform duration-300 ${
              isLarge
                ? 'w-full h-[85%] scale-105'
                : 'w-[95%] h-[85%] scale-105 group-hover:scale-110'
            }`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600 font-mono font-black text-xs">
            {player.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </div>
        )}
      </div>

      {/* 3. BANNED INDICATOR: Authentic RED CARD 🟥 pinned at top-right */}
      {isBanned && (
        <div
          className="absolute top-1 right-1 z-30 flex items-center justify-center animate-in zoom-in-75 duration-200"
          title="Thẻ đã bị cấm thi đấu"
        >
          <div
            className={`bg-red-600 rounded-[2px] shadow-[0_0_12px_rgba(239,68,68,0.95)] border border-red-300 transform rotate-6 flex items-center justify-center ${
              isLarge ? 'w-6 h-9 md:w-8 md:h-11' : 'w-3.5 h-5 md:w-4 md:h-6'
            }`}
          >
            <div className="w-1 h-3 bg-red-400/50 rounded-[1px]" />
          </div>
        </div>
      )}

      {/* 4. HOVER TO BAN OVERLAY */}
      {canBan && !isBanned && (
        <div
          className={`absolute inset-0 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-200 z-30 rounded-md ${
            isLineMaxed ? 'bg-black/85' : 'bg-red-950/80'
          }`}
        >
          {isLineMaxed ? (
            <div className="flex flex-col items-center gap-0.5 px-1 text-center">
              <span className="text-[12px]">🔒</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black text-[8px] md:text-[9px] uppercase tracking-wider">
                ĐỦ 2/2 TUYẾN
              </span>
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded bg-red-600 text-white font-black text-[10px] md:text-xs uppercase tracking-wider shadow-lg transform group-hover:scale-105 transition">
              CẤM
            </span>
          )}
        </div>
      )}

      {/* 5. BOTTOM BAR: Name & Salary */}
      <div className="w-full z-10 bg-gradient-to-t from-black via-black/80 to-transparent pt-3 pb-0.5 px-0.5">
        <div className="truncate text-center font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] text-[9px] md:text-[10px] uppercase leading-tight">
          {player.name}
        </div>
        <div className="flex items-center justify-between text-[8px] font-mono text-zinc-400 px-0.5 mt-0.5 leading-none">
          <span className="text-zinc-500">★5</span>
          <span className="text-amber-300 font-bold">L:{player.salary}</span>
        </div>
      </div>
    </div>
  )
}
export default FvplPlayerCard
