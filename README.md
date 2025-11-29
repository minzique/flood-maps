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
│   │       ├── route.ts        # Main flood data + summary
│   │       ├── basins/
│   │       │   └── route.ts    # Flooded rivers GeoJSON
│   │       ├── rivers/
│   │       │   └── route.ts    # All rivers GeoJSON
│   │       └── risk/
│   │           └── route.ts    # Location risk assessment
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   └── Map.tsx                 # Leaflet map with zoom-based rendering
├── data/
│   ├── rivers.json             # River definitions with locations
│   ├── locations.json          # Location coordinates
│   ├── gauging_stations.json   # Station metadata + thresholds
│   ├── station_rivers.json     # River paths through stations
│   └── main_rivers.json        # OSM river data (backup)
├── lib/
│   └── flood-data.ts           # Shared data fetching logic
├── types/
│   └── index.ts                # TypeScript types
└── next.config.ts
```

## API Endpoints

### GET `/api/flood`

Returns stations and summary data. **ISR cached for 30 minutes.**

```typescript
interface Response {
  stations: Station[]
  summary: {
    total_stations: number
    major_flood: number
    minor_flood: number
    alert: number
    normal: number
    flooding_stations: FloodingStation[]
    affected_basins: string[]
  }
}
```

### GET `/api/flood/basins`

Returns flooded river segments as GeoJSON. **ISR cached for 30 minutes.**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| simplified | boolean | false | If true, returns station-based river paths |

- `simplified=false`: Full ArcGIS river segments within flooded basins
- `simplified=true`: Simplified paths connecting gauging stations

### GET `/api/flood/rivers`

Returns all river lines as GeoJSON FeatureCollection (3000+ segments).
**ISR cached for 24 hours.**

### GET `/api/flood/risk?lat=6.9&lon=79.8&radius=15`

Check flood risk for a specific location. **Dynamic route (not cached).**

| Param  | Type   | Default | Description           |
|--------|--------|---------|-----------------------|
| lat    | number | -       | Latitude (required)   |
| lon    | number | -       | Longitude (required)  |
| radius | number | 15      | Search radius in km   |

```typescript
interface Response {
  lat: number
  lon: number
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'
  summary: string
  nearby: StationWithDistance[]
  advice: string
}
```

## Data Flow

1. Client loads `page.tsx` (Client Component)
2. SWR fetches `/api/flood` with 60-second auto-refresh
3. Map component fetches `/api/flood/rivers` separately (cached 24h)
4. API routes use shared `lib/flood-data.ts` functions
5. Data fetched from Sri Lanka Irrigation Dept ArcGIS servers:
   - Hydrostations (station metadata)
   - Gauges (water level readings)
   - Rivers (polyline geometry)

## Flood Status Classification

| Status       | Condition                        |
|--------------|----------------------------------|
| MAJOR_FLOOD  | water_level >= major threshold   |
| MINOR_FLOOD  | water_level >= minor threshold   |
| ALERT        | water_level >= alert threshold   |
| NORMAL       | water_level < alert threshold    |
| UNKNOWN      | Missing threshold data           |
| NO_DATA      | No recent readings               |

## Risk Level Mapping

| Worst Nearby Status | Risk Level |
|---------------------|------------|
| MAJOR_FLOOD         | HIGH       |
| MINOR_FLOOD         | HIGH       |
| ALERT               | MEDIUM     |
| NORMAL              | LOW        |

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

## Caching Strategy (Vercel ISR)

| Route | Cache Duration | Type |
|-------|---------------|------|
| `/api/flood` | 30 minutes | Static (ISR) |
| `/api/flood/rivers` | 24 hours | Static (ISR) |
| `/api/flood/basins` | Per-request | Dynamic (uses searchParams) |
| `/api/flood/risk` | Per-request | Dynamic (uses searchParams) |

Note: Next.js 15 requires `dynamic = 'force-static'` for route-level caching.
Dynamic routes rely on fetch-level caching via `next: { revalidate }` options.

## Map Rendering

The map uses zoom-based rendering for performance:

| Zoom Level | River Display | Stations Shown |
|------------|---------------|----------------|
| < 9 | Simplified paths | Flood-affected only |
| >= 9 | Full ArcGIS rivers | All stations |

Detailed rivers are lazy-loaded when the user zooms in.

On Vercel, ISR routes are cached at the edge and revalidated in the background after expiration. This minimizes requests to the upstream ArcGIS servers.

## Environment

No environment variables required. All data is fetched from public ArcGIS endpoints.

## Known Issues

- **React Strict Mode disabled**: Leaflet's MapContainer is incompatible with React 19's strict mode double-effect invocation. See `next.config.ts`.

## Data Source

Data is fetched from Sri Lanka Irrigation Department's public ArcGIS Feature Services:

- **gauges_2_view**: Live water levels + thresholds
- **hydrostations**: Station metadata + coordinates
- **rivers**: River polylines (3379 segments)
- **river_basins**: Basin polygons (not currently used)
- **Buffer_of_hydrostations**: Buffer zones (not currently used)

**Disclaimer**: This is an unofficial tool. Always follow official government alerts for emergency response.
