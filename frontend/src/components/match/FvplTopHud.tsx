import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, FastForward, Play, Award, RotateCcw } from 'lucide-react'
import type { MatchTeamSummary } from '@/types/domain'

interface FvplTopHudProps {
  tournamentId: string
  homeTeam: MatchTeamSummary
  awayTeam: MatchTeamSummary
  currentBanningTeamId?: string | null
  secondsRemaining: number
  status: string
  isAdmin?: boolean
  onSkipTurn?: () => void
  isSkipPending?: boolean
  onStartBanPhase?: () => void
  isStartPending?: boolean
  onResetBanPhase?: () => void
  isResetPending?: boolean
  onOpenScoreModal?: () => void
}

export const FvplTopHud: React.FC<FvplTopHudProps> = ({
  tournamentId,
  homeTeam,
  awayTeam,
  currentBanningTeamId,
  secondsRemaining,
  status,
  isAdmin = false,
  onSkipTurn,
  isSkipPending = false,
  onStartBanPhase,
  isStartPending = false,
  onResetBanPhase,
  isResetPending = false,
  onOpenScoreModal,
}) => {
  const isHomeTurn = status === 'BAN_PHASE' && currentBanningTeamId === homeTeam.id
  const isAwayTurn = status === 'BAN_PHASE' && currentBanningTeamId === awayTeam.id

  const formatTimer = (secs: number) => {
    const s = Math.max(0, secs)
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  return (
    <header className="w-full bg-[#080a0e] border-b border-emerald-500/20 px-3 md:px-8 py-2.5 select-none relative z-30">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-2 md:gap-6">
        {/* Left: Tournament back button + FC Tournament Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to={tournamentId ? `/tournaments/${tournamentId}` : '/tournaments'}
            title="Quay lại giải đấu"
            className="h-8 w-8 rounded bg-gradient-to-tr from-emerald-500/20 to-emerald-400 p-[1px] flex items-center justify-center hover:opacity-80 transition"
          >
            <div className="h-full w-full bg-[#0d1017] rounded flex items-center justify-center text-emerald-400">
              <ArrowLeft className="w-4 h-4" />
            </div>
          </Link>

          {/* FC Online Triangle Emblem */}
          <div className="flex items-center gap-1.5 pl-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-[#00b462] flex items-center justify-center font-black italic text-black text-sm shadow-[0_0_15px_rgba(0,255,135,0.4)]">
              FC
            </div>
            <div className="hidden xl:flex flex-col text-[10px] leading-tight text-zinc-400">
              <span className="font-bold text-white tracking-widest">VIETNAM</span>
              <span className="text-emerald-400 font-extrabold">PRO LEAGUE</span>
            </div>
          </div>
        </div>

        {/* Center Main Stage HUD: Home Pill - Timer & Arrows - Away Pill */}
        <div className="flex-1 flex items-center justify-center gap-2 sm:gap-4 md:gap-8 max-w-4xl mx-auto">
          {/* HOME TEAM PILL (e.g. TA GLOBAL) */}
          <div
            className={`flex items-center gap-2 px-3 sm:px-5 py-1.5 sm:py-2 rounded-full transition-all duration-300 font-black tracking-wide text-xs sm:text-sm uppercase ${
              isHomeTurn
                ? 'bg-[#00DF81] text-black shadow-[0_0_30px_rgba(0,223,129,0.7)] ring-2 ring-white/50 scale-105'
                : 'bg-[#12161f] text-zinc-200 border border-white/10 opacity-80'
            }`}
          >
            <div
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                isHomeTurn
                  ? 'bg-black text-[#00DF81]'
                  : 'bg-zinc-800 text-zinc-300 border border-white/10'
              }`}
            >
              {homeTeam.name.substring(0, 2).toUpperCase()}
            </div>
            <span className="truncate max-w-[90px] sm:max-w-[140px] md:max-w-[180px]">
              {homeTeam.name}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                isHomeTurn ? 'bg-black/20 text-black' : 'bg-white/5 text-zinc-400'
              }`}
            >
              {homeTeam.banCount} BANS
            </span>
          </div>

          {/* CENTER DIGITAL TIMER & TURN ARROWS */}
          <div className="flex flex-col items-center justify-center px-1 shrink-0">
            {/* Digital Clock Display */}
            <div className="font-mono text-2xl sm:text-3xl md:text-4xl font-black tracking-wider text-[#00FFC2] drop-shadow-[0_0_15px_rgba(0,255,194,0.85)] leading-none">
              {status === 'BAN_PHASE'
                ? formatTimer(secondsRemaining)
                : status === 'SCHEDULED'
                ? '03:00'
                : status === 'BANS_LOCKED'
                ? 'LOCKED'
                : status === 'COMPLETED'
                ? `${homeTeam.score ?? 0} - ${awayTeam.score ?? 0}`
                : '00:00'}
            </div>

            {/* Turn Arrows Indicator (< >) */}
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-base font-black transition-all ${
                  isHomeTurn
                    ? 'text-[#00FF87] drop-shadow-[0_0_8px_#00FF87] scale-125'
                    : 'text-zinc-700'
                }`}
              >
                ◀
              </span>
              <span className="text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                LƯỢT CẤM
              </span>
              <span
                className={`text-base font-black transition-all ${
                  isAwayTurn
                    ? 'text-[#00FF87] drop-shadow-[0_0_8px_#00FF87] scale-125'
                    : 'text-zinc-700'
                }`}
              >
                ▶
              </span>
            </div>
          </div>

          {/* AWAY TEAM PILL (e.g. AMITA FC) */}
          <div
            className={`flex items-center gap-2 px-3 sm:px-5 py-1.5 sm:py-2 rounded-full transition-all duration-300 font-black tracking-wide text-xs sm:text-sm uppercase ${
              isAwayTurn
                ? 'bg-[#00DF81] text-black shadow-[0_0_30px_rgba(0,223,129,0.7)] ring-2 ring-white/50 scale-105'
                : 'bg-[#12161f] text-zinc-200 border border-white/10 opacity-80'
            }`}
          >
            <div
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                isAwayTurn
                  ? 'bg-black text-[#00DF81]'
                  : 'bg-zinc-800 text-zinc-300 border border-white/10'
              }`}
            >
              {awayTeam.name.substring(0, 2).toUpperCase()}
            </div>
            <span className="truncate max-w-[90px] sm:max-w-[140px] md:max-w-[180px]">
              {awayTeam.name}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                isAwayTurn ? 'bg-black/20 text-black' : 'bg-white/5 text-zinc-400'
              }`}
            >
              {awayTeam.banCount} BANS
            </span>
          </div>
        </div>

        {/* Right: Admin Quick Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && status === 'SCHEDULED' && onStartBanPhase && (
            <button
              type="button"
              disabled={isStartPending}
              onClick={onStartBanPhase}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs uppercase tracking-wide transition shadow-md"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Bắt Đầu Ban</span>
            </button>
          )}

          {isAdmin && status === 'BAN_PHASE' && onSkipTurn && (
            <button
              type="button"
              disabled={isSkipPending}
              onClick={onSkipTurn}
              title="Bỏ qua lượt cấm hiện tại và chuyển sang đội kế tiếp"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs uppercase tracking-wide transition"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bỏ Qua Lượt (Skip)</span>
            </button>
          )}

          {isAdmin && (status === 'BANS_LOCKED' || status === 'COMPLETED') && onOpenScoreModal && (
            <button
              type="button"
              onClick={onOpenScoreModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold text-xs uppercase tracking-wide transition"
            >
              <Award className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nhập Tỉ Số</span>
            </button>
          )}

          {isAdmin && onResetBanPhase && (
            <button
              type="button"
              disabled={isResetPending}
              onClick={onResetBanPhase}
              title="Khởi động lại giai đoạn cấm (xóa các lượt cấm cũ để cấm lại)"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-bold text-xs uppercase tracking-wide transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset Ban</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
export default FvplTopHud
