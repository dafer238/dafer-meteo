#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/gpio.h"
#include "esp_log.h"

// Most ESP32 dev boards have an onboard LED on GPIO2
// If your board uses a different GPIO, change this value
#define LED_GPIO 2

static const char *TAG = "LED_BLINK";

void app_main(void)
{

    printf("LED GPIO: %d\n", LED_GPIO);

    
    ESP_LOGI(TAG, "=== ESP32 LED Blink Test ===");
    ESP_LOGI(TAG, "Blinking onboard LED on GPIO%d", LED_GPIO);
    
    // Configure the GPIO pin as output
    gpio_reset_pin(LED_GPIO);
    gpio_set_direction(LED_GPIO, GPIO_MODE_OUTPUT);
    
    ESP_LOGI(TAG, "LED initialized. Starting blink loop...");
    printf("Watch the onboard LED and this serial output!\n\n");
    
    int blink_count = 0;
    
    while (1) {
        blink_count++;
        
        // Turn LED ON
        gpio_set_level(LED_GPIO, 1);
        ESP_LOGI(TAG, "LED ON  (blink #%d)", blink_count);
        vTaskDelay(1000 / portTICK_PERIOD_MS);  // Wait 1 second
        
        // Turn LED OFF
        gpio_set_level(LED_GPIO, 0);
        ESP_LOGI(TAG, "LED OFF (blink #%d)", blink_count);
        vTaskDelay(1000 / portTICK_PERIOD_MS);  // Wait 1 second
    }
}
