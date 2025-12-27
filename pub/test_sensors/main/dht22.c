#include "dht22.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "rom/ets_sys.h"

static const char *TAG = "DHT22";

esp_err_t dht22_init(void) {
  gpio_set_direction(DHT22_GPIO, GPIO_MODE_OUTPUT);
  gpio_set_level(DHT22_GPIO, 1);
  return ESP_OK;
}

static int wait_for_state(int state, int timeout_us) {
  int elapsed = 0;
  while (gpio_get_level(DHT22_GPIO) != state) {
    if (elapsed++ > timeout_us) {
      return -1;
    }
    ets_delay_us(1);
  }
  return elapsed;
}

void dht22_read(float *temp, float *rh) {
  uint8_t data[5] = {0};
  
  // Send start signal
  gpio_set_direction(DHT22_GPIO, GPIO_MODE_OUTPUT);
  gpio_set_level(DHT22_GPIO, 0);
  ets_delay_us(1000);
  gpio_set_level(DHT22_GPIO, 1);
  ets_delay_us(30);
  gpio_set_direction(DHT22_GPIO, GPIO_MODE_INPUT);

  // Wait for sensor response
  if (wait_for_state(0, 80) < 0) {
    ESP_LOGE(TAG, "Timeout waiting for sensor response");
    *temp = -999.0;
    *rh = -999.0;
    return;
  }
  if (wait_for_state(1, 80) < 0) {
    ESP_LOGE(TAG, "Timeout waiting for sensor ready");
    *temp = -999.0;
    *rh = -999.0;
    return;
  }
  if (wait_for_state(0, 80) < 0) {
    ESP_LOGE(TAG, "Timeout waiting for data start");
    *temp = -999.0;
    *rh = -999.0;
    return;
  }

  // Read 40 bits of data
  for (int i = 0; i < 40; i++) {
    if (wait_for_state(1, 50) < 0) {
      ESP_LOGE(TAG, "Timeout reading bit %d", i);
      *temp = -999.0;
      *rh = -999.0;
      return;
    }
    
    int duration = wait_for_state(0, 70);
    if (duration < 0) duration = 70;
    
    data[i / 8] <<= 1;
    if (duration > 40) {
      data[i / 8] |= 1;
    }
  }

  // Verify checksum
  if (data[4] != ((data[0] + data[1] + data[2] + data[3]) & 0xFF)) {
    ESP_LOGE(TAG, "Checksum error");
    *temp = -999.0;
    *rh = -999.0;
    return;
  }

  // Parse data
  uint16_t rh_raw = (data[0] << 8) | data[1];
  uint16_t temp_raw = (data[2] << 8) | data[3];
  
  *rh = rh_raw / 10.0;
  *temp = temp_raw / 10.0;
  
  // Handle negative temperatures
  if (temp_raw & 0x8000) {
    *temp = -(temp_raw & 0x7FFF) / 10.0;
  }

  ESP_LOGI(TAG, "Temperature: %.1f°C, Humidity: %.1f%%", *temp, *rh);
}
