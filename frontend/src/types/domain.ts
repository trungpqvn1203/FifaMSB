import type { components } from './api'

export type User = components['schemas']['UserResponse']
export type Role = User['role']
export type Tournament = components['schemas']['TournamentResponse']
export type TournamentListItem = components['schemas']['TournamentListItem']
export type TournamentCreate = components['schemas']['CreateTournamentRequest']
export type TournamentRules = components['schemas']['TournamentRulesSchema']
export type Team = components['schemas']['TeamResponse']
export type CreateTeamRequest = components['schemas']['CreateTeamRequest']

export type DraftDetail = components['schemas']['DraftDetailResponse']
export type TeamDraftStatus = components['schemas']['TeamDraftStatus']
export type DraftPickBoardItem = components['schemas']['DraftPickBoardItem']
export type MakePickResponse = components['schemas']['MakePickResponse']
export type DraftPickRequest = components['schemas']['DraftPickRequest']

export type PlayerSeason = components['schemas']['PlayerSeasonResponse']
export type PlayerSeasonList = components['schemas']['PlayerSeasonListResponse']

export interface PickedPlayerDetail {
  playerSeasonId: string
  playerId: string
  name: string
  position: string
  rating: number
  salary: number
  season?: {
    id: string
    code: string
    badgeUrl?: string | null
  } | null
}

export interface DraftSocketEvent {
  eventType:
    | 'INITIAL_SNAPSHOT'
    | 'PICK_MADE'
    | 'TURN_TIMEOUT'
    | 'DRAFT_PAUSED'
    | 'DRAFT_RESUMED'
    | 'DRAFT_COMPLETED'
    | 'DRAFT_CANCELLED'
  draftId: string
  version: number
  serverTime: string
  status: 'PICKING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'
  currentRound: number
  currentTurn: number
  currentTeamId: string | null
  turnStartedAt: string | null
  turnExpiresAt: string | null
  remainingMillis: number | null
  pickedPlayer?: PickedPlayerDetail | null
  teams: Array<{
    id: string
    name: string
    draftOrder: number
    budgetUsed: number
    budgetRemaining: number
    pickedCount: number
  }>
}

// ---------------------------------------------------------------------------
// Match & Ban Phase Types (Phase 9 & 10)
// ---------------------------------------------------------------------------

export interface MatchTeamSummary {
  id: string
  name: string
  confirmed: boolean
  banCount: number
}

export interface MatchBanItem {
  id: string
  banningTeamId: string
  targetTeamId: string
  playerSeasonId: string
  playerName: string
  position: string
  rating: number
  seasonCode: string
  seasonBadgeUrl?: string | null
  createdAt: string
}

export interface MatchRulesSnapshot {
  banCount?: number
  banQuota?: number
  banOrder?: 'SIMULTANEOUS' | 'ALTERNATING'
  banTimeSeconds?: number
  banTarget?: 'OPPONENT_ROSTER' | 'OWN_ROSTER'
  rosterSize?: number
  budget?: number
  [key: string]: any
}

export interface MatchDetail {
  id: string
  tournamentId: string
  status: 'SCHEDULED' | 'BAN_PHASE' | 'BANS_LOCKED' | 'COMPLETED'
  scheduledAt: string | null
  banStartedAt: string | null
  banExpiresAt: string | null
  version: number
  serverTime: string
  rulesSnapshot: MatchRulesSnapshot
  homeTeam: MatchTeamSummary
  awayTeam: MatchTeamSummary
  bans: MatchBanItem[]
}

export interface MatchSocketEvent extends MatchDetail {
  eventType?:
    | 'INITIAL_SNAPSHOT'
    | 'BAN_PHASE_STARTED'
    | 'BAN_SUBMITTED'
    | 'BAN_DELETED'
    | 'BANS_CONFIRMED'
    | 'BANS_LOCKED'
    | 'MATCH_COMPLETED'
}

export interface RosterPlayerSeasonSummary {
  id: string
  code: string
  name: string
  badgeUrl?: string | null
}

export interface RosterItemPlayer {
  playerSeasonId: string
  playerId: string
  name: string
  position: string
  rating: number
  salary: number
  season: RosterPlayerSeasonSummary
}

export interface RosterItem {
  pickId: string
  round: number
  turnNumber: number
  salaryAtPick: number
  pickedAt: string
  player: RosterItemPlayer
}

export interface TeamRosterResponse {
  teamId: string
  teamName: string
  rosterCount: number
  budgetUsed: number
  roster: RosterItem[]
}

// ---------------------------------------------------------------------------
// Admin & Importer Types (Phase 11)
// ---------------------------------------------------------------------------

export interface ImportReport {
  rowsRead: number
  rowsInserted: number
  rowsUpdated: number
  rowsSkipped: number
  errors: string[]
}

export interface SeasonItem {
  id: string
  code: string
  name: string
  badgeUrl?: string | null
}
