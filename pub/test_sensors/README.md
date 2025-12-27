# Sensor Wiring Test

Simple test program to verify DHT22 and BMP280 sensor connections before deploying the full application.

## Purpose

This test reads sensor values every 3 seconds and prints them to the serial monitor. Use this to verify:
- Sensors are wired correctly
- I2C communication works (BMP280)
- DHT22 1-wire protocol works
- Values look reasonable

## Quick Start

```bash
cd test_sensors
idf.py build
idf.py -p COMX flash monitor
```

Replace `COMX` with your serial port (e.g., COM3, COM4, /dev/ttyUSB0).

## Expected Output

```
I (xxx) SENSOR_TEST: === ESP32 Sensor Wiring Test ===
I (xxx) SENSOR_TEST: Testing DHT22 and BMP280 sensors

I (xxx) SENSOR_TEST: --- Initializing BMP280 ---
I (xxx) BMP280: BMP280 detected (ID: 0x58)
I (xxx) BMP280: BMP280 initialized
I (xxx) SENSOR_TEST: ✓ BMP280 initialized successfully

I (xxx) SENSOR_TEST: --- Initializing DHT22 ---
I (xxx) SENSOR_TEST: ✓ DHT22 initialized successfully

I (xxx) SENSOR_TEST: === Starting Continuous Reading ===
I (xxx) SENSOR_TEST: Reading sensors every 3 seconds...

I (xxx) SENSOR_TEST: --- Reading #1 ---
I (xxx) DHT22: Temperature: 22.5°C, Humidity: 48.0%
  DHT22  → Temperature: 22.5°C, Humidity: 48.0%
I (xxx) BMP280: Temperature: 22.20°C, Pressure: 101325.00 Pa
  BMP280 → Temperature: 22.20°C, Pressure: 101325.00 Pa (1013.25 hPa)
```

## Configuration

Edit `sdkconfig.defaults` or run `idf.py menuconfig` to change:
- **DHT22 GPIO**: Default 4
- **I2C SDA GPIO**: Default 21
- **I2C SCL GPIO**: Default 22
- **BMP280 I2C Address**: Default 0x76 (try 0x77 if not detected)

## Troubleshooting

### BMP280 Not Detected
- Check CSB pin is connected to 3.3V (enables I2C mode)
- Verify SDO pin: GND=0x76, 3.3V=0x77
- Swap SDA/SCL if still not working

### DHT22 Read Failures
- Add 10kΩ pull-up resistor between DATA and 3.3V
- Check DATA pin is GPIO 4 (middle pin of DHT22)
- Try shorter wires (<50cm)

### Both Sensors Fail
- Check 3.3V and GND connections
- Verify you're not using 5V (will damage sensors)
- Use multimeter to check voltage at sensor pins

## Next Steps

Once sensors read correctly:
1. Go back to main project: `cd ../`
2. Configure node name: `idf.py menuconfig`
3. Build full application: `idf.py build`
4. Flash and deploy: `idf.py flash monitor`
