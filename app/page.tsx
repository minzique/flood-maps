'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  AlertTriangle,
  Droplets,
  RefreshCw,
  List,
  MapPin,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import type { Station, FloodStatus, FloodSummary } from '@/types'
import { STATUS_PRIORITY } from '@/types'

// Dynamically import Map to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-slate-900 animate-pulse rounded-xl flex items-center justify-center text-slate-500">
      Loading Map...
    </div>
  ),
})

type FilterType = 'ALL' | 'FLOOD' | 'ALERT'

interface FloodAPIResponse {
  stations: Station[]
  summary: FloodSummary
}

const fetcher = (url: string): Promise<FloodAPIResponse> =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error('Failed to fetch')
    return res.json()
  })

export default function Home() {
  const { data, error, isLoading, mutate } = useSWR<FloodAPIResponse>(
    '/api/flood',
    fetcher,
    {
      refreshInterval: 60000,
    }
  )

  const [filter, setFilter] = useState<FilterType>('ALL')

  if (error) {
    return (
      <div className="p-8 text-red-400">
        Failed to load data. Is the backend running?
      </div>
    )
  }

  if (isLoading || !data) {
    return <div className="p-8 text-slate-400">Loading flood data...</div>
  }

  const { stations, summary } = data

  // Filter stations
  const filteredStations = stations.filter((s) => {
    if (filter === 'ALL') return true
    if (filter === 'FLOOD') {
      return s.status === 'MAJOR_FLOOD' || s.status === 'MINOR_FLOOD'
    }
    if (filter === 'ALERT') return s.status === 'ALERT'
    return true
  })

  // Sort by priority
  const sortedStations = [...filteredStations].sort(
    (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
  )

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            Sri Lanka Flood Monitor
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time hydro-meteorological data from Irrigation Department
          </p>
        </div>
        <button
          onClick={() => mutate()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={16} />
          Refresh Data
        </button>
      </header>

      {/* Affected Basins Alert */}
      {summary.affected_basins.length > 0 && (
        <div className="mb-6 p-4 bg-red-950/30 border border-red-900/50 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-red-400 mt-0.5 flex-shrink-0" size={20} />
            <div>
              <p className="text-red-400 font-medium text-sm">
                Active flooding in {summary.affected_basins.length} river basin
                {summary.affected_basins.length > 1 ? 's' : ''}
              </p>
              <p className="text-red-300/80 text-sm mt-1">
                {summary.affected_basins.join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Major Flood"
          value={summary.major_flood}
          color="text-red-500"
          borderColor="border-red-500/20"
          icon={<AlertTriangle size={20} />}
        />
        <StatCard
          label="Minor Flood"
          value={summary.minor_flood}
          color="text-orange-500"
          borderColor="border-orange-500/20"
          icon={<Droplets size={20} />}
        />
        <StatCard
          label="Alert Level"
          value={summary.alert}
          color="text-yellow-500"
          borderColor="border-yellow-500/20"
          icon={<AlertTriangle size={20} />}
        />
        <StatCard
          label="Total Stations"
          value={summary.total_stations}
          color="text-blue-400"
          borderColor="border-blue-500/20"
          icon={<MapPin size={20} />}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
        {/* Map Section */}
        <div className="lg:col-span-2 bg-slate-900/50 rounded-2xl border border-slate-800 p-1 h-full relative">
          <Map stations={filteredStations} />

          {/* Map Overlay Controls */}
          <div className="absolute top-4 right-4 z-[400] bg-slate-900/90 backdrop-blur p-2 rounded-lg border border-slate-700 shadow-xl flex flex-col gap-2">
            <FilterButton
              active={filter === 'ALL'}
              onClick={() => setFilter('ALL')}
              label="All"
            />
            <FilterButton
              active={filter === 'FLOOD'}
              onClick={() => setFilter('FLOOD')}
              label="Floods"
            />
            <FilterButton
              active={filter === 'ALERT'}
              onClick={() => setFilter('ALERT')}
              label="Alerts"
            />
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 z-[400] bg-slate-900/90 backdrop-blur p-3 rounded-lg border border-slate-700 shadow-xl">
            <p className="text-xs font-medium text-slate-400 mb-2">Legend</p>
            <div className="space-y-1.5">
              <LegendItem color="#ef4444" label="Major Flood" />
              <LegendItem color="#f97316" label="Minor Flood" />
              <LegendItem color="#eab308" label="Alert" />
              <LegendItem color="#22c55e" label="Normal" />
              <LegendItem color="#3b82f6" label="Rivers" isLine />
            </div>
          </div>
        </div>

        {/* List Section */}
        <div className="bg-slate-900/50 rounded-2xl border border-slate-800 flex flex-col h-full overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2">
              <List size={18} />
              Station Status
              <span className="text-slate-500 font-normal text-sm">
                ({sortedStations.length})
              </span>
            </h2>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {sortedStations.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                No stations found
              </div>
            ) : (
              sortedStations.map((station) => (
                <StationCard key={station.name} station={station} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-6 text-center text-xs text-slate-600">
        <p>
          Data source: Sri Lanka Irrigation Department (unofficial).
          Follow official government alerts for emergency response.
        </p>
      </footer>
    </main>
  )
}

interface StatCardProps {
  label: string
  value: number
  color: string
  borderColor: string
  icon: React.ReactNode
}

function StatCard({ label, value, color, borderColor, icon }: StatCardProps) {
  return (
    <div
      className={`bg-slate-900/50 border ${borderColor} p-4 rounded-xl flex items-center justify-between`}
    >
      <div>
        <p className="text-slate-400 text-xs uppercase tracking-wider font-medium">
          {label}
        </p>
        <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      </div>
      <div className={`p-2 rounded-lg bg-slate-800/50 ${color}`}>{icon}</div>
    </div>
  )
}

interface FilterButtonProps {
  active: boolean
  onClick: () => void
  label: string
}

function FilterButton({ active, onClick, label }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
        active
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
          : 'hover:bg-slate-700 text-slate-300'
      }`}
    >
      {label}
    </button>
  )
}

interface LegendItemProps {
  color: string
  label: string
  isLine?: boolean
}

function LegendItem({ color, label, isLine }: LegendItemProps) {
  return (
    <div className="flex items-center gap-2">
      {isLine ? (
        <div
          className="w-4 h-0.5 rounded"
          style={{ backgroundColor: color }}
        />
      ) : (
        <div
          className="w-3 h-3 rounded-full border-2 border-white/50"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="text-xs text-slate-300">{label}</span>
    </div>
  )
}

const STATUS_STYLE_MAP: Record<FloodStatus, string> = {
  MAJOR_FLOOD: 'text-red-400 border-red-900/30 bg-red-950/10',
  MINOR_FLOOD: 'text-orange-400 border-orange-900/30 bg-orange-950/10',
  ALERT: 'text-yellow-400 border-yellow-900/30 bg-yellow-950/10',
  NORMAL: 'text-green-400 border-slate-800 bg-slate-800/30',
  UNKNOWN: 'text-slate-400 border-slate-800 bg-slate-800/30',
  NO_DATA: 'text-slate-500 border-slate-800 bg-slate-800/30',
}

interface StationCardProps {
  station: Station
}

function StationCard({ station }: StationCardProps) {
  const colorClass = STATUS_STYLE_MAP[station.status]

  return (
    <div
      className={`p-3 rounded-lg border ${colorClass} transition-colors hover:bg-slate-800/50`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium text-sm text-slate-200">{station.name}</h3>
          <p className="text-xs text-slate-500">{station.basin}</p>
        </div>
        <span
          className={`text-xs font-bold px-2 py-0.5 rounded-full bg-slate-900/50 ${colorClass.split(' ')[0]}`}
        >
          {station.status.replace('_', ' ')}
        </span>
      </div>
      <div className="mt-2 flex justify-between items-end">
        <div className="text-xs text-slate-400">
          Level:{' '}
          <span className="text-slate-200 font-mono">
            {station.water_level?.toFixed(2) ?? '-'}m
          </span>
          {station.thresholds && station.water_level && (
            <span className="text-slate-500 ml-1">
              / {station.thresholds.major}m
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-600">
          {station.updated
            ? new Date(station.updated).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''}
        </div>
      </div>
    </div>
  )
}
