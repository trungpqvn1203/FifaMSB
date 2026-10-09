/**
 * Web Audio API synthesizer for the Player Reveal / Walkout fanfare.
 * Generates an instant high-impact cinematic stadium bass drop & crystal chime
 * without relying on external MP3 asset downloads.
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass()
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {})
    }
    return audioCtx
  } catch {
    return null
  }
}

export function playRevealSound(volume: number = 0.5): void {
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime

  try {
    // 1. Sub-bass cinematic impact boom
    const subOsc = ctx.createOscillator()
    const subGain = ctx.createGain()
    subOsc.type = 'sine'
    subOsc.frequency.setValueAtTime(110, now)
    subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.6)

    subGain.gain.setValueAtTime(volume * 0.7, now)
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8)

    subOsc.connect(subGain)
    subGain.connect(ctx.destination)
    subOsc.start(now)
    subOsc.stop(now + 0.85)

    // 2. Mid punch punchy impact
    const punchOsc = ctx.createOscillator()
    const punchGain = ctx.createGain()
    punchOsc.type = 'triangle'
    punchOsc.frequency.setValueAtTime(180, now)
    punchOsc.frequency.exponentialRampToValueAtTime(55, now + 0.25)

    punchGain.gain.setValueAtTime(volume * 0.5, now)
    punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3)

    punchOsc.connect(punchGain)
    punchGain.connect(ctx.destination)
    punchOsc.start(now)
    punchOsc.stop(now + 0.35)

    // 3. Shimmering high chimes (Major chord progression: C6 -> E6 -> G6 -> C7)
    const notes = [1046.5, 1318.51, 1567.98, 2093.0]
    notes.forEach((freq, idx) => {
      const noteDelay = 0.08 + idx * 0.07
      const chimeOsc = ctx.createOscillator()
      const chimeGain = ctx.createGain()

      chimeOsc.type = 'sine'
      chimeOsc.frequency.setValueAtTime(freq, now + noteDelay)

      chimeGain.gain.setValueAtTime(0, now)
      chimeGain.gain.setValueAtTime(volume * 0.25, now + noteDelay)
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + noteDelay + 0.9)

      chimeOsc.connect(chimeGain)
      chimeGain.connect(ctx.destination)

      chimeOsc.start(now + noteDelay)
      chimeOsc.stop(now + noteDelay + 0.95)
    })
  } catch {
    // Graceful fallback if audio is blocked or interrupted
  }
}
