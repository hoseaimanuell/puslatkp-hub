#!/bin/sh
# Backend di port 4000 (internal), frontend di port publik $PORT (diberikan platform hosting).
(cd /app/be && PORT=4000 node src/server.js) &
BE_PID=$!
cd /app/fe
PORT="${PORT:-3000}" HOSTNAME=0.0.0.0 node server.js &
FE_PID=$!
# Bila salah satu berhenti, hentikan kontainer agar platform memulai ulang
wait -n $BE_PID $FE_PID 2>/dev/null || wait $BE_PID
kill $BE_PID $FE_PID 2>/dev/null
exit 1
