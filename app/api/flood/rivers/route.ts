import { NextResponse } from 'next/server'
import { getRiversGeoJSON } from '@/lib/flood-data'
import type { GeoJSONFeatureCollection } from '@/types'

// Rivers don't change often, cache for 24 hours
export const revalidate = 86400

export async function GET(): Promise<
  NextResponse<GeoJSONFeatureCollection | { error: string }>
> {
  try {
    const rivers = await getRiversGeoJSON()
    return NextResponse.json(rivers)
  } catch (error) {
    console.error('Rivers API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch river data' },
      { status: 500 }
    )
  }
}
