import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════
   מתמטיקה בלייז — MATH BLITZ v2
   Cyberpunk Math Game for Israeli 6th Graders
   Lives System + Multiple Topics + Geometry
   ═══════════════════════════════════════════════════ */

// ── Constants ────────────────────────────────
const MAX_LIVES = 5;
const START_LIVES = 3;
const REVIVE_COST = 3000;
const REVIVE_INVITE_LIMIT = 2;
const ROUND_SIZE = 10;
const DEFAULT_NAME = 'שחקן';
const LIFE_EARN_STREAK = 7;
const AD_WATCH_SECONDS = 5; // simulated ad duration until real ads connected
const REVIVE_AD_LIMIT = 1;  // max free revives via ad per game
const REVIVE_WAIT_SECONDS = 60; // wait 60s for 1 free life
const REVIVE_POINTS_LIVES = 3;  // buying with points gives 3 lives

// ── Power-Up Constants ──────────────────────
const BOOST_STREAK = 5;     // every 5 correct in a row → boost
const FREEZE_STREAK = 10;   // every 10 correct in a row → freeze
const BOOST_SECONDS = 5;    // boost adds 5 seconds
const FRIEND_SECONDS = 10;  // friend invite adds 10 seconds
const BOOST_MAX = 3;        // max boosts you can hold
const FREEZE_MAX = 2;       // max freezes you can hold
const POWERUP_SCORE_MULT = 0.5; // score multiplier when power-up used

// ── Leaderboard Bot System ───────────────────
const LB_BOT_NAMES = ['דניאל','נועה','עידן','מאיה','אלון','שי','רוני','טל','אור','יעל','עמית','גיל','ליאם','שרה','מיכאל','תמר','איתי','הילה','עומר','ליה'];
const LB_LAUNCH_DATE = '2025-06-01';
const LB_BASE_PLAYERS = 184;
const LB_GROWTH_RATE = 4.3;
const LB_GROWTH_ACCEL = 0.6;

const generateBotScores = (stageIdx, playerScore) => {
  // Deterministic bots — same stage always produces same scores
  return LB_BOT_NAMES.map((name, i) => {
    const seed = (stageIdx + 1) * 137 + (i + 1) * 53;
    const base = (stageIdx + 1) * 120;
    const s = base + ((seed * 31 + 17) % (base + 300));
    // Scale some bots near player score for competitiveness
    const scaled = i < 5 ? Math.round(s * 0.8 + playerScore * 0.4) : s;
    return { name, score: Math.max(scaled, 10), isBot: true };
  }).sort((a, b) => b.score - a.score);
};

const getLBPlayerCount = () => {
  const launch = new Date(LB_LAUNCH_DATE).getTime();
  const days = Math.max(0, (Date.now() - launch) / 864e5);
  let base = LB_BASE_PLAYERS + Math.floor(days * LB_GROWTH_RATE + Math.pow(days, 1.15) * LB_GROWTH_ACCEL + Math.sin(days * 0.7) * 7);
  try { base += parseInt(localStorage.getItem('math-blitz-lbCount') || '0'); } catch(e) {}
  return base;
};

const addLBPlayer = (name) => {
  if (!name || name === DEFAULT_NAME) return;
  try {
    const names = JSON.parse(localStorage.getItem('math-blitz-lbNames') || '[]');
    if (names.indexOf(name) === -1) {
      names.push(name);
      localStorage.setItem('math-blitz-lbNames', JSON.stringify(names));
      localStorage.setItem('math-blitz-lbCount', String(names.length));
    }
  } catch(e) {}
};

// ── Sound Engine (Web Audio API) ─────────────
let _actx = null;
const actx = () => { if(!_actx) _actx = new (window.AudioContext||window.webkitAudioContext)(); return _actx; };

const playCorrect = () => {
  try {
    const c = actx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type='sine';
    o.frequency.setValueAtTime(523,c.currentTime);
    o.frequency.setValueAtTime(659,c.currentTime+0.07);
    o.frequency.setValueAtTime(784,c.currentTime+0.14);
    g.gain.setValueAtTime(0.22,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.35);
    o.start(c.currentTime); o.stop(c.currentTime+0.35);
  } catch(e){}
};

const playTick = () => {
  try {
    const c = actx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type='sine';
    o.frequency.setValueAtTime(880,c.currentTime);
    g.gain.setValueAtTime(0.08,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.05);
    o.start(c.currentTime); o.stop(c.currentTime+0.06);
  } catch(e){}
};

const playLifeLost = () => {
  try {
    const c = actx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type='square';
    o.frequency.setValueAtTime(330,c.currentTime);
    o.frequency.linearRampToValueAtTime(110,c.currentTime+0.4);
    g.gain.setValueAtTime(0.15,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.5);
    o.start(c.currentTime); o.stop(c.currentTime+0.5);
    if(navigator.vibrate) navigator.vibrate([100,50,200]);
  } catch(e){}
};

const playRevive = () => {
  try {
    const c = actx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type='sine';
    o.frequency.setValueAtTime(440,c.currentTime);
    o.frequency.setValueAtTime(554,c.currentTime+0.1);
    o.frequency.setValueAtTime(659,c.currentTime+0.2);
    o.frequency.setValueAtTime(880,c.currentTime+0.3);
    g.gain.setValueAtTime(0.2,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.5);
    o.start(c.currentTime); o.stop(c.currentTime+0.5);
  } catch(e){}
};

const playLifeGain = () => {
  try {
    const c = actx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type='sine';
    o.frequency.setValueAtTime(523,c.currentTime);
    o.frequency.setValueAtTime(659,c.currentTime+0.08);
    o.frequency.setValueAtTime(784,c.currentTime+0.16);
    o.frequency.setValueAtTime(1047,c.currentTime+0.24);
    g.gain.setValueAtTime(0.25,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.5);
    o.start(c.currentTime); o.stop(c.currentTime+0.5);
    if(navigator.vibrate) navigator.vibrate([50,30,50]);
  } catch(e){}
};

const playRoundComplete = () => {
  try {
    const c = actx();
    [523,659,784,1047].forEach((freq,i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type='sine';
      o.frequency.setValueAtTime(freq,c.currentTime+i*0.12);
      g.gain.setValueAtTime(0.18,c.currentTime+i*0.12);
      g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+i*0.12+0.2);
      o.start(c.currentTime+i*0.12); o.stop(c.currentTime+i*0.12+0.2);
    });
  } catch(e){}
};

const playPowerUpGain = () => {
  try {
    const c = actx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type='sine';
    o.frequency.setValueAtTime(660,c.currentTime);
    o.frequency.setValueAtTime(880,c.currentTime+0.08);
    o.frequency.setValueAtTime(1100,c.currentTime+0.16);
    g.gain.setValueAtTime(0.2,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.35);
    o.start(c.currentTime); o.stop(c.currentTime+0.35);
    if(navigator.vibrate) navigator.vibrate([30,20,30]);
  } catch(e){}
};

const playBoostUse = () => {
  try {
    const c = actx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type='sawtooth';
    o.frequency.setValueAtTime(400,c.currentTime);
    o.frequency.exponentialRampToValueAtTime(1200,c.currentTime+0.2);
    g.gain.setValueAtTime(0.15,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.3);
    o.start(c.currentTime); o.stop(c.currentTime+0.3);
  } catch(e){}
};

const playFreezeUse = () => {
  try {
    const c = actx();
    [1200,1000,800,600].forEach((freq,i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type='sine';
      o.frequency.setValueAtTime(freq,c.currentTime+i*0.06);
      g.gain.setValueAtTime(0.12,c.currentTime+i*0.06);
      g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+i*0.06+0.15);
      o.start(c.currentTime+i*0.06); o.stop(c.currentTime+i*0.06+0.15);
    });
  } catch(e){}
};

// ── Math Utilities ───────────────────────────
const gcd = (a,b) => b===0 ? a : gcd(b, a%b);
const shuffle = (arr) => [...arr].sort(()=>Math.random()-0.5);
const randInt = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];

// ── Shape Drawing (SVG) ─────────────────────
const drawRect = (w,h,label) => {
  const sw=140,sh=90,bx=40,by=10,bw=100,bh=65;
  return `<svg width="${sw}" height="${sh}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${bx}" y="${by}" width="${bw}" height="${bh}" fill="rgba(0,229,255,0.15)" stroke="#00e5ff" stroke-width="2.5" rx="3"/>
    <text x="${bx+bw/2}" y="${by+bh+16}" fill="#99f6e4" font-size="12" text-anchor="middle" font-weight="800">${w}</text>
    <text x="${bx-8}" y="${by+bh/2+4}" fill="#fda4af" font-size="12" text-anchor="end" font-weight="800">${h}</text>
    ${label?`<text x="${bx+bw/2}" y="${by+bh/2+5}" fill="rgba(255,255,255,0.4)" font-size="10" text-anchor="middle">${label}</text>`:''}
  </svg>`;
};
const drawSquare = (s) => {
  const sw=130,sh=100,bx=30,by=10,bs=75;
  return `<svg width="${sw}" height="${sh}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${bx}" y="${by}" width="${bs}" height="${bs}" fill="rgba(0,255,136,0.15)" stroke="#00ff88" stroke-width="2.5" rx="3"/>
    <text x="${bx+bs/2}" y="${by+bs+16}" fill="#99f6e4" font-size="12" text-anchor="middle" font-weight="800">${s}</text>
  </svg>`;
};
const drawTriangle = (base,height) => {
  const sw=180,sh=120,bx=30,by=100,tw=120,th=70;
  return `<svg width="${sw}" height="${sh}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${bx},${by} ${bx+tw},${by} ${bx+tw/2},${by-th}" fill="rgba(0,229,255,0.15)" stroke="#00e5ff" stroke-width="2.5"/>
    <line x1="${bx+tw/2}" y1="${by-th}" x2="${bx+tw/2}" y2="${by}" stroke="#fbbf24" stroke-width="2" stroke-dasharray="5,3"/>
    <text x="${bx+tw/2}" y="${by+16}" fill="#99f6e4" font-size="12" text-anchor="middle" font-weight="800">${base}</text>
    <text x="${bx+tw/2+14}" y="${by-th/2+4}" fill="#fbbf24" font-size="12" font-weight="800">${height}</text>
  </svg>`;
};
const drawParallelogram = (base,height) => {
  const sw=180,sh=100,bx=25,by=10,bw=110,bh=55,sk=25;
  return `<svg width="${sw}" height="${sh}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${bx+sk},${by} ${bx+bw+sk},${by} ${bx+bw},${by+bh} ${bx},${by+bh}" fill="rgba(255,0,128,0.15)" stroke="#ff0080" stroke-width="2.5"/>
    <line x1="${bx+sk}" y1="${by}" x2="${bx+sk}" y2="${by+bh}" stroke="#fbbf24" stroke-width="2" stroke-dasharray="5,3"/>
    <text x="${bx+bw/2}" y="${by+bh+16}" fill="#99f6e4" font-size="12" text-anchor="middle" font-weight="800">${base}</text>
    <text x="${bx+sk+12}" y="${by+bh/2+4}" fill="#fbbf24" font-size="12" font-weight="800">${height}</text>
  </svg>`;
};
const drawTrapezoid = (a,b,h) => {
  const sw=200,sh=110,by=10,bh=65,topW=70,botW=130,cx=100;
  const tx1=cx-topW/2,tx2=cx+topW/2,bx1=cx-botW/2,bx2=cx+botW/2;
  return `<svg width="${sw}" height="${sh}" xmlns="http://www.w3.org/2000/svg">
    <polygon points="${tx1},${by} ${tx2},${by} ${bx2},${by+bh} ${bx1},${by+bh}" fill="rgba(170,136,255,0.15)" stroke="#aa88ff" stroke-width="2.5"/>
    <text x="${cx}" y="${by-4}" fill="#c4b5fd" font-size="11" text-anchor="middle" font-weight="800">${a}</text>
    <text x="${cx}" y="${by+bh+16}" fill="#99f6e4" font-size="11" text-anchor="middle" font-weight="800">${b}</text>
    <text x="${bx2+10}" y="${by+bh/2+4}" fill="#fbbf24" font-size="11" font-weight="800">${h}</text>
  </svg>`;
};

// ═══════════════════════════════════════════════
// ── TOPIC SYSTEM ─────────────────────────────
// ═══════════════════════════════════════════════

// ── Topic 1: Fractions / Decimals / Percents ─
const FRAC_POOLS = {
  easy: [{n:1,d:2},{n:1,d:4},{n:3,d:4},{n:1,d:5},{n:2,d:5},{n:3,d:5},{n:1,d:10},{n:3,d:10},{n:7,d:10},{n:9,d:10}],
  medium: [{n:1,d:3},{n:2,d:3},{n:3,d:8},{n:5,d:8},{n:7,d:8},{n:4,d:5},{n:1,d:8},{n:7,d:20},{n:3,d:20}],
  hard: [{n:5,d:6},{n:7,d:12},{n:11,d:20},{n:3,d:16},{n:7,d:16},{n:5,d:12},{n:9,d:20},{n:11,d:25},{n:13,d:20}],
};
const FORMATS = ['fraction','decimal','percent'];
const FMT_LABEL = { fraction:'שבר', decimal:'עשרוני', percent:'אחוזים' };

const fmtVal = (n,d,f) => {
  if(f==='fraction') return n+'/'+d;
  const v = n/d;
  if(f==='decimal') return (Math.round(v*10000)/10000).toString();
  const p = Math.round(v*10000)/100;
  return p+'%';
};

const genFracDistractors = (correct, format, n, d) => {
  const set = new Set();
  const v = n/d;
  let tries = 0;
  while(set.size < 3 && tries < 80) {
    tries++;
    let w;
    if(format==='decimal') {
      const off = [0.05,0.1,0.15,0.2,0.25,-0.05,-0.1,-0.15,-0.2,-0.25,0.03,-0.03];
      const wv = Math.round((v+pick(off))*10000)/10000;
      if(wv<=0||wv>=1.5) continue;
      w = wv.toString();
    } else if(format==='percent') {
      const off = [5,10,15,20,25,-5,-10,-15,-20,8,-8,12,-12,3,-3];
      let wv = Math.round((v*100+pick(off))*100)/100;
      if(wv<=0||wv>100) continue;
      w = wv+'%';
    } else {
      const vars = [[n+1,d],[n-1,d],[n,d+1],[n,d-1],[n+2,d],[n,d+2],[n*2,d+1],[d-n,d]];
      const [wn,wd] = pick(vars);
      if(wn<=0||wd<=0||wn>=wd*2) continue;
      const g2 = gcd(Math.abs(wn),Math.abs(wd));
      w = (wn/g2)+'/'+(wd/g2);
    }
    if(w && w !== correct) set.add(w);
  }
  while(set.size < 3) {
    if(format==='percent') set.add(randInt(5,95)+'%');
    else if(format==='decimal') set.add((randInt(50,950)/1000).toString());
    else set.add(randInt(1,7)+'/'+randInt(2,9));
  }
  return [...set].slice(0,3);
};

const topicFractions = {
  id: 'fractions', name: 'שברים עשרוניים אחוזים', icon: '🔢', color: '#00e5ff',
  generate(diff) {
    const pool = FRAC_POOLS[diff];
    const fr = pick(pool);
    const qf = pick(FORMATS);
    let af; do { af = pick(FORMATS); } while(af===qf);
    const qText = fmtVal(fr.n,fr.d,qf);
    const correct = fmtVal(fr.n,fr.d,af);
    const distractors = genFracDistractors(correct,af,fr.n,fr.d);
    const opts = shuffle([correct,...distractors]);
    return { question:qText, qLabel:FMT_LABEL[qf], aLabel:'מצא את ה'+FMT_LABEL[af]+' השווה', options:opts, correct, correctIdx:opts.indexOf(correct) };
  }
};

// ── Topic 2: Order of Operations ─────────────
const topicOrderOps = {
  id: 'orderops', name: 'סדר פעולות חשבון', icon: '➕', color: '#ffaa00',
  generate(diff) {
    let expr, answer;
    if(diff === 'easy') {
      const a = randInt(2,10), b = randInt(2,10), c = randInt(1,5);
      if(randInt(0,1)===0) { expr = a+' + '+b+' \u00D7 '+c; answer = a + b*c; }
      else { expr = a+' \u00D7 '+b+' - '+c; answer = a*b - c; }
    } else if(diff === 'medium') {
      const a = randInt(2,8), b = randInt(1,5), c = randInt(2,6), d = randInt(1,4);
      const type = randInt(0,2);
      if(type===0) { expr = '('+a+' + '+b+') \u00D7 '+c; answer = (a+b)*c; }
      else if(type===1) { expr = a+' \u00D7 '+b+' + '+c+' \u00D7 '+d; answer = a*b+c*d; }
      else { expr = (a*c)+' \u00F7 '+c+' + '+b; answer = a+b; }
    } else {
      const a = randInt(2,6), b = randInt(1,4), c = randInt(2,5), d = randInt(1,3);
      const type = randInt(0,2);
      if(type===0) { expr = '('+a+' + '+b+') \u00D7 ('+c+' - '+d+')'; answer = (a+b)*(c-d); }
      else if(type===1) { expr = (a*a)+' \u00F7 '+a+' + '+b+' \u00D7 '+c; answer = a+b*c; }
      else { expr = a+' \u00D7 ('+b+' + '+c+') - '+d; answer = a*(b+c)-d; }
    }
    const wrongs = new Set();
    [answer+randInt(1,5), answer-randInt(1,5), answer+randInt(2,10), Math.abs(answer*2-randInt(1,3))].forEach(w => {
      if(w !== answer && w > 0) wrongs.add(w);
    });
    while(wrongs.size < 3) wrongs.add(Math.abs(answer + randInt(-15,15)) || answer+1);
    const distractors = [...wrongs].filter(w=>w!==answer).slice(0,3);
    const opts = shuffle([answer, ...distractors].map(String));
    const correct = String(answer);
    return { question: expr, qLabel: 'תרגיל', aLabel: 'מה התוצאה?', options: opts, correct, correctIdx: opts.indexOf(correct) };
  }
};

// ── Topic 3: Area & Perimeter ────────────────
const topicAreaPerimeter = {
  id: 'area', name: 'שטח והיקף', icon: '📐', color: '#00ff88',
  generate(diff) {
    let question, answer, label, shape='';
    if(diff === 'easy') {
      const w = randInt(3,12), h = randInt(3,12);
      shape = drawRect(w,h);
      if(randInt(0,1)) {
        question = 'שטח מלבן\n'+w+' \u00D7 '+h; answer = w*h; label = 'מה השטח?';
      } else {
        question = 'היקף מלבן\n'+w+' \u00D7 '+h; answer = 2*(w+h); label = 'מה ההיקף?';
      }
    } else if(diff === 'medium') {
      const type = randInt(0,2);
      if(type===0) {
        const base = randInt(4,14), height = randInt(3,10);
        shape = drawTriangle(base,height);
        question = 'שטח משולש\nבסיס='+base+' גובה='+height; answer = (base*height)/2; label = 'מה השטח?';
      } else if(type===1) {
        const side = randInt(3,15);
        shape = drawSquare(side);
        if(randInt(0,1)) { question = 'שטח ריבוע\nצלע='+side; answer = side*side; label = 'מה השטח?'; }
        else { question = 'היקף ריבוע\nצלע='+side; answer = side*4; label = 'מה ההיקף?'; }
      } else {
        const base = randInt(4,12), height = randInt(3,8);
        shape = drawParallelogram(base,height);
        question = 'שטח מקבילית\nבסיס='+base+' גובה='+height; answer = base*height; label = 'מה השטח?';
      }
    } else {
      if(randInt(0,1)) {
        const a = randInt(4,10), b = randInt(6,14), h = randInt(3,8);
        shape = drawTrapezoid(a,b,h);
        question = 'שטח טרפז\nבסיסים='+a+','+b+' גובה='+h; answer = (a+b)*h/2; label = 'מה השטח?';
      } else {
        const w1 = randInt(3,6), h1 = randInt(5,10), w2 = randInt(3,6), h2 = randInt(2,4);
        shape = drawRect(w1,h1,'מלבן 1') + drawRect(w2,h2,'מלבן 2');
        question = 'שטח צורה מורכבת\n'+w1+'\u00D7'+h1+' + '+w2+'\u00D7'+h2; answer = w1*h1+w2*h2; label = 'מה השטח הכולל?';
      }
    }
    const ansStr = Number.isInteger(answer) ? String(answer) : String(Math.round(answer*10)/10);
    const wrongs = new Set();
    [answer+randInt(1,8), answer-randInt(1,5), answer*2, Math.floor(answer/2)+1, answer+randInt(3,12)].forEach(w => {
      if(w !== answer && w > 0) wrongs.add(Number.isInteger(w)?String(w):String(Math.round(w*10)/10));
    });
    while(wrongs.size < 3) wrongs.add(String(answer + randInt(2,20)));
    const distractors = [...wrongs].filter(w=>w!==ansStr).slice(0,3);
    const opts = shuffle([ansStr, ...distractors]);
    return { question, qLabel: '📐 הנדסה', aLabel: label, options: opts, correct: ansStr, correctIdx: opts.indexOf(ansStr), shape };
  }
};

// ── Topic 5: Powers ──────────────────────────
const topicPowers = {
  id: 'powers', name: 'חזקות', icon: '⚡', color: '#ff4444',
  generate(diff) {
    let question, answer, label='מה התוצאה?';
    if(diff === 'easy') {
      const base = randInt(2,10);
      question = base+'\u00B2'; answer = base*base;
    } else if(diff === 'medium') {
      if(randInt(0,1)) {
        const base = randInt(2,5);
        question = base+'\u00B3'; answer = base*base*base;
      } else {
        const base = randInt(2,10), add = randInt(1,10);
        question = base+'\u00B2 + '+add; answer = base*base + add;
      }
    } else {
      const type = randInt(0,2);
      if(type===0) {
        const a = randInt(2,5), b = randInt(2,4);
        question = a+'\u00B2 \u00D7 '+b+'\u00B2'; answer = (a*a)*(b*b);
      } else if(type===1) {
        const a = randInt(2,6), sub = randInt(1, a*a-1);
        question = a+'\u00B2 \u2212 '+sub; answer = a*a - sub;
      } else {
        const a = randInt(2,4);
        question = '('+a+'\u00B2)\u00B2'; answer = Math.pow(a,4);
      }
    }
    const ansStr = String(answer);
    const wrongs = new Set();
    [answer+randInt(1,10), answer-randInt(1,8), answer*2, Math.floor(answer/2), answer+randInt(5,20)].forEach(w => {
      if(w !== answer && w > 0) wrongs.add(String(w));
    });
    while(wrongs.size < 3) wrongs.add(String(answer + randInt(1,30)));
    const distractors = [...wrongs].filter(w=>w!==ansStr).slice(0,3);
    const opts = shuffle([ansStr, ...distractors]);
    return { question, qLabel: '⚡ חזקות', aLabel: label, options: opts, correct: ansStr, correctIdx: opts.indexOf(ansStr) };
  }
};

// ── Topic 6: Ratio & Proportion ──────────────
const topicRatio = {
  id: 'ratio', name: 'יחס ופרופורציה', icon: '⚖️', color: '#aa88ff',
  generate(diff) {
    let question, answer, label='מה המספר החסר?';
    if(diff === 'easy') {
      const a = randInt(1,6), b = randInt(1,6), mult = randInt(2,5);
      question = a+':'+b+' = '+(a*mult)+':?'; answer = b*mult;
    } else if(diff === 'medium') {
      if(randInt(0,1)) {
        const a = randInt(2,8), b = randInt(2,8), mult = randInt(2,6);
        question = a+':'+b+' = ?:'+(b*mult); answer = a*mult;
      } else {
        const r1 = randInt(2,5), r2 = randInt(2,5);
        const mult = randInt(2,6);
        const total = (r1+r2)*mult;
        question = 'יחס '+r1+':'+r2+'\nסה"כ '+total+'\nכמה בחלק הראשון?';
        answer = r1*mult;
      }
    } else {
      const a = randInt(2,6), b = randInt(2,6), c = randInt(2,6);
      const mult = randInt(2,4);
      const total = (a+b+c)*mult;
      if(randInt(0,1)) {
        question = 'יחס '+a+':'+b+':'+c+'\nסה"כ '+total+'\nכמה בחלק השני?'; answer = b*mult;
      } else {
        question = 'יחס '+a+':'+b+':'+c+'\nסה"כ '+total+'\nכמה בחלק השלישי?'; answer = c*mult;
      }
    }
    const ansStr = String(answer);
    const wrongs = new Set();
    [answer+randInt(1,5), answer-randInt(1,4), answer*2, answer+randInt(2,8), Math.abs(answer-randInt(3,7))].forEach(w => {
      if(String(w) !== ansStr && w > 0) wrongs.add(String(w));
    });
    while(wrongs.size < 3) wrongs.add(String(answer + randInt(1,10)));
    const distractors = [...wrongs].filter(w=>w!==ansStr).slice(0,3);
    const opts = shuffle([ansStr, ...distractors]);
    return { question, qLabel: '⚖️ יחס', aLabel: label, options: opts, correct: ansStr, correctIdx: opts.indexOf(ansStr) };
  }
};

