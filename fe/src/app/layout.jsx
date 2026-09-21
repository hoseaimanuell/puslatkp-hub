import './globals.css'
import Providers from '../components/Providers'

export const metadata = {
  title: 'PUSLATKP Management Hub',
  description: 'PUSLATKP Management Hub — Dashboard pelaporan aktivitas dan kinerja tim Pusat Pelatihan Kelautan dan Perikanan.',
  icons: { icon: '/favicon.svg' },
}

export const viewport = { width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,700;1,9..144,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
