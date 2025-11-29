import { NextResponse } from 'next/server'
import type { Station, FloodStatus } from '@/types'

// Route Segment Config for Next.js 15
export const dynamic = 'force-dynamic'
export const revalidate = 60

// ArcGIS endpoints
const HYDROSTATIONS_URL =
  'https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/hydrostations/FeatureServer/0/query'
const GAUGES_URL =
  'https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/gauges_2_view/FeatureServer/0/query'

interface ArcGISFeature {
  attributes: Record<string, unknown>
  geometry?: { x: number; y: number }
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

function classify(
  wl: number | null | undefined,
  alert: number | null | undefined,
  minor: number | null | undefined,
  major: number | null | undefined
): FloodStatus {
  if (wl == null || alert == null || minor == null || major == null) {
    return 'UNKNOWN'
  }
  if (wl < alert) return 'NORMAL'
  if (wl < minor) return 'ALERT'
  if (wl < major) return 'MINOR_FLOOD'
  return 'MAJOR_FLOOD'
}

async function fetchStations(): Promise<ArcGISFeature[]> {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
  })

  const res = await fetch(`${HYDROSTATIONS_URL}?${params}`, {
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch stations: ${res.status}`)
  }

  const data: ArcGISResponse = await res.json()
  return data.features ?? []
}

async function fetchLatestReadings(): Promise<Record<string, GaugeReading>> {
  const params = new URLSearchParams({
    f: 'json',
    where: 'CreationDate BETWEEN CURRENT_TIMESTAMP - 24 AND CURRENT_TIMESTAMP',
    outFields: '*',
    orderByFields: 'CreationDate DESC',
    resultRecordCount: '8000',
    returnGeometry: 'false',
  })

  const res = await fetch(`${GAUGES_URL}?${params}`, {
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

export async function GET(): Promise<NextResponse<Station[] | { error: string }>> {
  try {
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
        ? classify(wl, reading.alertpull, reading.minorpull, reading.majorpull)
        : 'NO_DATA'

      let updated: string | null = null
      if (reading?.CreationDate) {
        updated = new Date(reading.CreationDate).toISOString()
      }

      result.push({
        name,
        basin: (attrs.basin as string) ?? '',
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
        updated,
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch flood data' },
      { status: 500 }
    )
  }
}
