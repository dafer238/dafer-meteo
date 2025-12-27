# Meteo Dashboard

Complete monitoring solution for ESP32 weather sensors with MQTT data collection and web visualization.

## Features

- **MQTT Listener**: Collects sensor data from ESP32 devices via MQTT
- **SQLite Database**: Stores all measurements with timestamps
- **Web Dashboard**: Real-time monitoring interface with:
  - Device status and health monitoring
  - Latest measurements display
  - Interactive charts with historical data
  - Time range filters (1 hour to 1 week)
  - Per-device filtering
  - Statistics overview
- **REST API**: FastAPI endpoints for data access
- **Systemd Services**: Runs as background services on Orange Pi

## Architecture

```
ESP32 Devices → MQTT Broker → main.py (MQTT Listener) → SQLite DB
                                                            ↓
                                                     web_server.py (FastAPI)
                                                            ↓
                                                     Web Dashboard
```

## Installation

### Prerequisites

- Orange Pi Zero3 (or similar Linux SBC)
- Python environment (ape with default venv)
- MQTT Broker (Mosquitto) running at 192.168.1.100
- SQLite3

### Setup Steps

1. **Clone/Copy files to Orange Pi**:
   ```bash
   mkdir -p /home/dafer/programming/dafer-meteo/sub
   cd /home/dafer/programming/dafer-meteo/sub
   # Copy all files from this directory
   ```

2. **Configure environment**:
   Edit `.env` file with your MQTT credentials:
   ```
   MQTT_USERNAME=your_username
   MQTT_PASSWORD=your_password
   MQTT_BROKER=192.168.1.100
   MQTT_PORT=1883
   MQTT_TOPIC=sensors/#
   SQLITE_DB=environment_data.db
   LOG_LEVEL=INFO
   ```

3. **Run setup script**:
   ```bash
   chmod +x setup.sh
   sudo ./setup.sh
   ```

   This will:
   - Install Python dependencies
   - Copy systemd service files
   - Enable and start both services

4. **Optional: Setup Nginx reverse proxy**:
   ```bash
   chmod +x setup-nginx.sh
   sudo ./setup-nginx.sh
   ```

## Services

### meteo-mqtt.service
- Runs `main.py` to listen for MQTT messages
- Stores sensor data in SQLite database
- Auto-restarts on failure

### meteo-web.service
- Runs FastAPI web server on port 8080
- Serves dashboard at http://192.168.1.100:8080/meteo
- Provides REST API endpoints

## Usage

### Access Dashboard

**Direct access** (without Nginx):
```
http://192.168.1.100:8080/meteo
```

**With Nginx** (after running setup-nginx.sh):
```
http://192.168.1.100/meteo
```

### Service Management

Check status:
```bash
sudo systemctl status meteo-mqtt
sudo systemctl status meteo-web
```

View logs:
```bash
sudo journalctl -u meteo-mqtt -f
sudo journalctl -u meteo-web -f
```

Restart services:
```bash
sudo systemctl restart meteo-mqtt
sudo systemctl restart meteo-web
```

Stop services:
```bash
sudo systemctl stop meteo-mqtt
sudo systemctl stop meteo-web
```

## API Endpoints

### Device Management
- `GET /api/devices/status` - Get all connected devices and their status
- `GET /api/devices/{device_id}/latest` - Get latest data from specific device

### Data Retrieval
- `GET /api/data/latest?limit=N` - Get N latest measurements
- `GET /api/data/history?device_id=X&hours=H&limit=N` - Get historical data
- `GET /api/data/aggregated?device_id=X&hours=H&interval_minutes=M` - Get aggregated data

### Monitoring
- `GET /api/health` - Health check endpoint
- `GET /api/stats` - Overall statistics

## Dashboard Features

### Device Status Cards
- Real-time online/offline status
- Last seen timestamp
- Message count
- Firmware version
- RSSI signal strength

### Data Visualization
- DHT22 Temperature chart
- BMP280 Temperature chart
- Humidity chart
- Pressure chart
- RSSI signal strength chart

### Filters
- Device selector (all devices or specific device)
- Time range selector (1 hour to 1 week)
- Auto-refresh every 10 seconds

### Statistics
- Total measurements
- Total devices
- First/last measurement timestamps
- Per-device averages

## Database Schema

**measurements table**:
- `id` - Auto-increment primary key
- `device_id` - ESP32 device identifier
- `topic` - MQTT topic
- `dht22_temperature_c` - DHT22 temperature (°C)
- `dht22_humidity_percent` - DHT22 humidity (%)
- `bmp280_temperature_c` - BMP280 temperature (°C)
- `bmp280_pressure_pa` - BMP280 pressure (Pa)
- `timestamp_device` - Timestamp from device
- `timestamp_server` - Server timestamp
- `firmware_version` - Device firmware version
- `rssi` - WiFi signal strength (dBm)

Indexes:
- `idx_device_time` on (device_id, timestamp_server)
- `idx_time` on (timestamp_server)

## File Structure

```
sub/
├── main.py                  # MQTT listener
├── web_server.py           # FastAPI web server
├── requirements.txt        # Python dependencies
├── .env                    # Environment configuration
├── meteo-mqtt.service      # Systemd service for MQTT
├── meteo-web.service       # Systemd service for web
├── setup.sh                # Installation script
├── setup-nginx.sh          # Nginx configuration script
├── README.md               # This file
├── templates/
│   └── dashboard.html      # Dashboard HTML template
└── static/
    ├── style.css           # Dashboard styles
    └── dashboard.js        # Dashboard JavaScript
```

## Troubleshooting

### Services won't start
```bash
# Check service logs
sudo journalctl -u meteo-mqtt -n 50
sudo journalctl -u meteo-web -n 50

# Check if Python environment is correct
ls -la /home/dafer/.local/share/ape/venvs/default/bin/activate
```

### Database issues
```bash
# Check database file
ls -lh environment_data.db

# Access database directly
sqlite3 environment_data.db
> SELECT COUNT(*) FROM measurements;
> SELECT * FROM measurements ORDER BY timestamp_server DESC LIMIT 5;
```

### Web dashboard not loading
```bash
# Check if service is running
sudo systemctl status meteo-web

# Check if port 8080 is listening
sudo netstat -tlnp | grep 8080

# Test API directly
curl http://localhost:8080/api/health
```

### MQTT not receiving data
```bash
# Check MQTT broker status
sudo systemctl status mosquitto

# Test MQTT subscription
mosquitto_sub -h 192.168.1.100 -t "sensors/#" -u esp32_home -P 2525

# Check if main.py is running
sudo systemctl status meteo-mqtt
```

## Development

To run locally for development:

```bash
# Activate Python environment
source /home/dafer/.local/share/ape/venvs/default/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run MQTT listener
python main.py

# Run web server (in another terminal)
uvicorn web_server:app --host 0.0.0.0 --port 8080 --reload
```

## License

MIT License
