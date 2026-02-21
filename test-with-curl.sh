#!/bin/bash

echo "Testing Player Settings API with curl..."

TOKEN="YOUR_TOKEN_HERE"

if [ "$TOKEN" = "YOUR_TOKEN_HERE" ]; then
    echo "[ERROR] Please replace YOUR_TOKEN_HERE with an actual token"
    echo "Get it by:"
    echo "1. Open https://aviator-game-topaz.vercel.app in a browser"
    echo "2. Log in to the game"
    echo "3. Open console and run: localStorage.getItem('auth_token')"
    exit 1
fi

echo "Testing PUT /api/player/settings..."
curl -i -X PUT https://aviator-game-production.up.railway.app/api/player/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"autoCashoutEnabled":true,"autoCashoutMultiplier":1.8,"soundEnabled":false}'

echo -e "\n\nTesting GET /api/player/settings..."
curl -i -X GET https://aviator-game-production.up.railway.app/api/player/settings \
  -H "Authorization: Bearer $TOKEN"
