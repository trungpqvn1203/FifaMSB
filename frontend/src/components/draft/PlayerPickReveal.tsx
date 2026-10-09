import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Volume2, VolumeX, X, Sparkles, Trophy, CheckCircle2 } from 'lucide-react'
import { playRevealSound } from '@/lib/reveal-sound'
import { getPositionStyle } from '@/lib/draft-utils'

export interface RevealPlayerData {
  name: string
  position: string
  rating?: number | null
  salary: number
  imageUrl?: string | null
  externalPlayerId?: string | null
  seasonCode?: string
  seasonBadgeUrl?: string | null
  teamName?: string
  isMyPick?: boolean
  roundNumber?: number
  turnNumber?: number
}

interface PlayerPickRevealProps {
  data: RevealPlayerData | null
  onDismiss: () => void
  durationMs?: number // default 4000ms
}

export const PlayerPickReveal: React.FC<PlayerPickRevealProps> = ({
  data,
  onDismiss,
  durationMs = 4200,
}) => {
  const [isClosing, setIsClosing] = useState(false)
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('fc_reveal_sound_muted') === 'true'
  })
  const [imageErrorLevel, setImageErrorLevel] = useState<number>(0)
  const [progressWidth, setProgressWidth] = useState(100)
  const timerRef = useRef<number | null>(null)
  const startTimeRef = useRef<number>(0)

  const triggerClose = React.useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      onDismiss()
      setIsClosing(false)
    }, 320)
  }, [onDismiss])

  // Trigger sound effect and auto-dismiss on mount/data change
  useEffect(() => {
    if (!data) return

    setIsClosing(false)
    setImageErrorLevel(0)
    setProgressWidth(100)
    startTimeRef.current = Date.now()

    if (!isMuted) {
      playRevealSound(0.6)
    }

    const interval = window.setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const remainingPct = Math.max(0, 100 - (elapsed / durationMs) * 100)
      setProgressWidth(remainingPct)
      if (remainingPct <= 0) {
        window.clearInterval(interval)
        triggerClose()
      }
    }, 40)

    timerRef.current = interval

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        triggerClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [data, durationMs, isMuted, triggerClose])

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    localStorage.setItem('fc_reveal_sound_muted', String(nextMuted))
    if (!nextMuted) {
      playRevealSound(0.4)
    }
  }

  // Fallback image source calculation
  const imageSrc = useMemo(() => {
    if (!data) return null
    const spid = data.externalPlayerId?.trim()

    // Level 0: Provided imageUrl
    if (imageErrorLevel === 0 && data.imageUrl) {
      return data.imageUrl
    }
    // Level 1: Nexon action shot CDN
    if (imageErrorLevel <= 1 && spid && /^\d+$/.test(spid)) {
      return `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spid}.png`
    }
    // Level 2: Nexon portrait CDN
    if (imageErrorLevel <= 2 && spid && /^\d+$/.test(spid)) {
      return `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/players/p${spid}.png`
    }
    return null
  }, [data, imageErrorLevel])

  if (!data) return null

  const posStyle = getPositionStyle(data.position)
  const isHighTier = (data.rating || 0) >= 105

  // Accent theme color
  const accentTheme = isHighTier
    ? {
        border: 'from-amber-300 via-yellow-500 to-amber-700',
        glow: 'rgba(245, 197, 24, 0.45)',
        beam: 'from-amber-400/20 via-yellow-500/10 to-transparent',
        badge: 'text-amber-400 border-amber-400/40 bg-amber-400/10',
      }
    : {
        border: 'from-neon via-emerald-400 to-teal-700',
        glow: 'rgba(61, 255, 107, 0.35)',
        beam: 'from-neon/20 via-emerald-500/10 to-transparent',
        badge: 'text-neon border-neon/40 bg-neon/10',
      }

  return (
    <div
      onClick={triggerClose}
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center select-none overflow-hidden cursor-pointer transition-opacity duration-300 ${
        isClosing ? 'animate-reveal-exit pointer-events-none' : 'opacity-100'
      }`}
      style={{
        backgroundColor: 'rgba(5, 7, 10, 0.88)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* 1. Dramatic Ambient Background Lights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        {/* Rotating Stadium Light Beams */}
        <div
          className="absolute w-[900px] h-[900px] rounded-full animate-beam-spin opacity-40 mix-blend-screen"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, ${accentTheme.glow} 45deg, transparent 90deg, ${accentTheme.glow} 180deg, transparent 270deg)`,
          }}
        />

        {/* Central Radial Flare */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full animate-flare-pulse blur-3xl mix-blend-screen"
          style={{
            background: `radial-gradient(circle, ${accentTheme.glow} 0%, transparent 70%)`,
          }}
        />

        {/* Stadium Grid Overlay */}
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              'linear-gradient(to right, #242836 1px, transparent 1px), linear-gradient(to bottom, #242836 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* 2. Top Header HUD Controls */}
      <div
        className="relative z-10 w-full max-w-2xl px-6 flex items-center justify-between mb-4 sm:mb-6 animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Team & Pick Announcement */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-full border flex items-center gap-2 font-mono text-xs uppercase font-bold tracking-wider shadow-lg ${
              data.isMyPick
                ? 'bg-neon/15 border-neon text-neon text-shadow-neon'
                : 'bg-surface-elevated/90 border-border-default text-zinc-200'
            }`}
          >
            {data.isMyPick ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-neon shrink-0 animate-bounce" />
                <span>BẠN ĐÃ CHỌN CẦU THỦ</span>
              </>
            ) : (
              <>
                <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>LƯỢT CHỌN CỦA: {data.teamName || 'ĐỘI BẠN'}</span>
              </>
            )}
          </div>

          {(data.roundNumber || data.turnNumber) && (
            <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-zinc-400">
              <span className="text-zinc-600">//</span>
              <span>
                VÒNG {data.roundNumber || 1} · LƯỢT {data.turnNumber || 1}
              </span>
            </div>
          )}
        </div>

        {/* Quick Actions (Mute & Close) */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            title={isMuted ? 'Bật âm thanh hiệu ứng' : 'Tắt âm thanh'}
            className="p-2 rounded-full bg-surface-card/80 hover:bg-surface-elevated text-zinc-400 hover:text-white border border-border-default transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-zinc-500" /> : <Volume2 className="w-4 h-4 text-neon" />}
          </button>
          <button
            onClick={triggerClose}
            title="Đóng hiệu ứng (ESC)"
            className="p-2 rounded-full bg-surface-card/80 hover:bg-surface-elevated text-zinc-400 hover:text-white border border-border-default transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. Hero Player Card Showcase (Centerpiece) */}
      <div
        className="relative z-10 w-[300px] sm:w-[340px] md:w-[360px] animate-reveal-slam"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Outer Glow Shield */}
        <div
          className="absolute -inset-1.5 rounded-[28px] opacity-80 blur-xl transition-all duration-700 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${accentTheme.glow} 0%, transparent 80%)` }}
        />

        {/* The Card Shield Shell */}
        <div
          className={`relative rounded-[24px] p-[2.5px] bg-gradient-to-b ${accentTheme.border} shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] overflow-hidden`}
        >
          {/* Holographic Sheen Sweep Effect */}
          <div
            className="absolute inset-0 animate-foil-sheen pointer-events-none z-30"
            style={{
              background:
                'linear-gradient(115deg, transparent 20%, rgba(255, 255, 255, 0.45) 45%, rgba(245, 197, 24, 0.3) 50%, transparent 70%)',
            }}
          />

          {/* Internal Card Canvas */}
          <div className="relative rounded-[22px] bg-gradient-to-b from-[#181B22] via-[#0E1015] to-[#07090C] overflow-hidden flex flex-col justify-between h-[450px] sm:h-[490px] border border-white/10">
            {/* Ambient Card Background Lighting */}
            <div
              className="absolute inset-0 pointer-events-none opacity-40"
              style={{
                backgroundImage:
                  'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.15) 0%, transparent 60%)',
              }}
            />

            {/* Top Card Info (OVR, Position, Season) */}
            <div className="relative z-20 pt-4 px-4 flex items-start justify-between">
              {/* OVR + Position Group */}
              <div className="flex flex-col items-start leading-none">
                <span className="font-display font-black text-4xl sm:text-5xl text-white tracking-tighter drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] text-shadow-gold">
                  {data.rating || 99}
                </span>
                <span
                  className={`mt-1 px-2 py-0.5 font-mono text-[11px] sm:text-xs font-black uppercase tracking-wider border rounded shadow-sm ${posStyle.bg} ${posStyle.text} ${posStyle.border}`}
                >
                  {data.position}
                </span>
              </div>

              {/* Season Badge & Salary */}
              <div className="flex flex-col items-end gap-1.5">
                {data.seasonBadgeUrl ? (
                  <img
                    src={data.seasonBadgeUrl}
                    alt={data.seasonCode || 'Season'}
                    className="w-8 h-8 sm:w-9 sm:h-9 object-contain filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="px-2 py-0.5 rounded bg-surface-elevated border border-border-default font-mono text-[11px] font-bold text-zinc-300">
                    {data.seasonCode || 'FCO'}
                  </div>
                )}

                <div className="px-2 py-0.5 rounded bg-black/60 border border-neon/30 font-mono text-[11px] font-bold text-neon flex items-center gap-1 shadow-sm">
                  <span>LƯƠNG:</span>
                  <span className="text-white">{data.salary}.0M</span>
                </div>
              </div>
            </div>

            {/* Center Player Visual (Action Shot / Portrait Cutout) */}
            <div className="relative z-10 flex-1 flex items-center justify-center my-1 px-3 overflow-hidden">
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={data.name}
                  className="max-h-[260px] sm:max-h-[290px] w-auto object-contain filter drop-shadow-[0_16px_24px_rgba(0,0,0,0.9)] transform hover:scale-105 transition-transform duration-500"
                  onError={() => setImageErrorLevel((prev) => prev + 1)}
                />
              ) : (
                /* Fallback Stylized Holographic Player Silhouette */
                <div className="w-36 h-36 sm:w-40 sm:h-40 rounded-full bg-surface-elevated/80 border-2 border-border-default/60 flex flex-col items-center justify-center text-zinc-400 font-display shadow-inner relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-tr from-neon/10 via-transparent to-amber-400/10 pointer-events-none" />
                  <span className="text-4xl sm:text-5xl font-black text-zinc-300 drop-shadow-md">
                    {data.name.substring(0, 2).toUpperCase()}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500 uppercase mt-1 tracking-widest">
                    {data.seasonCode || 'FC ONLINE'}
                  </span>
                </div>
              )}
            </div>

            {/* Bottom Card Plate: Name & Details */}
            <div className="relative z-20 pb-4 px-3 sm:px-4">
              <div className="rounded-xl bg-surface-card/90 border border-border-default/80 p-3 shadow-lg backdrop-blur-md flex flex-col items-center text-center">
                {/* Player Name */}
                <h3
                  className="font-display font-black text-lg sm:text-xl uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white via-zinc-100 to-zinc-300 truncate max-w-full drop-shadow-sm"
                  title={data.name}
                >
                  {data.name}
                </h3>

                {/* Subtitle / Season Details */}
                <div className="flex items-center gap-2 mt-1 font-mono text-[10px] text-zinc-400">
                  <span className="text-amber-400 font-bold uppercase">{data.seasonCode || 'STANDARD'}</span>
                  <span>•</span>
                  <span>{data.position}</span>
                  <span>•</span>
                  <span className="text-neon font-bold">{data.salary}M</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Dismissal HUD & Progress Countdown */}
      <div className="relative z-10 mt-6 sm:mt-8 flex flex-col items-center gap-2">
        {/* Subtle Progress Bar ("rồi thôi" countdown) */}
        <div className="w-48 sm:w-64 h-1 rounded-full bg-surface-elevated overflow-hidden border border-border-default/50">
          <div
            className="h-full bg-gradient-to-r from-neon to-cyan transition-all duration-75 ease-linear shadow-glow-neon"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-400 opacity-80">
          <Sparkles className="w-3.5 h-3.5 text-neon" />
          <span>Bấm bất kỳ đâu hoặc [ESC] để đóng</span>
        </div>
      </div>
    </div>
  )
}
