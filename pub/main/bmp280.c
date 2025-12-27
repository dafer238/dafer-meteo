#include "bmp280.h"
#include "esp_log.h"
#include <string.h>

static const char *TAG = "BMP280";

// BMP280 Registers
#define BMP280_REG_TEMP_XLSB 0xFC
#define BMP280_REG_TEMP_LSB 0xFB
#define BMP280_REG_TEMP_MSB 0xFA
#define BMP280_REG_PRESS_XLSB 0xF9
#define BMP280_REG_PRESS_LSB 0xF8
#define BMP280_REG_PRESS_MSB 0xF7
#define BMP280_REG_CONFIG 0xF5
#define BMP280_REG_CTRL_MEAS 0xF4
#define BMP280_REG_STATUS 0xF3
#define BMP280_REG_RESET 0xE0
#define BMP280_REG_ID 0xD0
#define BMP280_REG_CALIB 0x88

// Mode configuration storage
static struct {
  bmp280_mode_t mode;
  uint8_t ctrl_meas_value;  // Control register value for forced mode
  uint8_t meas_time_ms;     // Typical measurement time
} mode_config;

// Calibration data
static struct {
  uint16_t dig_T1;
  int16_t dig_T2;
  int16_t dig_T3;
  uint16_t dig_P1;
  int16_t dig_P2;
  int16_t dig_P3;
  int16_t dig_P4;
  int16_t dig_P5;
  int16_t dig_P6;
  int16_t dig_P7;
  int16_t dig_P8;
  int16_t dig_P9;
  int32_t t_fine;
} calib;

static esp_err_t bmp280_write_reg(uint8_t reg, uint8_t data) {
  uint8_t write_buf[2] = {reg, data};
  return i2c_master_write_to_device(I2C_MASTER_NUM, BMP280_ADDR, write_buf, 2,
                                    pdMS_TO_TICKS(I2C_MASTER_TIMEOUT_MS));
}

static esp_err_t bmp280_read_reg(uint8_t reg, uint8_t *data, size_t len) {
  return i2c_master_write_read_device(I2C_MASTER_NUM, BMP280_ADDR, &reg, 1,
                                      data, len,
                                      pdMS_TO_TICKS(I2C_MASTER_TIMEOUT_MS));
}

esp_err_t bmp280_init(bmp280_mode_t mode) {
  esp_err_t ret;

  // Store mode configuration
  mode_config.mode = mode;
  
  if (mode == BMP280_MODE_WEATHER_MONITORING) {
    // Ultra low power: osrs_t=001 (×1), osrs_p=001 (×1), mode=01 (forced)
    mode_config.ctrl_meas_value = 0x25;  // 00100101
    mode_config.meas_time_ms = 10;       // ~7.5ms typical
  } else { // BMP280_MODE_HIGH_RESOLUTION (default)
    // High resolution: osrs_t=010 (×2), osrs_p=101 (×16), mode=01 (forced)
    mode_config.ctrl_meas_value = 0x55;  // 01010101
    mode_config.meas_time_ms = 50;       // ~43.5ms typical
  }

  // Configure I2C
  i2c_config_t conf = {
      .mode = I2C_MODE_MASTER,
      .sda_io_num = I2C_MASTER_SDA_IO,
      .scl_io_num = I2C_MASTER_SCL_IO,
      .sda_pullup_en = GPIO_PULLUP_ENABLE,
      .scl_pullup_en = GPIO_PULLUP_ENABLE,
      .master.clk_speed = I2C_MASTER_FREQ_HZ,
  };

  ret = i2c_param_config(I2C_MASTER_NUM, &conf);
  if (ret != ESP_OK) {
    ESP_LOGE(TAG, "I2C config failed");
    return ret;
  }

  ret = i2c_driver_install(I2C_MASTER_NUM, conf.mode, 0, 0, 0);
  if (ret != ESP_OK) {
    ESP_LOGE(TAG, "I2C driver install failed");
    return ret;
  }

  // Check chip ID
  uint8_t chip_id;
  ret = bmp280_read_reg(BMP280_REG_ID, &chip_id, 1);
  if (ret != ESP_OK || chip_id != 0x58) {
    ESP_LOGE(TAG, "BMP280 not found (ID: 0x%02X)", chip_id);
    return ESP_FAIL;
  }

  ESP_LOGI(TAG, "BMP280 detected (ID: 0x%02X)", chip_id);

  // Read calibration data
  uint8_t calib_data[24];
  ret = bmp280_read_reg(BMP280_REG_CALIB, calib_data, 24);
  if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Failed to read calibration data");
    return ret;
  }

  calib.dig_T1 = (calib_data[1] << 8) | calib_data[0];
  calib.dig_T2 = (calib_data[3] << 8) | calib_data[2];
  calib.dig_T3 = (calib_data[5] << 8) | calib_data[4];
  calib.dig_P1 = (calib_data[7] << 8) | calib_data[6];
  calib.dig_P2 = (calib_data[9] << 8) | calib_data[8];
  calib.dig_P3 = (calib_data[11] << 8) | calib_data[10];
  calib.dig_P4 = (calib_data[13] << 8) | calib_data[12];
  calib.dig_P5 = (calib_data[15] << 8) | calib_data[14];
  calib.dig_P6 = (calib_data[17] << 8) | calib_data[16];
  calib.dig_P7 = (calib_data[19] << 8) | calib_data[18];
  calib.dig_P8 = (calib_data[21] << 8) | calib_data[20];
  calib.dig_P9 = (calib_data[23] << 8) | calib_data[22];

  // Put sensor in sleep mode initially
  uint8_t sleep_mode = (mode_config.ctrl_meas_value & 0xFC); // Clear mode bits to set sleep
  bmp280_write_reg(BMP280_REG_CTRL_MEAS, sleep_mode);
  
  // Config: standby time doesn't matter in forced mode, filter off (000)
  // t_sb[2:0]=000, filter[2:0]=000, spi3w_en=0
  bmp280_write_reg(BMP280_REG_CONFIG, 0x00);

  const char *mode_name = (mode_config.mode == BMP280_MODE_WEATHER_MONITORING) 
                          ? "Weather monitoring (osrs_t=×1, osrs_p=×1)" 
                          : "High resolution (osrs_t=×2, osrs_p=×16)";
  ESP_LOGI(TAG, "BMP280 initialized - Mode: %s, Forced mode, filter=off", mode_name);
  return ESP_OK;
}

