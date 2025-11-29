export type FloodStatus =
  | 'MAJOR_FLOOD'
  | 'MINOR_FLOOD'
  | 'ALERT'
  | 'NORMAL'
  | 'UNKNOWN'
  | 'NO_DATA'

export interface StationThresholds {
  alert: number | null
  minor: number | null
  major: number | null
}

export interface Station {
  name: string
  basin: string
  lat: number | null
  lon: number | null
  status: FloodStatus
  water_level: number | null
  thresholds: StationThresholds | null
  updated: string | null
}

export const STATUS_PRIORITY: Record<FloodStatus, number> = {
  MAJOR_FLOOD: 0,
  MINOR_FLOOD: 1,
  ALERT: 2,
  NORMAL: 3,
  UNKNOWN: 4,
  NO_DATA: 5,
}

export const STATUS_COLORS: Record<FloodStatus, string> = {
  MAJOR_FLOOD: '#ef4444',
  MINOR_FLOOD: '#f97316',
  ALERT: '#eab308',
  NORMAL: '#22c55e',
  UNKNOWN: '#94a3b8',
  NO_DATA: '#475569',
}
