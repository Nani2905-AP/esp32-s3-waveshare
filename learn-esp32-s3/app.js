/* ============================================================
   ESP32-S3-Waveshare — interactive learning board for the
   Waveshare ESP32-S3-POE-ETH-8DI-8DO
   (GPIO numbers follow the official Waveshare documentation)
   ============================================================ */
'use strict';

const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const SVGNS = 'http://www.w3.org/2000/svg';

function svgEl(tag, attrs, parent){
  const n = document.createElementNS(SVGNS, tag);
  for(const k in attrs){
    if(k === 'text') n.textContent = attrs[k];
    else n.setAttribute(k, attrs[k]);
  }
  if(parent) parent.appendChild(n);
  return n;
}

/* ================= runtime state ================= */
const state = {
  di:    [false,false,false,false,false,false,false,false],  // wire closed (= LOW, active)
  do:    [false,false,false,false,false,false,false,false],  // channel conducting
  boot:  false,
  buzzer:false,
  rgbColor: null,
  leds:  {pwr:true, txd:false, rxd:false, can:false},
  currentLesson: null,
  done:  new Set(JSON.parse(localStorage.getItem('iodesk.done') || '[]')),
  runToken: 0,
  activeRt: null,
};

const simEvents = [];

const PIN_ALIAS = {
  EXIO1:'DO1',EXIO2:'DO2',EXIO3:'DO3',EXIO4:'DO4',EXIO5:'DO5',EXIO6:'DO6',EXIO7:'DO7',EXIO8:'DO8',
  CH1:'DO1',CH2:'DO2',CH3:'DO3',CH4:'DO4',CH5:'DO5',CH6:'DO6',CH7:'DO7',CH8:'DO8',
  GPIO4:'DI1',GPIO5:'DI2',GPIO6:'DI3',GPIO7:'DI4',GPIO8:'DI5',GPIO9:'DI6',GPIO10:'DI7',GPIO11:'DI8',
  GPIO46:'BUZZER', GPIO0:'BOOT', GPIO38:'RGB',
};

function pinKey(p){
  if(typeof p === 'string'){
    const k = p.trim().toUpperCase();
    return PIN_ALIAS[k] || k;
  }
  if(typeof p === 'number' && p >= 4 && p <= 11) return 'DI' + (p - 3);
  return String(p);
}

function logEvent(msg){
  const t = new Date().toLocaleTimeString();
  simEvents.push(t + '  ' + msg);
  if(simEvents.length > 80) simEvents.shift();
  const el = $('#sim-log-lines');
  if(el){
    el.innerHTML = simEvents.map(l => '<div>' + esc(l) + '</div>').join('');
    el.scrollTop = el.scrollHeight;
  }
}

function flashLED(k, ms){
  state.leds[k] = true;
  syncBoard();
  clearTimeout(flashLED._t[k]);
  flashLED._t[k] = setTimeout(() => { state.leds[k] = false; syncBoard(); }, ms || 260);
}
flashLED._t = {};

/* ================= state changes ================= */
function setDI(i, closed){ state.di[i] = closed; syncAll(); }
function setDO(i, on){ state.do[i] = on; syncAll(); }
function toggleDI(i){ setDI(i, !state.di[i]); logEvent('SW' + (i+1) + ' (DI' + (i+1) + ', GPIO' + (i+4) + ') ' + (state.di[i] ? 'CLOSED → active LOW' : 'OPEN → idle HIGH')); }
function toggleDO(i){ setDO(i, !state.do[i]); logEvent('CH' + (i+1) + ' (DO' + (i+1) + ', EXIO' + (i+1) + ') ' + (state.do[i] ? 'ON — lamp L' + (i+1) + ' lights' : 'OFF — lamp L' + (i+1) + ' out')); }
function toggleBoot(){
  state.boot = !state.boot;
  syncBoard();
  logEvent('BOOT button ' + (state.boot ? 'PRESSED (GPIO0 = LOW)' : 'released (GPIO0 = HIGH)'));
}
function setBuzzer(on, ms){
  state.buzzer = on;
  syncBoard();
  clearTimeout(setBuzzer._t);
  if(on && ms) setBuzzer._t = setTimeout(() => { setBuzzer(false); }, ms);
}
function setBuzzerNow(on, ms, log){
  setBuzzer(on, ms);
  if(log) logEvent('buzzer ' + (on ? 'BEEP' : 'silent'));
}
function toggleBuzzer(){ setBuzzerNow(!state.buzzer, state.buzzer ? undefined : 180, true); }
function setRGB(css){
  state.rgbColor = css || null;
  syncBoard();
}
let rgbIdx = 0;
function cycleRGB(){
  const palette = ['#25303f', '#ff8800', '#0096ff', '#22d97a', '#e0445a', '#b96bff'];
  rgbIdx = (rgbIdx + 1) % palette.length;
  setRGB(palette[rgbIdx] === '#25303f' ? null : palette[rgbIdx]);
  logEvent('WS2812 (GPIO38) → ' + (state.rgbColor || 'off'));
}
function beep(ms){
  setBuzzer(true, ms || 150);
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(Ctx){
      if(!beep._ctx) beep._ctx = new Ctx();
      const ctx = beep._ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 440; o.type = 'square';
      g.gain.value = 0.04;
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + Math.min((ms || 150) / 1000, 0.4));
    }
  }catch(e){ /* audio blocked — visual flash is enough */ }
}
function chaserOnce(){
  let i = 0;
  const step = () => {
    if(i >= 8){ logEvent('chaser cycle complete'); return; }
    const idx = i++;
    toggleDO(idx);
    setTimeout(() => { toggleDO(idx); step(); }, 90);
  };
  step();
}
function allDO(on){
  for(let i = 0; i < 8; i++) setDO(i, on);
  logEvent('all channels ' + (on ? 'ON (frame 06 05 00 FF FF ...)' : 'OFF (frame 06 05 00 FF 00 ...)'));
}

/* ================= board SVG ================= */
let boardSVG = null;
let board3d  = null;