static int32_t bmp280_compensate_temp(int32_t adc_T) {
  int32_t var1, var2;
  var1 = ((((adc_T >> 3) - ((int32_t)calib.dig_T1 << 1))) *
          ((int32_t)calib.dig_T2)) >>
         11;
  var2 = (((((adc_T >> 4) - ((int32_t)calib.dig_T1)) *
            ((adc_T >> 4) - ((int32_t)calib.dig_T1))) >>
           12) *
          ((int32_t)calib.dig_T3)) >>
         14;
  calib.t_fine = var1 + var2;
  return (calib.t_fine * 5 + 128) >> 8;
}

static uint32_t bmp280_compensate_press(int32_t adc_P) {
  int64_t var1, var2, p;
  var1 = ((int64_t)calib.t_fine) - 128000;
  var2 = var1 * var1 * (int64_t)calib.dig_P6;
  var2 = var2 + ((var1 * (int64_t)calib.dig_P5) << 17);
  var2 = var2 + (((int64_t)calib.dig_P4) << 35);
  var1 = ((var1 * var1 * (int64_t)calib.dig_P3) >> 8) +
         ((var1 * (int64_t)calib.dig_P2) << 12);
  var1 = (((((int64_t)1) << 47) + var1)) * ((int64_t)calib.dig_P1) >> 33;
  
  if (var1 == 0) {
    return 0;
  }
  
  p = 1048576 - adc_P;
  p = (((p << 31) - var2) * 3125) / var1;
  var1 = (((int64_t)calib.dig_P9) * (p >> 13) * (p >> 13)) >> 25;
  var2 = (((int64_t)calib.dig_P8) * p) >> 19;
  p = ((p + var1 + var2) >> 8) + (((int64_t)calib.dig_P7) << 4);
  
  return (uint32_t)p;
}

void bmp280_read(float *temp, float *press,
                 float temp_offset, float temp_factor,
                 float press_offset, float press_factor) {
  // Trigger forced mode measurement with configured oversampling
  esp_err_t ret = bmp280_write_reg(BMP280_REG_CTRL_MEAS, mode_config.ctrl_meas_value);
  if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Failed to trigger measurement");
    *temp = -999.0;
    *press = -999.0;
    return;
  }

  // Wait for measurement to complete based on mode
  vTaskDelay(pdMS_TO_TICKS(mode_config.meas_time_ms));

  // Check if measurement is done (bit 3 of status register = 0 when ready)
  uint8_t status;
  for (int i = 0; i < 10; i++) {
    bmp280_read_reg(BMP280_REG_STATUS, &status, 1);
    if ((status & 0x08) == 0) break; // measuring bit cleared
    vTaskDelay(pdMS_TO_TICKS(1));
  }

  uint8_t data[6];
  
  ret = bmp280_read_reg(BMP280_REG_PRESS_MSB, data, 6);
  if (ret != ESP_OK) {
    ESP_LOGE(TAG, "Failed to read sensor data");
    *temp = -999.0;
    *press = -999.0;
    return;
  }

  int32_t adc_P = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4);
  int32_t adc_T = (data[3] << 12) | (data[4] << 4) | (data[5] >> 4);

  int32_t T = bmp280_compensate_temp(adc_T);
  uint32_t P = bmp280_compensate_press(adc_P);

  float raw_temp = T / 100.0;
  float raw_press = P / 256.0;

  // Apply calibration: calibrated = (raw * factor) + offset
  *temp = (raw_temp * temp_factor) + temp_offset;
  *press = (raw_press * press_factor) + press_offset;

  ESP_LOGI(TAG, "Temperature: %.2f°C (raw: %.2f°C), Pressure: %.2f Pa (raw: %.2f Pa)", 
           *temp, raw_temp, *press, raw_press);
}
