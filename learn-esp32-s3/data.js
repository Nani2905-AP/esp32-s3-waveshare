/* ============================================================
   ESP32-S3-Waveshare — data: parts, pinout, lessons
   (All GPIO numbers follow the official Waveshare documentation
   for the ESP32-S3-ETH-8DI-8RO relay board.)
   ============================================================ */

const PARTS = [
  { id:'power', name:'Power terminal (V+ / V−)', kw:'DC 7–36 V wide input, industrial buck supply',
    short:'Screw terminal for the external DC supply. Anything from a 9 V wall-wart to a 24 V industrial PSU works. A Type-C port (5 V) does the same job on the bench.' },
  { id:'ro',    name:'Relay outputs RO1–RO8', kw:'EXIO1…EXIO8 via TCA9554PWR I/O expander · each relay 1NO + 1NC · contact ≤10 A 250 VAC / ≤10 A 30 VDC · optocoupler driven',
    short:'Eight real electromechanical relays. Energize the coil and the contact snaps COM→NO closed (COM→NC opens). They switch mains-size loads your microcontroller could never touch directly.' },
  { id:'eth',   name:'W5500 Ethernet (RJ45)', kw:'GPIO12 INT · GPIO13 MOSI · GPIO14 MISO · GPIO15 SCLK · GPIO16 CS — 10/100 Mbps over SPI',
    short:'A hard-wired TCP/IP chip the ESP32-S3 talks to over SPI. Runs while Wi-Fi sleeps — boring, dependable, deterministic.' },
  { id:'usbc',  name:'USB Type-C', kw:'5 V power, flashing, USB-serial debug',
    short:'Your everyday door into the board: power it, flash it, watch the serial log — all through this one little socket.' },
  { id:'tf',    name:'TF / microSD slot', kw:'GPIO45 D0 · GPIO47 CMD · GPIO48 SCK — SPI mode',
    short:'Log data, host web files or store images on card instead of cramming them into flash.' },
  { id:'rs485', name:'Isolated RS485 (A+ / B−)', kw:'GPIO17 TX · GPIO18 RX, onboard 120 Ω terminator (jumper), TVS + surge protection',
    short:'Old-school industry favourite. Talks to Modbus RTU sensors, VFD drives and expansion relay modules despite meter-long cables.' },
  { id:'rtc',   name:'RTC clock chip (PCF85063)', kw:'GPIO40 INT · GPIO41 SCL · GPIO42 SDA (I²C)',
    short:'A timer that keeps humming even when the main loop is busy — ideal for “run the pump every 15 min” jobs.' },
  { id:'mcu',   name:'ESP32-S3-WROOM-1U module', kw:'Xtensa LX7 dual-core @240 MHz · 16 MB flash · 8 MB PSRAM · Wi-Fi + Bluetooth LE · external antenna',
    short:'The brain. Fits the whole Zigbee/WiFi/BLE radio stack plus your program inside that little metal shield.' },
  { id:'sma',   name:'SMA antenna connector', kw:'external 2.4 GHz antenna, mET reversed',
    short:'Wi-Fi and Bluetooth hop outside the metal case via a screw-on antenna — never power RF on without it.' },
  { id:'rgb',   name:'WS2812 RGB status LED', kw:'GPIO38, one-wire addressable',
    short:'A mood pixel for the panel: green = happy, red = can’t shut down, blue = connecting, rainbow = it is alive and confused.' },
  { id:'leds',  name:'Indicator LEDs (PWR / TXD / RXD)', kw:'red power · green RS485 TX · blue RS485 RX',
    short:'Tiny traffic lights baked onto the plate: power is on, RS485 is transmitting, something is replying.' },
  { id:'buzzer',name:'Buzzer', kw:'GPIO46, PWM beep',
    short:'A tiny blackmail device: one beep and every worker walks over to see who pressed what.' },
  { id:'boot',  name:'BOOT button', kw:'GPIO0 (pressed = LOW), also used at reset to enter download mode',
    short:'Double life: while held during power-up it forces the bootloader; during runtime it’s just an extra input you can read from code.' },
  { id:'reset', name:'RESET button', kw:'chip enable line — toggling it reboots the ESP32-S3',
    short:'The panic button for your process: one tap and the whole controller restarts, outputs drop to power-on defaults.' },
  { id:'di',    name:'Digital inputs DI1–DI8', kw:'GPIO4…GPIO11 · 5–36 V · optocoupler isolated · dry contact / NPN / PNP',
    short:'Eight optocoupled “did something happen?” lines. They drink from sensors like switches, PIR modules, relays, limit switches.' },
  { id:'iso',   name:'Isolated power & optos', kw:'DC-DC isolation between logic and field side, bidirectional optocouplers on every channel',
    short:'A moat of light. Field wiring mistakes stay in the field; the ESP32 side never feels the surge.' },
  { id:'header',name:'Expansion pin header', kw:'spare GPIOs broken out for sensors, RS232, i²c extras',
    short:'A little hedge: when eight relays are not enough, raw GPIOs are waiting on the header for your next experiment.' },
];

