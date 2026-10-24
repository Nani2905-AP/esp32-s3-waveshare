# ESP32-S3 e-stop IoT gateway

One normally-closed (NC) **e-stop button** on GPIO4, one **status LED** on GPIO5,
reported over **MQTT** with retained state, a last-will and a heartbeat.
This is the flashable twin of *IO Desk lesson 11* (`../learn-esp32-s3`).

```
                        ESP32-S3
   e-stop (NC)  ──●──── GPIO4  (INPUT_PULLUP, pressed/broken = LOW)
                  │
                 GND

   GPIO5 ──[330Ω]──►|── GND          (status LED, HIGH = on)
```

## MQTT API

| topic | direction | payload | retained |
|---|---|---|---|
| `plant/line1/estop`  | gateway → | `"1"` / `"0"` | yes |
| `plant/line1/status` | gateway → | `"online"` / `"offline"` (LWT) | yes |
| `plant/line1/state`  | gateway → | `{"estop":0,"led":1,"uptime_s":42,"rssi":-58}` | no |
| `plant/line1/led/set`| → gateway | `on` / `off` / `toggle` — ignored while e-stop is latched | — |

## Build & flash

```bash
pio run -t upload          # flash over USB-C
pio device monitor         # serial log at 115200
```

## Quick test with Mosquitto

```bash
# watch everything the gateway says
mosquitto_sub -h 192.168.1.50 -t 'plant/line1/#' -v

# drive the LED (only works while the e-stop is released)
mosquitto_pub -h 192.168.1.50 -t plant/line1/led/set -m on
mosquitto_pub -h 192.168.1.50 -t plant/line1/led/set -m toggle
```

Behaviour while degraded: no Wi-Fi or no broker never blocks the loop — the
debounced e-stop still latches and forces the LED off locally; the state is
published (retained) as soon as the link comes back. If the board dies,
the broker posts `plant/line1/status = "offline"` on its behalf via the LWT.

> **Safety note:** MQTT here is *monitoring and commanding an indicator*.
> A real emergency-stop function must be hardwired NC contacts in the power
> circuit ( interruption without software). Code logs; copper stops.
