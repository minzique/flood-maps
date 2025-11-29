#!/usr/bin/env python3
"""
Generate an interactive flood map with rivers and stations.
"""

import json
import requests
from flood import get_all_stations

RIVERS_URL = "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/rivers/FeatureServer/0/query"

def fetch_rivers():
    """Fetch all river polylines."""
    print("  Fetching river lines (3379 segments)...")

    all_features = []
    offset = 0
    batch_size = 1000

    while True:
        r = requests.get(RIVERS_URL, params={
            "f": "json",
            "where": "1=1",
            "outFields": "FID",
            "returnGeometry": "true",
            "outSR": "4326",
            "resultOffset": offset,
            "resultRecordCount": batch_size
        }, timeout=30)
        r.raise_for_status()
        data = r.json()
        features = data.get("features", [])

        if not features:
            break

        all_features.extend(features)
        print(f"    Fetched {len(all_features)} river segments...")

        if len(features) < batch_size:
            break
        offset += batch_size

    # Convert to GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "features": []
    }

    for f in all_features:
        geom = f.get("geometry", {})
        paths = geom.get("paths", [])

        if not paths:
            continue

        # ArcGIS paths to GeoJSON coordinates
        for path in paths:
            geojson["features"].append({
                "type": "Feature",
                "properties": {"fid": f.get("attributes", {}).get("FID")},
                "geometry": {
                    "type": "LineString",
                    "coordinates": path
                }
            })

    return geojson


def generate_map():
    print("Generating interactive flood map...")
    print()

    # Fetch data
    print("  Fetching station data...")
    stations = get_all_stations()
    rivers = fetch_rivers()

    # Separate stations by status
    flooding_stations = [s for s in stations if s["status"] in ("MAJOR_FLOOD", "MINOR_FLOOD")]
    alert_stations = [s for s in stations if s["status"] == "ALERT"]
    normal_stations = [s for s in stations if s["status"] == "NORMAL"]

    print(f"  {len(stations)} stations, {len(rivers['features'])} river segments")
    print()

    html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sri Lanka Flood Map - Live</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        * {{ margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
        #map {{ height: 100vh; width: 100%; }}
        .info {{
            background: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            max-width: 300px;
        }}
        .info h4 {{ margin: 0 0 8px 0; font-size: 14px; }}
        .legend {{
            background: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            line-height: 24px;
        }}
        .legend-item {{ display: flex; align-items: center; gap: 8px; }}
        .legend-dot {{
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }}
        .popup-major {{ color: #dc2626; font-weight: bold; }}
        .popup-minor {{ color: #ea580c; font-weight: bold; }}
        .popup-alert {{ color: #ca8a04; }}
        .popup-normal {{ color: #16a34a; }}
    </style>
</head>
<body>
    <div id="map"></div>

    <script>
        // Initialize map centered on Sri Lanka
        const map = L.map('map').setView([7.8731, 80.7718], 8);

        // Dark tile layer
        L.tileLayer('https://{{s}}.basemaps.cartocdn.com/dark_all/{{z}}/{{x}}/{{y}}{{r}}.png', {{
            attribution: '&copy; OpenStreetMap, &copy; CARTO',
            maxZoom: 19
        }}).addTo(map);

        // River lines
        const rivers = {json.dumps(rivers)};

        L.geoJSON(rivers, {{
            style: {{
                color: '#3b82f6',
                weight: 1.5,
                opacity: 0.6
            }}
        }}).addTo(map);

        // Station data
        const stations = {json.dumps(stations)};

        // Color by status
        function getColor(status) {{
            switch(status) {{
                case 'MAJOR_FLOOD': return '#dc2626';
                case 'MINOR_FLOOD': return '#ea580c';
                case 'ALERT': return '#eab308';
                case 'NORMAL': return '#22c55e';
                default: return '#6b7280';
            }}
        }}

        function getRadius(status) {{
            switch(status) {{
                case 'MAJOR_FLOOD': return 12;
                case 'MINOR_FLOOD': return 10;
                case 'ALERT': return 8;
                default: return 6;
            }}
        }}

        // Add station markers
        stations.forEach(s => {{
            if (!s.lat || !s.lon) return;

            const color = getColor(s.status);
            const radius = getRadius(s.status);

            const statusClass = {{
                'MAJOR_FLOOD': 'popup-major',
                'MINOR_FLOOD': 'popup-minor',
                'ALERT': 'popup-alert',
                'NORMAL': 'popup-normal'
            }}[s.status] || '';

            const thresholds = s.thresholds ?
                `<br>Thresholds: alert ${{s.thresholds.alert}}m, minor ${{s.thresholds.minor}}m, major ${{s.thresholds.major}}m` : '';

            const updated = s.updated ? s.updated.substring(0, 16).replace('T', ' ') : 'N/A';

            L.circleMarker([s.lat, s.lon], {{
                radius: radius,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.9
            }})
            .bindPopup(`
                <div class="info">
                    <h4>${{s.name}}</h4>
                    <p><strong>Basin:</strong> ${{s.basin}}</p>
                    <p><strong>Status:</strong> <span class="${{statusClass}}">${{s.status}}</span></p>
                    <p><strong>Water Level:</strong> ${{s.water_level || 'N/A'}}m${{thresholds}}</p>
                    <p><strong>Updated:</strong> ${{updated}}</p>
                </div>
            `)
            .addTo(map);
        }});

        // Legend
        const legend = L.control({{position: 'bottomright'}});
        legend.onAdd = function(map) {{
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 8px;">Flood Status</div>
                <div class="legend-item"><div class="legend-dot" style="background: #dc2626;"></div> Major Flood</div>
                <div class="legend-item"><div class="legend-dot" style="background: #ea580c;"></div> Minor Flood</div>
                <div class="legend-item"><div class="legend-dot" style="background: #eab308;"></div> Alert</div>
                <div class="legend-item"><div class="legend-dot" style="background: #22c55e;"></div> Normal</div>
                <div style="margin-top: 8px; border-top: 1px solid #ddd; padding-top: 8px;">
                    <div class="legend-item"><div style="width: 20px; height: 3px; background: #3b82f6;"></div> Rivers</div>
                </div>
            `;
            return div;
        }};
        legend.addTo(map);

        // Title
        const title = L.control({{position: 'topleft'}});
        title.onAdd = function(map) {{
            const div = L.DomUtil.create('div', 'info');
            const floodCount = stations.filter(s => s.status === 'MAJOR_FLOOD' || s.status === 'MINOR_FLOOD').length;
            div.innerHTML = `
                <h4 style="font-size: 16px; margin-bottom: 4px;">🌊 Sri Lanka Flood Monitor</h4>
                <div style="color: #666; font-size: 12px;">Live data from Irrigation Dept</div>
                <div style="margin-top: 8px; font-size: 13px;">
                    <strong style="color: #dc2626;">${{floodCount}} stations flooding</strong>
                </div>
                <div style="margin-top: 8px; padding: 8px; background: #fef3c7; border-radius: 4px; font-size: 11px; color: #92400e;">
                    ⚠️ Unofficial - Follow govt alerts
                </div>
            `;
            return div;
        }};
        title.addTo(map);
    </script>
</body>
</html>
'''

    with open("/Users/minzi/Developer/flood-maps/flood_map.html", "w") as f:
        f.write(html)

    print("  ✅ Map saved: flood_map.html")
    print("     Opening in browser...")


if __name__ == "__main__":
    generate_map()
