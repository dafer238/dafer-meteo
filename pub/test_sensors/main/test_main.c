#include "esp_log.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <stdio.h>

#include "sensor_config.h"
#include "bmp280.h"
#include "dht22.h"

static const char *TAG = "SENSOR_TEST";

void app_main(void) {
  ESP_LOGI(TAG, "=== ESP32 Sensor Wiring Test ===");
  ESP_LOGI(TAG, "Testing DHT22 and BMP280 sensors");

  ESP_ERROR_CHECK(nvs_flash_init());

  // Initialize sensors
  ESP_LOGI(TAG, "\n--- Initializing BMP280 ---");
  esp_err_t bmp_ret = bmp280_init();
  if (bmp_ret == ESP_OK) {
    ESP_LOGI(TAG, "✓ BMP280 initialized successfully");
  } else {
    ESP_LOGE(TAG, "✗ BMP280 initialization failed!");
    ESP_LOGE(TAG, "  Check: CSB→3.3V, SDO→GND, SDA→GPIO21, SCL→GPIO22");
  }

  ESP_LOGI(TAG, "\n--- Initializing DHT22 ---");
  esp_err_t dht_ret = dht22_init();
  if (dht_ret == ESP_OK) {
    ESP_LOGI(TAG, "✓ DHT22 initialized successfully");
  } else {
    ESP_LOGE(TAG, "✗ DHT22 initialization failed!");
  }

  ESP_LOGI(TAG, "\n=== Starting Continuous Reading ===");
  ESP_LOGI(TAG, "Reading sensors every 3 seconds...\n");

  int reading_count = 0;
  
  while (1) {
    reading_count++;
    ESP_LOGI(TAG, "--- Reading #%d ---", reading_count);

    // Read DHT22
    float dht_temp = 0, dht_rh = 0;
    dht22_read(&dht_temp, &dht_rh);
    
    if (dht_temp > -100) {  // Valid reading
    } else {
      printf("  DHT22  → ✗ Read failed (check wiring & pull-up resistor)\n");
    }

    // Read BMP280
    float bmp_temp = 0, bmp_press = 0;
    if (bmp_ret == ESP_OK) {
      bmp280_read(&bmp_temp, &bmp_press);
      
      if (bmp_temp > -100) {  // Valid reading
      } else {
        printf("  BMP280 → ✗ Read failed\n");
      }
    }

    printf("\n");
    vTaskDelay(pdMS_TO_TICKS(3000));  // Wait 3 seconds
  }
}
