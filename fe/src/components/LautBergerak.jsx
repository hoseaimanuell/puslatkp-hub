/**
 * components/LautBergerak.jsx
 * Latar panel biru halaman Login: gelombang yang bergerak + siluet ikan (tuna, kakap, kawanan ikan kecil) yang
 * berenang pelan, dan gelembung. Semua SVG + animasi CSS (lihat .laut-* di app/globals.css) — tanpa gambar/foto,
 * jadi ringan. Sengaja samar (putih transparan) supaya tulisan di atasnya tetap terbaca. Animasi berhenti bila
 * pengguna mengaktifkan "kurangi gerakan" di perangkatnya (prefers-reduced-motion).
 */

// Satu periode gelombang (awal & akhir sama tinggi dan sama kemiringan) -> dua salinan berdampingan bisa digeser
// terus-menerus tanpa sambungan terlihat.
function Gelombang({ className, style }) {
  const path = 'M0 60 C 120 20, 240 20, 360 60 S 600 100, 720 60 V120 H0 Z'
  return (
    <div className={`laut-gelombang ${className}`} style={style} aria-hidden="true">
      {[0, 1].map(i => (
        <svg key={i} viewBox="0 0 720 120" preserveAspectRatio="none" className="w-1/2 h-full" fill="currentColor">
          <path d={path} />
        </svg>
      ))}
    </div>
  )
}

// Siluet ikan menghadap kanan (arah renang). Transparansi dipasang di elemen svg (opacity), bukan di warna, supaya
// bagian yang bertumpuk (sirip di atas badan) tidak tampak lebih terang.
const Tuna = props => (
  <svg viewBox="0 0 220 90" fill="currentColor" {...props}>
    <path d="M40 45 C 70 22 130 16 170 26 C 192 32 206 40 214 45 C 206 50 192 58 170 64 C 130 74 70 68 40 45 Z" />
    <path d="M48 45 C 38 40 26 28 10 12 C 20 28 25 38 27 45 C 25 52 20 62 10 78 C 26 62 38 50 48 45 Z" />
    <path d="M118 22 C 124 10 131 5 137 2 C 139 11 141 18 143 24 Z" />
    <path d="M76 29 L 83 17 L 90 30 Z" />
    <path d="M78 61 L 85 73 L 92 60 Z" />
    <path d="M152 49 C 136 54 120 60 102 66 C 120 56 136 50 152 46 Z" />
  </svg>
)

const Kakap = props => (
  <svg viewBox="0 0 124 72" fill="currentColor" {...props}>
    <path d="M22 36 C 30 13 70 6 100 20 C 112 26 120 32 121 37 C 119 43 110 49 99 53 C 70 65 32 60 22 36 Z" />
    <path d="M26 36 C 16 27 9 19 2 14 C 4 27 4 45 2 58 C 9 53 16 45 26 36 Z" />
    <path d="M42 15 C 55 1 78 1 92 15 Z" />
    <path d="M60 58 L 69 69 L 78 56 Z" />
  </svg>
)

const IkanKecil = props => (
  <svg viewBox="0 0 60 24" fill="currentColor" {...props}>
    <path d="M6 12 C 18 4 38 3 52 10 C 57 12 57 12 52 14 C 38 21 18 20 6 12 Z" />
    <path d="M9 12 L 0 4 L 3 12 L 0 20 Z" />
  </svg>
)

// Posisi & tempo tiap ikan: `top` vertikal, `durasi` satu kali lintas panel, `jeda` negatif = sudah di tengah
// jalan saat halaman dibuka (tidak menunggu ikan muncul dari tepi).
const KAWANAN = [
  { x: 0, y: 0 }, { x: 34, y: -14 }, { x: 30, y: 16 }, { x: 66, y: -4 }, { x: 64, y: 22 }, { x: 96, y: 8 },
]

export default function LautBergerak() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Ikan — di belakang gelombang depan, di depan gelombang belakang */}
      <div className="laut-renang" style={{ top: '38%', animationDuration: '46s', animationDelay: '-18s' }}>
        <div className="laut-ayun" style={{ animationDuration: '6s' }}>
          <Tuna className="w-48 text-white opacity-[0.11]" />
        </div>
      </div>

      <div className="laut-renang" style={{ top: '58%', animationDuration: '34s', animationDelay: '-6s' }}>
        <div className="laut-ayun" style={{ animationDuration: '5s', animationDelay: '-2s' }}>
          <div className="relative w-36 h-14">
            {KAWANAN.map((f, i) => (
              <IkanKecil key={i} className="absolute w-9 text-white opacity-[0.13]" style={{ left: f.x, top: 16 + f.y }} />
            ))}
          </div>
        </div>
      </div>

      <div className="laut-renang laut-renang-lambat" style={{ top: '22%', animationDuration: '62s', animationDelay: '-40s' }}>
        <div className="laut-ayun" style={{ animationDuration: '7s', animationDelay: '-3s' }}>
          <Kakap className="w-24 text-white opacity-[0.08]" />
        </div>
      </div>

      {/* Gelembung */}
      {[
        { left: '18%', size: 6, dur: '9s', delay: '-1s' },
        { left: '42%', size: 4, dur: '12s', delay: '-6s' },
        { left: '63%', size: 7, dur: '10s', delay: '-3s' },
        { left: '81%', size: 5, dur: '14s', delay: '-9s' },
      ].map((b, i) => (
        <span
          key={i}
          className="laut-gelembung"
          style={{ left: b.left, width: b.size, height: b.size, animationDuration: b.dur, animationDelay: b.delay }}
        />
      ))}

      {/* Gelombang: belakang lambat & samar, depan cepat & lebih terang */}
      <Gelombang className="h-44 text-white/[0.04]" style={{ animationDuration: '26s' }} />
      <Gelombang className="h-32 text-white/[0.06]" style={{ animationDuration: '17s', animationDirection: 'reverse' }} />
      <Gelombang className="h-20 text-white/[0.09]" style={{ animationDuration: '11s' }} />
    </div>
  )
}
