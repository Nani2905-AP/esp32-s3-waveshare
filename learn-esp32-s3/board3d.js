/* ============================================================
   board3d.js — the ESP32-S3-ETH-8DI-8RO gateway as the real
   Waveshare appliance, in three.js.
   Reference photos: waveshare.com/wiki/ESP32-S3-POE-ETH-8DI-8DO
   (front + rear product shots) — adapted to the 8RO relay spec.

   Anatomy, matching the photos:
     · two-piece black ABS case — a shallow base with four raised
       corner posts and a lifted-off upper shell
     · the shell's top face is the silkscreen panel: rear PCB strip
       first (RJ45 · USB-C · SMA · RS485 · LEDs…), then a row of
       green service badges, the WAVESHARE title block, the
       Digital Outputs / Digital Inputs group headers with
       'COM GND 1–8' legends and printed indicator circles
     · two long green pluggable strips + a small 7–36 V block
       protruding under the shell's front lip, one screw per
       socket (RO: COM GND 1–8 · DI: COM GND 1–8 · 7–36 V block)
     · orange rubber feet underneath, four shell screws on top
     · inspector mode: the shell lifts up and slides back,
       revealing relays, optocouplers, the WROOM module and more

   Interaction contract is unchanged: raycastable parts report the
   same pick keys (DI1–DI8 / RO1–RO8 / boot / rgb / buzzer / reset)
   and info ids (power / rs485 / eth / usbc / header / rgb / leds /
   buzzer / boot / reset / mcu / rtc / iso / sma) as before, and
   the model animates strictly from the app's `state`.
   ============================================================ */
'use strict';

