import React, { useRef, useState } from 'react'
import type { ImportReport } from '@/types/domain'

interface AdminCsvImportProps {
  onImportCsv: (file: File) => Promise<ImportReport>
  isImporting?: boolean
}

export const AdminCsvImportSection: React.FC<AdminCsvImportProps> = ({
  onImportCsv,
  isImporting = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    setSelectedFileName(file.name)
    setImportError(null)

    try {
      const res = await onImportCsv(file)
      setReport(res)
    } catch (err: any) {
      setImportError(err.message || 'Failed to import CSV.')
    }
  }

  const handleDownloadSample = () => {
    const csvContent =
      'player_id,name,season,position,salary,ovr\n' +
      '1,K. Mbappe,24TOTY,ST,28,116\n' +
      '2,Kaka,ICON,CAM,26,114\n' +
      '3,L. Thuram,ICON,CB,25,113\n' +
      '4,T. Courtois,LOL,GK,24,112\n' +
      '5,P. Vieira,CAP,CDM,27,115\n' +
      '6,Ronaldinho,BTB,LW,26,114\n' +
      '7,D. Beckham,WC22,RW,23,111\n' +
      '8,L. Modric,SPL,CM,24,112\n'
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'fifa_draft_players_sample.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <section id="player-import" className="bg-[#121517] border border-[#2A3138] rounded-xl p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#3DFF6B]" />
      <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#2A3138]">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded bg-[#3DFF6B]/10 border border-[#3DFF6B]/30 text-[#3DFF6B] font-mono text-xs font-bold flex items-center justify-center">
            05
          </span>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wide">
              Nhập Danh Sách Cầu Thủ (CSV) &amp; Kiểm Tra
            </h2>
            <p className="text-xs text-gray-400">
              Tải lên danh sách thẻ cầu thủ hàng loạt, kiểm tra quỹ lương và chẩn đoán định dạng
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadSample}
          className="text-xs font-mono text-[#3DFF6B] hover:underline flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Tải File CSV Mẫu (.csv)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CSV Dropzone & Actions */}
        <div className="lg:col-span-5 space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />

          <div
            onClick={() => {
              if (!isImporting && fileInputRef.current) {
                fileInputRef.current.click()
              }
            }}
            className="border-2 border-dashed border-[#3DFF6B]/40 bg-[#3DFF6B]/[0.02] hover:bg-[#3DFF6B]/[0.05] rounded-xl p-6 text-center cursor-pointer transition-colors group"
          >
            <div className="w-12 h-12 rounded-full bg-[#3DFF6B]/10 border border-[#3DFF6B]/30 text-[#3DFF6B] flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
              {isImporting ? (
                <div className="w-6 h-6 border-2 border-[#3DFF6B] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              )}
            </div>
            <h3 className="text-sm font-bold text-white">
              {isImporting ? 'Đang Xử Lý Dữ Liệu CSV...' : 'Bấm để Tải Lên hoặc Kéo Thả File CSV Cầu Thủ'}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Chấp nhận định dạng CSV UTF-8 (Tích hợp phân khối và tìm kiếm tiếng Việt không dấu)
            </p>
            {selectedFileName && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded bg-[#202529] border border-[#2A3138] text-xs font-mono text-gray-300">
                <span className="w-2 h-2 rounded-full bg-[#3DFF6B]" />
                Đã chọn: <span className="text-white font-bold">{selectedFileName}</span>
              </div>
            )}
          </div>

          {importError && (
            <div className="p-3 bg-red-950/60 border border-red-500/40 text-red-200 text-xs font-mono rounded">
              ⚠️ {importError}
            </div>
          )}

          {/* Column mapping summary */}
          <div className="bg-[#181C1F] border border-[#2A3138] rounded-lg p-3.5 space-y-2 text-xs font-mono">
            <span className="text-[11px] text-gray-400 uppercase tracking-wider block font-bold">
              Cấu Trúc Cột Được Nhận Diện:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-gray-300">
                <span className="text-[#3DFF6B] font-bold">✓</span> player_id → ID cầu thủ
              </div>
              <div className="flex items-center gap-1.5 text-gray-300">
                <span className="text-[#3DFF6B] font-bold">✓</span> name → Tên hiển thị
              </div>
              <div className="flex items-center gap-1.5 text-gray-300">
                <span className="text-[#3DFF6B] font-bold">✓</span> season → Mùa thẻ (ví dụ 24TOTY)
              </div>
              <div className="flex items-center gap-1.5 text-gray-300">
                <span className="text-[#3DFF6B] font-bold">✓</span> position → Vị trí (ST, CB,...)
              </div>
              <div className="flex items-center gap-1.5 text-gray-300">
                <span className="text-[#3DFF6B] font-bold">✓</span> salary → Lương (1-35)
              </div>
              <div className="flex items-center gap-1.5 text-gray-300">
                <span className="text-[#3DFF6B] font-bold">✓</span> ovr → Chỉ số OVR (60-120)
              </div>
            </div>
          </div>
        </div>

        {/* Import Report Card & Validation Inspector */}
        <div className="lg:col-span-7 bg-[#181C1F] border border-[#2A3138] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#2A3138]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#3DFF6B] animate-ping" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Báo Cáo Kiểm Tra CSV
              </h3>
            </div>
            <span className="text-[11px] font-mono text-gray-400">
              {report ? 'Đã hoàn tất xử lý dữ liệu' : 'Đang chờ tải file'}
            </span>
          </div>

          {/* Diagnostic metrics */}
          <div className="grid grid-cols-4 gap-3 text-center font-mono">
            <div className="bg-[#121517] p-2.5 rounded border border-[#2A3138]">
              <span className="text-[10px] text-gray-400 uppercase block">Tổng Dòng</span>
              <span className="text-base font-bold text-white">{report?.rowsRead ?? 0}</span>
            </div>
            <div className="bg-[#121517] p-2.5 rounded border border-[#2A3138]">
              <span className="text-[10px] text-emerald-400 uppercase block">Thêm Mới</span>
              <span className="text-base font-bold text-emerald-400">{report?.rowsInserted ?? 0}</span>
            </div>
            <div className="bg-[#121517] p-2.5 rounded border border-[#2A3138]">
              <span className="text-[10px] text-sky-400 uppercase block">Cập Nhật</span>
              <span className="text-base font-bold text-sky-400">{report?.rowsUpdated ?? 0}</span>
            </div>
            <div className="bg-[#121517] p-2.5 rounded border border-[#2A3138]">
              <span className="text-[10px] text-red-400 uppercase block">Lỗi Dòng</span>
              <span className="text-base font-bold text-red-400">{report?.errors.length ?? 0}</span>
            </div>
          </div>

          {/* Detailed validation item log */}
          <div className="space-y-2 font-mono text-xs">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">
              Nhật Ký Xử Lý (Log):
            </span>

            <div className="bg-[#121517] border border-[#2A3138] rounded p-2.5 space-y-1.5 max-h-40 overflow-y-auto">
              {report && report.errors.length > 0 ? (
                report.errors.map((err, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-red-300 bg-red-500/10 p-1.5 rounded border border-red-500/20 text-[11px]"
                  >
                    <span className="font-bold flex-shrink-0">[LỖI]</span>
                    <span className="flex-1">{err}</span>
                  </div>
                ))
              ) : report ? (
                <div className="flex items-start gap-2 text-emerald-400 bg-emerald-500/5 p-1.5 rounded border border-emerald-500/20 text-[11px]">
                  <span className="font-bold flex-shrink-0">[THÀNH CÔNG]</span>
                  <span className="flex-1">
                    Đã nhập thành công {report.rowsRead} cầu thủ vào danh mục cơ sở dữ liệu. Chỉ mục tìm kiếm tiếng Việt không dấu đã được đồng bộ.
                  </span>
                </div>
              ) : (
                <div className="text-gray-500 text-xs py-4 text-center">
                  Tải lên file CSV để kiểm tra dòng dữ liệu và chỉ số hợp lệ.
                </div>
              )}
            </div>
          </div>

          {/* Bottom indicator */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono text-gray-300">
                {report ? 'Cơ sở dữ liệu đã được đồng bộ' : 'Sẵn sàng xử lý dữ liệu'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
