import React from 'react'
import { Link } from 'react-router-dom'
import { Zap, Check } from 'lucide-react'

interface AdminHeaderProps {
  tournamentTitle?: string
  isDeploying?: boolean
  onDeploy?: () => void
  deployLabel?: string
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  tournamentTitle = 'KHỞI TẠO GIẢI ĐẤU MỚI',
  isDeploying = false,
  onDeploy,
  deployLabel = 'Khởi Tạo Giải Đấu',
}) => {
  return (
    <header className="h-16 border-b border-[#2A3138] bg-[#121517]/90 backdrop-blur sticky top-0 z-50 px-6 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <Link
            to="/tournaments"
            className="w-8 h-8 rounded bg-[#3DFF6B]/15 border border-[#3DFF6B]/40 flex items-center justify-center font-bold text-[#3DFF6B] hover:opacity-80 transition"
            title="Quay lại danh sách giải đấu"
          >
            <Zap className="w-4 h-4 text-[#3DFF6B]" />
          </Link>
          <div className="flex flex-col">
            <span className="font-bold tracking-wider text-white text-sm uppercase flex items-center gap-2">
              {tournamentTitle}{' '}
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#202529] text-[#3DFF6B] border border-[#3DFF6B]/30">
                QUẢN TRỊ
              </span>
            </span>
            <span className="text-[11px] text-gray-400 font-mono">
              HỆ THỐNG GIẢI ĐẤU • DRAFT ENGINE
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center space-x-1 pl-6 border-l border-[#2A3138] text-sm">
          <Link
            to="/tournaments"
            className="px-3 py-1.5 rounded text-gray-400 hover:text-white hover:bg-[#181C1F] transition-colors"
          >
            Giải Đấu
          </Link>
          <span className="px-3 py-1.5 rounded text-[#3DFF6B] bg-[#3DFF6B]/10 border border-[#3DFF6B]/20 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3DFF6B] animate-pulse" />
            Khu Vực Admin
          </span>
        </nav>
      </div>

      {/* Quick Actions & Server Status */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-gray-400 bg-[#181C1F] px-3 py-1.5 rounded border border-[#2A3138]">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          <span>MÁY CHỦ: VN-CENTRAL-01</span>
        </div>

        <Link
          to="/tournaments"
          className="px-3.5 py-1.5 text-xs font-mono tracking-wider uppercase border border-[#2A3138] text-gray-300 hover:text-white hover:border-gray-500 rounded transition-colors"
        >
          Thoát Admin
        </Link>

        {onDeploy && (
          <button
            type="button"
            onClick={onDeploy}
            disabled={isDeploying}
            className="px-4 py-1.5 text-xs font-mono font-bold tracking-wider uppercase bg-[#3DFF6B] text-black hover:bg-[#2ceb58] disabled:opacity-50 disabled:cursor-not-allowed rounded flex items-center gap-1.5 transition-all shadow-[0_0_8px_rgba(61,255,107,0.2)]"
          >
            <Check className="w-3.5 h-3.5" />
            {isDeploying ? 'Đang Lưu...' : deployLabel}
          </button>
        )}
      </div>
    </header>
  )
}