function drawBoard(container){
  const S = svgEl('svg', {viewBox:'0 0 980 600'}, null);
  container.appendChild(S);

  svgEl('rect', {x:8,y:8,width:964,height:584,rx:20,class:'case'}, S);
  svgEl('rect', {x:24,y:24,width:932,height:552,rx:12,class:'pcb'}, S);
  svgEl('text', {x:38,y:44,class:'al-label',text:'ISOLATED FIELD SIDE — logic side left harmless'}, S);
  svgEl('text', {x:492,y:44,class:'al-label','text-anchor':'middle',text:'ESP32-S3-POE-ETH-8DI-8DO · DIN-rail 175 × 90 mm'}, S);

  ['M 136 100 C 180 100 190 150 240 170',
   'M 136 180 C 170 180 190 175 240 185',
   'M 136 260 C 175 260 195 205 240 196',
   'M 360 180 C 520 180 660 168 814 100',
   'M 360 196 C 520 196 660 188 814 168',
   'M 300 300 C 300 380 170 400 100 440',
   'M 310 250 C 330 340 480 370 545 440',
   'M 640 150 C 700 150 740 175 812 190'
  ].forEach(d => svgEl('path', {d, class:'trace'}, S));

  function partGroup(id, x, y, w, h){
    const g = svgEl('g', {class:'part', 'data-part':id}, S);
    svgEl('rect', {x, y, width:w, height:h, rx:6, class:'hot'}, g);
    return g;
  }
  const T = (g, x, y, txt, size, anchor) =>
    svgEl('text', {x, y, class:'part-label','text-anchor':anchor || 'middle','font-size':size || 11, text:txt}, g);
  const AL = (g, x, y, txt, size, anchor) =>
    svgEl('text', {x, y, class:'al-label','text-anchor':anchor || 'middle','font-size':size || 10, text:txt}, g);
  const terminal = (g, cx, cy, tag, tagX, tagY) => {
    svgEl('circle', {cx, cy, r:13, class:'terminal-circle'}, g);
    svgEl('circle', {cx, cy, r:4.6, class:'screw'}, g);
    if(tag) svgEl('text', {x:tagX, y:tagY, class:'al-label','text-anchor':'middle',text:tag}, g);
  };

  /* --- power terminal --- */
  let g = partGroup('power', 44, 56, 96, 82);
  svgEl('rect', {x:50,y:62,width:84,height:68,rx:6,class:'terminal-block'}, g);
  terminal(g, 74, 99, 'V+', 74, 126);
  terminal(g, 110, 99, 'V−', 110, 126);
  T(g, 92, 52, 'DC IN 7–36 V', 10);

  /* --- RS485 --- */
  g = partGroup('rs485', 44, 148, 96, 74);
  svgEl('rect', {x:50,y:154,width:84,height:58,rx:6,class:'terminal-block'}, g);
  terminal(g, 74, 184, 'A+', 74, 210);
  terminal(g, 110, 184, 'B−', 110, 210);
  T(g, 92, 144, 'RS485  ·  17/18/21', 9);

  /* --- CAN --- */
  g = partGroup('can', 44, 234, 96, 74);
  svgEl('rect', {x:50,y:240,width:84,height:58,rx:6,class:'terminal-block'}, g);
  terminal(g, 74, 270, 'H', 74, 296);
  terminal(g, 110, 270, 'L', 110, 296);
  T(g, 92, 230, 'CAN  ·  GPIO2/3', 9);

  /* --- MCU module --- */
  g = partGroup('mcu', 236, 112, 240, 148);
  svgEl('rect', {x:242,y:118,width:228,height:130,rx:7,class:'shield'}, g);
  for(let i = 0; i < 8; i++)
    svgEl('line', {x1:250, y1:138+i*16, x2:462, y2:138+i*16, class:'shield-hatch'}, g);
  svgEl('rect', {x:256, y:132, width:200, height:102, rx:4, class:'chip'}, g);
  T(g, 356, 250, 'ESP32-S3-WROOM-1U', 11);
  T(g, 356, 263, 'LX7 dual-core · 240 MHz · Wi-Fi / BLE · 16 MB + 8 MB', 8);

  /* --- RTC --- */
  g = partGroup('rtc', 236, 274, 118, 40);
  svgEl('rect', {x:242,y:280,width:106,height:28,rx:4,class:'chip'}, g);
  T(g, 295, 298, 'RTC  ·  40 / 41 / 42', 9);

  /* --- expansion header --- */
  g = partGroup('header', 366, 274, 110, 40);
  svgEl('rect', {x:372,y:280,width:98,height:28,rx:4,class:'chip'}, g);
  for(let i = 0; i < 6; i++)
    svgEl('circle', {cx:386+i*15, cy:294, r:3.4, class:'screw'}, g);
  T(g, 421, 298, 'EXPANSION HEADER', 7);

  /* --- isolation barrier --- */
  g = partGroup('iso', 340, 324, 300, 96);
  svgEl('rect', {x:346,y:330,width:288,height:78,rx:8,fill:'none',stroke:'#4a5f6d','stroke-width':2,'stroke-dasharray':'7 6'}, g);
  svgEl('rect', {x:392,y:350,width:92,height:26,rx:6,class:'opto'}, g);
  T(g, 438, 367, 'OPTOCOUPLERS', 8);
  svgEl('rect', {x:496,y:350,width:92,height:26,rx:6,class:'opto'}, g);
  T(g, 542, 367, 'DARLINGTON', 8);
  T(g, 490, 344, 'ISOLATION BARRIER', 10);
  T(g, 490, 398, 'field voltages stop right here', 8.5);

  /* --- Ethernet + PoE + USB-C + TF --- */
  g = partGroup('eth', 812, 54, 118, 96);
  svgEl('rect', {x:818,y:60,width:106,height:80,rx:7,class:'rj'}, g);
  for(let r = 0; r < 2; r++) for(let c = 0; c < 4; c++)
    svgEl('rect', {x:828+c*22, y:74+r*26, width:16, height:12, rx:2, fill:'#0d131c'}, g);
  T(g, 871, 132, 'W5500 ETH · 12-16,39', 9);

  g = partGroup('poe', 812, 158, 118, 28);
  svgEl('rect', {x:818,y:163,width:106,height:18,rx:4,class:'chip'}, g);
  T(g, 871, 177, 'PoE · IEEE 802.3af', 9);

  g = partGroup('usbc', 812, 194, 118, 26);
  svgEl('rect', {x:818,y:198,width:106,height:17,rx:6,class:'usbc'}, g);
  T(g, 871, 212, 'USB-C 5 V / flash', 9);

  g = partGroup('tf', 812, 228, 118, 26);
  svgEl('rect', {x:818,y:232,width:106,height:18,rx:4,class:'tf'}, g);
  T(g, 871, 246, 'TF card · 45/47/48', 9);

  /* --- RGB pixel --- */
  g = partGroup('rgb', 812, 262, 40, 42);
  svgEl('rect', {x:818,y:268,width:28,height:28,rx:5,id:'rgb-sq',class:'rgb'}, g);
  T(g, 832, 306, 'RGB', 9);

  /* --- buzzer --- */
  g = partGroup('buzzer', 858, 262, 34, 42);
  svgEl('circle', {cx:875,cy:282,r:13,id:'buzzer-hole',class:'buzzer-hole'}, g);
  svgEl('circle', {cx:875,cy:282,r:2.6,class:'screw'}, g);
  T(g, 875, 306, 'BUZ', 9);

  /* --- BOOT button --- */
  g = partGroup('boot', 896, 262, 34, 42);
  svgEl('circle', {cx:913,cy:282,r:12,id:'boot-btn',class:'buzzer-hole'}, g);
  T(g, 913, 306, 'BOOT', 8);

  /* --- indicator LED stack --- */
  g = partGroup('leds', 812, 318, 118, 54);
  [['pwr','PWR'],['txd','TXD'],['rxd','RXD'],['can','CAN']].forEach((d, i) => {
    const cx = 828 + i*26;
    svgEl('circle', {cx, cy:340, r:6, id:'led-'+d[0], class:'led-'+d[0]}, g);
    svgEl('text', {x:cx, y:360, class:'al-label','text-anchor':'middle',text:d[1]}, g);
  });

  /* --- SMA antenna --- */
  g = partGroup('sma', 812, 376, 118, 46);
  svgEl('circle', {cx:838, cy:404, r:11, class:'terminal-circle'}, g);
  svgEl('circle', {cx:838, cy:404, r:3.4, class:'screw'}, g);
  svgEl('path', {d:'M 838 392 L 838 378 M 826 382 L 850 398', class:'antenna'}, g);
  T(g, 884, 406, 'SMA ANTENNA', 9);

  /* --- DI strip --- */
  g = partGroup('di', 56, 450, 400, 108);
  svgEl('rect', {x:62,y:456,width:388,height:64,rx:6,class:'terminal-block'}, g);
  for(let i = 0; i < 8; i++){
    const cx = 82 + i*49;
    svgEl('circle', {cx, cy:492, r:5.4, class:'lamp', id:'di-lamp-'+i, 'data-pin':'DI'+(i+1)}, g);
    svgEl('circle', {cx, cy:506, r:12.4, class:'terminal-circle', 'data-pin':'DI'+(i+1)}, g);
    svgEl('circle', {cx, cy:506, r:4.4, class:'screw'}, g);
    svgEl('text', {x:cx, y:532, class:'al-label','text-anchor':'middle',text:'DI'+(i+1)}, g);
    svgEl('text', {x:cx, y:542, class:'al-label','text-anchor':'middle','font-size':7.5,text:'GPIO'+(i+4)}, g);
  }
  T(g, 256, 444, 'DIGITAL INPUTS · 5–36 V · OPTO ISOLATED · NPN / PNP', 9);

  /* --- DO strip --- */
  g = partGroup('do', 640, 450, 300, 108);
  svgEl('rect', {x:646,y:456,width:288,height:64,rx:6,class:'terminal-block'}, g);
  for(let i = 0; i < 8; i++){
    const cx = 664 + i*37.5;
    svgEl('circle', {cx, cy:492, r:5.2, class:'lamp', id:'do-lamp-'+i, 'data-pin':'DO'+(i+1)}, g);
    svgEl('circle', {cx, cy:506, r:10.6, class:'terminal-circle', 'data-pin':'DO'+(i+1)}, g);
    svgEl('circle', {cx, cy:506, r:3.8, class:'screw'}, g);
    svgEl('text', {x:cx, y:532, class:'al-label','text-anchor':'middle',text:'DO'+(i+1)}, g);
    svgEl('text', {x:cx, y:541, class:'al-label','text-anchor':'middle','font-size':7,text:'EXIO'+(i+1)}, g);
  }
  T(g, 790, 444, 'DIGITAL OUTPUTS · SINK 500 mA · FLYBACK INSIDE', 9);

  S.addEventListener('click', e => {
    const pin = e.target.closest('[data-pin]');
    if(pin){
      const k = pin.getAttribute('data-pin');
      if(k.startsWith('DI')) toggleDI(k.slice(2) - 1);
      else toggleDO(k.slice(2) - 1);
      return;
    }
    const part = e.target.closest('.part');
    if(!part) return;
    const id = part.getAttribute('data-part');
    if(id === 'boot') toggleBoot();
    else if(id === 'buzzer'){ beep(150); logEvent('buzzer BEEP'); }
    else if(id === 'rgb') cycleRGB();
  });
  return S;
}

