#pragma once

#include "sensor_config.h"
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

esp_err_t bmp280_init(void);
void bmp280_read(float *temp, float *press);
