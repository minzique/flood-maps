#!/usr/bin/env python3
import math
import sys
import requests
from datetime import datetime, timezone

# arcgis layer endpoints (from the dashboard)
HYDROSTATIONS_URL = "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/hydrostations/FeatureServer/0/query"
GAUGES_URL = "https://services3.arcgis.com/J7ZFXmR8rSmQ3FGf/arcgis/rest/services/gauges_2_view/FeatureServer/0/query"

# join config:
# hydrostations uses "station", gauges_2_view uses "gauge"
STATION_JOIN_FIELD = "station"
GAUGES_JOIN_FIELD = "gauge"

# field names on gauges_2_view – tweak if they differ
FIELD_WATER_LEVEL = "water_level"
FIELD_ALERT = "alertpull"
FIELD_MINOR = "minorpull"
FIELD_MAJOR = "majorpull"
FIELD_RAIN = "rain_fall"
FIELD_TIME = "CreationDate"


def haversine(lat1, lon1, lat2, lon2):
    """distance in km between two lat/lon points."""
    r = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c


def fetch_hydrostations():
    params = {
        "f": "json",
        "where": "1=1",
        "outFields": "*",
        "returnGeometry": "true",
        "outSR": "4326",
    }
    resp = requests.get(HYDROSTATIONS_URL, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    features = data.get("features", [])
    if not features:
        raise RuntimeError("no hydrostations returned, check url / params")

    return features


def find_nearest_station(features, lat, lon):
    best = None
    best_dist = None

    for f in features:
        geom = f.get("geometry") or {}
        attrs = f.get("attributes") or {}

        x = geom.get("x")
        y = geom.get("y")
        if x is None or y is None:
            continue  # skip broken geometries

        d = haversine(lat, lon, y, x)
        if best is None or d < best_dist:
            best = {"feature": f, "dist_km": d}
            best_dist = d

    if not best:
        raise RuntimeError("could not compute nearest station")

    return best


def find_nearest_stations(features, lat, lon, n=3):
    """Return the n nearest stations sorted by distance."""
    results = []

    for f in features:
        geom = f.get("geometry") or {}
        x = geom.get("x")
        y = geom.get("y")
        if x is None or y is None:
            continue

        d = haversine(lat, lon, y, x)
        results.append({"feature": f, "dist_km": d})

    results.sort(key=lambda r: r["dist_km"])
    return results[:n]


def fetch_latest_gauge(join_value):
    # last 24h, ordered newest first, 1 row
    where = f"{GAUGES_JOIN_FIELD} = '{join_value}' AND {FIELD_TIME} BETWEEN CURRENT_TIMESTAMP - 24 AND CURRENT_TIMESTAMP"

    params = {
        "f": "json",
        "where": where,
        "outFields": "*",
        "orderByFields": f"{FIELD_TIME} DESC",
        "resultRecordCount": 1,
        "returnGeometry": "false",
    }
    resp = requests.get(GAUGES_URL, params=params, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    feats = data.get("features", [])
    if not feats:
        return None
    return feats[0]["attributes"]


def classify_status(attrs):
    wl = attrs.get(FIELD_WATER_LEVEL)
    alert = attrs.get(FIELD_ALERT)
    minor = attrs.get(FIELD_MINOR)
    major = attrs.get(FIELD_MAJOR)

    if wl is None or alert is None or minor is None or major is None:
        return "UNKNOWN"

    try:
        wl = float(wl)
        alert = float(alert)
        minor = float(minor)
        major = float(major)
    except (TypeError, ValueError):
        return "UNKNOWN"

    if wl < alert:
        return "NORMAL"
    elif wl < minor:
        return "ALERT"
    elif wl < major:
        return "MINOR_FLOOD"
    else:
        return "MAJOR_FLOOD"


def parse_arcgis_timestamp(ms):
    # arcgis stores epoch ms (usually utc)
    try:
        ms = int(ms)
        return datetime.fromtimestamp(ms / 1000, tz=timezone.utc)
    except Exception:
        return None


def main():
    if len(sys.argv) != 3:
        print("usage: python flood_lookup.py <lat> <lon>")
        print("example: python flood_lookup.py 6.9271 79.8612")
        sys.exit(1)

    lat = float(sys.argv[1])
    lon = float(sys.argv[2])

    print(f"→ checking flood status for lat={lat}, lon={lon}")

    stations = fetch_hydrostations()
    nearest_list = find_nearest_stations(stations, lat, lon, n=5)

    print()
    print("=" * 60)
    print("NEARBY STATIONS (closest 5)")
    print("=" * 60)

    any_flooding = False
    results = []

    for item in nearest_list:
        f = item["feature"]
        dist_km = item["dist_km"]
        attrs = f.get("attributes") or {}

        station_name = attrs.get("station") or attrs.get("gauge") or "?"
        basin = attrs.get("basin") or attrs.get("Tributory") or "?"
        join_value = attrs.get(STATION_JOIN_FIELD)

        if not join_value:
            continue

        gauge_attrs = fetch_latest_gauge(join_value)
        if not gauge_attrs:
            status = "NO DATA"
            wl = "-"
        else:
            status = classify_status(gauge_attrs)
            wl = gauge_attrs.get(FIELD_WATER_LEVEL, "-")

        if status in ("ALERT", "MINOR_FLOOD", "MAJOR_FLOOD"):
            any_flooding = True

        results.append({
            "name": station_name,
            "basin": basin,
            "dist_km": dist_km,
            "status": status,
            "water_level": wl,
        })

        status_icon = {
            "NORMAL": "✓",
            "ALERT": "⚠",
            "MINOR_FLOOD": "🟠",
            "MAJOR_FLOOD": "🔴",
        }.get(status, "?")

        print(f"\n{station_name} ({basin})")
        print(f"  {dist_km:.1f} km away | {status_icon} {status} | water level: {wl}")

    print()
    print("=" * 60)
    print("ASSESSMENT")
    print("=" * 60)

    # Check if any station within 10km is flooding
    nearby_flooding = [r for r in results if r["dist_km"] <= 10 and r["status"] in ("MINOR_FLOOD", "MAJOR_FLOOD")]
    nearby_alert = [r for r in results if r["dist_km"] <= 10 and r["status"] == "ALERT"]

    if nearby_flooding:
        print()
        print("⚠️  FLOOD WARNING: Active flooding at stations within 10km:")
        for r in nearby_flooding:
            print(f"   - {r['name']}: {r['status']} ({r['dist_km']:.1f} km)")
        print()
        print("   Check if you are near the river/waterway. If yes, stay alert.")
    elif nearby_alert:
        print()
        print("⚠️  ALERT: Elevated water levels at stations within 10km:")
        for r in nearby_alert:
            print(f"   - {r['name']}: {r['status']} ({r['dist_km']:.1f} km)")
        print()
        print("   Monitor the situation. May escalate.")
    else:
        print()
        print("✓  No flooding detected at nearby stations (within 10km).")
        if any_flooding:
            print("   Note: Flooding exists at more distant stations.")


if __name__ == "__main__":
    main()
