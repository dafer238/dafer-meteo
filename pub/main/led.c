#include "led.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "sdkconfig.h"

#define LED_GPIO CONFIG_LED_GPIO

static const char *TAG = "LED";

esp_err_t led_init(void) {
  gpio_config_t io_conf = {
      .pin_bit_mask = (1ULL << LED_GPIO),
      .mode = GPIO_MODE_OUTPUT,
      .pull_up_en = GPIO_PULLUP_DISABLE,
      .pull_down_en = GPIO_PULLDOWN_DISABLE,
      .intr_type = GPIO_INTR_DISABLE,
  };
  esp_err_t ret = gpio_config(&io_conf);
  if (ret == ESP_OK) {
    gpio_set_level(LED_GPIO, 0); // Start with LED off
    ESP_LOGI(TAG, "LED initialized on GPIO %d", LED_GPIO);
  }
  return ret;
}

void led_on(void) { gpio_set_level(LED_GPIO, 1); }

void led_off(void) { gpio_set_level(LED_GPIO, 0); }

void led_blink(int duration_ms) {
  led_on();
  vTaskDelay(pdMS_TO_TICKS(duration_ms));
  led_off();
}

void led_blink_success(int count) {
  for (int i = 0; i < count; i++) {
    led_on();
    vTaskDelay(pdMS_TO_TICKS(100));
    led_off();
    if (i < count - 1) {
      vTaskDelay(pdMS_TO_TICKS(100));
    }
  }
}
