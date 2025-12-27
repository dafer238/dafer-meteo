#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_sleep.h"
#include "nvs_flash.h"
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
  ESP_ERROR_CHECK(bmp280_init());
  ESP_ERROR_CHECK(dht22_init());

  // Blink to indicate sensor initialization complete
  led_blink(200);
  vTaskDelay(pdMS_TO_TICKS(100));

  float dht_temp = 0, dht_rh = 0;
  float bmp_temp = 0, bmp_press = 0;

  dht22_read(&dht_temp, &dht_rh);
  bmp280_read(&bmp_temp, &bmp_press);

  int8_t rssi = wifi_get_rssi();

  mqtt_publish_measurement(CONFIG_NODE_NAME, CONFIG_FW_VERSION, dht_temp, dht_rh, bmp_temp,
                           bmp_press, rssi);

  // Quick success blinks
  led_blink_success(3);

  ESP_LOGI(TAG, "Sleeping %d sec", CONFIG_PUBLISH_INTERVAL);
  
  // Turn off LED before deep sleep
  led_off();
  
  esp_sleep_enable_timer_wakeup(CONFIG_PUBLISH_INTERVAL * 1000000ULL);
  esp_deep_sleep_start();
}
