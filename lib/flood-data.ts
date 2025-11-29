/**
 * Flood data fetching and processing utilities
 *
 * Data source: Sri Lanka Irrigation Department (public ArcGIS Feature Services)
 */

import type {
  Station,
  FloodStatus,
  FloodSummary,
  RiskAssessment,
  StationWithDistance,
  RiskLevel,
  GeoJSONFeatureCollection,
  GeoJSONFeature,
} from '@/types'

// =============================================================================
// ArcGIS Feature Service URLs
// =============================================================================

const BASE_URL =
  'https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services'

export const ENDPOINTS = {
  gauges: `${BASE_URL}/gauges_2_view/FeatureServer/0/query`,
  stations: `${BASE_URL}/hydrostations/FeatureServer/0/query`,
  rivers: `${BASE_URL}/rivers/FeatureServer/0/query`,
  basins: `${BASE_URL}/river_basins/FeatureServer/0/query`,
  buffers: `${BASE_URL}/Buffer_of_hydrostations/FeatureServer/0/query`,
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate distance in km between two lat/lon points using Haversine formula
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371.0 // Earth's radius in km
  const phi1 = (lat1 * Math.PI) / 180
  const phi2 = (lat2 * Math.PI) / 180
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Classify flood status from water level and thresholds
 */
export function classifyFloodStatus(
  waterLevel: number | null | undefined,
  alert: number | null | undefined,
  minor: number | null | undefined,
  major: number | null | undefined
): FloodStatus {
  if (
    waterLevel == null ||
    alert == null ||
    minor == null ||
    major == null
  ) {
    return 'UNKNOWN'
  }

  if (waterLevel < alert) return 'NORMAL'
  if (waterLevel < minor) return 'ALERT'
  if (waterLevel < major) return 'MINOR_FLOOD'
  return 'MAJOR_FLOOD'
}

/**
 * Convert ArcGIS epoch milliseconds to ISO string
 */
export function parseTimestamp(ms: number | null | undefined): string | null {
  if (!ms) return null
  try {
    return new Date(ms).toISOString()
  } catch {
    return null
  }
}

// =============================================================================
// ArcGIS Response Types
// =============================================================================

interface ArcGISFeature {
  attributes: Record<string, unknown>
  geometry?: { x: number; y: number; paths?: number[][][] }
}

interface ArcGISResponse {
  features?: ArcGISFeature[]
}

interface GaugeReading {
  gauge?: string
  water_level?: number
  alertpull?: number
  minorpull?: number
  majorpull?: number
  CreationDate?: number
}

// =============================================================================
// Data Fetching Functions
// =============================================================================

/**
 * Fetch all hydrostations with coordinates
 */
export async function fetchStations(): Promise<ArcGISFeature[]> {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
  })

  const res = await fetch(`${ENDPOINTS.stations}?${params}`, {
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch stations: ${res.status}`)
  }

  const data: ArcGISResponse = await res.json()
  return data.features ?? []
}

/**
 * Fetch latest reading per gauge (last 24h)
 */
export async function fetchLatestReadings(): Promise<
  Record<string, GaugeReading>
> {
  const params = new URLSearchParams({
    f: 'json',
    where: 'CreationDate BETWEEN CURRENT_TIMESTAMP - 24 AND CURRENT_TIMESTAMP',
    outFields: '*',
    orderByFields: 'CreationDate DESC',
    resultRecordCount: '8000',
    returnGeometry: 'false',
  })

  const res = await fetch(`${ENDPOINTS.gauges}?${params}`, {
    next: { revalidate: 60 },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch readings: ${res.status}`)
  }

  const data: ArcGISResponse = await res.json()

  // Dedupe: keep only latest per gauge
  const latest: Record<string, GaugeReading> = {}
  for (const f of data.features ?? []) {
    const attrs = f.attributes as GaugeReading
    const gauge = attrs?.gauge
    if (gauge && !latest[gauge]) {
      latest[gauge] = attrs
    }
  }
  return latest
}

/**
 * Fetch all river polylines (paginated)
 */
