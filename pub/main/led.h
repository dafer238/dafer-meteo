#ifndef LED_H
#define LED_H

#include "esp_err.h"

/**
 * @brief Initialize the LED GPIO
 */
esp_err_t led_init(void);

/**
 * @brief Turn LED on
 */
void led_on(void);

/**
 * @brief Turn LED off
 */
void led_off(void);

/**
 * @brief Blink LED once
 * @param duration_ms Duration in milliseconds
 */
void led_blink(int duration_ms);

/**
 * @brief Blink LED multiple times quickly
 * @param count Number of times to blink
 */
void led_blink_success(int count);

#endif // LED_H
