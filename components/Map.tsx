'use client'

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { Station, FloodStatus } from '@/types'
import { STATUS_COLORS } from '@/types'

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

export default function Map({ stations }: MapProps) {
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
              color,
              fillColor: color,
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Popup className="bg-slate-900 text-slate-100">
              <div className="p-1">
                <h3 className="font-bold text-sm mb-1 text-slate-900">
                  {station.name}
                </h3>
                <p className="text-xs text-slate-600 m-0">
                  Status: <span style={{ color }}>{station.status}</span>
                </p>
                <p className="text-xs text-slate-600 m-0">
                  Level: {station.water_level?.toFixed(2) ?? '-'} m
                </p>
                <p className="text-xs text-slate-600 m-0">
                  Basin: {station.basin}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        )
      })}
    </MapContainer>
  )
}