export async function fetchRivers(): Promise<ArcGISFeature[]> {
  const allFeatures: ArcGISFeature[] = []
  let offset = 0
  const batchSize = 1000

  while (true) {
    const params = new URLSearchParams({
      f: 'json',
      where: '1=1',
      outFields: 'FID',
      returnGeometry: 'true',
      outSR: '4326',
      resultOffset: String(offset),
      resultRecordCount: String(batchSize),
    })

    const res = await fetch(`${ENDPOINTS.rivers}?${params}`, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch rivers: ${res.status}`)
    }

    const data: ArcGISResponse = await res.json()
    const features = data.features ?? []

    if (features.length === 0) break

    allFeatures.push(...features)

    if (features.length < batchSize) break
    offset += batchSize
  }

  return allFeatures
}

// =============================================================================
// Public API Functions
// =============================================================================

/**
 * Get all stations with current flood status
 */
export async function getAllStations(): Promise<Station[]> {
  const [stationsData, readingsData] = await Promise.all([
    fetchStations(),
    fetchLatestReadings(),
  ])

  const result: Station[] = []

  for (const s of stationsData) {
    const attrs = s.attributes as Record<string, unknown>
    const geom = s.geometry
    const name = attrs.station as string | undefined

    if (!name || !geom?.x) continue

    const reading = readingsData[name]
    const wl = reading?.water_level

    const status: FloodStatus = reading
      ? classifyFloodStatus(
          wl,
          reading.alertpull,
          reading.minorpull,
          reading.majorpull
        )
      : 'NO_DATA'

    result.push({
      name,
      basin: ((attrs.basin as string) ?? '').trim(),
      lat: geom.y,
      lon: geom.x,
      status,
      water_level: wl ?? null,
      thresholds: reading
        ? {
            alert: reading.alertpull ?? null,
            minor: reading.minorpull ?? null,
            major: reading.majorpull ?? null,
          }
        : null,
      updated: parseTimestamp(reading?.CreationDate),
    })
  }

  return result
}

/**
 * Get flooding summary
 */
export async function getFloodingSummary(): Promise<FloodSummary> {
  const stations = await getAllStations()

  const byStatus: Record<string, Station[]> = {}
  for (const s of stations) {
    if (!byStatus[s.status]) byStatus[s.status] = []
    byStatus[s.status].push(s)
  }

  const flooding = [
    ...(byStatus['MAJOR_FLOOD'] ?? []),
    ...(byStatus['MINOR_FLOOD'] ?? []),
  ]

  // Sort by severity then water level
  flooding.sort((a, b) => {
    if (a.status === 'MAJOR_FLOOD' && b.status !== 'MAJOR_FLOOD') return -1
    if (a.status !== 'MAJOR_FLOOD' && b.status === 'MAJOR_FLOOD') return 1
    return (b.water_level ?? 0) - (a.water_level ?? 0)
  })

  const affectedBasins = [
    ...new Set(flooding.map((s) => s.basin).filter(Boolean)),
  ]

  return {
    total_stations: stations.length,
    major_flood: byStatus['MAJOR_FLOOD']?.length ?? 0,
    minor_flood: byStatus['MINOR_FLOOD']?.length ?? 0,
    alert: byStatus['ALERT']?.length ?? 0,
    normal: byStatus['NORMAL']?.length ?? 0,
    flooding_stations: flooding.map((s) => ({
      name: s.name,
      basin: s.basin,
      status: s.status,
      water_level: s.water_level,
    })),
    affected_basins: affectedBasins,
  }
}

/**
 * Check flood risk for a location
 */
export async function checkRisk(
  lat: number,
  lon: number,
  radiusKm: number = 15
): Promise<RiskAssessment> {
  const stations = await getAllStations()

  const nearby: StationWithDistance[] = []
  for (const s of stations) {
    if (s.lat == null || s.lon == null) continue
    const dist = haversineDistance(lat, lon, s.lat, s.lon)
    if (dist <= radiusKm) {
      nearby.push({
        ...s,
        distance_km: Math.round(dist * 10) / 10,
      })
    }
  }

  nearby.sort((a, b) => a.distance_km - b.distance_km)

  // Find worst status nearby using priority
  const statusPriority: Record<FloodStatus, number> = {
    MAJOR_FLOOD: 0,
    MINOR_FLOOD: 1,
    ALERT: 2,
    NORMAL: 3,
    UNKNOWN: 4,
    NO_DATA: 5,
  }

  let worstStatus: FloodStatus = 'NORMAL'
  let worstStation: StationWithDistance | null = null

  for (const s of nearby) {
    if (statusPriority[s.status] < statusPriority[worstStatus]) {
      worstStatus = s.status
      worstStation = s
      if (s.status === 'MAJOR_FLOOD') break // Can't get worse
    }
  }

  const riskMap: Record<string, RiskLevel> = {
    MAJOR_FLOOD: 'HIGH',
    MINOR_FLOOD: 'HIGH',
    ALERT: 'MEDIUM',
    NORMAL: 'LOW',
  }
  const riskLevel = riskMap[worstStatus] ?? 'UNKNOWN'

  let summary: string
  let advice: string

  if (worstStation) {
    summary = `${worstStation.status} at ${worstStation.name} (${worstStation.distance_km} km away)`
    const basin = worstStation.basin || 'the river'
    if (riskLevel === 'HIGH') {
      advice = `Active flooding detected nearby. If you are near ${basin}, move to higher ground and follow official alerts.`
    } else {
      advice = `Elevated water levels at ${worstStation.name}. Monitor the situation.`
    }
  } else {
    summary = 'No flood alerts within search radius'
    advice =
      'No immediate flood risk detected from monitored rivers. Stay aware of local conditions.'
  }

  return {
    lat,
    lon,
    risk_level: riskLevel,
    summary,
    nearby: nearby.slice(0, 5),
    advice,
  }
}

/**
 * Get all river lines as GeoJSON FeatureCollection
 */
export async function getRiversGeoJSON(): Promise<GeoJSONFeatureCollection> {
  const features = await fetchRivers()

  const geoJsonFeatures: GeoJSONFeature[] = []

  for (const f of features) {
    const paths = f.geometry?.paths ?? []
    for (const path of paths) {
      geoJsonFeatures.push({
        type: 'Feature',
        properties: { fid: f.attributes?.FID },
        geometry: {
          type: 'LineString',
          coordinates: path,
        },
      })
    }
  }

  return {
    type: 'FeatureCollection',
    features: geoJsonFeatures,
  }
}
