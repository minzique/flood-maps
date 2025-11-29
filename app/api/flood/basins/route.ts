import { NextResponse } from 'next/server'
import { getFloodedRiversGeoJSON, type BasinWithStatus } from '@/lib/flood-data'
import type { GeoJSONFeatureCollection } from '@/types'

// Cache flooded rivers for 30 minutes (same as station data)
export const revalidate = 1800

interface FloodedRiversResponse {
  geojson: GeoJSONFeatureCollection
  basinStatuses: Record<string, BasinWithStatus>
}

export async function GET(): Promise<
  NextResponse<FloodedRiversResponse | { error: string }>
> {
  try {
    const result = await getFloodedRiversGeoJSON()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Flooded Rivers API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch flooded river data' },
      { status: 500 }
    )
  }
}
