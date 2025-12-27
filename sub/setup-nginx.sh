#!/bin/bash

# Nginx Setup Script for Meteo Dashboard
# This script configures Nginx as a reverse proxy to serve the dashboard at /meteo

set -e

echo "================================================"
echo "Nginx Reverse Proxy Setup for Meteo Dashboard"
echo "================================================"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "This script requires root privileges."
    echo "Please run with sudo: sudo bash setup-nginx.sh"
    exit 1
fi

# Check if Nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "Nginx is not installed. Installing..."
    apt update
    apt install -y nginx
    echo "✓ Nginx installed"
else
    echo "✓ Nginx is already installed"
fi

echo ""
echo "Creating Nginx configuration..."
echo "----------------------------------------"

# Create Nginx configuration
cat > /etc/nginx/sites-available/meteo <<'EOF'
server {
    listen 80;
    server_name 192.168.1.100;

    # Meteo Dashboard
    location /meteo {
        proxy_pass http://localhost:8080/meteo;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API endpoints
    location /api/ {
        proxy_pass http://localhost:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files
    location /static/ {
        proxy_pass http://localhost:8080/static/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
EOF

echo "✓ Configuration created at /etc/nginx/sites-available/meteo"

# Enable the site
if [ ! -L /etc/nginx/sites-enabled/meteo ]; then
    ln -s /etc/nginx/sites-available/meteo /etc/nginx/sites-enabled/meteo
    echo "✓ Site enabled"
else
    echo "✓ Site already enabled"
fi

# Test Nginx configuration
echo ""
echo "Testing Nginx configuration..."
echo "----------------------------------------"
if nginx -t; then
    echo "✓ Configuration is valid"
else
    echo "✗ Configuration has errors"
    exit 1
fi

# Reload Nginx
echo ""
echo "Reloading Nginx..."
echo "----------------------------------------"
systemctl reload nginx
echo "✓ Nginx reloaded"

# Enable Nginx to start on boot
systemctl enable nginx
echo "✓ Nginx enabled to start on boot"

echo ""
echo "================================================"
echo "Nginx Setup Complete!"
echo "================================================"
echo ""
echo "The Meteo Dashboard is now accessible at:"
echo "  http://192.168.1.100/meteo"
echo ""
echo "Note: Make sure meteo-web.service is running:"
echo "  sudo systemctl status meteo-web"
echo ""
