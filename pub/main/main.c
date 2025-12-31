#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_sleep.h"
#include "esp_system.h"
#include "nvs_flash.h"
#include <math.h>
#include <stdio.h>
#include <time.h>

#include "bmp280.h"
#include "dht22.h"
#include "led.h"
#include "mqtt_pub.h"
#include "wifi.h"

static const char *TAG = "MAIN";

void app_main(void) {
  ESP_LOGI(TAG, "Boot %s FW %s", CONFIG_NODE_NAME, CONFIG_FW_VERSION);

  // Initialize LED and blink to show activity
  ESP_ERROR_CHECK(led_init());
  led_on();

  ESP_ERROR_CHECK(nvs_flash_init());
  ESP_ERROR_CHECK(esp_netif_init());
  ESP_ERROR_CHECK(esp_event_loop_create_default());

  wifi_init_and_connect();

  /* Optional SNTP later */

  // Initialize sensors
  ESP_LOGI(TAG, "Initializing sensors...");
  ESP_ERROR_CHECK(bmp280_init(BMP280_MODE_HIGH_RESOLUTION)); // Use high quality mode
  ESP_ERROR_CHECK(dht22_init());

  // Blink to indicate sensor initialization complete
  led_blink(200);
  vTaskDelay(pdMS_TO_TICKS(100));

  float dht_temp = 0, dht_rh = 0;
  float bmp_temp = 0, bmp_press = 0;

  // Read sensors with calibration factors
  // DHT22: no calibration applied (factor=1.0, offset=0.0)
  dht22_read(&dht_temp, &dht_rh, 0.0, 1.0, 0.0, 1.0);
  
  // BMP280: apply -1.2°C offset to temperature (module heating compensation)
  // Temperature: offset=-1.2, factor=1.0
  // Pressure: no calibration (offset=0.0, factor=1.0)
  bmp280_read(&bmp_temp, &bmp_press, 0, 1.0, 0.0, 1.0);

  int8_t rssi = wifi_get_rssi();

  // Calculate altitude from pressure (standard barometric formula)
  // Using sea level pressure of 101325 Pa
  float altitude_m = 44330.0 * (1.0 - pow(bmp_press / 101325.0, 1/5.225));
  
  // Get free heap memory in bytes
  uint32_t free_heap = esp_get_free_heap_size();
  
  ESP_LOGI(TAG, "Altitude: %.1f m, Free heap: %lu bytes", altitude_m, free_heap);

  mqtt_publish_measurement(CONFIG_NODE_NAME, CONFIG_FW_VERSION, dht_temp, dht_rh, bmp_temp,
                           bmp_press, rssi, altitude_m, free_heap);

  // Quick success blinks
  led_blink_success(3);

  ESP_LOGI(TAG, "Sleeping %d ms (%.1f sec)", CONFIG_PUBLISH_INTERVAL, CONFIG_PUBLISH_INTERVAL / 1000.0);
  
  // Turn off LED before deep sleep
  led_off();
  
  esp_sleep_enable_timer_wakeup(CONFIG_PUBLISH_INTERVAL * 1000ULL);
  esp_deep_sleep_start();
}
