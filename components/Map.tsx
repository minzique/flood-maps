'use client'

import { useEffect, useState, useMemo } from 'react'
import {
    MapContainer,
    TileLayer,
    CircleMarker,
    Popup,
    GeoJSON,
    useMapEvents,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Station, FloodStatus, GeoJSONFeatureCollection } from '@/types'
import { STATUS_COLORS } from '@/types'
import type { PathOptions } from 'leaflet'
import type { Feature, Geometry } from 'geojson'

interface MapProps {
    stations: Station[]
}

// Zoom threshold for switching between simplified and detailed view
const ZOOM_THRESHOLD = 9

function getMarkerRadius(status: FloodStatus, zoomLevel: number): number {
    // Larger markers when zoomed out for visibility
    const baseSize = zoomLevel < ZOOM_THRESHOLD ? 1.5 : 1
    switch (status) {
        case 'MAJOR_FLOOD':
            return 12 * baseSize
        case 'MINOR_FLOOD':
            return 10 * baseSize
        case 'ALERT':
            return 8 * baseSize
        default:
            return 6 * baseSize
    }
}

// Style function for flooded river lines
function getFloodedRiverStyle(feature: Feature<Geometry, { status?: FloodStatus }> | undefined, isZoomedOut: boolean): PathOptions {
    const status = feature?.properties?.status
    const color = status ? STATUS_COLORS[status] : STATUS_COLORS.UNKNOWN
    return {
        color: color,
        weight: isZoomedOut ? 4 : 3, // Thicker lines when zoomed out
        opacity: isZoomedOut ? 0.9 : 0.85,
    }
}

interface FloodedRiversData {
    geojson: GeoJSONFeatureCollection
}

// Component to track zoom level
function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
    useMapEvents({
        zoomend: (e) => {
            onZoomChange(e.target.getZoom())
        },
    })
    return null
}

export default function Map({ stations }: MapProps) {
    const [simplifiedRivers, setSimplifiedRivers] = useState<GeoJSONFeatureCollection | null>(null)
    const [detailedRivers, setDetailedRivers] = useState<GeoJSONFeatureCollection | null>(null)
    const [loading, setLoading] = useState(true)
    const [zoomLevel, setZoomLevel] = useState(8)

    const isZoomedOut = zoomLevel < ZOOM_THRESHOLD

    // Fetch simplified rivers (main channels only) - for zoomed-out view
    useEffect(() => {
        fetch('/api/flood/basins?simplified=true')
            .then((res) => res.json())
            .then((data: FloodedRiversData) => {
                if (data.geojson?.type === 'FeatureCollection') {
                    setSimplifiedRivers(data.geojson)
                }
            })
            .catch((err) => console.error('Failed to load simplified rivers:', err))
            .finally(() => setLoading(false))
    }, [])

    // Fetch detailed rivers when zoomed in (lazy load)
    useEffect(() => {
        if (!isZoomedOut && !detailedRivers) {
            fetch('/api/flood/basins')
                .then((res) => res.json())
                .then((data: FloodedRiversData) => {
                    if (data.geojson?.type === 'FeatureCollection') {
                        setDetailedRivers(data.geojson)
                    }
                })
                .catch((err) => console.error('Failed to load detailed rivers:', err))
        }
    }, [isZoomedOut, detailedRivers])

    // Select which rivers to display based on zoom level
    const visibleRivers = isZoomedOut ? simplifiedRivers : (detailedRivers || simplifiedRivers)

    // Filter stations for zoomed-out view (only show flood-affected)
    const visibleStations = useMemo(() => {
        if (isZoomedOut) {
            // Show only stations with alert or worse status
            return stations.filter(
                (s) => s.status === 'MAJOR_FLOOD' || s.status === 'MINOR_FLOOD' || s.status === 'ALERT'
            )
        }
        return stations
    }, [stations, isZoomedOut])

    // Create style function with zoom awareness
    const riverStyleFn = useMemo(() => {
        return (feature: Feature<Geometry, { status?: FloodStatus }> | undefined) =>
            getFloodedRiverStyle(feature, isZoomedOut)
    }, [isZoomedOut])

    // Center of Sri Lanka
    const center: [number, number] = [7.8731, 80.7718]

    return (
        <MapContainer
            center={center}
            zoom={8}
            scrollWheelZoom={true}
            className="h-full w-full rounded-xl z-0"
        >
            <ZoomTracker onZoomChange={setZoomLevel} />

            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {/* River Lines - simplified when zoomed out, detailed when zoomed in */}
            {visibleRivers && (
                <GeoJSON
                    key={`rivers-${visibleRivers.features.length}-${isZoomedOut}`}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data={visibleRivers as any}
                    style={riverStyleFn}
                />
            )}

            {/* Loading indicator */}
            {loading && (
                <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm text-foreground text-xs px-3 py-1.5 rounded-lg border border-border shadow-sm">
                    Loading flood data...
                </div>
            )}

            {/* Zoom hint */}
            {isZoomedOut && !loading && visibleRivers && visibleRivers.features.length > 0 && (
                <div className="absolute bottom-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm text-slate-600 text-xs px-3 py-1.5 rounded-lg border border-border shadow-sm">
                    Zoom in for detailed river view
                </div>
            )}

            {/* Station Markers */}
            {visibleStations.map((station) => {
                if (station.lat == null || station.lon == null) return null

                const color = STATUS_COLORS[station.status]
                const radius = getMarkerRadius(station.status, zoomLevel)

                return (
                    <CircleMarker
                        key={station.name}
                        center={[station.lat, station.lon]}
                        radius={radius}
                        pathOptions={{
                            color: '#fff',
                            fillColor: color,
                            fillOpacity: 0.9,
                            weight: 2,
                        }}
                    >
                        <Popup>
                            <div className="p-1 min-w-[150px]">
                                <h3 className="font-bold text-sm mb-1 text-slate-900">
                                    {station.name}
                                </h3>
                                <p className="text-xs text-slate-600 m-0">
                                    <strong>Basin:</strong> {station.basin}
                                </p>
                                <p className="text-xs text-slate-600 m-0">
                                    <strong>Status:</strong>{' '}
                                    <span style={{ color }}>{station.status.replace('_', ' ')}</span>
                                </p>
                                <p className="text-xs text-slate-600 m-0">
                                    <strong>Level:</strong> {station.water_level?.toFixed(2) ?? '-'} m
                                </p>
                                {station.thresholds && (
                                    <p className="text-xs text-slate-500 m-0 mt-1">
                                        Alert: {station.thresholds.alert}m | Minor:{' '}
                                        {station.thresholds.minor}m | Major: {station.thresholds.major}m
                                    </p>
                                )}
                                {station.updated && (
                                    <p className="text-xs text-slate-400 m-0 mt-1">
                                        Updated:{' '}
                                        {new Date(station.updated).toLocaleString([], {
                                            dateStyle: 'short',
                                            timeStyle: 'short',
                                        })}
                                    </p>
                                )}
                            </div>
                        </Popup>
                    </CircleMarker>
                )
            })}
        </MapContainer>
    )
}
