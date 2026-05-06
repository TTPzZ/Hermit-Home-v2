# EMQX Migration Guide

This project now uses EMQX as the MQTT broker between the ESP32-S3 firmware, Vercel API, and the always-on MQTT worker.

## Target Architecture

```text
Flutter app
  -> Vercel API
  -> EMQX Cloud MQTT broker
  -> ESP32-S3

ESP32-S3
  -> EMQX Cloud MQTT broker
  -> mqtt-worker
  -> MongoDB
```

Vercel remains the main REST API for the Flutter app. EMQX only carries realtime MQTT messages. The `mqtt-worker` still needs an always-on host such as Render, Railway, Fly.io, or a VPS because it keeps a persistent MQTT subscription open.

## EMQX Cloud Setup

1. Create an EMQX Cloud Serverless deployment.
2. Copy the broker host from the deployment overview.
3. Create MQTT username/password credentials under Access Control.
4. Use MQTT over TLS:
   - `MQTT_PROTOCOL=mqtts`
   - `MQTT_PORT=8883`
5. Keep `MQTT_BROKER` as the original EMQX host only. Do not use `mqtts://`, `https://`, `/mqtt`, an IP address, or a custom CNAME.

## Vercel API Environment

Set these variables in your Vercel project:

```env
MQTT_PROTOCOL=mqtts
MQTT_BROKER=<replace_with_emqx_broker_host>
MQTT_PORT=8883
MQTT_USER=<replace_with_emqx_username>
MQTT_PASS=<replace_with_emqx_password>
MQTT_CA_CERT=
```

Keep the existing MongoDB, auth, OpenRouter, and service-key variables unchanged.

## MQTT Worker Environment

Use the same MQTT values for `services/mqtt-worker`:

```env
MQTT_PROTOCOL=mqtts
MQTT_BROKER=<replace_with_emqx_broker_host>
MQTT_PORT=8883
MQTT_USER=<replace_with_emqx_username>
MQTT_PASS=<replace_with_emqx_password>
MQTT_CA_CERT=
```

On Render, the root `render.yaml` already declares `MQTT_PROTOCOL=mqtts` and `MQTT_PORT=8883`; fill the synced secrets in the Render dashboard.

## ESP32 Firmware

`hardware/esp32/include/config.h` is intentionally ignored by Git because it contains local WiFi/MQTT secrets. If the file does not exist on a fresh clone, copy `hardware/esp32/include/config.example.h` to `hardware/esp32/include/config.h`, then update it before flashing:

```cpp
#define MQTT_PROTOCOL   "mqtts"
#define MQTT_BROKER     "<replace_with_emqx_broker_host>"
#define MQTT_PORT       8883
#define MQTT_USER       "<replace_with_emqx_username>"
#define MQTT_PASS       "<replace_with_emqx_password>"
```

The broker must be the same EMQX host used by Vercel and the worker. TLS connections require the ESP32 clock to be synced; the firmware already performs NTP sync before connecting.

## Topic Contract

The system expects these topics:

```text
terrarium/telemetry/{deviceId}
terrarium/commands/{deviceId}
terrarium/confirm/{deviceId}
```

The `deviceId` used by the ESP32 captive portal must match the MongoDB device ObjectId that the Flutter app/API uses. If these values differ, Vercel can publish a command successfully but the ESP32 will not receive it.

## Smoke Test

1. Connect to EMQX with MQTTX using the same host, port, username, and password.
2. Subscribe to `terrarium/#`.
3. Flash the ESP32 and confirm telemetry appears on `terrarium/telemetry/{deviceId}`.
4. Start `mqtt-worker` and confirm telemetry is saved to MongoDB.
5. Use the Flutter app or API to send a control command and confirm ESP32 publishes an ack on `terrarium/confirm/{deviceId}`.
