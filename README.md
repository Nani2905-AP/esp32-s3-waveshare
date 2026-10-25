# ESP32-S3-Waveshare

Two related projects living side by side:

## 🖥️ `learn-esp32-s3/` — interactive learning site
"ESP32-S3-Waveshare" — an interactive trainer for the **Waveshare
ESP32-S3-ETH-8DI-8RO** industrial relay controller (reference 3D model:
grabcad.com/library/waveshare-esp32-s3-eth-8di-8ro-1):

- A real-time **3D board** (three.js, webgl) you can orbit, hover and click —
  hover any part for its reference, click DI terminals, relay cubes, BOOT,
  RESET, buzzer or the RGB pixel to drive the simulator. Relays do a small
  physical **click-lift animation** when their coil energizes
- **11 lessons** from "read your first input" to a full **MQTT e-stop IoT
  gateway** capstone, each with a runnable sketch simulation
- An **I/O bench** + control deck that share state with lesson sketches
- Light / dark theme toggle

Run locally: `python server.py` → http://localhost:7883/learn-esp32-s3/
(or just open `learn-esp32-s3/index.html` — it works from file:// too, three.js is vendored locally).

> GPIO numbers and demo behaviour follow the official Waveshare
> documentation. Independent, unofficial learning aid — original design.

## 🏭 `estop-gateway/` — flashable firmware
PlatformIO/Arduino firmware for an ESP32-S3 IoT gateway wired to one NC
**e-stop button** (GPIO4) and one **status LED** (GPIO5):

- Publishes e-stop state to MQTT (retained), with last-will + heartbeat
- Subscribes to LED commands; commands are ignored while the e-stop latches
- Non-blocking reconnects; see `estop-gateway/README.md` for wiring & testing

Fill in Wi-Fi/broker in `estop-gateway/include/config.h`, then:
`pio run -t upload`

## Safety note
MQTT here *monitors* an e-stop. A real emergency-stop function must be
hardwired normally-closed contacts in the power circuit. Code logs; copper stops.
