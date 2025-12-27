#pragma once

#include "driver/i2c.h"
#include "esp_err.h"

// I2C Configuration
#define I2C_MASTER_NUM I2C_NUM_0
#define I2C_MASTER_SDA_IO CONFIG_I2C_SDA_GPIO
#define I2C_MASTER_SCL_IO CONFIG_I2C_SCL_GPIO
#define I2C_MASTER_FREQ_HZ 100000
#define I2C_MASTER_TIMEOUT_MS 1000

// BMP280 I2C Address
#define BMP280_ADDR CONFIG_BMP280_I2C_ADDR

// BMP280 Operating Modes
typedef enum {
  BMP280_MODE_WEATHER_MONITORING,  // Ultra low power: osrs_p=×1, osrs_t=×1, forced mode
  BMP280_MODE_HIGH_RESOLUTION      // High quality: osrs_p=×16, osrs_t=×2, forced mode (default)
} bmp280_mode_t;

esp_err_t bmp280_init(bmp280_mode_t mode);
void bmp280_read(float *temp, float *press, 
                 float temp_offset, float temp_factor,
                 float press_offset, float press_factor);
