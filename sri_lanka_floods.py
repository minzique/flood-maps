"""
sri_lanka_floods.py - Complete flood monitoring for Sri Lanka

Data source: Sri Lanka Irrigation Department (public ArcGIS Feature Services)

Usage:
    from sri_lanka_floods import (
        get_all_stations,      # all stations + current status
        check_risk,            # lat/lon -> risk assessment
        get_rivers_geojson,    # river lines as GeoJSON
        generate_map_html,     # full interactive map
    )

Endpoints (from govt dashboard):
    - gauges_2_view:     live water levels + thresholds
    - hydrostations:     station metadata + coords
    - rivers:            river polylines (3379 segments)
    - river_basins:      basin polygons
    - Buffer_of_hydrostations: buffer zones around stations
"""

import math
import json
import requests
from datetime import datetime, timezone
from typing import Optional

# =============================================================================
# ArcGIS Feature Service URLs
# =============================================================================

BASE = "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services"

URLS = {
    "gauges": f"{BASE}/gauges_2_view/FeatureServer/0/query",
    "stations": f"{BASE}/hydrostations/FeatureServer/0/query",
    "rivers": f"{BASE}/rivers/FeatureServer/0/query",
    "basins": f"{BASE}/river_basins/FeatureServer/0/query",
    "buffers": f"{BASE}/Buffer_of_hydrostations/FeatureServer/0/query",
}

# =============================================================================
# Helpers
# =============================================================================

