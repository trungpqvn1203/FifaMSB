/**
 * Draft board formatting and color utilities matching FC Online broadcast tokens.
 */

export interface PositionStyle {
  text: string
  bg: string
  border: string
}

export function getPositionStyle(pos: string): PositionStyle {
  const upper = (pos || '').toUpperCase()
  switch (upper) {
    case 'ST':
    case 'CF':
      return {
        text: 'text-amber-400',
        bg: 'bg-amber-400/10',
        border: 'border-amber-400/30',
      }
    case 'LW':
    case 'RW':
      return {
        text: 'text-cyan-400',
        bg: 'bg-cyan-400/10',
        border: 'border-cyan-400/30',
      }
    case 'CAM':
      return {
        text: 'text-purple-400',
        bg: 'bg-purple-400/10',
        border: 'border-purple-400/30',
      }
    case 'CM':
    case 'LM':
    case 'RM':
      return {
        text: 'text-indigo-400',
        bg: 'bg-indigo-400/10',
        border: 'border-indigo-400/30',
      }
    case 'CDM':
      return {
        text: 'text-emerald-400',
        bg: 'bg-emerald-400/10',
        border: 'border-emerald-400/30',
      }
    case 'CB':
    case 'LB':
    case 'RB':
    case 'LWB':
    case 'RWB':
      return {
        text: 'text-blue-400',
        bg: 'bg-blue-400/10',
        border: 'border-blue-400/30',
      }
    case 'GK':
      return {
        text: 'text-yellow-400',
        bg: 'bg-yellow-400/10',
        border: 'border-yellow-400/30',
      }
    default:
      return {
        text: 'text-zinc-300',
        bg: 'bg-zinc-800',
        border: 'border-zinc-700',
      }
  }
}

export function formatTurnTimer(seconds: number): string {
  if (seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function getTeamInitials(name: string): string {
  if (!name) return 'TM'
  const words = name.trim().split(/\s+/)
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase()
  }
  if (words.length === 2) {
    return (words[0][0] + words[1].substring(0, 2)).toUpperCase()
  }
  return name.substring(0, 3).toUpperCase()
}

export const POSITION_FILTERS = [
  'ALL',
  'GK',
  'CB',
  'LB',
  'RB',
  'LWB',
  'RWB',
  'CDM',
  'CM',
  'CAM',
  'LM',
  'RM',
  'LW',
  'RW',
  'CF',
  'ST',
] as const
