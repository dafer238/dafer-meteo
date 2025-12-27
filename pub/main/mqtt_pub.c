#include "mqtt_pub.h"
#include "esp_log.h"
#include "mqtt_client.h"
#include <stdio.h>
#include <time.h>

#define MQTT_URI "mqtt://192.168.1.100"
#define MQTT_USER "esp32_home"
#define MQTT_PASS "2525"

static const char *TAG = "MQTT";

void mqtt_publish_measurement(const char *device_id, const char *fw,
                              float dht_temp, float dht_rh, float bmp_temp,
                              float bmp_press) {
  esp_mqtt_client_config_t cfg = {
      .broker.address.uri = MQTT_URI,
      .credentials.username = MQTT_USER,
      .credentials.authentication.password = MQTT_PASS,
  };

  esp_mqtt_client_handle_t client = esp_mqtt_client_init(&cfg);
  esp_mqtt_client_start(client);

  vTaskDelay(pdMS_TO_TICKS(2000));

  char payload[256];
  char topic[128];
  int64_t ts = time(NULL);

  snprintf(topic, sizeof(topic), "sensors/%s/environment", device_id);

  snprintf(payload, sizeof(payload),
           "{"
           "\"device_id\":\"%s\","
           "\"fw\":\"%s\","
           "\"ts_device\":%lld,"
           "\"dht22\":{\"temperature_c\":%.2f,\"humidity_percent\":%.2f},"
           "\"bmp280\":{\"temperature_c\":%.2f,\"pressure_pa\":%.2f}"
           "}",
           device_id, fw, ts, dht_temp, dht_rh, bmp_temp, bmp_press);

  esp_mqtt_client_publish(client, topic, payload, 0, 1, 0);
  ESP_LOGI(TAG, "Published to %s", topic);

  vTaskDelay(pdMS_TO_TICKS(1000));
  esp_mqtt_client_stop(client);
  esp_mqtt_client_destroy(client);
}
