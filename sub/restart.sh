#!/bin/bash

# Restart Meteo Services
# Quick restart script for development/debugging

echo "Restarting Meteo services..."

sudo systemctl restart meteo-mqtt
sudo systemctl restart meteo-web

sleep 2

echo "Status:"
echo "------"
echo "MQTT Service:"
sudo systemctl status meteo-mqtt --no-pager -l | head -n 5
echo ""
echo "Web Service:"
sudo systemctl status meteo-web --no-pager -l | head -n 5
echo ""
echo "Services restarted. Check logs with:"
echo "  sudo journalctl -u meteo-web -f"
