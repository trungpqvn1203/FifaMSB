import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface MatchHeaderProps {
  tournamentId: string
  tournamentName?: string
  matchId: string
  simulatedMode?: 'live' | 'active' | 'locked' | 'revealed'
  onSimulateModeChange?: (mode: 'live' | 'active' | 'locked' | 'revealed') => void
}

export const MatchHeader: React.FC<MatchHeaderProps> = ({
  tournamentId,
  tournamentName = 'FC Pro Champions Cup 2026',
  matchId,
  simulatedMode = 'live',
  onSimulateModeChange,
}) => {
  return (
    <header className="w-full bg-[#111217] border-b border-[#242731] px-4 lg:px-8 py-2.5 select-none relative z-30">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between flex-wrap gap-2">
        {/* Tournament & Phase Branding */}
        <div className="flex items-center space-x-3">
          <Link
            to={`/tournaments/${tournamentId}`}
            title="Quay lại giải đấu"
            className="h-8 w-8 rounded bg-gradient-to-tr from-[#3DFF6B]/20 to-[#3DFF6B] p-[1px] flex items-center justify-center hover:opacity-80 transition"
          >
            <div className="h-full w-full bg-[#111217] rounded flex items-center justify-center text-[#3DFF6B]">
              <ArrowLeft className="w-4 h-4" />
            </div>
          </Link>
          <div>
            <span className="text-xs uppercase tracking-widest text-zinc-400 font-bold block leading-none">
              {tournamentName}
            </span>
            <h1 className="text-sm lg:text-base font-bold text-white tracking-wide flex items-center gap-2">
              GIAI ĐOẠN CẤM CHỌN CHIẾN THUẬT (BAN)
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#3DFF6B] animate-ping" />
            </h1>
          </div>
        </div>

        {/* Center Match Qualifier Info */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          <span className="px-2.5 py-1 rounded bg-[#1c1f28] border border-[#2e323f] text-zinc-300 font-mono">
            ID: {matchId.substring(0, 8)}
          </span>
          <span className="px-2.5 py-1 rounded bg-[#3DFF6B]/10 border border-[#3DFF6B]/40 text-[#3DFF6B] font-semibold">
            ARENA CHIẾN THUẬT · GIAI ĐOẠN 10
          </span>
          <span className="text-zinc-400">
            MÁY CHỦ: <span className="text-zinc-200 font-mono">VN-HAN-01 (9ms)</span>
          </span>
        </div>

        {/* State Simulator Toggle (Interactive view switcher from docs/ui/match-bans.html) */}
        {onSimulateModeChange && (
          <div
            className="flex items-center gap-1.5 bg-[#171920] p-1 rounded-lg border border-[#272a36] text-xs"
            data-purpose="state-simulator"
          >
            <span className="text-[10px] uppercase font-bold text-zinc-500 px-1.5 hidden xl:inline">
              Mode:
            </span>
            <button
              type="button"
              onClick={() => onSimulateModeChange('live')}
              className={`px-2.5 py-1 rounded font-medium transition-all text-[11px] font-mono ${
                simulatedMode === 'live'
                  ? 'bg-emerald-500 text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              ● LIVE WS
            </button>
            <button
              type="button"
              onClick={() => onSimulateModeChange('active')}
              className={`px-2.5 py-1 rounded font-medium transition-all text-[11px] font-mono ${
                simulatedMode === 'active'
                  ? 'bg-[#3DFF6B] text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              1. ACTIVE
            </button>
            <button
              type="button"
              onClick={() => onSimulateModeChange('locked')}
              className={`px-2.5 py-1 rounded font-medium transition-all text-[11px] font-mono ${
                simulatedMode === 'locked'
                  ? 'bg-amber-400 text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              2. LOCKED
            </button>
            <button
              type="button"
              onClick={() => onSimulateModeChange('revealed')}
              className={`px-2.5 py-1 rounded font-medium transition-all text-[11px] font-mono ${
                simulatedMode === 'revealed'
                  ? 'bg-red-500 text-white font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              3. REVEALED
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
