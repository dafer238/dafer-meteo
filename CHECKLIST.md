# Pre-Flash Checklist for ESP32 Boards

## ESP32 Firmware Configuration (pub/)

### ⚠️ CRITICAL - Must configure before each flash:

1. **WiFi Credentials** - Edit [pub/main/wifi.c](pub/main/wifi.c#L7-L8)
   - [ ] Replace `YOUR_WIFI` with your actual WiFi SSID
   - [ ] Replace `YOUR_PASS` with your actual WiFi password

2. **Device ID** - Edit [pub/main/main.c](pub/main/main.c#L15)
   - [ ] Set to one of: `living_room`, `outside`, `daniel`, or `kitchen`
   - [ ] **Change this for EACH ESP32 board!**

### 🔧 Sensor Hardware Implementation:

3. **DHT22 Sensor** - [pub/main/dht22.c](pub/main/dht22.c)
   - [ ] Currently returns FAKE data (22.5°C, 48% RH)
   - [ ] Need to implement actual GPIO reading
   - [ ] Typical GPIO: 4 or 5

4. **BMP280 Sensor** - [pub/main/bmp280.c](pub/main/bmp280.c)
   - [ ] Currently returns FAKE data (22.2°C, 101325 Pa)
   - [ ] Need to implement I2C communication
   - [ ] Typical I2C pins: SDA=21, SCL=22

### ⏰ Time Synchronization:

5. **SNTP Configuration**
   - [ ] Currently not implemented - timestamps will be wrong
   - [ ] Consider adding SNTP before reading sensors
   - [ ] Or rely on Orange Pi timestamps only

## Orange Pi Setup (192.168.0.100)

### 📡 Mosquitto MQTT Broker:

6. **User/Password Consistency**
   - [ ] Create user: `sudo mosquitto_passwd -c /etc/mosquitto/passwd esp32_home`
   - [ ] Password: `2525` (as configured in code)
   - [ ] Configure auth file: `/etc/mosquitto/conf.d/auth.conf`

7. **Service Running**
   - [ ] Mosquitto enabled: `sudo systemctl enable mosquitto`
   - [ ] Mosquitto running: `sudo systemctl start mosquitto`
   - [ ] Test: `sudo systemctl status mosquitto`

### 🐍 Python Subscriber (sub/):

8. **Dependencies**
   - [ ] Install: `pip3 install -r sub/requirements.txt`
   - [ ] Verify .env file exists with correct settings

9. **Service Setup**
   - [ ] Copy service file to: `/etc/systemd/system/mqtt-esp32-logger.service`
   - [ ] Update paths in service file to match your Orange Pi paths
   - [ ] Enable: `sudo systemctl enable mqtt-esp32-logger`
   - [ ] Start: `sudo systemctl start mqtt-esp32-logger`

## Hardware Wiring

### DHT22 Connections (each ESP32):
- [ ] VCC → 3.3V
- [ ] GND → GND
- [ ] DATA → GPIO 4 (or configured pin)
- [ ] 10kΩ pull-up resistor between DATA and VCC

### BMP280 Connections (each ESP32):
- [ ] VCC → 3.3V
- [ ] GND → GND
- [ ] SDA → GPIO 21
- [ ] SCL → GPIO 22

## Build & Flash

10. **ESP-IDF Environment**
    - [ ] ESP-IDF installed and configured
    - [ ] Run: `idf.py build` from pub/ directory
    - [ ] Flash: `idf.py -p COMX flash monitor` (replace COMX with your port)

## Testing

11. **Per-Device Testing**
    - [ ] Flash ESP32 with unique DEVICE_ID
    - [ ] Monitor serial output: `idf.py monitor`
    - [ ] Check WiFi connection
    - [ ] Verify MQTT publish
    - [ ] Check deep sleep cycle (30 seconds)
    - [ ] Verify data appears in SQLite DB on Orange Pi

12. **Orange Pi Verification**
    - [ ] Check logs: `journalctl -u mqtt-esp32-logger -f`
    - [ ] Query database: `sqlite3 environment_data.db "SELECT * FROM measurements ORDER BY timestamp_server DESC LIMIT 10;"`
    - [ ] Verify data from all 4 locations

## Known Issues / TODOs

- ⚠️ Sensor implementations are stubs - need real hardware drivers
- ⚠️ No SNTP - device timestamps will be incorrect (epoch 0)
- ⚠️ No error handling for sensor failures
- ⚠️ No WiFi reconnection logic after deep sleep
- ⚠️ No OTA update capability
- ⚠️ Hardcoded credentials in source files (security risk)
