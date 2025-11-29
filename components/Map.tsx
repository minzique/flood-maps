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

const riverStyle: PathOptions = {
  color: '#3b82f6',
  weight: 1.5,
  opacity: 0.6,
}

export default function Map({ stations }: MapProps) {
  const [rivers, setRivers] = useState<GeoJSONFeatureCollection | null>(null)
  const [riversLoading, setRiversLoading] = useState(true)

  // Fetch rivers GeoJSON
  useEffect(() => {
    fetch('/api/flood/rivers')
      .then((res) => res.json())
      .then((data) => {
        if (data.type === 'FeatureCollection') {
          setRivers(data)
        }
      })
      .catch((err) => console.error('Failed to load rivers:', err))
      .finally(() => setRiversLoading(false))
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
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Rivers Layer */}
      {rivers && (
        <GeoJSON
          key="rivers"
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data={rivers as any}
          style={riverStyle}
        />
      )}

      {/* Loading indicator for rivers */}
      {riversLoading && (
        <div className="absolute top-2 left-2 z-[1000] bg-slate-900/80 text-slate-300 text-xs px-2 py-1 rounded">
          Loading rivers...
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
