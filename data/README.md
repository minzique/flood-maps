# Data Files

Static data files used for river path generation and station metadata.

## Files

### rivers.json

Defines 26 rivers with their basin associations and location waypoints.

```json
{
  "name": "Kelani Ganga",
  "river_basin_name": "Kelani Ganga",
  "location_names": ["Maussakelle", "Canyon", "Laxapana", "Kithulgala", ...]
}
```

### locations.json

Coordinates for 51 named locations (cities, landmarks).

```json
{
  "name": "Colombo",
  "lat_lng": [6.917275912834425, 79.86481853412485]
}
```

### gauging_stations.json

38 gauging stations with coordinates, river associations, and flood thresholds.

```json
{
  "name": "Hanwella",
  "river_name": "Kelani Ganga",
  "lat_lng": [6.910489028063102, 80.08133984391833],
  "alert_level": 7.0,
  "minor_flood_level": 8.0,
  "major_flood_level": 10.0
}
```

### station_rivers.json

GeoJSON FeatureCollection with 25 river lines connecting gauging stations.
Generated from rivers.json + locations.json + gauging_stations.json.

Used for simplified map view when zoomed out. Lines are straight connections
between station points (not actual river geometry).

### main_rivers.json

GeoJSON FeatureCollection with 124 river features from OpenStreetMap.
Queried via Overpass API with `waterway=river` filter for Sri Lanka.

Backup data source. Currently not used due to alignment issues with base map.

## Data Sources

- **Static files**: Manually curated from Sri Lanka Irrigation Department reports
- **OSM data**: OpenStreetMap via Overpass API
- **Live data**: ArcGIS Feature Services (fetched at runtime, not stored)

## Updating Data

To regenerate station_rivers.json:

```bash
python3 << 'EOF'
import json

with open('data/rivers.json') as f:
    rivers = json.load(f)
with open('data/gauging_stations.json') as f:
    stations = json.load(f)
with open('data/locations.json') as f:
    locations = json.load(f)

# ... generation logic in lib/flood-data.ts comments
EOF
```

## Known Limitations

1. Station-based river paths are straight-line approximations
2. OSM river data may not align with CartoDB base tiles
3. Some stations may have outdated threshold values
