#pragma once

void mqtt_publish_measurement(const char *device_id, const char *fw,
                              float dht_temp, float dht_rh, float bmp_temp,
                              float bmp_press);
