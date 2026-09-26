import React from 'react'
import { Video, Radio, CheckCircle } from 'lucide-react'
import type { TeamDraftStatus } from '@/types/domain'
import { getTeamInitials, formatTurnTimer } from '@/lib/draft-utils'

interface WarRoomSidebarProps {
  teams: TeamDraftStatus[]
  currentTeamId: string | null
  secondsRemaining: number
  status: string
}

export const WarRoomSidebar: React.FC<WarRoomSidebarProps> = ({
  teams,
  currentTeamId,
  secondsRemaining,
  status,
}) => {
  const activeIdx = teams.findIndex((t) => t.id === currentTeamId)

  return (
    <div className="flex flex-col gap-2 justify-between h-full select-none">
      {/* 4 Team Broadcast Feeds */}
      <div className="flex flex-col gap-2">
        {teams.map((team, idx) => {
          const isActive = team.id === currentTeamId && status === 'PICKING'
          const isNext = activeIdx !== -1 && idx === (activeIdx + 1) % teams.length && !isActive
          const initials = getTeamInitials(team.name)

          if (isActive) {
            return (
              <div
                key={team.id}
                className="relative bg-surface-card border-2 border-neon overflow-hidden h-[96px] flex flex-col justify-end shadow-glow-neon group transition-all"
              >
                {/* Visual backdrop */}
                <div className="absolute inset-0 bg-gradient-to-br from-neon/15 via-app-void to-surface-card" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(61,255,107,0.2),transparent_70%)]" />

                {/* Live tag top-right */}
                <div className="absolute top-2 right-2 bg-danger px-1.5 py-0.5 flex items-center gap-1 z-10">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  <span className="font-mono text-[9px] text-white font-bold uppercase tracking-wider">
                    TRỰC TIẾP
                  </span>
                </div>

                {/* Team Tag Icon */}
                <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 text-zinc-400">
                  <Video className="w-3.5 h-3.5 text-neon" />
                  <span className="font-mono text-[10px] text-zinc-300">CAM #{idx + 1}</span>
                </div>

                {/* Bottom banner */}
                <div className="relative z-10 px-2.5 py-1.5 bg-neon text-black flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-black animate-pulse shrink-0" />
                    <span className="font-display font-black text-xs uppercase tracking-wider truncate">
                      {initials} · {team.name}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold bg-black text-neon px-1.5 py-0.2 shrink-0">
                    {formatTurnTimer(secondsRemaining)}
                  </span>
                </div>
              </div>
            )
          }

          return (
            <div
              key={team.id}
              className="relative bg-surface-card border border-border-default/70 overflow-hidden h-[96px] flex flex-col justify-end shadow-sm group transition-all"
            >
              {/* Subtle visual backdrop */}
              <div className="absolute inset-0 bg-gradient-to-t from-surface-panel via-app-void/80 to-transparent" />

              <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 text-zinc-500">
                <Video className="w-3 h-3" />
                <span className="font-mono text-[9px]">CAM #{idx + 1}</span>
              </div>

              {/* Status tag */}
              <div className="relative z-10 px-2.5 py-1.5 bg-surface-panel/90 border-t border-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                  <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-300 truncate">
                    {initials} · {team.name}
                  </span>
                </div>
                <span
                  className={`font-mono text-[10px] uppercase font-semibold shrink-0 ${
                    isNext ? 'text-cyan animate-pulse' : 'text-zinc-500'
                  }`}
                >
                  {isNext ? 'LƯỢT KẾ TIẾP' : 'CHỜ LƯỢT'}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Broadcast Promo Banner Graphic */}
      <div className="bg-surface-panel border border-border-default p-2.5 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-display text-xs text-white tracking-tight uppercase font-bold flex items-center gap-1">
            <Radio className="w-3.5 h-3.5 text-neon" /> FC ONLINE ARENA
          </span>
          <span className="font-mono text-[9px] text-zinc-400 tracking-wider">
            PHÒNG CHIẾN THUẬT DRAFT
          </span>
        </div>
        <CheckCircle className="w-5 h-5 text-neon shrink-0" />
      </div>
    </div>
  )
}
