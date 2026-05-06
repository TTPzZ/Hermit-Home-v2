#pragma once
// ================================================================
//  config.example.h - Smart Terrarium firmware configuration sample
//  Copy this file to config.h and fill local secrets before flashing.
//  Do not commit config.h.
// ================================================================

// ----------------------------------------------------------------
//  SENSOR PINS
// ----------------------------------------------------------------
#define PIN_DHT22       4
#define LIGHT_SDA       20
#define LIGHT_SCL       19

// BOOT button (GPIO0): hold for 3 seconds to factory-reset device settings.
#define BOOT_PIN        0
#define BOOT_HOLD_RESET_MS 3000UL

// ----------------------------------------------------------------
//  RELAY PINS
//  This project uses high-level trigger relay modules:
//    HIGH = ON
//    LOW  = OFF
// ----------------------------------------------------------------
#define PIN_HEATER      15
#define PIN_MIST        16
#define PIN_LIGHT       17
#define PIN_FAN         18

// false = mist follows control logic/override normally.
#define MIST_SAFETY_LOCK false

#define RELAY_ON(pin)         digitalWrite(pin, HIGH)
#define RELAY_OFF(pin)        digitalWrite(pin, LOW)
#define RELAY_SET(pin, state) ((state) ? RELAY_ON(pin) : RELAY_OFF(pin))

// Captive-portal AP SSID used when device has no saved WiFi credentials.
#define WIFI_AP_SSID    "Hermit Home"

// ----------------------------------------------------------------
//  MQTT CONFIG - EMQX Cloud Serverless
// ----------------------------------------------------------------
#define MQTT_PROTOCOL   "mqtts"
#define MQTT_BROKER     "YOUR_EMQX_BROKER_HOST"
#define MQTT_PORT       8883
#define MQTT_USER       "YOUR_EMQX_USERNAME"
#define MQTT_PASS       "YOUR_EMQX_PASSWORD"
#define MQTT_CLIENT_ID  "ESP32_Garden_Phuc_001"

// NTP sync is required before TLS MQTT handshakes.
#define NTP_SERVER_1            "pool.ntp.org"
#define NTP_SERVER_2            "time.google.com"
#define NTP_GMT_OFFSET_SEC      (7 * 3600)
#define NTP_DAYLIGHT_OFFSET_SEC 0
#define NTP_SYNC_TIMEOUT_MS     15000U
#define NTP_MIN_VALID_EPOCH     1700000000UL

// ----------------------------------------------------------------
//  LOOP INTERVALS (milliseconds)
// ----------------------------------------------------------------
#define INTERVAL_SENSOR_MS      1000U
#define INTERVAL_PUBLISH_MS    10000U
#define INTERVAL_RECONNECT_MS   5000U
#define LOCAL_FALLBACK_DELAY_MS 120000U

// ----------------------------------------------------------------
//  DEFAULT HYSTERESIS THRESHOLDS
// ----------------------------------------------------------------
#define DEFAULT_TEMP_MIN    24.0f
#define DEFAULT_TEMP_MAX    29.0f
#define DEFAULT_HUM_MIN     70.0f
#define DEFAULT_HUM_MAX     85.0f
#define DEFAULT_LUX_MIN    200.0f
#define DEFAULT_LUX_MAX    500.0f
