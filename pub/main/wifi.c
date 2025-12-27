#include "wifi.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_wifi.h"
#include "freertos/event_groups.h"

#define WIFI_SSID "Los Perez"  // Replace with your actual WiFi SSID
#define WIFI_PASS "Losperez2026."  // Replace with your actual WiFi password

static EventGroupHandle_t wifi_event_group;
#define WIFI_CONNECTED_BIT BIT0

static const char *TAG = "WIFI";

static void wifi_event_handler(void *arg, esp_event_base_t event_base,
                               int32_t event_id, void *event_data) {
  if (event_id == WIFI_EVENT_STA_START)
    esp_wifi_connect();
  else if (event_id == IP_EVENT_STA_GOT_IP)
    xEventGroupSetBits(wifi_event_group, WIFI_CONNECTED_BIT);
}

void wifi_init_and_connect(void) {
  wifi_event_group = xEventGroupCreate();

  esp_netif_create_default_wifi_sta();
  wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
  esp_wifi_init(&cfg);

  esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler,
                             NULL);
  esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler,
                             NULL);

  wifi_config_t wifi_config = {
      .sta =
          {
              .ssid = WIFI_SSID,
              .password = WIFI_PASS,
          },
  };

  esp_wifi_set_mode(WIFI_MODE_STA);
  esp_wifi_set_config(WIFI_IF_STA, &wifi_config);
  esp_wifi_start();

  xEventGroupWaitBits(wifi_event_group, WIFI_CONNECTED_BIT, false, true,
                      portMAX_DELAY);

  ESP_LOGI(TAG, "Wi-Fi connected");
}

int8_t wifi_get_rssi(void) {
  wifi_ap_record_t ap_info;
  esp_err_t err = esp_wifi_sta_get_ap_info(&ap_info);
  if (err != ESP_OK) {
    ESP_LOGE(TAG, "Failed to get AP info: %s", esp_err_to_name(err));
    return 0;
  }
  ESP_LOGI(TAG, "RSSI: %d dBm", ap_info.rssi);
  return ap_info.rssi;
}
