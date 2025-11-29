import { NextResponse } from 'next/server'
import { getRiversGeoJSON } from '@/lib/flood-data'
import type { GeoJSONFeatureCollection } from '@/types'

// Next.js 15: GET handlers are not cached by default
// force-static + revalidate enables ISR caching
export const dynamic = 'force-static'
export const revalidate = 86400 // 24 hours

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
