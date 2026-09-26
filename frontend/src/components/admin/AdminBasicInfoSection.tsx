import React from 'react'

interface AdminBasicInfoProps {
  name: string
  onNameChange: (val: string) => void
  tournamentCode: string
  onTournamentCodeChange: (val: string) => void
  gameMode: string
  onGameModeChange: (val: string) => void
  scheduleDate: string
  onScheduleDateChange: (val: string) => void
}

export const AdminBasicInfoSection: React.FC<AdminBasicInfoProps> = ({
  name,
  onNameChange,
  tournamentCode,
  onTournamentCodeChange,
  gameMode,
  onGameModeChange,
  scheduleDate,
  onScheduleDateChange,
}) => {
  return (
    <section id="basic-info" className="bg-[#121517] border border-[#2A3138] rounded-xl p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#3DFF6B]" />
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#2A3138]">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded bg-[#3DFF6B]/10 border border-[#3DFF6B]/30 text-[#3DFF6B] font-mono text-xs font-bold flex items-center justify-center">
            01
          </span>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Thông Tin Cơ Bản Của Giải Đấu
            </h2>
            <p className="text-xs text-gray-400">Thông tin định danh giải đấu, thời gian biểu và nhận diện phát sóng</p>
          </div>
        </div>
        <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 bg-emerald-400/10 px-2.5 py-1 rounded border border-emerald-400/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Đã Thiết Lập
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tournament Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 font-medium">
            Tên Giải Đấu <span className="text-[#3DFF6B]">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ví dụ: FVPL SUMMER 2026: RISE TO INFINITY"
            className="w-full bg-[#181C1F] border border-[#2A3138] focus:border-[#3DFF6B] focus:ring-1 focus:ring-[#3DFF6B] text-sm text-white px-3.5 py-2 rounded transition-colors font-mono outline-none"
            required
          />
          <p className="text-[11px] text-gray-400">Tên hiển thị trên tiêu đề phát sóng trực tiếp.</p>
        </div>

        {/* Tournament Slug / Short Code */}
        <div className="space-y-1.5">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 font-medium">
            Mã Giải Đấu (Slug) <span className="text-[#3DFF6B]">*</span>
          </label>
          <div className="flex rounded">
            <span className="inline-flex items-center px-3 bg-[#202529] text-gray-400 text-xs font-mono border border-r-0 border-[#2A3138] rounded-l">
              fvpl.gg/
            </span>
            <input
              type="text"
              value={tournamentCode}
              onChange={(e) => onTournamentCodeChange(e.target.value)}
              placeholder="s2-2026-draft"
              className="w-full bg-[#181C1F] border border-[#2A3138] focus:border-[#3DFF6B] focus:ring-1 focus:ring-[#3DFF6B] text-sm text-[#3DFF6B] px-3 py-2 rounded-r font-mono outline-none"
            />
          </div>
          <p className="text-[11px] text-gray-400">Mã định danh duy nhất cho liên kết giải đấu.</p>
        </div>

        {/* Game Mode */}
        <div className="space-y-1.5">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 font-medium">
            Chế Độ &amp; Thể Thức Thi Đấu
          </label>
          <select
            value={gameMode}
            onChange={(e) => onGameModeChange(e.target.value)}
            className="w-full bg-[#181C1F] border border-[#2A3138] focus:border-[#3DFF6B] text-sm text-white px-3 py-2 rounded font-mono outline-none"
          >
            <option value="pro_tier">EA Sports FC Online - Pro Tier Draft</option>
            <option value="championship">EA Sports FC Online - Vô Địch Quốc Gia</option>
            <option value="all_star">Giao Hữu All-Star Draft</option>
          </select>
          <p className="text-[11px] text-gray-400">Xác định cấu hình mẫu và quy tắc kiểm tra dữ liệu.</p>
        </div>

        {/* Schedule Date */}
        <div className="space-y-1.5">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 font-medium">
            Thời Gian Bắt Đầu Draft
          </label>
          <input
            type="datetime-local"
            value={scheduleDate}
            onChange={(e) => onScheduleDateChange(e.target.value)}
            className="w-full bg-[#181C1F] border border-[#2A3138] focus:border-[#3DFF6B] text-sm text-white px-3 py-2 rounded font-mono outline-none"
          />
          <p className="text-[11px] text-gray-400">Múi giờ: UTC+07:00 (Hà Nội/Bangkok)</p>
        </div>

        {/* Admin Supervisor */}
        <div className="space-y-1.5">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 font-medium">
            Tổng Trọng Tài / Quản Trị Viên
          </label>
          <input
            type="text"
            defaultValue="Alex Phạm (alex.pham@fvpl.gg)"
            className="w-full bg-[#181C1F] border border-[#2A3138] focus:border-[#3DFF6B] text-sm text-white px-3 py-2 rounded font-mono outline-none"
          />
          <p className="text-[11px] text-gray-400">Có quyền can thiệp thời gian và xử lý tranh chấp.</p>
        </div>

        {/* Broadcast Overlay Sync */}
        <div className="space-y-1.5">
          <label className="block text-xs font-mono uppercase tracking-wider text-gray-300 font-medium">
            Đồng Bộ Lớp Phủ Phát Sóng (Overlay)
          </label>
          <div className="flex items-center justify-between p-2.5 rounded bg-[#181C1F] border border-[#2A3138]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#3DFF6B] animate-pulse" />
              <span className="text-xs font-mono text-gray-200">CỔNG: 4455 (HOẠT ĐỘNG)</span>
            </div>
            <span className="text-[11px] font-mono text-[#3DFF6B] uppercase">Đã Đồng Bộ</span>
          </div>
          <p className="text-[11px] text-gray-400">Đồng bộ dữ liệu thời gian thực với engine đồ hoạ livestream.</p>
        </div>
      </div>
    </section>
  )
}