// ── Topic 7: Multiplication & Division (Grade 4) ─
const topicMultDiv = {
  id: 'multdiv', name: 'כפל וחילוק', icon: '✖️', color: '#00ccff',
  generate(diff) {
    let question, answer, label='מה התוצאה?';
    if(diff==='easy') {
      const a=randInt(2,9), b=randInt(2,9);
      question=a+' \u00D7 '+b; answer=a*b;
    } else if(diff==='medium') {
      if(randInt(0,1)) { const a=randInt(2,9),b=randInt(2,9); question=(a*b)+' \u00F7 '+a; answer=b; }
      else { const a=randInt(11,19),b=randInt(2,5); question=a+' \u00D7 '+b; answer=a*b; }
    } else {
      const a=randInt(12,25),b=randInt(3,9);
      if(randInt(0,1)) { question=a+' \u00D7 '+b; answer=a*b; }
      else { question=(a*b)+' \u00F7 '+b; answer=a; }
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+randInt(1,5),answer-randInt(1,5),answer+randInt(2,10),answer*2].forEach(w=>{if(w!==answer&&w>0)wrongs.add(String(w));});
    while(wrongs.size<3) wrongs.add(String(answer+randInt(1,15)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'✖️ כפל וחילוק',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 8: Simple Fractions (Grade 4) ──────
const topicSimpleFrac = {
  id: 'simplefrac', name: 'שברים פשוטים', icon: '🍕', color: '#ff8844',
  generate(diff) {
    let question, answer, label='מה התשובה?';
    if(diff==='easy') {
      const d=pick([2,3,4,5]),n=randInt(1,d-1),whole=d*randInt(2,6);
      question=n+'/'+d+' מתוך '+whole; answer=(whole/d)*n; label='כמה זה?';
    } else if(diff==='medium') {
      const fracs=[[1,2],[1,3],[2,3],[1,4],[3,4],[1,5],[2,5]];
      const [n1,d1]=pick(fracs),[n2,d2]=pick(fracs);
      const v1=n1/d1,v2=n2/d2;
      question=n1+'/'+d1+' ⬜ '+n2+'/'+d2+'\nמה הסימן?';
      const ansStr=v1>v2?'>':v1<v2?'<':'=';
      const opts=shuffle(['>','<','=','≠']);
      return{question,qLabel:'🍕 השוואת שברים',aLabel:'בחר סימן',options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
    } else {
      const d=pick([4,5,6,8,10]),n=randInt(1,d-1);
      const g2=gcd(n,d);
      const ansStr=(n/g2)+'/'+(d/g2);
      question='צמצם: '+n+'/'+d; label='מה השבר המצומצם?';
      const wrongs=new Set();
      [[n+1,d],[n,d-1],[n-1,d],[n,d+1]].forEach(([wn,wd])=>{
        if(wn>0&&wd>0&&wn<wd) wrongs.add(wn+'/'+wd);
      });
      while(wrongs.size<3) wrongs.add(randInt(1,5)+'/'+randInt(2,8));
      const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
      return{question,qLabel:'🍕 שברים',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+randInt(1,5),answer-randInt(1,3),answer*2,Math.floor(answer/2)].forEach(w=>{if(w!==answer&&w>0)wrongs.add(String(w));});
    while(wrongs.size<3) wrongs.add(String(answer+randInt(1,10)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'🍕 שברים',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 9: Signed Numbers (Grade 7) ────────
const topicSigned = {
  id: 'signed', name: 'מספרים מכוונים', icon: '🔄', color: '#ff6644',
  generate(diff) {
    let question, answer;
    if(diff==='easy') {
      const a=randInt(-10,10),b=randInt(-10,10);
      question='('+a+') + ('+b+')'; answer=a+b;
    } else if(diff==='medium') {
      const type=randInt(0,2);
      if(type===0){const a=randInt(-15,15),b=randInt(-15,15);question='('+a+') \u2212 ('+b+')';answer=a-b;}
      else if(type===1){const a=randInt(-8,8),b=randInt(-8,8);question='('+a+') \u00D7 ('+b+')';answer=a*b;}
      else{const a=randInt(2,9),b=pick([-1,1])*randInt(2,9);question='('+a*b+') \u00F7 ('+b+')';answer=a;}
    } else {
      const a=randInt(-10,10),b=randInt(-10,10),c=randInt(-10,10);
      question='('+a+') + ('+b+') \u2212 ('+c+')'; answer=a+b-c;
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+randInt(1,5),answer-randInt(1,5),-answer,answer+randInt(2,8)].forEach(w=>{if(String(w)!==ansStr)wrongs.add(String(w));});
    while(wrongs.size<3) wrongs.add(String(answer+randInt(-10,10)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'🔄 מכוונים',aLabel:'מה התוצאה?',options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 10: Equations (Grade 7-8) ──────────
const topicEquations = {
  id: 'equations', name: 'משוואות', icon: '🔍', color: '#44aaff',
  generate(diff) {
    let question, answer;
    if(diff==='easy') {
      const x=randInt(1,10),a=randInt(2,5),b=randInt(1,15);
      question=a+'x + '+b+' = '+(a*x+b); answer=x;
    } else if(diff==='medium') {
      const x=randInt(1,8),a=randInt(2,6),b=randInt(1,10),c=randInt(1,20);
      const right=a*x-b;
      if(right>0){question=a+'x \u2212 '+b+' = '+right; answer=x;}
      else{question=a+'x + '+b+' = '+(a*x+b); answer=x;}
    } else {
      const x=randInt(1,6),a=randInt(2,5),b=randInt(1,8),c=randInt(1,4),d=randInt(1,10);
      const right=a*x+b-c*x;
      question=a+'x + '+b+' = '+c+'x + '+(right+d*0); 
      // Simpler: ax + b = c => x = (c-b)/a
      const x2=randInt(2,8),a2=randInt(2,5),b2=randInt(1,10);
      question=a2+'x + '+b2+' = '+(a2*x2+b2); answer=x2;
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+1,answer-1,answer+2,answer*2,answer+3].forEach(w=>{if(w!==answer&&w>0)wrongs.add(String(w));});
    while(wrongs.size<3) wrongs.add(String(randInt(1,15)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'🔍 משוואות',aLabel:'x = ?',options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 11: Percentages (Grade 7) ──────────
const topicPercent = {
  id: 'percent', name: 'אחוזים', icon: '💹', color: '#22cc88',
  generate(diff) {
    let question, answer, label='מה התשובה?';
    if(diff==='easy') {
      const p=pick([10,20,25,50]),n=pick([40,60,80,100,120,200]);
      question=p+'% מתוך '+n; answer=n*p/100;
    } else if(diff==='medium') {
      if(randInt(0,1)){
        const p=pick([15,30,35,40,60,75]),n=pick([100,200,300,400,500]);
        question=p+'% מתוך '+n; answer=n*p/100;
      } else {
        const orig=pick([100,150,200,250,300]),disc=pick([10,20,25,30]);
        question='מחיר: '+orig+'₪\nהנחה: '+disc+'%\nמה המחיר החדש?'; answer=orig-orig*disc/100; label='כמה לשלם?';
      }
    } else {
      const cost=pick([80,100,120,150]),profit=pick([10,20,25,50]);
      question='מחיר קנייה: '+cost+'₪\nרווח: '+profit+'%\nמחיר מכירה?'; answer=cost+cost*profit/100; label='כמה למכור?';
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+randInt(5,20),answer-randInt(5,15),answer+randInt(10,30),answer/2].forEach(w=>{
      if(w!==answer&&w>0)wrongs.add(String(Math.round(w)));
    });
    while(wrongs.size<3) wrongs.add(String(answer+randInt(5,25)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'💹 אחוזים',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 12: Algebra (Grade 8) ──────────────
const topicAlgebra = {
  id: 'algebra', name: 'ביטויים אלגבריים', icon: '🧮', color: '#8855ff',
  generate(diff) {
    let question, answer, label='מה התוצאה?';
    if(diff==='easy') {
      const a=randInt(2,6),b=randInt(1,5);
      question='פשט: '+a+'x + '+b+'x'; answer=(a+b)+'x'; label='מה הביטוי?';
    } else if(diff==='medium') {
      const a=randInt(2,5),b=randInt(1,8),x=randInt(2,6);
      question='חשב '+a+'x + '+b+'\nכאשר x='+x; answer=a*x+b; label='מה הערך?';
    } else {
      const a=randInt(2,4),b=randInt(1,6),x=randInt(2,5);
      question='חשב '+a+'(x + '+b+')\nכאשר x='+x; answer=a*(x+b); label='מה הערך?';
    }
    const ansStr=String(answer);
    if(typeof answer==='string'){
      const wrongs=new Set();
      const num=parseInt(answer);
      [(num+1)+'x',(num-1)+'x',(num+3)+'x',(num*2)+'x'].forEach(w=>{if(w!==answer)wrongs.add(w);});
      while(wrongs.size<3) wrongs.add(randInt(2,20)+'x');
      const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
      return{question,qLabel:'🧮 אלגברה',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
    }
    const wrongs=new Set();
    [answer+randInt(1,5),answer-randInt(1,5),answer*2,answer+randInt(3,10)].forEach(w=>{if(w!==answer&&w>0)wrongs.add(String(w));});
    while(wrongs.size<3) wrongs.add(String(answer+randInt(1,15)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'🧮 אלגברה',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 13: Pythagoras (Grade 8) ───────────
const topicPythagoras = {
  id: 'pythagoras', name: 'פיתגורס', icon: '📐', color: '#ff4488',
  generate(diff) {
    const triples=[[3,4,5],[5,12,13],[6,8,10],[8,15,17],[9,12,15],[7,24,25],[20,21,29]];
    let question, answer, label;
    if(diff==='easy') {
      const [a,b,c]=pick(triples.slice(0,3));
      question='במשולש ישר זווית:\nניצבים: '+a+', '+b+'\nמה היתר?'; answer=c; label='אורך היתר?';
    } else if(diff==='medium') {
      const [a,b,c]=pick(triples.slice(0,4));
      question='במשולש ישר זווית:\nניצב: '+a+' יתר: '+c+'\nמה הניצב השני?'; answer=b; label='אורך הניצב?';
    } else {
      const [a,b,c]=pick(triples);
      if(randInt(0,1)){question='במשולש ישר זווית:\nניצבים: '+a+', '+b+'\nמה היתר?';answer=c;label='אורך היתר?';}
      else{question='האם '+a+'² + '+b+'² = '+c+'²?\n('+a*a+' + '+b*b+' = '+(c*c)+')';
        const ansStr='כן';
        const opts=shuffle(['כן','לא',a*a+b*b+'','לא ניתן']);
        return{question,qLabel:'📐 פיתגורס',aLabel:'האם נכון?',options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
      }
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+1,answer-1,answer+2,answer+3,answer-2].forEach(w=>{if(w!==answer&&w>0)wrongs.add(String(w));});
    while(wrongs.size<3) wrongs.add(String(answer+randInt(1,5)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'📐 פיתגורס',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 14: Linear Function (Grade 9) ──────
const topicLinearFunc = {
  id: 'linear', name: 'פונקציה קווית', icon: '📈', color: '#00ddaa',
  generate(diff) {
    let question, answer, label='מה התשובה?';
    if(diff==='easy') {
      const m=randInt(1,5),b=randInt(-5,10),x=randInt(1,6);
      question='y = '+m+'x'+(b>=0?' + '+b:' \u2212 '+(-b))+'\nמה y כאשר x='+x+'?'; answer=m*x+b; label='y = ?';
    } else if(diff==='medium') {
      const m=randInt(1,4),b=randInt(-3,5);
      question='y = '+m+'x'+(b>=0?' + '+b:' \u2212 '+(-b))+'\nמה השיפוע?'; answer=m; label='השיפוע = ?';
    } else {
      const m=randInt(1,5),b=randInt(-5,5),y=m*randInt(1,6)+b;
      const x=(y-b)/m;
      question='y = '+m+'x'+(b>=0?' + '+b:' \u2212 '+(-b))+'\nמצא x כאשר y='+y; answer=x; label='x = ?';
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+1,answer-1,answer+2,answer-2,answer*2].forEach(w=>{if(String(w)!==ansStr)wrongs.add(String(w));});
    while(wrongs.size<3) wrongs.add(String(answer+randInt(-5,5)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'📈 פונקציה',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 15: Exponent Laws (Grade 9) ────────
const topicExpLaws = {
  id: 'explaws', name: 'חוקי חזקות', icon: '🔢', color: '#ff8800',
  generate(diff) {
    let question, answer, label='מה החזקה?';
    if(diff==='easy') {
      const base=randInt(2,5),e1=randInt(1,4),e2=randInt(1,4);
      question=base+'^'+e1+' \u00D7 '+base+'^'+e2+' = '+base+'^?'; answer=e1+e2;
    } else if(diff==='medium') {
      const base=randInt(2,5),e1=randInt(3,7),e2=randInt(1,e1-1);
      question=base+'^'+e1+' \u00F7 '+base+'^'+e2+' = '+base+'^?'; answer=e1-e2;
    } else {
      const base=randInt(2,4),e1=randInt(2,4),e2=randInt(2,3);
      question='('+base+'^'+e1+')^'+e2+' = '+base+'^?'; answer=e1*e2;
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+1,answer-1,answer+2,answer*2,answer+3].forEach(w=>{if(w!==answer&&w>0)wrongs.add(String(w));});
    while(wrongs.size<3) wrongs.add(String(randInt(1,12)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'🔢 חוקי חזקות',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 16: Statistics (Grade 9) ───────────
const topicStats = {
  id: 'stats', name: 'סטטיסטיקה', icon: '📊', color: '#aa44ff',
  generate(diff) {
    let question, answer, label;
    if(diff==='easy') {
      const nums=[randInt(2,8),randInt(2,8),randInt(2,8),randInt(2,8),randInt(2,8)];
      const sum=nums.reduce((a,b)=>a+b,0);
      answer=sum/nums.length;
      question='ממוצע:\n'+nums.join(', '); label='מה הממוצע?';
    } else if(diff==='medium') {
      const nums=[randInt(1,10),randInt(1,10),randInt(1,10),randInt(1,10),randInt(1,10)].sort((a,b)=>a-b);
      answer=nums[2]; // median of 5
      question='חציון:\n'+nums.join(', '); label='מה החציון?';
    } else {
      const base=randInt(1,6);
      const nums=[base,base,base,base+randInt(1,3),base+randInt(2,5),base-randInt(0,2)].filter(n=>n>0);
      answer=base; // mode
      question='שכיח:\n'+shuffle(nums).join(', '); label='מה השכיח?';
    }
    const ansStr=Number.isInteger(answer)?String(answer):String(Math.round(answer*10)/10);
    const wrongs=new Set();
    [answer+1,answer-1,answer+2,answer-2,answer+0.5].forEach(w=>{
      const ws=Number.isInteger(w)?String(w):String(Math.round(w*10)/10);
      if(ws!==ansStr&&w>0)wrongs.add(ws);
    });
    while(wrongs.size<3) wrongs.add(String(answer+randInt(1,5)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'📊 סטטיסטיקה',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 17: Quadratic Equations (Grade 10) ─
const topicQuadratic = {
  id: 'quadratic', name: 'משוואה ריבועית', icon: '🔷', color: '#00aaff',
  generate(diff) {
    let question, answer, label='x = ?';
    if(diff==='easy') {
      // x²=k → x=√k (positive root)
      const x=randInt(2,9);
      question='x² = '+(x*x)+'\nמצא x חיובי'; answer=x;
    } else if(diff==='medium') {
      // (x-a)(x-b)=0 factored form
      const x1=randInt(1,8), x2=randInt(1,8);
      if(x1===x2) return topicQuadratic.generate(diff);
      question='x² \u2212 '+(x1+x2)+'x + '+(x1*x2)+' = 0\nמצא x הגדול'; answer=Math.max(x1,x2);
    } else {
      // ax²+bx+c=0 with discriminant
      const x1=randInt(-5,5), x2=randInt(-5,5);
      if(x1===x2) return topicQuadratic.generate(diff);
      const a=1, b=-(x1+x2), c=x1*x2;
      const bStr=b>=0?'+ '+b:'\u2212 '+(-b);
      const cStr=c>=0?'+ '+c:'\u2212 '+(-c);
      question='x² '+bStr+'x '+cStr+' = 0\nמה סכום הפתרונות?'; answer=x1+x2; label='סכום = ?';
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+1,answer-1,answer+2,answer-2,answer*2].forEach(w=>{if(String(w)!==ansStr)wrongs.add(String(w));});
    while(wrongs.size<3) wrongs.add(String(answer+randInt(-5,5)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'🔷 משוואה ריבועית',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 18: Parabola / Quadratic Function (Grade 10) ─
const topicParabola = {
  id: 'parabola', name: 'פרבולה', icon: '🎯', color: '#ff55aa',
  generate(diff) {
    let question, answer, label='מה התשובה?';
    if(diff==='easy') {
      // Find vertex x-coordinate: x = -b/(2a)
      const xv=randInt(-4,4), a=pick([1,-1]);
      const b=-2*a*xv;
      const bStr=b>=0?'+ '+b:'\u2212 '+(-b);
      question='y = '+(a===1?'':'\u2212')+'x² '+bStr+'x\nמה ציר הסימטריה?'; answer=xv; label='x = ?';
    } else if(diff==='medium') {
      // y=x²+bx+c, find y when x=k
      const k=randInt(-3,3), b2=randInt(-4,4), c2=randInt(-5,5);
      const bStr=b2>=0?'+ '+b2:'\u2212 '+(-b2);
      const cStr=c2>=0?'+ '+c2:'\u2212 '+(-c2);
      question='y = x² '+bStr+'x '+cStr+'\nמצא y כאשר x='+k; answer=k*k+b2*k+c2; label='y = ?';
    } else {
      // Does parabola open up or down? + discriminant sign
      const a=pick([1,2,-1,-2]), xv=randInt(-3,3), yv=randInt(-5,5);
      const dir=a>0?'למעלה':'למטה';
      question='y = '+(a===1?'':(a===-1?'\u2212':a))+'x² ...\n(a='+(a)+')\nהפרבולה פונה?';
      const ansStr=dir;
      const opts=shuffle(['למעלה','למטה','ימינה','שמאלה']);
      return{question,qLabel:'🎯 פרבולה',aLabel:'לאן פונה?',options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+1,answer-1,answer+2,answer-2,answer*(-1)].forEach(w=>{if(String(w)!==ansStr)wrongs.add(String(w));});
    while(wrongs.size<3) wrongs.add(String(answer+randInt(-5,5)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'🎯 פרבולה',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 19: Trigonometry (Grade 10) ───────
const TRIG_ANGLES = [
  {deg:30, sin:0.5, cos:0.866, tan:0.577},
  {deg:45, sin:0.707, cos:0.707, tan:1},
  {deg:60, sin:0.866, cos:0.5, tan:1.732},
];
const topicTrig = {
  id: 'trig', name: 'טריגונומטריה', icon: '📐', color: '#ff6600',
  generate(diff) {
    let question, answer, label='מה התשובה?';
    if(diff==='easy') {
      // sin/cos/tan definition with known triangles
      const ta=pick(TRIG_ANGLES);
      const func=pick(['sin','cos','tan']);
      const val=func==='sin'?ta.sin:func==='cos'?ta.cos:ta.tan;
      question=func+'('+ta.deg+'°) = ?';
      answer=val; label='מה הערך?';
      const ansStr=String(answer);
      const wrongs=new Set();
      TRIG_ANGLES.forEach(a2=>{
        [a2.sin,a2.cos,a2.tan].forEach(v=>{
          if(String(v)!==ansStr) wrongs.add(String(v));
        });
      });
      while(wrongs.size<3) wrongs.add(String(Math.round(Math.random()*1000)/1000));
      const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
      return{question,qLabel:'📐 טריגונומטריה',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
    } else if(diff==='medium') {
      // Find side using sin/cos/tan: given hypotenuse and angle
      const ta=pick(TRIG_ANGLES);
      const hyp=pick([10,20,12,8,6]);
      if(randInt(0,1)) {
        // opposite = hyp * sin(angle)
        const opp=Math.round(hyp*ta.sin*10)/10;
        question='במשולש ישר זווית:\nיתר='+hyp+' זווית='+ta.deg+'°\nמה הניצב שמול?';
        answer=opp; label='אורך הניצב?';
      } else {
        // adjacent = hyp * cos(angle)
        const adj=Math.round(hyp*ta.cos*10)/10;
        question='במשולש ישר זווית:\nיתר='+hyp+' זווית='+ta.deg+'°\nמה הניצב שליד?';
        answer=adj; label='אורך הניצב?';
      }
    } else {
      // Find angle given two sides
      const ta=pick(TRIG_ANGLES);
      const mult=pick([2,3,4,5]);
      const opp=Math.round(ta.sin*mult*10);
      const hyp=mult*10;
      question='במשולש ישר זווית:\nניצב שמול='+opp+'\nיתר='+hyp+'\nמה הזווית?';
      answer=ta.deg; label='כמה מעלות?';
      const ansStr=answer+'°';
      const wrongs=new Set();
      TRIG_ANGLES.forEach(a2=>{if(a2.deg!==answer)wrongs.add(a2.deg+'°');});
      wrongs.add((answer+15)+'°'); wrongs.add((90-answer)+'°');
      while(wrongs.size<3) wrongs.add(randInt(20,70)+'°');
      const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
      return{question,qLabel:'📐 טריגונומטריה',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+1,answer-1,answer+0.5,answer-0.5,answer*2].forEach(w=>{
      const ws=String(Math.round(w*10)/10);
      if(ws!==ansStr&&w>0)wrongs.add(ws);
    });
    while(wrongs.size<3) wrongs.add(String(Math.round((answer+randInt(1,5))*10)/10));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'📐 טריגונומטריה',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 20: Arithmetic Sequences (Grade 10) ─
const topicSequences = {
  id: 'sequences', name: 'סדרות חשבוניות', icon: '🔢', color: '#11ccaa',
  generate(diff) {
    let question, answer, label='מה התשובה?';
    if(diff==='easy') {
      // Find next term: a, a+d, a+2d, ?
      const a1=randInt(1,10), d=randInt(2,6);
      question=a1+', '+(a1+d)+', '+(a1+2*d)+', ?\nמה האיבר הבא?'; answer=a1+3*d;
    } else if(diff==='medium') {
      // Find nth term: a_n = a1 + (n-1)*d
      const a1=randInt(1,8), d=randInt(2,5), n=randInt(5,10);
      question='a₁='+a1+' d='+d+'\nמה a'+n+'?'; answer=a1+(n-1)*d; label='a'+n+' = ?';
    } else {
      // Sum of first n terms: S = n/2 * (2a1 + (n-1)*d)
      const a1=randInt(1,5), d=randInt(1,4), n=pick([5,6,8,10]);
      const sum=n*(2*a1+(n-1)*d)/2;
      question='a₁='+a1+' d='+d+'\nמה סכום '+n+' איברים ראשונים?'; answer=sum; label='S = ?';
    }
    const ansStr=String(answer);
    const wrongs=new Set();
    [answer+randInt(1,5),answer-randInt(1,5),answer+randInt(3,10),answer*2].forEach(w=>{if(String(w)!==ansStr&&w>0)wrongs.add(String(w));});
    while(wrongs.size<3) wrongs.add(String(answer+randInt(1,15)));
    const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
    return{question,qLabel:'🔢 סדרות',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
  }
};

// ── Topic 21: Probability (Grade 10) ────────
const topicProbability = {
  id: 'probability', name: 'הסתברות', icon: '🎲', color: '#ffcc00',
  generate(diff) {
    let question, answer, label='מה ההסתברות?';
    if(diff==='easy') {
      // Simple probability: dice or coins
      const type=randInt(0,2);
      if(type===0) {
        const target=randInt(1,6);
        question='בהטלת קובייה:\nמה ההסתברות לקבל '+target+'?';
        answer='1/6';
        const opts=shuffle(['1/6','1/3','1/2','2/6']);
        return{question,qLabel:'🎲 הסתברות',aLabel:label,options:opts,correct:answer,correctIdx:opts.indexOf(answer)};
      } else if(type===1) {
        question='בהטלת מטבע:\nמה ההסתברות לקבל עץ?';
        answer='1/2';
        const opts=shuffle(['1/2','1/4','1/3','2/3']);
        return{question,qLabel:'🎲 הסתברות',aLabel:label,options:opts,correct:answer,correctIdx:opts.indexOf(answer)};
      } else {
        const even=3;
        question='בהטלת קובייה:\nמה ההסתברות לזוגי?';
        answer='1/2';
        const opts=shuffle(['1/2','1/3','1/6','2/3']);
        return{question,qLabel:'🎲 הסתברות',aLabel:label,options:opts,correct:answer,correctIdx:opts.indexOf(answer)};
      }
    } else if(diff==='medium') {
      // Drawing balls from bag
      const total=pick([8,10,12,15,20]);
      const red=randInt(2,total-2);
      const g2=gcd(red,total);
      const ansStr=(red/g2)+'/'+(total/g2);
      question='בשקית '+total+' כדורים:\n'+red+' אדומים\nמה ההסתברות לאדום?';
      const wrongs=new Set();
      [[red+1,total],[red-1,total],[red,total+2],[total-red,total]].forEach(([n,d])=>{
        if(n>0&&n<d){const g3=gcd(n,d);wrongs.add((n/g3)+'/'+(d/g3));}
      });
      while(wrongs.size<3) wrongs.add(randInt(1,total-1)+'/'+total);
      const opts=shuffle([ansStr,...[...wrongs].filter(w=>w!==ansStr).slice(0,3)]);
      return{question,qLabel:'🎲 הסתברות',aLabel:label,options:opts,correct:ansStr,correctIdx:opts.indexOf(ansStr)};
    } else {
      // Complement: P(not A) = 1 - P(A)
      const p=pick([10,20,25,30,40,60,75]);
      question='הסתברות לגשם: '+p+'%\nמה ההסתברות שלא ירד גשם?';
      const answer2=(100-p)+'%';
      const wrongs=new Set();
      [p+'%',(100-p+10)+'%',(100-p-10)+'%',(p+5)+'%'].forEach(w=>{if(w!==answer2&&parseInt(w)>0&&parseInt(w)<=100)wrongs.add(w);});
      while(wrongs.size<3) wrongs.add(randInt(10,90)+'%');
      const opts=shuffle([answer2,...[...wrongs].filter(w=>w!==answer2).slice(0,3)]);
      return{question,qLabel:'🎲 הסתברות',aLabel:'כמה אחוז?',options:opts,correct:answer2,correctIdx:opts.indexOf(answer2)};
    }
  }
};

// ── All Topics ───────────────────────────────
const ALL_TOPICS = [
  topicFractions, topicOrderOps, topicAreaPerimeter, topicPowers, topicRatio,
  topicMultDiv, topicSimpleFrac, topicSigned, topicEquations, topicPercent,
  topicAlgebra, topicPythagoras, topicLinearFunc, topicExpLaws, topicStats,
  topicQuadratic, topicParabola, topicTrig, topicSequences, topicProbability
];

// ── Grade → Topics Map ───────────────────────
const GRADES = {
  4: { label:'כיתה ד׳', topics:['multdiv','simplefrac','area'] },
  5: { label:'כיתה ה׳', topics:['fractions','orderops','area'] },
  6: { label:'כיתה ו׳', topics:['fractions','orderops','area','powers','ratio'] },
  7: { label:'כיתה ז׳', topics:['signed','equations','percent','powers','ratio'] },
  8: { label:'כיתה ח׳', topics:['algebra','equations','pythagoras','area'] },
  9: { label:'כיתה ט׳', topics:['linear','explaws','stats','equations','percent'] },
  10: { label:'כיתה י׳', topics:['quadratic','parabola','trig','sequences','probability'] },
};

// ── Hints per Topic ──────────────────────────
const HINTS = {
  fractions:'💡 הרחיבו או צמצמו כדי להשוות!',
  orderops:'💡 קודם סוגריים, אח"כ כפל/חילוק, ואז חיבור/חיסור!',
  area:'💡 שטח מלבן = אורך × רוחב, משולש = (בסיס×גובה)÷2',
  powers:'💡 חזקה = כפל של הבסיס בעצמו כמספר החזקה',
  ratio:'💡 יחס = חלוקה לפי הפרופורציה, מצאו את הכפולה!',
  multdiv:'💡 נסו לפרק לעשרות ויחידות!',
  simplefrac:'💡 מצאו מכנה משותף או צמצמו!',
  signed:'💡 מינוס כפול מינוס = פלוס!',
  equations:'💡 העבירו אגפים — מה שעובר הופך סימן!',
  percent:'💡 אחוז = חלקים מתוך 100. כפלו וחלקו ב-100!',
  algebra:'💡 כנסו איברים דומים — x עם x, מספרים עם מספרים!',
  pythagoras:'💡 a² + b² = c² (היתר הוא הצלע הכי ארוכה!)',
  linear:'💡 y = mx + b → m=שיפוע, b=חיתוך עם y',
  explaws:'💡 כפל=חיבור חזקות, חילוק=חיסור, חזקת חזקה=כפל!',
  stats:'💡 ממוצע=סכום÷כמות, חציון=אמצעי, שכיח=הכי נפוץ',
  quadratic:'💡 נוסחת השורשים: x=(-b±√Δ)/2a, כאשר Δ=b²-4ac',
  parabola:'💡 a>0 פונה למעלה, a<0 למטה. קודקוד: x=-b/2a',
  trig:'💡 sin=נגד/יתר, cos=ליד/יתר, tan=נגד/ליד',
  sequences:'💡 aₙ=a₁+(n-1)d, סכום: S=n(a₁+aₙ)/2',
  probability:'💡 הסתברות = מקרים רצויים ÷ כל המקרים',
};

// ── Explanations per Topic ───────────────────
const EXPLANATIONS = {
  fractions:{t:'שברים עשרוניים אחוזים',f:'½ = 0.5 = 50%',b:'הכפלה במונה ובמכנה באותו מספר = שבר שקול'},
  orderops:{t:'סדר פעולות',f:'סוגריים → חזקות → כפל/חילוק → חיבור/חיסור',b:'תמיד פתרו לפי הסדר הנכון!'},
  area:{t:'שטח והיקף',f:'מלבן: ש=א×ר, ה=2(א+ר)',b:'שטח = כמה מקום בפנים, היקף = הקו מסביב'},
  powers:{t:'חזקות',f:'aⁿ = a×a×...×a (n פעמים)',b:'3² = 3×3 = 9'},
  ratio:{t:'יחס ופרופורציה',f:'a:b → חלק=סה"כ×(a/(a+b))',b:'מצאו את הכפולה המשותפת'},
  multdiv:{t:'כפל וחילוק',f:'a×b = b×a',b:'חילוק = הפעולה ההפוכה לכפל'},
  simplefrac:{t:'שברים פשוטים',f:'שבר = חלק מתוך שלם',b:'מונה÷מכנה = הערך'},
  signed:{t:'מספרים מכוונים',f:'(−)×(−) = (+), (−)×(+) = (−)',b:'חשבו על ציר המספרים!'},
  equations:{t:'משוואות',f:'ax + b = c → x = (c−b)÷a',b:'מה שעובר אגף — הופך סימן!'},
  percent:{t:'אחוזים',f:'X% מתוך N = N×X÷100',b:'25% = ¼, 50% = ½, 75% = ¾'},
  algebra:{t:'אלגברה',f:'3x+2x = 5x',b:'כנסו איברים דומים, פתחו סוגריים'},
  pythagoras:{t:'פיתגורס',f:'a²+b² = c²',b:'c = היתר (הצלע מול הזווית הישרה)'},
  linear:{t:'פונקציה קווית',f:'y = mx + b',b:'m=שיפוע (כמה עולה), b=חיתוך'},
  explaws:{t:'חוקי חזקות',f:'aⁿ×aᵐ=aⁿ⁺ᵐ, aⁿ÷aᵐ=aⁿ⁻ᵐ',b:'(aⁿ)ᵐ = aⁿˣᵐ'},
  stats:{t:'סטטיסטיקה',f:'ממוצע = סכום ÷ כמות',b:'חציון = הערך האמצעי, שכיח = הכי נפוץ'},
  quadratic:{t:'משוואה ריבועית',f:'ax²+bx+c=0 → x=(-b±√Δ)/2a',b:'Δ=b²-4ac: חיובי=2 פתרונות, 0=אחד, שלילי=אין'},
  parabola:{t:'פרבולה',f:'y=ax²+bx+c',b:'קודקוד: x=-b/2a, a>0=חיוך, a<0=עצב'},
  trig:{t:'טריגונומטריה',f:'sin=נגד÷יתר, cos=ליד÷יתר',b:'tan=sin/cos, sin²+cos²=1'},
  sequences:{t:'סדרות חשבוניות',f:'aₙ = a₁+(n-1)×d',b:'S = n×(a₁+aₙ)÷2'},
  probability:{t:'הסתברות',f:'P(A) = רצויים÷כולם',b:'P(לא A) = 1-P(A), 0≤P≤1'},
};

// ── Character Messages ───────────────────────
const CHAR_OK = ['😎','🤩','💪','🙌','🔥'];
const CHAR_OK_MSG = ['!נכון','מושלם!','חזק!','בום!','אש!'];
const CHAR_STREAK = ['🥳','👑','🚀'];
const CHAR_STREAK_MSG = ['רצח!','אלוף!','טיל!'];
const CHAR_BAD = ['😅','🤷','💪'];
const CHAR_BAD_MSG = ['לא נורא!','קורה...','!הבא שלך'];
const CHAR_CLOSE_MSG = 'כמעט! 🤏';

// ── Achievement Definitions ──────────────────
const ACH_DEFS = [
  {id:'first',check:(s)=>s.totalCorrect>=1,icon:'🎯',text:'תשובה ראשונה!'},
  {id:'s5',check:(s)=>s.streak>=5,icon:'🔥',text:'רצף 5!'},
  {id:'s10',check:(s)=>s.streak>=10,icon:'👑',text:'רצף 10!'},
  {id:'p500',check:(s)=>s.score>=500,icon:'💰',text:'500 נקודות!'},
  {id:'p1k',check:(s)=>s.score>=1000,icon:'🏆',text:'1000 נקודות!'},
  {id:'p2k',check:(s)=>s.score>=2000,icon:'💎',text:'2000 נקודות!'},
  {id:'perfect',check:(s)=>s.answered>=10&&s.totalCorrect===s.answered,icon:'⭐',text:'סיבוב מושלם!'},
];

const genQuestion = (diff, selectedTopicIds) => {
  const available = ALL_TOPICS.filter(t => selectedTopicIds.includes(t.id));
  const topic = available.length > 0 ? pick(available) : topicFractions;
  const q = topic.generate(diff);
  q.topicId = topic.id;
  // Build rich step-by-step solution
  if(!q.solutionSteps) {
  const nums = q.question.match(/[\d.]+/g) || [];
  const ans = q.correct.replace(/[°%]/g,'');
  const id = topic.id;
  if(id==='area') {
    if(q.question.includes('משולש')&&nums.length>=2) {
      const b=nums[0],h=nums[1],prod=Number(b)*Number(h);
      q.solutionSteps = 'נוסחה: שטח משולש = (בסיס × גובה) ÷ 2\nשלב 1: כפל בסיס בגובה → '+b+' × '+h+' = '+prod+'\nשלב 2: חלוקה ב-2 → '+prod+' ÷ 2 = '+ans+' ✓';
    } else if(q.question.includes('טרפז')&&nums.length>=3) {
      const a=nums[0],b=nums[1],h=nums[2],sum=Number(a)+Number(b),prod=sum*Number(h);
      q.solutionSteps = 'נוסחה: שטח טרפז = (בסיס₁ + בסיס₂) × גובה ÷ 2\nשלב 1: סכום בסיסים → '+a+' + '+b+' = '+sum+'\nשלב 2: כפל בגובה → '+sum+' × '+h+' = '+prod+'\nשלב 3: חלוקה ב-2 → '+prod+' ÷ 2 = '+ans+' ✓';
    } else if(q.question.includes('היקף')&&q.question.includes('מלבן')&&nums.length>=2) {
      const a=nums[0],b=nums[1],sum=Number(a)+Number(b);
      q.solutionSteps = 'נוסחה: היקף מלבן = 2 × (אורך + רוחב)\nשלב 1: חיבור צלעות → '+a+' + '+b+' = '+sum+'\nשלב 2: כפל ב-2 → 2 × '+sum+' = '+ans+' ✓';
    } else if(q.question.includes('ריבוע')&&q.question.includes('שטח')&&nums.length>=1) {
      q.solutionSteps = 'נוסחה: שטח ריבוע = צלע × צלע\nחישוב: '+nums[0]+' × '+nums[0]+' = '+ans+' ✓';
    } else if(q.question.includes('ריבוע')&&q.question.includes('היקף')&&nums.length>=1) {
      q.solutionSteps = 'נוסחה: היקף ריבוע = צלע × 4\nחישוב: '+nums[0]+' × 4 = '+ans+' ✓';
    } else if(q.question.includes('מקבילית')&&nums.length>=2) {
      q.solutionSteps = 'נוסחה: שטח מקבילית = בסיס × גובה\nחישוב: '+nums[0]+' × '+nums[1]+' = '+ans+' ✓';
    } else if(q.question.includes('צורה מורכבת')&&nums.length>=4) {
      const a1=Number(nums[0])*Number(nums[1]),a2=Number(nums[2])*Number(nums[3]);
      q.solutionSteps = 'כלל: שטח צורה מורכבת = סכום השטחים\nשלב 1: שטח מלבן 1 → '+nums[0]+' × '+nums[1]+' = '+a1+'\nשלב 2: שטח מלבן 2 → '+nums[2]+' × '+nums[3]+' = '+a2+'\nשלב 3: סכום → '+a1+' + '+a2+' = '+ans+' ✓';
    } else if(nums.length>=2) {
      q.solutionSteps = 'שטח מלבן = אורך × רוחב\nחישוב: '+nums[0]+' × '+nums[1]+' = '+ans+' ✓';
    }
  } else if(id==='orderops') {
    const expr = q.question;
    if(expr.includes('(')&&expr.includes(')')) {
      q.solutionSteps = 'כלל: פתרו קודם את הסוגריים, אחר כך כפל/חילוק, ואז חיבור/חיסור\n'+expr+' = '+ans+' ✓';
    } else if(expr.includes('\u00D7')||expr.includes('\u00F7')) {
      q.solutionSteps = 'כלל: כפל וחילוק לפני חיבור וחיסור\n'+expr+' = '+ans+' ✓';
    } else {
      q.solutionSteps = 'כלל: סוגריים → חזקות → כפל/חילוק → חיבור/חיסור\n'+expr+' = '+ans+' ✓';
    }
  } else if(id==='powers') {
    const expr = q.question;
    if(expr.includes('\u00B3')) {
      const b=nums[0];
      q.solutionSteps = 'חזקה שלישית = המספר כפול עצמו 3 פעמים\n'+b+'³ = '+b+' × '+b+' × '+b+' = '+ans+' ✓';
    } else if(expr.includes('(')&&expr.includes('²)²')) {
      const b=nums[0];
      q.solutionSteps = 'כלל: (a²)² = a⁴\nשלב 1: '+b+'² = '+(Number(b)*Number(b))+'\nשלב 2: '+(Number(b)*Number(b))+'² = '+ans+' ✓';
    } else if(expr.includes('\u00D7')&&nums.length>=2) {
      const a=nums[0],b=nums[1];
      q.solutionSteps = 'שלב 1: '+a+'² = '+(Number(a)*Number(a))+'\nשלב 2: '+b+'² = '+(Number(b)*Number(b))+'\nשלב 3: '+(Number(a)*Number(a))+' × '+(Number(b)*Number(b))+' = '+ans+' ✓';
    } else if(expr.includes('\u2212')&&nums.length>=2) {
      const a=nums[0],sub=nums[1];
      q.solutionSteps = 'שלב 1: '+a+'² = '+(Number(a)*Number(a))+'\nשלב 2: '+(Number(a)*Number(a))+' − '+sub+' = '+ans+' ✓';
    } else if(expr.includes('+')&&nums.length>=2) {
      const a=nums[0],add=nums[1];
      q.solutionSteps = 'שלב 1: '+a+'² = '+(Number(a)*Number(a))+'\nשלב 2: '+(Number(a)*Number(a))+' + '+add+' = '+ans+' ✓';
    } else {
      const b=nums[0];
      q.solutionSteps = 'חזקה שנייה = המספר כפול עצמו\n'+b+'² = '+b+' × '+b+' = '+ans+' ✓';
    }
  } else if(id==='ratio') {
    if(q.question.includes('סה"כ')&&nums.length>=3) {
      const parts=q.question.match(/יחס\s+([\d:]+)/);
      const total=nums[nums.length-2]||nums[1]; // total amount
      q.solutionSteps = 'כלל: חלק = סה"כ × (יחס ÷ סכום היחסים)\nשלב 1: סכום היחסים → מחושב מהנתונים\nשלב 2: חלק = '+ans+' ✓';
    } else if(nums.length>=3) {
      const a=nums[0],b=nums[1],target=nums[2];
      q.solutionSteps = 'כלל: יחס שווה — מכפילים/מחלקים את שני הצדדים באותו מספר\n'+a+':'+b+' = '+target+':?\nמכפיל: '+target+' ÷ '+a+' = '+(Number(target)/Number(a))+'\nתשובה: '+b+' × '+(Number(target)/Number(a))+' = '+ans+' ✓';
    } else {
      q.solutionSteps = 'כלל: ביחס a:b — מצאו את הכפולה המשותפת\nתשובה: '+ans+' ✓';
    }
  } else if(id==='multdiv') {
    const expr = q.question;
    if(expr.includes('\u00F7')) {
      q.solutionSteps = 'חילוק = הפעולה ההפוכה לכפל\n'+expr+' = '+ans+' ✓';
    } else {
      q.solutionSteps = expr+' = '+ans+' ✓';
    }
  } else if(id==='simplefrac') {
    if(q.question.includes('מתוך')&&nums.length>=3) {
      const n=nums[0],d=nums[1],whole=nums[2];
      q.solutionSteps = 'כלל: שבר מתוך מספר = (מספר ÷ מכנה) × מונה\nשלב 1: '+whole+' ÷ '+d+' = '+(Number(whole)/Number(d))+'\nשלב 2: '+(Number(whole)/Number(d))+' × '+n+' = '+ans+' ✓';
    } else if(q.question.includes('צמצם')&&nums.length>=2) {
      q.solutionSteps = 'כלל: צמצום = חלוקת מונה ומכנה במחלק משותף\n'+nums[0]+'/'+nums[1]+' = '+q.correct+' ✓';
    } else if(q.question.includes('⬜')) {
      q.solutionSteps = 'כלל: להשוות שברים — הפכו לעשרוניים או למכנה משותף\nתשובה: '+q.correct+' ✓';
    } else {
      q.solutionSteps = 'תשובה: '+q.correct+' ✓';
    }
  } else if(id==='signed') {
    const expr = q.question;
    if(expr.includes('\u00D7')) {
      const hasNeg = (expr.match(/-/g)||[]).length;
      const rule = hasNeg%2===0 ? '(−)×(−) = (+) — מספר זוגי של מינוסים = חיובי' : '(−)×(+) = (−) — מספר אי-זוגי של מינוסים = שלילי';
      q.solutionSteps = 'כלל: '+rule+'\n'+expr+' = '+ans+' ✓';
    } else if(expr.includes('\u00F7')) {
      q.solutionSteps = 'כלל: כמו כפל — סימנים שווים=חיובי, שונים=שלילי\n'+expr+' = '+ans+' ✓';
    } else if(expr.includes('\u2212')) {
      q.solutionSteps = 'כלל: חיסור = חיבור ההפכי → הפכו סימן ושנו לחיבור\n'+expr+' = '+ans+' ✓';
    } else {
      q.solutionSteps = 'כלל: בחיבור מכוונים — שימו לב לסימנים!\n'+expr+' = '+ans+' ✓';
    }
  } else if(id==='equations') {
    if(q.question.includes('\u2212')&&nums.length>=3) {
      const a=nums[0],b=nums[1],c=nums[2];
      q.solutionSteps = 'כלל: מה שעובר אגף — הופך סימן\nשלב 1: העבירו '+b+' לצד השני\n'+a+'x = '+c+' + '+b+' = '+(Number(c)+Number(b))+'\nשלב 2: חלקו ב-'+a+'\nx = '+(Number(c)+Number(b))+' ÷ '+a+' = '+ans+' ✓';
    } else if(nums.length>=3) {
      const a=nums[0],b=nums[1],c=nums[2];
      q.solutionSteps = 'כלל: מה שעובר אגף — הופך סימן\nשלב 1: העבירו '+b+' לצד השני\n'+a+'x = '+c+' − '+b+' = '+(Number(c)-Number(b))+'\nשלב 2: חלקו ב-'+a+'\nx = '+(Number(c)-Number(b))+' ÷ '+a+' = '+ans+' ✓';
    } else {
      q.solutionSteps = 'כלל: בודדו את x — העבירו מספרים לצד השני\nx = '+ans+' ✓';
    }
  } else if(id==='percent') {
    if(q.question.includes('הנחה')&&nums.length>=2) {
      const price=nums[0],disc=nums[1],discAmt=Number(price)*Number(disc)/100;
      q.solutionSteps = 'כלל: מחיר אחרי הנחה = מחיר × (100% − הנחה%)\nשלב 1: גובה ההנחה → '+price+' × '+disc+'% = '+discAmt+'\nשלב 2: מחיר סופי → '+price+' − '+discAmt+' = '+ans+' ✓';
    } else if(q.question.includes('רווח')&&nums.length>=2) {
      const cost=nums[0],profit=nums[1],profitAmt=Number(cost)*Number(profit)/100;
      q.solutionSteps = 'כלל: מחיר מכירה = עלות + רווח\nשלב 1: גובה הרווח → '+cost+' × '+profit+'% = '+profitAmt+'\nשלב 2: מחיר מכירה → '+cost+' + '+profitAmt+' = '+ans+' ✓';
    } else if(nums.length>=2) {
      const p=nums[0],n=nums[1];
      q.solutionSteps = 'כלל: X% מתוך N = N × X ÷ 100\nחישוב: '+n+' × '+p+' ÷ 100 = '+ans+' ✓';
    }
  } else if(id==='fractions') {
    const v = q.question;
    if(v.includes('/')&&q.correct.includes('%')) {
      q.solutionSteps = 'כלל: שבר → אחוזים: חלקו מונה במכנה, ואז כפלו ב-100\nשלב 1: '+v+' (חלוקה) → עשרוני\nשלב 2: × 100 = '+q.correct+' ✓';
    } else if(v.includes('/')&&!q.correct.includes('/')) {
      q.solutionSteps = 'כלל: שבר → עשרוני: חלקו מונה במכנה\n'+v+' = '+q.correct+' ✓';
    } else if(v.includes('%')&&q.correct.includes('/')) {
      q.solutionSteps = 'כלל: אחוזים → שבר: שימו מעל 100 וצמצמו\n'+v+' = '+v.replace('%','')+'/100 = '+q.correct+' ✓';
    } else if(v.includes('%')) {
      q.solutionSteps = 'כלל: אחוזים → עשרוני: חלקו ב-100\n'+v+' ÷ 100 = '+q.correct+' ✓';
    } else if(q.correct.includes('%')) {
      q.solutionSteps = 'כלל: עשרוני → אחוזים: כפלו ב-100\n'+v+' × 100 = '+q.correct+' ✓';
    } else if(q.correct.includes('/')) {
      q.solutionSteps = 'כלל: עשרוני → שבר: רשמו כשבר עשרוני וצמצמו\n'+v+' = '+q.correct+' ✓';
    } else {
      q.solutionSteps = v+' = '+q.correct+' ✓';
    }
  } else if(id==='algebra') {
    if(q.question.includes('פשט')&&nums.length>=2) {
      q.solutionSteps = 'כלל: איברים דומים — חברו את המקדמים\n'+nums[0]+'x + '+nums[1]+'x = ('+nums[0]+'+'+nums[1]+')x = '+q.correct+' ✓';
    } else if(q.question.includes('(')&&nums.length>=3) {
      const a=nums[0],b=nums[1],x=nums[2];
      q.solutionSteps = 'כלל: פתחו סוגריים — כפלו כל איבר\nשלב 1: '+a+'×('+x+' + '+b+') = '+a+'×'+x+' + '+a+'×'+b+'\nשלב 2: '+(Number(a)*Number(x))+' + '+(Number(a)*Number(b))+' = '+ans+' ✓';
    } else if(nums.length>=3) {
      const a=nums[0],b=nums[1],x=nums[2];
      q.solutionSteps = 'כלל: הציבו את הערך במקום x\nשלב 1: '+a+'×'+x+' + '+b+' = '+(Number(a)*Number(x))+' + '+b+'\nשלב 2: '+(Number(a)*Number(x))+' + '+b+' = '+ans+' ✓';
    }
  } else if(id==='pythagoras') {
    if(q.question.includes('היתר')&&nums.length>=2) {
      const a=nums[0],b=nums[1],a2=Number(a)*Number(a),b2=Number(b)*Number(b);
      q.solutionSteps = 'נוסחה: a² + b² = c² → c = √(a²+b²)\nשלב 1: '+a+'² = '+a2+'\nשלב 2: '+b+'² = '+b2+'\nשלב 3: √('+a2+' + '+b2+') = √'+(a2+b2)+' = '+ans+' ✓';
    } else if(q.question.includes('הניצב')&&nums.length>=2) {
      const a=nums[0],c=nums[1],a2=Number(a)*Number(a),c2=Number(c)*Number(c);
      q.solutionSteps = 'נוסחה: b = √(c² − a²)\nשלב 1: '+c+'² = '+c2+'\nשלב 2: '+a+'² = '+a2+'\nשלב 3: √('+c2+' − '+a2+') = √'+(c2-a2)+' = '+ans+' ✓';
    } else {
      q.solutionSteps = 'נוסחה: a² + b² = c²\nתשובה: '+q.correct+' ✓';
    }
  } else if(id==='linear') {
    if(q.question.includes('y')&&q.question.includes('x=')&&nums.length>=3) {
      const m=nums[0],b=nums[1],x=nums[2];
      q.solutionSteps = 'נוסחה: y = mx + b — הציבו x\nשלב 1: y = '+m+'×'+x+' + ('+b+')\nשלב 2: y = '+(Number(m)*Number(x))+' + '+b+' = '+ans+' ✓';
    } else if(q.question.includes('השיפוע')&&nums.length>=1) {
      q.solutionSteps = 'כלל: ב-y = mx + b, השיפוע הוא m (המקדם של x)\nתשובה: m = '+ans+' ✓';
    } else if(q.question.includes('מצא x')&&nums.length>=3) {
      const m=nums[0],b=nums[1],y=nums[2];
      q.solutionSteps = 'כלל: x = (y − b) ÷ m\nשלב 1: ('+y+' − '+b+') = '+(Number(y)-Number(b))+'\nשלב 2: '+(Number(y)-Number(b))+' ÷ '+m+' = '+ans+' ✓';
    } else {
      q.solutionSteps = 'נוסחה: y = mx + b\nתשובה: '+q.correct+' ✓';
    }
  } else if(id==='explaws') {
    const expr = q.question;
    if(expr.includes('\u00D7')&&nums.length>=3) {
      q.solutionSteps = 'כלל: aⁿ × aᵐ = aⁿ⁺ᵐ (בסיסים שווים → חברו חזקות)\nחישוב: '+nums[1]+' + '+nums[2]+' = '+ans+' ✓';
    } else if(expr.includes('\u00F7')&&nums.length>=3) {
      q.solutionSteps = 'כלל: aⁿ ÷ aᵐ = aⁿ⁻ᵐ (בסיסים שווים → חסרו חזקות)\nחישוב: '+nums[1]+' − '+nums[2]+' = '+ans+' ✓';
    } else if(expr.includes(')^')&&nums.length>=3) {
      q.solutionSteps = 'כלל: (aⁿ)ᵐ = aⁿˣᵐ (חזקה של חזקה → כפלו)\nחישוב: '+nums[1]+' × '+nums[2]+' = '+ans+' ✓';
    } else {
      q.solutionSteps = expr.replace('?',ans)+' ✓';
    }
  } else if(id==='stats') {
    if(q.question.includes('ממוצע')&&nums.length>=2) {
      const sum=nums.map(Number).reduce((a,b)=>a+b,0);
      q.solutionSteps = 'נוסחה: ממוצע = סכום כל הערכים ÷ כמות\nשלב 1: סכום → '+nums.join(' + ')+' = '+sum+'\nשלב 2: '+sum+' ÷ '+nums.length+' = '+ans+' ✓';
    } else if(q.question.includes('חציון')) {
      q.solutionSteps = 'כלל: חציון = הערך האמצעי (אחרי מיון מקטן לגדול)\nסדרו: '+nums.map(Number).sort((a,b)=>a-b).join(', ')+'\nהאמצעי: '+ans+' ✓';
    } else if(q.question.includes('שכיח')) {
      q.solutionSteps = 'כלל: שכיח = הערך שמופיע הכי הרבה פעמים\nתשובה: '+ans+' ✓';
    }
  } else if(id==='quadratic') {
    if(q.question.includes('x²')&&q.question.includes('חיובי')&&nums.length>=1) {
      q.solutionSteps = 'כלל: x² = k → x = √k\nחישוב: x = √'+nums[0]+' = '+ans+' ✓';
    } else if(q.question.includes('הגדול')&&nums.length>=3) {
      const b=nums[1],c=nums[2];
      q.solutionSteps = 'כלל: פירוק — מצאו שני מספרים שסכומם '+b+' ומכפלתם '+c+'\nנוסחה: x² − '+b+'x + '+c+' = (x−?)(x−?) = 0\nהפתרון הגדול: x = '+ans+' ✓';
    } else if(q.question.includes('סכום')) {
      q.solutionSteps = 'כלל (ויאטה): סכום הפתרונות = −b/a\nבמשוואה ax²+bx+c=0, סכום השורשים = '+ans+' ✓';
    } else {
      q.solutionSteps = 'נוסחה: x = (−b ± √Δ) / 2a\nתשובה: '+q.correct+' ✓';
    }
  } else if(id==='parabola') {
    if(q.question.includes('סימטריה')&&nums.length>=1) {
      q.solutionSteps = 'נוסחה: ציר סימטריה = −b/(2a)\nחישוב: x = '+ans+' ✓';
    } else if(q.question.includes('y כאשר')&&nums.length>=3) {
      const k=nums[nums.length-1];
      q.solutionSteps = 'כלל: הציבו x='+k+' בפונקציה\ny = ('+k+')² + ... = '+ans+' ✓';
    } else if(q.question.includes('פונה')) {
      q.solutionSteps = 'כלל: a > 0 → פרבולה פונה למעלה (חיוך 😊)\na < 0 → פרבולה פונה למטה (עצב 😞)\nתשובה: '+q.correct+' ✓';
    } else {
      q.solutionSteps = 'נוסחה: y = ax² + bx + c\nתשובה: '+q.correct+' ✓';
    }
  } else if(id==='trig') {
    if(q.question.includes('sin(')||q.question.includes('cos(')||q.question.includes('tan(')) {
      q.solutionSteps = 'ערכים לזכור:\nsin(30°)=0.5  cos(30°)=0.866  tan(30°)=0.577\nsin(45°)=0.707 cos(45°)=0.707 tan(45°)=1\nsin(60°)=0.866 cos(60°)=0.5  tan(60°)=1.732\nתשובה: '+q.correct+' ✓';
    } else if(q.question.includes('שמול')&&nums.length>=2) {
      q.solutionSteps = 'נוסחה: ניצב שמול = יתר × sin(זווית)\nחישוב: '+nums[0]+' × sin('+nums[1]+'°) = '+ans+' ✓';
    } else if(q.question.includes('שליד')&&nums.length>=2) {
      q.solutionSteps = 'נוסחה: ניצב שליד = יתר × cos(זווית)\nחישוב: '+nums[0]+' × cos('+nums[1]+'°) = '+ans+' ✓';
    } else if(q.question.includes('הזווית')) {
      q.solutionSteps = 'כלל: sin(α) = ניצב שמול ÷ יתר\nמצאו את הזווית מטבלת הערכים\nתשובה: '+q.correct+' ✓';
    } else {
      q.solutionSteps = 'sin=נגד÷יתר, cos=ליד÷יתר, tan=נגד÷ליד\nתשובה: '+q.correct+' ✓';
    }
  } else if(id==='sequences') {
    if(q.question.includes('האיבר הבא')&&nums.length>=3) {
      const d=Number(nums[1])-Number(nums[0]);
      q.solutionSteps = 'כלל: בסדרה חשבונית ההפרש (d) קבוע\nשלב 1: מצאו d → '+nums[1]+' − '+nums[0]+' = '+d+'\nשלב 2: האיבר הבא → '+nums[2]+' + '+d+' = '+ans+' ✓';
    } else if(q.question.includes('a₁')&&q.question.includes('d=')&&nums.length>=3) {
      const a1=nums[0],d=nums[1],n=nums[2];
      if(q.question.includes('סכום')) {
        q.solutionSteps = 'נוסחה: S = n×(2a₁ + (n−1)×d) ÷ 2\nשלב 1: הציבו a₁='+a1+', d='+d+', n='+n+'\nשלב 2: S = '+ans+' ✓';
      } else {
        q.solutionSteps = 'נוסחה: aₙ = a₁ + (n−1)×d\nשלב 1: הציבו a₁='+a1+', d='+d+', n='+n+'\nשלב 2: '+a1+' + ('+(Number(n)-1)+')×'+d+' = '+a1+' + '+(Number(n)-1)*Number(d)+' = '+ans+' ✓';
      }
    } else {
      q.solutionSteps = 'נוסחה: aₙ = a₁ + (n−1)×d\nתשובה: '+q.correct+' ✓';
    }
  } else if(id==='probability') {
    if(q.question.includes('קובייה')&&q.question.includes('זוגי')) {
      q.solutionSteps = 'כלל: P = רצויים ÷ כולם\nזוגיים בקובייה: 2, 4, 6 → 3 מתוך 6\nP = 3/6 = '+q.correct+' ✓';
    } else if(q.question.includes('קובייה')) {
      q.solutionSteps = 'כלל: P = רצויים ÷ כולם\nבקובייה 6 תוצאות אפשריות\nP = 1/6 = '+q.correct+' ✓';
    } else if(q.question.includes('מטבע')) {
      q.solutionSteps = 'כלל: P = רצויים ÷ כולם\nבמטבע 2 תוצאות: עץ או פלי\nP = 1/2 = '+q.correct+' ✓';
    } else if(q.question.includes('שקית')&&nums.length>=2) {
      q.solutionSteps = 'כלל: P = רצויים ÷ כולם\nP = '+nums[1]+' ÷ '+nums[0]+' = '+q.correct+' ✓';
    } else if(q.question.includes('לא ירד')) {
      q.solutionSteps = 'כלל: P(לא A) = 1 − P(A) = 100% − P(A)\nחישוב: 100% − '+nums[0]+'% = '+q.correct+' ✓';
    } else {
      q.solutionSteps = 'כלל: P = רצויים ÷ כולם\nתשובה: '+q.correct+' ✓';
    }
  }
  if(!q.solutionSteps) q.solutionSteps = q.question.replace(/\n/g,' ')+' = '+q.correct+' ✓';
  }
  return q;
};

// ── LocalStorage helpers ─────────────────────
const loadBoard = () => {
  try { return JSON.parse(localStorage.getItem('math-blitz-lb')) || []; }
  catch { return []; }
};
const persistBoard = (b) => {
  try { localStorage.setItem('math-blitz-lb', JSON.stringify(b)); } catch {}
};

// ── Percentile Calculator (simulated distribution) ─
const getPercentile = (score) => {
  // Realistic distribution: most players score 50-200, good ones 300-600, great ones 800+
  if(score <= 0) return 5;
  // Sigmoid-like mapping for realistic feel
  const x = score / 400; // normalize
  const p = Math.round(100 / (1 + Math.exp(-2.5 * (x - 0.8))));
  return Math.max(5, Math.min(99, p));
};

const getPercentileMsg = (pct) => {
  if(pct >= 95) return { text: 'אתה בטופ 5%! אלוף מתמטיקה! 👑', color: '#fbbf24' };
  if(pct >= 85) return { text: 'חכם יותר מ-'+pct+'% מהשחקנים! 🧠', color: '#00ff88' };
  if(pct >= 70) return { text: 'טוב יותר מ-'+pct+'% מהשחקנים! 💪', color: '#00e5ff' };
  if(pct >= 50) return { text: 'עברת את ה-'+pct+'% מהשחקנים! 📈', color: '#ffaa00' };
  return { text: 'כל משחק משפר אותך! 🚀', color: '#ff0080' };
};

// ── Daily Streak System ─────────────────────
const loadDailyStreak = () => {
  try {
    const raw = localStorage.getItem('math-blitz-streak');
    if(!raw) return { current: 0, longest: 0, lastDate: null };
    return JSON.parse(raw);
  } catch { return { current: 0, longest: 0, lastDate: null }; }
};

const updateDailyStreak = () => {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const s = loadDailyStreak();
  if(s.lastDate === today) return s; // already played today
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  let newCurrent;
  if(s.lastDate === yesterday) {
    newCurrent = s.current + 1; // streak continues!
  } else {
    newCurrent = 1; // streak broken or first time
  }
  const newLongest = Math.max(s.longest, newCurrent);
  const result = { current: newCurrent, longest: newLongest, lastDate: today };
  try { localStorage.setItem('math-blitz-streak', JSON.stringify(result)); } catch {}
  return result;
};

const getStreakStatus = () => {
  const s = loadDailyStreak();
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if(s.lastDate === today) return { ...s, playedToday: true, atRisk: false };
  if(s.lastDate === yesterday) return { ...s, playedToday: false, atRisk: true }; // streak at risk!
  return { current: 0, longest: s.longest, lastDate: s.lastDate, playedToday: false, atRisk: false };
};

// ── Particle / Confetti Explosion ───────────
const playBigCorrect = () => {
  try {
    const c = actx();
    // Sparkle chord: C-E-G-C
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const o = c.createOscillator(), g = c.createGain();
      o.connect(g); g.connect(c.destination); o.type = 'sine';
      o.frequency.setValueAtTime(freq, c.currentTime + i * 0.05);
      g.gain.setValueAtTime(0.12, c.currentTime + i * 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.05 + 0.4);
      o.start(c.currentTime + i * 0.05); o.stop(c.currentTime + i * 0.05 + 0.4);
    });
    if(navigator.vibrate) navigator.vibrate([30, 20, 30]);
  } catch(e){}
};

const spawnParticles = (container, count, colors) => {
  if(!container) return;
  const rect = container.getBoundingClientRect();
  const cx = rect.width / 2, cy = rect.height / 2;
  for(let i = 0; i < count; i++) {
    const p = document.createElement('div');
    const size = 4 + Math.random() * 8;
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const dist = 60 + Math.random() * 120;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const isCircle = Math.random() > 0.4;
    p.style.cssText = `
      position:absolute;left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;
      background:${color};border-radius:${isCircle?'50%':'2px'};pointer-events:none;z-index:100;
      transform:translate(-50%,-50%) rotate(${Math.random()*360}deg);
      box-shadow:0 0 6px ${color};
    `;
    container.appendChild(p);
    const tx = Math.cos(angle) * dist, ty = Math.sin(angle) * dist - 30;
    p.animate([
      { transform: 'translate(-50%,-50%) scale(0)', opacity: 1 },
      { transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(1) rotate(${Math.random()*720}deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(calc(-50% + ${tx*1.2}px), calc(-50% + ${ty + 80}px)) scale(0.3)`, opacity: 0 }
    ], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(0,.7,.3,1)', fill: 'forwards' })
    .onfinish = () => p.remove();
  }
};

// ── Main Component ───────────────────────────
export default function App() {
  const [screen,setScreen] = useState('menu');
  const [score,setScore] = useState(0);
  const [streak,setStreak] = useState(0);
  const [maxStreak,setMaxStreak] = useState(0);
  const [question,setQuestion] = useState(null);
  const [timeLeft,setTimeLeft] = useState(20);
  const [feedback,setFeedback] = useState(null);
  const [selIdx,setSelIdx] = useState(null);
  const [board,setBoard] = useState([]);
  const [isHigh,setIsHigh] = useState(false);
  const [shaking,setShaking] = useState(false);
  const [answered,setAnswered] = useState(0);
  const [combo,setCombo] = useState('');
  const [lives,setLives] = useState(START_LIVES);
  const [breakingHeart,setBreakingHeart] = useState(false);
  const [selectedTopics,setSelectedTopics] = useState(['fractions','orderops','area','powers','ratio']);
  const [invitesUsed,setInvitesUsed] = useState(0);
  const [grade,setGrade] = useState(6);
  const [roundNum,setRoundNum] = useState(1);
  const [roundCorrect,setRoundCorrect] = useState(0);
  const [gainedLife,setGainedLife] = useState(false);
  const [watchingAd,setWatchingAd] = useState(false);
  const [adCountdown,setAdCountdown] = useState(0);
  const [adsUsed,setAdsUsed] = useState(0);
  const [waitingForLife,setWaitingForLife] = useState(false);
  const [waitCountdown,setWaitCountdown] = useState(0);
  const waitIntervalRef = useRef(null);
  const [showInterstitial,setShowInterstitial] = useState(false);
  const [charEmoji,setCharEmoji] = useState('🤓');
  const [charMsg,setCharMsg] = useState('');
  const [charAnim,setCharAnim] = useState('');
  const [hintVisible,setHintVisible] = useState(false);
  const [achToast,setAchToast] = useState(null);
  const [unlockedAch,setUnlockedAch] = useState({});
  const [playerName,setPlayerName] = useState(()=>{ try{const saved=localStorage.getItem('math-blitz-name');return (saved && saved !== DEFAULT_NAME) ? saved : DEFAULT_NAME;}catch{return DEFAULT_NAME;} });
  const [showNameModal,setShowNameModal] = useState(false);
  const [nameModalCallback,setNameModalCallback] = useState(null);
  const nameInputRef = useRef(null);
  const [totalCorrect,setTotalCorrect] = useState(0);
  const [streakMilestone,setStreakMilestone] = useState(null);
  const [showPrize,setShowPrize] = useState(false);
  const [prizePoints,setPrizePoints] = useState(0);
  const [savedGame,setSavedGame] = useState(()=>{ try{const s=localStorage.getItem('math-blitz-save');return s?JSON.parse(s):null;}catch{return null;} });
  const [boostCount,setBoostCount] = useState(0);
  const [freezeCount,setFreezeCount] = useState(1);
  const [activeFreeze,setActiveFreeze] = useState(false);
  const [usedPowerUp,setUsedPowerUp] = useState(false);
  const [invitedContacts,setInvitedContacts] = useState(()=>{ try{return JSON.parse(localStorage.getItem('math-blitz-invited')||'[]');}catch{return [];} });
  const [showFriendTooltip,setShowFriendTooltip] = useState(false);
  const [powerUpGainAnim,setPowerUpGainAnim] = useState(null);
  const [friendPickerOpen,setFriendPickerOpen] = useState(false);
  const [friendError,setFriendError] = useState('');
  const frozenTimeRef = useRef(null);
  const [showResumeModal,setShowResumeModal] = useState(false);
  const [duelMode,setDuelMode] = useState(false);
  const [duelPlayer,setDuelPlayer] = useState(1);
  const [duelName1,setDuelName1] = useState('');
  const [duelName2,setDuelName2] = useState('');
  const [duelScore1,setDuelScore1] = useState(0);
  const [duelQCount] = useState(5);
  const [canInstall,setCanInstall] = useState(false);
  const [showOB,setShowOB] = useState(false);
  const [obStep,setOBStep] = useState(0);
  const [obFromMenu,setObFromMenu] = useState(false);
  const [practiceMode,setPracticeMode] = useState(false);
  const [practiceFeedback,setPracticeFeedback] = useState(null);
  const [practiceSelIdx,setPracticeSelIdx] = useState(null);
  const [practiceDiff,setPracticeDiff] = useState('easy');
  const [practiceCorrectCount,setPracticeCorrectCount] = useState(0);
  const [practiceQCount,setPracticeQCount] = useState(0);
  const [spotlightRect,setSpotlightRect] = useState(null);
  const [showLB,setShowLB] = useState(false);
  const [lbData,setLBData] = useState(null);
  const lbContinueFn = useRef(null);
  const deferredPrompt = useRef(null);

  const gs = useRef({score:0,streak:0,maxStreak:0,wrongStreak:0,diff:'easy',dur:20,answered:0,lives:START_LIVES,invitesUsed:0,roundCorrect:0,adsUsed:0});
  const endTimeRef = useRef(0);
  const rafRef = useRef(null);
  const feedbackTimer = useRef(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    setBoard(loadBoard());
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(feedbackTimer.current); };
  },[]);

  // ── PWA Install Prompt ─────────────────────
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return; // already installed
    const handler = (e) => { e.preventDefault(); deferredPrompt.current = e; setCanInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  },[]);

  const handleInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    if (outcome === 'accepted') { setCanInstall(false); }
    deferredPrompt.current = null;
  };

  // ── Auto-start wait timer on revive screen ───
  useEffect(() => {
    if(screen === 'revive') {
      startWaitTimer();
    } else {
      if(waitIntervalRef.current) { clearInterval(waitIntervalRef.current); waitIntervalRef.current = null; }
      setWaitingForLife(false);
    }
    return () => { if(waitIntervalRef.current) { clearInterval(waitIntervalRef.current); waitIntervalRef.current = null; } };
  },[screen]);

  const saveScore = () => {
    const g = gs.current;
    const entry = {s:g.score,st:g.maxStreak,q:g.answered,r:Math.ceil(g.answered/ROUND_SIZE),d:new Date().toLocaleDateString('he-IL'),id:Date.now(),n:playerName||DEFAULT_NAME};
    const nb = [...board,entry].sort((a,b)=>b.s-a.s).slice(0,10);
    persistBoard(nb);
    setBoard(nb);
    setIsHigh(nb[0]?.id===entry.id);
  };

  const startGame = () => {
    setDuelMode(false);
    gs.current = {score:0,streak:0,maxStreak:0,wrongStreak:0,diff:'easy',dur:20,answered:0,lives:START_LIVES,invitesUsed:0,roundCorrect:0,adsUsed:0,selectedTopics:[...selectedTopics],totalCorrect:0,totalStreak:0,boostCount:0,freezeCount:1,usedPowerUp:false};
    setScore(0); setStreak(0); setMaxStreak(0); setAnswered(0);
    setLives(START_LIVES); setInvitesUsed(0); setAdsUsed(0); setTotalCorrect(0);
    setRoundNum(1); setRoundCorrect(0); setGainedLife(false);
    setBoostCount(0); setFreezeCount(1); setActiveFreeze(false); setUsedPowerUp(false);
    setIsHigh(false); setFeedback(null); setSelIdx(null); setCombo('');
    frozenTimeRef.current = null;
    clearSave();
    setScreen('playing');
    if(obShouldShow()){
      const q = genQuestion('easy', gs.current.selectedTopics);
      setQuestion(q);
      setTimeLeft(15);
      setStreak(2); setCombo('🔥');
      setBoostCount(1); setFreezeCount(1);
      endTimeRef.current = 0;
      cancelAnimationFrame(rafRef.current);
      setObFromMenu(false);
      setOBStep(0);
      requestAnimationFrame(() => { requestAnimationFrame(() => { setShowOB(true); updateSpotlight(0); }); });
    }
    else { nextQ(); }
  };

  const nextQ = () => {
    const q = genQuestion(gs.current.diff, gs.current.selectedTopics);
    setQuestion(q);
    setFeedback(null);
    setSelIdx(null);
    setHintVisible(false);
    setActiveFreeze(false);
    setUsedPowerUp(false);
    gs.current.usedPowerUp = false;
    frozenTimeRef.current = null;
    charReact('think', 0);
    setTimeLeft(gs.current.dur);
    endTimeRef.current = Date.now() + gs.current.dur * 1000;
    lastTickRef.current = Math.ceil(gs.current.dur);
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
      if(frozenTimeRef.current !== null) {
        setTimeLeft(frozenTimeRef.current);
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const rem = Math.max(0,(endTimeRef.current - Date.now())/1000);
      setTimeLeft(rem);
      const sec = Math.ceil(rem);
      if(sec <= 3 && sec !== lastTickRef.current && sec > 0) { playTick(); lastTickRef.current = sec; }
      if(rem <= 0) { handleTimeout(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const loseLife = () => {
    const g = gs.current;
    g.lives--;
    setLives(g.lives);
    setBreakingHeart(true);
    playLifeLost();
    setTimeout(()=>setBreakingHeart(false), 600);
    return g.lives <= 0;
  };

  const handleTimeout = () => {
    cancelAnimationFrame(rafRef.current);
    frozenTimeRef.current = null;
    setFeedback('timeout');
    setShaking(true);
    setTimeout(()=>setShaking(false),400);
    const g = gs.current;
    g.streak = 0; g.totalStreak = 0; g.wrongStreak++; g.answered++;
    if(g.wrongStreak >= 3) {
      g.dur = Math.min(g.dur*1.1,24); g.wrongStreak=0;
      if(g.diff==='hard') g.diff='medium';
      else if(g.diff==='medium') g.diff='easy';
    }
    setStreak(0); setAnswered(g.answered); setCombo('');
    charReact('timeout', 0);
    setHintVisible(false);
    const dead = loseLife();
    if(dead) {
      feedbackTimer.current = setTimeout(() => {
        cancelAnimationFrame(rafRef.current);
        setScreen('revive');
      }, 1200);
    } else if(!checkRoundEnd(1300)) {
      feedbackTimer.current = setTimeout(nextQ, 5000);
    }
  };

  const checkRoundEnd = (delay) => {
    const g = gs.current;
    if(duelMode && checkDuelEnd()) return true;
    if(g.answered % ROUND_SIZE === 0 && g.answered > 0) {
      feedbackTimer.current = setTimeout(() => {
        cancelAnimationFrame(rafRef.current);
        playRoundComplete();
        saveGameState();
        // Show prize box first, then round summary
        const bonus = g.roundCorrect >= 8 ? 50 : g.roundCorrect >= 5 ? 25 : 10;
        showPrizeBox(bonus);
        setTimeout(() => { collectPrize(); setScreen('roundSummary'); if(g.answered === ROUND_SIZE && isDefaultName()) { setTimeout(()=>showDeferredNamePrompt(null), 600); } }, 2000);
      }, delay);
      return true;
    }
    return false;
  };

  const handleAnswer = (idx) => {
    if(feedback) return;
    cancelAnimationFrame(rafRef.current);
    frozenTimeRef.current = null;
    setSelIdx(idx);
    const g = gs.current;
    g.answered++;

    if(idx === question.correctIdx) {
      playCorrect();
      setFeedback('correct');
      const scoreMult = g.usedPowerUp ? POWERUP_SCORE_MULT : 1;
      g.score += Math.max(10, Math.round(timeLeft * 10 * scoreMult));
      g.streak++; g.wrongStreak = 0;
      g.roundCorrect++;
      g.totalCorrect = (g.totalCorrect||0) + 1;
      g.totalStreak = (g.totalStreak||0) + 1;
      if(g.streak > g.maxStreak) g.maxStreak = g.streak;
      g.dur = Math.max(g.dur * 0.95, 10);
      if(g.streak >= 5 && g.diff==='easy') { g.diff='medium'; g.streak=0; }
      else if(g.streak >= 5 && g.diff==='medium') { g.diff='hard'; g.streak=0; }

      // Earn life on streak
      if(g.streak > 0 && g.streak % LIFE_EARN_STREAK === 0 && g.lives < MAX_LIVES) {
        g.lives++;
        setLives(g.lives);
        setGainedLife(true);
        playLifeGain();
        setTimeout(()=>setGainedLife(false), 1200);
      }

      // Award power-ups on totalStreak
      if(g.totalStreak > 0 && g.totalStreak % FREEZE_STREAK === 0 && g.freezeCount < FREEZE_MAX) {
        g.freezeCount++;
        setFreezeCount(g.freezeCount);
        playPowerUpGain();
        setPowerUpGainAnim('freeze');
        setTimeout(()=>setPowerUpGainAnim(null), 1500);
      }
      if(g.totalStreak > 0 && g.totalStreak % BOOST_STREAK === 0 && g.boostCount < BOOST_MAX) {
        g.boostCount++;
        setBoostCount(g.boostCount);
        if(!powerUpGainAnim) { playPowerUpGain(); setPowerUpGainAnim('boost'); setTimeout(()=>setPowerUpGainAnim(null), 1500); }
      }

      charReact('correct', g.streak);
      setHintVisible(false);

      const combos = ['\u{1F525}','\u26A1','\u{1F4A5}','\u{1F680}','\u2728','\u{1F31F}'];
      setCombo(combos[Math.min(g.streak, combos.length-1)] || '\u{1F525}');
      setScore(g.score); setStreak(g.streak); setMaxStreak(g.maxStreak); setAnswered(g.answered); setRoundCorrect(g.roundCorrect); setTotalCorrect(g.totalCorrect);
      checkAchievements({score:g.score,streak:g.streak,totalCorrect:g.totalCorrect,answered:g.answered});
      // Streak milestone popup every 5
      if(g.totalStreak > 0 && g.totalStreak % 5 === 0) {
        feedbackTimer.current = setTimeout(() => {
          cancelAnimationFrame(rafRef.current);
          setStreakMilestone(g.totalStreak);
        }, 800);
      } else if(!checkRoundEnd(800)) {
        feedbackTimer.current = setTimeout(nextQ, 800);
      }
    } else {
      const nearMiss = isNearMiss(question, idx);
      setFeedback(nearMiss ? 'close' : 'wrong');
      charReact(nearMiss ? 'close' : 'wrong', 0);
      setHintVisible(false);
      setShaking(true);
      setTimeout(()=>setShaking(false),400);
      g.streak = 0; g.totalStreak = 0; g.wrongStreak++;
      if(g.wrongStreak >= 3) {
        g.dur = Math.min(g.dur*1.1,24); g.wrongStreak=0;
        if(g.diff==='hard') g.diff='medium';
        else if(g.diff==='medium') g.diff='easy';
      }
      setStreak(0); setAnswered(g.answered); setCombo('');
      const dead = loseLife();
      if(dead) {
        feedbackTimer.current = setTimeout(() => {
          cancelAnimationFrame(rafRef.current);
          setScreen('revive');
        }, 1200);
      } else if(!checkRoundEnd(1300)) {
        feedbackTimer.current = setTimeout(nextQ, 5000);
      }
    }
  };

  const reviveWithPoints = () => {
    const g = gs.current;
    if(g.score >= REVIVE_COST) {
      g.score -= REVIVE_COST;
      g.lives = Math.min(REVIVE_POINTS_LIVES, MAX_LIVES);
      setScore(g.score);
      setLives(g.lives);
      if(waitIntervalRef.current) { clearInterval(waitIntervalRef.current); waitIntervalRef.current = null; }
      setWaitingForLife(false);
      playRevive();
      setScreen('playing');
      nextQ();
    }
  };

  const startWaitTimer = () => {
    if(waitIntervalRef.current) return; // already running
    setWaitingForLife(true);
    setWaitCountdown(REVIVE_WAIT_SECONDS);
    waitIntervalRef.current = setInterval(() => {
      setWaitCountdown(prev => {
        if(prev <= 1) {
          clearInterval(waitIntervalRef.current);
          waitIntervalRef.current = null;
          setWaitingForLife(false);
          const g = gs.current;
          g.lives = 1;
          setLives(1);
          playRevive();
          setScreen('playing');
          nextQ();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const reviveWithInvite = () => {
    const g = gs.current;
    if(g.invitesUsed < REVIVE_INVITE_LIMIT) {
      if(window.gtag) window.gtag('event','share_whatsapp',{event_category:'sharing',event_label:'revive_challenge',score:g.score});
      const txt = '\u05D0\u05EA\u05D2\u05E8! \u05D4\u05E9\u05D2\u05EA\u05D9 '+g.score+' \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA! \u{1F525}\n\u05EA\u05E0\u05E1\u05D4 \u05DC\u05E0\u05E6\u05D7 \u05D0\u05D5\u05EA\u05D9?\n\nhttps://sivanrab-eng.github.io/Math-blitz-app/?v=3';
      window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
      g.invitesUsed++;
      g.lives = 1;
      setInvitesUsed(g.invitesUsed);
      setLives(1);
      playRevive();
      setTimeout(() => {
        setScreen('playing');
        nextQ();
      }, 500);
    }
  };

  const reviveWithAd = () => {
    const g = gs.current;
    if(g.adsUsed < REVIVE_AD_LIMIT) {
      setWatchingAd(true);
      setAdCountdown(AD_WATCH_SECONDS);
      const interval = setInterval(() => {
        setAdCountdown(prev => {
          if(prev <= 1) {
            clearInterval(interval);
            setWatchingAd(false);
            g.adsUsed++;
            g.lives = 1;
            setAdsUsed(g.adsUsed);
            setLives(1);
            playRevive();
            setScreen('playing');
            nextQ();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const showInterstitialAd = (callback) => {
    setShowInterstitial(true);
    setAdCountdown(3);
    const interval = setInterval(() => {
      setAdCountdown(prev => {
        if(prev <= 1) {
          clearInterval(interval);
          setShowInterstitial(false);
          if(callback) callback();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Power-Up Functions ──────────────────────
  const useBoost = () => {
    const g = gs.current;
    if(g.boostCount <= 0 || feedback || g.usedPowerUp) return;
    g.boostCount--;
    g.usedPowerUp = true;
    setBoostCount(g.boostCount);
    setUsedPowerUp(true);
    endTimeRef.current += BOOST_SECONDS * 1000;
    playBoostUse();
  };

  const useFreeze = () => {
    const g = gs.current;
    if(g.freezeCount <= 0 || feedback || g.usedPowerUp) return;
    g.freezeCount--;
    g.usedPowerUp = true;
    setFreezeCount(g.freezeCount);
    setUsedPowerUp(true);
    setActiveFreeze(true);
    frozenTimeRef.current = timeLeft;
    playFreezeUse();
  };

  const inviteFriend = async () => {
    const g = gs.current;
    if(feedback) return;
    // Show tooltip on first use
    const seenTooltip = localStorage.getItem('math-blitz-friend-tooltip');
    if(!seenTooltip) {
      setShowFriendTooltip(true);
      localStorage.setItem('math-blitz-friend-tooltip','1');
      setTimeout(()=>setShowFriendTooltip(false), 3000);
    }
    // Try Contact Picker API
    if('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const contacts = await navigator.contacts.select(['name','tel'], {multiple:false});
        if(contacts && contacts.length > 0) {
          const contact = contacts[0];
          const phone = contact.tel && contact.tel[0] ? contact.tel[0].replace(/[^0-9+]/g,'') : '';
          const name = contact.name && contact.name[0] ? contact.name[0] : 'חבר';
          if(!phone) { setFriendError('לא נמצא מספר טלפון'); setTimeout(()=>setFriendError(''),2500); return; }
          if(invitedContacts.includes(phone)) {
            setFriendError('כבר הזמנת את '+name+'! בחר חבר אחר 😉');
            setTimeout(()=>setFriendError(''),2500);
            return;
          }
          // Success — add contact, add time, open WhatsApp
          const newInvited = [...invitedContacts, phone];
          setInvitedContacts(newInvited);
          try{localStorage.setItem('math-blitz-invited',JSON.stringify(newInvited));}catch{}
          endTimeRef.current += FRIEND_SECONDS * 1000;
          if(frozenTimeRef.current !== null) frozenTimeRef.current += FRIEND_SECONDS;
          playPowerUpGain();
          const pName = playerName || 'חבר';
          const txt = '⚡ '+pName+' מזמין אותך למתמטיקה בלייז! 🧠\n\nמשחק מתמטיקה סופר ממכר — תנסה לנצח אותי!\n\nhttps://sivanrab-eng.github.io/Math-blitz-app/?v=3';
          const cleanPhone = phone.startsWith('+') ? phone.slice(1) : phone;
          window.open('https://wa.me/'+cleanPhone+'?text='+encodeURIComponent(txt),'_blank');
        }
      } catch(e) {
        // Fallback or user cancelled
        fallbackFriendInvite();
      }
    } else {
      // Fallback — open WhatsApp chooser
      fallbackFriendInvite();
    }
  };

  const fallbackFriendInvite = () => {
    const pName = playerName || 'חבר';
    const txt = '⚡ '+pName+' מזמין אותך למתמטיקה בלייז! 🧠\n\nמשחק מתמטיקה סופר ממכר — תנסה לנצח אותי!\n\nhttps://sivanrab-eng.github.io/Math-blitz-app/?v=3';
    window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
    // Since we can't verify the number, still grant the bonus
    endTimeRef.current += FRIEND_SECONDS * 1000;
    if(frozenTimeRef.current !== null) frozenTimeRef.current += FRIEND_SECONDS;
    playPowerUpGain();
  };

  const endGame = () => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(feedbackTimer.current);
    saveScore();
    // Show leaderboard overlay, then game over screen
    showLeaderboardOverlay('סיום משחק', '🏆', () => {
      setScreen('gameover');
    });
  };

  // ── Leaderboard Overlay ─────────────────────
  const showLeaderboardOverlay = (heading, emoji, onContinue) => {
    const g = gs.current;
    const stageIdx = Math.max(0, Math.ceil(g.answered / ROUND_SIZE) - 1);
    const bots = generateBotScores(stageIdx, g.score);
    const all = [...bots];
    all.push({ name: playerName || DEFAULT_NAME, score: g.score, isBot: false, isMe: true });
    all.sort((a, b) => b.score - a.score);
    const myRank = all.findIndex(e => e.isMe);
    const total = Math.max(all.length, getLBPlayerCount());
    addLBPlayer(playerName);
    setLBData({ heading, emoji, all, myRank, myRankDisplay: myRank + 1, total, topScore: all[0].score, playerScore: g.score });
    lbContinueFn.current = onContinue;
    setShowLB(true);
  };

  const closeLB = () => {
    setShowLB(false);
    if(lbContinueFn.current) { const fn = lbContinueFn.current; lbContinueFn.current = null; fn(); }
  };

  const shareDuelFromLB = () => {
    if(window.gtag) window.gtag('event','share_whatsapp',{event_category:'sharing',event_label:'lb_challenge',score:gs.current.score});
    const name = playerName || DEFAULT_NAME;
    const g = gs.current;
    const acc = g.answered > 0 ? Math.round((g.totalCorrect||0)/g.answered*100) : 0;
    const txt = '⚔️ אתגר מתמטי ⚔️\n\n'+name+' השיג '+g.score+' נקודות!\nרצף: '+g.maxStreak+' 🔥 | דיוק: '+acc+'% 🎯\n\nתנסה לנצח אותי? 😏\n\nhttps://sivanrab-eng.github.io/Math-blitz-app/?v=3';
    window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
  };

  const continueNextRound = () => {
    const g = gs.current;
    const currentRound = roundNum;
    g.roundCorrect = 0;
    setRoundCorrect(0);
    setRoundNum(prev => prev + 1);
    setFeedback(null); setSelIdx(null);
    // Show leaderboard overlay first, then continue to next round
    showLeaderboardOverlay('סיבוב ' + currentRound + ' הושלם!', '🏅', () => {
      const nextRound = Math.ceil(g.answered / ROUND_SIZE) + 1;
      if(nextRound % 2 === 0) {
        showInterstitialAd(() => { setScreen('playing'); nextQ(); });
      } else {
        setScreen('playing');
        nextQ();
      }
    });
  };

  const _doShareWhatsApp = () => {
    if(window.gtag) window.gtag('event','share_whatsapp',{event_category:'sharing',event_label:'game_over_challenge',score:gs.current.score});
    const g = gs.current;
    const name = playerName || DEFAULT_NAME;
    const acc = g.answered > 0 ? Math.round((g.totalCorrect||0)/g.answered*100) : 0;
    const stars = acc >= 90 ? '⭐⭐⭐' : acc >= 70 ? '⭐⭐' : '⭐';
    const txt = '\u26CF\uFE0F \u05D0\u05EA\u05D2\u05E8 \u05DE\u05EA\u05DE\u05D8\u05D9 \u26CF\uFE0F\n\n'+name+' \u05D4\u05E9\u05D9\u05D2 '+g.score+' \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA! '+stars+'\n\u05E8\u05E6\u05E3: '+g.maxStreak+' \u{1F525} | \u05D3\u05D9\u05D5\u05E7: '+acc+'% \u{1F3AF}\n\n\u05EA\u05E0\u05E1\u05D4 \u05DC\u05E0\u05E6\u05D7 \u05D0\u05D5\u05EA\u05D9? \u{1F60F}\n\nhttps://sivanrab-eng.github.io/Math-blitz-app/?v=3';
    window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
  };
  const shareWhatsApp = () => {
    if(isDefaultName()) { showDeferredNamePrompt(_doShareWhatsApp); return; }
    _doShareWhatsApp();
  };

  const _doShareStreak = (num) => {
    if(window.gtag) window.gtag('event','share_whatsapp',{event_category:'sharing',event_label:'streak_share',streak:num});
    const name = playerName || DEFAULT_NAME;
    const emojis = {5:'\u{1F525}',10:'\u26A1',15:'\u{1F4A5}',20:'\u{1F680}',25:'\u{1F31F}'};
    const e = emojis[num] || '\u{1F525}';
    const txt = e+' '+name+' \u05E2\u05E9\u05D4 '+num+' \u05EA\u05E9\u05D5\u05D1\u05D5\u05EA \u05E0\u05DB\u05D5\u05E0\u05D5\u05EA \u05D1\u05E8\u05E6\u05E3! '+e+'\n\n\u05D7\u05D5\u05E9\u05D1 \u05E9\u05EA\u05D5\u05DB\u05DC \u05DC\u05E2\u05E7\u05D5\u05E3 \u05D0\u05D5\u05EA\u05D9 \u{1F609}?\n\n\u05E9\u05D7\u05E7 \u05E2\u05DB\u05E9\u05D9\u05D5:\nhttps://sivanrab-eng.github.io/Math-blitz-app/?v=3';
    window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
  };
  const shareStreakWhatsApp = (num) => {
    if(isDefaultName()) { showDeferredNamePrompt(()=>_doShareStreak(num)); return; }
    _doShareStreak(num);
  };

  const shareMenuWhatsApp = () => {
    if(window.gtag) window.gtag('event','share_whatsapp',{event_category:'sharing',event_label:'menu_invite'});
    const txt = 'https://sivanrab-eng.github.io/Math-blitz-app/?v=3';
    window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
  };

  const changeGrade = (g) => {
    setGrade(g);
    const gradeTopics = GRADES[g].topics;
    setSelectedTopics([...gradeTopics]);
  };

  // ── Character Helpers ────────────────────
  const charTimerRef = useRef(null);
  const charReact = (type, streak) => {
    clearTimeout(charTimerRef.current);
    let emoji, msg;
    if(type==='correct') {
      if(streak>=5) { const i=randInt(0,CHAR_STREAK.length-1); emoji=CHAR_STREAK[i]; msg=CHAR_STREAK_MSG[i]; }
      else { const i=randInt(0,CHAR_OK.length-1); emoji=CHAR_OK[i]; msg=CHAR_OK_MSG[i]; }
    } else if(type==='close') {
      emoji='😬'; msg=CHAR_CLOSE_MSG;
    } else if(type==='wrong') {
      const i=randInt(0,CHAR_BAD.length-1); emoji=CHAR_BAD[i]; msg=CHAR_BAD_MSG[i];
    } else if(type==='timeout') {
      emoji='😱'; msg='!נגמר הזמן';
    } else { emoji='🤔'; msg=''; }
    setCharEmoji(emoji);
    setCharMsg(msg);
    setCharAnim(type==='correct'?'char-bounce':type==='wrong'||type==='close'||type==='timeout'?'char-sad':'char-think');
    if(msg) { charTimerRef.current = setTimeout(()=>setCharMsg(''), 2200); }
  };

  // ── Near Miss Detection ──────────────────
  const isNearMiss = (q, chosenIdx) => {
    const correctVal = parseFloat(String(q.correct).replace(/[^\d.\-]/g,''));
    const chosenVal = parseFloat(String(q.options[chosenIdx]).replace(/[^\d.\-]/g,''));
    if(isNaN(correctVal)||isNaN(chosenVal)) return false;
    return Math.abs(correctVal-chosenVal) <= Math.max(1, correctVal*0.15);
  };

  // ── Achievement Checker ──────────────────
  const checkAchievements = (stats) => {
    ACH_DEFS.forEach(a => {
      if(!unlockedAch[a.id] && a.check(stats)) {
        setUnlockedAch(prev => ({...prev, [a.id]:true}));
        setAchToast({icon:a.icon, text:a.text});
        setTimeout(()=>setAchToast(null), 3000);
      }
    });
  };

  // ── Onboarding ──────────────────────────
  const obShouldShow = () => { try { return !localStorage.getItem('blitz-onboarding-done'); } catch { return true; } };
  const obMarkDone = () => { try { localStorage.setItem('blitz-onboarding-done','1'); } catch {} };

  // ── Hint Toggle ──────────────────────────
  const toggleHint = () => {
    if(feedback) return;
    setHintVisible(prev => !prev);
    if(!hintVisible) setTimeout(()=>setHintVisible(false), 4000);
  };

  // ── Practice Mode ───────────────────────
  const startPractice = () => {
    if(selectedTopics.length === 0) return;
    setPracticeMode(true);
    setPracticeFeedback(null);
    setPracticeSelIdx(null);
    setPracticeDiff('easy');
    setPracticeCorrectCount(0);
    setPracticeQCount(0);
    const q = genQuestion('easy', selectedTopics);
    setQuestion(q);
    setScreen('practice');
  };

  const nextPracticeQ = () => {
    let diff = practiceDiff;
    const cnt = practiceCorrectCount;
    if(cnt >= 10 && diff !== 'hard') diff = 'hard';
    else if(cnt >= 5 && diff === 'easy') diff = 'medium';
    setPracticeDiff(diff);
    const q = genQuestion(diff, selectedTopics);
    setQuestion(q);
    setPracticeFeedback(null);
    setPracticeSelIdx(null);
    setPracticeQCount(prev => prev + 1);
  };

  const handlePracticeAnswer = (idx) => {
    if(practiceFeedback) return;
    setPracticeSelIdx(idx);
    if(idx === question.correctIdx) {
      setPracticeFeedback('correct');
      setPracticeCorrectCount(prev => prev + 1);
      playCorrect();
    } else {
      setPracticeFeedback('wrong');
      try { navigator.vibrate?.(100); } catch{}
    }
  };

  const revealPracticeSolution = () => {
    if(practiceFeedback) return;
    setPracticeFeedback('revealed');
  };

  const exitPractice = () => {
    setPracticeMode(false);
    setQuestion(null);
    setScreen('menu');
  };

  // ── Spotlight Tutorial ──────────────────
  const OB_SPOTLIGHT_STEPS = [
    { targetId:'hud-lives', emoji:'❤️', title:'חיים', text:'מתחילים עם 3 חיים. נגמרו לך החיים? תאלץ להמתין דקה.\nלא רוצה לחכות: אפשר לקנות בנקודות או להזמין חבר!' },
    { targetId:'hud-score', emoji:'🏆', title:'ניקוד', text:'ככל שעונים מהר יותר — מרוויחים יותר נקודות!\nמינימום 10 נקודות לתשובה נכונה.' },
    { targetId:'hud-streak', emoji:'🔥', title:'קומבו', text:'רצף תשובות נכונות = מכפיל קומבו!\nככל שהרצף גדל, האימוג׳ים משתדרגים.' },
    { targetId:'hud-timer', emoji:'⏱️', title:'טיימר', text:'20 שניות לכל שאלה. עונים נכון?\nהטיימר מתקצר! עד מינימום 3 שניות.' },
    { targetId:'hud-powerups', emoji:'⚡', title:'כוחות מיוחדים', text:'SOS מסנן תשובות, ברק מדלג על שאלה,\nהקפאה עוצרת את הטיימר.' },
    { targetId:'hud-hint', emoji:'💡', title:'רמז', text:'תקועים? לחצו על 💡 וקבלו רמז!\nעובד על כל נושא — שברים, שטחים, חזקות ועוד.\nהרמז לא עולה נקודות.' },
  ];

  const startSpotlightTutorial = () => {
    // Set up a dummy game state so the playing screen renders
    gs.current = {score:0,streak:0,maxStreak:0,wrongStreak:0,diff:'easy',dur:20,answered:0,lives:START_LIVES,invitesUsed:0,roundCorrect:0,adsUsed:0,selectedTopics:[...selectedTopics],totalCorrect:0,totalStreak:0,boostCount:0,freezeCount:1,usedPowerUp:false};
    setScore(0); setStreak(2); setMaxStreak(0); setAnswered(0);
    setLives(START_LIVES); setInvitesUsed(0); setAdsUsed(0); setTotalCorrect(0);
    setRoundNum(1); setRoundCorrect(0); setGainedLife(false);
    setBoostCount(1); setFreezeCount(1); setActiveFreeze(false); setUsedPowerUp(false);
    setIsHigh(false); setFeedback(null); setSelIdx(null); setCombo('🔥');
    frozenTimeRef.current = null;
    const q = genQuestion('easy', selectedTopics.length > 0 ? selectedTopics : ['fractions']);
    setQuestion(q);
    setTimeLeft(15);
    endTimeRef.current = 0; // don't let timer tick
    cancelAnimationFrame(rafRef.current);
    setScreen('playing');
    setObFromMenu(true);
    setOBStep(0);
    // Wait for DOM to render, then show spotlight
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setShowOB(true);
        updateSpotlight(0);
      });
    });
  };

  const updateSpotlight = (stepIdx) => {
    const step = OB_SPOTLIGHT_STEPS[stepIdx];
    if(!step || !step.targetId) { setSpotlightRect(null); return; }
    const el = document.getElementById(step.targetId);
    if(el) {
      const r = el.getBoundingClientRect();
      // Larger padding for small elements (hint button etc.)
      const pad = (r.width < 60 || r.height < 60) ? 14 : 8;
      const sw = Math.max(r.width + pad*2, 64);
      const sh = Math.max(r.height + pad*2, 64);
      setSpotlightRect({
        x: r.left + r.width/2 - sw/2,
        y: r.top + r.height/2 - sh/2,
        w: sw, h: sh
      });
    } else {
      setSpotlightRect(null);
    }
  };

  const obNext = () => {
    if(obStep < OB_SPOTLIGHT_STEPS.length-1) {
      const next = obStep+1;
      setOBStep(next);
      updateSpotlight(next);
    } else {
      setShowOB(false);
      obMarkDone();
      setSpotlightRect(null);
      if(obFromMenu) {
        setObFromMenu(false);
        setScreen('menu');
        setQuestion(null);
        cancelAnimationFrame(rafRef.current);
      } else {
        // Reset demo values from tutorial
        setStreak(0); setCombo(''); setBoostCount(0); setFreezeCount(1);
        gs.current.streak=0; gs.current.boostCount=0; gs.current.freezeCount=1;
        setObFromMenu(false);
        nextQ();
      }
    }
  };
  const obSkip = () => {
    setShowOB(false);
    obMarkDone();
    setSpotlightRect(null);
    if(obFromMenu) {
      setObFromMenu(false);
      setScreen('menu');
      setQuestion(null);
      cancelAnimationFrame(rafRef.current);
    } else {
      // Reset demo values from tutorial
      setStreak(0); setCombo(''); setBoostCount(0); setFreezeCount(1);
      gs.current.streak=0; gs.current.boostCount=0; gs.current.freezeCount=1;
      setObFromMenu(false);
      nextQ();
    }
  };
  const obPrev = () => {
    if(obStep > 0) {
      const prev = obStep - 1;
      setOBStep(prev);
      updateSpotlight(prev);
    }
  };

  // ── Name Prompt (Deferred) ────────────────────────────
  const saveName = (name) => {
    setPlayerName(name);
    try { localStorage.setItem('math-blitz-name', name); } catch{}
    addLBPlayer(name);
  };

  const isDefaultName = () => !playerName || playerName === DEFAULT_NAME;

  const showDeferredNamePrompt = (callback) => {
    if(!isDefaultName()) { if(callback) callback(); return; }
    setNameModalCallback(()=>callback);
    setShowNameModal(true);
    setTimeout(()=>{ if(nameInputRef.current) nameInputRef.current.focus(); }, 300);
  };

  const confirmNamePrompt = (inputVal) => {
    const n = (inputVal||'').trim();
    if(!n) return false;
    saveName(n);
    setShowNameModal(false);
    if(nameModalCallback) { const fn = nameModalCallback; setNameModalCallback(null); fn(); }
    return true;
  };

  const skipNamePrompt = () => {
    setShowNameModal(false);
    if(nameModalCallback) { const fn = nameModalCallback; setNameModalCallback(null); fn(); }
  };

  // ── Save / Resume Progress ───────────────
  const saveGameState = () => {
    const g = gs.current;
    const state = {score:g.score,streak:g.streak,maxStreak:g.maxStreak,diff:g.diff,dur:g.dur,answered:g.answered,
      lives:g.lives,roundCorrect:g.roundCorrect,totalCorrect:g.totalCorrect||0,
      boostCount:g.boostCount||0,freezeCount:g.freezeCount||0,
      grade,selectedTopics:[...g.selectedTopics],roundNum,timestamp:Date.now()};
    try{localStorage.setItem('math-blitz-save',JSON.stringify(state));}catch{}
    setSavedGame(state);
  };

  const resumeGame = () => {
    if(!savedGame) return;
    const s = savedGame;
    gs.current = {score:s.score,streak:s.streak,maxStreak:s.maxStreak,wrongStreak:0,diff:s.diff,dur:s.dur,
      answered:s.answered,lives:s.lives,invitesUsed:0,roundCorrect:s.roundCorrect,adsUsed:0,
      selectedTopics:s.selectedTopics,totalCorrect:s.totalCorrect||0,totalStreak:s.streak||0,
      boostCount:s.boostCount||0,freezeCount:s.freezeCount||0,usedPowerUp:false};
    setScore(s.score); setStreak(s.streak); setMaxStreak(s.maxStreak); setAnswered(s.answered);
    setLives(s.lives); setRoundNum(s.roundNum||1); setRoundCorrect(s.roundCorrect);
    setBoostCount(s.boostCount||0); setFreezeCount(s.freezeCount||0);
    setTotalCorrect(s.totalCorrect||0); setGrade(s.grade||6);
    setSelectedTopics(s.selectedTopics);
    setIsHigh(false); setFeedback(null); setSelIdx(null); setCombo('');
    setScreen('playing');
    nextQ();
    try{localStorage.removeItem('math-blitz-save');}catch{}
    setSavedGame(null);
  };

  const clearSave = () => {
    try{localStorage.removeItem('math-blitz-save');}catch{}
    setSavedGame(null);
  };

  // ── Prize Box ────────────────────────────
  const showPrizeBox = (bonus) => {
    setPrizePoints(bonus);
    setShowPrize(true);
  };

  const collectPrize = () => {
    const g = gs.current;
    g.score += prizePoints;
    setScore(g.score);
    setShowPrize(false);
  };

  // ── Duel Mode ────────────────────────────
  const startDuel = () => {
    if(!duelName1.trim() || !duelName2.trim()) return;
    setDuelMode(true);
    setDuelPlayer(1);
    setDuelScore1(0);
    gs.current = {score:0,streak:0,maxStreak:0,wrongStreak:0,diff:'easy',dur:20,answered:0,
      lives:99,invitesUsed:0,roundCorrect:0,adsUsed:0,selectedTopics:[...selectedTopics],totalCorrect:0,totalStreak:0};
    setScore(0); setStreak(0); setMaxStreak(0); setAnswered(0); setLives(99);
    setTotalCorrect(0); setFeedback(null); setSelIdx(null); setCombo('');
    setScreen('playing');
    nextQ();
  };

  const checkDuelEnd = () => {
    const g = gs.current;
    if(g.answered >= duelQCount) {
      if(duelPlayer === 1) {
        setDuelScore1(g.score);
        setDuelPlayer(2);
        setScreen('duelSwitch');
        return true;
      } else {
        setScreen('duelResult');
        return true;
      }
    }
    return false;
  };

  const startDuelPlayer2 = () => {
    gs.current = {score:0,streak:0,maxStreak:0,wrongStreak:0,diff:'easy',dur:20,answered:0,
      lives:99,invitesUsed:0,roundCorrect:0,adsUsed:0,selectedTopics:[...selectedTopics],totalCorrect:0,totalStreak:0};
    setScore(0); setStreak(0); setMaxStreak(0); setAnswered(0); setLives(99);
    setTotalCorrect(0); setFeedback(null); setSelIdx(null); setCombo('');
    setScreen('playing');
    nextQ();
  };

  const toggleTopic = (id) => {
    setSelectedTopics(prev => {
      if(prev.includes(id)) {
        if(prev.length <= 1) return prev;
        return prev.filter(t=>t!==id);
      }
      return [...prev, id];
    });
  };

  const timerFrac = question ? timeLeft / gs.current.dur : 1;
  const timerColor = timerFrac > 0.5 ? '#00e5ff' : timerFrac > 0.25 ? '#ffaa00' : '#ff0080';
  const livesDisplay = Math.max(lives, 0);

  return (
    <div dir="rtl" style={{fontFamily:"'Heebo',sans-serif"}}
      className={`min-h-[100svh] bg-[#050510] text-white overflow-hidden relative ${shaking?'animate-shake':''}`}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
        @keyframes popIn{0%{transform:scale(0.7);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        @keyframes slideUp{0%{transform:translateY(30px);opacity:0}100%{transform:translateY(0);opacity:1}}
        @keyframes correctFlash{0%{box-shadow:0 0 0 rgba(0,229,255,0)}50%{box-shadow:0 0 40px rgba(0,229,255,0.6)}100%{box-shadow:0 0 15px rgba(0,229,255,0.3)}}
        @keyframes wrongFlash{0%{box-shadow:0 0 0 rgba(255,0,128,0)}50%{box-shadow:0 0 40px rgba(255,0,128,0.6)}100%{box-shadow:0 0 15px rgba(255,0,128,0.3)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes gridMove{0%{background-position:0 0}100%{background-position:50px 50px}}
        @keyframes heartBreak{0%{transform:scale(1)}30%{transform:scale(1.4)}60%{transform:scale(0.8)}100%{transform:scale(1)}}
        @keyframes revivePulse{0%,100%{box-shadow:0 0 15px rgba(0,229,255,0.3)}50%{box-shadow:0 0 35px rgba(0,229,255,0.6)}}
        @keyframes lifeGain{0%{transform:scale(0.5);opacity:0}40%{transform:scale(1.5)}70%{transform:scale(0.9)}100%{transform:scale(1);opacity:1}}
        @keyframes deadPulse{0%,100%{opacity:0.6}50%{opacity:1}}
        .animate-shake{animation:shake 0.4s ease}
        .pop-in{animation:popIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both}
        .slide-up{animation:slideUp 0.4s ease both}
        .btn-option{transition:all 0.15s ease;transform:scale(1);-webkit-tap-highlight-color:transparent;cursor:pointer}
        .btn-option:active{transform:scale(0.95)}
        .correct-anim{animation:correctFlash 0.5s ease}
        .wrong-anim{animation:wrongFlash 0.5s ease}
        .float-anim{animation:float 3s ease-in-out infinite}
        .glow-cyan{text-shadow:0 0 10px #00e5ff,0 0 30px rgba(0,229,255,0.3)}
        .glow-pink{text-shadow:0 0 10px #ff0080,0 0 30px rgba(255,0,128,0.3)}
        .glow-box-cyan{box-shadow:0 0 15px rgba(0,229,255,0.3),inset 0 0 15px rgba(0,229,255,0.05)}
        .glow-box-pink{box-shadow:0 0 15px rgba(255,0,128,0.3),inset 0 0 15px rgba(255,0,128,0.05)}
        .grid-bg{background-image:linear-gradient(rgba(0,229,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,0.03) 1px,transparent 1px);background-size:50px 50px;animation:gridMove 8s linear infinite}
        .heart-break{animation:heartBreak 0.5s ease}
        .life-gain{animation:lifeGain 0.6s ease}
        .revive-pulse{animation:revivePulse 1.5s ease infinite}
        .dead-pulse{animation:deadPulse 1.2s ease infinite}
        .topic-chip{transition:all 0.2s ease;-webkit-tap-highlight-color:transparent}
        .topic-chip:active{transform:scale(0.95)}
        @keyframes charBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes charSad{0%{transform:rotate(0)}30%{transform:rotate(-8deg)}60%{transform:rotate(8deg)}100%{transform:rotate(0)}}
        @keyframes charThinkAnim{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-5px) rotate(3deg)}}
        .char-bounce{animation:charBounce 0.4s ease}
        .char-sad{animation:charSad 0.5s ease}
        .char-think{animation:charThinkAnim 2s ease infinite}
        @keyframes achSlide{0%{transform:translateX(-50%) translateY(-80px);opacity:0}15%{transform:translateX(-50%) translateY(0);opacity:1}85%{transform:translateX(-50%) translateY(0);opacity:1}100%{transform:translateX(-50%) translateY(-80px);opacity:0}}
        .ach-toast{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:500;display:flex;align-items:center;gap:8px;padding:10px 20px;border-radius:20px;background:linear-gradient(135deg,rgba(124,58,237,0.9),rgba(76,29,149,0.9));border:2px solid #a78bfa;color:#fff;font-weight:800;font-size:14px;box-shadow:0 8px 24px rgba(124,58,237,0.5);animation:achSlide 3s ease forwards;white-space:nowrap}
        /* starfield removed */
        /* clean buttons - no 3D */
        @keyframes prizeFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes prizeIn{0%{transform:scale(0) rotate(-10deg);opacity:0}100%{transform:scale(1) rotate(0);opacity:1}}
        @keyframes installPulse{0%,100%{box-shadow:0 0 18px rgba(0,255,136,0.35), inset 0 0 12px rgba(0,255,136,0.08)}50%{box-shadow:0 0 30px rgba(0,255,136,0.6), inset 0 0 20px rgba(0,255,136,0.15)}}
        .install-pulse{animation:installPulse 1.8s ease-in-out infinite}
        .prize-box{animation:prizeFloat 2s ease-in-out infinite}
        .prize-appear{animation:prizeIn 0.5s cubic-bezier(0.175,0.885,0.32,1.275)}
        @keyframes freezePulse{0%,100%{box-shadow:0 0 15px rgba(125,211,252,0.3)}50%{box-shadow:0 0 35px rgba(125,211,252,0.6)}}
        .freeze-active{animation:freezePulse 1s ease infinite}
        .hint-bubble{position:absolute;bottom:100%;right:0;left:0;margin-bottom:8px;padding:10px 14px;border-radius:14px;background:rgba(26,10,62,0.95);border:2px solid #fbbf24;color:#fef3c7;font-size:13px;font-weight:700;line-height:1.5;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,0.4);z-index:20}
        .explain-box{margin-top:8px;padding:10px 14px;border-radius:14px;background:rgba(255,255,255,0.06);border:1.5px solid rgba(255,255,255,0.15);text-align:right}
        .explain-title{font-size:11px;color:#a78bfa;font-weight:800;margin-bottom:4px}
        .explain-formula{margin-top:6px;padding:6px 10px;border-radius:10px;background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.3);font-size:12px;font-weight:800;color:#c4b5fd;text-align:center}
        @keyframes lbIconPop{0%{transform:scale(0)}100%{transform:scale(1)}}
        @keyframes lbRowSlide{0%{opacity:0;transform:translateX(20px)}100%{opacity:1;transform:translateX(0)}}
        @keyframes lbShimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        .lb-icon-pop{animation:lbIconPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275)}
        .lb-row-slide{animation:lbRowSlide 0.35s ease both}
        .lb-shimmer{background:linear-gradient(90deg,#fbbf24,#f59e0b,#fbbf24,#f59e0b);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:lbShimmer 3s linear infinite}
      `}</style>

      <div className="grid-bg fixed inset-0 pointer-events-none"/>
      <div className="fixed top-0 left-0 right-0 h-40 pointer-events-none" style={{background:'radial-gradient(ellipse at 50% 0%,rgba(0,229,255,0.08) 0%,transparent 70%)'}}/>
      <div className="fixed bottom-0 left-0 right-0 h-40 pointer-events-none" style={{background:'radial-gradient(ellipse at 50% 100%,rgba(255,0,128,0.06) 0%,transparent 70%)'}}/>

      <div className="relative z-10 min-h-[100svh] flex flex-col">

        {/* ── MENU ──────────────────────── */}
        {screen === 'menu' && (
          <div className="flex-1 flex flex-col items-center justify-center px-5 gap-4 py-6">
            <div className="pop-in text-center">
              <h1 style={{fontFamily:"'Orbitron',sans-serif"}} className="text-4xl font-black glow-cyan tracking-wider mb-1">
                MATH BLITZ
              </h1>
              <p className="text-lg font-bold glow-pink" style={{color:'#ff0080'}}>מתמטיקה בלייז</p>
            </div>
            <div className="float-anim" style={{fontSize:'3rem',lineHeight:1}}>🧠</div>

            {/* Grade Selection */}
            <div className="w-full max-w-xs slide-up" style={{animationDelay:'0.03s'}}>
              <p className="text-sm text-gray-400 text-center mb-2">בחר כיתה:</p>
              <div className="flex justify-center gap-2">
                {Object.entries(GRADES).map(([g,info]) => {
                  const sel = grade === Number(g);
                  return (
                    <button key={g} onClick={()=>changeGrade(Number(g))}
                      className="topic-chip rounded-xl py-2 px-3 text-sm font-bold border-2"
                      style={{
                        borderColor: sel ? '#00e5ff' : 'rgba(255,255,255,0.1)',
                        background: sel ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.02)',
                        color: sel ? '#00e5ff' : '#666',
                        boxShadow: sel ? '0 0 12px rgba(0,229,255,0.3)' : 'none',
                      }}>
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topic Selection */}
            <div className="w-full max-w-xs slide-up" style={{animationDelay:'0.05s'}}>
              <p className="text-base text-gray-300 text-center mb-3 font-bold">בחר את הנושאים שלך</p>
              <div className="flex flex-wrap justify-center gap-2">
                {ALL_TOPICS.filter(t => GRADES[grade].topics.includes(t.id)).map(t => {
                  const sel = selectedTopics.includes(t.id);
                  return (
                    <button key={t.id} onClick={()=>toggleTopic(t.id)}
                      className="topic-chip rounded-xl py-2.5 px-2 text-xs font-bold border-2 text-center leading-tight"
                      style={{
                        width:'calc(33.33% - 8px)', minWidth:'90px',
                        borderColor: sel ? t.color : 'rgba(255,255,255,0.1)',
                        background: sel ? t.color+'15' : 'rgba(255,255,255,0.02)',
                        color: sel ? t.color : '#666',
                        boxShadow: sel ? '0 0 12px '+t.color+'30' : 'none',
                      }}>
                      <span className="ml-1">{t.icon}</span> {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="slide-up flex flex-col items-center gap-1 text-sm text-gray-400" style={{animationDelay:'0.1s'}}>
              <div className="flex items-center gap-1">
                <span>❤️×{START_LIVES}</span>
                <span className="text-gray-600 mx-1">•</span>
                <span>⏱ 20 שניות</span>
                <span className="text-gray-600 mx-1">•</span>
                <span>{ROUND_SIZE} שאלות בסיבוב</span>
              </div>
              <div className="text-xs text-gray-500">{LIFE_EARN_STREAK} נכונות ברצף = +❤️ בונוס (עד {MAX_LIVES})</div>
              <div className="text-xs text-gray-500">⚡ כל {BOOST_STREAK} ברצף = בוסט • ❄️ כל {FREEZE_STREAK} ברצף = הקפאה</div>
            </div>

            <button onClick={()=>{ if(savedGame) setShowResumeModal(true); else startGame(); }}
              className="w-64 py-4 rounded-2xl text-xl font-black border-2 glow-box-cyan btn-option slide-up"
              style={{borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)',animationDelay:'0.15s'}}>
              התחל משחק ⚡
            </button>
            <button onClick={startPractice}
              className="w-64 py-3 rounded-2xl text-lg font-bold border-2 btn-option slide-up"
              style={{borderColor:'#ff9500',color:'#ff9500',background:'rgba(255,149,0,0.1)',animationDelay:'0.17s',boxShadow:'0 0 14px rgba(255,149,0,0.25)'}}>
              📝 תרגול
            </button>
            <button onClick={()=>setScreen('duelSetup')}
              className="w-64 py-3 rounded-2xl text-lg font-bold border-2 btn-option slide-up"
              style={{borderColor:'#ff4444',color:'#ff4444',background:'rgba(255,68,68,0.08)',animationDelay:'0.18s',boxShadow:'0 0 12px rgba(255,68,68,0.2)'}}>
              ⚔️ דואל 1v1
            </button>
            <button onClick={()=>setScreen('leaderboard')}
              className="w-64 py-3 rounded-2xl text-lg font-bold border-2 glow-box-pink btn-option slide-up"
              style={{borderColor:'#ff0080',color:'#ff0080',background:'rgba(255,0,128,0.06)',animationDelay:'0.2s'}}>
              טבלת שיאים 🏆
            </button>
            <button onClick={shareMenuWhatsApp}
              className="w-64 py-3 rounded-2xl text-lg font-bold border-2 btn-option slide-up flex items-center justify-center gap-2"
              style={{borderColor:'#25D366',color:'#25D366',background:'rgba(37,211,102,0.08)',animationDelay:'0.22s',boxShadow:'0 0 15px rgba(37,211,102,0.2)'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              הזמן חברים לשחק 📲
            </button>
            {canInstall && (
              <button onClick={handleInstall}
                className="w-64 py-3 rounded-2xl text-lg font-bold border-2 btn-option slide-up flex items-center justify-center gap-2 install-pulse"
                style={{borderColor:'#00ff88',color:'#00ff88',background:'rgba(0,255,136,0.1)',animationDelay:'0.24s',boxShadow:'0 0 18px rgba(0,255,136,0.35), inset 0 0 12px rgba(0,255,136,0.08)'}}>
                <span style={{fontSize:'1.4rem',fontWeight:900,lineHeight:1,textShadow:'0 0 8px rgba(0,255,136,0.8)'}}>+</span>
                התקן אפליקציה 📲
              </button>
            )}
            <p className="text-xs text-gray-600 mt-1 slide-up" style={{animationDelay:'0.25s'}}>{GRADES[grade].label} • מתמטיקה והנדסה</p>
            <button onClick={startSpotlightTutorial}
              className="text-sm font-bold slide-up"
              style={{color:'rgba(0,229,255,0.6)',animationDelay:'0.28s',background:'none',border:'none',textDecoration:'underline',textUnderlineOffset:'3px'}}>
              ❓ איך משחקים?
            </button>
          </div>
        )}

        {/* ── PLAYING ───────────────────── */}
        {screen === 'playing' && question && (
          <div className="flex-1 flex flex-col px-4 pt-6 pb-6 max-w-lg mx-auto w-full">
            {/* Row 1: Lives centered prominently */}
            <div id="hud-lives" className="flex items-center justify-center gap-1.5 mb-2">
              {Array.from({length: MAX_LIVES}, (_,i) => (
                <div key={i} className={`transition-all duration-300 ${breakingHeart && i === livesDisplay ? 'heart-break' : ''} ${gainedLife && i === livesDisplay-1 ? 'life-gain' : ''}`}
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    background: i < livesDisplay ? '#ff0080' : 'rgba(255,255,255,0.08)',
                    boxShadow: i < livesDisplay ? '0 0 10px rgba(255,0,128,0.6), 0 0 20px rgba(255,0,128,0.3)' : 'none',
                    border: i < livesDisplay ? '2px solid #ff3399' : '2px solid rgba(255,255,255,0.1)',
                  }}/>
              ))}
            </div>
            {/* Row 2: End + Round + Score */}
            <div className="flex items-center justify-between mb-2">
              <button onClick={endGame} className="text-gray-500 text-xs px-2 py-1 rounded-lg border border-gray-800 btn-option">
                סיום ✕
              </button>
              <div className="text-xs text-gray-400">
                סיבוב {roundNum} • <span style={{color:'#ffaa00',fontFamily:"'Orbitron',sans-serif"}}>{(gs.current.answered % ROUND_SIZE)+1}/{ROUND_SIZE}</span>
              </div>
              <div id="hud-streak" className="flex items-center gap-2">
                {streak > 0 && (
                  <span className="text-sm font-bold" style={{color:'#ff0080',fontFamily:"'Orbitron',sans-serif"}}>{streak}{combo}</span>
                )}
                <span id="hud-score" className="text-xl font-black glow-cyan" style={{color:'#00e5ff',fontFamily:"'Orbitron',sans-serif"}}>{score}</span>
              </div>
            </div>

            {/* Timer Bar */}
            <div id="hud-timer">
            <div className={"w-full h-2 rounded-full bg-gray-900 mb-4 overflow-hidden border "+(activeFreeze?'border-cyan-400 freeze-active':'border-gray-800')}>
              <div className="h-full rounded-full"
                style={{width:(timerFrac*100)+'%',background:activeFreeze?'#7dd3fc':timerColor,boxShadow:'0 0 12px '+(activeFreeze?'#7dd3fc':timerColor),transition:'width 0.1s linear, background-color 0.3s'}}/>
            </div>

            <div className="text-center mb-1">
              <span className="text-xs text-gray-500">{activeFreeze ? '❄️ הוקפא!' : Math.ceil(timeLeft)+' שניות'}</span>
            </div>
            </div>

            {/* Power-Up Bar */}
            <div id="hud-powerups" className="flex items-center justify-center gap-2 mb-2 relative">
              <button onClick={useFreeze} disabled={freezeCount<=0||!!feedback||usedPowerUp}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 btn-option text-xs font-bold transition-all"
                style={{
                  borderColor: freezeCount>0 && !feedback && !usedPowerUp ? '#7dd3fc' : 'rgba(255,255,255,0.1)',
                  background: freezeCount>0 && !feedback && !usedPowerUp ? 'rgba(125,211,252,0.12)' : 'rgba(255,255,255,0.02)',
                  color: freezeCount>0 && !feedback && !usedPowerUp ? '#7dd3fc' : '#555',
                  boxShadow: freezeCount>0 && !feedback && !usedPowerUp ? '0 0 10px rgba(125,211,252,0.25)' : 'none',
                  opacity: freezeCount<=0||!!feedback||usedPowerUp ? 0.5 : 1,
                }}>
                <span>❄️</span><span>{freezeCount}</span>
              </button>

              <button onClick={useBoost} disabled={boostCount<=0||!!feedback||usedPowerUp}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 btn-option text-xs font-bold transition-all"
                style={{
                  borderColor: boostCount>0 && !feedback && !usedPowerUp ? '#fbbf24' : 'rgba(255,255,255,0.1)',
                  background: boostCount>0 && !feedback && !usedPowerUp ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.02)',
                  color: boostCount>0 && !feedback && !usedPowerUp ? '#fbbf24' : '#555',
                  boxShadow: boostCount>0 && !feedback && !usedPowerUp ? '0 0 10px rgba(251,191,36,0.25)' : 'none',
                  opacity: boostCount<=0||!!feedback||usedPowerUp ? 0.5 : 1,
                }}>
                <span>⚡</span><span>{boostCount}</span>
              </button>

              <button onClick={inviteFriend} disabled={!!feedback}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border-2 btn-option text-xs font-bold transition-all"
                style={{
                  borderColor: !feedback ? '#25D366' : 'rgba(255,255,255,0.1)',
                  background: !feedback ? 'rgba(37,211,102,0.12)' : 'rgba(255,255,255,0.02)',
                  color: !feedback ? '#25D366' : '#555',
                  boxShadow: !feedback ? '0 0 10px rgba(37,211,102,0.25)' : 'none',
                  opacity: !!feedback ? 0.5 : 1,
                }}>
                <span>🆘</span><span style={{fontSize:'10px'}}>+{FRIEND_SECONDS}s</span>
              </button>

              {/* Friend tooltip */}
              {showFriendTooltip && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold pop-in z-30"
                  style={{background:'rgba(37,211,102,0.95)',color:'#fff',boxShadow:'0 4px 12px rgba(0,0,0,0.4)'}}>
                  כל פעם חבר חדש = עוד {FRIEND_SECONDS} שניות ⏱️
                </div>
              )}

              {/* Friend error */}
              {friendError && (
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold pop-in z-30"
                  style={{background:'rgba(239,68,68,0.95)',color:'#fff',boxShadow:'0 4px 12px rgba(0,0,0,0.4)'}}>
                  {friendError}
                </div>
              )}

              {/* Power-up gain animation */}
              {powerUpGainAnim && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-sm font-black pop-in"
                  style={{color: powerUpGainAnim==='freeze' ? '#7dd3fc' : '#fbbf24',
                    textShadow: '0 0 12px '+(powerUpGainAnim==='freeze' ? 'rgba(125,211,252,0.6)' : 'rgba(251,191,36,0.6)')}}>
                  +1 {powerUpGainAnim==='freeze' ? '❄️' : '⚡'}
                </div>
              )}
            </div>

            <div className="text-center mb-3">
              <span className="text-sm font-bold px-4 py-1 rounded-full border"
                style={{borderColor:'rgba(0,229,255,0.3)',color:'#00e5ff',background:'rgba(0,229,255,0.05)'}}>
                {question.aLabel}
              </span>
            </div>

            {/* Question Card + Character */}
            <div className="mx-auto mb-4 pop-in w-full relative">
              {/* Character */}
              <div className="absolute -top-2 -left-2 z-20 flex flex-col items-center" style={{width:48}}>
                <div className={'text-3xl transition-all duration-300 '+charAnim}>{charEmoji}</div>
                {charMsg && <div className="mt-1 px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap pop-in"
                  style={{background:'rgba(26,10,62,0.95)',border:'1.5px solid #a78bfa',color:'#e9d5ff',boxShadow:'0 4px 12px rgba(0,0,0,0.4)'}}>
                  {charMsg}
                </div>}
              </div>
              <div className="rounded-3xl px-8 py-6 text-center border-2"
                style={{borderColor:'rgba(0,229,255,0.2)',background:'rgba(8,8,35,0.85)',boxShadow:'0 0 40px rgba(0,229,255,0.1)'}}>
                {question.qLabel && <div className="text-xs text-gray-500 mb-2">{question.qLabel}</div>}
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize: question.question.length > 25 ? '1.2rem' : question.question.length > 15 ? '1.6rem' : question.question.length > 8 ? '2.2rem' : '3rem', whiteSpace:'pre-line', lineHeight:1.4}}
                  className="font-black glow-cyan tracking-wide" dir="ltr">
                  {question.question}
                </div>
                {/* Geometry Shape Drawing */}
                {question.shape && (
                  <div className="flex justify-center mt-3" dangerouslySetInnerHTML={{__html:question.shape}}/>
                )}
                {/* Hint Bubble */}
                {hintVisible && question.topicId && HINTS[question.topicId] && (
                  <div className="hint-bubble pop-in">{HINTS[question.topicId]}</div>
                )}
              </div>
              {combo && <div className="text-center text-2xl mt-2 pop-in">{combo}</div>}
              {/* Hint Button */}
              {!feedback && (
                <button id="hud-hint" onClick={toggleHint} className="absolute -bottom-2 -left-2 rounded-full border-2 flex flex-col items-center justify-center btn-option"
                  style={{borderColor:'#fbbf24',background:'rgba(251,191,36,0.15)',color:'#fbbf24',boxShadow:'0 2px 8px rgba(251,191,36,0.3)',zIndex:10,width:'44px',height:'44px',padding:'2px 0'}}>
                  <span style={{fontSize:'16px',lineHeight:1}}>💡</span>
                  <span style={{fontSize:'9px',fontWeight:800,lineHeight:1,marginTop:'1px',fontFamily:'Heebo,sans-serif'}}>רמז</span>
                </button>
              )}
            </div>

            {/* Options Grid - Clean Cyberpunk */}
            <div className="grid grid-cols-2 gap-3 mt-auto">
              {question.options.map((opt,i) => {
                let borderC = 'rgba(255,255,255,0.15)';
                let bgC = 'rgba(255,255,255,0.04)';
                let textC = '#fff';
                let extraClass = '';
                if(feedback && i === question.correctIdx) { borderC='#00e5ff'; bgC='rgba(0,229,255,0.15)'; textC='#00e5ff'; extraClass='correct-anim'; }
                else if((feedback==='wrong'||feedback==='close') && i === selIdx) { borderC='#ff0080'; bgC='rgba(255,0,128,0.15)'; textC='#ff0080'; extraClass='wrong-anim'; }
                else if(feedback==='timeout' && i === question.correctIdx) { borderC='#00e5ff'; bgC='rgba(0,229,255,0.1)'; textC='#00e5ff'; }

                return (
                  <button key={i} onClick={()=>handleAnswer(i)} disabled={!!feedback}
                    className={'rounded-2xl py-5 text-center border-2 btn-option slide-up '+extraClass}
                    style={{borderColor:borderC,background:bgC,animationDelay:(i*0.06)+'s',color:textC}}>
                    <span dir="ltr" className="text-2xl font-black" style={{fontFamily:"'Orbitron',sans-serif"}}>{opt}</span>
                  </button>
                );
              })}
            </div>

            {feedback==='correct' && (
              <div className="text-center mt-3 pop-in">
                <span className="text-lg font-black" style={{color:'#00e5ff'}}>נכון! 🎯 +{Math.max(10,Math.round(timeLeft*10*(usedPowerUp?POWERUP_SCORE_MULT:1)))}{usedPowerUp?' (×0.5)':''}</span>
              </div>
            )}
            {gainedLife && (
              <div className="text-center mt-2 pop-in">
                <span className="text-lg font-black" style={{color:'#ff0080',textShadow:'0 0 12px rgba(255,0,128,0.5)'}}>+❤️ חיים בונוס! 🎉</span>
              </div>
            )}
          </div>
        )}

        {/* ── WRONG ANSWER FULL-SCREEN OVERLAY ── */}
        {(feedback==='wrong'||feedback==='close'||feedback==='timeout') && question && (
          <div className="fixed inset-0 z-40 flex flex-col items-center justify-start pt-16 px-5 overflow-y-auto pb-8"
            style={{background: feedback==='close' ? 'rgba(30,15,5,0.94)' : 'rgba(30,5,5,0.94)', backdropFilter:'blur(8px)'}}>
            {/* Icon */}
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-3 pop-in"
              style={{background:'radial-gradient(circle,rgba(239,68,68,0.3),transparent)',border:'3px solid #ef4444'}}>
              <span className="text-5xl">{feedback==='close' ? '😬' : feedback==='timeout' ? '⏰' : '❌'}</span>
            </div>
            {/* Title */}
            <div className="text-2xl font-black mb-2" style={{color:'#f87171',textShadow:'0 0 20px rgba(248,113,113,0.5)'}}>
              {feedback==='close' ? '!כמעט 🤏' : feedback==='timeout' ? '!נגמר הזמן' : '!לא נכון — בפעם הבאה'}
            </div>
            {/* Explanation Box */}
            {EXPLANATIONS[question.topicId] && (
              <div className="w-full max-w-sm rounded-2xl p-4 mb-3 slide-up"
                style={{background:'rgba(255,255,255,0.08)',border:'1.5px solid rgba(255,255,255,0.2)'}}>
                <div className="text-xs font-bold mb-2" style={{color:'#a78bfa',letterSpacing:'0.5px'}}>
                  📖 {EXPLANATIONS[question.topicId].t}
                </div>
                <div className="text-sm leading-relaxed mb-3" style={{color:'#e2e8f0'}}>
                  {EXPLANATIONS[question.topicId].b}
                </div>
                {/* Step-by-step solution */}
                {question.solutionSteps && (
                <div className="py-3 px-4 rounded-xl mb-3 slide-up"
                  style={{background:'rgba(0,229,255,0.06)',border:'1px solid rgba(0,229,255,0.2)'}}>
                  <div className="text-xs font-bold mb-2" style={{color:'#7dd3fc',letterSpacing:'0.3px'}}>📝 פתרון צעד אחר צעד:</div>
                  <div dir="rtl" style={{textAlign:'right'}}>
                    {question.solutionSteps.split('\n').map((line,i,arr) => {
                      const isFormula = line.startsWith('נוסחה:') || line.startsWith('כלל:') || line.startsWith('כלל (');
                      const isStep = line.startsWith('שלב ');
                      const isFinal = line.includes('✓');
                      const isCalc = line.startsWith('חישוב:');
                      return (
                        <div key={i} className={i>0?'mt-1.5':''}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '8px',
                            fontSize: isFormula ? '12px' : '13px',
                            fontWeight: isFinal ? 800 : isFormula ? 700 : 600,
                            color: isFormula ? '#c4b5fd' : isFinal ? '#4ade80' : isStep ? '#e2e8f0' : isCalc ? '#7dd3fc' : '#cbd5e1',
                            background: isFormula ? 'rgba(167,139,250,0.12)' : isFinal ? 'rgba(74,222,128,0.08)' : 'transparent',
                            borderRight: isStep ? '3px solid rgba(0,229,255,0.4)' : 'none',
                            paddingRight: isStep ? '10px' : '8px',
                            fontFamily: "'Heebo','Orbitron',sans-serif",
                            direction: 'rtl',
                          }}>
                          {line}
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}
                {/* Correct answer */}
                <div className="text-center text-sm" style={{color:'rgba(255,255,255,0.5)'}}>
                  ✅ התשובה הנכונה: <span style={{color:'#4ade80',fontWeight:900,fontSize:'18px'}}>{question.correct}</span>
                </div>
              </div>
            )}
            {/* Motivational */}
            <div className="text-xs mb-3" style={{color:'rgba(255,255,255,0.4)'}}>💪 טעויות עוזרות ללמוד!</div>
            {/* Continue button */}
            <button onClick={()=>{clearTimeout(feedbackTimer.current);nextQ();}}
              className="w-64 py-3 rounded-2xl text-lg font-bold border-2 btn-option"
              style={{borderColor:'rgba(255,255,255,0.3)',color:'#fff',background:'rgba(255,255,255,0.08)'}}>
              המשך ▶
            </button>
          </div>
        )}

        {/* ── STREAK MILESTONE POPUP ───── */}
        {streakMilestone && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-5"
            style={{background:'rgba(0,0,0,0.75)',backdropFilter:'blur(4px)'}}>
            <div className="w-full max-w-xs rounded-3xl px-6 py-7 text-center pop-in"
              style={{background:'rgba(10,10,40,0.97)',border:'2px solid rgba(0,229,255,0.3)',
                boxShadow:'0 0 60px rgba(0,229,255,0.15), 0 0 120px rgba(255,0,128,0.08)'}}>
              <div className="text-6xl mb-2" style={{filter:'drop-shadow(0 0 20px rgba(255,170,0,0.5))'}}>
                {streakMilestone>=25?'\u{1F31F}':streakMilestone>=20?'\u{1F680}':streakMilestone>=15?'\u{1F4A5}':streakMilestone>=10?'\u26A1':'\u{1F525}'}
              </div>
              <div className="text-3xl font-black mb-1 glow-cyan" style={{fontFamily:"'Orbitron',sans-serif",color:'#00e5ff'}}>
                {streakMilestone} ברצף!
              </div>
              <div className="text-base font-bold mb-5" style={{color:'#e2e8f0',lineHeight:1.5}}>
                חושב שתוכל לעקוף אותי {'\u{1F609}'}?
              </div>
              <button onClick={()=>shareStreakWhatsApp(streakMilestone)}
                className="w-full py-3.5 rounded-2xl text-base font-black border-2 btn-option mb-3 flex items-center justify-center gap-2"
                style={{borderColor:'#25D366',color:'#25D366',background:'rgba(37,211,102,0.12)',
                  boxShadow:'0 0 20px rgba(37,211,102,0.2)'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                שתף בוואטסאפ ⚔️
              </button>
              <button onClick={()=>{setStreakMilestone(null);if(!checkRoundEnd(0)){nextQ();}}}
                className="w-full py-3 rounded-2xl text-base font-black border-2 glow-box-cyan btn-option"
                style={{borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)'}}>
                המשך לשחק ▶
              </button>
            </div>
          </div>
        )}

        {/* ── PRACTICE SCREEN ─────────────── */}
        {screen === 'practice' && question && (
          <div className="flex-1 flex flex-col px-4 pt-6 pb-6 max-w-lg mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button onClick={exitPractice} className="text-gray-500 text-xs px-2 py-1 rounded-lg border border-gray-800 btn-option">
                חזרה ←
              </button>
              <div className="text-center">
                <span className="text-sm font-bold" style={{color:'#a78bfa'}}>📝 תרגול</span>
                <span className="text-xs text-gray-500 mx-2">•</span>
                <span className="text-xs text-gray-400">{ALL_TOPICS.find(t=>t.id===question.topicId)?.name || ''}</span>
              </div>
              <div className="text-xs text-gray-500">
                {practiceQCount+1} שאלה
              </div>
            </div>

            {/* Difficulty indicator */}
            <div className="flex justify-center gap-2 mb-4">
              {['easy','medium','hard'].map(d => (
                <div key={d} className="px-3 py-1 rounded-full text-xs font-bold" style={{
                  background: d===practiceDiff ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.03)',
                  border: d===practiceDiff ? '1.5px solid #a78bfa' : '1.5px solid rgba(255,255,255,0.08)',
                  color: d===practiceDiff ? '#a78bfa' : '#555',
                }}>
                  {d==='easy'?'קל':d==='medium'?'בינוני':'קשה'}
                </div>
              ))}
            </div>

            {/* Topic label */}
            <div className="text-center mb-3">
              <span className="text-sm font-bold px-4 py-1 rounded-full border"
                style={{borderColor:'rgba(167,139,250,0.3)',color:'#a78bfa',background:'rgba(167,139,250,0.05)'}}>
                {question.aLabel}
              </span>
            </div>

            {/* Question Card */}
            <div className="mx-auto mb-4 pop-in w-full">
              <div className="rounded-3xl px-8 py-6 text-center border-2"
                style={{borderColor:'rgba(167,139,250,0.2)',background:'rgba(8,8,35,0.85)',boxShadow:'0 0 40px rgba(167,139,250,0.1)'}}>
                {question.qLabel && <div className="text-xs text-gray-500 mb-2">{question.qLabel}</div>}
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize: question.question.length > 25 ? '1.2rem' : question.question.length > 15 ? '1.6rem' : question.question.length > 8 ? '2.2rem' : '3rem', whiteSpace:'pre-line', lineHeight:1.4}}
                  className="font-black tracking-wide" dir="ltr"
                  >
                  <span style={{color:'#c4b5fd',textShadow:'0 0 15px rgba(167,139,250,0.4)'}}>{question.question}</span>
                </div>
                {question.drawing && <div className="mt-3" dangerouslySetInnerHTML={{__html:question.drawing}}/>}
              </div>
            </div>

            {/* Answer Options */}
            <div className="grid grid-cols-2 gap-3">
              {question.options.map((opt,i) => {
                let borderC = 'rgba(255,255,255,0.15)';
                let bgC = 'rgba(255,255,255,0.04)';
                let textC = '#fff';
                let extraClass = '';
                if(practiceFeedback && i === question.correctIdx) { borderC='#4ade80'; bgC='rgba(74,222,128,0.15)'; textC='#4ade80'; extraClass='correct-anim'; }
                else if(practiceFeedback==='wrong' && i === practiceSelIdx) { borderC='#ff0080'; bgC='rgba(255,0,128,0.15)'; textC='#ff0080'; extraClass='wrong-anim'; }
                else if(practiceFeedback==='revealed' && i !== question.correctIdx) { borderC='rgba(255,255,255,0.06)'; bgC='rgba(255,255,255,0.01)'; textC='#555'; }

                return (
                  <button key={i} onClick={()=>handlePracticeAnswer(i)} disabled={!!practiceFeedback}
                    className={'rounded-2xl py-5 text-center border-2 btn-option slide-up '+extraClass}
                    style={{borderColor:borderC,background:bgC,animationDelay:(i*0.06)+'s',color:textC}}>
                    <span dir="ltr" className="text-2xl font-black" style={{fontFamily:"'Orbitron',sans-serif"}}>{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Show Solution Button (before answering) */}
            {!practiceFeedback && (
              <button onClick={revealPracticeSolution}
                className="mt-3 py-2 rounded-xl text-sm font-bold border btn-option"
                style={{borderColor:'rgba(167,139,250,0.3)',color:'#a78bfa',background:'rgba(167,139,250,0.06)'}}>
                👁️ הצג פתרון
              </button>
            )}

            {/* Correct feedback */}
            {practiceFeedback === 'correct' && (
              <div className="text-center mt-3 pop-in">
                <span className="text-lg font-black" style={{color:'#4ade80'}}>נכון! 🎯</span>
              </div>
            )}

            {/* Solution Card (wrong / revealed) */}
            {practiceFeedback && EXPLANATIONS[question.topicId] && (
              <div className="w-full max-w-sm mx-auto rounded-2xl p-4 mt-3 slide-up"
                style={{background:'rgba(255,255,255,0.06)',border:'1.5px solid rgba(167,139,250,0.25)'}}>
                {practiceFeedback === 'wrong' && (
                  <div className="text-center mb-3">
                    <span className="text-base font-black" style={{color:'#f87171'}}>לא נכון 😅</span>
                  </div>
                )}
                {practiceFeedback === 'revealed' && (
                  <div className="text-center mb-3">
                    <span className="text-base font-bold" style={{color:'#a78bfa'}}>👁️ פתרון</span>
                  </div>
                )}
                <div className="text-xs font-bold mb-2" style={{color:'#a78bfa',letterSpacing:'0.5px'}}>
                  📖 {EXPLANATIONS[question.topicId].t}
                </div>
                <div className="text-sm leading-relaxed mb-3" style={{color:'#e2e8f0'}}>
                  {EXPLANATIONS[question.topicId].b}
                </div>
                <div className="py-2 px-4 rounded-xl text-center text-sm font-bold mb-3"
                  style={{background:'rgba(167,139,250,0.15)',border:'1px solid rgba(167,139,250,0.3)',color:'#c4b5fd'}}>
                  {EXPLANATIONS[question.topicId].f}
                </div>
                {question.solutionSteps && (
                  <div className="py-3 px-4 rounded-xl mb-3"
                    style={{background:'rgba(0,229,255,0.06)',border:'1px solid rgba(0,229,255,0.2)'}}>
                    <div className="text-xs font-bold mb-2" style={{color:'#7dd3fc'}}>📝 פתרון צעד אחר צעד:</div>
                    <div dir="rtl" style={{textAlign:'right'}}>
                      {question.solutionSteps.split('\n').map((line,i) => {
                        const isFormula = line.startsWith('נוסחה:') || line.startsWith('כלל:') || line.startsWith('כלל (');
                        const isStep = line.startsWith('שלב ');
                        const isFinal = line.includes('✓');
                        const isCalc = line.startsWith('חישוב:');
                        return (
                          <div key={i} className={i>0?'mt-1.5':''}
                            style={{
                              padding:'4px 8px', borderRadius:'8px',
                              fontSize: isFormula ? '12px' : '13px',
                              fontWeight: isFinal ? 800 : isFormula ? 700 : 600,
                              color: isFormula ? '#c4b5fd' : isFinal ? '#4ade80' : isStep ? '#e2e8f0' : isCalc ? '#7dd3fc' : '#cbd5e1',
                              background: isFormula ? 'rgba(167,139,250,0.12)' : isFinal ? 'rgba(74,222,128,0.08)' : 'transparent',
                              borderRight: isStep ? '3px solid rgba(0,229,255,0.4)' : 'none',
                              paddingRight: isStep ? '10px' : '8px',
                              fontFamily: "'Heebo','Orbitron',sans-serif",
                            }}>
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="text-center text-sm" style={{color:'rgba(255,255,255,0.5)'}}>
                  ✅ התשובה הנכונה: <span style={{color:'#4ade80',fontWeight:900,fontSize:'18px'}}>{question.correct}</span>
                </div>
              </div>
            )}

            {/* Next Question Button */}
            {practiceFeedback && (
              <button onClick={nextPracticeQ}
                className="mt-4 w-full py-3 rounded-2xl text-lg font-bold border-2 btn-option pop-in"
                style={{borderColor:'#a78bfa',color:'#a78bfa',background:'rgba(167,139,250,0.08)',boxShadow:'0 0 15px rgba(167,139,250,0.2)'}}>
                הבא ←
              </button>
            )}

            <div className="text-center mt-3 text-xs text-gray-600">💡 תרגול חופשי — בלי טיימר, בלי ניקוד</div>
          </div>
        )}

        {/* ── ROUND SUMMARY ─────────────── */}
        {screen === 'roundSummary' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
            <div className="pop-in text-center">
              <div className="text-4xl mb-2">🏅</div>
              <p className="text-2xl font-black glow-cyan" style={{color:'#00e5ff',fontFamily:"'Orbitron',sans-serif"}}>סיבוב {roundNum} הושלם!</p>
            </div>

            <div className="w-72 rounded-2xl border-2 py-5 px-6 slide-up" style={{borderColor:'rgba(0,229,255,0.2)',background:'rgba(0,229,255,0.04)',animationDelay:'0.1s'}}>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-400 text-sm">תשובות נכונות</span>
                <span className="text-xl font-black" style={{color: roundCorrect >= 8 ? '#00ff88' : roundCorrect >= 5 ? '#ffaa00' : '#ff0080', fontFamily:"'Orbitron',sans-serif"}}>
                  {roundCorrect}/{ROUND_SIZE}
                </span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-400 text-sm">ניקוד כולל</span>
                <span className="text-xl font-black glow-cyan" style={{color:'#00e5ff',fontFamily:"'Orbitron',sans-serif"}}>{gs.current.score}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-400 text-sm">רצף מקסימלי</span>
                <span className="text-xl font-black" style={{color:'#ff0080',fontFamily:"'Orbitron',sans-serif"}}>{gs.current.maxStreak} 🔥</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">חיים</span>
                <span className="text-lg">{Array.from({length: gs.current.lives}, ()=>'❤️').join('')}{Array.from({length: MAX_LIVES - gs.current.lives}, ()=>'🖤').join('')}</span>
              </div>
            </div>

            {roundCorrect >= 8 && (
              <div className="text-center pop-in" style={{animationDelay:'0.2s'}}>
                <span className="text-lg font-bold" style={{color:'#00ff88'}}>מדהים! 🌟</span>
              </div>
            )}
            {roundCorrect >= 5 && roundCorrect < 8 && (
              <div className="text-center pop-in" style={{animationDelay:'0.2s'}}>
                <span className="text-lg font-bold" style={{color:'#ffaa00'}}>יופי! אפשר לשפר 💪</span>
              </div>
            )}
            {roundCorrect < 5 && (
              <div className="text-center pop-in" style={{animationDelay:'0.2s'}}>
                <span className="text-lg font-bold" style={{color:'#ff0080'}}>אל תוותר! 💪</span>
              </div>
            )}

            <button onClick={continueNextRound}
              className="w-64 py-4 rounded-2xl text-xl font-black border-2 glow-box-cyan btn-option slide-up"
              style={{borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)',animationDelay:'0.25s'}}>
              סיבוב {roundNum + 1} ⚡
            </button>
            <button onClick={()=>{saveScore(); showLeaderboardOverlay('סיום משחק','🏆',()=>setScreen('gameover'));}}
              className="py-3 px-8 rounded-2xl text-base font-bold border-2 btn-option slide-up"
              style={{borderColor:'#ff0080',color:'#ff0080',background:'rgba(255,0,128,0.06)',animationDelay:'0.3s'}}>
              סיים משחק 🏁
            </button>
          </div>
        )}

        {/* ── ONBOARDING SPOTLIGHT ────────────── */}
        {showOB && screen === 'playing' && (() => {
          const s = OB_SPOTLIGHT_STEPS[obStep];
          const total = OB_SPOTLIGHT_STEPS.length;
          const isFinal = obStep === total - 1;
          const sr = spotlightRect;
          // Position bubble below or above the target
          const bubbleBelow = sr && (sr.y < window.innerHeight * 0.45);
          const bubbleTop = sr ? (bubbleBelow ? sr.y + sr.h + 12 : sr.y - 12) : '50%';
          const arrowLeftPx = sr ? Math.max(24, Math.min(sr.x + sr.w/2 - 20, window.innerWidth - 60)) : 0;
          const bubbleLeft = sr ? Math.max(12, Math.min(sr.x + sr.w/2 - 150, window.innerWidth - 312)) : 20;
          const arrowOffset = sr ? arrowLeftPx - bubbleLeft : 130;
          return (
            <div key={'ob-'+obStep} style={{position:'fixed',inset:0,zIndex:9999}}>
              <style>{`@keyframes obSpotPulse{0%,100%{stroke-opacity:0.5;filter:drop-shadow(0 0 6px rgba(0,229,255,0.4))}50%{stroke-opacity:1;filter:drop-shadow(0 0 14px rgba(0,229,255,0.7))}}@keyframes obBubblePop{0%{opacity:0;transform:scale(0.88) translateY(6px)}60%{opacity:1;transform:scale(1.02) translateY(-1px)}100%{opacity:1;transform:scale(1) translateY(0)}}`}</style>
              {/* Overlay with spotlight hole */}
              <svg style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>
                <defs>
                  <mask id="spotlight-mask">
                    <rect width="100%" height="100%" fill="white"/>
                    {sr && <rect x={sr.x} y={sr.y} width={sr.w} height={sr.h} rx="12" fill="black"/>}
                  </mask>
                </defs>
                <rect width="100%" height="100%" fill="rgba(5,5,16,0.88)" mask="url(#spotlight-mask)"/>
                {sr && <rect x={sr.x} y={sr.y} width={sr.w} height={sr.h} rx="12" fill="none" stroke="#00e5ff" strokeWidth="2.5" style={{animation:'obSpotPulse 2s ease-in-out infinite'}}/>}
              </svg>
              {/* Speech bubble */}
              <div style={{
                position:'absolute',
                top: bubbleBelow ? bubbleTop : 'auto',
                bottom: !bubbleBelow && sr ? (window.innerHeight - sr.y + 12) : 'auto',
                left: bubbleLeft,
                width: 300, maxWidth:'calc(100vw - 24px)',
                zIndex:10000,
                animation:'obBubblePop 0.35s ease-out forwards',
              }}>
                {/* Arrow pointing to target */}
                {sr && bubbleBelow && (
                  <div style={{position:'absolute',top:-8,left:arrowOffset,width:0,height:0,
                    borderLeft:'9px solid transparent',borderRight:'9px solid transparent',
                    borderBottom:'9px solid rgba(10,10,46,0.96)'}}/>
                )}
                <div style={{background:'linear-gradient(135deg,rgba(10,10,46,0.96),rgba(15,15,50,0.96))',
                  border:'1.5px solid rgba(0,229,255,0.3)',borderRadius:18,padding:'14px 16px 12px',
                  boxShadow:'0 4px 24px rgba(0,229,255,0.15)',direction:'rtl',textAlign:'right'}}>
                  {/* Title */}
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6,justifyContent:'flex-start'}}>
                    <span style={{fontSize:15,fontWeight:900,color:'#00e5ff',textShadow:'0 0 10px rgba(0,229,255,0.3)'}}>{s.emoji} {s.title}</span>
                  </div>
                  {/* Text */}
                  <div style={{fontSize:14,color:'#d0d0e8',lineHeight:1.7,fontWeight:500,whiteSpace:'pre-line',marginBottom:14}}>
                    {s.text}
                  </div>
                  {/* Step dots */}
                  <div style={{display:'flex',justifyContent:'center',gap:5,marginBottom:10}}>
                    {Array.from({length:total}).map((_,i)=>(
                      <div key={i} style={{
                        height:6,borderRadius:3,transition:'all 0.3s ease',
                        width:i===obStep?20:6,
                        background:i===obStep?'#00e5ff':i<obStep?'rgba(0,229,255,0.5)':'rgba(255,255,255,0.12)',
                        boxShadow:i===obStep?'0 0 8px rgba(0,229,255,0.4)':'none'
                      }}/>
                    ))}
                  </div>
                  {/* Nav buttons */}
                  <div style={{display:'flex',gap:8}}>
                    {obStep > 0 && (
                      <button onClick={obPrev} style={{flex:1,padding:'10px 0',borderRadius:12,
                        background:'rgba(0,229,255,0.06)',border:'1px solid rgba(0,229,255,0.15)',
                        color:'#00e5ff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                        → הקודם
                      </button>
                    )}
                    <button onClick={obNext} style={{flex:obStep>0?2:1,padding:'10px 0',borderRadius:12,border:'none',fontSize:15,fontWeight:900,cursor:'pointer',
                      background:isFinal?'linear-gradient(135deg,#00e5ff,#00b8d4)':'linear-gradient(135deg,rgba(0,229,255,0.15),rgba(0,229,255,0.08))',
                      border:isFinal?'none':'1.5px solid rgba(0,229,255,0.3)',
                      color:isFinal?'#050510':'#00e5ff',
                      boxShadow:isFinal?'0 0 20px rgba(0,229,255,0.3)':'none'}}>
                      {isFinal ? '🎮 צא לדרך!' : 'הבא ←'}
                    </button>
                  </div>
                  <div style={{textAlign:'center',marginTop:6}}>
                    <span style={{fontSize:10,color:'rgba(0,229,255,0.3)',fontFamily:"'Orbitron',sans-serif"}}>{obStep+1} / {total}</span>
                  </div>
                </div>
                {/* Arrow pointing up to target */}
                {sr && !bubbleBelow && (
                  <div style={{position:'absolute',bottom:-8,left:arrowOffset,width:0,height:0,
                    borderLeft:'9px solid transparent',borderRight:'9px solid transparent',
                    borderTop:'9px solid rgba(10,10,46,0.96)'}}/>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── REVIVE SCREEN ────────────── */}
        {screen === 'revive' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
            <div className="pop-in text-center">
              <div className="text-5xl mb-3 dead-pulse">💔</div>
              <p className="text-2xl font-black glow-pink" style={{color:'#ff0080'}}>נגמרו החיים!</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="text-gray-400">ניקוד:</span>
                <span className="text-2xl font-black glow-cyan" style={{fontFamily:"'Orbitron',sans-serif",color:'#00e5ff'}}>{gs.current.score}</span>
              </div>
            </div>

            {/* Wait timer for 1 free life */}
            {waitingForLife && (
              <div className="w-72 py-4 rounded-2xl text-center border-2 slide-up"
                style={{borderColor:'#ff0080',color:'#ff0080',background:'rgba(255,0,128,0.06)',animationDelay:'0.1s'}}>
                <div className="text-sm text-gray-400 mb-1">חיים חדש בעוד</div>
                <div className="text-4xl font-black" style={{fontFamily:"'Orbitron',sans-serif",color:'#ff0080',textShadow:'0 0 15px rgba(255,0,128,0.5)'}}>
                  {Math.floor(waitCountdown/60)}:{String(waitCountdown%60).padStart(2,'0')}
                </div>
                <div className="text-xs text-gray-500 mt-1">⏳ מקבלים ❤️ אחד אוטומטית</div>
              </div>
            )}

            <p className="text-sm text-gray-400 text-center slide-up" style={{animationDelay:'0.12s'}}>
              לא רוצה לחכות?
            </p>

            {/* Buy 3 lives with points */}
            {gs.current.score >= REVIVE_COST ? (
              <button onClick={reviveWithPoints}
                className="w-72 py-4 rounded-2xl text-lg font-black border-2 btn-option slide-up revive-pulse"
                style={{borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)',animationDelay:'0.15s'}}>
                <div>קנה {REVIVE_POINTS_LIVES} חיים ❤️❤️❤️</div>
                <div className="text-sm font-bold mt-1" style={{color:'#ffaa00'}}>עולה {REVIVE_COST.toLocaleString()} נקודות 💰</div>
              </button>
            ) : (
              <div className="w-72 py-4 rounded-2xl text-center border-2 slide-up opacity-40"
                style={{borderColor:'#333',color:'#666',background:'rgba(255,255,255,0.02)',animationDelay:'0.15s'}}>
                <div>קנה {REVIVE_POINTS_LIVES} חיים ❤️❤️❤️</div>
                <div className="text-sm mt-1">צריך {REVIVE_COST.toLocaleString()} נקודות (יש לך {gs.current.score.toLocaleString()})</div>
              </div>
            )}

            {/* Invite friend for life */}
            {gs.current.invitesUsed < REVIVE_INVITE_LIMIT ? (
              <button onClick={reviveWithInvite}
                className="w-72 py-4 rounded-2xl text-lg font-bold border-2 btn-option slide-up"
                style={{borderColor:'#25D366',color:'#25D366',background:'rgba(37,211,102,0.08)',animationDelay:'0.2s',boxShadow:'0 0 15px rgba(37,211,102,0.2)'}}>
                <div>שלח אתגר לחבר 📱</div>
                <div className="text-sm mt-1 opacity-75">וקבל חיים בחינם! ❤️</div>
                {gs.current.invitesUsed > 0 && (
                  <div className="text-xs mt-1 opacity-50">({REVIVE_INVITE_LIMIT - gs.current.invitesUsed} נותרו)</div>
                )}
              </button>
            ) : (
              <div className="w-72 py-3 rounded-2xl text-center border-2 slide-up opacity-40"
                style={{borderColor:'#333',color:'#666',background:'rgba(255,255,255,0.02)',animationDelay:'0.2s'}}>
                <div>שלח אתגר לחבר 📱</div>
                <div className="text-xs mt-1">כבר שלחת {REVIVE_INVITE_LIMIT} הזמנות</div>
              </div>
            )}

            {/* Watch ad for life */}
            {gs.current.adsUsed < REVIVE_AD_LIMIT && !watchingAd ? (
              <button onClick={reviveWithAd}
                className="w-72 py-4 rounded-2xl text-lg font-bold border-2 btn-option slide-up"
                style={{borderColor:'#ffaa00',color:'#ffaa00',background:'rgba(255,170,0,0.08)',animationDelay:'0.25s',boxShadow:'0 0 15px rgba(255,170,0,0.2)'}}>
                <div>צפה בפרסומת 🎬</div>
                <div className="text-sm mt-1 opacity-75">וקבל חיים בחינם! ❤️</div>
              </button>
            ) : watchingAd ? (
              <div className="w-72 py-6 rounded-2xl text-center border-2 slide-up revive-pulse"
                style={{borderColor:'#ffaa00',color:'#ffaa00',background:'rgba(255,170,0,0.1)',animationDelay:'0.25s'}}>
                <div className="text-3xl mb-2" style={{fontFamily:"'Orbitron',sans-serif"}}>{adCountdown}</div>
                <div className="text-sm">הפרסומת מסתיימת...</div>
              </div>
            ) : (
              <div className="w-72 py-3 rounded-2xl text-center border-2 slide-up opacity-40"
                style={{borderColor:'#333',color:'#666',background:'rgba(255,255,255,0.02)',animationDelay:'0.25s'}}>
                <div>צפה בפרסומת 🎬</div>
                <div className="text-xs mt-1">כבר צפית בפרסומת</div>
              </div>
            )}

            <button onClick={()=>{if(waitIntervalRef.current){clearInterval(waitIntervalRef.current);waitIntervalRef.current=null;} saveScore(); showLeaderboardOverlay('סיום משחק','🏆',()=>setScreen('gameover'));}}
              className="py-3 px-8 rounded-2xl text-base font-bold border-2 btn-option slide-up"
              style={{borderColor:'#ff0080',color:'#ff0080',background:'rgba(255,0,128,0.06)',animationDelay:'0.3s'}}>
              סיים משחק 🏁
            </button>
          </div>
        )}

        {/* ── GAME OVER ─────────────────── */}
        {screen === 'gameover' && (() => {
          const g = gs.current;
          const acc = g.answered > 0 ? Math.round((g.totalCorrect||0)/g.answered*100) : 0;
          const stars = acc >= 90 ? '⭐⭐⭐' : acc >= 70 ? '⭐⭐' : acc >= 40 ? '⭐' : '';
          const grade_text = acc >= 90 ? '!מושלם 👑' : acc >= 70 ? '!כל הכבוד 💪' : acc >= 40 ? 'טוב, אפשר לשפר!' : '!אל תוותר 💪';
          return (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
            {isHigh && (
              <div className="pop-in text-center mb-1">
                <div className="text-3xl mb-1">🏆</div>
                <p className="text-xl font-black glow-pink" style={{color:'#ff0080'}}>שיא חדש!</p>
              </div>
            )}
            {/* Star Rating */}
            {stars && <div className="text-3xl tracking-widest pop-in">{stars}</div>}
            <div className="text-sm font-bold pop-in" style={{color: acc>=90?'#00ff88':acc>=70?'#ffaa00':'#ff0080'}}>{grade_text}</div>
            <div className="pop-in text-center">
              <div style={{fontFamily:"'Orbitron',sans-serif"}} className="text-5xl font-black glow-cyan">{g.score}</div>
              <p className="text-xs text-gray-400 mt-1">נקודות</p>
            </div>
            <div className="flex gap-5 slide-up" style={{animationDelay:'0.1s'}}>
              <div className="text-center">
                <div className="text-xl font-bold" style={{color:'#ff0080',fontFamily:"'Orbitron',sans-serif"}}>{g.maxStreak}</div>
                <div className="text-xs text-gray-500">רצף 🔥</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold" style={{color:'#00e5ff',fontFamily:"'Orbitron',sans-serif"}}>{acc}%</div>
                <div className="text-xs text-gray-500">דיוק 🎯</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold" style={{color:'#ffaa00',fontFamily:"'Orbitron',sans-serif"}}>{g.answered}</div>
                <div className="text-xs text-gray-500">שאלות</div>
              </div>
            </div>
            {/* Duel Challenge */}
            <button onClick={shareWhatsApp}
              className="w-64 py-3 rounded-2xl text-lg font-bold border-2 btn-option slide-up"
              style={{borderColor:'#25D366',color:'#25D366',background:'rgba(37,211,102,0.08)',animationDelay:'0.15s',boxShadow:'0 0 15px rgba(37,211,102,0.2)'}}>
              ⚔️ אתגר חבר בוואטסאפ
            </button>
            <button onClick={startGame}
              className="w-64 py-4 rounded-2xl text-xl font-black border-2 glow-box-cyan btn-option slide-up"
              style={{borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)',animationDelay:'0.25s'}}>
              שחק שוב ⚡
            </button>
            <div className="flex gap-3 slide-up" style={{animationDelay:'0.3s'}}>
              <button onClick={()=>setScreen('leaderboard')} className="text-sm text-gray-500 underline btn-option">שיאים 🏆</button>
              <button onClick={()=>setScreen('menu')} className="text-sm text-gray-600 btn-option">תפריט</button>
            </div>
          </div>
          );
        })()}

        {/* ── LEADERBOARD ───────────────── */}
        {screen === 'leaderboard' && (() => {
          // Merge real scores with bots for a competitive feel
          const bestScore = board.length > 0 ? board[0].s : 0;
          const bots = generateBotScores(2, bestScore);
          const merged = bots.map(b => ({n:b.name,s:b.score,isBot:true}));
          // Add real player scores
          board.forEach(e => {
            merged.push({n:e.n||DEFAULT_NAME,s:e.s,st:e.st,d:e.d,isBot:false,isReal:true});
          });
          merged.sort((a,b) => b.s - a.s);
          const top12 = merged.slice(0,12);
          const total = getLBPlayerCount();
          return (
          <div className="flex-1 flex flex-col px-6 pt-8 pb-6 max-w-lg mx-auto w-full">
            <div className="flex items-center justify-between mb-2">
              <button onClick={()=>setScreen('menu')} className="text-gray-500 text-sm px-3 py-1 rounded-lg border border-gray-800 btn-option">
                חזרה ←
              </button>
              <h2 className="text-xl font-black glow-pink" style={{color:'#ff0080'}}>🏆 טבלת שיאים</h2>
              <div className="w-16"/>
            </div>
            <div className="text-center text-xs mb-4" style={{color:'rgba(255,255,255,0.4)'}}>{total} שחקנים</div>
            {top12.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-600 text-center">עדיין אין שיאים<br/>שחק כדי להיכנס לטבלה!</p>
              </div>
            ) : (
              <div className="space-y-2 flex-1 overflow-auto">
                {top12.map((e,i) => {
                  const isPlayer = e.isReal;
                  const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':null;
                  const borderCol = isPlayer ? 'rgba(0,229,255,0.4)' : i===0 ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)';
                  const bgCol = isPlayer ? 'rgba(0,229,255,0.06)' : i===0 ? 'rgba(251,191,36,0.05)' : 'rgba(255,255,255,0.02)';
                  return (
                  <div key={i} className="flex items-center gap-3 rounded-xl py-3 px-4 border lb-row-slide"
                    style={{borderColor:borderCol,background:bgCol,animationDelay:(i*0.04)+'s',
                      boxShadow:isPlayer?'0 0 12px rgba(0,229,255,0.15)':'none'}}>
                    <span className="text-lg font-bold w-8 text-center" style={{color:i===0?'#fbbf24':i===1?'#94a3b8':i===2?'#fb923c':'#666',fontFamily:"'Orbitron',sans-serif"}}>
                      {medal || (i+1)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate" style={{color:isPlayer?'#00e5ff':'#ccc',fontFamily:"'Heebo',sans-serif"}}>
                        {e.n}{isPlayer && <span className="text-xs mr-1" style={{color:'#00e5ff'}}> (אתה)</span>}
                      </div>
                      <div>
                        <span className="font-bold" style={{fontFamily:"'Orbitron',sans-serif",color:isPlayer?'#00e5ff':'#fff'}}>{e.s}</span>
                        <span className="text-xs text-gray-500 mr-2">נקודות</span>
                      </div>
                    </div>
                    {e.st != null && (
                      <div className="text-left text-xs text-gray-500">
                        <div>רצף {e.st} 🔥</div>
                        {e.d && <div>{e.d}</div>}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
            <button onClick={startGame}
              className="mt-4 w-full py-4 rounded-2xl text-xl font-black border-2 glow-box-cyan btn-option"
              style={{borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)'}}>
              שחק עכשיו ⚡
            </button>
          </div>
          );
        })()}

        {/* ── DUEL SETUP ──────────────── */}
        {screen === 'duelSetup' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
            <div className="text-5xl pop-in">⚔️</div>
            <p className="text-2xl font-black glow-pink" style={{color:'#ff4444'}}>דואל 1 נגד 1</p>
            <p className="text-sm text-gray-400">שני שחקנים, אותו טלפון, {duelQCount} שאלות לכל אחד</p>
            <input type="text" value={duelName1} onChange={(e)=>setDuelName1(e.target.value)} placeholder="שם שחקן 1"
              className="w-64 py-3 px-4 rounded-xl text-center text-lg font-bold outline-none"
              style={{background:'rgba(0,229,255,0.08)',border:'2px solid rgba(0,229,255,0.3)',color:'#00e5ff'}} maxLength={12}/>
            <input type="text" value={duelName2} onChange={(e)=>setDuelName2(e.target.value)} placeholder="שם שחקן 2"
              className="w-64 py-3 px-4 rounded-xl text-center text-lg font-bold outline-none"
              style={{background:'rgba(255,68,68,0.08)',border:'2px solid rgba(255,68,68,0.3)',color:'#ff4444'}} maxLength={12}/>
            <button onClick={startDuel}
              className="w-64 py-4 rounded-2xl text-xl font-black border-2 btn-option"
              style={{borderColor:'#ff4444',color:'#fff',background:'linear-gradient(135deg,#dc2626,#991b1b)',boxShadow:'0 6px 0 #7f1d1d,0 8px 20px rgba(220,38,38,0.4)'}}>
              ⚔️ התחילו!
            </button>
            <button onClick={()=>setScreen('menu')} className="text-sm text-gray-500 btn-option">חזרה ←</button>
          </div>
        )}

        {/* ── DUEL SWITCH ─────────────── */}
        {screen === 'duelSwitch' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
            <div className="text-5xl pop-in">🔄</div>
            <p className="text-2xl font-black glow-cyan" style={{color:'#00e5ff'}}>{duelName1} סיים!</p>
            <div className="text-center">
              <span className="text-gray-400">ניקוד: </span>
              <span className="text-3xl font-black" style={{color:'#ffaa00',fontFamily:"'Orbitron',sans-serif"}}>{duelScore1}</span>
            </div>
            <div className="text-lg font-bold" style={{color:'#ff4444'}}>עכשיו תור {duelName2}!</div>
            <p className="text-sm text-gray-500">העבירו את הטלפון 📱</p>
            <button onClick={startDuelPlayer2}
              className="w-64 py-4 rounded-2xl text-xl font-black border-2 btn-option"
              style={{borderColor:'#ff4444',color:'#fff',background:'linear-gradient(135deg,#dc2626,#991b1b)',boxShadow:'0 6px 0 #7f1d1d'}}>
              ▶️ {duelName2} מתחיל!
            </button>
          </div>
        )}

        {/* ── DUEL RESULT ─────────────── */}
        {screen === 'duelResult' && (() => {
          const s2 = gs.current.score;
          const winner = duelScore1 > s2 ? duelName1 : s2 > duelScore1 ? duelName2 : null;
          return (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
            <div className="text-5xl pop-in">{winner ? '🏆' : '🤝'}</div>
            <p className="text-2xl font-black pop-in" style={{color:'#fbbf24'}}>
              {winner ? winner+' ניצח!' : 'תיקו!'}
            </p>
            <div className="flex gap-6 slide-up">
              <div className="text-center px-5 py-4 rounded-2xl border-2" style={{borderColor:'rgba(0,229,255,0.3)',background:'rgba(0,229,255,0.05)'}}>
                <div className="text-sm text-gray-400 mb-1">{duelName1}</div>
                <div className="text-3xl font-black" style={{color:'#00e5ff',fontFamily:"'Orbitron',sans-serif"}}>{duelScore1}</div>
              </div>
              <div className="text-2xl font-black self-center" style={{color:'#ff4444'}}>VS</div>
              <div className="text-center px-5 py-4 rounded-2xl border-2" style={{borderColor:'rgba(255,68,68,0.3)',background:'rgba(255,68,68,0.05)'}}>
                <div className="text-sm text-gray-400 mb-1">{duelName2}</div>
                <div className="text-3xl font-black" style={{color:'#ff4444',fontFamily:"'Orbitron',sans-serif"}}>{s2}</div>
              </div>
            </div>
            <button onClick={startDuel} className="w-64 py-3 rounded-2xl text-lg font-bold border-2 btn-option"
              style={{borderColor:'#ff4444',color:'#ff4444',background:'rgba(255,68,68,0.08)'}}>
              ⚔️ ריוואנץ׳!
            </button>
            <button onClick={()=>{setDuelMode(false);setScreen('menu');}} className="text-sm text-gray-500 btn-option">תפריט ראשי</button>
          </div>);
        })()}

        {/* ── RESUME MODAL ─────────────── */}
        {showResumeModal && savedGame && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(5,5,16,0.92)'}}
            onClick={()=>setShowResumeModal(false)}>
            <div className="pop-in text-center px-6 py-8 rounded-3xl max-w-xs w-full mx-4"
              style={{background:'linear-gradient(135deg,rgba(20,15,40,0.98),rgba(10,8,25,0.98))',border:'2px solid rgba(0,229,255,0.25)',boxShadow:'0 0 40px rgba(0,229,255,0.15)'}}
              onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:'2.5rem',lineHeight:1}} className="mb-3">⏸️</div>
              <p className="text-lg font-bold mb-1" style={{color:'#00e5ff',fontFamily:"'Heebo',sans-serif"}}>נמצא משחק שמור!</p>
              <p className="text-sm text-gray-400 mb-6" style={{fontFamily:"'Heebo',sans-serif"}}>
                {savedGame.score} נקודות • סיבוב {savedGame.roundNum||1}
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={()=>{setShowResumeModal(false);resumeGame();}}
                  className="w-full py-3.5 rounded-2xl text-lg font-bold border-2 btn-option"
                  style={{borderColor:'#00ff88',color:'#00ff88',background:'rgba(0,255,136,0.08)',boxShadow:'0 0 12px rgba(0,255,136,0.2)'}}>
                  ▶️ המשך מאיפה שעצרת
                </button>
                <button onClick={()=>{setShowResumeModal(false);startGame();}}
                  className="w-full py-3 rounded-2xl text-base font-bold border-2 btn-option"
                  style={{borderColor:'rgba(255,255,255,0.2)',color:'#999',background:'rgba(255,255,255,0.03)'}}>
                  🔄 התחל מההתחלה
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PRIZE BOX OVERLAY ────────── */}
        {showPrize && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(10,5,30,0.92)'}}>
            <div className="text-center prize-appear">
              <div className="text-6xl mb-4 prize-box">🎁</div>
              <p className="text-xl font-black" style={{color:'#fbbf24'}}>פרס סיבוב!</p>
              <div className="text-3xl font-black mt-2 pop-in" style={{color:'#00ff88',fontFamily:"'Orbitron',sans-serif",textShadow:'0 0 20px rgba(0,255,136,0.5)'}}>
                +{prizePoints} 💰
              </div>
            </div>
          </div>
        )}

        {/* ── INTERSTITIAL AD OVERLAY ──── */}
        {showInterstitial && (
          <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(0,0,0,0.9)'}}>
            <div className="text-center pop-in">
              <div className="text-sm text-gray-400 mb-4">פרסומת</div>
              <div className="w-72 h-48 rounded-2xl border-2 flex items-center justify-center mb-4"
                style={{borderColor:'rgba(255,170,0,0.3)',background:'rgba(255,170,0,0.05)'}}>
                <div className="text-center">
                  <div className="text-4xl mb-2">📢</div>
                  <div className="text-gray-400 text-sm">מקום לפרסומת</div>
                </div>
              </div>
              <div className="text-2xl font-black" style={{color:'#ffaa00',fontFamily:"'Orbitron',sans-serif"}}>{adCountdown}</div>
              <div className="text-xs text-gray-500 mt-1">ממשיכים עוד רגע...</div>
            </div>
          </div>
        )}

        {/* ── LEADERBOARD OVERLAY ─────────── */}
        {showLB && lbData && (
          <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center" style={{background:'rgba(5,5,16,0.96)',backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)',padding:16,overflow:'auto'}}>
            {/* Header */}
            <div className="text-center mb-4">
              <div className="text-5xl lb-icon-pop">{lbData.emoji}</div>
              <div className="text-2xl font-black mt-2 lb-shimmer" style={{fontFamily:"'Heebo',sans-serif"}}>{lbData.heading}</div>
              <div className="text-sm mt-1" style={{color:'rgba(255,255,255,0.5)'}}>הניקוד שלך: <span style={{color:'#00e5ff',fontFamily:"'Orbitron',sans-serif",fontWeight:800}}>{lbData.playerScore}</span></div>
            </div>

            {/* Table — top 3 */}
            <div className="w-full flex flex-col gap-2 mb-3" style={{maxWidth:400}}>
              {lbData.all.slice(0, 3).map((entry, i) => {
                const rank = i + 1;
                const isMe = entry.isMe;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
                const rowBg = isMe
                  ? 'linear-gradient(135deg,rgba(0,229,255,0.15),rgba(0,136,204,0.1))'
                  : rank === 1 ? 'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(245,158,11,0.06))'
                  : rank === 2 ? 'linear-gradient(135deg,rgba(148,163,184,0.1),rgba(100,116,139,0.05))'
                  : 'linear-gradient(135deg,rgba(251,146,60,0.1),rgba(194,65,12,0.05))';
                const borderCol = isMe ? '#00e5ff' : rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : '#fb923c';
                const rankBg = rank === 1 ? '#fbbf24' : rank === 2 ? '#94a3b8' : '#fb923c';
                const rankColor = rank <= 2 ? '#1c1917' : '#fff';
                return (
                  <div key={i} className="lb-row-slide flex items-center gap-3 rounded-2xl py-3 px-4"
                    style={{background:rowBg,border:`1.5px solid ${borderCol}`,animationDelay:(i*0.08)+'s',
                      boxShadow:isMe?'0 0 16px rgba(0,229,255,0.25)':'none'}}>
                    <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{width:34,height:34,background:rankBg,color:rankColor,fontSize:15,fontWeight:900}}>
                      {medal}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold truncate" style={{color:isMe?'#00e5ff':'#fff',fontFamily:"'Heebo',sans-serif"}}>
                        {entry.name}{isMe && <span className="text-xs mr-1" style={{color:'#00e5ff'}}> ← אתה!</span>}
                      </div>
                    </div>
                    <div className="text-lg font-black" style={{color:'#fbbf24',fontFamily:"'Orbitron',sans-serif"}}>{entry.score}</div>
                  </div>
                );
              })}

              {/* If player not in top 3 — show separator and player row */}
              {lbData.myRankDisplay > 3 && (
                <>
                  <div className="text-center text-lg" style={{color:'rgba(255,255,255,0.25)',letterSpacing:4}}>···</div>
                  <div className="lb-row-slide flex items-center gap-3 rounded-2xl py-3 px-4"
                    style={{background:'linear-gradient(135deg,rgba(0,229,255,0.15),rgba(0,136,204,0.1))',
                      border:'1.5px solid #00e5ff',boxShadow:'0 0 16px rgba(0,229,255,0.25)',
                      animationDelay:'0.3s'}}>
                    <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{width:34,height:34,background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)',fontSize:14,fontWeight:900}}>
                      {lbData.myRankDisplay}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-bold truncate" style={{color:'#00e5ff',fontFamily:"'Heebo',sans-serif"}}>
                        {playerName || DEFAULT_NAME} <span className="text-xs" style={{color:'#00e5ff'}}>← אתה!</span>
                      </div>
                    </div>
                    <div className="text-lg font-black" style={{color:'#fbbf24',fontFamily:"'Orbitron',sans-serif"}}>{lbData.playerScore}</div>
                  </div>
                </>
              )}
            </div>

            {/* Position summary */}
            <div className="w-full text-center py-3 px-5 rounded-2xl mb-4 lb-row-slide" style={{maxWidth:400,background:'rgba(0,229,255,0.08)',border:'2px solid rgba(0,229,255,0.3)',animationDelay:'0.35s'}}>
              <div className="text-sm font-bold" style={{color:'#a0d2db'}}>
                המיקום שלך: <span className="text-lg font-black" style={{color:'#fbbf24',fontFamily:"'Orbitron',sans-serif"}}>#{lbData.myRankDisplay}</span> מתוך <span style={{color:'#00e5ff'}}>{lbData.total}</span> שחקנים
              </div>
              {lbData.myRankDisplay > 1 ? (
                <div className="text-xs mt-1" style={{color:'rgba(255,255,255,0.35)'}}>🏆 ניקוד מקום ראשון: {lbData.topScore} נק׳</div>
              ) : (
                <div className="text-xs mt-1" style={{color:'#fbbf24'}}>🏆 אתה במקום הראשון!</div>
              )}
            </div>

            {/* Buttons */}
            <button onClick={shareDuelFromLB}
              className="w-full py-3 rounded-2xl text-lg font-bold border-2 btn-option lb-row-slide mb-2"
              style={{maxWidth:340,borderColor:'#25D366',color:'#25D366',background:'rgba(37,211,102,0.08)',
                boxShadow:'0 0 15px rgba(37,211,102,0.2)',animationDelay:'0.4s'}}>
              ⚔️ אתגר חבר בוואטסאפ
            </button>
            <button onClick={closeLB}
              className="w-full py-4 rounded-2xl text-xl font-black border-2 glow-box-cyan btn-option lb-row-slide"
              style={{maxWidth:340,borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)',animationDelay:'0.45s'}}>
              המשך ▶
            </button>
          </div>
        )}

        {/* ── DEFERRED NAME PROMPT MODAL ──── */}
        {showNameModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{background:'rgba(0,0,0,0.8)',padding:24}} onClick={(e)=>{if(e.target===e.currentTarget) skipNamePrompt();}}>
            <div className="pop-in w-full" style={{maxWidth:340,background:'linear-gradient(135deg,#0a0a2e,#1a0a3e)',borderRadius:24,padding:'32px 24px',textAlign:'center',border:'2px solid rgba(0,229,255,0.3)',boxShadow:'0 0 40px rgba(0,229,255,0.15)'}}>
              <div style={{fontSize:40,marginBottom:12}}>🏆</div>
              <div style={{fontSize:17,fontWeight:700,color:'#fff',marginBottom:6,lineHeight:1.5,fontFamily:"'Heebo',sans-serif"}}>
                סיבוב ראשון הושלם!
              </div>
              <div style={{fontSize:14,color:'#00e5ff',marginBottom:18,fontFamily:"'Heebo',sans-serif"}}>
                באיזה שם לרשום אותך בטבלת השיאים?
              </div>
              <input ref={nameInputRef} type="text" placeholder="הכנס את שמך ✏️"
                maxLength={15} autoComplete="off" dir="rtl"
                className="w-full outline-none"
                style={{padding:'14px 18px',background:'rgba(255,255,255,0.1)',border:'2px solid rgba(0,229,255,0.4)',borderRadius:14,color:'#fff',fontSize:18,fontWeight:700,textAlign:'center',boxSizing:'border-box',marginBottom:14,fontFamily:"'Heebo',sans-serif"}}
                onFocus={(e)=>{e.target.style.borderColor='#00e5ff';}}
                onKeyDown={(e)=>{if(e.key==='Enter') confirmNamePrompt(e.target.value);}}
              />
              <button onClick={()=>{if(nameInputRef.current) confirmNamePrompt(nameInputRef.current.value);}}
                className="w-full btn-option"
                style={{padding:14,background:'linear-gradient(135deg,#00e5ff,#0088cc)',border:'none',borderRadius:14,color:'#050510',fontSize:17,fontWeight:800,cursor:'pointer',marginBottom:8,fontFamily:"'Heebo',sans-serif"}}>
                ✅ זה אני!
              </button>
              <button onClick={skipNamePrompt}
                className="w-full btn-option"
                style={{padding:10,background:'transparent',border:'1px solid rgba(255,255,255,0.15)',borderRadius:14,color:'rgba(255,255,255,0.4)',fontSize:14,cursor:'pointer',fontFamily:"'Heebo',sans-serif"}}>
                אולי אחר כך
              </button>
            </div>
          </div>
        )}

        {/* ── ACHIEVEMENT TOAST ────────── */}
        {achToast && (
          <div className="ach-toast">
            <span style={{fontSize:24}}>{achToast.icon}</span>
            <span>{achToast.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
