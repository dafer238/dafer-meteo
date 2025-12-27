#!/bin/bash

# Meteo Dashboard Setup Script
# This script installs and configures the systemd services for the Meteo Dashboard

set -e

echo "================================================"
echo "Meteo Dashboard Setup"
echo "================================================"
echo ""

# Variables
PROJECT_DIR="/home/dafer/programming/dafer-meteo/sub"
SERVICE_FILES=("meteo-mqtt.service" "meteo-web.service")
SYSTEMD_DIR="/etc/systemd/system"

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then
    echo "This script requires root privileges."
    echo "Please run with sudo: sudo bash setup.sh"
    exit 1
fi

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo "Error: Project directory $PROJECT_DIR does not exist!"
    echo "Please update the PROJECT_DIR variable in this script."
    exit 1
fi

# Navigate to project directory
cd "$PROJECT_DIR"

echo "Step 1: Installing Python dependencies..."
echo "----------------------------------------"
# Activate ape environment and install packages
sudo -u dafer bash -c "source /home/dafer/venvs/denv/bin/activate && pip install -r requirements.txt"
echo "✓ Dependencies installed"
echo ""

echo "Step 2: Copying systemd service files..."
echo "----------------------------------------"
for service in "${SERVICE_FILES[@]}"; do
    if [ -f "$service" ]; then
        echo "Copying $service to $SYSTEMD_DIR..."
        cp "$service" "$SYSTEMD_DIR/"
        chmod 644 "$SYSTEMD_DIR/$service"
        echo "✓ $service copied"
    else
        echo "Warning: $service not found in $PROJECT_DIR"
    fi
done
echo ""

echo "Step 3: Reloading systemd daemon..."
echo "----------------------------------------"
systemctl daemon-reload
echo "✓ Systemd reloaded"
echo ""

echo "Step 4: Enabling services..."
echo "----------------------------------------"
for service in "${SERVICE_FILES[@]}"; do
    echo "Enabling $service..."
    systemctl enable "$service"
    echo "✓ $service enabled"
done
echo ""

echo "Step 5: Starting services..."
echo "----------------------------------------"
for service in "${SERVICE_FILES[@]}"; do
    echo "Starting $service..."
    systemctl start "$service"
    
    # Wait a moment for the service to start
    sleep 2
    
    # Check status
    if systemctl is-active --quiet "$service"; then
        echo "✓ $service is running"
    else
        echo "⚠ Warning: $service may not be running properly"
        echo "  Check status with: sudo systemctl status $service"
    fi
done
echo ""

echo "================================================"
echo "Setup Complete!"
echo "================================================"
echo ""
echo "Services installed and started:"
echo "  • meteo-mqtt.service  - MQTT listener"
echo "  • meteo-web.service   - Web dashboard"
echo ""
echo "Useful commands:"
echo "  • Check status:   sudo systemctl status meteo-mqtt"
echo "  • View logs:      sudo journalctl -u meteo-mqtt -f"
echo "  • Stop service:   sudo systemctl stop meteo-mqtt"
echo "  • Restart:        sudo systemctl restart meteo-mqtt"
echo ""
echo "Web dashboard will be available at:"
echo "  http://192.168.1.100:8080/meteo"
echo ""
echo "To configure Nginx reverse proxy (optional):"
echo "  See setup-nginx.sh script"
echo ""
