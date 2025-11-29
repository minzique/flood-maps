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
        <div className="h-full w-full bg-muted/30 animate-pulse rounded-2xl flex items-center justify-center text-muted-foreground border border-border">
            <div className="flex flex-col items-center gap-2">
                <RefreshCw className="animate-spin" size={24} />
                <span className="text-sm font-medium">Loading Map...</span>
            </div>
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
        <main className="min-h-screen p-3 md:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-3 md:gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent tracking-tight">
                        Sri Lanka Flood Monitor
                    </h1>
                    <p className="text-muted-foreground text-xs md:text-sm mt-1.5 md:mt-2 font-medium">
                        Real-time hydro-meteorological data from Irrigation Department
                    </p>
                </div>
                <button
                    onClick={() => mutate()}
                    className="flex items-center gap-2 px-4 md:px-5 py-2 md:py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-xs md:text-sm font-medium transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 group text-foreground"
                >
                    <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500 text-primary" />
                    Refresh Data
                </button>
            </header>

            {/* Affected Basins Alert */}
            {summary.affected_basins.length > 0 && (
                <div className="mb-6 md:mb-8 p-3 md:p-4 bg-destructive/10 border border-destructive/20 rounded-2xl backdrop-blur-sm shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                    <div className="flex items-start gap-3 md:gap-4">
                        <div className="p-1.5 md:p-2 bg-destructive/20 rounded-lg flex-shrink-0">
                            <AlertTriangle className="text-destructive" size={20} />
                        </div>
                        <div>
                            <p className="text-destructive font-semibold text-sm md:text-base">
                                Active flooding in {summary.affected_basins.length} river basin
                                {summary.affected_basins.length > 1 ? 's' : ''}
                            </p>
                            <p className="text-destructive/80 text-xs md:text-sm mt-1 leading-relaxed">
                                {summary.affected_basins.join(', ')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                <StatCard
                    label="Major Flood"
                    value={summary.major_flood}
                    color="text-destructive"
                    borderColor="border-destructive/20"
                    icon={<AlertTriangle size={20} />}
                />
                <StatCard
                    label="Minor Flood"
                    value={summary.minor_flood}
                    color="text-orange-400"
                    borderColor="border-orange-500/20"
                    icon={<Droplets size={20} />}
                />
                <StatCard
                    label="At Alert"
                    value={summary.alert}
                    color="text-yellow-400"
                    borderColor="border-yellow-500/20"
                    icon={<AlertTriangle size={20} />}
                />
                <StatCard
                    label="Total Stations"
                    value={summary.total_stations}
                    color="text-primary"
                    borderColor="border-primary/20"
                    icon={<MapPin size={20} />}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                {/* Map Section */}
                <div className="lg:col-span-2 glass-card rounded-3xl p-1.5 h-[400px] md:h-[500px] lg:h-[600px] relative">
                    <Map stations={filteredStations} />

                    {/* Map Overlay Controls */}
                    <div className="absolute top-2 md:top-4 right-2 md:right-4 z-[400] glass-card p-1.5 md:p-2 rounded-xl flex flex-col gap-1.5 md:gap-2">
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
                    <div className="absolute bottom-2 md:bottom-4 right-2 md:right-4 z-[400] glass-card p-3 md:p-4 rounded-xl">
                        <p className="text-[10px] md:text-xs font-semibold text-muted-foreground mb-2 md:mb-3 uppercase tracking-wider">Stations</p>
                        <div className="space-y-1.5 md:space-y-2">
                            <LegendItem color="hsl(var(--destructive))" label="Major Flood" />
                            <LegendItem color="#f97316" label="Minor Flood" />
                            <LegendItem color="#eab308" label="Alert" />
                            <LegendItem color="#22c55e" label="Normal" />
                        </div>
                        <p className="text-[10px] md:text-xs font-semibold text-muted-foreground mb-2 md:mb-3 mt-3 uppercase tracking-wider border-t border-border/50 pt-2">Rivers</p>
                        <div className="space-y-1.5 md:space-y-2">
                            <LegendItem color="hsl(var(--destructive))" label="Major Flood" isLine />
                            <LegendItem color="#f97316" label="Minor Flood" isLine />
                        </div>
                    </div>
                </div>

                {/* List Section */}
                <div className="glass-card rounded-3xl flex flex-col h-[400px] md:h-[500px] lg:h-[600px] overflow-hidden">
                    <div className="p-4 md:p-5 border-b border-border/50 bg-white/5">
                        <h2 className="font-semibold flex items-center gap-2 md:gap-2.5 text-foreground text-sm md:text-base">
                            <List size={16} className="md:w-[18px] md:h-[18px] text-primary" />
                            Station Status
                            <span className="text-muted-foreground font-medium text-xs md:text-sm bg-primary/10 px-2 py-0.5 rounded-full">
                                {sortedStations.length}
                            </span>
                        </h2>
                    </div>
                    <div className="overflow-y-auto flex-1 p-2 md:p-3 space-y-2 scrollbar-thin scrollbar-thumb-secondary/50 scrollbar-track-transparent">
                        {sortedStations.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8 md:py-12 flex flex-col items-center gap-2 md:gap-3">
                                <div className="p-2 md:p-3 bg-muted/50 rounded-full">
                                    <MapPin size={20} className="md:w-[24px] md:h-[24px] text-muted-foreground" />
                                </div>
                                <p className="text-xs md:text-sm">No stations found matching filter</p>
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
            <footer className="mt-8 md:mt-12 text-center text-sm text-muted-foreground pb-6 md:pb-8 border-t border-border/30 pt-6">
                <div className="flex flex-col gap-3 px-4">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2">
                        <span className="text-xs md:text-sm">Data:</span>
                        <a
                            href="https://www.arcgis.com/apps/dashboards/2cffe83c9ff5497d97375498bdf3ff38"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary-light transition-colors hover:underline underline-offset-4 text-xs md:text-sm"
                        >
                            Sri Lanka Irrigation Department
                        </a>
                        <span className="hidden md:inline text-muted-foreground/50">|</span>
                        <a
                            href="https://github.com/minzique/flood-maps"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary-light transition-colors hover:underline underline-offset-4 text-xs md:text-sm"
                        >
                            GitHub
                        </a>
                    </div>
                    <p className="text-[10px] md:text-xs text-muted-foreground/70">
                        Unofficial tool. Follow official government alerts for emergency response.
                    </p>
                </div>
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
            className={`relative overflow-hidden glass-card p-3 md:p-5 rounded-xl md:rounded-2xl flex items-center justify-between group hover:bg-white/5 transition-all duration-300 border-none`}
        >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity bg-current ${color}`} />
            <div>
                <p className="text-muted-foreground text-[10px] md:text-xs uppercase tracking-wider font-semibold mb-0.5 md:mb-1">
                    {label}
                </p>
                <p className={`text-xl md:text-3xl font-bold ${color} tracking-tight`}>
                    {value}
                    <span className="text-xs md:text-sm font-medium text-muted-foreground ml-1">stations</span>
                </p>
            </div>
            <div className={`p-2 md:p-3 rounded-lg md:rounded-xl bg-muted/40 ${color}`}>{icon}</div>
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
            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-[10px] md:text-xs font-semibold transition-all duration-300 ${active
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105'
                : 'hover:bg-secondary/80 text-muted-foreground hover:text-foreground'
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
        <div className="flex items-center gap-1.5 md:gap-2">
            {isLine ? (
                <div
                    className="w-3 md:w-4 h-0.5 rounded"
                    style={{ backgroundColor: color }}
                />
            ) : (
                <div
                    className="w-2.5 md:w-3 h-2.5 md:h-3 rounded-full border-2 border-white/50"
                    style={{ backgroundColor: color }}
                />
            )}
            <span className="text-[10px] md:text-xs text-muted-foreground">{label}</span>
        </div>
    )
}

const STATUS_STYLE_MAP: Record<FloodStatus, string> = {
    MAJOR_FLOOD: 'text-destructive border-destructive/30 bg-destructive/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]',
    MINOR_FLOOD: 'text-orange-400 border-orange-500/30 bg-orange-500/10 shadow-[0_0_15px_rgba(249,115,22,0.1)]',
    ALERT: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]',
    NORMAL: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5',
    UNKNOWN: 'text-muted-foreground border-border/50 bg-secondary/20',
    NO_DATA: 'text-muted-foreground border-border bg-secondary/20',
}

interface StationCardProps {
    station: Station
}

function StationCard({ station }: StationCardProps) {
    const colorClass = STATUS_STYLE_MAP[station.status]

    return (
        <div
            className={`p-3 md:p-4 rounded-xl border ${colorClass} transition-all duration-300 hover:scale-[1.02] hover:shadow-lg backdrop-blur-sm bg-white/5`}
        >
            <div className="flex justify-between items-start mb-2 md:mb-3">
                <div className="flex-1">
                    <h3 className="font-semibold text-xs md:text-sm text-foreground tracking-tight">{station.name}</h3>
                    <p className="text-[10px] md:text-xs text-muted-foreground font-medium mt-0.5">{station.basin}</p>
                </div>
                <span
                    className={`text-[9px] md:text-[10px] font-bold px-2 md:px-2.5 py-0.5 md:py-1 rounded-full bg-muted/60 ${colorClass.split(' ')[0]} flex-shrink-0 ml-2`}
                >
                    {station.status.replace('_', ' ')}
                </span>
            </div>
            <div className="flex justify-between items-end gap-2">
                <div className="text-[10px] md:text-xs text-muted-foreground font-medium">
                    Level:{' '}
                    <span className={`text-xs md:text-sm font-bold font-mono ml-0.5 md:ml-1 ${colorClass.split(' ')[0]}`}>
                        {station.water_level?.toFixed(2) ?? '-'}m
                    </span>
                    {station.thresholds && station.water_level && (
                        <span className="text-muted-foreground ml-1 md:ml-1.5 text-[9px] md:text-[10px]">
                            / {station.thresholds.major}m
                        </span>
                    )}
                </div>
                {station.updated && (
                    <div className="text-[9px] md:text-[10px] text-muted-foreground font-medium text-right flex-shrink-0">
                        <div>{new Date(station.updated).toLocaleDateString([], { month: 'short', day: 'numeric' })}</div>
                        <div className="text-[8px] md:text-[9px]">
                            {new Date(station.updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