const PIN_GROUPS = [
  { title:'Digital input channels', rows:[
    {pin:'GPIO4',  what:'DI1 sense line', note:'Channel’s switch closes → GPIO goes LOW (active low, optocoupled)'},
    {pin:'GPIO5',  what:'DI2 sense line', note:'Same behavior. 5–36 V sensors, dry contact or NPN/PNP'},
    {pin:'GPIO6',  what:'DI3 sense line', note:''},
    {pin:'GPIO7',  what:'DI4 sense line', note:''},
    {pin:'GPIO8',  what:'DI5 sense line', note:''},
    {pin:'GPIO9',  what:'DI6 sense line', note:''},
    {pin:'GPIO10', what:'DI7 sense line', note:''},
    {pin:'GPIO11', what:'DI8 sense line', note:''},
  ]},
  { title:'Relay output channels (TCA9554PWR I/O expander, addr 0x20)', rows:[
    {pin:'EXIO1', what:'RO1 relay coil', note:'1NO + 1NC contact · ≤10 A 250 VAC / ≤10 A 30 VDC'},
    {pin:'EXIO2', what:'RO2 relay coil', note:'Coil driven through optocoupler — logic side never touches the load'},
    {pin:'EXIO3', what:'RO3 relay coil', note:''},
    {pin:'EXIO4', what:'RO4 relay coil', note:''},
    {pin:'EXIO5', what:'RO5 relay coil', note:''},
    {pin:'EXIO6', what:'RO6 relay coil', note:''},
    {pin:'EXIO7', what:'RO7 relay coil', note:''},
    {pin:'EXIO8', what:'RO8 relay coil', note:'Each relay breaks out COM, NC and NO screw terminals'},
  ]},
  { title:'Ethernet (W5500 over SPI)', rows:[
    {pin:'GPIO12', what:'ETH_INT',   note:'Interrupt from W5500'},
    {pin:'GPIO13', what:'ETH_MOSI',  note:'Data out to W5500'},
    {pin:'GPIO14', what:'ETH_MISO',  note:'Data in from W5500'},
    {pin:'GPIO15', what:'ETH_SCLK',  note:'SPI clock'},
    {pin:'GPIO16', what:'ETH_CS',    note:'SPI chip select'},
  ]},
  { title:'Field buses & radios', rows:[
    {pin:'GPIO17', what:'RS485 TX', note:'Isolated transceiver, A+/B− terminal, 120 Ω terminator jumper'},
    {pin:'GPIO18', what:'RS485 RX', note:''},
    {pin:'GPIO4…11',what:'DI sense lines', note:'also reused for digital inputs'},
    {pin:'Wi-Fi / BLE', what:'built into ESP32-S3', note:'never power on Wi-Fi or BLE without the SMA antenna attached'},
  ]},
  { title:'Board services', rows:[
    {pin:'GPIO40', what:'RTC_INT', note:'RTC alarm interrupt (PCF85063)'},
    {pin:'GPIO41', what:'RTC_SCL', note:'I²C clock for the clock chip'},
    {pin:'GPIO42', what:'RTC_SDA', note:'I²C data for the clock chip'},
    {pin:'GPIO38', what:'RGB LED', note:'One WS2812 pixel — chain addressable'},
    {pin:'GPIO46', what:'Buzzer',  note:'PWM beeper'},
    {pin:'GPIO0',  what:'BOOT button', note:'Low when pressed; held LOW at reset = flash mode'},
    {pin:'GPIO45', what:'SD_D0',  note:'microSD in SPI mode'},
    {pin:'GPIO47', what:'SD_CMD', note:''},
    {pin:'GPIO48', what:'SD_SCK', note:''},
  ]},
  { title:'Power', rows:[
    {pin:'V+ / V−', what:'7–36 V DC input', note:'Screw terminal, wide-voltage buck inside'},
    {pin:'USB-C',   what:'5 V @ 1 A',       note:'Also does firmware flashing and USB-serial'},
  ]},
];

