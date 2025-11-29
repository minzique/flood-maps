import type { Metadata } from 'next'
import { Figtree } from 'next/font/google'
import './globals.css'

const figtree = Figtree({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Sri Lanka Flood Monitor',
    description: 'Real-time flood monitoring dashboard',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="light" style={{ colorScheme: 'light' }}>
            <body className={`${figtree.className} min-h-screen bg-background text-foreground antialiased selection:bg-primary/30`}>
                {children}
            </body>
        </html>
    )
}