function createBoard3D(container, hooks){
  const T = THREE;

  /* ================= renderer / scene / camera ================= */
  const renderer = new T.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';

  const scene  = new T.Scene();
  scene.background = new T.Color(0x0c121b);
  scene.fog = new T.Fog(0x0c121b, 340, 950);

  const camera = new T.PerspectiveCamera(38, 1, 1, 2000);

  /* orbit: yaw/pitch/dist with damping (tiny custom controls) */
  function deg(d){ return d * Math.PI / 180; }
  const sph  = { r: 255, phi: deg(54), theta: deg(-22) };
  sph._r = sph.r; sph._phi = sph.phi; sph._theta = sph.theta;
  const TARGET = new T.Vector3(0, 6, 0);

  function updateCamera(){
    sph.phi    += (sph._phi    - sph.phi)    * 0.14;
    sph.theta  += (sph._theta  - sph.theta)  * 0.14;
    sph.r      += (sph._r      - sph.r)      * 0.14;
    const p = new T.Vector3(
      TARGET.x + sph.r * Math.sin(sph.phi) * Math.sin(sph.theta),
      TARGET.y + sph.r * Math.cos(sph.phi),
      TARGET.z + sph.r * Math.sin(sph.phi) * Math.cos(sph.theta)
    );
    camera.position.copy(p);
    camera.lookAt(TARGET);
  }

  /* ================= theme (dark default / light) ================= */
  let hemi, sun, warm, fill;
  function setTheme(mode){
    const light = mode === 'light';
    const bg = light ? 0xe3e9f2 : 0x0c121b;
    scene.background.set(bg);
    scene.fog.color.set(bg);
    hemi.intensity = light ? 0.95 : 0.44;
    sun.intensity  = light ? 1.0  : 0.75;
    warm.intensity = light ? 0.0  : 0.15;
    fill.intensity = light ? 0.15 : 0.2;
  }

  /* ================= lights ================= */
  hemi = new T.HemisphereLight(0x9db2c8, 0x11161d, 0.44);
  scene.add(hemi);
  sun = new T.DirectionalLight(0xffffff, 0.8);
  sun.position.set(70, 130, 90);
  scene.add(sun);
  warm = new T.PointLight(0xffb454, 0.1, 400);
  warm.position.set(-90, 50, -50);
  scene.add(warm);
  fill = new T.DirectionalLight(0x7fa5ff, 0.25);
  fill.position.set(-70, 40, 110);
  scene.add(fill);

  /* ================= material palette ================= */
  function std(color, rough, metal){ return new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); }
  function glow(color){
    return new T.MeshStandardMaterial({ color: 0x11181f, roughness: .4, metalness: 0,
      emissive: new T.Color(color), emissiveIntensity: 0 });
  }
  const mat = {
    pcb:      std(0x0a3a2b, .9, .12),
    case:     std(0x10151b, .55, .14),    // ABS housing (near-black industrial)
    caseDk:   std(0x0c1015, .7, .1),
    block:    std(0x2b3442, .6, .25),
    green:    std(0x2fa557, .55, .08),    // pluggable screw-terminal green
    greenDk:  std(0x20713e, .65, .05),
    dark:     std(0x13181f, .7, .2),
    chip:     std(0x101318, .55, .25),
    gold:     std(0xc9a24a, .35, .95),
    metal:    std(0xaeb9c6, .32, .92),
    silver:   std(0xb7c3d4, .28, .95),
    plastic:  std(0x8f97a5, .55, .1),
    sub:      std(0x17322c, .75, .1),
    relay:    std(0x2f52c8, .45, .15),    // relay encapsulation blue
    relayTop: std(0x224096, .5, .1),
    foot:     std(0xe0562e, .8, .02),     // orange rubber feet
    printed:  std(0x39424c, .9, .05),     // printed circle on the silk panel
  };

  /* one glow material per channel, shared between circle / ring / window */
  const diLamps = [];                      // 8 green circle/ring mats, one per DI channel
  const roLamps = [];                      // 8 amber circle/window/ring mats, one per RO channel
  for(let i = 0; i < 8; i++) diLamps.push(glow(0x35d07f));
  for(let i = 0; i < 8; i++) roLamps.push(glow(0xffa732));
  const relayCubes = [];   // animated: cube nudges when the coil energizes
  const rgbMat    = glow(0x22d97a);
  const buzzerMat = glow(0xffb454);
  const bootMat   = glow(0xc8a15a);
  const resetMat  = glow(0xc8a15a);
  const ledMats   = { pwr: glow(0xff5348), txd: glow(0x44e07a), rxd: glow(0x3f7dff) };

  /* ================= helpers ================= */
  const pickables = [];   // meshes with userData.pick
  const informants = [];  // meshes with userData.info

  function tag(m, opts){
    opts = opts || {};
    (opts.parent || scene).add(m);
    if(opts.pick){ m.userData.pick = opts.pick; pickables.push(m); }
    if(opts.info){ m.userData.info = opts.info; informants.push(m); }
    return m;
  }
  function box(w, h, d, x, y, z, material, opts){
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    if(opts && opts.rotY) m.rotation.y = opts.rotY;
    return tag(m, opts);
  }
  function cyl(r, h, x, y, z, material, opts){
    const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 24), material);
    m.position.set(x, y, z);
    return tag(m, opts);
  }

  /* ================= printed labels (canvas textures) =================
     Positions are in device millimetres: x across the 175 mm face,
     z across its 90 mm depth — the same mapping the SVG board used. */
  const PX_PER_MM = 9;

  function makeLabel(text, xmm, zmm, sizeMm, o){
    o = o || {};
    const color   = o.color || '#9fb1bd';
    const weight  = o.weight || 600;
    const italic  = o.italic ? 'italic ' : '';
    const fontPx  = Math.max(1.6, sizeMm) * PX_PER_MM;
    const pad = 2;
    const c = document.createElement('canvas');
    c.height = Math.ceil(fontPx + pad * 2);
    let ctx = c.getContext('2d');
    ctx.font = italic + weight + ' ' + Math.round(fontPx) + 'px system-ui, sans-serif';
    c.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
    ctx = c.getContext('2d');
    ctx.font = italic + weight + ' ' + Math.round(fontPx) + 'px system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, pad, c.height / 2);
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = 4;
    const g = new T.PlaneGeometry(c.width / PX_PER_MM, c.height / PX_PER_MM);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(xmm, o.y !== undefined ? o.y : SILK_Y, zmm);
    return tag(m, { parent: o.parent, info: o.info, pick: o.pick });
  }

  /* heights: base plate top y=3 · PCB top y=8 · shell panel y 15–17.2 */
  const PCB_Y  = 8.05;    // silk printed on the PCB
  const SILK_Y = 17.35;   // silk printed on the shell panel
  const SCREW_Z = 46.8;   // exposed screw row on the protruding strips

  /* groups: static base + liftable roof shell */
  const base = new T.Group(); scene.add(base);
  const roof = new T.Group(); scene.add(roof);

  /* small green service badge (box + white print), lives on the roof */
  function badge(text, xmm, wMm, zMm){
    box(wMm, .8, 6.5, xmm, 17.6, zMm || -31, mat.green, { parent: roof });
    return makeLabel(text, xmm, zMm || -31, 2.6,
      { color: '#eef3ef', weight: 700, y: 18.12, parent: roof });
  }

  /* ============================================================
     STATIC BASE — plate, rear wall, orange feet, four corner posts
     ============================================================ */
  box(196, 4, 104, 0, 1, 0, mat.case, { parent: base, info: 'power' });         // base plate
  box(194, 9, 2.5, 0, 3.5, -47.5, mat.case, { parent: base, info: 'power' });   // rear wall
  [[-78, 40], [78, 40], [-78, -40], [78, -40]].forEach(p =>                     // orange feet
    box(4, 2.4, 9, p[0], -1.7, p[1], mat.foot, { parent: base }));
  [[-92, -46], [92, -46], [-92, 46], [92, 46]].forEach(p => {
    box(9, 15, 9, p[0], 6.5, p[1], mat.case, { parent: base, info: 'power' });  // corner post
    cyl(1.6, .5, p[0], 13.55, p[1], mat.dark, { parent: base });                // screw boss print
  });

  /* ============================================================
     ROOF — upper shell (lifts in inspector mode)
     panel plate rear edge at z = -36 (open PCB strip behind it)
     ============================================================ */
  box(176, 2.2, 81.5, 0, 16.1, 4.75, mat.case, { parent: roof, info: 'power' }); // top panel z -36…45.5
  box(2.5, 14.2, 81.5, -87.25, 10, 4.75, mat.case, { parent: roof, info: 'power' }); // left wall
  box(2.5, 14.2, 81.5,  87.25, 10, 4.75, mat.case, { parent: roof, info: 'power' }); // right wall
  box(176, 3.7, 3.5, 0, 15.15, 42.6, mat.case, { parent: roof });               // front lip overhang
  box(176, 10.2, 3.5, 0, 8.1, 46.5, mat.case, { parent: roof, info: 'power' }); // front fascia
  for(let s = -1; s <= 1; s += 2)
    for(let i = 0; i < 5; i++)                                                  // subtle side vents
      box(.7, 2.6, 4.5, s * 88.5, 11, -12 + i * 9, mat.dark, { parent: roof });
  [[-79, 33], [79, 33], [-79, -31], [79, -31]].forEach(p =>                     // shell screws on top
    cyl(2, .5, p[0], 17.25, p[1], mat.silver, { parent: roof }));

  /* ---------- rear service badges row (photo: little green boxes) ---------- */
  badge('RS485', -68, 13);
  makeLabel('VCC SCL SDA RXD TXD IO9 IO10', -30, -31, 2.3, { color: '#c6d2da', weight: 500, parent: roof });
  badge('RGB', 8, 9);
  badge('BOOT', 20, 10);
  badge('USB', 34, 9);
  badge('ETH', 50, 9);
  badge('ANT', 64, 9);

  /* ---------- title block (photo: WAVESHARE / share awesome hardware / …) ---------- */
  makeLabel('WAVESHARE', 0, -24, 5.6, { color: '#f2f6f8', weight: 800, parent: roof });
  makeLabel('share awesome hardware', 0, -19.8, 2.5, { color: '#5fd0c4', weight: 500, parent: roof });
  makeLabel('ESP32-S3-ETH-8DI-8RO', 0, -14.6, 4.8, { color: '#41e0c8', italic: true, weight: 800, parent: roof });
  box(46, .55, 1.1, 0, SILK_Y + .05, -11.6, mat.green, { parent: roof });
  makeLabel('8CH Digital Inputs and 8CH Relay Outputs', 0, -8.6, 2.9, { color: '#dfe7ec', weight: 500, parent: roof });

  /* ---------- field-side group headers + legends + printed circles ---------- */
  const RO_X = [-58, -54, -50, -46, -42, -38, -34, -30, -26, -22];   // COM GND 1–8
  const DI_X = []; for(let i = 0; i < 10; i++) DI_X.push(-17 + i * 3.9);
  const circlesZ  = 33;
  const legendsZ  = 26;

  makeLabel('Digital Outputs (RO1–RO8)', -40, 14, 3.4,
    { color: '#41e0c8', weight: 700, parent: roof, info: 'ro' });
  makeLabel('Digital Inputs (DI1–DI8)',   0, 14, 3.4,
    { color: '#41e0c8', weight: 700, parent: roof, info: 'di' });
  badge('7~36V', 28, 14, 14);

  function legend(txt, x, info){
    return makeLabel(txt, x, legendsZ, 2.0,
      { color: '#dfe7ec', weight: 700, parent: roof, info: info });
  }
  legend('COM', RO_X[0], 'ro'); legend('GND', RO_X[1], 'ro');
  for(let i = 0; i < 8; i++) legend(String(i + 1), RO_X[2 + i], 'ro');
  legend('COM', DI_X[0], 'di'); legend('GND', DI_X[1], 'di');
  for(let i = 0; i < 8; i++) legend(String(i + 1), DI_X[2 + i], 'di');
  legend('V+  V-', 28, 'power');

  /* printed indicator circles: light up with their channel */
  RO_X.forEach((x, i) => {
    if(i >= 2) cyl(1.45, .38, x, SILK_Y, circlesZ, roLamps[i - 2],
      { pick: 'RO' + (i - 1), info: 'ro', parent: roof });
    else cyl(1.45, .38, x, SILK_Y, circlesZ, mat.printed.clone(), { info: 'ro', parent: roof });
  });
  DI_X.forEach((x, i) => {
    if(i >= 2) cyl(1.45, .38, x, SILK_Y, circlesZ, diLamps[i - 2],
      { pick: 'DI' + (i - 1), info: 'di', parent: roof });
    else cyl(1.45, .38, x, SILK_Y, circlesZ, mat.printed.clone(), { info: 'di', parent: roof });
  });
  cyl(1.45, .38, 25, SILK_Y, circlesZ, mat.printed.clone(), { info: 'power', parent: roof });
  cyl(1.45, .38, 31, SILK_Y, circlesZ, mat.printed.clone(), { info: 'power', parent: roof });

  /* ============================================================
     GREEN TERMINAL STRIPS (front, protruding under the lip)
     body runs under the panel; the front carrier + screw row and
     the wire entries stay visible in the fascia gap.
     ============================================================ */
  function stripBody(x0, x1, info){
    box(x1 - x0, 5.4, 30, (x0 + x1) / 2, 10.7, 30, mat.green, { info });           // body y 8…13.4, z 15…45
    box(x1 - x0, 5.5, 4.5, (x0 + x1) / 2, 10.75, 47.6, mat.green, { info });       // exposed carrier z 45.4…49.9
  }
  function socketSeparator(x){   // green rib between sockets on the carrier
    box(1.1, 5.5, .8, x, 10.75, 49.2, mat.greenDk);
  }
  function socketAt(x, pick, info, ringMat){
    cyl(1.3, 1.7, x, 14.25, SCREW_Z, mat.silver, { pick, info });                  // screw
    const slotm = new T.Mesh(new T.BoxGeometry(2.6, .3, .6), mat.dark);
    slotm.position.set(x, 15.15, SCREW_Z + .05);
    slotm.rotation.y = 0.8;
    scene.add(slotm);
    if(info) slotm.userData.info = info;
    box(2.4, 2.4, 1.4, x, 10.75, 49.6, mat.dark, { info });                        // wire entry
    if(ringMat){                                                                   // status ring round the screw
      const ring = new T.Mesh(new T.TorusGeometry(1.55, .26, 10, 26), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 15.5, SCREW_Z);
      return tag(ring, { info });
    }
    return null;
  }

  /* RO strip: every channel (sockets 3–10) gets ring + circle + window */
  RO_X.forEach((x, i) => {
    socketAt(x, i >= 2 ? 'RO' + (i - 1) : null, 'ro', i >= 2 ? roLamps[i - 2] : null);
    if(i < 9) socketSeparator(x + 2);
  });

  /* DI strip */
  DI_X.forEach((x, i) => {
    socketAt(x, i >= 2 ? 'DI' + (i - 1) : null, 'di', i >= 2 ? diLamps[i - 2] : null);
    if(i < 9) socketSeparator(x + 1.95);
  });

  /* 7–36 V power block, sockets at +25 / +31 */
  stripBody(21.5, 35.5, 'power');
  socketAt(25, null, 'power', null);
  socketAt(31, null, 'power', null);
  socketSeparator(28);

  /* ============================================================
     REAR OPEN STRIP (z −45…−36, visible from top and rear)
     RJ45 · USB-C · RST · RS485 A+/B− · 120Ω header · LEDs · SMA
     ============================================================ */
  /* RJ45, rear-left */
  box(17, 7, 9, -52, 11.5, -41.5, mat.dark, { info: 'eth' });
  box(11, 4, .9, -52, 11, -45.6, std(0x232a33, .8, .3), { info: 'eth' });
  for(let r = 0; r < 2; r++) for(let c = 0; c < 4; c++)
    box(2.4, 1.2, .5, -55.6 + c * 2.4, 12.6 - r * 2.2, -45.9, mat.gold, { info: 'eth' });
  makeLabel('ETH', -52, -36.2, 2.2, { color: '#dfe7ec', y: PCB_Y, info: 'eth' });

  /* USB-C */
  box(9, 3.2, 6, -28, 9.6, -42, std(0x565f6b, .6, .4), { info: 'usbc' });
  box(6.4, 1.8, 4.6, -28, 9.7, -44.2, mat.dark);
  makeLabel('USB', -28, -36.4, 2.2, { color: '#dfe7ec', y: PCB_Y, info: 'usbc' });

  /* RST button */
  cyl(1.8, 2.2, -14, 9.1, -40, mat.plastic, { pick: 'reset', info: 'reset' });
  cyl(1.55, .5, -14, 10.2, -40, resetMat, { pick: 'reset', info: 'reset' });
  makeLabel('RST', -14, -35.8, 1.7, { color: '#dfe7ec', y: PCB_Y, info: 'reset' });

  /* RS485 A+ / B− pluggable 2-pos */
  box(12, 5, 7, 12, 10.4, -41, mat.green, { info: 'rs485' });
  cyl(1.15, 1.6, 9.4, 13.4, -41, mat.silver, { info: 'rs485' });
  cyl(1.15, 1.6, 14.6, 13.4, -41, mat.silver, { info: 'rs485' });
  makeLabel('A+   B-', 12, -36.4, 2.0, { color: '#dfe7ec', y: PCB_Y, info: 'rs485' });

  /* 120Ω termination header + jumper */
  box(9, 1.6, 3, 30, 8.8, -40, mat.dark, { info: 'header' });
  for(let i = 0; i < 3; i++) cyl(.6, 2.2, 27.5 + i * 2.5, 9.9, -40, mat.gold, { info: 'header' });
  box(3, 1.3, 1.9, 27.5, 10.9, -40, mat.relayTop, { info: 'header' });
  makeLabel('120Ω', 30, -35.8, 1.8, { color: '#dfe7ec', y: PCB_Y, info: 'header' });

  /* status LEDs PWR / TXD / RXD */
  [['pwr', 44], ['txd', 49], ['rxd', 54]].forEach(k => {
    cyl(.95, 1.2, k[1], 8.6, -39, ledMats[k[0]], { info: 'leds' });
    cyl(1.12, .32, k[1], 9.25, -39, ledMats[k[0]], { info: 'leds' });
    makeLabel(k[0].toUpperCase(), k[1], -35.4, 1.7, { color: '#dfe7ec', y: PCB_Y, info: 'leds' });
  });

  /* SMA bulkhead + short rubber-duck, rear-left */
  cyl(2.4, 1.2, -76, 8.6, -42, mat.gold, { info: 'sma' });
  cyl(1.1, 1.6, -76, 9.7, -42, mat.gold, { info: 'sma' });
  const duck = new T.Mesh(new T.CylinderGeometry(.85, 1.05, 13, 16), mat.caseDk);
  duck.position.set(-76, 16, -42);
  duck.rotation.z = 0.25;
  scene.add(duck);
  duck.userData.info = 'sma'; informants.push(duck);
  const duckCap = new T.Mesh(new T.SphereGeometry(1.05, 12, 10), mat.caseDk);
  duckCap.position.set(-77.6, 22.4, -42);
  scene.add(duckCap);
  duckCap.userData.info = 'sma'; informants.push(duckCap);

  /* ============================================================
     PCB + INTERIOR (rear strip + inspector mode when opened)
     ============================================================ */
  box(171, 2, 92, 0, 7, 0, mat.pcb, { info: 'iso' });                            // the board
  box(171, .3, 2, 0, 8.15, 45, mat.sub);
  box(171, .3, 2, 0, 8.15, -45, mat.sub);
  box(2, .3, 92, -84.5, 8.15, 0, mat.sub);
  box(2, .3, 92, 84.5, 8.15, 0, mat.sub);
  makeLabel('ESP32-S3-ETH-8DI-8RO · DIN-rail gateway · 175 × 90 mm', -62, -37, 2.2,
    { color: '#8d99a8', y: PCB_Y, info: 'power' });

  /* MCU zone: WROOM carrier + shield */
  box(28, 1, 18, -30, 8.5, -20, mat.sub);
  box(23, 2.4, 14, -30, 10.2, -20, mat.metal, { info: 'mcu' });
  box(17, .5, 9, -30, 11.55, -20, mat.chip, { info: 'mcu' });
  makeLabel('ESP32-S3-WROOM-1U', -30, -9.4, 1.9, { color: '#b8c6cf', y: PCB_Y });
  /* RTC + W5500 */
  box(9, 1.6, 5, -52, 8.8, -26, mat.chip, { info: 'rtc' });
  makeLabel('RTC', -52, -21.4, 1.9, { color: '#b8c6cf', y: PCB_Y, info: 'rtc' });
  box(10, 1.6, 7, -68, 8.8, -26, mat.chip, { info: 'eth' });
  makeLabel('W5500', -68, -20.4, 1.9, { color: '#b8c6cf', y: PCB_Y, info: 'eth' });
  /* TCA9554 coil driver + expansion header */
  box(9, 1.4, 5, 4, 8.7, -12, mat.chip, { info: 'ro' });
  makeLabel('TCA9554 · EXIO1-8', 4, -7.4, 1.8, { color: '#b8c6cf', y: PCB_Y, info: 'ro' });
  box(11, 2, 5, 26, 9, -12, mat.dark, { info: 'header' });
  for(let i = 0; i < 6; i++) cyl(.7, 2.4, 22 + i * 1.6, 10.2, -12, mat.gold, { info: 'header' });
  makeLabel('EXPANSION HEADER', 26, -7.2, 1.8, { color: '#b8c6cf', y: PCB_Y, info: 'header' });
  /* buzzer */
  cyl(3, 1.6, -8, 8.8, -2, buzzerMat, { pick: 'buzzer', info: 'buzzer' });
  cyl(1.1, .4, -8, 9.75, -2, mat.dark, { pick: 'buzzer', info: 'buzzer' });

  /* relays — blue cubes behind the RO strip, windows glow with the coil */
  for(let i = 0; i < 8; i++){
    const x = -50 + i * 4;
    const cube = new T.Mesh(new T.BoxGeometry(3.4, 6.4, 10), mat.relay);
    cube.position.set(x, 11.2, 6);
    cube.userData.pick = 'RO' + (i + 1); cube.userData.info = 'ro';
    cube.userData.baseY = 11.2;
    scene.add(cube); pickables.push(cube); informants.push(cube);
    relayCubes.push(cube);
    const cap = box(3.0, .6, 9.2, x, 14.5, 6, mat.relayTop);
    cap.userData.pick = 'RO' + (i + 1); cap.userData.info = 'ro';
    pickables.push(cap); informants.push(cap);
    const win = box(2.4, 2.6, .5, x, 11.4, 11.3, roLamps[i]);
    win.userData.pick = 'RO' + (i + 1); win.userData.info = 'ro';
    pickables.push(win); informants.push(win);
  }
  /* DI optocouplers behind the DI strip */
  DI_X.forEach((x, i) => {
    if(i < 2) return;
    box(2.4, 1.8, 4.2, x, 8.9, 6, mat.chip, { info: 'iso' });
  });
  makeLabel('ISOLATION BARRIER', 0, 11.5, 2.2, { color: '#8fb5a8', y: PCB_Y, info: 'iso' });
  makeLabel('field voltages stop right here', 0, 14.5, 1.8, { color: '#6f8278', y: PCB_Y });

  /* ---------- RGB pixel + BOOT key on the panel, under their badges ---------- */
  box(3.4, .8, 3.4, 8, 17.35, -27, rgbMat, { pick: 'rgb', info: 'rgb', parent: roof });
  cyl(1.4, 1.0, 20, 17.7, -27, mat.plastic, { pick: 'boot', info: 'boot', parent: roof });
  cyl(1.2, .5, 20, 18.1, -27, bootMat, { pick: 'boot', info: 'boot', parent: roof });

  /* ============================================================
     INSPECTOR MODE — the shell lifts and slides back like a lid
     ============================================================ */
  let coverOpen = false, coverT = 0;
  function setCover(open){ coverOpen = !!open; }
  function animateCover(){
    const target = coverOpen ? 1 : 0;
    coverT += (target - coverT) * 0.12;
    if(((coverT < 0.999) && coverOpen) || ((coverT > 0.001) && !coverOpen)){
      roof.position.y = coverT * 36;         // lift straight up
      roof.position.z = -coverT * 18;        // and slide toward the rear
    }
  }

  /* ============================================================
     interaction: orbit + hover + click (unchanged contract)
     ============================================================ */
  const raycaster = new T.Raycaster();
  const ndc = new T.Vector2();
  let dragging = false, moved = false, lastX = 0, lastY = 0;

  function castAt(e, pickKey){
    const r = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(pickKey === 'info' ? informants : pickables, false);
    return hits.length ? hits[0].object : null;
  }

  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => {
    dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if(dragging){
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if(Math.abs(dx) + Math.abs(dy) > 3) moved = true;
      sph._theta -= dx * 0.006;
      sph._phi = Math.max(deg(8), Math.min(deg(78), sph._phi - dy * 0.006));
      lastX = e.clientX; lastY = e.clientY;
      if(hooks.onHover) hooks.onHover(null, e.clientX, e.clientY);
      return;
    }
    if(!hooks.onHover) return;
    const p = castAt(e, 'info');
    const pick = p ? p.userData.info : null;
    hooks.onHover(pick, e.clientX, e.clientY);
  });
  el.addEventListener('pointerup', e => {
    dragging = false;
    if(moved) return;
    const hit = castAt(e, 'pick');
    if(hit && hooks.onPick) hooks.onPick(hit.userData.pick || hit.userData.info);
  });
  el.addEventListener('wheel', e => {
    e.preventDefault();
    sph._r = Math.max(110, Math.min(500, sph._r * Math.exp(e.deltaY * 0.001)));
  }, { passive: false });
  el.addEventListener('pointerleave', () => { if(hooks.onHover) hooks.onHover(null, -1, -1); });

  /* ================= resize ================= */
  function fit(){
    const w = container.clientWidth, h = container.clientHeight;
    if(!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if(window.ResizeObserver) new ResizeObserver(fit).observe(container);
  else window.addEventListener('resize', fit);
  fit();

  /* ================= state -> materials ================= */
  function setEmissive(m, on, color, intensity){
    m.emissiveIntensity = on ? (intensity || 1.7) : 0;
    if(on && color) m.emissive.set(color);
  }

  /* relay "click": cube nudges toward the lift each frame.
     Energized = armature pulled in (small lift + warm glow). */
  function animateRelays(){
    const s = hooks.readState();                     // live I/O state, cheap to poll
    for(let i = 0; i < relayCubes.length; i++){
      const cube = relayCubes[i];
      const target = s.do[i] ? 0.45 : 0;
      cube.position.y += (cube.userData.baseY + target - cube.position.y) * 0.22;
      cube.rotation.x += ((s.do[i] ? -0.05 : 0) - cube.rotation.x) * 0.22;
    }
  }

  function sync(){
    const s = hooks.readState();
    for(let i = 0; i < 8; i++){
      setEmissive(diLamps[i] || ledMats.rxd, s.di[i], 0x35d07f);
      setEmissive(roLamps[i] || ledMats.rxd, s.do[i], 0xffa732, 2.0);
    }
    setEmissive(ledMats.pwr, true, 0xff5348);
    setEmissive(ledMats.txd, s.leds.txd, 0x44e07a);
    setEmissive(ledMats.rxd, s.leds.rxd, 0x3f7dff);
    setEmissive(buzzerMat, s.buzzer, 0xffb454, 1.3);
    setEmissive(bootMat, s.boot, 0xc8a15a, 1.4);
    if(s.rgbColor){
      const c = new T.Color(s.rgbColor);
      rgbMat.color.copy(c).multiplyScalar(0.35);
      rgbMat.emissive.copy(c);
      rgbMat.emissiveIntensity = 1.5;
    } else {
      rgbMat.color.set(0x11181f);
      rgbMat.emissiveIntensity = 0;
    }
  }
  sync();

  /* ================= render loop ================= */
  (function tick(){
    requestAnimationFrame(tick);
    updateCamera();
    animateCover();
    animateRelays();
    renderer.render(scene, camera);
  })();

  return {
    sync,
    setTheme,
    setCover,
    project(x, y, z){                        // world mm -> canvas px (tests & overlays)
      const v = new T.Vector3(x, y, z).project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - (v.y + 1) / 2) * r.height };
    },
  };
}
