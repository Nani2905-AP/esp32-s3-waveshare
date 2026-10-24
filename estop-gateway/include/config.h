#pragma once

// ================= Wi-Fi =================
#define WIFI_SSID      "YOUR_WIFI_NAME"
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"

// ============== MQTT broker ==============
// Mosquitto, Home Assistant, EMQX ... anything speaking MQTT 3.1.1
#define MQTT_HOST      "192.168.1.50"
#define MQTT_PORT      1883
#define MQTT_CLIENT_ID "gateway-line1"

// ================= Topics =================
#define TOPIC_ESTOP    "plant/line1/estop"     // published, RETAINED: "1" / "0"
#define TOPIC_LED_SET  "plant/line1/led/set"   // subscribed: "on" / "off" / "toggle"
#define TOPIC_STATUS   "plant/line1/status"    // retained "online"/"offline" (LWT)
#define TOPIC_STATE    "plant/line1/state"     // heartbeat JSON every 5 s

// ================= Wiring =================
#define ESTOP_GPIO          4    // NC e-stop contact between GPIO4 and GND
#define ESTOP_ACTIVE_LEVEL  LOW  // pressed / broken wire = LOW = ACTIVE
#define LED_GPIO            5    // status LED through ~330 R to GND
#define LED_ON              HIGH
#define LED_OFF             LOW

// ================= Timing =================
#define DEBOUNCE_MS    30
#define HEARTBEAT_MS   5000
#define WIFI_RETRY_MS  4000
#define MQTT_RETRY_MS  2000
