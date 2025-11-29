import { NextRequest, NextResponse } from 'next/server'
import { checkRisk } from '@/lib/flood-data'
import type { RiskAssessment } from '@/types'

// ISR: Revalidate every 30 minutes
// Risk data depends on station data which is cached
export const revalidate = 1800

export async function GET(
  request: NextRequest
): Promise<NextResponse<RiskAssessment | { error: string }>> {
  try {
    const searchParams = request.nextUrl.searchParams
    const lat = searchParams.get('lat')
    const lon = searchParams.get('lon')
    const radius = searchParams.get('radius')

    if (!lat || !lon) {
      return NextResponse.json(
        { error: 'Missing required parameters: lat, lon' },
        { status: 400 }
      )
    }

    const latNum = parseFloat(lat)
    const lonNum = parseFloat(lon)

    if (isNaN(latNum) || isNaN(lonNum)) {
      return NextResponse.json(
        { error: 'Invalid coordinates: lat and lon must be numbers' },
        { status: 400 }
      )
    }

    const radiusKm = radius ? parseFloat(radius) : 15

    const risk = await checkRisk(latNum, lonNum, radiusKm)
    return NextResponse.json(risk)
  } catch (error) {
    console.error('Risk API Error:', error)
    return NextResponse.json(
      { error: 'Failed to check flood risk' },
      { status: 500 }
    )
  }
}
