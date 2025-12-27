#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_sleep.h"
#include "nvs_flash.h"
#include <stdio.h>
#include <time.h>

#include "bmp280.h"
#include "dht22.h"
#include "mqtt_pub.h"
#include "wifi.h"

#define DEVICE_ID "living_room"
#define FW_VERSION "0.1.0"
#define SLEEP_SEC 30

static const char *TAG = "MAIN";

void app_main(void) {
  ESP_LOGI(TAG, "Boot %s FW %s", DEVICE_ID, FW_VERSION);

  ESP_ERROR_CHECK(nvs_flash_init());
  ESP_ERROR_CHECK(esp_netif_init());
  ESP_ERROR_CHECK(esp_event_loop_create_default());

  wifi_init_and_connect();

  /* Optional SNTP later */

  float dht_temp = 0, dht_rh = 0;
  float bmp_temp = 0, bmp_press = 0;

  dht22_read(&dht_temp, &dht_rh);
  bmp280_read(&bmp_temp, &bmp_press);

  mqtt_publish_measurement(DEVICE_ID, FW_VERSION, dht_temp, dht_rh, bmp_temp,
                           bmp_press);

  ESP_LOGI(TAG, "Sleeping %d sec", SLEEP_SEC);
  esp_sleep_enable_timer_wakeup(SLEEP_SEC * 1000000ULL);
  esp_deep_sleep_start();
}
