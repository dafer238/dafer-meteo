# ESP32 Sensor Wiring Guide

## Default Pin Configuration

### DHT22 Temperature/Humidity Sensor
| DHT22 Pin         | ESP32 Pin | Notes                                  |
| ----------------- | --------- | -------------------------------------- |
| VIN               | 3.3V      | Power supply                           |
| GND               | GND       | Ground                                 |
| DATA (middle pin) | GPIO 4    | Data line (configurable in menuconfig) |

**Important:** Add a 10kΩ pull-up resistor between DATA and VIN/3.3V for stable operation.

### BMP280 Pressure/Temperature Sensor (I2C)
| BMP280 Pin | ESP32 Pin   | Notes                                   |
| ---------- | ----------- | --------------------------------------- |
| VCC        | 3.3V        | Power supply                            |
| GND        | GND         | Ground                                  |
| SCL        | GPIO 22     | I2C Clock (configurable in menuconfig)  |
| SDA        | GPIO 21     | I2C Data (configurable in menuconfig)   |
| CSB        | 3.3V        | Pull HIGH for I2C mode (LOW = SPI mode) |
| SDO        | GND or 3.3V | Sets I2C address: GND=0x76, VCC=0x77    |

**I2C Address:** Connect SDO to GND for address 0x76 (default), or to 3.3V for 0x77.

## Wiring Diagram

```
ESP32 Development Board
┌─────────────────────────────┐
│                             │
│  3.3V ─────┬─────┬─────┬────┤
│            │     │     │    │
│            │     │  10kΩ    │
│  GPIO 4 ───┼─────┴─[ R ]────┤  DHT DATA + Pull-up
│            │     │           │
│  GPIO 21 ──┼─────┼───────────┤  I2C SDA (BMP280)
│            │     │           │
│  GPIO 22 ──┼─────┼───────────┤  I2C SCL (BMP280)
│            │     │           │
│            │     └───────────┤  BMP280 CSB (enable I2C)
│            │                 │
│  GND ──────┴─────────────────┤  BMP280 SDO (addr select)
│                              │
└──────────────────────────────┘

DHT22 (3 pins):
- VIN → 3.3V
- DATA (middle pin) → GPIO 4 (with 10kΩ resistor to 3.3V)
- GND → GND

BMP280 Module (6 pins):
- VCC → 3.3V
- GND → GND
- SCL → GPIO 22
- SDA → GPIO 21
- CSB → 3.3V (enables I2C mode)
- SDO → GND (sets address to 0x76)
      or 3.3V (sets address to 0x77)
```

## Configuration via menuconfig

Run `idf.py menuconfig` and navigate to **"Sensor node configuration"**:

- **DHT22 data GPIO**: Default 4 (change if needed)
- **I2C SDA GPIO**: Default 21
- **I2C SCL GPIO**: Default 22
- **BMP280 I2C address**: Default 0x76 (try 0x77 if sensor not detected)

## Testing I2C Connection

After wiring BMP280, you can scan for I2C devices:

```bash
idf.py menuconfig
# Enable Component config → ESP-IDF → I2C → I2C Tools
idf.py build flash monitor
# In ESP32 serial console:
i2cdetect
```

You should see the BMP280 at address 0x76 or 0x77.

## Troubleshooting

### DHT22 Issues:
- **Timeout errors**: Check pull-up resistor (10kΩ), verify wiring
- **Checksum errors**: Power supply issue, use shorter wires (<50cm)
- **Consistent -999.0 readings**: Sensor not responding, check connections

### BMP280 Issues:
- **"BMP280 not found"**: 
  - Check CSB is connected to 3.3V (not floating or GND)
  - Verify SDO connection matches configured address (GND=0x76, 3.3V=0x77)
  - Check SDA/SCL wiring (note: SDA is GPIO 21, SCL is GPIO 22)
- **I2C timeout**: Check pull-up resistors on I2C lines (usually on module)
- **Wrong values**: Ensure using 3.3V (not 5V)

### General Tips:
- **BMP280 CSB pin MUST be HIGH (3.3V) for I2C mode!** If floating or LOW, sensor won't respond
- **BMP280 SDO pin sets the I2C address**: GND=0x76 (default), VCC=0x77
- DHT22 middle pin is DATA, requires 10kΩ pull-up resistor
- Use good quality jumper wires (short as possible)
- Ensure stable 3.3V power supply (check voltage with multimeter)
- Don't connect 5V to 3.3V sensors!
