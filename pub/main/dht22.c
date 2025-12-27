#include "dht22.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "rom/ets_sys.h"

static const char *TAG = "DHT22";

esp_err_t dht22_init(void) {
  // Configure GPIO with internal pullup
  gpio_config_t io_conf = {
    .pin_bit_mask = (1ULL << DHT22_GPIO),
    .mode = GPIO_MODE_OUTPUT,
    .pull_up_en = GPIO_PULLUP_ENABLE,
    .pull_down_en = GPIO_PULLDOWN_DISABLE,
    .intr_type = GPIO_INTR_DISABLE,
  };
  gpio_config(&io_conf);
  gpio_set_level(DHT22_GPIO, 1);
  
  ESP_LOGI(TAG, "DHT22 initialized");
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

void dht22_read(float *temp, float *rh,
                float temp_offset, float temp_factor,
                float rh_offset, float rh_factor) {
  uint8_t data[5] = {0};
  bool read_success = true;
  
  // Disable interrupts during timing-critical section
  portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;
  portENTER_CRITICAL(&mux);
  
  // Send start signal - pull low for at least 1ms
  gpio_set_direction(DHT22_GPIO, GPIO_MODE_OUTPUT);
  gpio_set_level(DHT22_GPIO, 0);
  ets_delay_us(1200); // Slightly longer start signal
  gpio_set_level(DHT22_GPIO, 1);
  ets_delay_us(30);
  
  // Switch to input mode with pullup
  gpio_set_direction(DHT22_GPIO, GPIO_MODE_INPUT);
  ets_delay_us(10);

  // Wait for sensor response
  if (wait_for_state(0, 100) < 0) {
    portEXIT_CRITICAL(&mux);
    ESP_LOGE(TAG, "Timeout waiting for sensor response");
    *temp = -999.0;
    *rh = -999.0;
    return;
  }
  if (wait_for_state(1, 100) < 0) {
    portEXIT_CRITICAL(&mux);
    ESP_LOGE(TAG, "Timeout waiting for sensor ready");
    *temp = -999.0;
    *rh = -999.0;
    return;
  }
  if (wait_for_state(0, 100) < 0) {
    portEXIT_CRITICAL(&mux);
    ESP_LOGE(TAG, "Timeout waiting for data start");
    *temp = -999.0;
    *rh = -999.0;
    return;
  }

  // Read 40 bits of data
  for (int i = 0; i < 40; i++) {
    if (wait_for_state(1, 70) < 0) {
      ESP_LOGE(TAG, "Timeout reading bit %d", i);
      read_success = false;
      break;
    }
    
    int duration = wait_for_state(0, 90);
    if (duration < 0) duration = 80;
    
    data[i / 8] <<= 1;
    if (duration > 40) {
      data[i / 8] |= 1;
    }
  }
  
  portEXIT_CRITICAL(&mux);
  
  if (!read_success) {
    *temp = -999.0;
    *rh = -999.0;
    return;
  }

  // Verify checksum
  uint8_t checksum = (data[0] + data[1] + data[2] + data[3]) & 0xFF;
  if (data[4] != checksum) {
    ESP_LOGE(TAG, "Checksum error: expected 0x%02X, got 0x%02X", checksum, data[4]);
    *temp = -999.0;
    *rh = -999.0;
    return;
  }

  // Parse data
  uint16_t rh_raw = (data[0] << 8) | data[1];
  uint16_t temp_raw = (data[2] << 8) | data[3];
  
  float raw_rh = rh_raw / 10.0;
  float raw_temp = temp_raw / 10.0;
  
  // Handle negative temperatures
  if (temp_raw & 0x8000) {
    raw_temp = -(temp_raw & 0x7FFF) / 10.0;
  }
  
  // Sanity check: DHT22 range is -40 to 80°C, 0-100% RH
  if (raw_temp < -40.0 || raw_temp > 80.0) {
    ESP_LOGE(TAG, "Temperature out of range: %.1f°C (raw bytes: 0x%02X 0x%02X)", 
             raw_temp, data[2], data[3]);
    *temp = -999.0;
    *rh = -999.0;
    return;
  }
  if (raw_rh < 0.0 || raw_rh > 100.0) {
    ESP_LOGE(TAG, "Humidity out of range: %.1f%% (raw bytes: 0x%02X 0x%02X)", 
             raw_rh, data[0], data[1]);
    *temp = -999.0;
    *rh = -999.0;
    return;
  }

  // Apply calibration: calibrated = (raw * factor) + offset
  *rh = (raw_rh * rh_factor) + rh_offset;
  *temp = (raw_temp * temp_factor) + temp_offset;

  ESP_LOGI(TAG, "Temperature: %.1f°C (raw: %.1f°C), Humidity: %.1f%% (raw: %.1f%%)", 
           *temp, raw_temp, *rh, raw_rh);
}
