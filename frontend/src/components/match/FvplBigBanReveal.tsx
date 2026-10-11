import React, { useEffect, useState, useRef } from 'react'
import { X } from 'lucide-react'
import { playRevealSound } from '@/lib/reveal-sound'
import { getPositionStyle } from '@/lib/draft-utils'
import { FvplPlayerCard } from './FvplPlayerCard'

export interface BannedPlayerDetail {
  playerName: string
  position?: string
  rating?: number | null
  salary?: number
  imageUrl?: string | null
  seasonCode?: string
  seasonBadgeUrl?: string | null
  banningTeamName?: string
  targetTeamName?: string
  externalPlayerId?: string | null
}

interface FvplBigBanRevealProps {
  data: BannedPlayerDetail | null
  onDismiss: () => void
  durationMs?: number // default 3800ms
}

export const FvplBigBanReveal: React.FC<FvplBigBanRevealProps> = ({
  data,
  onDismiss,
  durationMs = 3800,
}) => {
  const [progressWidth, setProgressWidth] = useState(100)
  const timerRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  useEffect(() => {
    if (!data) return

    // Sound effect: Dramatic stadium boom fanfare
    playRevealSound(0.7)

    startTimeRef.current = Date.now()
    setProgressWidth(100)

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const remainingPct = Math.max(0, 100 - (elapsed / durationMs) * 100)
      setProgressWidth(remainingPct)
      if (remainingPct <= 0) {
        window.clearInterval(interval)
        onDismiss()
      }
    }, 40)

    timerRef.current = interval

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        onDismiss()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [data, durationMs, onDismiss])

  if (!data) return null

  const pos = data.position || 'ST'
  const posStyle = getPositionStyle(pos)
  const rating = data.rating || 100
  const salary = data.salary || 25
  const teamName = data.banningTeamName || 'ĐỘI CẤM'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onDismiss}
      data-purpose="big-ban-reveal-modal"
    >
      <div
        className="relative bg-[#0b0e14]/95 border-2 border-[#00FF87] rounded-2xl shadow-[0_0_60px_rgba(0,255,135,0.45)] max-w-xl w-full p-6 md:p-8 flex flex-col items-center overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10 transition z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 1. Header: Team Pill + Big BAN Title */}
        <div className="flex flex-col items-center gap-1.5 mb-5 w-full">
          <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-zinc-900 border border-white/10 text-white text-xs font-black uppercase tracking-wider">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span>{teamName}</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-black tracking-widest text-white drop-shadow-[0_0_20px_rgba(239,68,68,0.9)] uppercase">
            BAN
          </h2>
        </div>

        {/* 2. Center: Large Card Showcase + Detail Specs */}
        <div className="flex items-center justify-center gap-6 md:gap-10 w-full my-2">
          {/* Large FC Online Player Card */}
          <div className="shrink-0 drop-shadow-[0_0_25px_rgba(239,68,68,0.3)]">
            <FvplPlayerCard
              player={{
                playerSeasonId: 'reveal',
                name: data.playerName,
                position: pos,
                rating: rating,
                salary: salary,
                imageUrl: data.imageUrl,
                externalPlayerId: data.externalPlayerId,
                seasonCode: data.seasonCode,
                seasonBadgeUrl: data.seasonBadgeUrl,
              }}
              isBanned={true}
              size="large"
            />
          </div>

          {/* Player Stats Specification Box */}
          <div className="flex flex-col gap-3 text-left w-full max-w-[200px]">
            <div>
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
                CẦU THỦ BỊ CẤM
              </div>
              <div className="text-xl md:text-2xl font-black text-white uppercase tracking-wide truncate">
                {data.playerName}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-amber-300 font-mono font-bold mt-0.5">
                <span>★5</span>
                <span>·</span>
                <span>{data.seasonCode || 'ICON'}</span>
              </div>
            </div>

            {/* Spec rows */}
            <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-sans font-bold text-[11px] uppercase">
                  POSITION
                </span>
                <span
                  className={`font-black px-2 py-0.5 rounded-[3px] uppercase ${posStyle.bg} ${posStyle.text} border ${posStyle.border}`}
                >
                  {pos}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-sans font-bold text-[11px] uppercase">
                  OVR
                </span>
                <span className="font-black text-base text-white">
                  {rating}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-sans font-bold text-[11px] uppercase">
                  SALARY
                </span>
                <span className="font-black text-base text-amber-300">
                  {salary}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Bottom Auto-Dismiss Progress Bar */}
        <div className="w-full bg-zinc-800 h-1 rounded-full mt-6 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-[#00FF87] transition-all duration-75 ease-linear"
            style={{ width: `${progressWidth}%` }}
          />
        </div>
      </div>
    </div>
  )
}
export default FvplBigBanReveal
