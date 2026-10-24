/* ============================================================
   board3d.js — the ESP32-S3-Waveshare board as a real 3D model (three.js)
   Same parts, same layout and same state wiring as the 2D SVG:
   every coordinate below is the SVG viewBox mapped to millimetres
     x_mm = (px / 980 - 0.5) * 175
     z_mm = (py / 600 - 0.5) * 90
   LiveBehaves strictly from the app's `state` via hooks.readState(),
   so lesson sketches, the bench and the control deck all light up here.
   ============================================================ */
'use strict';

function createBoard3D(container, hooks){
  const T = THREE;

  /* ================= renderer / scene / camera ================= */
  const renderer = new T.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'none';

  const scene  = new T.Scene();
  scene.background = new T.Color(0x0c121b);
  scene.fog = new T.Fog(0x0c121b, 320, 900);

  const camera = new T.PerspectiveCamera(38, 1, 1, 2000);

  /* orbit: yaw/pitch/dist with damping (tiny custom controls) */
  const sph  = { r: 230, phi: deg(55), theta: deg(-32) };
  sph._r = sph.r; sph._phi = sph.phi; sph._theta = sph.theta;
  const TARGET = new T.Vector3(0, 2, 6);
  function deg(d){ return d * Math.PI / 180; }

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
    hemi.intensity = light ? 0.95 : 0.62;
    sun.intensity  = light ? 1.0  : 0.8;
    warm.intensity = light ? 0.0  : 0.18;
    fill.intensity = light ? 0.15 : 0.25;
  }

  /* ================= lights ================= */
  hemi = new T.HemisphereLight(0x9db2c8, 0x11161d, 0.62);
  scene.add(hemi);
  sun = new T.DirectionalLight(0xffffff, 0.8);
  sun.position.set(70, 130, 90);
  scene.add(sun);
  warm = new T.PointLight(0xffb454, 0.18, 400);
  warm.position.set(-90, 50, -50);
  scene.add(warm);
  fill = new T.DirectionalLight(0x7fa5ff, 0.25);
  fill.position.set(-70, 40, 110);
  scene.add(fill);

  /* ================= material palette ================= */
  const mat = {
    pcb:      std(0x0a3a2b, .9, .12),
    plate:    std(0x1a2027, .85, .3),
    rail:     std(0x5b6672, .55, .8),
    block:    std(0x2b3442, .6, .25),
    dark:     std(0x151b24, .7, .2),
    chip:     std(0x101318, .55, .25),
    gold:     std(0xc9a24a, .35, .95),
    metal:    std(0xaeb9c6, .32, .92),
    silver:   std(0xb7c3d4, .28, .95),
    plastic:  std(0x8f97a5, .55, .1),
    sub:      std(0x17322c, .75, .1),
    antenna:  new T.LineBasicMaterial({ color: 0xb7c3d4 }),
  };
  function std(color, rough, metal){ return new T.MeshStandardMaterial({ color, roughness: rough, metalness: metal }); }
  function glow(color){
    return new T.MeshStandardMaterial({ color: 0x11181f, roughness: .4, metalness: 0,
      emissive: new T.Color(color), emissiveIntensity: 0 });
  }

  const lampMats        = { di: [], do: [] };
  const rgbMat          = glow(0x22d97a);
  const buzzerMat       = glow(0xffb454);
  const bootMat         = glow(0xc8a15a);
  const ledMats         = { pwr: glow(0xff5348), txd: glow(0x44e07a), rxd: glow(0x3f7dff), can: glow(0xb96bff) };

  /* ================= helpers ================= */
  const pickables = [];   // meshes with userData.pick ('DI1'... / 'boot' / 'buzzer' / 'rgb')
  const informants = [];  // meshes with userData.info ('power' / 'eth' ...)

  function box(w, h, d, x, y, z, material, opts){
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    if(opts && opts.rotY) m.rotation.y = opts.rotY;
    ((opts && opts.parent) || scene).add(m);
    tag(m, opts);
    return m;
  }
  function cyl(r, h, x, y, z, material, opts){
    const m = new T.Mesh(new T.CylinderGeometry(r, r, h, 24), material);
    m.position.set(x, y, z);
    (opts && opts.parent || scene).add(m);
    tag(m, opts);
    return m;
  }
  function tag(m, opts){
    if(!opts) return;
    if(opts.pick){ m.userData.pick = opts.pick; pickables.push(m); }
    if(opts.info){ m.userData.info = opts.info; informants.push(m); }
  }

  /* SVG pixel coordinates -> board millimetres */
  const mmX = px => (px / 980 - 0.5) * 175;
  const mmZ = py => (py / 600 - 0.5) * 90;
  const SVG_Y = 2.02;   // resting height of flat labels on the PCB top

  function makeLabel(text, px, py, sizeSvgPx, color){
    const pxPerMm = 9;
    const millimetres = sizeSvgPx * 0.1786;             // svg unit scale (980px -> 175mm)
    const fontMm = Math.max(2.0, millimetres * 1.12);
    const pad = 3;
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    ctx.font = '600 ' + Math.round(fontMm * pxPerMm) + 'px system-ui, sans-serif';
    const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
    c.width = w; c.height = Math.ceil(fontMm * pxPerMm) + pad * 2;
    const ctx2 = c.getContext('2d');
    ctx2.font = '600 ' + Math.round(fontMm * pxPerMm) + 'px system-ui, sans-serif';
    ctx2.fillStyle = color || '#9fb1bd';
    ctx2.textBaseline = 'middle';
    ctx2.fillText(text, pad, c.height / 2);
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = 4;
    const g = new T.PlaneGeometry(w / pxPerMm, c.height / pxPerMm);
    const mesh = new T.Mesh(g, new T.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(mmX(px) + w / pxPerMm / 2, SVG_Y, mmZ(py));
    scene.add(mesh);
    return mesh;
  }
  function flatLabel(text, px, py, sizeSvgPx, color, info){
    const m = makeLabel(text, px, py, sizeSvgPx, color);
    if(info){ m.userData.info = info; informants.push(m); }
    return m;
  }

  /* ================= framing: plate, rail, PCB ================= */
  box(187, 3, 98, 0, -2.5, 0, mat.plate, { info:'power' });            // DIN case base (hover -> power info)
  box(187, 2, 15, 0, -4.9, 0, mat.rail);                              // DIN rail lip under the case
  // standoffs
  [[-80,-38],[ -80,38],[80,-38],[80,38],[-30,38],[30,-38]].forEach(p =>
    cyl(2, 1, p[0], -0.5, p[1], mat.plastic));
  box(175, 2, 90, 0, 1, 0, mat.pcb, { info:'iso' });                  // green board — hover reports isolation story

  /* copper border frame for flavour */
  box(175, .3, 3, 0, 2.2, 44.2, mat.sub);
  box(175, .3, 3, 0, 2.2, -44.2, mat.sub);
  box(3, .3, 90, -86.2, 2.2, 0, mat.sub);
  box(3, .3, 90, 86.2, 2.2, 0, mat.sub);

  /* ================= left column: power / RS485 / CAN terminals ================= */
  function terminalBlock(x, z, w, d, n, info){
    box(w, 7, d, x, 5.5, z, mat.block, { info });
    for(let i = 0; i < n; i++){
      const sx = x - (w / 2) + w * (i + 0.5) / n;
      cyl(2.7, 7, sx, 5.5, z, mat.block, { info });
      cyl(1.75, 1.4, sx, 9.55, z, mat.silver, { info });
      slot(sx, 10.3, z);
    }
  }
  function slot(x, y, z){
    const m = new T.Mesh(new T.BoxGeometry(3, .3, .5), mat.dark);
    m.position.set(x, y, z);
    m.rotation.y = 0.8;
    scene.add(m);
  }
  terminalBlock(-66, -30, 22, 9, 2, 'power');                          // DC IN 7–36 V
  terminalBlock(-66, -13, 22, 8, 2, 'rs485');                          // RS485 A+ / B−
  terminalBlock(-66, 1, 22, 8, 2, 'can');                              // CAN H / L
  flatLabel('DC IN 7–36 V', 66, 52, 10);
  flatLabel('V+   V−', 92, 90, 9, '#7d8a9e');
  flatLabel('RS485 · 17/18/21', 92, 144, 9);
  flatLabel('A+   B−', 92, 190, 9, '#7d8a9e');
  flatLabel('CAN · GPIO2/3', 92, 230, 9);
  flatLabel('H    L', 92, 266, 9, '#7d8a9e');

  /* ================= MCU zone ================= */
  // WROOM carrier + metal shield
  box(30, 1, 18, -24, 2.5, -17, mat.sub);
  box(25, 2.4, 15, -24, 4.4, -17, mat.metal, { info:'mcu' });
  box(20, .5, 10, -24, 5.85, -17, mat.chip);
  box(3, .8, 3, -36.4, 3, -24, mat.gold, { info:'sma' });              // u.FL antenna pigtail corner

  // RTC chip
  box(12, 1.6, 6, -42.2, 2.8, -0.5, mat.chip, { info:'rtc' });
  // expansion header with pin row
  box(11, 2, 5, -12.2, 3, -0.5, mat.dark, { info:'header' });
  for(let i = 0; i < 6; i++) cyl(.7, 2.4, -16 + i * 1.6, 4.2, -0.5, mat.gold);

  /* isolation barrier: optocouplers + darlingtons */
  const ISO_Z = mmZ(363);
  for(let i = 0; i < 4; i++)
    box(2.8, 1.6, 4, -15 + i * 3.5, 2.8, ISO_Z, mat.chip, { info:'iso' });
  for(let i = 0; i < 4; i++)
    box(2.8, 1.6, 4, 5 + i * 3.5, 2.8, ISO_Z, mat.chip, { info:'iso' });

  /* ================= right column: network & services ================= */
  // RJ45 + W5500
  box(16, 12, 13, 68.1, 8, -30, mat.dark, { info:'eth' });
  for(let r = 0; r < 2; r++) for(let c = 0; c < 4; c++)   // two rows of gold contacts on the RJ face
    box(2.1, 1.5, .5, 68.1 - 5.2 + c * 3.4, 9.6 - r * 2.6, -36.45, mat.gold, { info:'eth' });
  box(8, 1.4, 6, 56, 2.7, -30, mat.chip, { info:'eth' });
  // PoE module
  box(14, 3.4, 8, 68.1, 3.7, -19, mat.sub, { info:'poe' });
  // USB-C
  box(10, 3.2, 4.5, 68.1, 3.6, -13, std(0x565f6b, .6, .4), { info:'usbc' });
  // TF slot
  box(13, 1.8, 9, 68.1, 2.9, -8, mat.dark, { info:'tf' });

  // WS2812 RGB pixel
  box(4, 1.6, 4, 61.1, 2.8, -2.7, rgbMat, { pick:'rgb', info:'rgb' });
  // Buzzer
  cyl(2.6, 2.4, 68.7, 3.2, -2.7, buzzerMat, { pick:'buzzer', info:'buzzer' });
  cyl(1, .4, 68.7, 4.4, -2.7, mat.dark, { pick:'buzzer', info:'buzzer' });
  // BOOT button
  cyl(2.4, 2.6, 75.1, 3.3, -2.7, mat.plastic, { pick:'boot', info:'boot' });
  cyl(2.15, .5, 75.1, 4.4, -2.7, bootMat, { pick:'boot', info:'boot' });

  // indicator LED domes PWR/TXD/RXD/CAN
  const ledKinds = ['pwr','txd','rxd','can'];
  ledKinds.forEach((k, i) => {
    const x = 62.4 + i * 4.64;
    cyl(1.05, 1.5, x, 2.75, 6, ledMats[k], { info:'leds' });
    cyl(1.2, .35, x, 3.45, 6, ledMats[k], { info:'leds' });   // glowing top
  });

  // SMA antenna
  cyl(2, 1.8, 61.05, 2.9, 15.6, mat.silver, { info:'sma' });
  cyl(.6, 1.4, 61.05, 4.4, 15.6, mat.silver, { info:'sma' });
  (function(){
    const pts = [ new T.Vector3(61.05, 5, 15.6), new T.Vector3(61.05, 13, 15.6), new T.Vector3(67, 17, 12) ];
    const g = new T.BufferGeometry().setFromPoints(pts);
    scene.add(new T.Line(g, mat.antenna));
  })();

  // right column labels
  flatLabel('W5500 ETH · 12-16,39', 871, 132, 9);
  flatLabel('PoE · 802.3af', 871, 177, 9);
  flatLabel('USB-C 5 V', 871, 212, 9);
  flatLabel('TF · 45/47/48', 871, 246, 9);
  flatLabel('RGB', 832, 306, 8);
  flatLabel('BUZ', 875, 306, 8);
  flatLabel('BOOT', 913, 306, 8);
  flatLabel('SMA ANTENNA', 884, 406, 9);
  [['pwr','PWR'],['txd','TXD'],['rxd','RXD'],['can','CAN']].forEach((d, i) => {
    flatLabel(d[1], 828 + i * 26, 362, 8);
  });

  /* ================= MCU / barrier / titles labels ================= */
  flatLabel('ESP32-S3-POE-ETH-8DI-8DO · DIN-rail 175 × 90 mm', 492, 44, 10, '#c3cddb');
  flatLabel('ISOLATED FIELD SIDE — logic side left harmless', 38, 44, 9, '#7d8a9e');
  flatLabel('ESP32-S3-WROOM-1U', 356, 250, 8);
  flatLabel('LX7 · Wi-Fi/BLE · 16 MB', 356, 263, 7);
  flatLabel('RTC · 40/41/42', 295, 298, 8);
  flatLabel('EXPANSION HEADER', 421, 298, 7.5);
  flatLabel('ISOLATION BARRIER', 490, 344, 9, '#8fb5a8');
  flatLabel('OPTOCOUPLERS', 438, 367, 8, '#8fb5a8');
  flatLabel('DARLINGTON', 542, 367, 8, '#8fb5a8');
  flatLabel('field voltages stop right here', 490, 398, 8, '#6c7a8d');

  /* ================= DI strip (bottom-left) ================= */
  for(let i = 0; i < 8; i++){
    const px = 82 + i * 49;
    const x = mmX(px), zLamp = mmZ(492), zScrew = mmZ(506);
    const m = glow(0x35d07f);
    lampMats.di.push(m);
    cyl(1.35, 1.5, x, 2.75, zLamp, m, { pick:'DI' + (i + 1), info:'di' });
    cyl(1.4, .35, x, 3.45, zLamp, m, { pick:'DI' + (i + 1), info:'di' });
    cyl(2.7, 1.6, x, 2.8, zScrew, mat.block, { pick:'DI' + (i + 1), info:'di' });
    cyl(2.4, 1.5, x, 2.9, zScrew, mat.silver, { pick:'DI' + (i + 1), info:'di' });
    slot(x, 3.7, zScrew);
    flatLabel('DI' + (i + 1), px, 532, 9, '#c3cddb', 'di');
    flatLabel('GPIO' + (i + 4), px, 542, 7, '#7d8a9e', 'di');
  }
  flatLabel('DIGITAL INPUTS · 5–36 V · OPTO ISOLATED · NPN / PNP', 256, 444, 9);

  /* ================= DO strip (bottom-right) ================= */
  for(let i = 0; i < 8; i++){
    const px = 664 + i * 37.5;
    const x = mmX(px), zLamp = mmZ(492), zScrew = mmZ(506);
    const m = glow(0x35d07f);
    lampMats.do.push(m);
    cyl(1.3, 1.5, x, 2.75, zLamp, m, { pick:'DO' + (i + 1), info:'do' });
    cyl(1.4, .35, x, 3.45, zLamp, m, { pick:'DO' + (i + 1), info:'do' });
    cyl(3.3, 1.8, x, 2.9, zScrew, mat.block, { pick:'DO' + (i + 1), info:'do' });
    cyl(2.9, 1.5, x, 3.05, zScrew, mat.silver, { pick:'DO' + (i + 1), info:'do' });
    slot(x, 3.85, zScrew);
    flatLabel('DO' + (i + 1), px, 532, 9, '#c3cddb', 'do');
    flatLabel('EXIO' + (i + 1), px, 541, 6.5, '#7d8a9e', 'do');
  }
  flatLabel('DIGITAL OUTPUTS · SINK 500 mA · FLYBACK INSIDE', 790, 444, 9);

  /* ================= interaction: orbit + hover + click ================= */
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
      sph._phi = Math.max(deg(8), Math.min(deg(80), sph._phi - dy * 0.006));
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
    sph._r = Math.max(95, Math.min(480, sph._r * Math.exp(e.deltaY * 0.001)));
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

  /* ================= render loop ================= */
  (function tick(){
    requestAnimationFrame(tick);
    updateCamera();
    renderer.render(scene, camera);
  })();

  /* ================= state -> materials ================= */
  function setEmissive(m, on, color, intensity){
    m.emissiveIntensity = on ? (intensity || 1.7) : 0;
    if(on && color) m.emissive.set(color);
  }

  function sync(){
    const s = hooks.readState();
    for(let i = 0; i < 8; i++){
      setEmissive(lampMats.di[i], s.di[i], 0x35d07f);
      setEmissive(lampMats.do[i], s.do[i], 0x35d07f);
    }
    setEmissive(ledMats.pwr, true, 0xff5348);
    setEmissive(ledMats.txd, s.leds.txd, 0x44e07a);
    setEmissive(ledMats.rxd, s.leds.rxd, 0x3f7dff);
    setEmissive(ledMats.can, s.leds.can, 0xb96bff);
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

  return {
    sync,
    setTheme,
    project(x, y, z){                        // world mm -> canvas px (tests & overlays)
      const v = new T.Vector3(x, y, z).project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - (v.y + 1) / 2) * r.height };
    },
  };
}