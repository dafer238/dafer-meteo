#pragma once

#include "sensor_config.h"
#include "driver/gpio.h"
#include "esp_err.h"

#define DHT22_GPIO CONFIG_DHT22_GPIO

esp_err_t dht22_init(void);
void dht22_read(float *temp, float *rh);
