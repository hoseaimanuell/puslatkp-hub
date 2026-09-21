/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build ringkas untuk Docker (servis fe). Diaktifkan lewat NEXT_STANDALONE=1 di fe/Dockerfile.
  output: process.env.NEXT_STANDALONE === '1' ? 'standalone' : undefined,
  distDir: process.env.NEXT_DIST_DIR || '.next', // build online memakai folder terpisah agar tidak mengganggu `npm run dev`
  reactStrictMode: true,
  experimental: { proxyClientMaxBodySize: '40mb' }, // unggahan lewat proxy /api (arsip maks. 30 MB)
  agentRules: false, // jangan membuat AGENTS.md / CLAUDE.md otomatis
  // Alamat lama tetap berfungsi
  // Mode satu alamat (bagikan-online.bat): browser cukup bicara ke fe; /api diteruskan ke be. Aktif bila API_PROXY diisi.
  async rewrites() {
    return process.env.API_PROXY ? [{ source: '/api/:path*', destination: `${process.env.API_PROXY}/api/:path*` }] : []
  },
  async redirects() {
    return [
      { source: '/input-data', destination: '/input-mingguan', permanent: false },
      { source: '/rekap-bulanan', destination: '/input-bulanan', permanent: false },
      { source: '/documents', destination: '/dokumen-arsip', permanent: false },
      { source: '/arsip-historis', destination: '/dokumen-arsip?tab=arsip', permanent: false },
      { source: '/highlights', destination: '/dashboard', permanent: false },
      { source: '/daily-activity', destination: '/dashboard', permanent: false },
    ]
  },
}

export default nextConfig
