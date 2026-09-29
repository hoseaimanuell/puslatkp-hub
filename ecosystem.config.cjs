/**
 * PM2 — menjalankan be & fe di server produksi tanpa Docker, otomatis hidup lagi bila crash/server restart.
 *   npm install -g pm2
 *   (build fe dulu: cd fe && npm ci && npm run build)
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup        # ikut menyala saat server reboot
 *   pm2 logs                       # lihat log (error backend dicatat dengan tanggal & endpoint)
 * Konfigurasi rahasia tetap di be/.env (tidak ditulis di sini).
 */
module.exports = {
  apps: [
    {
      name: 'puslatkp-be',
      cwd: './be',
      script: 'src/server.js',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
      kill_timeout: 12000, // beri waktu server menyelesaikan permintaan (lihat penanganan SIGTERM di be/src/server.js)
      time: true,          // cap waktu di setiap baris log
    },
    {
      name: 'puslatkp-fe',
      cwd: './fe',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
      time: true,
    },
  ],
}
