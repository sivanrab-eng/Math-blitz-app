import { useState, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════
   מתמטיקה בלייז — MATH BLITZ
   Cyberpunk Math Game for Israeli 6th Graders
   ═══════════════════════════════════════════════════ */

// ── Fraction Pools by Difficulty ──────────
const POOLS = {
  easy: [
    {n:1,d:2},{n:1,d:4},{n:3,d:4},{n:1,d:5},{n:2,d:5},
    {n:3,d:5},{n:1,d:10},{n:3,d:10},{n:7,d:10},{n:9,d:10},
  ],
  medium: [
    {n:1,d:3},{n:2,d:3},{n:3,d:8},{n:5,d:8},{n:7,d:8},
    {n:4,d:5},{n:1,d:8},{n:7,d:20},{n:3,d:20},
  ],
  hard: [
    {n:5,d:6},{n:7,d:12},{n:11,d:20},{n:3,d:16},{n:7,d:16},
    {n:5,d:12},{n:9,d:20},{n:11,d:25},{n:13,d:20},
  ],
};

// ── Sound Engine (Web Audio API) ──────────
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

// ── Math Utilities ────────────────────────
const gcd = (a,b) => b===0 ? a : gcd(b, a%b);
const FORMATS = ['fraction','decimal','percent'];
const FMT_LABEL = { fraction:'שבר', decimal:'עשרוני', percent:'אחוזים' };

const fmt = (n,d,f) => {
  if(f==='fraction') return `${n}/${d}`;
  const v = n/d;
  if(f==='decimal') return (Math.round(v*10000)/10000).toString();
  const p = Math.round(v*10000)/100;
  return Number.isInteger(p) ? `${p}%` : `${p}%`;
};

const genDistractors = (correct, format, n, d) => {
  const set = new Set();
  const v = n/d;
  let tries = 0;
  while(set.size < 3 && tries < 80) {
    tries++;
    let w;
    if(format==='decimal') {
      const off = [0.05,0.1,0.15,0.2,0.25,-0.05,-0.1,-0.15,-0.2,-0.25,0.03,-0.03];
      const o = off[Math.floor(Math.random()*off.length)];
      const wv = Math.round((v+o)*10000)/10000;
      if(wv<=0||wv>=1.5) continue;
      w = wv.toString();
    } else if(format==='percent') {
      const off = [5,10,15,20,25,-5,-10,-15,-20,8,-8,12,-12,3,-3];
      const o = off[Math.floor(Math.random()*off.length)];
      let wv = Math.round((v*100+o)*100)/100;
      if(wv<=0||wv>100) continue;
      w = Number.isInteger(wv) ? `${wv}%` : `${wv}%`;
    } else {
      const vars = [[n+1,d],[n-1,d],[n,d+1],[n,d-1],[n+2,d],[n,d+2],[n*2,d+1],[d-n,d]];
      const [wn,wd] = vars[Math.floor(Math.random()*vars.length)];
      if(wn<=0||wd<=0||wn>=wd*2) continue;
      const g = gcd(Math.abs(wn),Math.abs(wd));
      w = `${wn/g}/${wd/g}`;
    }
    if(w && w !== correct) set.add(w);
  }
  while(set.size < 3) {
    if(format==='percent') set.add(`${Math.floor(Math.random()*90)+5}%`);
    else if(format==='decimal') set.add((Math.floor(Math.random()*900+50)/1000).toString());
    else set.add(`${Math.floor(Math.random()*7)+1}/${Math.floor(Math.random()*8)+2}`);
  }
  return [...set].slice(0,3);
};

const genQuestion = (diff) => {
  const pool = POOLS[diff];
  const {n,d} = pool[Math.floor(Math.random()*pool.length)];
  const qf = FORMATS[Math.floor(Math.random()*3)];
  let af; do { af = FORMATS[Math.floor(Math.random()*3)]; } while(af===qf);
  const qText = fmt(n,d,qf);
  const correct = fmt(n,d,af);
  const distractors = genDistractors(correct,af,n,d);
  const opts = [correct,...distractors].sort(()=>Math.random()-0.5);
  return { question:qText, qFormat:qf, aFormat:af, options:opts, correct, correctIdx:opts.indexOf(correct) };
};

// ── LocalStorage helpers ──────────────────
const loadBoard = () => {
  try { return JSON.parse(localStorage.getItem('math-blitz-lb')) || []; }
  catch { return []; }
};
const persistBoard = (b) => {
  try { localStorage.setItem('math-blitz-lb', JSON.stringify(b)); } catch {}
};

// ── Main Component ────────────────────────
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

  const gs = useRef({score:0,streak:0,maxStreak:0,wrongStreak:0,diff:'easy',dur:10,answered:0});
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
    const entry = {s:g.score,st:g.maxStreak,q:g.answered,d:new Date().toLocaleDateString('he-IL'),id:Date.now()};
    const nb = [...board,entry].sort((a,b)=>b.s-a.s).slice(0,10);
    persistBoard(nb);
    setBoard(nb);
    setIsHigh(nb[0]?.id===entry.id);
  };

  const startGame = () => {
    gs.current = {score:0,streak:0,maxStreak:0,wrongStreak:0,diff:'easy',dur:10,answered:0};
    setScore(0); setStreak(0); setMaxStreak(0); setAnswered(0);
    setIsHigh(false); setFeedback(null); setSelIdx(null); setCombo('');
    setScreen('playing');
    nextQ();
  };

  const nextQ = () => {
    const q = genQuestion(gs.current.diff);
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
    feedbackTimer.current = setTimeout(nextQ, 1300);
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
      if(g.streak > g.maxStreak) g.maxStreak = g.streak;
      g.dur = Math.max(g.dur * 0.95, 3);
      if(g.streak >= 5 && g.diff==='easy') { g.diff='medium'; g.streak=0; }
      else if(g.streak >= 5 && g.diff==='medium') { g.diff='hard'; g.streak=0; }

      const combos = ['🔥','⚡','💥','🚀','✨','🌟'];
      setCombo(combos[Math.min(g.streak, combos.length-1)] || '🔥');
      setScore(g.score); setStreak(g.streak); setMaxStreak(g.maxStreak); setAnswered(g.answered);
      feedbackTimer.current = setTimeout(nextQ, 800);
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
      feedbackTimer.current = setTimeout(nextQ, 1300);
    }
  };

  const endGame = () => {
    cancelAnimationFrame(rafRef.current);
    clearTimeout(feedbackTimer.current);
    setScreen('gameover');
    saveScore();
  };

  const shareWhatsApp = () => {
    const g = gs.current;
    const txt = `🧠⚡ מתמטיקה בלייז ⚡🧠\n\nהשגתי ${g.score} נקודות! 🔥\nרצף הכי ארוך: ${g.maxStreak} ✨\nעניתי על ${g.answered} שאלות 📊\n\nאת/ה יכול/ה לנצח אותי? 😏\nנסה עכשיו!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`,'_blank');
  };

  const timerFrac = question ? timeLeft / gs.current.dur : 1;
  const timerColor = timerFrac > 0.5 ? '#00e5ff' : timerFrac > 0.25 ? '#ffaa00' : '#ff0080';

  return (
    <div dir="rtl" style={{fontFamily:"'Heebo',sans-serif"}}
      className={`min-h-[100svh] bg-[#050510] text-white overflow-hidden relative ${shaking?'animate-shake':''}`}>
      {/* Injected CSS */}
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
        @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}
        @keyframes popIn{0%{transform:scale(0.7);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
        @keyframes slideUp{0%{transform:translateY(30px);opacity:0}100%{transform:translateY(0);opacity:1}}
        @keyframes correctFlash{0%{box-shadow:0 0 0 rgba(0,229,255,0)}50%{box-shadow:0 0 40px rgba(0,229,255,0.6)}100%{box-shadow:0 0 15px rgba(0,229,255,0.3)}}
        @keyframes wrongFlash{0%{box-shadow:0 0 0 rgba(255,0,128,0)}50%{box-shadow:0 0 40px rgba(255,0,128,0.6)}100%{box-shadow:0 0 15px rgba(255,0,128,0.3)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes gridMove{0%{background-position:0 0}100%{background-position:50px 50px}}
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
      `}</style>

      {/* Background effects */}
      <div className="grid-bg fixed inset-0 pointer-events-none"/>
      <div className="fixed top-0 left-0 right-0 h-40 pointer-events-none" style={{background:'radial-gradient(ellipse at 50% 0%,rgba(0,229,255,0.08) 0%,transparent 70%)'}}/>
      <div className="fixed bottom-0 left-0 right-0 h-40 pointer-events-none" style={{background:'radial-gradient(ellipse at 50% 100%,rgba(255,0,128,0.06) 0%,transparent 70%)'}}/>

      <div className="relative z-10 min-h-[100svh] flex flex-col">

        {/* ── MENU ──────────────────────── */}
        {screen === 'menu' && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
            <div className="pop-in text-center">
              <h1 style={{fontFamily:"'Orbitron',sans-serif"}} className="text-4xl font-black glow-cyan tracking-wider mb-1">
                MATH BLITZ
              </h1>
              <p className="text-lg font-bold glow-pink" style={{color:'#ff0080'}}>מתמטיקה בלייז</p>
              <p className="text-sm mt-3 text-gray-400">מצא את הערך השווה — שברים, עשרוניים ואחוזים</p>
            </div>
            <div className="float-anim" style={{fontSize:'4rem',lineHeight:1}}>🧠</div>
            <button onClick={startGame}
              className="w-64 py-4 rounded-2xl text-xl font-black border-2 glow-box-cyan btn-option slide-up"
              style={{borderColor:'#00e5ff',color:'#00e5ff',background:'rgba(0,229,255,0.08)',animationDelay:'0.1s'}}>
              התחל משחק ⚡
            </button>
            <button onClick={()=>setScreen('leaderboard')}
              className="w-64 py-3 rounded-2xl text-lg font-bold border-2 glow-box-pink btn-option slide-up"
              style={{borderColor:'#ff0080',color:'#ff0080',background:'rgba(255,0,128,0.06)',animationDelay:'0.2s'}}>
              טבלת שיאים 🏆
            </button>
            <p className="text-xs text-gray-600 mt-4 slide-up" style={{animationDelay:'0.3s'}}>כיתה ו׳ • שברים עשרוניים אחוזים</p>
          </div>
        )}

        {/* ── PLAYING ───────────────────── */}
        {screen === 'playing' && question && (
          <div className="flex-1 flex flex-col px-4 pt-3 pb-6 max-w-lg mx-auto w-full">
            <div className="flex items-center justify-between mb-2">
              <button onClick={endGame} className="text-gray-500 text-sm px-3 py-1 rounded-lg border border-gray-800 btn-option">
                סיום ✕
              </button>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-xs text-gray-500">רצף</div>
                  <div className="text-lg font-bold" style={{color:'#ff0080',fontFamily:"'Orbitron',sans-serif"}}>{streak}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">ניקוד</div>
                  <div className="text-2xl font-black glow-cyan" style={{color:'#00e5ff',fontFamily:"'Orbitron',sans-serif"}}>{score}</div>
                </div>
              </div>
            </div>

            {/* Timer Bar */}
            <div className="w-full h-2 rounded-full bg-gray-900 mb-6 overflow-hidden border border-gray-800">
              <div className="h-full rounded-full"
                style={{width:`${timerFrac*100}%`,background:timerColor,boxShadow:`0 0 12px ${timerColor}`,transition:'width 0.1s linear, background-color 0.3s'}}/>
            </div>

            <div className="text-center mb-1">
              <span className="text-xs text-gray-500">{Math.ceil(timeLeft)} שניות</span>
            </div>

            <div className="text-center mb-3">
              <span className="text-sm font-bold px-4 py-1 rounded-full border"
                style={{borderColor:'rgba(0,229,255,0.3)',color:'#00e5ff',background:'rgba(0,229,255,0.05)'}}>
                מצא את ה{FMT_LABEL[question.aFormat]} השווה
              </span>
            </div>

            {/* Question Card */}
            <div className="mx-auto mb-8 pop-in">
              <div className="rounded-3xl px-10 py-8 text-center border-2"
                style={{borderColor:'rgba(0,229,255,0.2)',background:'rgba(8,8,35,0.85)',boxShadow:'0 0 40px rgba(0,229,255,0.1)'}}>
                <div className="text-xs text-gray-500 mb-2">{FMT_LABEL[question.qFormat]}</div>
                <div style={{fontFamily:"'Orbitron',sans-serif",fontSize: question.question.length > 8 ? '2.5rem' : '3.5rem'}}
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
                    className={`rounded-2xl py-5 text-center border-2 btn-option slide-up ${extraClass}`}
                    style={{borderColor:borderC,background:bgC,animationDelay:`${i*0.06}s`,
                      color: feedback && i===question.correctIdx ? '#00e5ff' : feedback==='wrong'&&i===selIdx ? '#ff0080' : '#fff'}}>
                    <span dir="ltr" className="text-xl font-bold" style={{fontFamily:"'Orbitron',sans-serif"}}>{opt}</span>
                  </button>
                );
              })}
            </div>

            {feedback && (
              <div className="text-center mt-4 pop-in">
                {feedback==='correct' && <span className="text-lg font-black" style={{color:'#00e5ff'}}>נכון! 🎯 +{Math.max(10,Math.round(timeLeft*10))}</span>}
                {feedback==='wrong' && <span className="text-lg font-black" style={{color:'#ff0080'}}>לא נכון 😬</span>}
                {feedback==='timeout' && <span className="text-lg font-black" style={{color:'#ff0080'}}>נגמר הזמן! ⏰</span>}
              </div>
            )}
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
            <div className="flex gap-8 slide-up" style={{animationDelay:'0.1s'}}>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{color:'#ff0080',fontFamily:"'Orbitron',sans-serif"}}>{gs.current.maxStreak}</div>
                <div className="text-xs text-gray-500">רצף מקסימלי</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{color:'#00e5ff',fontFamily:"'Orbitron',sans-serif"}}>{gs.current.answered}</div>
                <div className="text-xs text-gray-500">שאלות</div>
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
                      animationDelay:`${i*0.05}s`}}>
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
      </div>
    </div>
  );
}
