### Installation
```bash
sudo apt update
sudo apt install mosquitto mosquitto-clients
sudo systemctl enable mosquitto
sudo systemctl start mosquitto
```


### First create password.
```bash
sudo mosquitto_passwd -c /etc/mosquitto/passwd esp32_home
```
#### Introduce in the file
```bash
sudo nvim /etc/mosquitto/conf.d/auth.conf
```
```conf
allow_anonymous false
password_file /etc/mosquitto/passwd
```
```bash
sudo chown root:mosquitto /etc/mosquitto/passwd
sudo chmod 640 /etc/mosquitto/passwd
```
### Restart the service
```bash
sudo systemctl restart mosquitto
```

### Create a service
```bash
sudo nvim /etc/systemd/system/mqtt-esp32-logger.service
```
```ini
[Unit]
Description=MQTT ESP32 Sensor Logger
After=network.target mosquitto.service

[Service]
ExecStart=/usr/bin/python3 /home/dafer/programming/dafer-meteo/main.py
WorkingDirectory=/home/dafer/programming/dafer-meteo
Restart=always
User=dafer
EnvironmentFile=/home/dafer/programming/dafer-meteo/.env

[Install]
WantedBy=multi-user.target
```
### To start it

```bash
sudo systemctl daemon-reload
sudo systemctl enable mqtt-logger
sudo systemctl start mqtt-logger
```
### To see the logs
```bash
journalctl -u mqtt-logger -f
```
