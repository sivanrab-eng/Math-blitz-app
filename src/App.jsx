import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════
   מתמטיקה בלייז — MATH BLITZ v2
   Cyberpunk Math Game for Israeli 6th Graders
   Lives System + Multiple Topics + Geometry
   ═══════════════════════════════════════════════════ */

// ── Constants ────────────────────────────────
const MAX_LIVES = 5;
const START_LIVES = 3;
const REVIVE_COST = 100;
const REVIVE_INVITE_LIMIT = 2;
const ROUND_SIZE = 10;
const LIFE_EARN_STREAK = 7;
const AD_WATCH_SECONDS = 5; // simulated ad duration until real ads connected
const REVIVE_AD_LIMIT = 1;  // max free revives via ad per game

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

const playWrong = () => {
  try {
    const c = actx(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.type='sawtooth';
    o.frequency.setValueAtTime(200,c.currentTime);
    o.frequency.linearRampToValueAtTime(100,c.currentTime+0.25);
    g.gain.setValueAtTime(0.18,c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.3);
    o.start(c.currentTime); o.stop(c.currentTime+0.3);
    if(navigator.vibrate) navigator.vibrate(120);
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

// ── Math Utilities ───────────────────────────
const gcd = (a,b) => b===0 ? a : gcd(b, a%b);
const shuffle = (arr) => [...arr].sort(()=>Math.random()-0.5);
const randInt = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
const pick = (arr) => arr[Math.floor(Math.random()*arr.length)];

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
    let question, answer, label;
    if(diff === 'easy') {
      const w = randInt(3,12), h = randInt(3,12);
      if(randInt(0,1)) {
        question = 'שטח מלבן\n'+w+' \u00D7 '+h; answer = w*h; label = 'מה השטח?';
      } else {
        question = 'היקף מלבן\n'+w+' \u00D7 '+h; answer = 2*(w+h); label = 'מה ההיקף?';
      }
    } else if(diff === 'medium') {
      const type = randInt(0,2);
      if(type===0) {
        const base = randInt(4,14), height = randInt(3,10);
        question = 'שטח משולש\nבסיס='+base+' גובה='+height; answer = (base*height)/2; label = 'מה השטח?';
      } else if(type===1) {
        const side = randInt(3,15);
        if(randInt(0,1)) { question = 'שטח ריבוע\nצלע='+side; answer = side*side; label = 'מה השטח?'; }
        else { question = 'היקף ריבוע\nצלע='+side; answer = side*4; label = 'מה ההיקף?'; }
      } else {
        const base = randInt(4,12), height = randInt(3,8);
        question = 'שטח מקבילית\nבסיס='+base+' גובה='+height; answer = base*height; label = 'מה השטח?';
      }
    } else {
      if(randInt(0,1)) {
        const a = randInt(4,10), b = randInt(6,14), h = randInt(3,8);
        question = 'שטח טרפז\nבסיסים='+a+','+b+' גובה='+h; answer = (a+b)*h/2; label = 'מה השטח?';
      } else {
        const w1 = randInt(3,6), h1 = randInt(5,10), w2 = randInt(3,6), h2 = randInt(2,4);
        question = 'שטח צורה מורכבת\nמלבן '+w1+'\u00D7'+h1+'\n+ מלבן '+w2+'\u00D7'+h2; answer = w1*h1+w2*h2; label = 'מה השטח הכולל?';
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
    return { question, qLabel: '📐 הנדסה', aLabel: label, options: opts, correct: ansStr, correctIdx: opts.indexOf(ansStr) };
  }
};

// ── Topic 4: Angles ──────────────────────────
const topicAngles = {
  id: 'angles', name: 'זוויות', icon: '📏', color: '#ff66cc',
  generate(diff) {
    let question, answer, label='כמה מעלות?';
    if(diff === 'easy') {
      if(randInt(0,1)) {
        const a = randInt(15,75);
        question = 'זווית משלימה ל-'+a+'\u00B0'; answer = 90 - a;
      } else {
        const a = randInt(30,150);
        question = 'זווית צמודה ל-'+a+'\u00B0\n(סכום=180\u00B0)'; answer = 180 - a;
      }
    } else if(diff === 'medium') {
      const a = randInt(30,80), b = randInt(30, Math.min(80, 149-a));
      const c2 = 180 - a - b;
      question = 'במשולש:\nזווית א='+a+'\u00B0 זווית ב='+b+'\u00B0\nמה זווית ג?'; answer = c2;
    } else {
      if(randInt(0,1)) {
        const a = randInt(20,70), b = randInt(20,70);
        const c2 = 180 - a - b;
        if(c2 <= 0) return topicAngles.generate(diff);
        question = '3 זוויות על קו ישר:\n'+a+'\u00B0 + '+b+'\u00B0 + ?\u00B0 = 180\u00B0'; answer = c2;
      } else {
        const a = randInt(50,100), b = randInt(60,110), c2 = randInt(50,100);
        const d2 = 360 - a - b - c2;
        if(d2 <= 10) return topicAngles.generate(diff);
        question = 'במרובע:\n'+a+'\u00B0, '+b+'\u00B0, '+c2+'\u00B0, ?\u00B0'; answer = d2;
        label = 'מה הזווית הרביעית?';
      }
    }
    const ansStr = answer+'\u00B0';
    const wrongs = new Set();
    [answer+10, answer-10, answer+5, answer-15, answer+20, 180-answer].forEach(w => {
      if(w !== answer && w > 0 && w < 360) wrongs.add(w+'\u00B0');
    });
    while(wrongs.size < 3) wrongs.add(randInt(10,170)+'\u00B0');
    const distractors = [...wrongs].filter(w=>w!==ansStr).slice(0,3);
    const opts = shuffle([ansStr, ...distractors]);
    return { question, qLabel: '📏 זוויות', aLabel: label, options: opts, correct: ansStr, correctIdx: opts.indexOf(ansStr) };
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

// ── All Topics ───────────────────────────────
const ALL_TOPICS = [
  topicFractions, topicOrderOps, topicAreaPerimeter, topicAngles, topicPowers, topicRatio,
  topicMultDiv, topicSimpleFrac, topicSigned, topicEquations, topicPercent,
  topicAlgebra, topicPythagoras, topicLinearFunc, topicExpLaws, topicStats
];

// ── Grade → Topics Map ───────────────────────
const GRADES = {
  4: { label:'כיתה ד׳', topics:['multdiv','simplefrac','area'] },
  5: { label:'כיתה ה׳', topics:['fractions','orderops','area','angles'] },
  6: { label:'כיתה ו׳', topics:['fractions','orderops','area','angles','powers','ratio'] },
  7: { label:'כיתה ז׳', topics:['signed','equations','percent','powers','ratio'] },
  8: { label:'כיתה ח׳', topics:['algebra','equations','pythagoras','area','angles'] },
  9: { label:'כיתה ט׳', topics:['linear','explaws','stats','equations','percent'] },
};

const genQuestion = (diff, selectedTopicIds) => {
  const available = ALL_TOPICS.filter(t => selectedTopicIds.includes(t.id));
  if(available.length === 0) return topicFractions.generate(diff);
  return pick(available).generate(diff);
};

// ── LocalStorage helpers ─────────────────────
const loadBoard = () => {
  try { return JSON.parse(localStorage.getItem('math-blitz-lb')) || []; }
  catch { return []; }
};
const persistBoard = (b) => {
  try { localStorage.setItem('math-blitz-lb', JSON.stringify(b)); } catch {}
};

// ── Main Component ───────────────────────────
export default function App() {
  const [screen,setScreen] = useState('menu');
  const [score,setScore] = useState(0);
  const [streak,setStreak] = useState(0);
  const [maxStreak,setMaxStreak] = useState(0);
  const [question,setQuestion] = useState(null);
  const [timeLeft,setTimeLeft] = useState(10);
  const [feedback,setFeedback] = useState(null);
  const [selIdx,setSelIdx] = useState(null);
  const [board,setBoard] = useState([]);
  const [isHigh,setIsHigh] = useState(false);
  const [shaking,setShaking] = useState(false);
  const [answered,setAnswered] = useState(0);
  const [combo,setCombo] = useState('');
  const [lives,setLives] = useState(START_LIVES);
  const [breakingHeart,setBreakingHeart] = useState(false);
  const [selectedTopics,setSelectedTopics] = useState(['fractions','orderops','area','angles','powers','ratio']);
  const [invitesUsed,setInvitesUsed] = useState(0);
  const [grade,setGrade] = useState(6);
  const [roundNum,setRoundNum] = useState(1);
  const [roundCorrect,setRoundCorrect] = useState(0);
  const [gainedLife,setGainedLife] = useState(false);
  const [watchingAd,setWatchingAd] = useState(false);
  const [adCountdown,setAdCountdown] = useState(0);
  const [adsUsed,setAdsUsed] = useState(0);
  const [showInterstitial,setShowInterstitial] = useState(false);

  const gs = useRef({score:0,streak:0,maxStreak:0,wrongStreak:0,diff:'easy',dur:10,answered:0,lives:START_LIVES,invitesUsed:0,roundCorrect:0,adsUsed:0});
  const endTimeRef = useRef(0);
  const rafRef = useRef(null);
  const feedbackTimer = useRef(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    setBoard(loadBoard());
    return () => { cancelAnimationFrame(rafRef.current); clearTimeout(feedbackTimer.current); };
  },[]);

  const saveScore = () => {
    const g = gs.current;
    const entry = {s:g.score,st:g.maxStreak,q:g.answered,r:Math.ceil(g.answered/ROUND_SIZE),d:new Date().toLocaleDateString('he-IL'),id:Date.now()};
    const nb = [...board,entry].sort((a,b)=>b.s-a.s).slice(0,10);
    persistBoard(nb);
    setBoard(nb);
    setIsHigh(nb[0]?.id===entry.id);
  };

  const startGame = () => {
    gs.current = {score:0,streak:0,maxStreak:0,wrongStreak:0,diff:'easy',dur:10,answered:0,lives:START_LIVES,invitesUsed:0,roundCorrect:0,adsUsed:0,selectedTopics:[...selectedTopics]};
    setScore(0); setStreak(0); setMaxStreak(0); setAnswered(0);
    setLives(START_LIVES); setInvitesUsed(0); setAdsUsed(0);
    setRoundNum(1); setRoundCorrect(0); setGainedLife(false);
    setIsHigh(false); setFeedback(null); setSelIdx(null); setCombo('');
    setScreen('playing');
    nextQ();
  };

  const nextQ = () => {
    const q = genQuestion(gs.current.diff, gs.current.selectedTopics);
    setQuestion(q);
    setFeedback(null);
    setSelIdx(null);
    setTimeLeft(gs.current.dur);
    endTimeRef.current = Date.now() + gs.current.dur * 1000;
    lastTickRef.current = Math.ceil(gs.current.dur);
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
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
    playWrong();
    setFeedback('timeout');
    setShaking(true);
    setTimeout(()=>setShaking(false),400);
    const g = gs.current;
    g.streak = 0; g.wrongStreak++; g.answered++;
    if(g.wrongStreak >= 3) {
      g.dur = Math.min(g.dur*1.1,12); g.wrongStreak=0;
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
      feedbackTimer.current = setTimeout(nextQ, 1300);
    }
  };

  const checkRoundEnd = (delay) => {
    const g = gs.current;
    if(g.answered % ROUND_SIZE === 0 && g.answered > 0) {
      feedbackTimer.current = setTimeout(() => {
        cancelAnimationFrame(rafRef.current);
        playRoundComplete();
        setScreen('roundSummary');
      }, delay);
      return true;
    }
    return false;
  };

  const handleAnswer = (idx) => {
    if(feedback) return;
    cancelAnimationFrame(rafRef.current);
    setSelIdx(idx);
    const g = gs.current;
    g.answered++;

    if(idx === question.correctIdx) {
      playCorrect();
      setFeedback('correct');
      g.score += Math.max(10, Math.round(timeLeft * 10));
      g.streak++; g.wrongStreak = 0;
      g.roundCorrect++;
      if(g.streak > g.maxStreak) g.maxStreak = g.streak;
      g.dur = Math.max(g.dur * 0.95, 3);
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

      const combos = ['\u{1F525}','\u26A1','\u{1F4A5}','\u{1F680}','\u2728','\u{1F31F}'];
      setCombo(combos[Math.min(g.streak, combos.length-1)] || '\u{1F525}');
      setScore(g.score); setStreak(g.streak); setMaxStreak(g.maxStreak); setAnswered(g.answered); setRoundCorrect(g.roundCorrect);
      if(!checkRoundEnd(800)) {
        feedbackTimer.current = setTimeout(nextQ, 800);
      }
    } else {
      playWrong();
      setFeedback('wrong');
      setShaking(true);
      setTimeout(()=>setShaking(false),400);
      g.streak = 0; g.wrongStreak++;
      if(g.wrongStreak >= 3) {
        g.dur = Math.min(g.dur*1.1,12); g.wrongStreak=0;
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
        feedbackTimer.current = setTimeout(nextQ, 1300);
      }
    }
  };

  const reviveWithPoints = () => {
    const g = gs.current;
    if(g.score >= REVIVE_COST) {
      g.score -= REVIVE_COST;
      g.lives = 1;
      setScore(g.score);
      setLives(1);
      playRevive();
      setScreen('playing');
      nextQ();
    }
  };

  const reviveWithInvite = () => {
    const g = gs.current;
    if(g.invitesUsed < REVIVE_INVITE_LIMIT) {
      const txt = '\u{1F9E0}\u26A1 \u05DE\u05EA\u05DE\u05D8\u05D9\u05E7\u05D4 \u05D1\u05DC\u05D9\u05D9\u05D6 \u26A1\u{1F9E0}\n\n\u05D0\u05EA\u05D2\u05E8! \u05D4\u05E9\u05D2\u05EA\u05D9 '+g.score+' \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA! \u{1F525}\n\u05EA\u05E0\u05E1\u05D4 \u05DC\u05E0\u05E6\u05D7 \u05D0\u05D5\u05EA\u05D9?\n\n\u05E9\u05D7\u05E7 \u05E2\u05DB\u05E9\u05D9\u05D5:\nhttps://sivanrab-eng.github.io/Math-blitz-app/';
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

  const endGame = () => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(feedbackTimer.current);
    setScreen('gameover');
    saveScore();
  };

  const continueNextRound = () => {
    const g = gs.current;
    g.roundCorrect = 0;
    setRoundCorrect(0);
    setRoundNum(prev => prev + 1);
    setFeedback(null); setSelIdx(null);
    // Show interstitial ad every 2 rounds
    const nextRound = Math.ceil(g.answered / ROUND_SIZE) + 1;
    if(nextRound % 2 === 0) {
      showInterstitialAd(() => { setScreen('playing'); nextQ(); });
    } else {
      setScreen('playing');
      nextQ();
    }
  };

  const shareWhatsApp = () => {
    const g = gs.current;
    const rounds = Math.ceil(g.answered/ROUND_SIZE);
    const txt = '\u{1F9E0}\u26A1 \u05DE\u05EA\u05DE\u05D8\u05D9\u05E7\u05D4 \u05D1\u05DC\u05D9\u05D9\u05D6 \u26A1\u{1F9E0}\n\n\u05D4\u05E9\u05D2\u05EA\u05D9 '+g.score+' \u05E0\u05E7\u05D5\u05D3\u05D5\u05EA! \u{1F525}\n\u05E8\u05E6\u05E3 \u05D4\u05DB\u05D9 \u05D0\u05E8\u05D5\u05DA: '+g.maxStreak+' \u2728\n\u05E2\u05E0\u05D9\u05EA\u05D9 \u05E2\u05DC '+g.answered+' \u05E9\u05D0\u05DC\u05D5\u05EA \u05D1-'+rounds+' \u05E1\u05D9\u05D1\u05D5\u05D1\u05D9\u05DD \u{1F4CA}\n\n\u05D0\u05EA/\u05D4 \u05D9\u05DB\u05D5\u05DC/\u05D4 \u05DC\u05E0\u05E6\u05D7 \u05D0\u05D5\u05EA\u05D9? \u{1F60F}\n\u05E0\u05E1\u05D4 \u05E2\u05DB\u05E9\u05D9\u05D5:\nhttps://sivanrab-eng.github.io/Math-blitz-app/';
    window.open('https://wa.me/?text='+encodeURIComponent(txt),'_blank');
  };

  const changeGrade = (g) => {
    setGrade(g);
    const gradeTopics = GRADES[g].topics;
    setSelectedTopics([...gradeTopics]);
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
              <p className="text-sm text-gray-400 text-center mb-2">בחר נושאים:</p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_TOPICS.filter(t => GRADES[grade].topics.includes(t.id)).map(t => {
                  const sel = selectedTopics.includes(t.id);
                  return (
                    <button key={t.id} onClick={()=>toggleTopic(t.id)}
                      className="topic-chip rounded-xl py-2 px-2.5 text-xs font-bold border-2 text-right leading-tight"
                      style={{
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
                <span>⏱ 10 שניות</span>
                <span className="text-gray-600 mx-1">•</span>
                <span>{ROUND_SIZE} שאלות בסיבוב</span>
              </div>
              <div className="text-xs text-gray-500">{LIFE_EARN_STREAK} נכונות ברצף = +❤️ בונוס (עד {MAX_LIVES})</div>
            </div>

            <button onClick={startGame}
              className="w-64 py-4 rounded-2xl text-xl font-black border-2 glow-box-cyan btn-option slide-up"
              style={{borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)',animationDelay:'0.15s'}}>
              התחל משחק ⚡
            </button>
            <button onClick={()=>setScreen('leaderboard')}
              className="w-64 py-3 rounded-2xl text-lg font-bold border-2 glow-box-pink btn-option slide-up"
              style={{borderColor:'#ff0080',color:'#ff0080',background:'rgba(255,0,128,0.06)',animationDelay:'0.2s'}}>
              טבלת שיאים 🏆
            </button>
            <p className="text-xs text-gray-600 mt-1 slide-up" style={{animationDelay:'0.25s'}}>{GRADES[grade].label} • מתמטיקה והנדסה</p>
          </div>
        )}

        {/* ── PLAYING ───────────────────── */}
        {screen === 'playing' && question && (
          <div className="flex-1 flex flex-col px-4 pt-6 pb-6 max-w-lg mx-auto w-full">
            {/* Row 1: Lives centered prominently */}
            <div className="flex items-center justify-center gap-1.5 mb-2">
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
              <div className="flex items-center gap-2">
                {streak > 0 && (
                  <span className="text-sm font-bold" style={{color:'#ff0080',fontFamily:"'Orbitron',sans-serif"}}>{streak}{combo}</span>
                )}
                <span className="text-xl font-black glow-cyan" style={{color:'#00e5ff',fontFamily:"'Orbitron',sans-serif"}}>{score}</span>
              </div>
            </div>

            {/* Timer Bar */}
            <div className="w-full h-2 rounded-full bg-gray-900 mb-4 overflow-hidden border border-gray-800">
              <div className="h-full rounded-full"
                style={{width:(timerFrac*100)+'%',background:timerColor,boxShadow:'0 0 12px '+timerColor,transition:'width 0.1s linear, background-color 0.3s'}}/>
            </div>

            <div className="text-center mb-1">
              <span className="text-xs text-gray-500">{Math.ceil(timeLeft)} שניות</span>
            </div>

            <div className="text-center mb-3">
              <span className="text-sm font-bold px-4 py-1 rounded-full border"
                style={{borderColor:'rgba(0,229,255,0.3)',color:'#00e5ff',background:'rgba(0,229,255,0.05)'}}>
                {question.aLabel}
              </span>
            </div>

            {/* Question Card */}
            <div className="mx-auto mb-6 pop-in w-full">
              <div className="rounded-3xl px-8 py-6 text-center border-2"
                style={{borderColor:'rgba(0,229,255,0.2)',background:'rgba(8,8,35,0.85)',boxShadow:'0 0 40px rgba(0,229,255,0.1)'}}>
                {question.qLabel && <div className="text-xs text-gray-500 mb-2">{question.qLabel}</div>}
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize: question.question.length > 25 ? '1.2rem' : question.question.length > 15 ? '1.6rem' : question.question.length > 8 ? '2.2rem' : '3rem', whiteSpace:'pre-line', lineHeight:1.4}}
                  className="font-black glow-cyan tracking-wide" dir="ltr">
                  {question.question}
                </div>
              </div>
              {combo && <div className="text-center text-2xl mt-2 pop-in">{combo}</div>}
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-2 gap-3 mt-auto">
              {question.options.map((opt,i) => {
                let borderC = 'rgba(255,255,255,0.12)';
                let bgC = 'rgba(255,255,255,0.03)';
                let extraClass = '';
                if(feedback && i === question.correctIdx) { borderC='#00e5ff'; bgC='rgba(0,229,255,0.12)'; extraClass='correct-anim'; }
                else if(feedback === 'wrong' && i === selIdx) { borderC='#ff0080'; bgC='rgba(255,0,128,0.12)'; extraClass='wrong-anim'; }
                else if(feedback === 'timeout' && i === question.correctIdx) { borderC='#00e5ff'; bgC='rgba(0,229,255,0.08)'; }

                return (
                  <button key={i} onClick={()=>handleAnswer(i)} disabled={!!feedback}
                    className={'rounded-2xl py-5 text-center border-2 btn-option slide-up '+extraClass}
                    style={{borderColor:borderC,background:bgC,animationDelay:(i*0.06)+'s',
                      color: feedback && i===question.correctIdx ? '#00e5ff' : feedback==='wrong'&&i===selIdx ? '#ff0080' : '#fff'}}>
                    <span dir="ltr" className="text-xl font-bold" style={{fontFamily:"'Orbitron',sans-serif"}}>{opt}</span>
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className="text-center mt-4 pop-in">
                {feedback==='correct' && <span className="text-lg font-black" style={{color:'#00e5ff'}}>נכון! 🎯 +{Math.max(10,Math.round(timeLeft*10))}</span>}
                {feedback==='wrong' && <span className="text-lg font-black" style={{color:'#ff0080'}}>לא נכון 😬 ❤️‍🩹</span>}
                {feedback==='timeout' && <span className="text-lg font-black" style={{color:'#ff0080'}}>נגמר הזמן! ⏰ ❤️‍🩹</span>}
              </div>
            )}
            {gainedLife && (
              <div className="text-center mt-2 pop-in">
                <span className="text-lg font-black" style={{color:'#ff0080',textShadow:'0 0 12px rgba(255,0,128,0.5)'}}>+❤️ חיים בונוס! 🎉</span>
              </div>
            )}
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
            <button onClick={()=>{saveScore(); setScreen('gameover');}}
              className="py-3 px-8 rounded-2xl text-base font-bold border-2 btn-option slide-up"
              style={{borderColor:'#ff0080',color:'#ff0080',background:'rgba(255,0,128,0.06)',animationDelay:'0.3s'}}>
              סיים משחק 🏁
            </button>
          </div>
        )}

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

            <p className="text-sm text-gray-400 text-center slide-up" style={{animationDelay:'0.1s'}}>
              רוצה להמשיך לשחק?
            </p>

            {/* Buy life with points */}
            {gs.current.score >= REVIVE_COST ? (
              <button onClick={reviveWithPoints}
                className="w-72 py-4 rounded-2xl text-lg font-black border-2 btn-option slide-up revive-pulse"
                style={{borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)',animationDelay:'0.15s'}}>
                <div>קנה חיים ❤️</div>
                <div className="text-sm font-bold mt-1" style={{color:'#ffaa00'}}>עולה {REVIVE_COST} נקודות 💰</div>
              </button>
            ) : (
              <div className="w-72 py-4 rounded-2xl text-center border-2 slide-up opacity-40"
                style={{borderColor:'#333',color:'#666',background:'rgba(255,255,255,0.02)',animationDelay:'0.15s'}}>
                <div>קנה חיים ❤️</div>
                <div className="text-sm mt-1">צריך {REVIVE_COST} נקודות (יש לך {gs.current.score})</div>
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

            <button onClick={()=>{saveScore(); setScreen('gameover');}}
              className="py-3 px-8 rounded-2xl text-base font-bold border-2 btn-option slide-up"
              style={{borderColor:'#ff0080',color:'#ff0080',background:'rgba(255,0,128,0.06)',animationDelay:'0.3s'}}>
              סיים משחק 🏁
            </button>
          </div>
        )}

        {/* ── GAME OVER ─────────────────── */}
        {screen === 'gameover' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
            {isHigh && (
              <div className="pop-in text-center mb-2">
                <div className="text-3xl mb-1">🏆</div>
                <p className="text-xl font-black glow-pink" style={{color:'#ff0080'}}>שיא חדש!</p>
              </div>
            )}
            <div className="pop-in text-center">
              <p className="text-sm text-gray-400 mb-1">המשחק נגמר</p>
              <div style={{fontFamily:"'Orbitron',sans-serif"}} className="text-6xl font-black glow-cyan">{gs.current.score}</div>
              <p className="text-sm text-gray-400 mt-1">נקודות</p>
            </div>
            <div className="flex gap-6 slide-up" style={{animationDelay:'0.1s'}}>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{color:'#ff0080',fontFamily:"'Orbitron',sans-serif"}}>{gs.current.maxStreak}</div>
                <div className="text-xs text-gray-500">רצף מקסימלי</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{color:'#00e5ff',fontFamily:"'Orbitron',sans-serif"}}>{gs.current.answered}</div>
                <div className="text-xs text-gray-500">שאלות</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{color:'#ffaa00',fontFamily:"'Orbitron',sans-serif"}}>{Math.ceil(gs.current.answered/ROUND_SIZE)}</div>
                <div className="text-xs text-gray-500">סיבובים</div>
              </div>
            </div>
            <button onClick={shareWhatsApp}
              className="w-64 py-3 rounded-2xl text-lg font-bold border-2 btn-option slide-up"
              style={{borderColor:'#25D366',color:'#25D366',background:'rgba(37,211,102,0.08)',animationDelay:'0.15s',boxShadow:'0 0 15px rgba(37,211,102,0.2)'}}>
              שתף בוואטסאפ 📱
            </button>
            <button onClick={startGame}
              className="w-64 py-4 rounded-2xl text-xl font-black border-2 glow-box-cyan btn-option slide-up"
              style={{borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)',animationDelay:'0.25s'}}>
              שחק שוב ⚡
            </button>
            <button onClick={()=>setScreen('leaderboard')}
              className="text-sm text-gray-500 underline slide-up btn-option" style={{animationDelay:'0.3s'}}>
              טבלת שיאים 🏆
            </button>
            <button onClick={()=>setScreen('menu')}
              className="text-xs text-gray-600 slide-up btn-option" style={{animationDelay:'0.35s'}}>
              תפריט ראשי
            </button>
          </div>
        )}

        {/* ── LEADERBOARD ───────────────── */}
        {screen === 'leaderboard' && (
          <div className="flex-1 flex flex-col px-6 pt-8 pb-6 max-w-lg mx-auto w-full">
            <div className="flex items-center justify-between mb-6">
              <button onClick={()=>setScreen('menu')} className="text-gray-500 text-sm px-3 py-1 rounded-lg border border-gray-800 btn-option">
                חזרה ←
              </button>
              <h2 className="text-xl font-black glow-pink" style={{color:'#ff0080'}}>🏆 טבלת שיאים</h2>
              <div className="w-16"/>
            </div>
            {board.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-600 text-center">עדיין אין שיאים<br/>שחק כדי להיכנס לטבלה!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {board.map((e,i) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl py-3 px-4 border slide-up"
                    style={{borderColor: i===0 ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.06)',
                      background: i===0 ? 'rgba(0,229,255,0.05)' : 'rgba(255,255,255,0.02)',
                      animationDelay:(i*0.05)+'s'}}>
                    <span className="text-lg font-bold w-8 text-center" style={{color:i===0?'#00e5ff':i===1?'#ff0080':'#888',fontFamily:"'Orbitron',sans-serif"}}>
                      {i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
                    </span>
                    <div className="flex-1">
                      <span className="font-bold" style={{fontFamily:"'Orbitron',sans-serif",color:i===0?'#00e5ff':'#fff'}}>{e.s}</span>
                      <span className="text-xs text-gray-500 mr-2">נקודות</span>
                    </div>
                    <div className="text-left text-xs text-gray-500">
                      <div>רצף {e.st} 🔥</div>
                      <div>{e.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={startGame}
              className="mt-auto w-full py-4 rounded-2xl text-xl font-black border-2 glow-box-cyan btn-option"
              style={{borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)'}}>
              שחק עכשיו ⚡
            </button>
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
      </div>
    </div>
  );
}
