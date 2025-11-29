#!/usr/bin/env python3
"""
Fetch all flood data and display nicely.
Also generates an HTML report.
"""

from flood import get_all_stations
from datetime import datetime
from collections import defaultdict

def main():
    print("Fetching live data from Sri Lanka Irrigation Department...")
    print()

    stations = get_all_stations()

    # Group by status
    by_status = defaultdict(list)
    for s in stations:
        by_status[s["status"]].append(s)

    # Group by basin
    by_basin = defaultdict(list)
    for s in stations:
        by_basin[s["basin"].strip() or "Unknown"].append(s)

    # Sort basins by worst status
    def basin_severity(basin_name):
        statuses = [s["status"] for s in by_basin[basin_name]]
        if "MAJOR_FLOOD" in statuses: return 0
        if "MINOR_FLOOD" in statuses: return 1
        if "ALERT" in statuses: return 2
        return 3

    sorted_basins = sorted(by_basin.keys(), key=basin_severity)

    # Header
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print("=" * 70)
    print(f"  SRI LANKA FLOOD MONITORING - LIVE STATUS")
    print(f"  Generated: {now}")
    print("=" * 70)

    # Summary
    major = len(by_status.get("MAJOR_FLOOD", []))
    minor = len(by_status.get("MINOR_FLOOD", []))
    alert = len(by_status.get("ALERT", []))
    normal = len(by_status.get("NORMAL", []))

    print()
    print(f"  SUMMARY: {len(stations)} stations monitored")
    print()
    print(f"    🔴 MAJOR FLOOD:  {major:>3} stations")
    print(f"    🟠 MINOR FLOOD:  {minor:>3} stations")
    print(f"    🟡 ALERT:        {alert:>3} stations")
    print(f"    🟢 NORMAL:       {normal:>3} stations")
    print()

    # Critical stations
    if major > 0 or minor > 0:
        print("=" * 70)
        print("  ⚠️  ACTIVE FLOODING")
        print("=" * 70)

        flooding = by_status.get("MAJOR_FLOOD", []) + by_status.get("MINOR_FLOOD", [])
        flooding.sort(key=lambda x: (0 if x["status"] == "MAJOR_FLOOD" else 1, -(x["water_level"] or 0)))

        for s in flooding:
            icon = "🔴" if s["status"] == "MAJOR_FLOOD" else "🟠"
            wl = s["water_level"] or "?"
            thresh = s["thresholds"] or {}
            major_t = thresh.get("major", "?")
            updated = s["updated"][:16].replace("T", " ") if s["updated"] else "?"

            print()
            print(f"  {icon} {s['name']}")
            print(f"     Basin: {s['basin'].strip()}")
            print(f"     Water Level: {wl} m (major threshold: {major_t} m)")
            print(f"     Last Update: {updated}")

    # By Basin breakdown
    print()
    print("=" * 70)
    print("  STATUS BY RIVER BASIN")
    print("=" * 70)

    for basin in sorted_basins:
        stations_in_basin = by_basin[basin]
        statuses = [s["status"] for s in stations_in_basin]

        if "MAJOR_FLOOD" in statuses:
            basin_icon = "🔴"
        elif "MINOR_FLOOD" in statuses:
            basin_icon = "🟠"
        elif "ALERT" in statuses:
            basin_icon = "🟡"
        else:
            basin_icon = "🟢"

        print()
        print(f"  {basin_icon} {basin}")
        print(f"     " + "-" * 50)

        # Sort stations in basin by severity
        def station_severity(s):
            order = {"MAJOR_FLOOD": 0, "MINOR_FLOOD": 1, "ALERT": 2, "NORMAL": 3, "NO_DATA": 4, "UNKNOWN": 5}
            return order.get(s["status"], 9)

        for s in sorted(stations_in_basin, key=station_severity):
            status_icons = {
                "MAJOR_FLOOD": "🔴 MAJOR",
                "MINOR_FLOOD": "🟠 MINOR",
                "ALERT": "🟡 ALERT",
                "NORMAL": "🟢 OK",
                "NO_DATA": "⚪ NO DATA",
                "UNKNOWN": "❓ UNKNOWN"
            }
            wl = f"{s['water_level']:.2f}m" if s['water_level'] else "-"
            print(f"     {s['name']:<25} {status_icons.get(s['status'], s['status']):<12} {wl}")

    print()
    print("=" * 70)
    print("  Data source: Sri Lanka Irrigation Department (via ArcGIS)")
    print("  ⚠️  UNOFFICIAL - For guidance only. Follow official govt alerts.")
    print("=" * 70)

    # Generate HTML
    generate_html(stations, by_basin, sorted_basins, now, major, minor, alert, normal)


