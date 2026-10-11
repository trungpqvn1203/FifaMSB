import React from 'react'

export const FvplFooter: React.FC = () => {
  return (
    <footer className="w-full py-4 px-6 flex flex-col items-center justify-center relative select-none z-10">
      {/* Center tournament slogan badge */}
      <div className="flex flex-col items-center gap-1">
        <span className="px-3 py-0.5 rounded-full bg-red-950/70 border border-red-500/40 text-[10px] md:text-xs font-mono font-bold text-red-300 tracking-widest uppercase">
          FVPL SUMMER 2026
        </span>

        {/* RISE TO INFINITY glowing title with matrix triangles */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-[#00FF87] opacity-60 text-[10px]">
            <span>▲</span>
            <span>▲</span>
            <span>▲</span>
          </div>

          <h3 className="text-xl md:text-2xl font-black italic tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-orange-300 to-white drop-shadow-[0_0_20px_rgba(249,115,22,0.8)] uppercase">
            RISE TO INFINITY
          </h3>

          <div className="flex items-center gap-1 text-[#00FF87] opacity-60 text-[10px]">
            <span>▲</span>
            <span>▲</span>
            <span>▲</span>
          </div>
        </div>
      </div>

      {/* Right corner badge */}
      <div className="absolute right-6 bottom-4 hidden sm:flex items-center gap-1.5 opacity-80 hover:opacity-100 transition">
        <div className="w-6 h-6 rounded bg-[#00FF87] text-black font-black italic text-[11px] flex items-center justify-center">
          FC
        </div>
        <span className="text-[10px] font-bold text-zinc-400 font-mono tracking-wider">
          ONLINE
        </span>
      </div>
    </footer>
  )
}
export default FvplFooter
