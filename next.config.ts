import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Disabled due to Leaflet incompatibility with React 19 strict mode
  // Leaflet's MapContainer doesn't handle double effect invocation
  reactStrictMode: false,
}

export default nextConfig
