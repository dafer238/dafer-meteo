#!/bin/bash

# Test API endpoints
echo "Testing Meteo API endpoints..."
echo ""

BASE_URL="http://localhost:8080"

echo "1. Testing health endpoint:"
curl -s "${BASE_URL}/api/health" | head -n 5
echo ""
echo ""

echo "2. Testing query test endpoint (GET):"
curl -s "${BASE_URL}/api/query/test"
echo ""
echo ""

echo "3. Testing query endpoint (POST):"
curl -s -X POST "${BASE_URL}/api/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"SELECT COUNT(*) as total FROM measurements"}' | head -n 10
echo ""
echo ""

echo "4. Testing device status:"
curl -s "${BASE_URL}/api/devices/status" | head -n 10
echo ""
echo ""

echo "Done! If you see 'Not Found' errors, restart the service:"
echo "  sudo systemctl restart meteo-web"
