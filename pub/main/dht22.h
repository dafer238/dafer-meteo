#pragma once

#include "driver/gpio.h"
#include "esp_err.h"

#define DHT22_GPIO CONFIG_DHT22_GPIO

esp_err_t dht22_init(void);
void dht22_read(float *temp, float *rh,
                float temp_offset, float temp_factor,
                float rh_offset, float rh_factor);