def _haversine(lat1, lon1, lat2, lon2):
    """Distance in km between two lat/lon points."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def _classify(wl, alert, minor, major):
    """Classify flood status from water level and thresholds."""
    try:
        wl, alert, minor, major = float(wl), float(alert), float(minor), float(major)
    except (TypeError, ValueError):
        return "UNKNOWN"
    if wl < alert: return "NORMAL"
    if wl < minor: return "ALERT"
    if wl < major: return "MINOR_FLOOD"
    return "MAJOR_FLOOD"


def _parse_timestamp(ms):
    """Convert ArcGIS epoch ms to ISO string."""
    if not ms:
        return None
    try:
        return datetime.fromtimestamp(int(ms)/1000, tz=timezone.utc).isoformat()
    except:
        return None


# =============================================================================
# Data Fetching
# =============================================================================

def _fetch_stations():
    """Fetch all hydrostations with coords."""
    r = requests.get(URLS["stations"], params={
        "f": "json", "where": "1=1", "outFields": "*",
        "returnGeometry": "true", "outSR": "4326"
    }, timeout=15)
    r.raise_for_status()
    return r.json().get("features", [])


def _fetch_latest_readings():
    """Fetch latest reading per gauge (last 24h)."""
    r = requests.get(URLS["gauges"], params={
        "f": "json",
        "where": "CreationDate BETWEEN CURRENT_TIMESTAMP - 24 AND CURRENT_TIMESTAMP",
        "outFields": "*",
        "orderByFields": "CreationDate DESC",
        "resultRecordCount": 8000,
        "returnGeometry": "false"
    }, timeout=15)
    r.raise_for_status()

    latest = {}
    for f in r.json().get("features", []):
        a = f.get("attributes", {})
        g = a.get("gauge")
        if g and g not in latest:
            latest[g] = a
    return latest


def _fetch_rivers_paginated():
    """Fetch all river polylines (paginated)."""
    all_features = []
    offset = 0
    batch = 1000

    while True:
        r = requests.get(URLS["rivers"], params={
            "f": "json", "where": "1=1", "outFields": "FID",
            "returnGeometry": "true", "outSR": "4326",
            "resultOffset": offset, "resultRecordCount": batch
        }, timeout=30)
        r.raise_for_status()
        features = r.json().get("features", [])
        if not features:
            break
        all_features.extend(features)
        if len(features) < batch:
            break
        offset += batch

    return all_features


# =============================================================================
# Public API
# =============================================================================

def get_all_stations() -> list[dict]:
    """
    Get all stations with current flood status.

    Returns:
        [
            {
                "name": "Hanwella",
                "basin": "Kelani Ganga",
                "lat": 6.909,
                "lon": 80.083,
                "status": "MAJOR_FLOOD",  # MAJOR_FLOOD | MINOR_FLOOD | ALERT | NORMAL | NO_DATA | UNKNOWN
                "water_level": 10.81,
                "thresholds": {"alert": 7.5, "minor": 9, "major": 10},
                "updated": "2025-11-29T09:39:05+00:00"
            },
            ...
        ]
    """
    stations = _fetch_stations()
    readings = _fetch_latest_readings()

    result = []
    for s in stations:
        attrs = s.get("attributes", {})
        geom = s.get("geometry", {})
        name = attrs.get("station", "")

        if not name or geom.get("x") is None:
            continue

        reading = readings.get(name, {})
        wl = reading.get("water_level")
        status = _classify(
            wl,
            reading.get("alertpull"),
            reading.get("minorpull"),
            reading.get("majorpull")
        ) if reading else "NO_DATA"

        result.append({
            "name": name,
            "basin": (attrs.get("basin") or "").strip(),
            "lat": geom.get("y"),
            "lon": geom.get("x"),
            "status": status,
            "water_level": wl,
            "thresholds": {
                "alert": reading.get("alertpull"),
                "minor": reading.get("minorpull"),
                "major": reading.get("majorpull"),
            } if reading else None,
            "updated": _parse_timestamp(reading.get("CreationDate"))
        })

    return result


def check_risk(lat: float, lon: float, radius_km: float = 15) -> dict:
    """
    Check flood risk for a location.

    Args:
        lat: Latitude
        lon: Longitude
        radius_km: Search radius (default 15km)

    Returns:
        {
            "lat": 6.85,
            "lon": 80.03,
            "risk_level": "HIGH",  # HIGH | MEDIUM | LOW | UNKNOWN
            "summary": "MAJOR_FLOOD at Hanwella (8.5 km away)",
            "nearby": [...],  # up to 5 closest stations
            "advice": "Active flooding detected nearby..."
        }
    """
    stations = get_all_stations()

    nearby = []
    for s in stations:
        if s["lat"] is None or s["lon"] is None:
            continue
        dist = _haversine(lat, lon, s["lat"], s["lon"])
        if dist <= radius_km:
            nearby.append({**s, "distance_km": round(dist, 1)})

    nearby.sort(key=lambda x: x["distance_km"])

    # Find worst status nearby
    worst_status = "NORMAL"
    worst_station = None

    for s in nearby:
        st = s["status"]
        if st == "MAJOR_FLOOD":
            worst_status = "MAJOR_FLOOD"
            worst_station = s
            break
        elif st == "MINOR_FLOOD" and worst_status not in ("MAJOR_FLOOD",):
            worst_status = "MINOR_FLOOD"
            worst_station = s
        elif st == "ALERT" and worst_status == "NORMAL":
            worst_status = "ALERT"
            worst_station = s

    risk_map = {"MAJOR_FLOOD": "HIGH", "MINOR_FLOOD": "HIGH", "ALERT": "MEDIUM", "NORMAL": "LOW"}
    risk_level = risk_map.get(worst_status, "UNKNOWN")

    if worst_station:
        summary = f"{worst_station['status']} at {worst_station['name']} ({worst_station['distance_km']} km away)"
        basin = worst_station.get("basin") or "the river"
        if risk_level == "HIGH":
            advice = f"Active flooding detected nearby. If you are near {basin}, move to higher ground and follow official alerts."
        else:
            advice = f"Elevated water levels at {worst_station['name']}. Monitor the situation."
    else:
        summary = "No flood alerts within search radius"
        advice = "No immediate flood risk detected from monitored rivers. Stay aware of local conditions."

    return {
        "lat": lat,
        "lon": lon,
        "risk_level": risk_level,
        "summary": summary,
        "nearby": nearby[:5],
        "advice": advice
    }


def get_rivers_geojson() -> dict:
    """
    Get all river lines as GeoJSON FeatureCollection.

    Returns:
        {
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "geometry": {"type": "LineString", "coordinates": [...]}, ...},
                ...
            ]
        }
    """
    features = _fetch_rivers_paginated()

    geojson = {"type": "FeatureCollection", "features": []}

    for f in features:
        paths = f.get("geometry", {}).get("paths", [])
        for path in paths:
            geojson["features"].append({
                "type": "Feature",
                "properties": {"fid": f.get("attributes", {}).get("FID")},
                "geometry": {"type": "LineString", "coordinates": path}
            })

    return geojson


def get_flooding_summary() -> dict:
    """
    Get a quick summary of current flooding.

    Returns:
        {
            "total_stations": 42,
            "major_flood": 8,
            "minor_flood": 5,
            "alert": 4,
            "normal": 16,
            "flooding_stations": [
                {"name": "Hanwella", "basin": "Kelani Ganga", "status": "MAJOR_FLOOD", "water_level": 10.81},
                ...
            ],
            "affected_basins": ["Kelani Ganga", "Kalu Ganga", ...]
        }
    """
    stations = get_all_stations()

    by_status = {}
    for s in stations:
        by_status.setdefault(s["status"], []).append(s)

    flooding = by_status.get("MAJOR_FLOOD", []) + by_status.get("MINOR_FLOOD", [])
    flooding.sort(key=lambda x: (0 if x["status"] == "MAJOR_FLOOD" else 1, -(x["water_level"] or 0)))

    affected_basins = list(set(s["basin"] for s in flooding if s["basin"]))

    return {
        "total_stations": len(stations),
        "major_flood": len(by_status.get("MAJOR_FLOOD", [])),
        "minor_flood": len(by_status.get("MINOR_FLOOD", [])),
        "alert": len(by_status.get("ALERT", [])),
        "normal": len(by_status.get("NORMAL", [])),
        "flooding_stations": [
            {"name": s["name"], "basin": s["basin"], "status": s["status"], "water_level": s["water_level"]}
            for s in flooding
        ],
        "affected_basins": affected_basins
    }


def generate_map_html(output_path: str = "flood_map.html") -> str:
    """
    Generate an interactive Leaflet map with rivers and stations.

    Args:
        output_path: Where to save the HTML file

    Returns:
        Path to the generated file
    """
    print("Fetching station data...")
    stations = get_all_stations()

    print("Fetching river lines (this may take a moment)...")
    rivers = get_rivers_geojson()

    print(f"Generating map with {len(stations)} stations and {len(rivers['features'])} river segments...")

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
        .info {{ background: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); max-width: 300px; }}
        .info h4 {{ margin: 0 0 8px 0; font-size: 14px; }}
        .legend {{ background: white; padding: 12px 16px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); line-height: 24px; }}
        .legend-item {{ display: flex; align-items: center; gap: 8px; }}
        .legend-dot {{ width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }}
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        const map = L.map('map').setView([7.8731, 80.7718], 8);
        L.tileLayer('https://{{s}}.basemaps.cartocdn.com/dark_all/{{z}}/{{x}}/{{y}}{{r}}.png', {{
            attribution: '&copy; OpenStreetMap, &copy; CARTO', maxZoom: 19
        }}).addTo(map);

        const rivers = {json.dumps(rivers)};
        L.geoJSON(rivers, {{ style: {{ color: '#3b82f6', weight: 1.5, opacity: 0.6 }} }}).addTo(map);

        const stations = {json.dumps(stations)};

        function getColor(status) {{
            return {{'MAJOR_FLOOD': '#dc2626', 'MINOR_FLOOD': '#ea580c', 'ALERT': '#eab308', 'NORMAL': '#22c55e'}}[status] || '#6b7280';
        }}
        function getRadius(status) {{
            return {{'MAJOR_FLOOD': 12, 'MINOR_FLOOD': 10, 'ALERT': 8}}[status] || 6;
        }}

        stations.forEach(s => {{
            if (!s.lat || !s.lon) return;
            const updated = s.updated ? s.updated.substring(0, 16).replace('T', ' ') : 'N/A';
            L.circleMarker([s.lat, s.lon], {{
                radius: getRadius(s.status), fillColor: getColor(s.status),
                color: '#fff', weight: 2, opacity: 1, fillOpacity: 0.9
            }}).bindPopup(`<div class="info"><h4>${{s.name}}</h4><p><b>Basin:</b> ${{s.basin}}<br><b>Status:</b> ${{s.status}}<br><b>Water:</b> ${{s.water_level || 'N/A'}}m<br><b>Updated:</b> ${{updated}}</p></div>`).addTo(map);
        }});

        const legend = L.control({{position: 'bottomright'}});
        legend.onAdd = () => {{
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML = '<b>Status</b><br><div class="legend-item"><div class="legend-dot" style="background:#dc2626"></div>Major</div><div class="legend-item"><div class="legend-dot" style="background:#ea580c"></div>Minor</div><div class="legend-item"><div class="legend-dot" style="background:#eab308"></div>Alert</div><div class="legend-item"><div class="legend-dot" style="background:#22c55e"></div>Normal</div>';
            return div;
        }};
        legend.addTo(map);

        const title = L.control({{position: 'topleft'}});
        title.onAdd = () => {{
            const div = L.DomUtil.create('div', 'info');
            const n = stations.filter(s => s.status === 'MAJOR_FLOOD' || s.status === 'MINOR_FLOOD').length;
            div.innerHTML = '<h4>🌊 Sri Lanka Flood Monitor</h4><div style="color:#666;font-size:12px">Live from Irrigation Dept</div><div style="margin-top:8px"><b style="color:#dc2626">' + n + ' stations flooding</b></div><div style="margin-top:8px;padding:8px;background:#fef3c7;border-radius:4px;font-size:11px;color:#92400e">⚠️ Unofficial - Follow govt alerts</div>';
            return div;
        }};
        title.addTo(map);
    </script>
</body>
</html>'''

    with open(output_path, "w") as f:
        f.write(html)

    print(f"Map saved to: {output_path}")
    return output_path


# =============================================================================
# CLI
# =============================================================================

if __name__ == "__main__":
    import sys

    if len(sys.argv) == 1:
        # Show summary
        print("Fetching current flood status...\n")
        summary = get_flooding_summary()
        print(f"Sri Lanka Flood Status")
        print(f"=" * 40)
        print(f"Total stations: {summary['total_stations']}")
        print(f"🔴 Major flood: {summary['major_flood']}")
        print(f"🟠 Minor flood: {summary['minor_flood']}")
        print(f"🟡 Alert: {summary['alert']}")
        print(f"🟢 Normal: {summary['normal']}")
        print()
        if summary['flooding_stations']:
            print("Currently flooding:")
            for s in summary['flooding_stations']:
                icon = "🔴" if s['status'] == "MAJOR_FLOOD" else "🟠"
                print(f"  {icon} {s['name']} ({s['basin']}): {s['water_level']}m")
        print()
        print("Commands:")
        print("  python sri_lanka_floods.py <lat> <lon>  - check risk for location")
        print("  python sri_lanka_floods.py --map       - generate interactive map")

    elif sys.argv[1] == "--map":
        generate_map_html()

    elif len(sys.argv) == 3:
        lat, lon = float(sys.argv[1]), float(sys.argv[2])
        print(json.dumps(check_risk(lat, lon), indent=2))

    else:
        print("Usage:")
        print("  python sri_lanka_floods.py              - show current status")
        print("  python sri_lanka_floods.py <lat> <lon>  - check risk for location")
        print("  python sri_lanka_floods.py --map        - generate interactive map")