function syncBoard(){
  if(board3d){
    board3d.sync();
    if(!boardSVG) return;   // 3D mode — SVG updater already replaced by the 3D sync
  }
  if(!boardSVG) return;
  for(let i = 0; i < 8; i++){
    const dl = boardSVG.querySelector('#di-lamp-'+i);
    const ol = boardSVG.querySelector('#do-lamp-'+i);
    if(dl) dl.classList.toggle('on', state.di[i]);
    if(ol) ol.classList.toggle('on', state.do[i]);
  }
  const rgb = boardSVG.querySelector('#rgb-sq');
  if(rgb){
    rgb.style.fill = state.rgbColor || '#25303f';
    rgb.style.filter = state.rgbColor ? 'drop-shadow(0 0 7px ' + state.rgbColor + ')' : '';
  }
  const buz = boardSVG.querySelector('#buzzer-hole');
  if(buz){
    buz.style.fill = state.buzzer ? '#ffb454' : '#0f141d';
    buz.style.filter = state.buzzer ? 'drop-shadow(0 0 6px #ffb454)' : '';
  }
  const bt = boardSVG.querySelector('#boot-btn');
  if(bt){
    bt.style.fill = state.boot ? '#c8a15a' : '#0f141d';
    bt.style.filter = state.boot ? 'drop-shadow(0 0 6px #ffb45488)' : '';
  }
  ['pwr','txd','rxd','can'].forEach(k => {
    const led = boardSVG.querySelector('#led-'+k);
    if(led) led.classList.toggle('on', state.leds[k]);
  });
}

