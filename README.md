# Sri Lanka Flood Monitor

Real-time flood monitoring dashboard for Sri Lanka hydro-meteorological stations.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **React**: 19.0.0-rc
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Mapping**: Leaflet + React-Leaflet
- **Data Fetching**: SWR

## Project Structure

```
flood-maps/
├── app/
│   ├── api/
│   │   └── flood/
│   │       └── route.ts    # API endpoint for flood data
│   ├── globals.css         # Global styles + Tailwind
│   ├── layout.tsx          # Root layout (Server Component)
│   └── page.tsx            # Home page (Client Component)
├── components/
│   └── Map.tsx             # Leaflet map component
├── types/
│   └── index.ts            # Shared TypeScript types
├── next.config.ts          # Next.js configuration
├── tailwind.config.js      # Tailwind configuration
└── tsconfig.json           # TypeScript configuration
```

## Architecture

### Data Flow

1. Client loads `page.tsx` (Client Component)
2. SWR fetches data from `/api/flood` with 60-second refresh
3. API route fetches from ArcGIS FeatureServer endpoints:
   - Hydrostations (station metadata, revalidated every 5 min)
   - Gauges (water level readings, revalidated every 1 min)
4. Data is deduplicated, classified, and returned as JSON
5. Map and station list render with real-time status

### API Route (`/api/flood`)

Returns an array of `Station` objects with flood status classification:

| Status       | Condition                        |
|--------------|----------------------------------|
| MAJOR_FLOOD  | water_level >= major threshold   |
| MINOR_FLOOD  | water_level >= minor threshold   |
| ALERT        | water_level >= alert threshold   |
| NORMAL       | water_level < alert threshold    |
| UNKNOWN      | Missing threshold data           |
| NO_DATA      | No recent readings               |

### Route Segment Configuration

```typescript
export const dynamic = 'force-dynamic'
export const revalidate = 60
```

## Types

Shared types are defined in `types/index.ts`:

```typescript
type FloodStatus = 'MAJOR_FLOOD' | 'MINOR_FLOOD' | 'ALERT' | 'NORMAL' | 'UNKNOWN' | 'NO_DATA'

interface Station {
  name: string
  basin: string
  lat: number | null
  lon: number | null
  status: FloodStatus
  water_level: number | null
  thresholds: StationThresholds | null
  updated: string | null
}
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

## Known Issues

- **React Strict Mode disabled**: Leaflet's MapContainer is incompatible with React 19's strict mode double-effect invocation. See `next.config.ts`.

## Data Source

Data is fetched from Sri Lanka's ArcGIS FeatureServer:
- Hydrostations: Station metadata and locations
- Gauges: Real-time water level readings (last 24 hours)
