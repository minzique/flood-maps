import { NextResponse } from 'next/server'
import { getAllStations, getFloodingSummary } from '@/lib/flood-data'
import type { Station, FloodSummary } from '@/types'

// Next.js 15: GET handlers are not cached by default
// force-static + revalidate enables ISR caching
export const dynamic = 'force-static'
export const revalidate = 1800 // 30 minutes

export interface FloodAPIResponse {
  stations: Station[]
  summary: FloodSummary
}

export async function GET(): Promise<
  NextResponse<FloodAPIResponse | { error: string }>
> {
  try {
    const [stations, summary] = await Promise.all([
      getAllStations(),
      getFloodingSummary(),
    ])

    return NextResponse.json({ stations, summary })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch flood data' },
      { status: 500 }
    )
  }
}