/* ============================ LESSONS ============================ */

const LESSONS = [
  {
    id:'l1', num:1, title:'Meet the controller',
    sub:'What is that metal box on the rail, and why is it blinking green?',
    goal:'Get the map in your head: one ESP32 in the middle, eight relay clicks and eight sensor wires around it, all behind optocouplers.',
    body:`
      <p>This metal DIN-rail box is the Waveshare <b>ESP32-S3-ETH-8DI-8RO</b>. The name is the spec sheet:
      an <span class="term">ESP32-S3</span> microcontroller, speaking <span class="term">Ethernet</span>,
      carrying <b>8 digital inputs</b> and <b>8 relay outputs</b>.</p>
      <p><b>Inputs listen, outputs act.</b> That one sentence is most of industrial automation:</p>
      <ul>
        <li><b>DI1–DI8</b> — screw terminals on the input side. A wire closes → the optocoupler lights up → the ESP32 sees a LOW. All 8 channels are <span class="term">optocoupled</span>, so a wiring mistake on the floor can’t fry the chip.</li>
        <li><b>RO1–RO8</b> — eight <b>electromechanical relays</b>, each breaking out <b>COM, NC and NO</b> screw terminals and switching up to <span class="term">10 A at 250 VAC</span>. Energize the coil and the contact physically snaps: COM connects to NO, NC opens. Mains lamps, contactors, pumps — the metal box does the heavy lifting, not the chip.</li>
        <li><b>RS485 A+/B−</b> — an isolated two-wire field bus for talking to Modbus sensors and expansion relay modules meters away. There’s even an onboard <b>120 Ω terminator</b> behind a jumper.</li>
        <li><b>RJ45 + W5500</b> — hard-wired 10/100 Ethernet for the boring, dependable control path.</li>
        <li><b>USB-C + 7–36 V terminal</b> — power it from your laptop or from the plant’s 24 V rail.</li>
        <li>Plus a <b>buzzer</b>, a <b>WS2812 RGB LED</b>, an <b>RTC</b> and a <b>TF slot</b> for logging.</li>
      </ul>
      <p>The relays are driven through a tiny onboard <b>I/O expander</b> (TCA9554 at address <span class="term">0x20</span>) —
      that’s why the firmware calls its control lines <b>EXIO1…EXIO8</b> instead of plain GPIOs.</p>
      <p>On the next lessons we wire it up — no soldering required, just clicks and code. Start with <b>lesson 2</b>!</p>
      <p class="tip-inline">💡 Tip: hover any block on the board on the left — the little card explains what it does, with the exact GPIO involved.</p>
    `,
    code:null
  },
  {
    id:'l2', num:2, title:'Your first input: read DI1',
    sub:'Close a wire, watch the level drop. Active-low, like every industrial input ever.',
    goal:'Understand the active-LOW rhythm of optocoupled inputs: open = HIGH, closed = LOW. Pick each DI switch on the bench and watch the serial monitor.',
    body:`
      <p>Inside the board, each DI channel goes through an <b>optocoupler</b> — an LED and a phototransistor facing each other
      in the dark, sealed in black plastic. Field voltage lights the LED, the phototransistor conducts, and the ESP32 GPIO reads
      <b>LOW</b>. Open wire → no light → GPIO reads <b>HIGH</b> (it sits on a pull-up).</p>
      <p>This <b>active-low</b> logic feels upside-down the first time, but industry loves it: a broken wire looks identical to an
      idle input, never to a triggered one. Fail-safe by design.</p>
      <p>In the bench panel below the board, click <b>SW1</b> (it closes the wire on DI1 / GPIO4), and read the level from the
      serial monitor.</p>
    `,
    code:`void setup() {
  Serial.begin(115200);          // our little notebook window
  pinMode(GPIO4, INPUT_PULLUP);  // DI1 sense line, idles HIGH
}

void loop() {
  int level = digitalRead(GPIO4);     // LOW = wire closed, HIGH = open
  Serial.print("DI1 level = ");
  Serial.print(level);
  Serial.println(level == LOW ? "   <- ACTIVE, something closed the wire" : "   <- idle");
  delay(400);                         // be nice to the log, print a few times a second
}`
  },
  {
    id:'l3', num:3, title:'Outputs & linkage: switch → lamp',
    sub:'Close DI1, relay RO1 clicks and your lamp lights. This is a wire-saving PLC pattern.',
    goal:'Learn dry-contact relay wiring (your load lives between the supply and COM/NO) and wire the two sides together in code.',
    body:`
      <p>The relay outputs are the honest, old-school kind: an <b>electromechanical contact</b>. Each channel gives you
      three terminals — <span class="term">COM</span>, <span class="term">NC</span> (normally closed) and
      <span class="term">NO</span> (normally open). With the coil idle, COM touches <b>NC</b>; energize the coil and it
      <b>snaps over to NO</b> with a satisfying click.</p>
      <p>So the lamp wiring is dead simple, polarity-free: <pre class="inline-code">+24 V  →  lamp  →  NO terminal  →  (contact closes)  ←  COM  ←  GND</pre>
      When the software says <span class="term">HIGH</span>, the coil energizes, the contact closes, the lamp lights.
      Unlike a transistor, a relay contact doesn’t care about voltage polarity, AC or DC — and 10 A can flow through it.</p>
      <p>The input side works the other way around: a closed sensor <i>pulls</i> the line down to <span class="term">LOW</span>.
      Thresholds in code:</p>
      <ul>
        <li><code>digitalRead(GPIO4) == LOW</code> → the DI1 wire is <b>closed</b> (input active)</li>
        <li><code>digitalWrite(EXIO1, HIGH)</code> → relay RO1 <b>energizes</b> (COM→NO closed)</li>
      </ul>
      <p>The control lines for the relays are named <span class="term">EXIO1…EXIO8</span> — they reach the coils through an
      onboard <span class="term">I²C expander</span> (that’s the firmware’s shorthand). <b>Linkage</b> is just: read the input,
      write the output, forever, very fast. That elegantly boring loop is 90% of industrial code.</p>
      <p>Wire it in the bench: close <b>SW1</b> → <b>L1</b> should glow. Open it again and the lamp dies — no code needed beyond this lesson’s sketch.</p>
      <div class="warnbox">Relay contacts wear out: for inductive loads (motors, big contactor coils) use an RC snubber or a
      varistor across the contact, fuse the circuit, and stay far below the 10 A rating for anything starting under load.</div>
    `,
    code:`void setup() {
  Serial.begin(115200);
}

void loop() {
  // field side: a limit switch on DI1 (GPIO4), closed = part present
  int active = (digitalRead(GPIO4) == LOW);

  // output side: EXIO1 energizes relay RO1 (contact closes, lamp lights)
  if (active) {
    digitalWrite(EXIO1, HIGH);   // lamp ON
  } else {
    digitalWrite(EXIO1, LOW);    // lamp OFF
  }

  delay(30);   // poll ~33 times a second, PLC-style
}`
  },
  {
    id:'l4', num:4, title:'Pattern chaser across 8 channels',
    sub:'One lamp, then the next, then wrap around — a “service mode” indicator.',
    goal:'Drive all 8 output channels from one loop, and learn why the delay() rhythm shapes the whole animation.',
    body:`
      <p>The “pairs of lamps chase each other” trick hides a turbo-simple loop: <b>wake up, light one, wait, kill it, move on</b>.
      By cycling channel by channel (CH1 → CH8), you make an LED bar that sweeps left.</p>
      <p>Two things worth noticing while it runs:</p>
      <ul>
        <li><code>delay(90)</code> is the <i>entire</i> speed of the show. Change 90 to 200 in your head and predict the result — slow-motion chase.</li>
        <li>Every channel is written <i>twice</i>: HIGH to fire, LOW to dim. If you only write HIGH, all eight lamps end up lit and stay lit — the classic beginner bug.</li>
      </ul>
      <p>This chaser is not just pretty: end-of-line machine shops use the same pattern as a <b>service-mode telltale</b> — if you
      see it running on real hardware, an operator knows some config was just changed or a self-test passed.</p>
    `,
    code:`void setup() {
  Serial.begin(115200);
  Serial.println("Chaser engaged: CH1 -> CH8 -> wrap");
}

void loop() {
  int pins[] = {CH1, CH2, CH3, CH4, CH5, CH6, CH7, CH8};

  for (int i = 0; i < 8; i++) {
    digitalWrite(pins[i], HIGH);   // fire channel i
    delay(90);                     // dwell
    digitalWrite(pins[i], LOW);    // kill it before moving on
  }
}`
  },
  {
    id:'l5', num:5, title:'Buzzer + BOOT button alarm',
    sub:'The humble little button on the plate has a second life as a wire-to-ground input.',
    goal:'Read a real onboard button (GPIO0) and use the buzzer (GPIO46) — two bits of hardware that live on every panel and every control box.',
    body:`
      <p>The <b>BOOT button</b> has a day job: hold it while power-cycling the board and it drops the chip into download mode so you
      can flash a new sketch. That’s why it’s wired to <span class="term">GPIO0</span> — the strapping pin. At reset, low = boot-loader.</p>
      <p>But the moment your program is running, <code>digitalRead(GPIO0)</code> is just another input with a pull-up:
      pressed = LOW, released = HIGH.</p>
      <p>The <b>buzzer</b> is driven from <span class="term">GPIO46</span>. Waveshare’s firmware has a helper
      <code>Buzzer_PWM(ms)</code>; under the hood it’s just a pin that whips up and down fast, and the little magnet-coil membrane
      slaps back at that frequency — a click at 200 Hz. Beep us into the rhythm:</p>
      <ul>
        <li><code>digitalWrite(GPIO46, HIGH)</code> → beep on</li>
        <li><code>digitalWrite(GPIO46, LOW)</code> → silence</li>
      </ul>
      <p>Press <b>BOOT</b> in the bench, or click the button on the board — the serial monitor will tattle and the buzzer will cry once per detection.</p>
    `,
    code:`void setup() {
  Serial.begin(115200);
  pinMode(GPIO0, INPUT_PULLUP);   // BOOT button, pressed = LOW
  pinMode(GPIO46, OUTPUT);        // buzzer
}

void loop() {
  if (digitalRead(GPIO0) == LOW) {
    digitalWrite(GPIO46, HIGH);   // beep!
    Serial.println(">> BOOT pressed — alarm");
    delay(150);
    digitalWrite(GPIO46, LOW);
    delay(60);
  }
  delay(10);  // pump the loop, stay snappy
}`
  },
  {
    id:'l6', num:6, title:'The RGB status beacon (WS2812)',
    sub:'One wire, one pixel, infinite colours. The language of industrial status lights.',
    goal:'Set colours on a WS2812 pixel over a single data line (GPIO38) and pick the standard industrial colour code.',
    body:`
      <p>The <b>WS2812</b> is a marvel of cheapness: a whole RGB LED with a tiny driver chip inside. You feed colours down
      <i>one</i> wire (GPIO38) as a chain of precisely-timed pulses. With <code>Adafruit_NeoPixel</code> style code — or the
      Waveshare demo’s own helper — a line breaks into an easy pattern:</p>
      <ul>
        <li><code>strip.setPixelColor(0, strip.Color(r, g, b))</code> — paint a pixel in local memory</li>
        <li><code>strip.show()</code> — fire the pulses down the wire now</li>
      </ul>
      <p>Real production floors agree on a colour code, roughly:</p>
      <ul>
        <li><b>green</b> — all good, running happily</li>
        <li><b>amber</b> — attention, still running but degraded</li>
        <li><b>red</b> — going down, need a person</li>
        <li><b>blue</b> — network hand-shaking, connecting</li>
      </ul>
      <p>In the sketch below the pixel cycles <b>amber → blue</b>, and the little pixel on the board’s plate keeps up.</p>
      <div class="warnbox">Never drive the Wi-Fi/BLE radio without the external antenna on the SMA connector — the metal DIN case
      acts as a radio-proofed cage, not a friend.</div>
    `,
    code:`#include <Adafruit_NeoPixel.h>  // GPIO38, one WS2812 pixel
                                  // (Waveshare's demo uses similar helpers)
Adafruit_NeoPixel strip = Adafruit_NeoPixel(1, GPIO38, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  strip.begin();
}

void loop() {
  strip.setPixelColor(0, strip.Color(255, 70, 0));   // industrial amber
  strip.show();
  Serial.println("RGB = amber (attention)");
  delay(500);

  strip.setPixelColor(0, strip.Color(0, 90, 255));   // service blue
  strip.show();
  Serial.println("RGB = blue (connecting)");
  delay(500);
}`
  },
  {
    id:'l7', num:7, title:'RS485 control frames',
    sub:'Old-school reliable: send a couple of raw bytes, the world turns on.',
    goal:'Talk on the isolated RS485 bus (GPIO17/18) at 9600 baud and understand what one Waveshare control frame is made of.',
    body:`
      <p>RS485 is plain dumb two-wire differential bus: A+ and B−. Slow (usually 9600 baud here), noisy-immune over 1000 m of
      cable, and <i>every</i> industrial device on earth can talk it. Waveshare’s own demo turns the board into a command
      follower — you send it an <span class="term">8-byte frame</span> and it toggles one channel:</p>
      <p><code>06 05 00 01 55 00 A2 ED</code> — and CH1 flips. <code>…00 03…</code> — CH3 flips. <code>06 05 00 FF FF …</code> — ON all.</p>
      <p>In this lesson the board <b>sends</b> those frames (in the real rig the Waveshare demo would be <i>receiving</i> them).
      The sketch uses the second hardware UART mapped to A+/B−. The bytes go out with <code>RS485.write(frame, 8)</code>, and
      the magic-looking trailing bytes are a <b>CRC checksum</b> — a small math-y device so wrong bytes get thrown out.</p>
      <p>In the simulator, every frame we “send” is echoed back by a fake neighbour device (the bench panel toggled the same
      channels — a little cheat so you see the effect). On real hardware you’d hook the A+/B− terminals to a USB-RS485 adaptor
      and fire frames from SSCOM or a Python script.</p>
    `,
    code:`HardwareSerial RS485(2);   // -> the onboard isolated A+/B- screw terminal

void setup() {
  Serial.begin(115200);
  RS485.begin(9600);
}

void loop() {
  // 8-byte Waveshare toggle frame: header, code, len-hi, CH1, cmd, sp, CRC-hi, CRC-lo
  int frame1[] = {0x06, 0x05, 0x00, 0x01, 0x55, 0x00, 0xA2, 0xED};  // toggle CH1
  RS485.write(frame1, sizeof(frame1));
  delay(1500);

  int frame3[] = {0x06, 0x05, 0x00, 0x03, 0x55, 0x00, 0x03, 0x2D};  // toggle CH3
  RS485.write(frame3, sizeof(frame3));
  delay(1500);
}`
  },
  {
    id:'l8', num:8, title:'Wi-Fi web control (AP mode)',
    sub:'The board becomes its own hotspot and hands out web pages.',
    goal:'Understand the Wi-Fi Access-Point pattern used by the Waveshare demo — the board serves the control page, your phone joins it.',
    body:`
      <p>Waveshare’s demo sketch makes the board a <b>Wi-Fi Access Point</b> named <code>ESP32-S3-ETH-8DI-8RO</code>
      (password <code>waveshare</code>). Join it with your phone, open <code>http://192.168.4.1</code>, and you get a web
      page with a big switch per channel.</p>
      <p>The interesting architecture bit: it’s the <b>board</b> that owns the network. No router, no cloud, no internet at all on
      the shop floor. This is the pattern you’ll reach for on day one of any pilot. STA mode (lesson 9’s cousin) flips it around:
      the board joins <i>your</i> network instead.</p>
      <p>The sketch below shows the skeleton: <code>WiFi.softAP()</code> brings the hotspot up, <code>server.on("/...")</code>
      routes would-be requests, and the <code>loop()</code> keeps serving clients. In our simulation, fake “browser clicks”
      fly in every few hundred milliseconds and toggle channels — like a rendering of people pressing switches.</p>
      <p>Bluetooth LE rides along, too: the Waveshare demo listens to single-byte commands
      <code>0x31…0x38</code> (ASCII 1–8) to toggle any channel, and <code>0x39</code>/<code>0x30</code> to switch all on / all off.</p>
    `,
    code:`WebServer server(80);

void setup() {
  Serial.begin(115200);
  WiFi.softAP("ESP32-S3-ETH-8DI-8RO", "waveshare");
  Serial.print("AP IP = ");
  Serial.println(WiFi.softAPIP());
  Serial.println("Waiting for clicks on http://192.168.4.1 ...");
  server.begin();
}

void loop() {
  server.handleClient();   // a click toggles a channel
  delay(150);
}`
  },
  {
    id:'l9', num:9, title:'Ethernet & fail-safe thinking',
    sub:'Wires are boring; boring is exactly what an automated cellar needs.',
    goal:'Appreciate why heavy industrial installs trust wired Ethernet over Wi-Fi for the control path, and what isolation has already saved you from.',
    body:`
      <p>The <b>W5500</b> chip is a full TCP/IP stack in silicon: the ESP32-S3 feeds it SPI bytes on
      <code>GPIO13/14/15</code>, chip-select <code>16</code>, interrupt <code>12</code>, and the W5500
      magically does ARP, DHCP, TCP and an SSL handshake if you ask — while your loop() stays relaxed.</p>
      <p>Wi-Fi is usually the <i>quick start</i> link; Ethernet is the <b>critical</b> one. Rules of thumb:</p>
      <ul>
        <li>If losing the link must not stop the process, wire it.</li>
        <li>Wi-Fi (with the SMA antenna on!) for dashboards and commissioning, Ethernet for the control path.</li>
        <li>10/100 Mbps from the W5500 is far more than enough — an 8-relay controller sends bytes, not movies.</li>
      </ul>
      <p><b>Isolation everywhere:</b> optocouplers on every DI and on every relay coil, an isolated DC-DC between the
      field side and the logic side, TVS diodes on RS485. A wire chomped by a forklift trips one channel; the ESP32 keeps
      running. That is the whole reason this box costs $40 and exists at all.</p>
    `,
    code:`void setup() {
  Serial.begin(115200);
  Serial.println("[W5500] SPI on GPIO13/14/15, CS=16, INT=12");
  Serial.println("[W5500] link up  ->  asking DHCP ...");
}

void loop() {
  Serial.println("ETH alive: 100 Mbps full-duplex, DHCP lease renewed");
  delay(1200);
}`
  },
  {
    id:'l10', num:10, title:'Capstone: QC gate controller',
    sub:'Boxes on a conveyor, an e-stop, an alarm buzzer and a status beacon — all in one sketch.',
    goal:'Combine everything: DI as sensors, EXIO as actuators, BOOT as e-stop, buzzer + RGB as the status language, with sane behaviour under fault.',
    body:`
      <p>Time to be a small integrator. The rig: boxes enter on a conveyor; a slide has a <b>detect sensor</b> wired to
      <b>DI1</b>; a gate actuator (say, a 24 V solenoid valve wired through the <b>RO1</b> contact) kicks when a box is in
      place; a <b>pusher</b> on <b>RO2</b> clears the lane when empty. Hardware rules:</p>
      <ul>
        <li><b>The BOOT button doubles as the emergency stop.</b>_pressed (GPIO0 low) → everything off instantly, buzzer blares, all relays drop out.</li>
        <li>Only when a box is actually detected does <b>RO1</b> fire. No box, no motor — saves power and avoids mis-fires.</li>
        <li>The conveyor is “interlocked” with the e-stop: while e-stop is down, no sketch code can wake it up. You must release and restart.</li>
        <li>The RGB beacon mirrors the fault state: <b>amber</b> = running, <b>red</b> = e-stop latched.</li>
      </ul>
      <p>Run the sketch, then play with the bench: close <b>SW1</b> for a box in place, press <b>BOOT</b> for the emergency stop.
      Read the code once more after playing with the simulator — patterns like <code>if estop then kill-all</code> at the top of
      the loop is <b>poll-before-act</b>, safety-critical style, and worth learning to write on instinct.</p>
      <div class="warnbox">On real hardware e-stop switches must be hard-wired NC-break buttons in the power path, not just software
      readings from GPIO0. Code is for logging; copper and contacts are for stopping.</div>
    `,
    code:`void setup() {
  Serial.begin(115200);
  const int outs[] = {CH1, CH2, CH3, CH4, CH5, CH6, CH7, CH8};
  for (int i = 0; i < 8; i++) digitalWrite(outs[i], LOW);   // boot to a known state
  Serial.println("=== QC gate controller v1 ===");
}

void loop() {
  const int outs[] = {CH1, CH2, CH3, CH4, CH5, CH6, CH7, CH8};

  // ---- poll inputs first (safety before show) ----
  int estop = (digitalRead(GPIO0) == LOW);        // BOOT = emergency stop
  int box   = (digitalRead(GPIO4) == LOW);        // DI1 = box-in-place sensor

  if (estop) {
    for (int i = 0; i < 8; i++) digitalWrite(outs[i], LOW);  // everything off
    digitalWrite(GPIO46, HIGH);                   // buzzer blares
    Serial.println("E-STOP latched: all outputs killed");
    delay(250);
    return;                                       // skip the rest of this cycle
  }
  digitalWrite(GPIO46, LOW);                      // silence the buzzer

  // ---- normal cycle ----
  digitalWrite(CH1, box ? HIGH : LOW);            // conveyor only when a box is there
  digitalWrite(CH2, box ? LOW : HIGH);            // pusher only when lane is empty
  Serial.println(box ? "cycle R: box detected, conveyor on"
                     : "cycle E: lane empty, pusher standby");
  delay(400);
}`
  },
  {
    id:'l11', num:11, title:'IoT gateway: MQTT e-stop + LED',
    sub:'The box learns to talk: publish the e-stop state, subscribe to dashboard commands.',
    goal:'Understand the classic IoT gateway pattern — MQTT broker, retained state, last-will — and wire an NC e-stop (DI1) plus a dashboard-driven lamp on relay RO1.',
    body:`
      <p>Lesson 10 kept everything inside the box. Real IoT wants the box to <b>publish</b> its state and
      <b>listen</b> for commands. The standard industrial dialect is <span class="term">MQTT</span>: a tiny
      publish/subscribe protocol riding on TCP, meeting in a central <span class="term">broker</span>
      (Mosquitto, or Home Assistant’s built-in one) on port <b>1883</b>.</p>
      <p>Nobody talks to anybody directly — every player only reads and writes <b>topics</b>:</p>
      <ul>
        <li><code>plant/line1/estop</code> — the gateway <b>publishes</b> <code>1</code>/<code>0</code> here,
        <i>retained</i>: a dashboard that opens late instantly sees the last state, no waiting for the next event.</li>
        <li><code>plant/line1/led/set</code> — a dashboard <b>publishes</b> <code>on</code>/<code>off</code>/<code>toggle</code>;
        the gateway is <b>subscribed</b> and drives RO1. While the e-stop is latched the gateway ignores lamp commands.</li>
        <li><code>plant/line1/status</code> — armed with a <span class="term">last-will</span>: if the gateway dies, the
        broker posts <code>"offline"</code> on its behalf. A silent gateway is a fault you can <em>see</em>.</li>
      </ul>
      <p>The wiring stays humble: a <b>normally-closed e-stop button</b> shorts DI1 (GPIO4) to ground — pressed = LOW,
      released = HIGH. A broken wire reads like “pressed”, industry’s favourite fail-safe. The <b>LED lamp</b> is switched
      by relay <b>RO1</b>: +24 V → lamp → NO terminal, contact closing through COM — no polarity to worry about.</p>
      <p>Run the sketch, then flip <b>SW1</b> while it runs — each change is published and the status beacon answers.
      Wait a few seconds once subscribed: a clicky “operator” starts pushing LED commands from the dashboard.</p>
      <div class="warnbox">MQTT <em>reports</em> and <em>monitors</em> the e-stop — it does not implement it. The real
      safety function is the hardwired NC contact interrupting the power path. Copper stops the machine; MQTT tells you
      about it.</div>
    `,
    code:`#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient net;                 // the TCP pipe to the broker
PubSubClient mqtt(net);         // MQTT rides on top of that pipe

void setup() {
  Serial.begin(115200);
  WiFi.begin("shop-floor", "password123");    // STA mode: join YOUR network
  while (WiFi.status() != 3) delay(300);      // 3 = WL_CONNECTED
  Serial.println("WiFi up, IP = " + WiFi.localIP());
  mqtt.setServer("192.168.1.50", 1883);
}

void loop() {
  // ---- field first: e-stop on DI1, closed = LOW (NC switch) ----
  int estop = (digitalRead(GPIO4) == LOW);

  // ---- keep the broker link alive ----
  if (!mqtt.connected()) {
    Serial.println("MQTT: connecting ...");
    if (mqtt.connect("gateway-line1",           // client id
                     "plant/line1/status", 1, true, "offline"))  // last-will
      mqtt.subscribe("plant/line1/led/set");
    else { delay(800); return; }                // broker away — retry next loop
  }

  // ---- report the e-stop (retained: survives reboots & late dashboards) ----
  mqtt.publish("plant/line1/estop", estop ? "1" : "0", true);

  mqtt.loop();   // deliver dashboard LED commands & broker pings
  delay(150);
}`
  },
];

/* Fake "browser" clients used by the web-server lesson simulation */
const FAKE_HTTP = [
  {msg:'GET /  -> sending control page (4 kB)', act:null},
  {msg:'GET /handleCh2 -> toggled CH2', act:{type:'toggle', ch:1}},
  {msg:'GET /handleCh5 -> toggled CH5', act:{type:'toggle', ch:4}},
  {msg:'GET /handleCh8 -> toggled CH8', act:{type:'toggle', ch:7}},
  {msg:'GET /getData -> channels = [0,1,0,0,1,0,0,1]', act:null},
  {msg:'GET /handleCh1 -> toggled CH1', act:{type:'toggle', ch:0}},
];
