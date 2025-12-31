import json
import time
import sqlite3
import logging
import os
from typing import Any, Dict

from dotenv import load_dotenv
import paho.mqtt.client as mqtt

# ----------------------------
# Load environment variables
# ----------------------------

load_dotenv()

MQTT_USERNAME = os.getenv("MQTT_USERNAME")
MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")
MQTT_BROKER = os.getenv("MQTT_BROKER", "localhost")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
MQTT_TOPIC = os.getenv("MQTT_TOPIC", "sensors/#")

SQLITE_DB = os.getenv("SQLITE_DB", "environment_data.db")

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# ----------------------------
# Logging
# ----------------------------

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# ----------------------------
# Database
# ----------------------------


def init_db(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS measurements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            device_id TEXT NOT NULL,
            topic TEXT NOT NULL,

            dht22_temperature_c REAL,
            dht22_humidity_percent REAL,

            bmp280_temperature_c REAL,
            bmp280_pressure_pa REAL,

            timestamp_device INTEGER,
            timestamp_server INTEGER NOT NULL,

            firmware_version TEXT,
            rssi INTEGER,
            altitude_m REAL,
            free_heap INTEGER
        )
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_device_time
        ON measurements(device_id, timestamp_server)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_time
        ON measurements(timestamp_server)
    """)

    conn.commit()


# ----------------------------
# MQTT Callbacks
# ----------------------------


def on_connect(client, userdata, flags, rc):
    if rc == 0:
        logging.info("Connected to MQTT broker")
        client.subscribe(MQTT_TOPIC)
    else:
        logging.error(f"MQTT connection failed with code {rc}")


def safe_get(d: Dict[str, Any], *keys):
    cur = d
    for k in keys:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(k)
    return cur


def on_message(client, userdata, msg):
    conn: sqlite3.Connection = userdata["db"]
    now = int(time.time())

    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except json.JSONDecodeError:
        logging.warning("Received non-JSON payload")
        return

    device_id = payload.get("device_id", "unknown")
    firmware = payload.get("fw")
    ts_device = payload.get("ts_device")
    rssi = payload.get("rssi")
    altitude_m = payload.get("altitude_m")
    free_heap = payload.get("free_heap")

    dht22_temp = safe_get(payload, "dht22", "temperature_c")
    dht22_rh = safe_get(payload, "dht22", "humidity_percent")

    bmp_temp = safe_get(payload, "bmp280", "temperature_c")
    bmp_press = safe_get(payload, "bmp280", "pressure_pa")

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO measurements (
                device_id,
                topic,
                dht22_temperature_c,
                dht22_humidity_percent,
                bmp280_temperature_c,
                bmp280_pressure_pa,
                timestamp_device,
                timestamp_server,
                firmware_version,
                rssi,
                altitude_m,
                free_heap
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                device_id,
                msg.topic,
                dht22_temp,
                dht22_rh,
                bmp_temp,
                bmp_press,
                ts_device,
                now,
                firmware,
                rssi,
                altitude_m,
                free_heap,
            ),
        )
        conn.commit()
        logging.info(f"Stored data from {device_id}")
    except sqlite3.Error as e:
        logging.error(f"SQLite error: {e}")


# ----------------------------
# Main
# ----------------------------


def main():
    conn = sqlite3.connect(SQLITE_DB, check_same_thread=False)
    init_db(conn)

    client = mqtt.Client(userdata={"db": conn})
    client.on_connect = on_connect
    client.on_message = on_message

    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)

    logging.info("MQTT listener started")
    client.loop_forever()


if __name__ == "__main__":
    main()