def generate_html(stations, by_basin, sorted_basins, timestamp, major, minor, alert, normal):
    flooding = [s for s in stations if s["status"] in ("MAJOR_FLOOD", "MINOR_FLOOD")]
    flooding.sort(key=lambda x: (0 if x["status"] == "MAJOR_FLOOD" else 1, -(x["water_level"] or 0)))

    html = f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sri Lanka Flood Status - Live</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }}
        h1 {{
            font-size: 1.8rem;
            margin-bottom: 5px;
            color: #fff;
        }}
        .timestamp {{ color: #64748b; margin-bottom: 20px; }}
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 12px;
            margin-bottom: 30px;
        }}
        .stat {{
            background: #1e293b;
            padding: 16px;
            border-radius: 12px;
            text-align: center;
        }}
        .stat-value {{ font-size: 2rem; font-weight: bold; }}
        .stat-label {{ font-size: 0.85rem; color: #94a3b8; margin-top: 4px; }}
        .major .stat-value {{ color: #ef4444; }}
        .minor .stat-value {{ color: #f97316; }}
        .alert .stat-value {{ color: #eab308; }}
        .normal .stat-value {{ color: #22c55e; }}

        .section {{ margin-bottom: 30px; }}
        .section-title {{
            font-size: 1.1rem;
            color: #94a3b8;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}

        .flooding-list {{ display: flex; flex-direction: column; gap: 10px; }}
        .flood-card {{
            background: #1e293b;
            border-radius: 12px;
            padding: 16px;
            border-left: 4px solid;
        }}
        .flood-card.major {{ border-color: #ef4444; }}
        .flood-card.minor {{ border-color: #f97316; }}
        .flood-card .name {{ font-weight: 600; font-size: 1.1rem; }}
        .flood-card .details {{ color: #94a3b8; margin-top: 6px; font-size: 0.9rem; }}
        .flood-card .status {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            margin-left: 8px;
        }}
        .flood-card .status.major {{ background: #450a0a; color: #fca5a5; }}
        .flood-card .status.minor {{ background: #431407; color: #fdba74; }}

        .basin-grid {{ display: flex; flex-direction: column; gap: 12px; }}
        .basin {{
            background: #1e293b;
            border-radius: 12px;
            padding: 16px;
        }}
        .basin-header {{
            font-weight: 600;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .basin-stations {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 8px;
        }}
        .station {{
            background: #0f172a;
            padding: 10px 12px;
            border-radius: 8px;
            font-size: 0.9rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .station-status {{
            font-size: 0.75rem;
            padding: 2px 6px;
            border-radius: 4px;
        }}
        .station-status.major {{ background: #450a0a; color: #fca5a5; }}
        .station-status.minor {{ background: #431407; color: #fdba74; }}
        .station-status.alert {{ background: #422006; color: #fde047; }}
        .station-status.normal {{ background: #052e16; color: #86efac; }}
        .station-status.nodata {{ background: #1e293b; color: #64748b; }}

        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #334155;
            color: #64748b;
            font-size: 0.85rem;
        }}
        .warning {{
            background: #431407;
            color: #fdba74;
            padding: 12px 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }}
    </style>
</head>
<body>
    <h1>🌊 Sri Lanka Flood Status</h1>
    <p class="timestamp">Live data as of {timestamp}</p>

    <div class="warning">
        ⚠️ UNOFFICIAL - For guidance only. Always follow official government alerts.
    </div>

    <div class="summary">
        <div class="stat major">
            <div class="stat-value">{major}</div>
            <div class="stat-label">Major Flood</div>
        </div>
        <div class="stat minor">
            <div class="stat-value">{minor}</div>
            <div class="stat-label">Minor Flood</div>
        </div>
        <div class="stat alert">
            <div class="stat-value">{alert}</div>
            <div class="stat-label">Alert</div>
        </div>
        <div class="stat normal">
            <div class="stat-value">{normal}</div>
            <div class="stat-label">Normal</div>
        </div>
    </div>
'''

    if flooding:
        html += '''
    <div class="section">
        <div class="section-title">⚠️ Active Flooding</div>
        <div class="flooding-list">
'''
        for s in flooding:
            status_class = "major" if s["status"] == "MAJOR_FLOOD" else "minor"
            status_text = "MAJOR" if s["status"] == "MAJOR_FLOOD" else "MINOR"
            wl = s["water_level"] or "?"
            thresh = s["thresholds"] or {}
            major_t = thresh.get("major", "?")
            updated = s["updated"][:16].replace("T", " ") if s["updated"] else "?"

            html += f'''
            <div class="flood-card {status_class}">
                <div class="name">{s['name']}<span class="status {status_class}">{status_text}</span></div>
                <div class="details">
                    {s['basin'].strip()} &bull;
                    Water: {wl}m (threshold: {major_t}m) &bull;
                    Updated: {updated}
                </div>
            </div>
'''
        html += '''
        </div>
    </div>
'''

    html += '''
    <div class="section">
        <div class="section-title">All River Basins</div>
        <div class="basin-grid">
'''

    for basin in sorted_basins:
        stations_in_basin = by_basin[basin]
        statuses = [s["status"] for s in stations_in_basin]

        if "MAJOR_FLOOD" in statuses:
            basin_icon = "🔴"
        elif "MINOR_FLOOD" in statuses:
            basin_icon = "🟠"
        elif "ALERT" in statuses:
            basin_icon = "🟡"
        else:
            basin_icon = "🟢"

        html += f'''
            <div class="basin">
                <div class="basin-header">{basin_icon} {basin}</div>
                <div class="basin-stations">
'''

        def station_severity(s):
            order = {"MAJOR_FLOOD": 0, "MINOR_FLOOD": 1, "ALERT": 2, "NORMAL": 3, "NO_DATA": 4, "UNKNOWN": 5}
            return order.get(s["status"], 9)

        for s in sorted(stations_in_basin, key=station_severity):
            status_class = {
                "MAJOR_FLOOD": "major",
                "MINOR_FLOOD": "minor",
                "ALERT": "alert",
                "NORMAL": "normal",
            }.get(s["status"], "nodata")

            status_short = {
                "MAJOR_FLOOD": "MAJOR",
                "MINOR_FLOOD": "MINOR",
                "ALERT": "ALERT",
                "NORMAL": "OK",
            }.get(s["status"], "—")

            wl = f"{s['water_level']:.1f}m" if s['water_level'] else ""

            html += f'''
                    <div class="station">
                        <span>{s['name']}</span>
                        <span class="station-status {status_class}">{status_short} {wl}</span>
                    </div>
'''

        html += '''
                </div>
            </div>
'''

    html += '''
        </div>
    </div>

    <div class="footer">
        <p>Data source: Sri Lanka Irrigation Department (via ArcGIS Feature Services)</p>
        <p>This is an unofficial monitoring tool. For official flood warnings, contact the Disaster Management Centre.</p>
    </div>
</body>
</html>
'''

    with open("/Users/minzi/Developer/flood-maps/flood_status.html", "w") as f:
        f.write(html)

    print()
    print(f"  📄 HTML report saved: flood_status.html")
    print(f"     Open in browser to view/share with team")


if __name__ == "__main__":
    main()
