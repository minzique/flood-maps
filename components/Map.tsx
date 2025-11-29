'use client'

import { useEffect, useState } from 'react'
import {
    MapContainer,
    TileLayer,
    CircleMarker,
    Popup,
    GeoJSON,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Station, FloodStatus, GeoJSONFeatureCollection } from '@/types'
import { STATUS_COLORS } from '@/types'
import type { PathOptions } from 'leaflet'
import type { Feature, Geometry } from 'geojson'

interface MapProps {
    stations: Station[]
}

function getMarkerRadius(status: FloodStatus): number {
    switch (status) {
        case 'MAJOR_FLOOD':
            return 12
        case 'MINOR_FLOOD':
            return 10
        case 'ALERT':
            return 8
        default:
            return 6
    }
}

// Style function for flooded river lines
function getFloodedRiverStyle(feature: Feature<Geometry, { status?: FloodStatus }> | undefined): PathOptions {
    const status = feature?.properties?.status
    const color = status ? STATUS_COLORS[status] : STATUS_COLORS.UNKNOWN
    return {
        color: color,
        weight: 3,
        opacity: 0.85,
    }
}

interface FloodedRiversData {
    geojson: GeoJSONFeatureCollection
}

export default function Map({ stations }: MapProps) {
    const [floodedRivers, setFloodedRivers] = useState<GeoJSONFeatureCollection | null>(null)
    const [loading, setLoading] = useState(true)

    // Fetch flooded rivers GeoJSON
    useEffect(() => {
        fetch('/api/flood/basins')
            .then((res) => res.json())
            .then((data: FloodedRiversData) => {
                if (data.geojson?.type === 'FeatureCollection') {
                    setFloodedRivers(data.geojson)
                }
            })
            .catch((err) => console.error('Failed to load flooded rivers:', err))
            .finally(() => setLoading(false))
    }, [])

    // Center of Sri Lanka
    const center: [number, number] = [7.8731, 80.7718]

    return (
        <MapContainer
            center={center}
            zoom={8}
            scrollWheelZoom={true}
            className="h-full w-full rounded-xl z-0"
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {/* Flooded Rivers Layer - only shows rivers in flooded basins */}
            {floodedRivers && (
                <GeoJSON
                    key={`flooded-rivers-${floodedRivers.features.length}`}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    data={floodedRivers as any}
                    style={getFloodedRiverStyle}
                />
            )}

            {/* Loading indicator */}
            {loading && (
                <div className="absolute top-2 left-2 z-[1000] bg-white/90 backdrop-blur-sm text-foreground text-xs px-3 py-1.5 rounded-lg border border-border shadow-sm">
                    Loading flood data...
                </div>
            )}

            {/* Station Markers */}
            {stations.map((station) => {
                if (station.lat == null || station.lon == null) return null

                const color = STATUS_COLORS[station.status]
                const radius = getMarkerRadius(station.status)

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
