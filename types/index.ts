// =============================================================================
// Flood Status Types
// =============================================================================

export type FloodStatus =
  | 'MAJOR_FLOOD'
  | 'MINOR_FLOOD'
  | 'ALERT'
  | 'NORMAL'
  | 'UNKNOWN'
  | 'NO_DATA'

export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'

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

export interface StationWithDistance extends Station {
  distance_km: number
}

// =============================================================================
// Summary Types
// =============================================================================

export interface FloodingStation {
  name: string
  basin: string
  status: FloodStatus
  water_level: number | null
}

export interface FloodSummary {
  total_stations: number
  major_flood: number
  minor_flood: number
  alert: number
  normal: number
  flooding_stations: FloodingStation[]
  affected_basins: string[]
}

// =============================================================================
// Risk Assessment Types
// =============================================================================

export interface RiskAssessment {
  lat: number
  lon: number
  risk_level: RiskLevel
  summary: string
  nearby: StationWithDistance[]
  advice: string
}

// =============================================================================
// GeoJSON Types
// =============================================================================

export interface GeoJSONFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: {
    type: 'LineString' | 'Point' | 'Polygon'
    coordinates: number[] | number[][] | number[][][]
  }
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

// =============================================================================
// Constants
// =============================================================================

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

export const RISK_COLORS: Record<RiskLevel, string> = {
  HIGH: '#ef4444',
  MEDIUM: '#eab308',
  LOW: '#22c55e',
  UNKNOWN: '#94a3b8',
}
