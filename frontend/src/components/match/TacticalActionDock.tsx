import React, { useEffect } from 'react'

interface TacticalActionDockProps {
  currentBanCount: number
  maxBans: number
  isConfirmed: boolean
  isLocked: boolean
  isPendingAction: boolean
  status: 'SCHEDULED' | 'BAN_PHASE' | 'BANS_LOCKED' | 'COMPLETED'
  onUndoLastPick: () => void
  onConfirmBans: () => void
}

export const TacticalActionDock: React.FC<TacticalActionDockProps> = ({
  currentBanCount,
  maxBans,
  isConfirmed,
  isLocked,
  isPendingAction,
  status,
  onUndoLastPick,
  onConfirmBans,
}) => {
  // Keyboard shortcut Ctrl+Z to undo last pick
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!isConfirmed && !isLocked && currentBanCount > 0 && !isPendingAction) {
          e.preventDefault()
          onUndoLastPick()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isConfirmed, isLocked, currentBanCount, isPendingAction, onUndoLastPick])

  const remaining = Math.max(0, maxBans - currentBanCount)
  const isReadyToLock = currentBanCount === maxBans && !isConfirmed && status === 'BAN_PHASE'

  return (
    <footer
      className="w-full bg-[#111217] border-t border-[#222530] px-4 lg:px-8 py-3.5 select-none relative z-20 shadow-[0_-10px_25px_rgba(0,0,0,0.5)]"
      data-purpose="tactical-dock"
    >
      <div className="max-w-[1920px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Dock Left: Selection Status Summary */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Numbered Pills */}
            <div className="flex -space-x-1.5 font-mono text-xs">
              {Array.from({ length: maxBans }).map((_, idx) => {
                const isSelected = idx < currentBanCount
                return (
                  <span
                    key={idx}
                    className={`w-6 h-6 rounded-full border-2 border-[#111217] flex items-center justify-center font-bold text-xs ${
                      isSelected ? 'bg-red-600 text-white' : 'bg-[#272b38] text-zinc-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                )
              })}
            </div>

            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                {status === 'BANS_LOCKED' || status === 'COMPLETED' ? (
                  <>
                    <span>Đã công bố danh sách cấm ({maxBans} vs {maxBans} thẻ bị loại)</span>
                    <span className="text-[11px] font-mono font-normal text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                      Chính thức
                    </span>
                  </>
                ) : isConfirmed ? (
                  <>
                    <span>Đã chọn &amp; khoá {currentBanCount} / {maxBans} thẻ cấm</span>
                    <span className="text-[11px] font-mono font-normal text-[#3DFF6B] bg-[#3DFF6B]/10 px-2 py-0.5 rounded border border-[#3DFF6B]/20">
                      Sẵn sàng
                    </span>
                  </>
                ) : (
                  <>
                    <span>Đã chọn {currentBanCount} / {maxBans} thẻ cấm mục tiêu đối thủ</span>
                    {remaining > 0 ? (
                      <span className="text-[11px] font-mono font-normal text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        Còn thiếu {remaining} lựa chọn
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono font-normal text-[#3DFF6B] bg-[#3DFF6B]/10 px-2 py-0.5 rounded border border-[#3DFF6B]/20">
                        Sẵn sàng khoá
                      </span>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                {status === 'BANS_LOCKED' || status === 'COMPLETED'
                  ? 'Tất cả lượt cấm chiến thuật đã có hiệu lực. Các thẻ bị cấm không thể đưa vào sơ đồ chiến thuật.'
                  : 'Các lựa chọn cấm được giữ kín và sẽ công bố đồng thời khi hết giờ hoặc khi cả hai đội xác nhận.'}
              </p>
            </div>
          </div>
        </div>

        {/* Dock Right: Interactive Action Buttons */}
        <div className="flex items-center gap-3">
          {/* Undo Button */}
          {!isConfirmed && !isLocked && status === 'BAN_PHASE' && (
            <button
              type="button"
              disabled={currentBanCount === 0 || isPendingAction}
              onClick={onUndoLastPick}
              className="px-4 py-2.5 rounded-lg border border-[#303546] bg-[#1a1d26] hover:bg-[#232733] text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Hoàn tác thẻ vừa cấm</span>
              <kbd className="hidden sm:inline font-mono text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                Ctrl+Z
              </kbd>
            </button>
          )}

          {/* Primary Lock Action Button */}
          {status === 'BANS_LOCKED' || status === 'COMPLETED' ? (
            <button
              type="button"
              disabled
              className="px-6 py-2.5 rounded-lg bg-white text-black font-black tracking-wide text-xs uppercase transition shadow-lg flex items-center gap-2 cursor-default"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  clipRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  fillRule="evenodd"
                />
              </svg>
              <span>HOÀN THÀNH GIAI ĐOẠN CẤM CHỌN</span>
            </button>
          ) : isConfirmed ? (
            <button
              type="button"
              disabled
              className="px-6 py-2.5 rounded-lg bg-amber-400 text-black font-black tracking-wide text-xs uppercase transition cursor-not-allowed opacity-90 flex items-center gap-2 shadow-[0_0_15px_rgba(245,197,24,0.3)]"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  clipRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  fillRule="evenodd"
                />
              </svg>
              <span>ĐÃ KHOÁ THẺ CẤM · ĐANG CHỜ ĐỐI THỦ</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!isReadyToLock || isPendingAction}
              onClick={onConfirmBans}
              className={`px-6 py-2.5 rounded-lg font-black tracking-wide text-xs uppercase transition flex items-center gap-2 ${
                isReadyToLock
                  ? 'bg-[#3DFF6B] hover:bg-[#32e05b] text-black shadow-[0_0_15px_rgba(61,255,107,0.3)] hover:shadow-[0_0_20px_rgba(61,255,107,0.5)] active:scale-95 cursor-pointer'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700 opacity-60 cursor-not-allowed'
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  clipRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  fillRule="evenodd"
                />
              </svg>
              <span>
                KHOÁ LƯỢT CẤM &amp; SẴN SÀNG ({currentBanCount}/{maxBans})
              </span>
            </button>
          )}
        </div>
      </div>
    </footer>
  )
}
