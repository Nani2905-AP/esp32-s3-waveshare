/* ============================================================
 * ESP32-S3 IoT gateway — 1 NC e-stop button + 1 status LED
 *
 * Pattern (same as IO Desk lesson 11):
 *   publish  plant/line1/estop  "1"/"0", retained
 *   publish  plant/line1/status "online", + LWT -> "offline"
 *   publish  plant/line1/state  heartbeat JSON every 5 s
 *   subscribe plant/line1/led/set  "on"/"off"/"toggle"
 *
 * Safety model: the LED is only ever touchable while the e-stop
 * is released. Copper stops the machine; MQTT tells you about it.
 * ============================================================ */
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "config.h"

WiFiClient   netClient;
PubSubClient mqtt(netClient);

/* ---------- field state ---------- */
static bool estopActive = false;   // software mirror of the hardwired e-stop
static bool ledCmd      = false;   // last LED order from the dashboard

/* ---------- timing bookkeeping ---------- */
static int      estopRawLast  = -1;
static uint32_t estopEdgeMs   = 0;
static uint32_t lastHeartbeat = 0;
static uint32_t lastWifiTry   = 0;
static uint32_t lastMqttTry   = 0;
static uint32_t lastNetLog    = 0;

static void ledWrite(bool on) { digitalWrite(LED_GPIO, on ? LED_ON : LED_OFF); }

static void publishEstop() {
  mqtt.publish(TOPIC_ESTOP, estopActive ? "1" : "0", true);  // retained
  Serial.printf("[mqtt] %s = %d (retained)\n", TOPIC_ESTOP, estopActive);
}

static void publishHeartbeat() {
  char buf[160];
  snprintf(buf, sizeof(buf),
           "{\"estop\":%d,\"led\":%d,\"uptime_s\":%lu,\"rssi\":%d}",
           estopActive, estopActive ? 0 : ledCmd,
           (unsigned long)(millis() / 1000), WiFi.RSSI());
  mqtt.publish(TOPIC_STATE, buf);  // live data, NOT retained
  lastHeartbeat = millis();
}

/* ---------- dashboard -> gateway commands ---------- */
static void onMqttMsg(char* topic, byte* payload, unsigned int len) {
  char msg[16] = {0};
  size_t n = (len < sizeof(msg) - 1) ? len : sizeof(msg) - 1;
  memcpy(msg, payload, n);
  for (char* p = msg; *p; ++p) *p = tolower(*p);   // "ON", "On" -> "on"

  if (strcmp(topic, TOPIC_LED_SET) != 0) return;
  if (estopActive) {
    Serial.printf(">> %s = \"%s\"  ->  IGNORED, e-stop is latched\n", topic, msg);
    return;
  }
  if      (!strcmp(msg, "on"))     ledCmd = true;
  else if (!strcmp(msg, "off"))    ledCmd = false;
  else if (!strcmp(msg, "toggle")) ledCmd = !ledCmd;
  else { Serial.printf(">> unknown payload \"%s\"\n", msg); return; }

  ledWrite(ledCmd);
  Serial.printf(">> %s = \"%s\"  ->  LED %s\n", topic, msg, ledCmd ? "ON" : "OFF");
}

/* ---------- debounced active-LOW input ---------- */
static void pollEstop() {
  int raw = digitalRead(ESTOP_GPIO);
  if (raw != estopRawLast) {           // raw edge: restart the settle timer
    estopRawLast = raw;
    estopEdgeMs  = millis();
  }
  if (millis() - estopEdgeMs < DEBOUNCE_MS) return;   // still bouncing

  bool pressed = (raw == ESTOP_ACTIVE_LEVEL);
  if (pressed == estopActive) return;                 // stable, nothing new

  estopActive = pressed;
  if (estopActive) {
    ledWrite(false);     // safety first: kill the output NOW, before any publish
    Serial.println("!! E-STOP latched — LED forced OFF, publishing retained 1");
  } else {
    Serial.println("[estop] released — publishing retained 0");
  }
  if (mqtt.connected()) publishEstop();  // if offline, published on reconnect
}

/* ---------- non-blocking network bring-up ---------- */
static bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  if (millis() - lastWifiTry < WIFI_RETRY_MS) return false;
  lastWifiTry = millis();
  Serial.printf("[wifi] connecting to \"%s\" ...\n", WIFI_SSID);
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  return false;
}

static bool ensureMqtt() {
  if (mqtt.connected()) return true;
  if (millis() - lastMqttTry < MQTT_RETRY_MS) return false;
  lastMqttTry = millis();
  Serial.printf("[mqtt] broker %s:%u, client \"%s\" connecting ...\n",
                MQTT_HOST, (unsigned)MQTT_PORT, MQTT_CLIENT_ID);
  /* Last Will: if this box dies, the broker posts "offline" for everyone */
  if (!mqtt.connect(MQTT_CLIENT_ID, TOPIC_STATUS, 1, true, "offline")) {
    Serial.printf("[mqtt] failed, rc=%d — will retry\n", mqtt.state());
    return false;
  }
  Serial.println("[mqtt] connected — subscribed to the LED topic");
  mqtt.subscribe(TOPIC_LED_SET);
  mqtt.publish(TOPIC_STATUS, "online", true);
  publishEstop();                       // dashboards resync instantly
  lastHeartbeat = millis();
  return true;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== ESP32-S3 e-stop IoT gateway ===");

  pinMode(ESTOP_GPIO, INPUT_PULLUP);  // NC switch to GND: released = HIGH
  pinMode(LED_GPIO, OUTPUT);
  ledWrite(false);
  estopRawLast = digitalRead(ESTOP_GPIO);
  estopEdgeMs  = millis();

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);               // a gateway must not nap mid-message
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMsg);
}

void loop() {
  /* 1 — field poll first (safety before networking) */
  pollEstop();

  /* 2 — keep the links up, never blocking */
  bool wifiOk = ensureWifi();
  bool mqttOk = wifiOk && ensureMqtt();
  if (mqttOk) mqtt.loop();

  /* 3 — quiet chatter while degraded, heartbeat when healthy */
  if (millis() - lastNetLog > 3000 && (!wifiOk || !mqttOk)) {
    lastNetLog = millis();
    if (!wifiOk)      Serial.println("[wifi] still down — field logic keeps running");
    else if (!mqttOk) Serial.println("[mqtt] broker unreachable — field logic keeps running");
  }
  if (mqttOk && millis() - lastHeartbeat > HEARTBEAT_MS) publishHeartbeat();

  delay(2);
}
