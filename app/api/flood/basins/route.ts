import { NextRequest, NextResponse } from 'next/server'
import { getFloodedRiversGeoJSON, type RiverSegment } from '@/lib/flood-data'
import type { GeoJSONFeatureCollection } from '@/types'

// Next.js 15: Using searchParams makes this route dynamic
// Caching happens at the fetch level in flood-data.ts

interface FloodedRiversResponse {
  geojson: GeoJSONFeatureCollection
  segments: RiverSegment[]
}

export async function GET(request: NextRequest): Promise<
  NextResponse<FloodedRiversResponse | { error: string }>
> {
  try {
    // Check for simplified query parameter
    const simplified = request.nextUrl.searchParams.get('simplified') === 'true'

    const result = await getFloodedRiversGeoJSON(simplified)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Flooded Rivers API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch flooded river data' },
      { status: 500 }
    )
  }
}