/* ================= bench ================= */
function buildBench(){
  const diRow = $('#di-switches'), doRow = $('#do-lamps');
  for(let i = 0; i < 8; i++){
    const sw = document.createElement('button');
    sw.className = 'mini-switch';
    sw.innerHTML = '<span>SW'+(i+1)+'</span><span class="knob"></span><span class="gpio">GPIO'+(i+4)+'</span>';
    sw.onclick = () => toggleDI(i);
    diRow.appendChild(sw);

    const lp = document.createElement('button');
    lp.className = 'mini-lamp';
    lp.innerHTML = '<span class="dot"></span><span>DO'+(i+1)+'</span>';
    lp.title = 'EXIO' + (i+1) + ' — click to toggle this channel';
    lp.onclick = () => toggleDO(i);
    doRow.appendChild(lp);
  }
  syncBench();
}
function syncBench(){
  $$('#di-switches .mini-switch').forEach((sw, i) => sw.classList.toggle('closed', state.di[i]));
  $$('#do-lamps .mini-lamp').forEach((lp, i) => lp.classList.toggle('on', state.do[i]));
}
function syncAll(){ syncBoard(); syncBench(); }

/* ================= syntax highlighter ================= */
function highlight(src){
  const s = esc(src);
  const RX = /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|\b(void|int|long|short|float|double|bool|boolean|byte|char|const|unsigned|static|volatile|if|else|for|while|do|return|switch|case|break|continue|true|false|sizeof)\b|\b(0x[0-9A-Fa-f]+|\d+\.?\d*)\b|\b(GPIO\d+|EXIO\d+|CH\d|DI\d|DO\d|SW\d|HIGH|LOW|INPUT|OUTPUT|INPUT_PULLUP|Serial|WiFi|RS485|server|strip|NEO_GRB|NEO_KHZ800|WebServer|HardwareSerial|Adafruit_NeoPixel|Buzzer_PWM)\b|\b([A-Za-z_]\w*)(?=\()/g;
  return s.replace(RX, (m, com, str, kw, num, pin, fn) => {
    if(com) return '<span class="tok-com">' + com + '</span>';
    if(str) return '<span class="tok-str">' + str + '</span>';
    if(kw)  return '<span class="tok-kw">' + kw + '</span>';
    if(num) return '<span class="tok-num">' + num + '</span>';
    if(pin) return '<span class="tok-pin">' + pin + '</span>';
    if(fn)  return '<span class="tok-fn">' + fn + '</span>';
    return m;
  });
}

/* ================= sketch interpreter ================= */
function buildSketchBody(src){
  return pinAliasesPrelude() + '\n' +
    'const Serial = {begin(){},end(){},print:s=>__h.print(s),println:s=>__h.println(s),printf:(f,...a)=>__h.printf(f,a),available:()=>0};\n' +
    'const HIGH=1,LOW=0,INPUT=0,OUTPUT=1,INPUT_PULLUP=2;\n' +
    'const millis=()=>__h.millis(), micros=()=>__h.millis()*1000;\n' +
    'const pinMode=()=>{}, digitalWrite=(p,v)=>__h.write(p,v), digitalRead=p=>__h.read(p), digitalToggle=p=>__h.toggle(p);\n' +
    'const Buzzer_PWM=ms=>__h.beep(ms), attachInterrupt=()=>{};\n' +
    'const NEO_GRB="GRB", NEO_KHZ800=800;\n' +
    'const WiFi={softAP(){__h.wifiAP();return 1},softAPIP(){return __h.wifiIP()},begin(s,p){__h.wifiSTA(s);return 1},status(){return 3},localIP(){return __h.wifiIP()}};\n' +
    compileSketch(src) +
    '\n;return {setup:(typeof __setup==="function")?__setup:null, loop:(typeof __loop==="function")?__loop:null};';
}

function compileSketch(src){
  let t = src.replace(/^[ \t]*#.*$/gm, '');
  t = t.replace(/void\s+setup\s*\(\s*\)\s*\{/, 'let __setup = async (__h) => {');
  t = t.replace(/void\s+loop\s*\(\s*\)\s*\{/, 'let __loop = async (__h) => {');
  t = t.replace(/Adafruit_NeoPixel\s+(\w+)\s*=\s*Adafruit_NeoPixel\s*\(/, 'var $1 = __h.newStrip(');
  t = t.replace(/HardwareSerial\s+(\w+)\s*\(/, 'var $1 = __h.newSerial(');
  t = t.replace(/WebServer\s+(\w+)\s*\(([^)]*)\)\s*;/, 'var $1 = __h.newServer($2);');
  t = t.replace(/WiFiClient\s+\w+\s*;/g, '');                                  // TCP pipe stub
  t = t.replace(/PubSubClient\s+(\w+)\s*\(\s*\w*\s*\)\s*;/g, 'var $1 = __h.newMQTT();');
  t = t.replace(/\b([A-Za-z_]\w*)\s*\[\s*\]\s*=\s*\{([^{}]*)\}/g, '$1 = [$2]');
  t = t.replace(/(?:\b(?:void|unsigned|signed|const|static|volatile|long|short|int|float|double|bool|boolean|byte|char|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t)\b\s*)+/g, 'var ');
  t = t.replace(/\bdelay\s*\(/g, 'await __h.delay(');
  t = t.replace(/sizeof\s*\(\s*([A-Za-z_]\w*)\s*\)/g, '($1).length');
  return t;
}

function pinAliasesPrelude(){
  const lines = [];
  for(let i = 1; i <= 8; i++){
    lines.push('const EXIO'+i+'="DO'+i+'";', 'const CH'+i+'="DO'+i+'";', 'const GPIO'+(i+3)+'="DI'+i+'";');
  }
  lines.push('const GPIO0="BOOT";', 'const GPIO46="BUZZER";', 'const GPIO38="RGB";');
  return lines.join('\n');
}

function buildRuntime(consoleEl){
  let stopped = false;
  const t0 = performance.now();
  let wifiAddr = null;   // null = AP mode IP, set by wifiSTA()
  const HALT = {halt:true};

  let cur = null;
  const newLineNode = () => {
    consoleEl.classList.remove('empty');
    const line = document.createElement('div');
    const ts = ((performance.now() - t0) / 1000).toFixed(2);
    const stamp = document.createElement('span');
    stamp.className = 'tstamp';
    stamp.textContent = '[' + ts + 's]';
    const span = document.createElement('span');
    line.appendChild(stamp);
    line.appendChild(span);
    consoleEl.appendChild(line);
    while(consoleEl.childNodes.length > 250) consoleEl.removeChild(consoleEl.firstChild);
    consoleEl.scrollTop = consoleEl.scrollHeight;
    return span;
  };
  /* Serial.print() adds to the current line; println() ends it — like real hardware */
  const printMid   = txt => { if(cur === null) cur = newLineNode(); cur.textContent += txt == null ? '' : String(txt); };
  const printLine  = txt => { if(cur === null) cur = newLineNode(); cur.textContent += txt == null ? '' : String(txt); cur = null; };

  const rt = {
    millis:() => performance.now() - t0,
    async delay(ms){
      ms = Math.min(Math.max(ms|0, 0), 5000);
      let waited = 0;
      while(waited < ms){
        if(stopped) throw HALT;
        const step = Math.min(100, ms - waited);
        await new Promise(r => setTimeout(r, step));
        waited += step;
      }
    },
    print(txt){ printMid(txt); },
    println(txt){ printLine(txt == null ? '' : String(txt)); },
    printf(fmt, args){
      let i = 0;
      const out = String(fmt).replace(/%[difsu]/g, () => String(args[i++] ?? ''));
      printLine(out);
    },
    read(p){
      const k = pinKey(p);
      if(k.startsWith('DI'))   return state.di[Number(k.slice(2)) - 1] ? 0 : 1;
      if(k === 'BOOT')         return state.boot ? 0 : 1;
      if(k === 'RGB')          return 0;
      printLine('(pin ' + k + ' exists on the board but is not simulated — returning 0)');
      return 0;
    },
    write(p, v){
      const k = pinKey(p);
      const on = !!v;
      if(k.startsWith('DO')){ setDO(Number(k.slice(2)) - 1, on); return; }
      if(k === 'BUZZER'){ setBuzzer(on, 350); return; }
      if(k === 'RGB'){ return; }
      printLine('(pin ' + k + ' is defined on the board but writes are not simulated)');
    },
    toggle(p){
      const k = pinKey(p);
      if(k.startsWith('DO')) toggleDO(Number(k.slice(2)) - 1);
      else if(k === 'BUZZER') toggleBuzzer();
    },
    beep(ms){ beep(ms); },
    wifiAP(){
      flashLED('rxd', 400);
      printLine('Wi-Fi AP up — SSID "ESP32-S3-POE-ETH-8DI-8DO", password "waveshare"');
    },
    wifiSTA(ssid){
      wifiAddr = '192.168.1.42';
      flashLED('rxd', 400);
      printLine('[Wi-Fi STA] connecting to "' + ssid + '" ... connected, DHCP lease = ' + wifiAddr);
    },
    wifiIP(){ return wifiAddr || '192.168.4.1'; },
    newMQTT(){
      printLine('[MQTT] PubSubClient wrapping the WiFiClient pipe');
      let serverLogged = false;
      const c = {
        _conn:false, _lastE:null, _lastS:null, _lastFake:0, _sub:null,
        connected(){ return c._conn; },
        setServer(host, port){
          if(serverLogged) return;
          serverLogged = true;
          printLine('[MQTT] broker = ' + host + ':' + (port || 1883));
        },
        connect(id, willTopic, willQos, willRetain, willMsg){
          printLine('[MQTT] connect "' + (id || 'gateway') + '" ... CONNACK ok');
          if(willTopic)
            printLine('[MQTT] last-will armed → if this gateway dies, ' + willTopic + ' = "' + willMsg + '"');
          c._conn = true;
          return true;
        },
        subscribe(t){
          c._sub = t;
          printLine('[MQTT] subscribed to ' + t + ' — dashboard clicks will arrive');
        },
        publish(topic, msg, retain){
          flashLED('txd', 180);
          const kv = topic + ' = "' + msg + '"' + (retain ? ' (retained)' : '');
          if(topic.indexOf('estop') >= 0){
            if(c._lastE === msg) return;          // only shout on change
            c._lastE = msg;
            printLine('TX ' + kv);
            if(msg === '1'){
              setDO(0, false);
              setRGB('#e0445a');
              printLine('dashboard: ⚠ e-stop latched — beacon red, LED forced out');
            } else {
              setRGB('#22d97a');
              printLine('dashboard: e-stop released — beacon green');
            }
          } else if(topic.indexOf('status') >= 0){
            if(c._lastS !== msg){ c._lastS = msg; printLine('TX ' + kv); }
          } else {
            printLine('TX ' + kv);
          }
        },
        loop(){
          // a "clicky operator" plays with the dashboard LED, PLC-operator style
          if(!c._conn || !c._sub || c._sub.indexOf('led') < 0) return;
          if(rt.millis() - c._lastFake < 7000) return;
          c._lastFake = rt.millis();
          const r = Math.random();
          const cmd = r < 0.55 ? 'toggle' : (r < 0.8 ? 'on' : 'off');
          flashLED('rxd', 220);
          if(state.di[0]){
            printLine('RX ' + c._sub + ' = "' + cmd + '" → gateway: IGNORED, e-stop is latched');
            return;
          }
          printLine('RX ' + c._sub + ' = "' + cmd + '" → gateway applies it to DO1');
          if(cmd === 'on') setDO(0, true);
          else if(cmd === 'off') setDO(0, false);
          else toggleDO(0);
        },
      };
      return c;
    },
    newSerial(){
      printLine('[RS485 port ready @ 9600 baud — A+/B− pair]');
      return {
        begin(){},
        write(bytes, len){
          const hex = Array.from(bytes).map(b => ('0'+(b & 0xFF).toString(16).toUpperCase()).slice(-2)).join(' ');
          flashLED('txd', 220);
          if(bytes[0] === 0x06 && bytes[1] === 0x05 && bytes[3] >= 0x01 && bytes[3] <= 0x08){
            const ch = bytes[3];
            printLine('TX: ' + hex + '   → remote device toggles CH' + ch);
            toggleDO(ch - 1);
            flashLED('rxd', 200);
            printLine('RX: ack — CH' + ch + ' is now ' + (state.do[ch-1] ? 'ON' : 'OFF'));
          } else {
            printLine('TX: ' + hex);
            printLine('RX: (neighbour did not recognise this frame)');
          }
        }
      };
    },
    newStrip(leds, pin, mode){
      printLine('[WS2812] ' + leds + ' pixel on GPIO' + pin + ' ready (' + mode + ')');
      return {
        Color(r, g, b){ return 'rgb(' + r + ',' + g + ',' + b + ')'; },
        setPixelColor(i, c){ this._next = c; },
        show(){ if(this._next) setRGB(this._next); }
      };
    },
    newServer(port){
      let lastClient = -1e9;
      return {
        begin(){ printLine('(web server listening on port ' + (port || 80) + ' — fake browsers incoming)'); },
        handleClient(){
          if(rt.millis() - lastClient < 1200) return;
          lastClient = rt.millis();
          const f = FAKE_HTTP[Math.floor(Math.random() * FAKE_HTTP.length)];
          printLine(f.msg);
          if(f.act && f.act.type === 'toggle') toggleDO(f.act.ch);
        }
      };
    },
  };
  rt.__stop = () => { stopped = true; };
  rt.HALT = HALT;
  return rt;
}

async function runSketch(src, consoleEl){
  const tok = ++state.runToken;
  const btnRun = consoleEl._btnRun;
  const btnStop = consoleEl._btnStop;
  if(state.activeRt && state.activeRt.__stop) state.activeRt.__stop();

  const rt = buildRuntime(consoleEl);
  state.activeRt = rt;
  btnRun.disabled = true; btnRun.style.display = 'none';
  btnStop.style.display = '';
  consoleEl.closest('.console').querySelector('.console-dot').classList.add('live');
  consoleEl.closest('.console').querySelector('.console-status').textContent = 'Running';

  rt.println('ESP32-S3 boot ... Waveshare 8DI/8DO (simulated)');
  rt.println('');

  let prog = null;
  try{
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction('__h', buildSketchBody(src));
    prog = await fn(rt);
  }catch(e){
    rt.println('');
    rt.println('⚠ compile error: ' + (e.message || e));
    endRun();
    return;
  }

  try{
    if(prog.setup) await prog.setup(rt);
  }catch(e){
    if(e !== rt.HALT) rt.println('⚠ setup error: ' + (e.message || e));
    endRun();
    return;
  }

  while(!rt.stopped && prog.loop && state.runToken === tok){
    try{
      await prog.loop(rt);
    }catch(e){
      if(e !== rt.HALT) rt.println('⚠ runtime error: ' + (e.message || e));
      break;
    }
  }
  endRun();

  function endRun(){
    if(state.runToken !== tok) return; /* superseded by a newer run */
    btnRun.disabled = false; btnRun.style.display = '';
    btnStop.style.display = 'none';
    consoleEl.closest('.console').querySelector('.console-dot').classList.remove('live');
    consoleEl.closest('.console').querySelector('.console-status').textContent = 'Stopped';
  }
}

function stopSketch(){
  if(state.activeRt) state.activeRt.__stop();
  state.runToken++;
}

/* ================= content panel views ================= */
function showView(name){ renderInto($('#content-panel'), name); }

function renderInto(panel, name){
  state.view = name;
  state.lastView = name;
  $$('.nav-btn').forEach(b => b.classList.toggle('is-active', b.dataset.nav === name));
  if(name === 'home')       panel.innerHTML = homeHTML();
  if(name === 'lessons')    panel.innerHTML = state.currentLesson ? lessonDetailHTML(state.currentLesson) : lessonsListHTML();
  if(name === 'pinout')     panel.innerHTML = pinoutHTML();
  if(name === 'simulator')  panel.innerHTML = simulatorHTML();

  if(name === 'home'){
    $$('.fcard', panel).forEach((c, i) => {
      c.onclick = () => {
        const to = ['lessons', 'simulator', 'pinout', 'lessons'][i];
        if(to === 'lessons') state.currentLesson = null;
        showView(to);
      };
    });
  }
  if(name === 'lessons'){
    if(state.currentLesson){
      bindLessonDetail(panel);
    } else {
      $$('.lesson-item', panel).forEach(item => {
        item.onclick = () => {
          state.currentLesson = LESSONS.find(l => l.id === item.dataset.id);
          showView('lessons');
        };
      });
    }
  }
  if(name === 'simulator'){
    $('#sim-allon').onclick = () => allDO(true);
    $('#sim-alloff').onclick = () => allDO(false);
    $('#sim-chaser').onclick = () => chaserOnce();
    $('#sim-beep').onclick = () => beep(220) || logEvent('buzzer BEEP (220 ms)');
    $('#sim-boot').onclick = () => toggleBoot();
    $('#sim-rgb').onclick = () => cycleRGB();
  }
}

function homeHTML(){
  const cards = [
    ['🧭','Lessons','11 short lessons — from reading one input to a full MQTT e-stop gateway.'],
    ['🎛','I/O bench','Flip the input switches and light the output lamps directly under the board.'],
    ['💾','Pinout','Every GPIO on the board: digital I/O, W5500, RS485, CAN, RTC, TF.'],
    ['▶','Runnable sketches','Every lesson has a sketch — run it and watch the simulated hardware react.'],
  ];
  return `
  <div class="view is-active">
    <div class="hero">
      <h2>An interactive desk for the <em>ESP32-S3-POE-ETH-8DI-8DO</em></h2>
      <p class="lead">Industrial 8-channel digital I/O — optocoupled in, Darlington-sunk out, PoE fed,
      RS485/CAN staffed. Learn it the fun way: hover the board to inspect parts, tick a switch and watch
      the lamp respond, and run every lesson sketch against the simulated serial monitor.</p>
    </div>
    <div class="feature-cards">
      ${cards.map(c => `<div class="fcard"><div class="num">${c[0]}</div><h4>${c[1]}</h4><p>${c[2]}</p></div>`).join('')}
    </div>
    <div class="quickstart">
      <h3>Quickstart</h3>
      <ol class="step-list">
        <li><span class="n">1</span><span><b>Meet the box.</b> Hover each block on the board: every part tells you what it does and which GPIO it lives on.</span></li>
        <li><span class="n">2</span><span><b>Lesson 2 — read your first input.</b> Run the sketch in the lesson card; flip SW1 and watch the serial monitor report DI1 going active-LOW.</span></li>
        <li><span class="n">3</span><span><b>Lesson 3 — linkage.</b> DI closed → DO conducts → L1 glows. This is how industrial logic bridges sensors to action.</span></li>
        <li><span class="n">4</span><span><b>Lesson 10 — capstone.</b> Build a tiny QC gate with an e-stop, buzzer and status beacon, entirely in one sketch.</span></li>
      </ol>
    </div>
    <div class="footer-note">
      Builds on the official Waveshare documentation. GPIO mapping, bus speeds and demo behaviours follow
      <a href="https://docs.waveshare.com/ESP32-S3-POE-ETH-8DI-8DO" target="_blank" rel="noopener">docs.waveshare.com</a>.
      This is an independent, unofficial learning aid (original design, no official assets).
    </div>
  </div>`;
}

function lessonsListHTML(){
  return `
  <div class="view is-active">
    <div class="panel-head" style="padding:0 0 4px"><h2 style="font-size:1.15rem">Lessons</h2>
      <span class="hint">${state.done.size}/${LESSONS.length} completed</span></div>
    <div class="lesson-list">
      ${LESSONS.map(l => `
        <div class="lesson-item ${state.done.has(l.id) ? 'done' : ''}" data-id="${l.id}">
          <div class="lnum">${l.num}</div>
          <div class="lbody"><h4>${esc(l.title)}</h4><p>${esc(l.sub)}</p></div>
          ${state.done.has(l.id) ? '<span class="done-mark">✔</span>' : ''}
        </div>`).join('')}
    </div>
    <div class="footer-note">Run each sketch with the ▶ button inside the lesson. Mark it learned once you played
    with the bench and understand what the pins are doing.</div>
  </div>`;
}

function lessonDetailHTML(l){
  return `
  <div class="view is-active lesson-detail">
    <button class="backlink" data-act="back">← all lessons</button>
    <h2>${l.num}. ${esc(l.title)}</h2>
    <div class="sub">${esc(l.sub)}</div>
    ${l.goal ? `<div class="goal">${esc(l.goal)}</div>` : ''}
    <article>${l.body}</article>
    ${l.code ? codeCardHTML(l) : ''}
    <div class="lesson-actions">
      <button class="btn-ghost ${state.done.has(l.id) ? 'btn-success' : ''}" data-act="done">
        ${state.done.has(l.id) ? '✔ learned' : '✔ mark as learned'}
      </button>
      <button class="btn-ghost" data-act="next">next lesson →</button>
    </div>
  </div>`;
}

function codeCardHTML(l){
  return `
  <div class="code-card">
    <div class="code-head">
      <span>sketch.ino · ${esc(l.title.toLowerCase())}</span>
      <span class="grow"></span>
      <button class="btn-run" data-act="run">▶ Run</button>
      <button class="btn-stop" data-act="stop" style="display:none">■ Stop</button>
    </div>
    <pre><code>${highlight(l.code)}</code></pre>
    <div class="console">
      <div class="console-head">
        <span class="console-dot"></span>
        <span class="console-title">Serial monitor</span>
        <span class="console-status">Stopped</span>
        <button class="console-close" data-act="stop" title="stop">✕</button>
      </div>
      <div class="console-lines empty"></div>
    </div>
  </div>`;
}

function bindLessonDetail(panel){
  const l = state.currentLesson;
  $('[data-act="back"]', panel).onclick = () => { state.currentLesson = null; showView('lessons'); };
  $('[data-act="done"]', panel).onclick = () => {
    if(state.done.has(l.id)) state.done.delete(l.id); else state.done.add(l.id);
    localStorage.setItem('iodesk.done', JSON.stringify([...state.done]));
    renderProgress();
    showView('lessons');
  };
  const next = $('[data-act="next"]', panel);
  if(next){
    if(l.num >= LESSONS.length) next.remove();
    else next.onclick = () => {
      state.currentLesson = LESSONS.find(x => x.num === l.num + 1);
      showView('lessons');
    };
  }
  if(l.code){
    const card = $('.code-card', panel);
    const lines = $('.console-lines', card);
    const btnRun = $('[data-act="run"]', card);
    const btnStop = $('[data-act="stop"]', card);
    lines._btnRun = btnRun; lines._btnStop = btnStop;
    btnRun.onclick = () => runSketch(l.code, lines);
    btnStop.onclick = stopSketch;
    $('.console-close', card).onclick = stopSketch;
  }
}

function pinoutHTML(){
  return `
  <div class="view is-active">
    <div class="panel-head" style="padding:0 0 4px"><h2 style="font-size:1.15rem">Pinout reference</h2>
      <span class="hint">following the official Waveshare docs</span></div>
    ${PIN_GROUPS.map(grp => `
      <div class="pin-group">
        <h3>${grp.title}</h3>
        <table class="pin-table">
          <thead><tr><th style="width:34%">pin / signal</th><th style="width:26%">function</th><th>notes</th></tr></thead>
          <tbody>
            ${grp.rows.map(r => `<tr><td><code>${esc(r.pin)}</code></td><td>${esc(r.what)}</td><td>${esc(r.note || '')}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('')}
  </div>`;
}

function simulatorHTML(){
  return `
  <div class="view is-active">
    <div class="panel-head" style="padding:0 0 4px"><h2 style="font-size:1.15rem">Control deck</h2>
      <span class="hint">drive the simulated I/O by hand</span></div>
    <p style="color:var(--muted);font-size:.86rem;line-height:1.6">
      Everything here manipulates the same I/O state the lesson sketches see. Click SW buttons to close input
      wires (active-low), lamps to toggle output channels, or drive them in bulk below. Press <b>BOOT</b> like a
      person: pressed = GPIO0 low. The buzzer and the RGB pixel on the board follow instantly.</p>
    <div class="sim-controls">
      <button class="sim-btn" id="sim-allon">⚡ all ON</button>
      <button class="sim-btn" id="sim-alloff">⏻ all OFF</button>
      <button class="sim-btn" id="sim-chaser">✨ chaser ×1</button>
      <button class="sim-btn" id="sim-beep">🔔 beep</button>
      <button class="sim-btn" id="sim-rgb">🎨 cycle RGB</button>
      <button class="sim-btn" id="sim-boot">🖐 BOOT press</button>
    </div>
    <div class="sim-log">
      <div id="sim-log-lines">
        ${simEvents.map(l => '<div>' + esc(l) + '</div>').join('') || '<div>— no events yet, click something —</div>'}
      </div>
    </div>
    <div class="footer-note">The same virtual hardware powers the lesson sketches — run lesson 4 (pattern chaser)
    then switch to this deck and watch the lamps keep burning along.</div>
  </div>`;
}

/* ================= popover ================= */
let popEl = null;
function initPopover(){
  popEl = document.createElement('div');
  popEl.className = 'popover';
  document.body.appendChild(popEl);
}
function popoverShow(infoId, cx, cy){
  const info = PARTS.find(p => p.id === infoId);
  if(!info || popEl === null){ popEl.classList.remove('show'); return; }
  popEl.innerHTML = '<h4>' + esc(info.name) + '</h4><div class="p-kw">' + esc(info.kw) +
                    '</div><p>' + esc(info.short) + '</p>';
  popEl.style.left = Math.max(8, Math.min(window.innerWidth - 348, cx - 160)) + 'px';
  popEl.style.top  = (cy - 10) + 'px';
  popEl.classList.add('show');
}
function popoverHide(){ if(popEl) popEl.classList.remove('show'); }

/* ================= progress / clock / nav ================= */
function renderProgress(){
  $('#progress-fill').style.width = (state.done.size / LESSONS.length * 100) + '%';
  $('#progress-count').textContent = state.done.size + '/' + LESSONS.length;
}

function tickClock(){
  const now = new Date();
  $('#clock-date').textContent = now.toLocaleDateString(undefined, {day:'2-digit', month:'short', year:'numeric'});
  $('#clock-time').textContent = now.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit', second:'2-digit'});
}

function attachNav(){
  $$('.nav-btn').forEach(b => {
    b.onclick = () => {
      if(b.dataset.nav === 'lessons' && state.lastView !== 'lessons') state.currentLesson = null;
      showView(b.dataset.nav);
    };
  });
}
/* ================= theme ================= */
const THEME_KEY = 'esp32s3.theme';

function applyTheme(mode){
  document.documentElement.dataset.theme = mode;
  const btn = $('#theme-btn');
  if(btn){                                   // icon shows the theme you'd switch TO
    btn.textContent = mode === 'light' ? '🌙' : '☀️';
    btn.title = mode === 'light' ? 'Switch to dark theme' : 'Switch to light theme';
  }
  try{ localStorage.setItem(THEME_KEY, mode); }catch(e){ /* private mode — theme just won't persist */ }
  if(board3d && board3d.setTheme) board3d.setTheme(mode);
}

function initTheme(){
  let saved = null;
  try{ saved = localStorage.getItem(THEME_KEY); }catch(e){}
  applyTheme(saved === 'light' ? 'light' : 'dark');   // dark is the factory default
  const btn = $('#theme-btn');
  if(btn) btn.onclick = () =>
    applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
}

/* ================= init ================= */
function init(){
  initTheme();
  initPopover();
  try{
    board3d = createBoard3D($('#frame-container'), {
      readState: () => state,
      onHover: (infoId, cx, cy) => {
        if(infoId) popoverShow(infoId, cx, cy); else popoverHide();
      },
      onPick: id => {
        if(id === 'boot'){ toggleBoot(); return; }
        if(id === 'buzzer'){ beep(150); logEvent('buzzer BEEP'); return; }
        if(id === 'rgb'){ cycleRGB(); return; }
        if(id && id.startsWith('DI')) toggleDI(Number(id.slice(2)) - 1);
        else if(id && id.startsWith('DO')) toggleDO(Number(id.slice(2)) - 1);
      },
    });
  }catch(e){
    board3d = null;   // no WebGL — fall back to the 2D SVG board
  }
  if(!board3d) boardSVG = drawBoard($('#frame-container'));
  buildBench();
  attachNav();
  showView('home');
  renderProgress();
  syncAll();
  tickClock();
  setInterval(tickClock, 1000);
}

document.addEventListener('DOMContentLoaded', init);
