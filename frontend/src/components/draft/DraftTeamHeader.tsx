import React from 'react'
import { Zap } from 'lucide-react'
import type { TeamDraftStatus } from '@/types/domain'
import { getTeamInitials } from '@/lib/draft-utils'

interface DraftTeamHeaderProps {
  teams: TeamDraftStatus[]
  currentTeamId: string | null
  budgetCap: number
  currentRound: number
  currentTurn: number
}

export const DraftTeamHeader: React.FC<DraftTeamHeaderProps> = ({
  teams,
  currentTeamId,
  budgetCap,
  currentRound,
  currentTurn,
}) => {
  return (
    <div className="flex items-stretch gap-1 pb-1">
      {/* Left Gutter: Round Header */}
      <div className="w-14 shrink-0 bg-app-void border border-border-default/40 flex flex-col justify-center items-center py-2">
        <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
          VÒNG
        </span>
      </div>

      {/* Team Columns */}
      <div className="flex-1 grid grid-flow-col auto-cols-fr gap-1">
        {teams.map((team) => {
          const isActive = team.id === currentTeamId
          const percentUsed = Math.min(
            100,
            Math.round((team.budgetUsed / (budgetCap || 305)) * 100)
          )
          const initials = getTeamInitials(team.name)

          if (isActive) {
            return (
              <div
                key={team.id}
                className="bg-neon text-black p-2 flex flex-col justify-between shadow-glow-neon relative overflow-hidden transition-all duration-300 border border-neon"
              >
                {/* Subtle background bolt */}
                <div className="absolute -right-2 -top-2 opacity-15 pointer-events-none text-black">
                  <Zap className="w-16 h-16" />
                </div>

                <div className="flex items-center justify-between z-10 gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="w-6 h-6 bg-black text-neon font-display font-black text-xs flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-black text-xs uppercase tracking-tight truncate leading-tight">
                        {team.name}
                      </div>
                      <div className="font-mono text-[9px] uppercase tracking-wider font-semibold opacity-80 truncate">
                        ĐANG CHỌN · V{currentRound} L{currentTurn}
                      </div>
                    </div>
                  </div>
                  <span className="bg-black text-neon font-mono text-[9px] px-1.5 py-0.5 uppercase tracking-wider font-bold animate-pulse shrink-0">
                    LƯỢT HIỆN TẠI
                  </span>
                </div>

                <div className="flex items-center justify-between mt-1.5 z-10 font-mono text-[10px] font-bold">
                  <span>CÒN LẠI: {team.budgetRemaining}M</span>
                  <span>
                    {team.budgetUsed}/{budgetCap}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-black/20 h-1.5 mt-1 overflow-hidden z-10">
                  <div className="bg-black h-full transition-all" style={{ width: `${percentUsed}%` }} />
                </div>
              </div>
            )
          }

          return (
            <div
              key={team.id}
              className="bg-surface-panel border border-border-default/60 p-2 flex flex-col justify-between transition-colors"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="w-6 h-6 bg-surface-elevated text-zinc-300 font-display font-bold text-xs flex items-center justify-center shrink-0 border border-border-default">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display font-bold text-xs text-zinc-200 truncate leading-tight">
                      {team.name}
                    </div>
                    <div className="font-mono text-[9px] text-zinc-400">
                      QUỸ: {team.budgetUsed}/{budgetCap}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-zinc-400 shrink-0 font-semibold">
                  {percentUsed}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-app-void h-1 mt-2 overflow-hidden">
                <div
                  className="bg-neon/60 h-full transition-all"
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
