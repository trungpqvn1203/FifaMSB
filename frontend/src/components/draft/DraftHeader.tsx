import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Pause, Play, XCircle, Wifi, WifiOff, Shield } from 'lucide-react'
import { formatTurnTimer } from '@/lib/draft-utils'

interface DraftHeaderProps {
  tournamentId?: string
  tournamentName?: string
  draftStatus?: string
  currentRound?: number
  currentTurn?: number
  secondsRemaining: number
  isConnected: boolean
  isConnecting: boolean
  isAdmin: boolean
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  isActionLoading?: boolean
}

export const DraftHeader: React.FC<DraftHeaderProps> = ({
  tournamentId,
  tournamentName = 'PHIÊN DRAFT GIẢI ĐẤU',
  draftStatus = 'PICKING',
  currentRound = 1,
  currentTurn = 1,
  secondsRemaining,
  isConnected,
  isConnecting,
  isAdmin,
  onPause,
  onResume,
  onCancel,
  isActionLoading = false,
}) => {
  const isDangerTime = draftStatus === 'PICKING' && secondsRemaining <= 5 && secondsRemaining > 0
  const isPaused = draftStatus === 'PAUSED'
  const isCompleted = draftStatus === 'COMPLETED'

  const statusLabel =
    draftStatus === 'PICKING'
      ? 'ĐANG PICK'
      : draftStatus === 'PAUSED'
      ? 'TẠM DỪNG'
      : draftStatus === 'COMPLETED'
      ? 'HOÀN THÀNH'
      : draftStatus

  return (
    <header className="sticky top-0 z-40 w-full bg-app-void border-b border-border-default/60 shadow-xl">
      {/* 1. Main Broadcast HUD Bar */}
      <div className="h-16 px-4 md:px-6 flex items-center justify-between gap-4">
        {/* Left: Live Indicator & Title */}
        <div className="flex items-center gap-3 min-w-0">
          {tournamentId && (
            <Link
              to={`/tournaments/${tournamentId}`}
              className="p-1.5 rounded bg-surface-card hover:bg-surface-elevated text-zinc-400 hover:text-white transition-colors border border-border-default"
              title="Quay lại chi tiết giải đấu"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}

          <div className="flex items-center gap-2 bg-danger/20 border border-danger/40 px-2.5 py-1 rounded-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                isPaused ? 'bg-warning' : isCompleted ? 'bg-zinc-500' : 'bg-danger animate-pulse'
              }`}
            />
            <span
              className={`font-mono text-xs uppercase tracking-wider font-bold ${
                isPaused ? 'text-warning' : isCompleted ? 'text-zinc-400' : 'text-danger'
              }`}
            >
              {statusLabel}
            </span>
          </div>

          <div className="h-4 w-px bg-border-prominent hidden sm:block" />

          <div className="flex flex-col min-w-0">
            <span className="font-display text-sm md:text-base font-bold uppercase tracking-tight text-white truncate">
              {tournamentName}
            </span>
            <span className="font-mono text-[10px] text-zinc-400 tracking-wider hidden sm:block">
              BẢNG ĐIỀU KHIỂN PHÒNG DRAFT // FC ONLINE
            </span>
          </div>
        </div>

        {/* Center: TURN CLOCK HUD */}
        <div className="flex items-center justify-center shrink-0">
          <div
            className={`border px-4 md:px-6 py-1 flex items-center gap-3 transition-colors ${
              isDangerTime
                ? 'bg-danger/15 border-danger/60 shadow-glow-danger'
                : isPaused
                ? 'bg-warning/10 border-warning/40'
                : isCompleted
                ? 'bg-surface-card border-border-default'
                : 'bg-surface-panel border-border-default shadow-[0_0_12px_rgba(61,255,107,0.15)]'
            }`}
          >
            <div className="flex flex-col items-end">
              <span className="font-mono text-[9px] uppercase text-zinc-400 tracking-widest leading-none">
                {isPaused ? 'TẠM DỪNG ĐỒNG HỒ' : isCompleted ? 'DRAFT KẾT THÚC' : 'THỜI GIAN LƯỢT'}
              </span>
              <span
                className={`font-mono text-2xl md:text-3xl tabular-nums font-bold leading-tight ${
                  isDangerTime
                    ? 'text-danger animate-pulse drop-shadow-[0_0_8px_rgba(255,59,78,0.7)]'
                    : isPaused
                    ? 'text-warning'
                    : isCompleted
                    ? 'text-zinc-500'
                    : 'text-neon drop-shadow-[0_0_10px_rgba(61,255,107,0.45)]'
                }`}
              >
                {isCompleted ? '--:--' : formatTurnTimer(secondsRemaining)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Round Info, Telemetry, and Admin Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-2 bg-surface-card border border-border-default px-3 py-1 text-xs font-mono">
            <span className="text-zinc-200 font-bold uppercase">Lượt Pick {currentTurn}</span>
            <span className="text-zinc-500">·</span>
            <span className="text-neon uppercase font-semibold">Vòng {currentRound}</span>
          </div>

          {/* Connection status */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono border rounded ${
              isConnected
                ? 'bg-neon/10 border-neon/30 text-neon'
                : isConnecting
                ? 'bg-warning/10 border-warning/30 text-warning'
                : 'bg-danger/10 border-danger/30 text-danger'
            }`}
            title={
              isConnected ? 'Đã kết nối Realtime' : isConnecting ? 'Đang kết nối...' : 'Mất kết nối'
            }
          >
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">ĐÃ ĐỒNG BỘ</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden xl:inline">KẾT NỐI LẠI</span>
              </>
            )}
          </div>

          {/* Admin Controls */}
          {isAdmin && (
            <div className="flex items-center gap-1 bg-surface-card p-1 border border-border-default rounded">
              <Shield className="w-3.5 h-3.5 text-zinc-400 ml-1 mr-0.5" />
              {draftStatus === 'PICKING' && onPause && (
                <button
                  onClick={onPause}
                  disabled={isActionLoading}
                  className="px-2 py-1 text-xs font-mono uppercase bg-surface-elevated hover:bg-warning/20 text-warning border border-warning/30 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Tạm dừng phiên draft"
                >
                  <Pause className="w-3 h-3" />
                  <span className="hidden sm:inline">Tạm dừng</span>
                </button>
              )}

              {draftStatus === 'PAUSED' && onResume && (
                <button
                  onClick={onResume}
                  disabled={isActionLoading}
                  className="px-2 py-1 text-xs font-mono uppercase bg-neon/15 hover:bg-neon/25 text-neon border border-neon/40 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Tiếp tục phiên draft"
                >
                  <Play className="w-3 h-3" />
                  <span className="hidden sm:inline">Tiếp tục</span>
                </button>
              )}

              {(draftStatus === 'PICKING' || draftStatus === 'PAUSED') && onCancel && (
                <button
                  onClick={() => {
                    if (window.confirm('Bạn có chắc chắn muốn huỷ phiên Draft này không?')) {
                      onCancel()
                    }
                  }}
                  disabled={isActionLoading}
                  className="px-2 py-1 text-xs font-mono uppercase bg-danger/15 hover:bg-danger/25 text-danger border border-danger/30 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                  title="Huỷ phiên draft"
                >
                  <XCircle className="w-3 h-3" />
                  <span className="hidden sm:inline">Huỷ</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Sub Telemetry Strip */}
      <div className="w-full bg-surface-panel/80 px-4 md:px-6 py-1 border-t border-border-subtle flex items-center justify-between text-[11px] font-mono text-zinc-400">
        <div className="flex items-center gap-3">
          <span className="text-zinc-200 font-bold tracking-wider">
            FC ONLINE // GIẢI ĐẤU CHUYÊN NGHIỆP
          </span>
          <span className="text-zinc-600">//</span>
          <span className="text-zinc-400">PHÒNG DRAFT CHIẾN THUẬT</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-400">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neon"></span>
            <span className="text-zinc-300">KÊNH REALTIME ĐỘ TRỄ THẤP</span>
          </div>
          <span className="text-zinc-600">//</span>
          <span className="text-neon">ĐỒNG BỘ TRỰC TIẾP WS</span>
        </div>
      </div>
    </header>
  )
}
