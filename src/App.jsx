/* eslint-disable no-unused-vars */
import { useState, useCallback, useEffect, useRef, Fragment } from "react";

// Animated counter hook
function useAnimatedCounter(target, duration=1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if(!target) return;
    let start=null;
    const step=(ts)=>{
      if(!start)start=ts;
      const p=Math.min((ts-start)/duration,1);
      const ease=1-Math.pow(1-p,3);
      setVal(parseFloat((ease*target).toFixed(2)));
      if(p<1)requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },[target]);
  return val;
}

// Animated money display component
function AnimatedMoney({value, delay=0}) {
  const [show, setShow] = useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setShow(true),delay); return()=>clearTimeout(t); },[delay]);
  const abs = Math.abs(value);
  const animated = useAnimatedCounter(show ? abs : 0, 900);
  const dollars = Math.floor(animated);
  const cents = Math.round((animated - dollars) * 100).toString().padStart(2,'0');
  if(value === 0) return <span style={{color:"#9ca3af"}}>$0.00</span>;
  return (
    <span style={{fontVariantNumeric:"tabular-nums"}}>
      {value > 0 ? "+" : "-"}${dollars}<span style={{fontSize:"0.75em",opacity:.7}}>.{cents}</span>
    </span>
  );
}


// Request browser notification permission
const requestNotifPerms = () => { if('Notification' in window && Notification.permission==='default') Notification.requestPermission(); };
const sendNotif = (title, body) => { if('Notification' in window && Notification.permission==='granted') new Notification(title,{body,icon:'/favicon.ico'}); };


// Responsive hook
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 980);
  useEffect(() => {
    const handler = () => setW(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return w;
}

// Countdown hook - returns {h, m, s, urgent, expired}
function useCountdown(targetDateStr, targetTimeStr) {
  const getRemaining = () => {
    if (!targetDateStr || !targetTimeStr) return null;
    const target = new Date(`${targetDateStr}T${targetTimeStr}:00`);
    const diff = target - Date.now();
    if (diff <= 0) return { h:0, m:0, s:0, expired:true, urgent:false };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { h, m, s, expired:false, urgent: diff < 7200000 }; // urgent if < 2hrs
  };
  const [remaining, setRemaining] = useState(getRemaining);
  useEffect(() => {
    const t = setInterval(() => setRemaining(getRemaining()), 1000);
    return () => clearInterval(t);
  }, [targetDateStr, targetTimeStr]);
  return remaining;
}

// Confetti component
function Confetti() {
  const pieces = Array.from({length:60}, (_,i) => ({
    id:i,
    x: Math.random()*100,
    delay: Math.random()*3,
    dur: 2 + Math.random()*2,
    color: ["#1e5c1e","#d4a017","#dc2626","#2563eb","#16803a","#b8860b"][i%6],
    size: 6 + Math.random()*8,
    spin: Math.random()*360,
  }));
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9998,overflow:"hidden"}}>
      {pieces.map(p=>(
        <div key={p.id} style={{
          position:"absolute",
          left:`${p.x}%`,
          top:-20,
          width:p.size,
          height:p.size,
          background:p.color,
          borderRadius:p.size>10?'50%':2,
          animation:`confettiFall ${p.dur}s ${p.delay}s ease-in forwards`,
          transform:`rotate(${p.spin}deg)`,
        }}/>
      ))}
      <style>{`@keyframes confettiFall{from{top:-20px;opacity:1}to{top:110vh;opacity:0;transform:rotate(720deg);}}`}</style>
    </div>
  );
}

// --- SUPABASE -----------------------------------------------------------------
const SUPA_URL = "https://yhohlsqiedzpxumqhppb.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlob2hsc3FpZWR6cHh1bXFocHBiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNTA3OTMsImV4cCI6MjA5MjcyNjc5M30.Yvf-ooW0Ti0TCcmZg-VtPzrsbQVlpc_YeBzf07_qfv0";

// Lightweight Supabase REST client
const sb = {
  h: {
    "Content-Type": "application/json",
    "apikey": SUPA_KEY,
    "Authorization": `Bearer ${SUPA_KEY}`,
    "Prefer": "return=representation",
  },

  async select(table, query = "") {
    try {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?${query}`, { headers: this.h });
      if (!res.ok) { console.error("SB select error", table, await res.text()); return []; }
      return await res.json();
    } catch(e) { console.error("SB select failed", e); return []; }
  },

  async insert(table, row) {
    try {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: this.h,
        body: JSON.stringify(row),
      });
      if (!res.ok) { console.error("SB insert error", table, await res.text()); return null; }
      return await res.json();
    } catch(e) { console.error("SB insert failed", e); return null; }
  },

  async update(table, id, data) {
    try {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}?id=eq.${id}`, {
        method: "PATCH",
        headers: this.h,
        body: JSON.stringify(data),
      });
      if (!res.ok) { console.error("SB update error", table, await res.text()); return null; }
      return await res.json();
    } catch(e) { console.error("SB update failed", e); return null; }
  },

  async upsert(table, row) {
    try {
      const res = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...this.h, "Prefer": "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(row),
      });
      if (!res.ok) { console.error("SB upsert error", table, await res.text()); return null; }
      return await res.json();
    } catch(e) { console.error("SB upsert failed", e); return null; }
  },
};

// --- CONSTANTS ----------------------------------------------------------------
const STARTING_BALANCE = 24.00;
const ADMIN_PASSWORD = "LandRoverD2$";

// Each individual Group 1 race gets its own $24 budget per player.

// --- RACE DATA ----------------------------------------------------------------
// Races are added via the Admin panel

// --- BET TYPES: Win, Place, Trifecta, First Four only ------------------------
const BET_TYPES = [
  {
    id:"win", label:"Win", desc:"Pick the winner",
    positions:[{label:"Horse",key:"horse"}],
    check:(horses,res) => horses[0]===res.first,
    multiplier:(horses,om) => om[horses[0]]?.winOdds || 0,
  },
  {
    id:"place", label:"Place", desc:"Finish 1st, 2nd or 3rd",
    positions:[{label:"Horse",key:"horse"}],
    check:(horses,res) => [res.first,res.second,res.third].includes(horses[0]),
    multiplier:(horses,om) => om[horses[0]]?.placeOdds || 0,
  },
  {
    id:"eachway", label:"Each Way", desc:"Win + Place - costs 2× your stake",
    positions:[{label:"Horse",key:"horse"}],
    check:(horses,res) => horses[0]===res.first || [res.first,res.second,res.third].includes(horses[0]),
    multiplier:(horses,om) => (om[horses[0]]?.winOdds||0) + (om[horses[0]]?.placeOdds||0),
    eachway: true,
  },
  {
    id:"quinella", label:"Quinella", desc:"Pick 2 horses to finish 1st & 2nd - any order",
    positions:[{label:"1st",key:"p1"},{label:"2nd",key:"p2"}],
    check:(horses,res) => {
      const top2=[res.first,res.second];
      return horses.length===2 && top2.includes(horses[0]) && top2.includes(horses[1]);
    },
    multiplier:(horses,om) => {
      const o = n => om[n]?.winOdds||1;
      return parseFloat((o(horses[0])*o(horses[1])/2).toFixed(2));
    },
  },
  {
    id:"exacta", label:"Exacta", desc:"Pick 1st & 2nd in exact order",
    positions:[{label:"1st",key:"p1"},{label:"2nd",key:"p2"}],
    check:(horses,res) => horses[0]===res.first && horses[1]===res.second,
    multiplier:(horses,om) => {
      const o = n => om[n]?.winOdds||1;
      return parseFloat((o(horses[0])*o(horses[1])).toFixed(2));
    },
  },
  {
    id:"trifecta", label:"Trifecta", desc:"Pick 1st, 2nd & 3rd in exact order",
    positions:[{label:"1st",key:"p1"},{label:"2nd",key:"p2"},{label:"3rd",key:"p3"}],
    check:(horses,res) => horses[0]===res.first && horses[1]===res.second && horses[2]===res.third,
    multiplier:(horses,om) => {
      const o = n => om[n]?.winOdds||1;
      return parseFloat((o(horses[0])*o(horses[1])*o(horses[2])/6).toFixed(2));
    },
  },
  {
    id:"firstfour", label:"First Four", desc:"Pick 1st, 2nd, 3rd & 4th in exact order",
    positions:[{label:"1st",key:"p1"},{label:"2nd",key:"p2"},{label:"3rd",key:"p3"},{label:"4th",key:"p4"}],
    check:(horses,res) => horses[0]===res.first && horses[1]===res.second && horses[2]===res.third && horses[3]===res.fourth,
    multiplier:(horses,om) => {
      const o = n => om[n]?.winOdds||1;
      return parseFloat((o(horses[0])*o(horses[1])*o(horses[2])*o(horses[3])/24).toFixed(2));
    },
  },
];

// --- HELPERS ------------------------------------------------------------------
// Boxed/multi bets are tagged with a "_boxedN" suffix on the stored bet type
// (e.g. "trifecta_boxed6") so the app KNOWS a bet is boxed AND exactly how many
// combinations it covers — rather than guessing from horse count (which breaks
// for the most common boxed size: exactly N horses for N positions) or
// recomputing a full-box combo count (which is wrong for partial "multi" bets
// like a banker horse + a couple of backup runners in one position).
// Two distinct tags for "covers more than one combination":
//  "_boxedN"      — placed via the Boxed toggle: EVERY horse can be in ANY
//                   position, no order to show.
//  "_multiCxSHAPE" — placed unboxed, but >1 horse picked for at least one
//                   position (e.g. a banker + backup runners). C = combos,
//                   SHAPE = hyphen-separated counts of how many horses were
//                   picked per position (e.g. "1-1-2" = 1 for 1st, 1 for 2nd,
//                   2 for 3rd) — hyphenated so a position with 10+ horses
//                   picked doesn't corrupt the digit boundaries — so the
//                   exact order/grouping can still be displayed.
const BASE_TYPE = t => (t || "").replace(/_(boxed\d*|multi\d+x[\d-]+)$/, "");
const IS_BOXED_TYPE = t => /_(boxed\d*|multi\d+x[\d-]+)$/.test(t || "");
const IS_TRUE_BOX = t => /_boxed\d*$/.test(t || "");
const STORED_COMBOS = t => {
  let m = /_boxed(\d+)$/.exec(t || ""); if (m) return parseInt(m[1], 10);
  m = /_multi(\d+)x[\d-]+$/.exec(t || ""); if (m) return parseInt(m[1], 10);
  return null;
};
const MULTI_SHAPE = t => {
  const m = /_multi\d+x([\d-]+)$/.exec(t || "");
  return m ? m[1].split("-").map(Number) : null;
};
const getOddsMap = horses => Object.fromEntries(horses.map(h=>[h.number,h]));
const fmt = v => `$${Math.abs(parseFloat(v)).toFixed(2)}`;
// Local calendar date as YYYY-MM-DD — NOT toISOString(), which is UTC and can be
// a day behind/ahead of the user's actual local date (e.g. early morning in AEST/AEDT).
const localDateStr = (d = new Date()) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const formColor = f => {
  const v = String(f).toLowerCase();
  if(v==="1") return "#16803a";
  if(v==="2") return "#ca8a04";
  if(v==="3") return "#dc2626";
  if(v==="x") return "#6b7280"; // scratched/fell
  if(v==="f") return "#7c3aed"; // fell
  if(v==="0") return "#ef4444"; // unplaced
  return "#9ca3af";
};

// Get how much a player has already staked on a specific race
function raceStaked(bets, playerId, raceId) {
  return bets
    .filter(b => b.playerId === playerId && b.raceId === raceId)
    .reduce((s, b) => s + b.stake, 0);
}

// Race countdown component
function RaceCountdown({date, time, raceName}) {
  const r = useCountdown(date, time);
  const notif30Ref = useRef(false);
  const notif5Ref = useRef(false);
  useEffect(()=>{
    if(!r||r.expired) return;
    if(r.h===0&&r.m===30&&r.s===0&&!notif30Ref.current){notif30Ref.current=true;sendNotif(`🏇 ${raceName||"Race"} in 30 minutes`,`Get your $24 in before betting closes.`);}
    if(r.h===0&&r.m===5&&r.s===0&&!notif5Ref.current){notif5Ref.current=true;sendNotif(`⚡ ${raceName||"Race"} closes in 5 minutes!`,`Last chance — place your bets now.`);}
  },[r?.h,r?.m,r?.s]);
  if (!r || r.expired) return null;
  const label = r.h > 0 ? `${r.h}h ${r.m}m` : r.m > 0 ? `${r.m}m ${r.s}s` : `${r.s}s`;
  return (
    <span className="sy" style={{fontSize:14,fontWeight:800,color:r.urgent?C.red:C.accent,background:r.urgent?C.redBg:C.accentGlow,padding:"4px 12px",borderRadius:20,border:`2px solid ${r.urgent?C.redBd:C.accent}`,display:"inline-flex",alignItems:"center",gap:4,marginTop:3,animation:r.urgent?"pulse 1s infinite":"none"}}>
      {r.urgent?"⚡ Closes in ":"🕐 "}{label}
    </span>
  );
}
const C = {
  // Backgrounds
  bg:"#e8ebe8",        // slightly darker off-white with green tint
  card:"#f7f9f7",      // cards slightly off-white so they sit on the bg
  surface:"#f0f2f0",
  header:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",   // deep racing green for header

  // Borders
  border:"#d4dbd4",
  borderMid:"#b8c4b8",

  // Primary accent - racing green
  accent:"#1e5c1e",
  accentL:"#2d7a2d",
  accentGlow:"rgba(30,92,30,0.08)",
  accentSoft:"rgba(30,92,30,0.05)",

  // Gold - for winners, highlights
  gold:"#b8860b",
  goldL:"#d4a017",
  goldBg:"rgba(184,134,11,0.08)",
  goldBd:"rgba(184,134,11,0.3)",

  // Status colours
  green:"#15803d",  greenBg:"rgba(21,128,61,0.08)",  greenBd:"rgba(21,128,61,0.3)",
  red:"#b91c1c",    redBg:"rgba(185,28,28,0.07)",    redBd:"rgba(185,28,28,0.3)",
  blue:"#1d4ed8",   blueBg:"rgba(29,78,216,0.07)",   blueBd:"rgba(29,78,216,0.25)",

  // Text
  text:"#111111",    // near-black - maximum readability
  soft:"#333333",    // dark grey - still clearly readable
  muted:"#666666",   // medium grey - for placeholders only
};

const silkCol = n => ["#dc2626","#1d4ed8","#15803d","#92400e","#7c3aed","#0e7490","#be185d","#d97706","#065f46","#1e3a8a","#9f1239","#0f766e","#b45309","#374151"][(n-1)%14];

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${C.bg};-webkit-font-smoothing:antialiased;font-size:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.cg{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-weight:700}
.sy{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
input,button,select,textarea{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}

/* Cards & surfaces */
.card{background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:22px;box-shadow:0 2px 8px rgba(0,0,0,.07)}
.surface{background:${C.surface};border:1px solid ${C.border};border-radius:10px;padding:16px}

/* Inputs - large and clear */
.inp{background:#fff;border:2px solid ${C.border};color:${C.text};padding:13px 16px;border-radius:10px;font-size:16px;width:100%;outline:none;transition:border-color .18s,box-shadow .18s;line-height:1.4}
.inp:focus{border-color:${C.accent};box-shadow:0 0 0 3px rgba(30,92,30,0.12)}
.inp::placeholder{color:${C.muted}}
.inp-sm{background:#fff;border:2px solid ${C.border};color:${C.text};padding:9px 12px;border-radius:8px;font-size:15px;width:100%;outline:none;transition:border-color .18s}
.inp-sm:focus{border-color:${C.accent};box-shadow:0 0 0 3px rgba(30,92,30,0.1)}
.inp-sm::placeholder{color:${C.muted}}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:13px 24px;border-radius:10px;border:none;cursor:pointer;font-weight:700;font-size:15px;letter-spacing:.02em;transition:all .15s;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.btn-gold{background:${C.accent};color:#fff;box-shadow:0 2px 6px rgba(30,92,30,.25)}
.btn-gold:hover:not(:disabled){background:${C.accentL};transform:translateY(-1px);box-shadow:0 4px 14px rgba(30,92,30,.35)}
.btn-gold:disabled{opacity:.35;cursor:not-allowed}
.btn-ghost{background:#fff;color:${C.soft};border:2px solid ${C.border}}
.btn-ghost:hover{color:${C.text};border-color:${C.muted};background:${C.surface}}
.btn-danger{background:${C.redBg};color:${C.red};border:2px solid ${C.redBd}}
.btn-danger:hover{background:#fef2f2}

/* Nav tabs */
.tab{padding:9px 16px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;border:none;background:transparent;color:rgba(255,255,255,.65);transition:all .15s;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.tab.on{background:rgba(255,255,255,.18);color:#fff;font-weight:700}
.tab:hover:not(.on){background:rgba(255,255,255,.1);color:rgba(255,255,255,.9)}

/* Badges */
.badge{display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.03em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}

/* Divider */
.divider{height:1px;background:${C.border};margin:14px 0}

/* Utility */
.gold{color:${C.goldL}} .soft{color:${C.soft}} .green{color:${C.green}} .red{color:${C.red}} .blue{color:${C.blue}}

/* Horse rows */
.hrow{display:grid;align-items:center;gap:8px;padding:12px 14px;border-radius:10px;border:2px solid transparent;transition:all .13s}
.hrow.clickable{cursor:pointer}
.hrow.clickable:hover{background:#f0f5f0;border-color:${C.border}}
.hrow.sel{background:#e8f5e8;border-color:${C.accent}}
.hrow.scr{opacity:.38}

/* Toggle */
.tog{display:flex;border:2px solid ${C.border};border-radius:10px;overflow:hidden;background:#fff}
.topt{flex:1;padding:10px;text-align:center;cursor:pointer;font-size:13px;font-weight:700;transition:all .15s;border:none;background:transparent;color:${C.muted};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.topt.on{background:${C.accent};color:#fff}
.topt:hover:not(.on){background:${C.surface}}

/* Animations */
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideR{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
@keyframes notif{from{opacity:0;transform:translateX(110%)}to{opacity:1;transform:translateX(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}
.fu{animation:fadeUp .28s ease} .sr{animation:slideR .22s ease}

/* Modal */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;z-index:2000;backdrop-filter:blur(4px);padding:0}
.modal{background:#fff;border-radius:20px 20px 0 0;padding:28px 24px 36px;width:100%;max-width:100%;max-height:92vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,.2)}

/* -- RESPONSIVE -- */
@media(max-width:699px){
  body{font-size:15px}
  .desktop-nav{display:none!important}
  .mobile-nav{display:flex!important}
  .mobile-hide{display:none!important}
  .card{padding:12px;border-radius:10px}
  .surface{padding:9px}
  .modal{border-radius:18px 18px 0 0;padding:18px 14px 36px;max-height:92vh}
  .btn{font-size:14px;padding:11px 16px}
  .inp{font-size:16px;padding:11px 13px}
  .inp-sm{font-size:14px;padding:7px 10px}
  h1.cg{font-size:24px!important}
  h2.cg{font-size:19px!important}
  h3.cg{font-size:16px!important}
  h4.cg{font-size:14px!important}
  .badge{font-size:10px;padding:3px 8px}
  .hrow{padding:7px 9px!important}
  .tab{padding:7px 12px;font-size:13px}
  .topt{padding:8px;font-size:12px}
}
@media(min-width:700px){
  .desktop-nav{display:flex!important}
  .mobile-nav{display:none!important}
  .modal-bg{align-items:center;padding:16px}
  .modal{border-radius:16px;padding:28px;max-width:540px;max-height:90vh}
}
@media(min-width:700px) and (max-width:900px){
  .card{padding:16px}
}
input[type=number]::-webkit-inner-spin-button,
input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
input[type=number]{-moz-appearance:textfield;appearance:textfield}
`;

// --- APP ----------------------------------------------------------------------

const INITIAL_RACES = [];

export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [session, setSession] = useState(null);
  const [races, setRaces] = useState(INITIAL_RACES);
  const [bets, setBets] = useState([]);
  const [screen, setScreen] = useState("auth");
  const [raceId, setRaceId] = useState(null);
  const [toast, setToast] = useState(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [seasonMessage, setSeasonMessage] = useState(() => {
    try {
      const saved = localStorage.getItem("sc_season_msg");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { enabled: false, text: "No races have been added yet. Check back soon - the season is coming! 🏇" };
  });
  const [resultsBanner, setResultsBanner] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(()=>{ requestNotifPerms(); },[]);

  // Offline detection
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => { window.removeEventListener("offline", goOffline); window.removeEventListener("online", goOnline); };
  }, []);

  // Load all data from Supabase on startup + restore session
  useEffect(() => {
    (async () => {
      try {
        const [accs, dbBets, dbRaces, dbSettings] = await Promise.all([
          sb.select("accounts", "order=created_at.asc"),
          sb.select("bets", "order=placed_at.asc"),
          sb.select("races"),
          sb.select("settings", "key=eq.season_message"),
        ]);

        // Load season message - Supabase overrides localStorage
        if (Array.isArray(dbSettings) && dbSettings.length > 0 && dbSettings[0].value) {
          const msg = dbSettings[0].value;
          setSeasonMessage(msg);
          localStorage.setItem("sc_season_msg", JSON.stringify(msg));
        }

        let loadedAccounts = [];
        if (Array.isArray(accs)) {
          loadedAccounts = accs.map(a => ({
            id: a.id, name: a.name, email: a.email, pin: a.pin,
            totalWon: parseFloat(a.total_won||0), totalStaked: parseFloat(a.total_staked||0),
            createdAt: a.created_at,
          }));
          setAccounts(loadedAccounts);
        }

        if (Array.isArray(dbBets)) setBets(dbBets.map(b => ({
          id: b.id, playerId: b.player_id, raceId: b.race_id,
          type: b.type, horses: JSON.parse(b.horses),
          stake: parseFloat(b.stake), potential: parseFloat(b.potential||0),
          won: b.won, payout: b.payout ? parseFloat(b.payout) : null,
          placedAt: b.placed_at,
        })));

        // Load races from Supabase - these include all admin-added races
        if (Array.isArray(dbRaces) && dbRaces.length > 0) {
          // Races are stored in Supabase with full data in the result field
          // Merge with any local structure
          const builtRaces = dbRaces.map(r => ({
            id: r.id,
            name: r.name || r.id,
            venue: r.venue || "",
            date: r.date || "",
            distance: r.distance || "",
            raceNum: r.race_num || "Group 1",
            raceTime: r.race_time || "",
            oddsAsOf: r.odds_as_of || "",
            grade: "Group 1",
            status: r.status || "upcoming",
            horses: r.horses ? (Array.isArray(r.horses) ? r.horses : JSON.parse(r.horses)) : [],
            result: r.result || null,
          }));
          setRaces(builtRaces);
        }

        // Restore session from localStorage
        const savedSession = localStorage.getItem("sc_session");
        if (savedSession) {
          const match = loadedAccounts.find(a => a.id === savedSession);
          if (match) {
            setSession(savedSession);
            setScreen("lobby");
          }
        }

      } catch(e) { /* fall through */ }
      setLoading(false);
    })();
  }, []);

  // eslint-disable-next-line no-unused-vars
  const manualRefresh = async () => {
    showToast("Refreshing…");
    try {
      const [accs, dbBets, dbRaces] = await Promise.all([
        sb.select("accounts", "order=created_at.asc"),
        sb.select("bets", "order=placed_at.asc"),
        sb.select("races"),
      ]);
      if (Array.isArray(accs) && accs.length > 0) {
        setAccounts(accs.map(a => ({
          id: a.id, name: a.name, email: a.email, pin: a.pin,
          totalWon: parseFloat(a.total_won || 0),
          totalStaked: parseFloat(a.total_staked || 0),
        })));
      }
      if (Array.isArray(dbBets)) {
        setBets(dbBets.map(b => ({
          id: b.id, playerId: b.player_id, raceId: b.race_id,
          type: b.type,
          horses: Array.isArray(b.horses) ? b.horses : (typeof b.horses === "string" ? JSON.parse(b.horses) : []),
          stake: parseFloat(b.stake || 0),
          potential: parseFloat(b.potential || 0),
          won: b.won, payout: b.payout ? parseFloat(b.payout) : null,
          placedAt: b.placed_at,
        })));
      }
      if (Array.isArray(dbRaces) && dbRaces.length > 0) {
        setRaces(dbRaces.map(r => ({
          id: r.id, name: r.name, venue: r.venue, date: r.date,
          raceTime: r.race_time, distance: r.distance,
          raceNum: r.race_num, grade: r.grade || "Group 1",
          oddsAsOf: r.odds_as_of,
          horses: Array.isArray(r.horses) ? r.horses : (typeof r.horses === "string" ? JSON.parse(r.horses) : []),
          status: r.status, result: r.result,
        })));
      }
      showToast("✓ Up to date");
    } catch(e) { showToast("Refresh failed - check connection", "err"); }
  };

  const showToast = (msg, type="ok") => {
    setToast({msg,type});
    setTimeout(()=>setToast(null),3500);
  };

  const updateAccount = useCallback((id, fn) => {
    setAccounts(prev => {
      const updated = prev.map(a => a.id===id ? {...a,...fn(a)} : a);
      const a = updated.find(x => x.id===id);
      if (a) {
        sb.update("accounts", id, { total_won: a.totalWon, total_staked: a.totalStaked });
      }
      return updated;
    });
  },[]);

  const liveAccount = accounts.find(a=>a.id===session)||null;

  // AUTH
  const doRegister = async (name, email, pin) => {
    if (accounts.find(a=>a.name.toLowerCase()===name.toLowerCase())) return "An account with that name already exists. Please use a different name.";
    if (!/^\d{4}$/.test(pin)) return "PIN must be exactly 4 digits.";
    const acc = {id:Date.now().toString(), name, email:email.toLowerCase(), pin, totalWon:0, totalStaked:0, createdAt:new Date().toISOString()};
    const result = await sb.insert("accounts", { id:acc.id, name:acc.name, email:acc.email, pin:acc.pin, total_won:0, total_staked:0, created_at:acc.createdAt });
    if (!result) console.error("Failed to save account to Supabase");
    setAccounts(p=>[...p,acc]);
    setSession(acc.id);
    localStorage.setItem("sc_session", acc.id);
    setScreen("lobby");
    return null;
  };

  const doChangePin = async (playerId, newPin) => {
    if (!/^\d{4}$/.test(newPin)) return "PIN must be exactly 4 digits.";
    if (accounts.find(a=>a.pin===newPin&&a.id!==playerId)) return `PIN ${newPin} is already taken. Choose a different one.`;
    setAccounts(prev=>prev.map(a=>a.id===playerId?{...a,pin:newPin}:a));
    await sb.update("accounts", playerId, {pin:newPin});
    return null;
  };

  const doAdminResetPin = async (playerId, newPin) => {
    if (!/^\d{4}$/.test(newPin)) return "PIN must be exactly 4 digits.";
    if (accounts.find(a=>a.pin===newPin&&a.id!==playerId)) return `PIN ${newPin} is already taken by another player.`;
    setAccounts(prev=>prev.map(a=>a.id===playerId?{...a,pin:newPin}:a));
    await sb.update("accounts", playerId, {pin:newPin});
    return null;
  };

  const doLogin = (name, pin) => {
    const acc = accounts.find(a => a.name.toLowerCase() === name.toLowerCase().trim());
    if (!acc) return "No account found with that name.";
    if (acc.pin !== pin) return "Incorrect PIN.";
    setSession(acc.id);
    localStorage.setItem("sc_session", acc.id);
    setScreen("lobby");
    return null;
  };
  const doLogout = () => {
    setSession(null);
    localStorage.removeItem("sc_session");
    setScreen("auth");
    setPendingBets([]);
  };

  // PER-RACE BALANCE: each race starts at $24, reduced by bets placed on that race
  const getRaceBalance = (playerId, raceId) => {
    const staked = raceStaked(bets, playerId, raceId);
    return parseFloat((STARTING_BALANCE - staked).toFixed(2));
  };

  // Auto-close betting when race time is reached
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setRaces(prev => prev.map(r => {
        if (r.status !== "upcoming") return r;
        if (!r.raceTime || !r.date) return r;
        const raceDateTime = new Date(`${r.date}T${r.raceTime}:00`);
        if (isNaN(raceDateTime.getTime())) return r;
        if (now - raceDateTime > 24 * 60 * 60 * 1000) return r;
        if (now >= raceDateTime) {
          sb.update("races", r.id, { status: "closed" });
          return { ...r, status: "closed" };
        }
        return r;
      }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Poll Supabase every 30s - keeps all clients in sync and catches failed saves
  useEffect(() => {
    const refresh = async () => {
      try {
        const [accs, dbBets, dbRaces] = await Promise.all([
          sb.select("accounts", "order=created_at.asc"),
          sb.select("bets", "order=placed_at.asc"),
          sb.select("races"),
        ]);
        if (Array.isArray(accs) && accs.length > 0) {
          setAccounts(accs.map(a => ({
            id: a.id, name: a.name, email: a.email, pin: a.pin,
            totalWon: parseFloat(a.total_won || 0),
            totalStaked: parseFloat(a.total_staked || 0),
          })));
        }
        if (Array.isArray(dbBets) && dbBets.length > 0) {
          setBets(dbBets.map(b => ({
            id: b.id, playerId: b.player_id, raceId: b.race_id,
            type: b.type,
            horses: Array.isArray(b.horses) ? b.horses : (typeof b.horses === "string" ? JSON.parse(b.horses) : []),
            stake: parseFloat(b.stake || 0),
            potential: parseFloat(b.potential || 0),
            won: b.won, payout: b.payout ? parseFloat(b.payout) : null,
            placedAt: b.placed_at,
          })));
        }
        if (Array.isArray(dbRaces) && dbRaces.length > 0) {
          setRaces(dbRaces.map(r => ({
            id: r.id, name: r.name, venue: r.venue, date: r.date,
            raceTime: r.race_time, distance: r.distance,
            raceNum: r.race_num, grade: r.grade || "Group 1",
            oddsAsOf: r.odds_as_of,
            horses: Array.isArray(r.horses) ? r.horses : (typeof r.horses === "string" ? JSON.parse(r.horses) : []),
            status: r.status, result: r.result,
          })));
        }
      } catch(e) { console.warn("Refresh poll failed", e); }
    };
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);
  const queueBet = (raceId, type, horses, stake, boxedCombos) => {
    if (!liveAccount) return;
    const race = races.find(r=>r.id===raceId);
    if (!race) return;
    const available = getRaceBalance(liveAccount.id, raceId);
    if (stake > available + 0.01) {
      showToast(`Only ${fmt(available)} remaining for this race`, "err");
      return;
    }
    const om = getOddsMap(race.horses);
    const def = BET_TYPES.find(t=>t.id===BASE_TYPE(type));
    const mult = def.multiplier(horses,om);
    const potential = parseFloat((stake*mult).toFixed(2));
    const now = Date.now();
    const bet = {
      id: now.toString(), raceId, type, horses, stake, potential,
      playerId: liveAccount.id, won: null, payout: null,
      placedAt: new Date().toISOString(),
    };
    setBets(p=>[...p, bet]);
    updateAccount(liveAccount.id, a=>({
      totalStaked: parseFloat((a.totalStaked + stake).toFixed(2)),
    }));
    sb.insert("bets", {
      id: bet.id, player_id: bet.playerId, race_id: bet.raceId,
      type: bet.type, horses: JSON.stringify(bet.horses),
      stake: bet.stake, potential: bet.potential,
      won: null, payout: null, placed_at: bet.placedAt,
    });
    showToast(`Bet placed — ${fmt(stake)} on ${type}`);
  };

  // SETTLE RACE - uses actual TAB dividends entered by admin
  // dividends = { win: 4.60, place1: 1.90, place2: 2.10, place3: 3.20, exacta: 18.50, trifecta: 142.30, firstfour: 380.00 }
  const settleRace = (raceId, result, dividends) => {
    const race = races.find(r=>r.id===raceId);
    if (!race) return;

    const fullResult = { ...result, dividends };
    setRaces(p=>p.map(r=>r.id===raceId?{...r,result:fullResult,status:"finished"}:r));
    sb.upsert("races", { id: raceId, status: "finished", result: fullResult });

    // AUTO-BET: any player who hasn't placed a bet gets $24 Win on horse #1 (top weight)
    const defaultHorse = race.horses.filter(h=>!h.scratched).sort((a,b)=>a.number-b.number)[0];
    const existingPlayerIds = [...new Set(bets.filter(b=>b.raceId===raceId).map(b=>b.playerId))];
    const missingPlayers = accounts.filter(a=>!existingPlayerIds.includes(a.id));
    const autoBets = defaultHorse ? missingPlayers.map(a=>({
      id: `auto_${raceId}_${a.id}`,
      playerId: a.id,
      raceId,
      type: "win",
      horses: [defaultHorse.number],
      stake: 24,
      potential: parseFloat((24 * (defaultHorse.winOdds||0)).toFixed(2)),
      won: null,
      payout: null,
      placedAt: new Date().toISOString(),
      isAutobet: true,
    })) : [];

    // Save auto-bets to Supabase and state
    if (autoBets.length > 0) {
      autoBets.forEach(b => sb.insert("bets", {
        id: b.id, player_id: b.playerId, race_id: b.raceId,
        type: b.type, horses: JSON.stringify(b.horses),
        stake: b.stake, potential: b.potential,
        won: null, payout: null, placed_at: b.placedAt,
      }));
      // Update totalStaked for auto-bet players
      autoBets.forEach(b => updateAccount(b.playerId, a=>({
        totalStaked: parseFloat((a.totalStaked + 24).toFixed(2)),
      })));
    }

    // How many combinations a boxed/multi bet of N unique horses covers for a given bet type
    const comboCount = (baseType, n, r) => {
      if (baseType === "quinella") return n*(n-1)/2;
      let c = 1;
      for (let i=0; i<r; i++) c *= (n-i);
      return c;
    };

    // Payout calculator using real dividends
    const calcDividendPayout = (bet) => {
      const { type, horses } = bet;
      const baseType = BASE_TYPE(type);
      const def = BET_TYPES.find(t=>t.id===baseType);
      // Boxed/multi bets store the FULL stake — divide by the number of combos
      // covered to get the correct per-combo (flexi) unit before applying the dividend.
      const isBoxedStyle = IS_BOXED_TYPE(type);
      const actualCombos = STORED_COMBOS(type) || comboCount(baseType, horses.length, def.positions.length);
      const stake = isBoxedStyle ? bet.stake / actualCombos : bet.stake;
      const { first, second, third } = result;
      const d = dividends;
      if (baseType === "win")   return parseFloat((stake * (d.win || 0)).toFixed(2));
      if (baseType === "place") {
        const placeDiv = horses[0]===first ? d.place1 : horses[0]===second ? d.place2 : horses[0]===third ? d.place3 : 0;
        return parseFloat((stake * (placeDiv || 0)).toFixed(2));
      }
      if (baseType === "eachway") {
        const winDiv   = horses[0]===first ? (d.win || 0) : 0;
        const placeDiv = horses[0]===first ? d.place1 : horses[0]===second ? d.place2 : horses[0]===third ? d.place3 : 0;
        return parseFloat((stake * (winDiv + (placeDiv || 0))).toFixed(2));
      }
      if (baseType === "exacta")    return parseFloat((stake * (d.exacta    || 0)).toFixed(2));
      if (baseType === "trifecta")  return parseFloat((stake * (d.trifecta  || 0)).toFixed(2));
      if (baseType === "firstfour") return parseFloat((stake * (d.firstfour || 0)).toFixed(2));
      // quinella - use exacta div / 2 as fallback if no quinella div entered
      if (baseType === "quinella")  return parseFloat((stake * (d.quinella  || (d.exacta ? d.exacta/2 : 0))).toFixed(2));
      return 0;
    };

    let wins=0, paid=0;
    const allBetsForRace = [...bets, ...autoBets];
    const settled = allBetsForRace.map(b=>{
      if (b.raceId!==raceId||b.won!==null) return b;
      const def = BET_TYPES.find(t=>t.id===BASE_TYPE(b.type));
      let won;
      if(IS_BOXED_TYPE(b.type)) {
        // Boxed/multi bet - check if the result positions are all covered by selected horses
        const resultPositions=[result.first,result.second,result.third,result.fourth].slice(0,def.positions.length);
        won = resultPositions.every(pos=>b.horses.includes(pos));
      } else {
        won = def.check(b.horses, result);
      }
      const payout = won ? calcDividendPayout(b) : 0;
      if (won){wins++;paid=parseFloat((paid+payout).toFixed(2));}
      return {...b,won,payout};
    });
    // Merge: keep existing bets, add/update auto-bets
    const settledMap = Object.fromEntries(settled.map(b=>[b.id,b]));
    const mergedBets = [
      ...bets.map(b=>settledMap[b.id]||b),
      ...autoBets.map(b=>settledMap[b.id]||b).filter(b=>!bets.find(x=>x.id===b.id)),
    ];
    setBets(mergedBets);
    // Persist bet outcomes to Supabase
    mergedBets.filter(b=>b.raceId===raceId).forEach(b=>{
      sb.update("bets", b.id, { won: b.won, payout: b.payout });
    });
    // Update account totals for all players who had bets in this race
    const playerIds = [...new Set(mergedBets.filter(b=>b.raceId===raceId).map(b=>b.playerId))];
    playerIds.forEach(pid => {
      const playerBets = mergedBets.filter(b=>b.raceId===raceId&&b.playerId===pid);
      const playerWon = playerBets.filter(b=>b.won===true).reduce((s,b)=>s+(b.payout||0),0);
      updateAccount(pid, a=>({
        totalWon: parseFloat((a.totalWon + playerWon).toFixed(2)),
      }));
    });

    // Send email notifications via EmailJS to every player who had a bet on this race
    const emailjs = window.emailjs;
    if (emailjs) {
      // Group settled bets by player
      const byPlayer = {};
      settled.filter(b=>b.raceId===raceId).forEach(b=>{
        if (!byPlayer[b.playerId]) byPlayer[b.playerId] = [];
        byPlayer[b.playerId].push(b);
      });
      Object.entries(byPlayer).forEach(([playerId, playerBets]) => {
        const player = accounts.find(a=>a.id===playerId);
        if (!player) return;
        const winner1 = race.horses.find(h=>h.number===result.first);
        const winner2 = race.horses.find(h=>h.number===result.second);
        const winner3 = race.horses.find(h=>h.number===result.third);
        const winner4 = race.horses.find(h=>h.number===result.fourth);
        const winningBets = playerBets.filter(b=>b.won===true);
        const losingBets  = playerBets.filter(b=>b.won===false);
        const totalWon    = winningBets.reduce((s,b)=>s+b.payout,0);
        const totalLost   = losingBets.reduce((s,b)=>s+b.stake,0);
        const betLines = playerBets.map(b=>{
          const def = BET_TYPES.find(t=>t.id===BASE_TYPE(b.type));
          const horseLine = b.horses.map(n=>{const h=race.horses.find(x=>x.number===n); return `#${n} ${h?.name||""}`; }).join(" → ");
          const boxedTag = IS_BOXED_TYPE(b.type) ? "[Boxed] " : "";
          return `${b.won?"WIN":"LOSS"} ${def?.label}: ${boxedTag}${horseLine} - Staked ${fmt(b.stake)}${b.won?` | Won ${fmt(b.payout)}`:" | Lost"}`;
        }).join("\n");

        emailjs.send(
          "service_577hk21",       // EmailJS Service ID
          "template_636ql7l",      // EmailJS Template ID
          {
            to_name:    player.name,
            to_email:   player.email,
            race_name:  race.name,
            race_venue: race.venue,
            race_date:  new Date(race.date).toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long",year:"numeric"}),
            result_1st: `#${winner1?.number} ${winner1?.name}`,
            result_2nd: `#${winner2?.number} ${winner2?.name}`,
            result_3rd: `#${winner3?.number} ${winner3?.name}`,
            result_4th: `#${winner4?.number} ${winner4?.name}`,
            bet_lines:  betLines,
            total_won:  fmt(totalWon),
            total_lost: fmt(totalLost),
            net_result: totalWon > 0 ? `You won ${fmt(totalWon)}!` : `Better luck next race!`,
            leaderboard_url: window.location.href,
          },
          "yBPk9u89zD7Yn-s3P"      // EmailJS Public Key
        ).catch(()=>{/* silent fail - email is best-effort */});
      });
    }

    showToast(`Race settled - ${wins} winner${wins!==1?"s":""}, ${fmt(paid)} paid out`);

    // Show results banner for the logged-in player
    const myWins = settled.filter(b => b.playerId === session && b.won === true);
    const myPayout = myWins.reduce((s,b)=>s+(b.payout||0),0);
    const raceName = races.find(r=>r.id===raceId)?.name;
    // Build daily recap — how many races today, total returned
    const today=localDateStr();
    const todayRaces=races.filter(r=>r.date===today&&r.status==="finished");
    const myTodayBets=bets.filter(b=>todayRaces.some(r=>r.id===b.raceId)&&b.playerId===session&&b.won!==null);
    const myTodayReturn=myTodayBets.filter(b=>b.won===true).reduce((s,b)=>s+(b.payout||0),0);
    setResultsBanner({ raceName, myWins: myWins.length, myPayout, todayRaces: todayRaces.length, myTodayReturn });
    setTimeout(()=>setResultsBanner(null), 7000);
    if (myWins.length > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
  };

  const addRace = (race) => {
    setRaces(p=>[...p, race]);
    sb.insert("races", {
      id: race.id, name: race.name, venue: race.venue,
      date: race.date, race_time: race.raceTime, distance: race.distance,
      race_num: race.raceNum, status: "upcoming",
      odds_as_of: race.oddsAsOf || null,
      horses: [], result: null,
    });
    showToast(`${race.name} added!`);
  };

  const addHorseToRace = (raceId, horse) => {
    setRaces(p => {
      const updated = p.map(r => r.id!==raceId ? r : {...r, horses:[...r.horses, horse]});
      const race = updated.find(r=>r.id===raceId);
      if (race) sb.update("races", raceId, { horses: race.horses });
      return updated;
    });
  };

  const addHorsesToRace = (raceId, newHorses) => {
    setRaces(p => {
      const updated = p.map(r => r.id!==raceId ? r : {...r, horses:[...r.horses, ...newHorses]});
      const race = updated.find(r=>r.id===raceId);
      if (race) sb.update("races", raceId, { horses: race.horses });
      return updated;
    });
    showToast(`${newHorses.length} horses imported!`);
  };

  const editRace = (raceId, updates) => {
    setRaces(p => p.map(r => r.id !== raceId ? r : {...r, ...updates}));
    sb.update("races", raceId, {
      name: updates.name,
      venue: updates.venue,
      date: updates.date,
      race_time: updates.raceTime,
      distance: updates.distance,
      race_num: updates.raceNum,
      odds_as_of: updates.oddsAsOf || null,
    });
    showToast("Race updated!");
  };

  const editHorse = (raceId, horseNum, updates) => {
    setRaces(p => {
      const updated = p.map(r => r.id !== raceId ? r : {
        ...r, horses: r.horses.map(h => h.number !== horseNum ? h : {...h, ...updates})
      });
      const race = updated.find(r => r.id === raceId);
      if (race) sb.update("races", raceId, { horses: race.horses });
      return updated;
    });
    showToast("Horse updated!");
  };

  const deleteRace = async (raceId) => {
    const race = races.find(r => r.id === raceId);
    if (!race) return;
    if (race.status === "finished" || race.status === "archived") {
      setRaces(p => p.map(r => r.id !== raceId ? r : {...r, status:"archived"}));
      await sb.update("races", raceId, { status: "archived" });
      showToast("Race archived - removed from calendar, history kept");
    } else {
      setRaces(p => p.filter(r => r.id !== raceId));
      await sb.update("races", raceId, { status: "deleted" });
      showToast("Race deleted");
    }
  };

  const cancelBet = async (betId) => {
    const bet = bets.find(b => b.id === betId);
    if (!bet || bet.won !== null) return;
    const race = races.find(r => r.id === bet.raceId);
    if (!race || race.status !== "upcoming") return;
    setBets(p => p.filter(b => b.id !== betId));
    updateAccount(bet.playerId, a => ({
      totalStaked: parseFloat(Math.max(0, a.totalStaked - bet.stake).toFixed(2))
    }));
    try {
      await fetch(`${SUPA_URL}/rest/v1/bets?id=eq.${betId}`, { method:"DELETE", headers: sb.h });
    } catch(e) {}
    showToast("Bet cancelled - your budget has been refunded");
  };

  const [scratchAlert, setScratchAlert] = useState(null); // {horseName, raceName, affectedBets}

  const scratchHorse = (raceId, num) => {
    const race = races.find(r=>r.id===raceId);
    const horse = race?.horses.find(h=>h.number===num);
    const nowScratched = !horse?.scratched;
    const updatedHorses = race.horses.map(h=>h.number===num?{...h,scratched:nowScratched}:h);
    setRaces(p=>p.map(r=>r.id!==raceId?r:{...r,horses:updatedHorses}));
    // Save to Supabase
    sb.update("races", raceId, { horses: updatedHorses });
    if(!nowScratched){
      showToast(`#${num} ${horse?.name} un-scratched`);
      return;
    }
    // Check if any active bets include this horse
    const affectedBets = bets.filter(b=>
      b.raceId===raceId && b.won===null && b.horses.includes(num)
    );
    if (affectedBets.length > 0) {
      const affectedPlayers = [...new Set(affectedBets.map(b=>b.playerId))]
        .map(id=>accounts.find(a=>a.id===id)?.name).filter(Boolean);
      setScratchAlert({ horseName:horse?.name, raceName:race?.name, affectedBets, affectedPlayers });
    }
    showToast(`#${num} ${horse?.name} scratched`);
  };

  const leaderboard = [...accounts].sort((a,b)=>{
    const profitA = a.totalWon;
    const profitB = b.totalWon;
    return profitB - profitA;
  });

  // Track position movements - save current positions to localStorage and compare
  const [prevPositions, setPrevPositions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sc_prev_positions") || "{}"); } catch { return {}; }
  });

  useEffect(() => {
    if (leaderboard.length === 0) return;
    const current = {};
    leaderboard.forEach((a,i) => { current[a.id] = i + 1; });
    // Save current as new previous after a delay (so player sees movement first)
    const t = setTimeout(() => {
      localStorage.setItem("sc_prev_positions", JSON.stringify(current));
      setPrevPositions(current);
    }, 30000); // update every 30s
    return () => clearTimeout(t);
  }, [leaderboard.map(a=>a.id).join(",")]);

  const getMovement = (accountId, currentPos) => {
    const prev = prevPositions[accountId];
    if (!prev || prev === currentPos) return null;
    return prev - currentPos; // positive = moved up, negative = moved down
  };

  const selectedRace = races.find(r=>r.id===raceId);

  useEffect(() => {
    if (!loading) {
      setSplashFading(true);
      const t = setTimeout(() => setShowSplash(false), 320);
      return () => clearTimeout(t);
    }
  }, [loading]);

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",width:"100%"}}>
      <style>{CSS}</style>

      {showSplash&&(
        <div style={{position:"fixed",inset:0,background:`linear-gradient(160deg,${C.header} 0%,#2d5a2d 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999,opacity:splashFading?0:1,transition:"opacity .32s ease"}}>
          <div style={{fontSize:64,marginBottom:16}}>🏇</div>
          <h2 className="cg" style={{fontSize:28,fontWeight:900,color:"#fff",marginBottom:6}}>Spring Carnival</h2>
          <p className="sy" style={{fontSize:12,color:"rgba(255,255,255,.5)",letterSpacing:".16em",textTransform:"uppercase",marginBottom:24}}>GROUP 1 COMPETITION</p>
          <div style={{display:"flex",gap:6}}>
            {[0,1,2].map(i=>(
              <div key={i} style={{width:8,height:8,borderRadius:"50%",background:"rgba(255,255,255,.4)",animation:`pulse 1.2s ${i*0.2}s ease-in-out infinite`}}/>
            ))}
          </div>
        </div>
      )}

      {scratchAlert&&(
        <div className="modal-bg" onClick={()=>setScratchAlert(null)}>
          <div className="modal sr" onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:48,marginBottom:8}}>⚠️</div>
              <h3 className="cg" style={{fontSize:22,fontWeight:700,color:C.red,marginBottom:6}}>Horse Scratched!</h3>
              <p className="sy" style={{fontSize:15,fontWeight:700,marginBottom:4}}>{scratchAlert.horseName} has been scratched from {scratchAlert.raceName}</p>
              <p className="sy" style={{fontSize:13,color:"#000"}}>The following players have active bets that include this horse:</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {scratchAlert.affectedPlayers.map(name=>{
                const playerBets = scratchAlert.affectedBets.filter(b=>accounts.find(a=>a.id===b.playerId)?.name===name);
                return (
                  <div key={name} style={{padding:"10px 14px",background:C.redBg,border:`1px solid ${C.redBd}`,borderRadius:8}}>
                    <div className="sy" style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:4}}>🚨 {name}</div>
                    {playerBets.map(b=>{
                      const td=BET_TYPES.find(t=>t.id===BASE_TYPE(b.type));
                      const isTrueBox = IS_TRUE_BOX(b.type);
                      const isMulti = IS_BOXED_TYPE(b.type) && !isTrueBox;
                      return <div key={b.id} className="sy" style={{fontSize:13,color:"#000"}}>{td?.label} · {isTrueBox?"🎲 ":isMulti?"🎯 ":""}#{b.horses.join(" → #")} · {fmt(b.stake)}</div>;
                    })}
                  </div>
                );
              })}
            </div>
            <p className="sy" style={{fontSize:12,color:"#000",marginBottom:14,textAlign:"center"}}>These players will see a red alert on their race card and should update their bets before betting closes.</p>
            <button className="btn btn-gold" style={{width:"100%",padding:13,fontSize:14}} onClick={()=>setScratchAlert(null)}>Got it</button>
          </div>
        </div>
      )}

      {showConfetti&&<Confetti/>}

      {/* Results banner */}
      {resultsBanner&&(
        <div style={{position:"fixed",top:72,left:16,right:16,zIndex:9990,maxWidth:520,margin:"0 auto",background:resultsBanner.myWins>0?"#15803d":"#1a3a1a",borderRadius:14,padding:"14px 18px",boxShadow:"0 8px 40px rgba(0,0,0,.3)",animation:"notif .3s ease"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24,flexShrink:0}}>{resultsBanner.myWins>0?"🎉":"🏁"}</span>
              <div>
                <div className="sy" style={{fontSize:14,fontWeight:800,color:"#fff",lineHeight:1.3}}>
                  {resultsBanner.myWins>0?`You won on ${resultsBanner.raceName}!`:`${resultsBanner.raceName} settled`}
                </div>
                <div className="sy" style={{fontSize:12,color:"rgba(255,255,255,.7)",marginTop:2}}>
                  {resultsBanner.myWins>0?`+${fmt(resultsBanner.myPayout)} returned`:`No wins this time`}
                </div>
              </div>
            </div>
            <button onClick={()=>setResultsBanner(null)} style={{background:"rgba(255,255,255,.15)",border:"none",color:"#fff",fontSize:16,cursor:"pointer",flexShrink:0,width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
          {/* Daily recap row */}
          {resultsBanner.todayRaces>0&&(
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(255,255,255,.15)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span className="sy" style={{fontSize:11,color:"rgba(255,255,255,.55)"}}>📊 Today: {resultsBanner.todayRaces} race{resultsBanner.todayRaces!==1?"s":""} settled</span>
              <span className="sy" style={{fontSize:12,fontWeight:700,color:resultsBanner.myTodayReturn>0?"#4ade80":"rgba(255,255,255,.4)"}}>
                {resultsBanner.myTodayReturn>0?`+${fmt(resultsBanner.myTodayReturn)} today`:"No wins today yet"}
              </span>
            </div>
          )}
        </div>
      )}

      {toast&&(
        <div style={{position:"fixed",top:window.innerWidth<700?62:72,right:16,left:16,zIndex:9999,padding:"14px 18px",borderRadius:12,background:toast.type==="err"?"rgba(254,242,242,.98)":"rgba(240,253,244,.98)",border:`1px solid ${toast.type==="err"?C.redBd:C.greenBd}`,color:toast.type==="err"?C.red:C.green,animation:"notif .28s ease",fontSize:14,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",backdropFilter:"blur(16px)",boxShadow:"0 8px 40px rgba(0,0,0,.15)",fontWeight:600,maxWidth:480,margin:"0 auto"}}>
          {toast.msg}
        </div>
      )}

      {screen!=="auth"&&(
        <>
          {/* -- HEADER -- */}
          <header style={{background:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",padding:window.innerWidth<700?"0 12px":"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:window.innerWidth<700?52:62,position:"sticky",top:0,zIndex:500,boxShadow:"0 3px 16px rgba(0,0,0,.3)"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span className="cg" style={{fontSize:window.innerWidth<700?15:19,fontWeight:900,color:"#fff",whiteSpace:"nowrap"}}>🏇 Spring Carnival</span>
              {/* Desktop nav */}
              <nav className="desktop-nav" style={{display:"flex",gap:2}}>
                {[["lobby","Races"],["leaderboard","Leaderboard"],["mybets","My Bets"],["admin","Admin"]].map(([s,l])=>(
                  <button key={s} className={`tab${screen===s||(screen==="race"&&s==="lobby")?" on":""}`} onClick={()=>setScreen(s)}>{l}</button>
                ))}
              </nav>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>

              {liveAccount&&(
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span className="sy mobile-hide" style={{fontSize:13,color:"rgba(255,255,255,.7)"}}>Hi, <strong style={{color:"#fff"}}>{liveAccount.name}</strong></span>
                  <button className="sy" style={{fontSize:12,padding:"6px 10px",background:"rgba(255,255,255,.12)",border:"1.5px solid rgba(255,255,255,.25)",borderRadius:8,color:"#fff",cursor:"pointer",fontWeight:600}} onClick={doLogout}>Log out</button>
                </div>
              )}
            </div>
          </header>

          {/* -- MOBILE BOTTOM NAV -- */}
          <nav className="mobile-nav" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:500,background:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",borderTop:"1px solid rgba(255,255,255,.12)",display:"flex",boxShadow:"0 -2px 20px rgba(0,0,0,.3)",paddingBottom:"max(env(safe-area-inset-bottom, 10px), 10px)"}}>
            {[["lobby","Races"],["leaderboard","Leaders"],["mybets","My Bets"],["admin","Admin"]].map(([s,l])=>{
              const active = screen===s||(screen==="race"&&s==="lobby");
              return (
                <button key={s} onClick={()=>setScreen(s)}
                  style={{flex:1,padding:"10px 4px 8px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"transparent",border:"none",cursor:"pointer",position:"relative",transition:"all .15s",minHeight:46}}>
                  {active&&<div style={{position:"absolute",top:0,left:"20%",right:"20%",height:3,background:C.goldL,borderRadius:"0 0 4px 4px"}}/>}
                  <span className="sy" style={{fontSize:12,fontWeight:active?700:500,color:active?"#fff":"rgba(255,255,255,.5)",letterSpacing:".01em",transition:"all .15s"}}>{l}</span>
                </button>
              );
            })}
          </nav>
        </>
      )}

      {/* Offline banner */}
      {isOffline&&(
        <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,background:"#dc2626",color:"#fff",textAlign:"center",padding:"10px 16px",fontSize:13,fontWeight:700}}>
          ⚠️ You're offline - bets cannot be placed until you reconnect
        </div>
      )}

      {/* Player scratch alert banner - shows when their horse is scratched in open race */}
      {!isOffline&&screen!=="auth"&&liveAccount&&(()=>{
        const myScratchedBets=bets.filter(b=>{
          if(b.playerId!==liveAccount.id||b.won!==null)return false;
          const race=races.find(r=>r.id===b.raceId);
          if(!race||race.status!=="upcoming")return false;
          return b.horses.some(n=>race.horses.find(h=>h.number===n)?.scratched);
        });
        if(!myScratchedBets.length)return null;
        const affectedRaces=[...new Set(myScratchedBets.map(b=>b.raceId))].map(id=>races.find(r=>r.id===id)?.name).filter(Boolean);
        return(
          <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9998,background:"linear-gradient(135deg,#b45309,#d97706)",color:"#fff",padding:"0",boxShadow:"0 2px 12px rgba(0,0,0,.3)"}}>
            <div style={{maxWidth:1100,margin:"0 auto",padding:"11px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:20,flexShrink:0}}>🚨</span>
              <div style={{flex:1,minWidth:0}}>
                <span style={{fontSize:13,fontWeight:800}}>One of your horses has been scratched! </span>
                <span style={{fontSize:12,opacity:.9}}>{affectedRaces.join(", ")} — tap to update your bets before betting closes</span>
              </div>
              <button style={{background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.4)",color:"#fff",borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0,fontFamily:"inherit"}}
                onClick={()=>{const r=myScratchedBets[0];if(r){setRaceId(r.raceId);setScreen("race");}}}
              >Fix now →</button>
            </div>
          </div>
        );
      })()}

      {screen==="auth"&&<AuthScreen onRegister={doRegister} onLogin={doLogin} accounts={accounts}/>}

      {screen!=="auth"&&<main style={{maxWidth:1100,margin:"0 auto",padding:`${isOffline?54:14}px ${window.innerWidth<700?"12px":"24px"} ${window.innerWidth<700?"76px":"48px"}`}}>
        {screen==="lobby"&&<LobbyScreen races={races.filter(r=>r.status!=="archived"&&r.status!=="deleted")} bets={bets} account={liveAccount} leaderboard={leaderboard} getRaceBalance={getRaceBalance} onSelect={id=>{setRaceId(id);setScreen("race");}} seasonMessage={seasonMessage} accounts={accounts}/>}
        {screen==="race"&&selectedRace&&<RaceScreen race={selectedRace} account={liveAccount} bets={bets} getRaceBalance={getRaceBalance} myBets={bets.filter(b=>b.raceId===raceId&&b.playerId===liveAccount?.id)} onBack={()=>setScreen("lobby")} onQueue={queueBet} onCancelBet={cancelBet} allBets={bets} accounts={accounts}/>}
        {screen==="leaderboard"&&<LeaderboardScreen accounts={leaderboard} bets={bets} races={races} getMovement={getMovement} myAccount={liveAccount}/>}
        {screen==="mybets"&&<MyBetsScreen account={liveAccount} bets={bets.filter(b=>b.playerId===liveAccount?.id)} races={races} getRaceBalance={getRaceBalance} onChangePin={doChangePin} onCancelBet={cancelBet}/>}
        {screen==="admin"&&<AdminScreen races={races} accounts={accounts} bets={bets} adminUnlocked={adminUnlocked} setAdminUnlocked={setAdminUnlocked} onSettle={settleRace} onScratch={scratchHorse} onResetPin={doAdminResetPin} onAddRace={addRace} onAddHorse={addHorseToRace} onAddHorses={addHorsesToRace} onDeleteRace={deleteRace} onEditRace={editRace} onEditHorse={editHorse} seasonMessage={seasonMessage} onSeasonMessage={(next)=>{
          setSeasonMessage(next);
          localStorage.setItem("sc_season_msg", JSON.stringify(next));
          sb.upsert("settings", { key: "season_message", value: next });
        }} toast={showToast} onLockRace={id=>{editRace(id,{status:"closed"});showToast("Betting locked 🔒");}}/>}
      </main>}
    </div>
  );
}

// --- AUTH ---------------------------------------------------------------------
function PinPad({ value, onChange, maxLen=4 }) {
  const digits = value.split("");
  const press = d => { if (value.length < maxLen) onChange(value + d); };
  const del   = () => onChange(value.slice(0, -1));

  useEffect(() => {
    const handler = e => {
      if (e.key >= "0" && e.key <= "9") {
        if (value.length < maxLen) onChange(value + e.key);
      } else if (e.key === "Backspace" || e.key === "Delete") {
        onChange(value.slice(0, -1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [value, onChange, maxLen]);

  return (
    <div style={{maxWidth:260,margin:"0 auto"}}>
      <div style={{display:"flex",justifyContent:"center",gap:14,marginBottom:18}}>
        {Array.from({length:maxLen}).map((_,i)=>(
          <div key={i} style={{width:16,height:16,borderRadius:"50%",border:`3px solid ${digits[i]?C.accent:C.border}`,background:digits[i]?C.accent:"transparent",transition:"all .15s"}}/>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k,i)=>(
          <button key={i} onClick={()=>k==="⌫"?del():k===""?null:press(k)}
            style={{padding:"13px 0",borderRadius:10,border:k?`2px solid ${C.border}`:"none",background:k==="⌫"?"#fff2f2":k?"#fff":"transparent",color:k==="⌫"?C.red:C.text,fontSize:k==="⌫"?17:20,fontWeight:700,cursor:k?"pointer":"default",transition:"all .12s",fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",boxShadow:k?"0 1px 4px rgba(0,0,0,.07)":"none"}}
            onMouseEnter={e=>{if(k&&k!=="⌫"){e.currentTarget.style.background="#f0f5f0";e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}}
            onMouseLeave={e=>{if(k&&k!=="⌫"){e.currentTarget.style.background="#fff";e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text;}}}
          >{k}</button>
        ))}
      </div>
      <p className="sy" style={{fontSize:12,color:"#000",textAlign:"center",marginTop:12}}>You can also type your PIN using the keyboard</p>
    </div>
  );
}

function AuthScreen({onRegister, onLogin, accounts}) {
  const [tab,       setTab]      = useState("login");
  const [name,      setName]     = useState("");
  const [email,     setEmail]    = useState("");
  const [pin,       setPin]      = useState("");
  const [pin2,      setPin2]     = useState("");
  const [step,      setStep]     = useState("details");
  const [err,       setErr]      = useState("");
  const [forgotPin, setForgotPin]= useState(false);
  const [fpEmail,   setFpEmail]  = useState("");
  const [fpMsg,     setFpMsg]    = useState("");

  const resetAll = t => { setTab(t); setName(""); setEmail(""); setPin(""); setPin2(""); setStep("details"); setErr(""); setForgotPin(false); setFpEmail(""); setFpMsg(""); };

  const handleDetailsNext = () => {
    setErr("");
    if (!name.trim()) return setErr("Name is required.");
    if (!email.includes("@")) return setErr("Enter a valid email address.");
    if (accounts.find(a=>a.email.toLowerCase()===email.toLowerCase().trim())) return setErr("An account with that email already exists.");
    setStep("pin");
  };
  const handlePinNext = () => {
    if (pin.length < 4) return;
    setErr(""); setPin2(""); setStep("confirmpin");
  };
  const handleConfirmPin = async val => {
    setPin2(val);
    if (val.length === 4) {
      if (val !== pin) { setErr("PINs don't match. Try again."); setPin(""); setPin2(""); setStep("pin"); }
      else {
        const e = await onRegister(name.trim(), email.trim(), pin);
        if (e) {
          if (typeof e === "string" && e.includes("PIN") && e.includes("taken")) { setErr(e); setPin(""); setPin2(""); setStep("pin"); }
          else { setErr(typeof e === "string" ? e : "Something went wrong."); setStep("details"); }
        }
      }
    }
  };
  // eslint-disable-next-line no-unused-vars
  const handleLoginPin = val => {
    setPin(val); setErr("");
    if (val.length === 4) { const e = onLogin(val); if (e) { setErr(e); setPin(""); } }
  };
  const handleForgotPin = () => {
    const acc = accounts.find(a=>a.email.toLowerCase()===fpEmail.toLowerCase().trim());
    if (!acc) return setFpMsg("No account found with that email address.");
    setFpMsg(`Your PIN starts with ${acc.pin[0]} - if you still can't remember, ask the organiser to reset it for you in the Admin panel.`);
  };

  if (forgotPin) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px",background:"linear-gradient(160deg,#0f2010 0%,#1a3a1a 40%,#2d6a4f 100%)"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:52,marginBottom:8}}>🏇</div>
          <h1 className="cg" style={{fontSize:40,fontWeight:900,color:"#fff"}}>Spring Carnival</h1>
        </div>
        <div className="card fu" style={{boxShadow:"0 8px 40px rgba(0,0,0,.3)",border:"none"}}>
          <h3 className="cg" style={{fontSize:24,marginBottom:6}}>Forgot your PIN?</h3>
          <p className="sy" style={{fontSize:14,color:"#000",marginBottom:16}}>Enter the email address you signed up with and we'll give you a hint.</p>
          <input className="inp sy" type="email" placeholder="Your email address" value={fpEmail} onChange={e=>{setFpEmail(e.target.value);setFpMsg("");}} onKeyDown={e=>e.key==="Enter"&&handleForgotPin()} style={{marginBottom:10}}/>
          {fpMsg&&(
            <div style={{padding:"12px 16px",background:fpMsg.includes("No account")?C.redBg:C.greenBg,border:`1px solid ${fpMsg.includes("No account")?C.redBd:C.greenBd}`,borderRadius:10,marginBottom:12}}>
              <p className="sy" style={{fontSize:14,color:fpMsg.includes("No account")?C.red:C.green}}>{fpMsg}</p>
            </div>
          )}
          <button className="btn btn-gold" style={{width:"100%",padding:14,fontSize:15,marginBottom:10}} onClick={handleForgotPin}>Get Hint →</button>
          <button className="btn btn-ghost" style={{width:"100%",padding:12,fontSize:14}} onClick={()=>setForgotPin(false)}>← Back to Sign In</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px",background:"linear-gradient(160deg,#0f2010 0%,#1a3a1a 40%,#2d6a4f 100%)"}}>
      <div style={{width:"100%",maxWidth:520}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:"clamp(34px,9vw,52px)",marginBottom:6}}>🏇</div>
          <h1 className="cg" style={{fontSize:"clamp(24px, 6.5vw, 42px)",fontWeight:900,color:"#fff",lineHeight:1.05}}>Spring Carnival</h1>
          <p className="sy" style={{fontSize:12,marginTop:8,color:"rgba(255,255,255,.9)",letterSpacing:".18em",textTransform:"uppercase",fontWeight:700}}>GROUP 1 COMPETITION</p>
          <p className="sy" style={{fontSize:13,marginTop:6,color:"rgba(255,255,255,.8)",fontStyle:"italic"}}>May the best punter win</p>
        </div>
        <div className="card fu">
          <div className="tog" style={{marginBottom:20}}>
            <button className={`topt${tab==="login"?" on":""}`} onClick={()=>resetAll("login")}>Sign In</button>
            <button className={`topt${tab==="register"?" on":""}`} onClick={()=>resetAll("register")}>Create Account</button>
          </div>

          {tab==="login"&&(
            <>
              {step==="details"&&(
                <>
                  <div style={{textAlign:"center",marginBottom:18}}>
                    <p className="sy" style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:4}}>Welcome back!</p>
                    <p className="sy soft" style={{fontSize:12}}>Enter the name you signed up with.</p>
                  </div>
                  {err&&(
                    <div style={{padding:"10px 14px",background:C.redBg,border:`1px solid ${C.redBd}`,borderRadius:8,marginBottom:12,textAlign:"center"}}>
                      <p className="sy" style={{color:C.red,fontSize:12}}>{err}</p>
                      {err.includes("No account")&&<p className="sy" style={{fontSize:12,color:C.soft,marginTop:4}}>Haven't signed up? <button className="sy" style={{background:"none",border:"none",color:C.accent,fontWeight:700,cursor:"pointer",fontSize:12,textDecoration:"underline"}} onClick={()=>resetAll("register")}>Create an account →</button></p>}
                    </div>
                  )}
                  <input className="inp sy" placeholder="Your full name" value={name} onChange={e=>{setName(e.target.value);setErr("");}} onKeyDown={e=>{if(e.key==="Enter"){const found=accounts.find(a=>a.name.toLowerCase()===name.toLowerCase().trim());if(!found){setErr("No account found with that name.");}else{setErr("");setStep("pin");setPin("");}}}} style={{marginBottom:10}}/>
                  <button className="btn btn-gold" style={{width:"100%",padding:13,fontSize:13}} onClick={()=>{
                    const found = accounts.find(a=>a.name.toLowerCase()===name.toLowerCase().trim());
                    if(!found) return setErr("No account found with that name.");
                    setErr(""); setStep("pin"); setPin("");
                  }}>Continue →</button>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:14}}>
                    <button className="sy" style={{background:"none",border:"none",color:C.soft,cursor:"pointer",fontSize:12,textDecoration:"underline"}} onClick={()=>setForgotPin(true)}>Forgot PIN?</button>
                    <button className="sy" style={{background:"none",border:"none",color:C.accent,fontWeight:700,cursor:"pointer",fontSize:12,textDecoration:"underline"}} onClick={()=>resetAll("register")}>New? Create account →</button>
                  </div>
                </>
              )}
              {step==="pin"&&(
                <>
                  <div style={{textAlign:"center",marginBottom:18}}>
                    <p className="sy" style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:4}}>Hi, {name}! 👋</p>
                    <p className="sy soft" style={{fontSize:12}}>Now enter your 4-digit PIN.</p>
                  </div>
                  {err&&(
                    <div style={{padding:"10px 14px",background:C.redBg,border:`1px solid ${C.redBd}`,borderRadius:8,marginBottom:12,textAlign:"center"}}>
                      <p className="sy" style={{color:C.red,fontSize:12}}>{err}</p>
                    </div>
                  )}
                  <PinPad value={pin} onChange={val=>{
                    setPin(val); setErr("");
                    if(val.length===4){ const e=onLogin(name,val); if(e){setErr(e);setPin("");} }
                  }}/>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:14}}>
                    <button className="sy" style={{background:"none",border:"none",color:C.soft,cursor:"pointer",fontSize:12,textDecoration:"underline"}} onClick={()=>setForgotPin(true)}>Forgot PIN?</button>
                    <button className="sy" style={{background:"none",border:"none",color:C.soft,cursor:"pointer",fontSize:12,textDecoration:"underline"}} onClick={()=>{setStep("details");setPin("");setErr("");}}>← Back</button>
                  </div>
                </>
              )}
            </>
          )}

          {tab==="register"&&(
            <>
              {step==="details"&&(
                <>
                  <p className="sy soft" style={{fontSize:13,marginBottom:14}}>Enter your details then choose a 4-digit PIN. That's all you'll need to sign in each time.</p>
                  <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
                    <input className="inp sy" placeholder="Full name" value={name} onChange={e=>{setName(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&handleDetailsNext()}/>
                    <input className="inp sy" type="email" placeholder="Your email address" value={email} onChange={e=>{setEmail(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&handleDetailsNext()}/>
                  </div>
                  {err&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10}}>{err}</p>}
                  <button className="btn btn-gold" style={{width:"100%",padding:13,fontSize:13}} onClick={handleDetailsNext}>Continue →</button>
                  <div style={{marginTop:14,padding:"10px 14px",background:"rgba(26,86,160,.06)",border:"1px solid rgba(26,86,160,.15)",borderRadius:8}}>
                    <p className="sy" style={{fontSize:13,color:"#000"}}>🎯 You <strong style={{color:C.accent}}>must spend $24.00</strong> on each individual Group 1 race - every race has its own $24 budget.</p>
                  </div>
                </>
              )}
              {step==="pin"&&(
                <>
                  <div style={{textAlign:"center",marginBottom:12}}>
                    <p className="sy" style={{fontSize:14,fontWeight:700,marginBottom:4}}>Choose your 4-digit PIN</p>
                    <p className="sy soft" style={{fontSize:12}}>Choose something memorable - a birthday, lucky number, jersey number etc.</p>
                  </div>
                  {err&&(
                    <div style={{padding:"10px 14px",background:C.redBg,border:`1px solid ${C.redBd}`,borderRadius:8,marginBottom:12,textAlign:"center"}}>
                      <p className="sy" style={{color:C.red,fontSize:12}}>{err}</p>
                    </div>
                  )}
                  <PinPad value={pin} onChange={v=>{setPin(v);setErr("");}}/>
                  <button className="btn btn-gold" style={{width:"100%",marginTop:14,padding:13,fontSize:13}} disabled={pin.length<4} onClick={handlePinNext}>Next - Confirm PIN →</button>
                  <button className="btn btn-ghost" style={{width:"100%",marginTop:8,padding:10,fontSize:12}} onClick={()=>{setStep("details");setPin("");setErr("");}}>← Back</button>
                </>
              )}
              {step==="confirmpin"&&(
                <>
                  <div style={{textAlign:"center",marginBottom:16}}>
                    <p className="sy" style={{fontSize:14,fontWeight:700,marginBottom:4}}>Confirm your PIN</p>
                    <p className="sy soft" style={{fontSize:12}}>Enter your PIN one more time to confirm.</p>
                  </div>
                  {err&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10,textAlign:"center"}}>{err}</p>}
                  <PinPad value={pin2} onChange={handleConfirmPin}/>
                  <button className="btn btn-ghost" style={{width:"100%",marginTop:10,padding:10,fontSize:12}} onClick={()=>{setStep("pin");setPin("");setPin2("");setErr("");}}>← Back</button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// --- LOBBY --------------------------------------------------------------------
function LobbyScreen({races,bets,account,leaderboard,getRaceBalance,onSelect,seasonMessage,accounts}) {
  const w = useWindowWidth();
  const isMobile = w < 700;
  const myBets = bets.filter(b=>b.playerId===account?.id);
  const grouped={};
  races.forEach(r=>{if(!grouped[r.date])grouped[r.date]=[];grouped[r.date].push(r);});
  const upcoming = races.filter(r=>r.status==="upcoming").length;
  const finished = races.filter(r=>r.status==="finished").length;

  return (
    <div className="fu" style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 260px",gap:20,alignItems:"start"}}>
      <div>

        {/* ── Hero header ── */}
        <div style={{background:"linear-gradient(135deg,#1a3a1a 0%,#2d6a4f 100%)",borderRadius:isMobile?14:16,padding:isMobile?"15px 16px":"22px 28px",marginBottom:isMobile?12:16,position:"relative",overflow:"hidden",boxShadow:"0 8px 28px rgba(15,32,16,.28), inset 0 1px 0 rgba(255,255,255,.06)"}}>
          <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"rgba(255,255,255,.04)",pointerEvents:"none"}}/>
          {/* Finish-line stripe, bottom edge */}
          <div style={{position:"absolute",left:0,right:0,bottom:0,height:6,pointerEvents:"none",opacity:.5,background:"repeating-linear-gradient(-45deg,rgba(255,255,255,.5) 0 6px,rgba(255,255,255,0) 6px 12px)",WebkitMaskImage:"linear-gradient(to top,#000,transparent)",maskImage:"linear-gradient(to top,#000,transparent)"}}/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:"#fcd34d",display:"inline-block",flexShrink:0}}/>
                <span style={{fontSize:isMobile?10:11,fontWeight:700,color:"rgba(255,255,255,.65)",letterSpacing:".14em",textTransform:"uppercase"}}>Spring Carnival</span>
              </div>
              <div className="cg" style={{fontSize:isMobile?18:28,fontWeight:900,color:"#fff",lineHeight:1,marginBottom:account?6:0,textShadow:"0 2px 10px rgba(0,0,0,.2)",letterSpacing:"-.01em"}}>Group 1 Competition</div>
              {account&&<div style={{fontSize:isMobile?12:13,color:"rgba(255,255,255,.8)",fontWeight:500}}>Welcome back, <strong style={{color:"#fff"}}>{account.name.split(" ")[0]}</strong> 👋</div>}
            </div>
            {account&&(()=>{
              const myAllBets=bets.filter(b=>b.playerId===account.id);
              const racesNoBet=races.filter(r=>r.status==="upcoming"&&!myAllBets.some(b=>b.raceId===r.id)).length;
              const totalWon=parseFloat(account.totalWon.toFixed(2));
              return(
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:isMobile?19:30,fontWeight:900,color:totalWon>0?"#4ade80":totalWon<0?"#f87171":"#fcd34d",lineHeight:1,fontVariantNumeric:"tabular-nums"}}>
                    {totalWon===0?"$0.00":<AnimatedMoney value={totalWon}/>}
                  </div>
                  <div style={{fontSize:isMobile?9:10,color:"rgba(255,255,255,.6)",marginTop:4,fontWeight:600,letterSpacing:".02em"}}>{racesNoBet>0?`${racesNoBet} race${racesNoBet!==1?"s":""} to bet`:"All bets in ✓"}</div>
                </div>
              );
            })()}
          </div>
          {/* Progress bar — races bet vs total upcoming */}
          {account&&(()=>{
            const myAllBets=bets.filter(b=>b.playerId===account.id);
            const totalUp=races.filter(r=>r.status==="upcoming").length;
            const betOn=races.filter(r=>r.status==="upcoming"&&myAllBets.some(b=>b.raceId===r.id)).length;
            if(!totalUp) return null;
            const pct=Math.round((betOn/totalUp)*100);
            return(
              <div style={{marginTop:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:10,color:"rgba(255,255,255,.6)"}}>Bets placed</span>
                  <span style={{fontSize:10,color:"rgba(255,255,255,.6)"}}>{betOn} of {totalUp}</span>
                </div>
                <div style={{height:4,background:"rgba(255,255,255,.15)",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:pct===100?"#4ade80":"#fcd34d",borderRadius:2,transition:"width .4s ease"}}/>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Quick stats ── */}
        {account&&races.length>0&&(()=>{
          const myAllBets=bets.filter(b=>b.playerId===account.id);
          const mySettled=myAllBets.filter(b=>b.won!==null);
          const myWon=mySettled.filter(b=>b.won===true);
          const totalWon=parseFloat(account.totalWon.toFixed(2));
          return(
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:isMobile?6:8,marginBottom:isMobile?12:16}}>
              {[
                {label:"My Return",icon:"💰",value:totalWon>0?`+${fmt(totalWon)}`:fmt(totalWon),col:totalWon>0?"#16a34a":totalWon<0?"#dc2626":"#555"},
                {label:"Win Rate",icon:"🎯",value:mySettled.length?`${Math.round((myWon.length/mySettled.length)*100)}%`:"—",col:"#1a3a1a"},
                {label:"Races Bet",icon:"🏇",value:`${myAllBets.filter((b,i,a)=>a.findIndex(x=>x.raceId===b.raceId)===i).length} / ${races.length}`,col:"#1a3a1a"},
              ].map(({label,icon,value,col})=>(
                <div key={label} style={{background:"#fff",borderRadius:10,padding:isMobile?"9px 6px 8px":"11px 10px 10px",border:`1px solid ${C.border}`,borderTop:`2.5px solid ${col}`,textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                  <div style={{fontSize:isMobile?9:10,color:"#555",fontWeight:700,marginBottom:4,textTransform:"uppercase",letterSpacing:".05em",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                    <span style={{fontSize:isMobile?10:11}}>{icon}</span>{label}
                  </div>
                  <div className="cg" style={{fontSize:isMobile?14:18,fontWeight:900,color:col,lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{value}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── Empty state ── */}
        {(races.length===0||seasonMessage?.enabled)&&(
          <div style={{padding:isMobile?"32px 20px":"48px 36px",borderRadius:16,background:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",textAlign:"center",marginBottom:16,boxShadow:"0 6px 24px rgba(15,32,16,.22)"}}>
            <div style={{fontSize:48,marginBottom:12}}>🏇</div>
            <div className="cg" style={{fontSize:isMobile?18:22,fontWeight:800,color:"#fff",letterSpacing:"-.01em"}}>{seasonMessage?.text||"Upcoming Group 1 races soon"}</div>
          </div>
        )}

        {/* ── Race groups ── */}
        {Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([date,dayRaces])=>{
          const isToday=date===localDateStr();
          const isTomorrow=date===localDateStr(new Date(Date.now()+86400000));
          const dateLabel=isToday?"Today":isTomorrow?"Tomorrow":new Date(date+"T12:00:00").toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"});
          const dayUpcoming=dayRaces.filter(r=>r.status==="upcoming").length;
          const dayDone=dayRaces.filter(r=>r.status==="finished").length;
          return(
          <div key={date} style={{marginBottom:isMobile?18:24}}>

            {/* Day header */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:isMobile?9:12}}>
              <div style={{
                background:isToday?"#1a3a1a":"transparent",
                border:isToday?"none":"1.5px solid #1a3a1a",
                borderRadius:8,padding:isMobile?"4px 11px":"5px 14px",flexShrink:0,
              }}>
                <span style={{fontSize:isMobile?12:13,fontWeight:800,color:isToday?"#fff":"#1a3a1a",whiteSpace:"nowrap",letterSpacing:".01em",display:"inline-flex",alignItems:"center",gap:isToday?6:0}}>
                  {isToday&&<span style={{fontSize:isMobile?17:19}}>🏇</span>}{dateLabel}
                </span>
              </div>
              <div style={{height:1,flex:1,background:"repeating-linear-gradient(to right,#d4dbd4 0 5px,transparent 5px 10px)"}}/>
              <span style={{fontSize:isMobile?11:12,fontWeight:700,color:"#555",whiteSpace:"nowrap"}}>
                {dayRaces.length} race{dayRaces.length!==1?"s":""}
                {dayDone>0?` · ${dayDone} done`:""}
                {dayUpcoming>0?` · ${dayUpcoming} open`:""}
              </span>
            </div>

            {/* Race cards — single column list */}
            <div style={{display:"flex",flexDirection:"column",gap:isMobile?6:8}}>
            {dayRaces.sort((a,b)=>(a.raceTime||"").localeCompare(b.raceTime||"")).map((race,raceIdx)=>{
              const rb=myBets.filter(b=>b.raceId===race.id);
              const raceBal=account?getRaceBalance(account.id,race.id):STARTING_BALANCE;
              const isUpcoming=race.status==="upcoming";
              const isFinished=race.status==="finished";
              const isClosed=race.status==="closed";
              const betPlaced=raceBal===0;
              const noBet=raceBal===STARTING_BALANCE&&rb.length===0&&isUpcoming;
              const timeLabel=race.raceTime?race.raceTime.substring(0,5):"TBC";
              const minsUntil=race.raceTime&&race.date?Math.round((new Date(`${race.date}T${race.raceTime}:00`)-new Date())/60000):null;
              const urgent=minsUntil!==null&&minsUntil>=0&&minsUntil<=30&&isUpcoming&&!betPlaced;
              const hasScratched=rb.some(b=>b.won===null&&b.horses.some(n=>race.horses.find(h=>h.number===n)?.scratched));
              const fav=race.horses.filter(h=>!h.scratched).sort((a,b)=>(a.winOdds||99)-(b.winOdds||99))[0];

              // Card accent colour — used sparingly (button, small labels only)
              const accentCol=isFinished?"#94a3b8":isClosed?"#dc2626":betPlaced?"#16a34a":urgent?"#ea580c":"#1a3a1a";

              // My bet
              const displayed=[];const ewPairs=new Set();
              rb.forEach((b,idx)=>{
                if(ewPairs.has(b.id)) return;
                if(b.type==="win"){const pair=rb.find((x,xi)=>xi>idx&&x.type==="place"&&x.horses[0]===b.horses[0]&&Math.abs(new Date(x.placedAt)-new Date(b.placedAt))<5000);if(pair){ewPairs.add(pair.id);displayed.push({...b,type:"eachway",pairPayout:(b.payout||0)+(pair.payout||0),pairWon:b.won||pair.won,bothLost:b.won===false&&pair.won===false});return;}}
                if(!ewPairs.has(b.id)) displayed.push(b);
              });
              const myBet=displayed[0]||null;
              const hn=myBet?race.horses.find(h=>h.number===myBet.horses[0]):null;
              const def2=myBet?BET_TYPES.find(t=>t.id===BASE_TYPE(myBet.type)):null;
              const isEW=myBet?.type==="eachway"&&myBet.pairPayout!==undefined;
              const betWon=myBet?(isEW?myBet.pairWon:myBet.won===true):false;
              const betLost=myBet?(isEW?myBet.bothLost:myBet.won===false):false;

              return(
                <div key={race.id} style={{
                  borderRadius:12,overflow:"hidden",
                  background:"#fff",
                  border:`1px solid ${hasScratched?"#f59e0b":C.border}`,
                  boxShadow:"0 1px 2px rgba(0,0,0,.04)",
                  cursor:isUpcoming?"pointer":"default",
                  transition:"box-shadow .15s,border-color .15s",
                }}
                  onMouseEnter={e=>{if(!isMobile&&isUpcoming){e.currentTarget.style.boxShadow="0 3px 12px rgba(0,0,0,.08)";e.currentTarget.style.borderColor="#c8d2c8";}}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 2px rgba(0,0,0,.04)";e.currentTarget.style.borderColor=hasScratched?"#f59e0b":C.border;}}
                  onClick={()=>isUpcoming&&onSelect(race.id)}>

                  {/* Scratched warning */}
                  {hasScratched&&(
                    <div style={{padding:"6px 14px",background:"#fef3c7",borderBottom:"1px solid #fde68a",fontSize:12,fontWeight:600,color:"#92400e"}}>
                      ⚠️ Horse scratched — tap to update
                    </div>
                  )}

                  <div style={{display:"flex",alignItems:"center",gap:isMobile?10:14,padding:isMobile?"11px 12px":"14px 18px"}}>

                    {/* Left: race info */}
                    <div style={{flex:1,minWidth:0}}>
                      {/* Venue + race + distance */}
                      <div style={{fontSize:isMobile?10:11,fontWeight:600,color:"#777",textTransform:"uppercase",letterSpacing:".05em",marginBottom:3}}>
                        {[race.venue, race.raceNum?`R${race.raceNum.replace(/[^0-9]/g,"")}`:null, race.distance].filter(Boolean).join("  ·  ")}
                      </div>
                      {/* Race name + grade badge */}
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2,flexWrap:"wrap"}}>
                        <div className="cg" style={{fontSize:isMobile?14:18,fontWeight:800,color:"#000",lineHeight:1.2,letterSpacing:"-.005em"}}>{race.name}</div>
                        {race.grade&&(
                          <span style={{fontSize:isMobile?9:10,fontWeight:800,padding:isMobile?"1px 6px":"2px 7px",borderRadius:20,whiteSpace:"nowrap",flexShrink:0,
                            background:race.grade==="Group 1"?"#fef3c7":"#eef2ff",
                            color:race.grade==="Group 1"?"#92400e":"#3730a3",
                            border:`1px solid ${race.grade==="Group 1"?"#fcd34d":"#c7d2fe"}`}}>
                            {race.grade==="Group 1"?"🏆 GROUP 1":"⭐ FEATURE"}
                          </span>
                        )}
                      </div>

                      {/* One quiet line: just the countdown, or result */}
                      <div style={{fontSize:isMobile?11:12,color:"#666",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                        {isUpcoming&&minsUntil!==null&&minsUntil>=0&&(
                          <span style={{color:urgent?"#ea580c":"#888",fontWeight:urgent?700:400,fontVariantNumeric:"tabular-nums"}}>
                            {urgent?"Closes in ":""}{minsUntil>=60?`${Math.floor(minsUntil/60)}h ${minsUntil%60}m`:`${minsUntil}m`}
                          </span>
                        )}
                        {isClosed&&(
                          <span style={{color:"#b45309",fontWeight:700}}>🔒 Betting closed — awaiting result</span>
                        )}
                        {isFinished&&race.result&&(()=>{
                          const first=race.horses.find(x=>x.number===race.result.first);
                          const second=race.horses.find(x=>x.number===race.result.second);
                          return first?<span><strong style={{color:"#000"}}>1st</strong> {first.name}{second?<> · <strong style={{color:"#000"}}>2nd</strong> {second.name}</>:null}</span>:null;
                        })()}
                      </div>
                    </div>

                    {/* Right: time + one clear action */}
                    <div style={{flexShrink:0,textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                      <div style={{fontSize:isMobile?14:15,fontWeight:700,color:urgent?"#ea580c":isClosed?"#b45309":"#555",letterSpacing:"-.3px",lineHeight:1,fontVariantNumeric:"tabular-nums"}}>{timeLabel}</div>

                      {isClosed&&!myBet&&(
                        <span style={{fontSize:12,fontWeight:800,color:"#b45309",background:"#fef3c7",borderRadius:20,padding:"3px 11px",whiteSpace:"nowrap"}}>🔒 Closed</span>
                      )}

                      {isUpcoming&&account&&(
                        betPlaced?(
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                            <span style={{fontSize:12,fontWeight:800,color:"#15803d",background:"#dcfce7",borderRadius:20,padding:"3px 11px"}}>✓ Bet placed</span>
                            <button style={{fontSize:11,color:"#888",background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"inherit",textDecoration:"underline",textUnderlineOffset:2}} onClick={e=>{e.stopPropagation();onSelect(race.id);}}>Change</button>
                          </div>
                        ):myBet?(
                          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
                            <span style={{fontSize:11,fontWeight:700,color:"#b45309",background:"#fef3c7",borderRadius:20,padding:"2px 10px",fontVariantNumeric:"tabular-nums"}}>${raceBal} left</span>
                            <button style={{fontSize:12,fontWeight:700,color:"#fff",background:"#d97706",border:"none",borderRadius:7,padding:"6px 13px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",boxShadow:"0 2px 6px rgba(217,119,6,.3)"}} onClick={e=>{e.stopPropagation();onSelect(race.id);}}>Add more</button>
                          </div>
                        ):(
                          <button style={{fontSize:13,fontWeight:700,color:"#fff",background:"#1a3a1a",border:"none",borderRadius:8,padding:"8px 17px",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(26,58,26,.35)"}} onClick={e=>{e.stopPropagation();onSelect(race.id);}}>Bet Now</button>
                        )
                      )}

                      {/* Settled result */}
                      {myBet&&!isUpcoming&&(
                        <div style={{fontSize:12,textAlign:"right"}}>
                          <span style={{fontWeight:800,fontSize:12,color:betWon?"#15803d":betLost?"#b91c1c":"#888",background:betWon?"#dcfce7":betLost?"#fee2e2":"#f1f1f1",borderRadius:20,padding:"3px 11px"}}>
                            {betWon?"Won":betLost?"Lost":"Pending"}
                          </span>
                          {betWon&&<div style={{fontSize:13,fontWeight:800,color:"#16a34a",marginTop:2,fontVariantNumeric:"tabular-nums"}}>+{fmt(isEW?myBet.pairPayout:myBet.payout)}</div>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
          );
        })}
      </div>


      {/* Right sidebar */}
      {!isMobile&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Mini leaderboard with speed bars */}
          {leaderboard.length>0&&(()=>{
            const maxW=Math.max(...leaderboard.slice(0,8).map(a=>a.totalWon),0.01);
            return(
              <div style={{background:"#fff",borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
                <div style={{background:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <h3 className="cg" style={{fontSize:14,fontWeight:800,color:"#fff",margin:0,letterSpacing:".01em"}}>🏆 Standings</h3>
                  <span className="sy" style={{fontSize:11,color:"rgba(255,255,255,.6)",fontWeight:600}}>{leaderboard.length} players</span>
                </div>
                <div style={{padding:"6px 0"}}>
                  {leaderboard.slice(0,8).map((a,i)=>{
                    const barW=a.totalWon>0?Math.max(4,Math.round((a.totalWon/maxW)*100)):0;
                    const isMe=a.id===account?.id;
                    const mc=["#ffd700","#c0c0c0","#cd7f32"];
                    return(
                      <div key={a.id} style={{padding:"7px 14px",background:isMe?"rgba(26,58,26,.05)":"transparent",borderLeft:`3px solid ${i<3?mc[i]:isMe?"#1a3a1a":"transparent"}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <span style={{fontSize:i<3?14:12,width:20,flexShrink:0,textAlign:"center"}}>{i<3?["🥇","🥈","🥉"][i]:`${i+1}.`}</span>
                          <span className="sy" style={{flex:1,fontSize:13,fontWeight:isMe?700:500,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}{isMe?" 👈":""}</span>
                          <span className="sy" style={{fontSize:13,fontWeight:700,color:a.totalWon>0?C.green:a.totalWon===0?"#9ca3af":C.red,flexShrink:0,fontVariantNumeric:"tabular-nums"}}>{a.totalWon>0?"+":a.totalWon<0?"-":""}{fmt(Math.abs(a.totalWon))}</span>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:6,paddingLeft:28}}>
                          <div style={{flex:1,height:4,background:"#f0f0f0",borderRadius:2,overflow:"hidden"}}>
                            <div style={{height:"100%",width:`${barW}%`,background:i<3?mc[i]:isMe?"#1a3a1a":C.green,borderRadius:2,transformOrigin:"left",animation:"barFill .6s cubic-bezier(0.16,1,0.3,1) both",animationDelay:`${i*60}ms`}}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {leaderboard.length>8&&(
                    <div style={{padding:"6px 14px",textAlign:"center"}}>
                      <span className="sy" style={{fontSize:11,color:"#000",fontWeight:600}}>+{leaderboard.length-8} more players</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* How to play */}
          <div style={{background:"#fff",borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.06)"}}>
            <div style={{background:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",padding:"12px 16px"}}>
              <h3 className="cg" style={{fontSize:14,fontWeight:800,color:"#fff",margin:0,letterSpacing:".01em"}}>📖 How It Works</h3>
            </div>
            <div style={{padding:"12px 16px"}}>
              {[
                ["💰","$24 per race","Each race has its own $24 budget — you must spend it all"],
                ["🎯","Pick your bet","Win, Place, Each Way, Quinella, Exacta, Trifecta, First Four"],
                ["🔒","Bets lock at race time","Once the race starts, no more changes"],
                ["🏆","Most returns wins","Leaderboard ranked by total winnings"],
              ].map(([icon,title,desc],hi,arr)=>(
                <div key={title} style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:hi<arr.length-1?10:0,paddingBottom:hi<arr.length-1?10:0,borderBottom:hi<arr.length-1?`1px solid ${C.border}`:"none"}}>
                  <span style={{fontSize:15,flexShrink:0,width:28,height:28,borderRadius:8,background:C.accentSoft,display:"flex",alignItems:"center",justifyContent:"center"}}>{icon}</span>
                  <div>
                    <div className="sy" style={{fontSize:12,fontWeight:700,color:"#111",marginBottom:2}}>{title}</div>
                    <div className="sy" style={{fontSize:12,color:"#000",lineHeight:1.5}}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- RACE SCREEN --------------------------------------------------------------
function RaceScreen({race,account,bets,myBets,getRaceBalance,onBack,onQueue,onCancelBet,allBets,accounts}) {
  const w = useWindowWidth();
  const isMobile = w < 700;
  const [betType,setBetType]=useState("win");
  const [sel,setSel]=useState({});
  const [stakeStr,setStakeStr]=useState("");
  const [boxed,setBoxed]=useState(false);
  const [winSel,setWinSel]=useState(null);
  const [placeSel,setPlaceSel]=useState(null);
  const [showBetPanel,setShowBetPanel]=useState(false);
  const [showPopularity,setShowPopularity]=useState(false);
  const [sheetDragY,setSheetDragY]=useState(0);
  const sheetDragRef=useRef({startY:0,dragging:false});
  const stakeInputRef=useRef(null);

  const closeBetPanel=()=>{setShowBetPanel(false);setSel({});setWinSel(null);setPlaceSel(null);setStakeStr("");setSheetDragY(0);};
  const onSheetTouchStart=e=>{sheetDragRef.current={startY:e.touches[0].clientY,dragging:true};};
  const onSheetTouchMove=e=>{
    if(!sheetDragRef.current.dragging) return;
    const delta=e.touches[0].clientY-sheetDragRef.current.startY;
    if(delta>0) setSheetDragY(delta);
  };
  const onSheetTouchEnd=()=>{
    sheetDragRef.current.dragging=false;
    if(sheetDragY>90) closeBetPanel();
    else setSheetDragY(0);
  };

  // Most popular horse calc — aggregate all bets on this race (no player names)
  const raceBets=allBets?allBets.filter(b=>b.raceId===race.id&&b.won===null):[];
  const horsePopularity={};
  raceBets.forEach(b=>b.horses.forEach(n=>{horsePopularity[n]=(horsePopularity[n]||0)+1;}));
  const maxPop=Math.max(...Object.values(horsePopularity),1);
  const totalBettors=[...new Set(raceBets.map(b=>b.playerId))].length;

  // You vs the field
  const myRaceBets=myBets.filter(b=>b.raceId===race.id&&b.won===null);
  const myHorses=[...new Set(myRaceBets.flatMap(b=>b.horses))];

  // Lucky dip — random allocation
  const luckyDip=()=>{
    const types=["win","place","eachway","quinella","exacta","trifecta","firstfour"];
    const t=types[Math.floor(Math.random()*types.length)];
    changeType(t);
    const active=race.horses.filter(h=>!h.scratched);
    if(t==="win"||t==="place"||t==="eachway"){
      const h=active[Math.floor(Math.random()*active.length)];
      setWinSel(h?.number);setPlaceSel(h?.number);
    } else {
      const shuffled=[...active].sort(()=>Math.random()-.5);
      const needed=t==="quinella"?2:t==="exacta"?2:t==="trifecta"?3:4;
      const picked=shuffled.slice(0,needed);
      const newSel={};picked.forEach((h,i)=>newSel[i]=[h.number]);
      setSel(newSel);
    }
    setStakeStr("24");
  };

  const backFav=()=>{
    const active=race.horses.filter(h=>!h.scratched);
    const favourite=active.sort((a,b)=>(a.winOdds||99)-(b.winOdds||99))[0];
    if(!favourite) return;
    changeType("win");
    setWinSel(favourite.number);
    setPlaceSel(favourite.number);
    setStakeStr("24");
  };

  // Bet lock countdown - always called at top level (not inside callback)
  const countdown = useCountdown(race.date, race.raceTime);

  const def=BET_TYPES.find(t=>t.id===BASE_TYPE(betType));
  const om=getOddsMap(race.horses);
  const activeHorses=race.horses.filter(h=>!h.scratched);
  const fav=activeHorses.sort((a,b)=>a.winOdds-b.winOdds)[0];
  const raceBalance = account ? getRaceBalance(account.id, race.id) : 0;

  const numPositions=def.positions.length;
  const stake=parseFloat(stakeStr)||0;

  const changeType=id=>{setBetType(id);setSel({});setWinSel(null);setPlaceSel(null);};

  // Sync winSel/placeSel - sel so combo counting works for win/place/eachway
  const effectiveSelNum = winSel||placeSel;
  const effectiveSel = (betType==="win"||betType==="place"||betType==="eachway")&&effectiveSelNum
    ? {0:[effectiveSelNum]}
    : (sel||{});
  const toggleHorse=(posIdx,num)=>{
    if(race.horses.find(h=>h.number===num)?.scratched) return;
    setSel(prev=>{
      const cur=prev[posIdx]||[];
      if(cur.includes(num)) return{...prev,[posIdx]:cur.filter(n=>n!==num)};
      return{...prev,[posIdx]:[...cur,num]};
    });
  };

  // Cartesian product filtering duplicate horses across positions
  const canShowBoxed=betType==="trifecta"||betType==="firstfour"||betType==="exacta"||betType==="quinella";

  function cartesian(arrays){
    return arrays.reduce((acc,arr)=>{
      const res=[];
      acc.forEach(a=>arr.forEach(b=>{if(!a.includes(b)) res.push([...a,b]);}));
      return res;
    },[[]]);
  }

  // Build combinations
  const getUnboxedCombos=()=>{
    if(betType==="win"||betType==="place"||betType==="eachway"){
      return (effectiveSel[0]||[]).map(n=>[n]);
    }
    const posArrays=def.positions.map((_,i)=>effectiveSel[i]||[]);
    if(posArrays.some(a=>a.length===0)) return [];
    return cartesian(posArrays);
  };

  const getBoxedCombos=()=>{
    const allSel=[...new Set(Object.values(effectiveSel||{}).flat())];
    if(allSel.length<numPositions) return [];
    // Return a placeholder array with the correct LENGTH only - never generate actual permutations
    // This avoids browser freeze with large fields
    if(betType==="quinella"){
      // C(n,2) = n*(n-1)/2
      const n=allSel.length;
      const count=Math.round(n*(n-1)/2);
      return Array(count).fill([]);
    }
    // Exacta/Trifecta/First Four boxed = P(n,r) = n!/(n-r)!
    const n=allSel.length;
    let count=1;
    for(let i=0;i<numPositions;i++) count*=(n-i);
    return Array(Math.min(count,9999)).fill([]);
  };

  const allCombos = boxed&&canShowBoxed ? getBoxedCombos() : getUnboxedCombos();
  const combos = allCombos.length;
  const unitStake = combos > 0 ? parseFloat((stake / combos).toFixed(4)) : stake;

  // Flexi % = (unit stake / $1 base) * 100
  // e.g. $24 across 6 combos = $4 each = 400% flexi
  // TAB requires minimum $1 unit ($1 = 100%), flexi lets you bet fractions
  const flexiPct = combos > 0 ? parseFloat(((stake / combos) * 100).toFixed(1)) : 0;
  // For boxed bets: total outlay displayed should reflect full $24 stake 

  // Each Way costs stake x2 (one win bet + one place bet)
  const totalCost = betType==="eachway" ? stake * 2 : stake;

  const isReady=()=>{
    if(stake<=0) return false;
    if(combos===0) return false;
    if(totalCost>raceBalance) return false;
    return true;
  };

  const handleAdd=()=>{
    if(!isReady()) return;
    if(betType==="eachway") {
      allCombos.forEach(h=>{
        onQueue(race.id,"win",h,stake);
        onQueue(race.id,"place",h,stake);
      });
    } else if(boxed&&canShowBoxed) {
      // Boxed toggle: every selected horse can be in ANY position — no order to
      // preserve. Store the FULL stake as one bet; tagged "_boxedN" (N = combos)
      // so the app KNOWS it's boxed instead of guessing from horse count.
      const allSel=[...new Set(Object.values(effectiveSel||{}).flat())];
      onQueue(race.id,betType+"_boxed"+combos,allSel,stake,combos);
    } else if(combos>1) {
      // Unboxed, but more than one horse picked for at least one position
      // (e.g. a banker + a couple of backup runners). Store horses in
      // position order (duplicates across positions kept) plus a "shape" —
      // how many horses were picked per position — so the exact grouping
      // can still be shown later, instead of collapsing into an undifferentiated
      // "boxed" list.
      const posArrays = def.positions.map((_,i)=>effectiveSel[i]||[]);
      const horsesInOrder = posArrays.flat();
      const shape = posArrays.map(a=>a.length).join("-");
      onQueue(race.id,`${betType}_multi${combos}x${shape}`,horsesInOrder,stake,combos);
    } else {
      allCombos.forEach(h=>onQueue(race.id,betType,h,unitStake));
    }
    setSel({});
    setWinSel(null);
    setPlaceSel(null);
    setStakeStr("");
  };

  // Describes a bet's horses for display — shows ordinal order (1st/2nd/3rd...)
  // for straight unboxed picks, per-position groups for "multi" bets (unboxed
  // but >1 horse in a position), or a plain "any order" list for a true box.
  const describeBetHorses = (b) => {
    const d = BET_TYPES.find(t=>t.id===BASE_TYPE(b.type));
    const nameFor = n => { const h = race.horses.find(x=>x.number===n); return h ? `#${n} ${h.name}` : `#${n}`; };
    const isTrueBox = IS_TRUE_BOX(b.type);
    const isBoxedStyle = IS_BOXED_TYPE(b.type);
    const isOrdered = d && d.positions.length>1 && !isBoxedStyle && BASE_TYPE(b.type)!=="quinella";
    const shape = MULTI_SHAPE(b.type);
    let groups = null;
    if (shape && d) {
      let idx = 0;
      groups = d.positions.map((pos,i)=>{
        const count = shape[i]||0;
        const names = b.horses.slice(idx, idx+count).map(nameFor);
        idx += count;
        return { label: pos.label, names };
      }).filter(g=>g.names.length>0);
    }
    const names = [...new Set(b.horses)].map(nameFor);
    return { names, isBoxedStyle, isTrueBox, isOrdered, groups, positions: d?.positions||[] };
  };

  // Which positions each horse is selected for
  const horsePositions=(num)=>{
    if(boxed) return (effectiveSel[0]||[]).includes(num)?["Selected"]:[];
    return def.positions.map((p,i)=>(effectiveSel[i]||[]).includes(num)?p.label:null).filter(Boolean);
  };

  return (
    <div className="sr">
      {/* Header */}
      <div style={{marginBottom:isMobile?12:20}}>
        <button className="sy" style={{marginBottom:14,fontSize:13,padding:"7px 14px",fontWeight:600,background:"transparent",border:"none",color:"#1a3a1a",cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:5,paddingLeft:0}} onClick={onBack}>
          ← Back
        </button>

        {/* Race hero header */}
        <div style={{borderRadius:16,overflow:"hidden",boxShadow:"0 4px 24px rgba(0,0,0,.12)"}}>

          {/* Top: dark green — all race info */}
          <div style={{background:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",padding:isMobile?"13px 15px":"22px 28px",position:"relative",overflow:"hidden"}}>
            {/* Subtle texture */}
            <div style={{position:"absolute",top:-40,right:-40,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,.04)",pointerEvents:"none"}}/>
            <div style={{position:"absolute",bottom:-20,left:-20,width:100,height:100,borderRadius:"50%",background:"rgba(255,255,255,.03)",pointerEvents:"none"}}/>

            {/* Venue + race info line */}
            <div style={{fontSize:isMobile?10:11,fontWeight:700,color:"rgba(255,255,255,.85)",letterSpacing:".06em",textTransform:"uppercase",marginBottom:6}}>
              {[race.venue, race.raceNum?`Race ${race.raceNum.replace(/[^0-9]/g,"")}`:null, race.distance, race.horses.filter(h=>!h.scratched).length+" runners"].filter(Boolean).join("  ·  ")}
            </div>

            {/* Race name + budget side by side */}
            <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:10}}>
              <h2 className="cg" style={{fontSize:isMobile?18:30,fontWeight:900,color:"#fff",lineHeight:1.1,margin:0,flex:1,minWidth:0}}>{race.name}</h2>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:isMobile?21:36,fontWeight:900,lineHeight:1,color:raceBalance===0?"#4ade80":"#fcd34d"}}>
                  {raceBalance===0?"✓":fmt(raceBalance)}
                </div>
                <div style={{fontSize:isMobile?9:11,color:"rgba(255,255,255,.85)",marginTop:3,fontWeight:600}}>
                  {raceBalance===0?"All in!":raceBalance===STARTING_BALANCE?"budget":"of $24 left"}
                </div>
              </div>
            </div>

            {/* Race time + countdown */}
            {race.raceTime&&(
              <div style={{marginTop:10,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:isMobile?13:15,fontWeight:700,color:"rgba(255,255,255,.9)"}}>{race.raceTime.substring(0,5)}</span>
                {race.status==="upcoming"&&countdown&&!countdown.expired&&(()=>{
                  const r=countdown;
                  const totalMins=r.h*60+r.m;
                  const label=r.h>0?`${r.h}h ${r.m}m`:`${String(r.m).padStart(2,"0")}:${String(r.s).padStart(2,"0")}`;
                  const isUrgent=totalMins<5;
                  return(
                    <span style={{fontSize:isMobile?11:13,fontWeight:700,color:isUrgent?"#fcd34d":"#fff",animation:isUrgent?"pulse 1s infinite":"none"}}>
                      {isUrgent?"⚡ ":""}Closes in {label}{isUrgent?" — hurry!":""}
                    </span>
                  );
                })()}
                {race.status==="closed"&&<span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>🔒 Betting closed</span>}
                {race.status==="finished"&&<span style={{fontSize:12,fontWeight:700,color:"#4ade80"}}>✓ Race finished</span>}
              </div>
            )}

            {race.oddsAsOf&&<div style={{marginTop:6,fontSize:11,color:"rgba(255,255,255,.75)",fontWeight:500}}>Odds as of {race.oddsAsOf}</div>}

            {/* Results strip — 1st, 2nd, 3rd */}
            {race.status==="finished"&&race.result&&(()=>{
              const placings=[
                ["1st",race.result.first,"#fcd34d"],
                ["2nd",race.result.second,"#e5e7eb"],
                ["3rd",race.result.third,"#dba463"],
              ].filter(([,num])=>num!=null).map(([label,num,col])=>[label,race.horses.find(h=>h.number===num),col]).filter(([,h])=>h);
              if(placings.length===0) return null;
              return(
                <div style={{marginTop:12,display:"flex",gap:isMobile?6:10,flexWrap:"wrap"}}>
                  {placings.map(([label,h,col])=>(
                    <div key={label} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.1)",borderRadius:20,padding:isMobile?"4px 10px":"5px 12px"}}>
                      <span style={{fontSize:11,fontWeight:800,color:col}}>{label}</span>
                      <span style={{fontSize:isMobile?12:13,fontWeight:700,color:"#fff"}}>#{h.number} {h.name}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Budget progress bar */}
          {race.status==="upcoming"&&(()=>{
            const pct=Math.round(((STARTING_BALANCE-raceBalance)/STARTING_BALANCE)*100);
            const barCol=raceBalance===0?"#4ade80":pct>0?"#fcd34d":"#f87171";
            return(
              <div style={{height:4,background:"#0f2010"}}>
                <div style={{height:"100%",width:`${pct}%`,background:barCol,transition:"width .4s ease"}}/>
              </div>
            );
          })()}
        </div>

        {/* Group Picks toggle */}
        {race.status==="upcoming"&&totalBettors>0&&(
          <button onClick={()=>setShowPopularity(p=>!p)} className="sy" style={{marginTop:6,width:"100%",padding:"8px",borderRadius:10,background:showPopularity?"#1a3a1a":"#fff",border:`1.5px solid ${showPopularity?"#1a3a1a":"#e5e7eb"}`,color:showPopularity?"#fff":"#000",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            📊 {showPopularity?"Hide":"See"} Group Picks
          </button>
        )}

          {/* You vs the Field panel */}
          {showPopularity&&race.status==="upcoming"&&totalBettors>0&&(
            <div style={{marginTop:10,padding:"12px 14px",background:"#f8fffe",borderRadius:12,border:`1px solid ${C.greenBd}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span className="sy" style={{fontSize:12,fontWeight:700,color:C.accent}}>📊 Group Picks — {totalBettors} player{totalBettors!==1?"s":""} have bet</span>
                <span className="sy" style={{fontSize:11,color:"#000",fontWeight:600}}>No names shown</span>
              </div>
              {race.horses.filter(h=>!h.scratched).sort((a,b)=>(horsePopularity[b.number]||0)-(horsePopularity[a.number]||0)).map(h=>{
                const pop=horsePopularity[h.number]||0;
                const barW=pop>0?Math.round((pop/maxPop)*100):0;
                const isBacked=myHorses.includes(h.number);
                return(
                  <div key={h.number} style={{marginBottom:7}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                      <div style={{width:26,height:26,borderRadius:6,background:"#fff",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,position:"relative"}}>
                        {h.silkUrl?<img src={h.silkUrl} alt="" referrerPolicy="no-referrer" style={{width:20,height:20,objectFit:"contain"}} onError={e=>{e.target.style.display="none";const fb=e.target.parentNode.querySelector(".silk-fb");if(fb)fb.style.display="flex";}}/>:null}
                        <div className="silk-fb" style={{width:22,height:22,borderRadius:5,background:silkCol(h.number),display:h.silkUrl?"none":"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff",position:"absolute"}}>{h.number}</div>
                      </div>
                      <span className="sy" style={{flex:1,fontSize:12,fontWeight:isBacked?700:500,color:"#111"}}>{h.name}</span>
                      {isBacked&&<span style={{fontSize:10,padding:"1px 6px",background:C.accent,color:"#fff",borderRadius:20,fontWeight:700,flexShrink:0}}>You ✓</span>}
                      <span className="sy" style={{fontSize:11,color:"#000",flexShrink:0}}>{pop} pick{pop!==1?"s":""}</span>
                    </div>
                    <div style={{height:6,background:"#e8f5e8",borderRadius:3,overflow:"hidden",marginLeft:30}}>
                      <div style={{height:"100%",width:`${barW}%`,background:isBacked?C.accent:C.green,borderRadius:3,opacity:.8,transition:"width .5s ease"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {myBets.length>0&&(
            <div style={{marginTop:10,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
              <p className="sy" style={{fontSize:12,fontWeight:700,color:"#000",textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Your Bets on This Race</p>
              <div style={{display:"flex",flexDirection:"column",gap:5}}>
                {myBets.map(b=>{
                  const d=BET_TYPES.find(t=>t.id===BASE_TYPE(b.type));
                  const canCancel=b.won===null&&race.status==="upcoming";
                  const {names:horseNames,isTrueBox,isOrdered,groups,positions}=describeBetHorses(b);
                  return(
                    <div key={b.id} style={{padding:"9px 12px",borderRadius:8,background:b.won===true?C.greenBg:b.won===false?C.redBg:"rgba(26,58,26,.06)",border:`1.5px solid ${b.won===true?C.greenBd:b.won===false?C.redBd:"#1a3a1a"}`}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6,marginBottom:horseNames.length>1?4:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6}}>
                          <span className="sy" style={{fontSize:12,fontWeight:700,color:b.won===true?C.green:b.won===false?C.red:"#1a3a1a"}}>{d?.label}</span>
                          <span className="sy" style={{fontSize:12,fontWeight:700,color:"#000"}}>{fmt(b.stake)}</span>
                          {b.won===true&&<span className="sy" style={{fontSize:12,color:C.green,fontWeight:700}}>+{fmt(b.payout)}</span>}
                          {b.won===false&&<span className="sy" style={{fontSize:12,color:C.red}}>Lost</span>}
                        </div>
                        {canCancel&&<button className="sy" style={{fontSize:11,padding:"2px 8px",borderRadius:5,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:700,flexShrink:0}} onClick={()=>{if(window.confirm("Cancel this bet?"))onCancelBet(b.id);}}>Cancel</button>}
                      </div>
                      {/* All horses */}
                      {horseNames.length===1?(
                        <div className="sy" style={{fontSize:12,color:"#000"}}>{horseNames[0]}</div>
                      ):isOrdered?(
                        <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:4,marginTop:2}}>
                          {horseNames.map((name,i)=>(
                            <Fragment key={i}>
                              <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:"#1a3a1a",color:"#fff",fontWeight:700}}>
                                {positions[i]?.label||`${i+1}th`} {name}
                              </span>
                              {i<horseNames.length-1&&<span style={{fontSize:11,color:"#888"}}>→</span>}
                            </Fragment>
                          ))}
                        </div>
                      ):groups?(
                        <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:4,marginTop:2}}>
                          <span style={{fontSize:9,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:".04em",width:"100%",marginBottom:1}}>🎯 Multi — any of these combos</span>
                          {groups.map((g,i)=>(
                            <Fragment key={i}>
                              <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:"#1a3a1a",color:"#fff",fontWeight:700}}>
                                {g.label} {g.names.join(" / ")}
                              </span>
                              {i<groups.length-1&&<span style={{fontSize:11,color:"#888"}}>→</span>}
                            </Fragment>
                          ))}
                        </div>
                      ):(
                        <div style={{marginTop:2}}>
                          {isTrueBox&&<div className="sy" style={{fontSize:10,fontWeight:700,color:"#888",marginBottom:3,textTransform:"uppercase",letterSpacing:".04em"}}>🎲 Boxed — any order</div>}
                          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                            {horseNames.map((name,i)=>(
                              <span key={i} style={{fontSize:11,padding:"2px 8px",borderRadius:20,background:"#1a3a1a",color:"#fff",fontWeight:600}}>
                                {name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>

      {/* Mobile - single Place a Bet button */}
      {isMobile&&race.status==="upcoming"&&(
        <button className="sy" style={{width:"100%",marginBottom:8,padding:"12px",borderRadius:12,background:"#1a3a1a",border:"none",color:"#fff",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 16px rgba(26,58,26,.25)"}}
          onClick={()=>setShowBetPanel(true)}>
          Place Bet
        </button>
      )}

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 290px",gap:isMobile?10:14,alignItems:"start"}}>
        {/* Horse field */}
        <div>
          {/* Desktop column headers */}
          {!isMobile&&(
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"0 10px 6px",borderBottom:`1px solid ${C.border}`,marginBottom:6}}>
              <span className="sy" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".1em",color:"#000",width:72,textAlign:"center",fontWeight:700}}>Win</span>
              <span className="sy" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".1em",color:"#000",width:80,textAlign:"center",fontWeight:700}}>Place</span>
            </div>
          )}

          {race.horses.map((h,idx)=>{
            const scr=h.scratched;
            const posLabels=horsePositions(h.number);
            const isSel=posLabels.length>0;
            const isBoxedSel = boxed&&(sel[0]||[]).includes(h.number);
            const highlighted = isSel||isBoxedSel;
            const winActive=(betType==="win"||betType==="eachway")&&winSel===h.number;
            const placeActive=(betType==="place"||betType==="eachway")&&placeSel===h.number;

            return (
              <div key={h.number} style={{
                marginBottom:isMobile?2:8,
                borderRadius:isMobile?8:12,
                border:`2px solid ${(winActive||placeActive||highlighted)?"#1a3a1a":scr?"#f3f4f6":"#e5e7eb"}`,
                background:(winActive||placeActive||highlighted)?"#f0fdf4":scr?"#f0f2f0":"#f7f9f7",
                overflow:"hidden",opacity:scr?0.6:1,transition:"all .15s",
              }}>
                <div style={{display:"flex",alignItems:"stretch",gap:0}}>
                  {/* Number + Silk */}
                  <div style={{flexShrink:0,display:"flex",alignItems:"stretch",alignSelf:"stretch",overflow:"hidden",borderRadius:isMobile?"7px 0 0 7px":"10px 0 0 10px",borderRight:`1px solid ${C.border}`}}>
                    {/* Runner number */}
                    <div style={{width:isMobile?22:34,display:"flex",alignItems:"center",justifyContent:"center",background:scr?"#9ca3af":"#1a3a1a",alignSelf:"stretch"}}>
                      <span style={{fontSize:isMobile?11:13,fontWeight:800,color:"#fff"}}>{h.number}</span>
                    </div>
                    {/* Silk image or colour circle */}
                    <div style={{width:isMobile?38:52,display:"flex",alignItems:"center",justifyContent:"center",padding:isMobile?"4px":"6px",background:"#fff"}}>
                      {h.silkUrl?(
                        <img src={h.silkUrl} alt="" referrerPolicy="no-referrer"
                          style={{width:isMobile?28:38,height:isMobile?28:38,objectFit:"contain",display:"block"}}
                          onError={e=>{e.target.style.display="none";const fb=e.target.parentNode.querySelector(".silk-fb");if(fb)fb.style.display="flex";}}/>
                      ):null}
                      <div className="silk-fb" style={{
                        width:isMobile?28:38,height:isMobile?28:38,borderRadius:"50%",
                        background:scr?"#d1d5db":silkCol(h.number),
                        display:h.silkUrl?"none":"flex",
                        alignItems:"center",justifyContent:"center",
                        fontSize:isMobile?11:14,fontWeight:800,color:"#fff",
                        boxShadow:"inset 0 -2px 0 rgba(0,0,0,.2)",flexShrink:0,
                      }}>{h.number}</div>
                    </div>
                  </div>

                  {/* Horse info */}
                  <div style={{flex:1,padding:isMobile?"9px 10px":"10px 12px",minWidth:0,cursor:scr?"default":"pointer"}}
                    onClick={()=>{if(scr)return;if(!isMobile){if(betType==="win"||betType==="place")toggleHorse(0,h.number);if(canShowBoxed&&boxed)toggleHorse(0,h.number);}}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:2}}>
                      <span className="sy" style={{fontWeight:700,fontSize:isMobile?15:16,textDecoration:scr?"line-through":"",color:scr?"#9ca3af":"#000",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}{h.barrier?<span style={{fontWeight:400,color:C.muted,fontSize:isMobile?12:14}}> ({h.barrier})</span>:""}</span>
                      {!scr&&h.number===fav?.number&&<span style={{fontSize:12,padding:"1px 6px",background:"#fffbeb",color:C.gold,border:`1px solid ${C.gold}`,borderRadius:20,fontWeight:800}}>⭐ FAV</span>}
                      {scr&&<span style={{fontSize:12,padding:"1px 6px",background:C.redBg,color:C.red,border:`1px solid ${C.redBd}`,borderRadius:20,fontWeight:700}}>SCR</span>}
                      {!isMobile&&posLabels.length>0&&<span style={{fontSize:11,padding:"2px 9px",background:"#1a3a1a",color:"#fff",borderRadius:20,fontWeight:700}}>✓ Selected</span>}
                    </div>
                    <div className="sy" style={{fontSize:isMobile?11:12,color:"#555",lineHeight:1.4,marginTop:1}}>
                      {[h.jockey?.replace(/^J\s+/i,"").replace(/^J\./i,"").trim(),h.trainer?.replace(/^T\s+/i,"").replace(/^T\./i,"").trim(),h.weight?h.weight+"kg":null].filter(Boolean).join(" · ")}
                    </div>
                    {h.form&&h.form.length>0&&(
                      <div style={{display:"flex",gap:2,marginTop:isMobile?2:4}}>
                        {h.form.slice(-5).map((f,fi)=>(<span key={fi} style={{width:isMobile?12:16,height:isMobile?12:16,borderRadius:2,background:formColor(f),display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?7:9,fontWeight:800,color:"#fff"}}>{f.toUpperCase()}</span>))}
                      </div>
                    )}
                    {/* Desktop: position pills for exotics inline */}
                    {!isMobile&&!scr&&canShowBoxed&&!boxed&&(
                      <div style={{display:"flex",gap:3,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                        <span className="sy" style={{fontSize:12,color:C.accent,fontWeight:600}}>${h.winOdds.toFixed(2)}W · ${h.placeOdds.toFixed(2)}P</span>
                      </div>
                    )}
                    {!isMobile&&!scr&&canShowBoxed&&boxed&&(
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                        <span className="sy" style={{fontSize:12,fontWeight:700,color:"#000"}}>${h.winOdds.toFixed(2)}W · ${h.placeOdds.toFixed(2)}P</span>
                      </div>
                    )}
                  </div>

                  {/* Right side - TAB style buttons */}
                  {!scr ? (
                    isMobile ? (
                      /* Mobile: TAB-style - Win/Place buttons OR position buttons depending on bet type */
                      betType==="win"||betType==="place"||betType==="eachway" ? (
                        <div style={{display:"flex",gap:3,padding:"6px 5px",flexShrink:0}}>
                          {/* WIN button */}
                          <button className="sy" style={{
                            minWidth:52,padding:"7px 3px",borderRadius:7,textAlign:"center",fontFamily:"inherit",cursor:"pointer",
                            border:`2px solid ${winSel===h.number?"#1a3a1a":"#e5e7eb"}`,
                            background:winSel===h.number?"#1a3a1a":"#fff",
                            color:winSel===h.number?"#fff":"#000",
                          }} onClick={e=>{e.stopPropagation();setWinSel(h.number);setPlaceSel(null);setBetType("win");setSel({0:[h.number]});setShowBetPanel(true);}}>
                            <div style={{fontSize:12,fontWeight:800}}>{winSel===h.number?"✓":"$"}{winSel===h.number?"":h.winOdds?.toFixed(2)}</div>
                            <div style={{fontSize:8,fontWeight:700,letterSpacing:".03em",marginTop:1}}>WIN</div>
                          </button>
                          {/* PLACE button */}
                          <button className="sy" style={{
                            minWidth:52,padding:"7px 3px",borderRadius:7,textAlign:"center",fontFamily:"inherit",cursor:"pointer",
                            border:`2px solid ${placeSel===h.number&&betType!=="win"?"#1a3a1a":"#e5e7eb"}`,
                            background:placeSel===h.number&&betType!=="win"?"#1a3a1a":"#fff",
                            color:placeSel===h.number&&betType!=="win"?"#fff":"#000",
                          }} onClick={e=>{e.stopPropagation();setPlaceSel(h.number);setWinSel(null);setBetType("place");setSel({0:[h.number]});setShowBetPanel(true);}}>
                            <div style={{fontSize:12,fontWeight:800}}>{placeSel===h.number&&betType!=="win"?"✓":"$"}{placeSel===h.number&&betType!=="win"?"":h.placeOdds?.toFixed(2)}</div>
                            <div style={{fontSize:8,fontWeight:700,letterSpacing:".03em",marginTop:1}}>PLACE</div>
                          </button>
                        </div>
                      ) : canShowBoxed&&!boxed ? (
                        /* Exotic position buttons - right side, one line always */
                        <div style={{display:"flex",flexDirection:"column",gap:3,padding:isMobile?"6px 5px":"8px 8px",flexShrink:0,alignItems:"flex-end",justifyContent:"center"}}>
                          <div style={{display:"flex",gap:2}}>
                            {def.positions.map((pos,pi)=>{
                              const isThis=(sel[pi]||[]).includes(h.number);
                              return(
                                <button key={pi} className="sy" style={{
                                  width:isMobile?32:48,height:isMobile?30:44,
                                  borderRadius:7,
                                  border:`2px solid ${isThis?"#1a3a1a":"#d1d5db"}`,
                                  background:isThis?"#1a3a1a":"#fff",
                                  color:isThis?"#fff":"#374151",
                                  cursor:"pointer",fontWeight:800,
                                  fontSize:isMobile?def.positions.length>3?9:10:13,
                                  fontFamily:"inherit",flexShrink:0,
                                  display:"flex",alignItems:"center",justifyContent:"center",
                                  boxShadow:isThis?"0 2px 8px rgba(26,58,26,.3)":"none",
                                  whiteSpace:"nowrap",
                                }} onClick={e=>{e.stopPropagation();toggleHorse(pi,h.number);}}>
                                  {pos.label}
                                </button>
                              );
                            })}
                          </div>
                          {posLabels.length>0&&<div className="sy" style={{fontSize:10,color:"#fff",fontWeight:700,background:"#1a3a1a",padding:"2px 8px",borderRadius:20,flexShrink:0}}>✓ Selected</div>}
                        </div>
                      ) : canShowBoxed&&boxed ? (
                        /* Boxed - single select button */
                        <div style={{padding:"8px 10px",flexShrink:0,display:"flex",alignItems:"center"}}>
                          <button className="sy" style={{padding:"10px 16px",borderRadius:10,border:`2px solid ${(sel[0]||[]).includes(h.number)?"#1a3a1a":"#d1d5db"}`,background:(sel[0]||[]).includes(h.number)?"#1a3a1a":"#fff",color:(sel[0]||[]).includes(h.number)?"#fff":"#374151",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit"}}
                            onClick={e=>{e.stopPropagation();toggleHorse(0,h.number);}}>
                            {(sel[0]||[]).includes(h.number)?"✓ In":"Select"}
                          </button>
                        </div>
                      ) : null
                    ) : (
                      /* Desktop right side - position buttons for exotics, WIN/PLACE for win/place/ew */
                      canShowBoxed&&!boxed ? (
                        <div style={{display:"flex",flexDirection:"column",gap:4,padding:"10px 10px",flexShrink:0,alignItems:"flex-end",justifyContent:"center"}}>
                          <div style={{display:"flex",gap:4}}>
                            {def.positions.map((pos,pi)=>{
                              const isThis=(sel[pi]||[]).includes(h.number);
                              return <button key={pi} className="sy" style={{width:def.positions.length>3?46:52,height:44,borderRadius:9,border:`2px solid ${isThis?"#1a3a1a":"#d1d5db"}`,background:isThis?"#1a3a1a":"#fff",color:isThis?"#fff":"#374151",cursor:"pointer",fontWeight:800,fontSize:def.positions.length>3?11:13,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:isThis?"0 2px 8px rgba(26,58,26,.25)":"none"}} onClick={e=>{e.stopPropagation();toggleHorse(pi,h.number);}}>{pos.label}</button>;
                            })}
                          </div>
                        </div>
                      ) : canShowBoxed&&boxed ? (
                        <div style={{padding:"10px 10px",flexShrink:0,display:"flex",alignItems:"center"}}>
                          <button className="sy" style={{padding:"10px 18px",borderRadius:9,border:`2px solid ${(sel[0]||[]).includes(h.number)?"#1a3a1a":"#d1d5db"}`,background:(sel[0]||[]).includes(h.number)?"#1a3a1a":"#fff",color:(sel[0]||[]).includes(h.number)?"#fff":"#374151",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit"}} onClick={e=>{e.stopPropagation();toggleHorse(0,h.number);}}>
                            {(sel[0]||[]).includes(h.number)?"✓ In":"Select"}
                          </button>
                        </div>
                      ) : (
                        <div style={{display:"flex",gap:5,padding:"10px 8px",flexShrink:0}}>
                          <button className="sy" style={{width:72,padding:"9px 0",borderRadius:8,border:`2px solid ${winSel===h.number?"#1a3a1a":"#e5e7eb"}`,background:winSel===h.number?"#1a3a1a":"#fff",color:winSel===h.number?"#fff":"#000",cursor:"pointer",textAlign:"center",fontFamily:"inherit"}}
                            onClick={e=>{e.stopPropagation();const next=winSel===h.number?null:h.number;setWinSel(next);if(next&&placeSel===h.number){setBetType("eachway");setSel({0:[h.number]});}else if(next){setBetType("win");setSel({0:[h.number]});}else if(placeSel===h.number){setBetType("place");setSel({0:[h.number]});}else{setBetType("win");setSel({});}}}>
                            <div style={{fontSize:14,fontWeight:800}}>{winSel===h.number?"✓":""}{winSel===h.number?"":("$"+h.winOdds.toFixed(2))}</div>
                            <div style={{fontSize:10,fontWeight:700,letterSpacing:".04em",marginTop:1}}>WIN</div>
                          </button>
                          <button className="sy" style={{width:72,padding:"9px 0",borderRadius:8,border:`2px solid ${placeSel===h.number?"#1d4ed8":"#e5e7eb"}`,background:placeSel===h.number?"#1d4ed8":"#fff",color:placeSel===h.number?"#fff":"#000",cursor:"pointer",textAlign:"center",fontFamily:"inherit"}}
                            onClick={e=>{e.stopPropagation();const next=placeSel===h.number?null:h.number;setPlaceSel(next);if(next&&winSel===h.number){setBetType("eachway");setSel({0:[h.number]});}else if(next){setBetType("place");setSel({0:[h.number]});}else if(winSel===h.number){setBetType("win");setSel({0:[h.number]});}else{setBetType("place");setSel({});}}}>
                            <div style={{fontSize:14,fontWeight:800}}>{placeSel===h.number?"✓":""}{placeSel===h.number?"":("$"+h.placeOdds.toFixed(2))}</div>
                            <div style={{fontSize:10,fontWeight:700,letterSpacing:".04em",marginTop:1}}>PLACE</div>
                          </button>
                        </div>
                      )
                    )
                  ) : null}
                  {scr&&(
                    <div style={{display:"flex",alignItems:"center",padding:isMobile?"0 10px 0 4px":"0 14px",flexShrink:0}}>
                      <span className="sy" style={{fontSize:11,fontWeight:800,color:C.red,background:C.redBg,border:`1px solid ${C.redBd}`,borderRadius:20,padding:"4px 10px",whiteSpace:"nowrap"}}>SCRATCHED</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile bet panel */}
        {isMobile&&showBetPanel&&(
          <>
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:899,opacity:Math.max(0,1-sheetDragY/250),transition:sheetDragY===0?"opacity .2s":"none"}} onClick={closeBetPanel}/>
            <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:900,background:"#f7f9f7",borderRadius:"20px 20px 0 0",boxShadow:"0 -4px 30px rgba(0,0,0,.2)",paddingBottom:"env(safe-area-inset-bottom,16px)",maxHeight:"88vh",display:"flex",flexDirection:"column",transform:`translateY(${sheetDragY}px)`,transition:sheetDragY===0?"transform .25s ease":"none"}}>

              {/* Handle + header — swipe down to dismiss */}
              <div
                style={{flexShrink:0,background:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",borderRadius:"20px 20px 0 0",padding:"8px 14px 10px",touchAction:"none",cursor:"grab"}}
                onTouchStart={onSheetTouchStart}
                onTouchMove={onSheetTouchMove}
                onTouchEnd={onSheetTouchEnd}
              >
                <div style={{width:32,height:4,borderRadius:2,background:"rgba(255,255,255,.3)",margin:"0 auto 8px"}}/>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,.65)",fontWeight:600,marginBottom:1,textTransform:"uppercase",letterSpacing:".05em"}}>{def?.label}{canShowBoxed?(boxed?" · Boxed":" · Unboxed"):""}</div>
                    <div style={{fontSize:15,fontWeight:800,color:"#fff"}}>{race.name}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:17,fontWeight:900,color:"#fcd34d"}}>{fmt(raceBalance)}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.6)"}}>budget left</div>
                  </div>
                </div>
              </div>

              {/* Scrollable content */}
              <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>

                {/* Bet type pills */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#000",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>Bet Type</div>
                  <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
                    {BET_TYPES.map(t=>(
                      <button key={t.id} className="sy" style={{flexShrink:0,padding:"7px 12px",borderRadius:20,border:`2px solid ${betType===t.id?"#1a3a1a":"#e5e7eb"}`,background:betType===t.id?"#1a3a1a":"#fff",color:betType===t.id?"#fff":"#000",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}
                        onClick={()=>changeType(t.id)}>{t.label}</button>
                    ))}
                  </div>
                </div>

                {/* Boxed/Unboxed toggle for exotics */}
                {canShowBoxed&&(
                  <div style={{display:"flex",gap:5,marginBottom:10}}>
                    <button className="sy" style={{flex:1,padding:"8px",borderRadius:10,border:`2px solid ${!boxed?"#1a3a1a":"#e5e7eb"}`,background:!boxed?"#1a3a1a":"#fff",color:!boxed?"#fff":"#000",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setBoxed(false);setSel({});}}>Unboxed</button>
                    <button className="sy" style={{flex:1,padding:"8px",borderRadius:10,border:`2px solid ${boxed?"#1a3a1a":"#e5e7eb"}`,background:boxed?"#1a3a1a":"#fff",color:boxed?"#fff":"#000",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setBoxed(true);setSel({});}}>Boxed</button>
                  </div>
                )}

                {/* Horse picker */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#000",textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>
                    {betType==="win"||betType==="place"||betType==="eachway"?"Select Horse":boxed?`Select ${numPositions}+ Horses`:"Select Positions"}
                  </div>

                  {/* Win/Place/EW horse picker */}
                  {(betType==="win"||betType==="place"||betType==="eachway")&&(
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {race.horses.filter(h=>!h.scratched).map(h=>{
                        const isSel=winSel===h.number||placeSel===h.number;
                        return(
                          <button key={h.number} className="sy" style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",borderRadius:11,border:`2px solid ${isSel?"#1a3a1a":"#e5e7eb"}`,background:isSel?"#f0fdf4":"#fafafa",cursor:"pointer",textAlign:"left",fontFamily:"inherit",transition:"all .1s"}}
                            onClick={()=>{
                              if(betType==="win"){setWinSel(h.number);setSel({0:[h.number]});}
                              else if(betType==="place"){setPlaceSel(h.number);setSel({0:[h.number]});}
                              else{setWinSel(h.number);setPlaceSel(h.number);setSel({0:[h.number]});}
                            }}>
                            {/* Silk */}
                            <div style={{width:34,height:34,borderRadius:8,background:"#fff",border:`1px solid ${isSel?"#1a3a1a":"#e5e7eb"}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,position:"relative"}}>
                              {h.silkUrl?<img src={h.silkUrl} alt="" referrerPolicy="no-referrer" style={{width:26,height:26,objectFit:"contain"}} onError={e=>{e.target.style.display="none";const fb=e.target.parentNode.querySelector(".silk-fb");if(fb)fb.style.display="flex";}}/>:null}
                              <div className="silk-fb" style={{width:28,height:28,borderRadius:"50%",background:isSel?"#1a3a1a":silkCol(h.number),display:h.silkUrl?"none":"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>{isSel?"✓":h.number}</div>
                              {isSel&&<div style={{position:"absolute",top:0,right:0,width:14,height:14,borderRadius:"50%",background:"#1a3a1a",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:9,color:"#fff",fontWeight:800}}>✓</span></div>}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:14,fontWeight:700,color:"#000",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</div>
                              <div style={{fontSize:11,color:"#555",marginTop:1}}>Win <strong style={{color:"#000"}}>${h.winOdds?.toFixed(2)}</strong> · Place <strong style={{color:"#000"}}>${h.placeOdds?.toFixed(2)}</strong></div>
                            </div>
                            {isSel&&<span style={{fontSize:14,fontWeight:800,color:"#1a3a1a",flexShrink:0}}>✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Exotic horse picker */}
                  {(betType==="quinella"||betType==="exacta"||betType==="trifecta"||betType==="firstfour")&&(
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {race.horses.filter(h=>!h.scratched).map(h=>{
                        if(boxed){
                          const inSel=(sel[0]||[]).includes(h.number);
                          return(
                            <button key={h.number} className="sy" style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:11,border:`2px solid ${inSel?"#1a3a1a":"#e5e7eb"}`,background:inSel?"#f0fdf4":"#fafafa",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}} onClick={()=>toggleHorse(0,h.number)}>
                              <div style={{width:34,height:34,borderRadius:8,background:"#fff",border:`1px solid ${inSel?"#1a3a1a":"#e5e7eb"}`,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0,position:"relative"}}>
                                {h.silkUrl?<img src={h.silkUrl} alt="" referrerPolicy="no-referrer" style={{width:26,height:26,objectFit:"contain"}} onError={e=>{e.target.style.display="none";const fb=e.target.parentNode.querySelector(".silk-fb");if(fb)fb.style.display="flex";}}/>:null}
                                <div className="silk-fb" style={{width:28,height:28,borderRadius:"50%",background:inSel?"#1a3a1a":silkCol(h.number),display:h.silkUrl?"none":"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff"}}>{inSel?"✓":h.number}</div>
                                {inSel&&<div style={{position:"absolute",top:0,right:0,width:14,height:14,borderRadius:"50%",background:"#1a3a1a",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:9,color:"#fff",fontWeight:800}}>✓</span></div>}
                              </div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:15,fontWeight:700,color:"#000"}}>{h.name}</div>
                                <div style={{fontSize:12,color:"#555"}}>Win <strong style={{color:"#000"}}>${h.winOdds?.toFixed(2)}</strong> · Place <strong style={{color:"#000"}}>${h.placeOdds?.toFixed(2)}</strong></div>
                              </div>
                            </button>
                          );
                        }
                        const myPos=def.positions.map((p,pi)=>(sel[pi]||[]).includes(h.number)?p.label:null).filter(Boolean);
                        return(
                          <div key={h.number} style={{borderRadius:12,border:`2px solid ${myPos.length?"#1a3a1a":"#e5e7eb"}`,background:myPos.length?"#f0fdf4":"#fafafa",overflow:"hidden",marginBottom:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:9,padding:"8px 12px"}}>
                              <div style={{width:34,height:34,borderRadius:8,background:"#fff",border:"1px solid #e5e7eb",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
                                {h.silkUrl?<img src={h.silkUrl} alt="" referrerPolicy="no-referrer" style={{width:26,height:26,objectFit:"contain"}} onError={e=>{e.target.style.display="none";const fb=e.target.parentNode.querySelector(".silk-fb");if(fb)fb.style.display="flex";}}/>:null}
                                <div className="silk-fb" style={{width:28,height:28,borderRadius:"50%",background:silkCol(h.number),display:h.silkUrl?"none":"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff"}}>{h.number}</div>
                              </div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:14,fontWeight:700,color:"#000"}}>{h.name}</div>
                                {myPos.length>0
                                  ?<div style={{fontSize:11,color:"#1a3a1a",fontWeight:700}}>✓ {myPos.join(" · ")}</div>
                                  :<div style={{fontSize:11,color:"#555"}}>Win <strong style={{color:"#000"}}>${h.winOdds?.toFixed(2)}</strong> · Place <strong style={{color:"#000"}}>${h.placeOdds?.toFixed(2)}</strong></div>
                                }
                              </div>
                            </div>
                            <div style={{display:"flex",gap:0,borderTop:"1px solid #e5e7eb"}}>
                              {def.positions.map((pos,pi)=>{
                                const inPos=(sel[pi]||[]).includes(h.number);
                                return(
                                  <button key={pi} className="sy" style={{flex:1,padding:"7px 4px",background:inPos?"#1a3a1a":"transparent",color:inPos?"#fff":"#000",border:"none",borderRight:pi<def.positions.length-1?"1px solid #e5e7eb":"none",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
                                    onClick={()=>toggleHorse(pi,h.number)}>{inPos?"✓ ":""}{pos.label}</button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Combinations + Flexi info — shown for ALL exotic bet types */}
                {combos>0&&(betType==="trifecta"||betType==="firstfour"||betType==="exacta"||betType==="quinella")&&(
                  <div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 12px",marginBottom:10,border:"1.5px solid #bbf7d0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                      <span style={{fontSize:13,fontWeight:700,color:"#000"}}>✓ {combos} combination{combos!==1?"s":""}</span>
                      <span style={{fontSize:13,fontWeight:800,color:flexiPct>=100?"#16a34a":"#92400e"}}>{flexiPct}% flexi</span>
                    </div>
                    <div style={{fontSize:11,color:"#555"}}>
                      {fmt(stake)} total · {combos} combo{combos!==1?"s":""} · {fmt(unitStake)} each
                    </div>
                    {flexiPct<100&&(
                      <div style={{marginTop:6,fontSize:12,fontWeight:600,color:"#92400e"}}>
                        ⚠ Under $1 unit — bet is valid but pays proportionally
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Fixed footer — stake + confirm, always visible, never needs scrolling to reach */}
              <div style={{flexShrink:0,padding:"8px 14px 4px",borderTop:"1px solid #f3f4f6",background:"#fff"}}>

                {/* Live "your bet" summary — always visible, updates as you pick */}
                {(()=>{
                  const isSingleType = betType==="win"||betType==="place"||betType==="eachway";
                  const selNum = isSingleType ? (winSel||placeSel) : null;
                  const selName = selNum ? race.horses.find(h=>h.number===selNum)?.name : null;
                  const poolNames = !isSingleType ? [...new Set(Object.values(effectiveSel||{}).flat())].map(n=>race.horses.find(h=>h.number===n)?.name).filter(Boolean) : [];
                  const posSummary = !isSingleType && boxed===false && def ? def.positions.map((pos,i)=>{
                    const names=(effectiveSel[i]||[]).map(n=>race.horses.find(h=>h.number===n)?.name).filter(Boolean);
                    return names.length?`${pos.label} ${names.join("/")}`:null;
                  }).filter(Boolean) : [];
                  const hasSel = selName || poolNames.length>0;
                  return(
                    <div style={{marginBottom:10,padding:"10px 12px",borderRadius:10,background:hasSel?"#eef4ea":"#f3f4f6",border:"1.5px solid #e5e7eb",borderLeft:`4px solid ${hasSel?"#1a3a1a":"#d1d5db"}`}}>
                      <div style={{fontSize:9,fontWeight:800,color:hasSel?"#1a3a1a":"#888",textTransform:"uppercase",letterSpacing:".06em",marginBottom:3,display:"flex",alignItems:"center",gap:4}}>
                        <span>{hasSel?"🎯":"👇"}</span> Your Bet
                      </div>
                      {!hasSel ? (
                        <div style={{fontSize:13,color:"#999",fontWeight:600}}>{def?.label} — select {isSingleType?"a horse":"your runners"} above</div>
                      ) : isSingleType ? (
                        <div style={{fontSize:14,fontWeight:800,color:"#000"}}>{def?.label} — {selName}</div>
                      ) : boxed ? (
                        <div style={{fontSize:14,fontWeight:800,color:"#000"}}>{def?.label} <span style={{fontWeight:600,color:"#666"}}>(Boxed{combos>1?`, ${combos} combos`:""})</span> — {poolNames.join(", ")}</div>
                      ) : (
                        <div style={{fontSize:14,fontWeight:800,color:"#000"}}>{def?.label}{combos>1?<span style={{fontWeight:600,color:"#666"}}> ({combos} combos)</span>:null} — {posSummary.join(" · ")}</div>
                      )}
                    </div>
                  );
                })()}

                {/* Each Way breakdown */}
                {betType==="eachway"&&stake>0&&(
                  <div style={{background:"#fef3c7",borderRadius:10,padding:"8px 12px",marginBottom:8,border:"1.5px solid #fcd34d"}}>
                    <div style={{fontSize:12,color:"#555"}}>Win {fmt(stake)} + Place {fmt(stake)} = <strong style={{color:"#000"}}>{fmt(totalCost)} total</strong></div>
                  </div>
                )}

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#000"}}>Stake</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#1a3a1a"}}>{fmt(raceBalance)} available</span>
                </div>
                <div style={{display:"flex",gap:8,marginBottom:8}}>
                  <div ref={stakeInputRef} style={{position:"relative",flex:1}}>
                    <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:20,fontWeight:700,color:"#000"}}>$</span>
                    <input className="inp sy" type="number" min="0.5" step="0.5" placeholder="0.00" value={stakeStr} onChange={e=>setStakeStr(e.target.value)}
                      onWheel={e=>e.target.blur()}
                      style={{paddingLeft:32,fontSize:22,fontWeight:700,padding:"11px 14px 11px 32px",width:"100%",borderRadius:12,border:"2px solid #e5e7eb",boxSizing:"border-box"}}/>
                  </div>
                  {[5,10,15,raceBalance].filter((v,i,a)=>v>0&&a.indexOf(v)===i).slice(0,3).map(v=>(
                    <button key={v} className="sy" style={{flexShrink:0,width:48,borderRadius:10,border:`2px solid ${Number(stakeStr)===v?"#1a3a1a":"#e5e7eb"}`,background:Number(stakeStr)===v?"#1a3a1a":"#fff",color:Number(stakeStr)===v?"#fff":"#000",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setStakeStr(String(v))}>
                      ${v}
                    </button>
                  ))}
                </div>
                {totalCost>raceBalance&&stake>0&&<div style={{padding:"7px 12px",background:"#fee2e2",borderRadius:8,fontSize:12,fontWeight:700,color:"#dc2626",marginBottom:8}}>⚠ Over budget — max {fmt(raceBalance)}</div>}

                <button className="sy" disabled={!isReady()} onClick={()=>{handleAdd();closeBetPanel();}}
                  style={{width:"100%",padding:"15px",borderRadius:14,background:isReady()?"#1a3a1a":"#f3f4f6",color:isReady()?"#fff":"#9ca3af",fontSize:15,fontWeight:800,border:"none",cursor:isReady()?"pointer":"not-allowed",fontFamily:"inherit",boxShadow:isReady()?"0 4px 16px rgba(26,58,26,.35)":"none",marginBottom:8}}>
                  {!isReady()
                    ?(stake<=0?"Enter a stake":combos===0?"Select a horse":"Over budget")
                    :`Confirm ${def?.label} — ${fmt(totalCost)}`}
                </button>
              </div>
            </div>
          </>
        )}
        {!isMobile&&(
          <div style={{position:"sticky",top:70,display:"flex",flexDirection:"column",gap:12}}>

            {/* Bet Type Card */}
            <div style={{background:"#f7f9f7",borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
              <div style={{background:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",padding:"12px 16px"}}>
                <p className="sy" style={{fontSize:11,fontWeight:600,letterSpacing:".1em",textTransform:"uppercase",color:"rgba(255,255,255,.6)",marginBottom:3}}>Bet Type</p>
                <p className="cg" style={{fontSize:15,fontWeight:800,color:"#fff",margin:0}}>{def?.label} <span style={{fontWeight:400,color:"rgba(255,255,255,.7)",fontSize:13}}>— {def?.desc}</span></p>
              </div>
              <div style={{padding:"12px"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {BET_TYPES.map(t=>(
                    <button key={t.id} onClick={()=>changeType(t.id)} className="sy" style={{
                      padding:"11px 8px",borderRadius:10,
                      border:`2px solid ${betType===t.id?"#1a3a1a":"#e5e7eb"}`,
                      background:betType===t.id?"#1a3a1a":"#fff",
                      color:betType===t.id?"#fff":"#000",
                      cursor:"pointer",textAlign:"center",transition:"all .15s",
                      fontWeight:700,fontSize:13,fontFamily:"inherit",
                    }}>{t.label}</button>
                  ))}
                </div>
                {canShowBoxed&&(
                  <div style={{marginTop:10}}>
                    <div style={{display:"flex",gap:6}}>
                      <button className="sy" style={{flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${!boxed?"#1a3a1a":C.border}`,background:!boxed?"#1a3a1a":"#fafafa",color:!boxed?"#fff":"#374151",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setBoxed(false);setSel({});}}>Unboxed</button>
                      <button className="sy" style={{flex:1,padding:"8px",borderRadius:8,border:`1.5px solid ${boxed?"#1a3a1a":C.border}`,background:boxed?"#1a3a1a":"#fafafa",color:boxed?"#fff":"#374151",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>{setBoxed(true);setSel({});}}>Boxed</button>
                    </div>
                    <p className="sy" style={{fontSize:12,color:"#000",marginTop:6,lineHeight:1.5}}>{boxed?`Select ${numPositions}+ horses - any order`:`Use position buttons on each horse`}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Selection + Stake Card */}
            <div style={{background:"#f7f9f7",borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>

              {/* Selection summary */}
              <div style={{padding:"14px 16px",borderBottom:`1px solid #f3f4f6`,minHeight:64}}>
                {(betType==="win"||betType==="place"||betType==="eachway")?(
                  !winSel&&!placeSel
                    ?<p className="sy" style={{fontSize:12,color:"#1a3a1a",fontWeight:600,fontStyle:"italic",paddingTop:4}}>← Tap WIN or PLACE on a horse</p>
                    :(()=>{
                      const n=winSel||placeSel;
                      const h=race.horses.find(x=>x.number===n);
                      return h?(
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <div style={{padding:"4px 12px",background:"#1a3a1a",borderRadius:20,flexShrink:0}}>
                            <span className="sy" style={{fontSize:12,fontWeight:700,color:"#fff"}}>✓ Selected</span>
                          </div>
                          <div style={{width:32,height:32,borderRadius:"50%",flexShrink:0,position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {h.silkUrl&&<img src={h.silkUrl} alt="" referrerPolicy="no-referrer" style={{width:32,height:32,objectFit:"contain",position:"absolute"}} onError={e=>{e.target.style.display="none";const fb=e.target.parentNode.querySelector(".silk-fb");if(fb)fb.style.display="flex";}}/>}
                            <div className="silk-fb" style={{width:28,height:28,borderRadius:"50%",background:silkCol(h.number),display:h.silkUrl?"none":"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff"}}>{h.number}</div>
                          </div>
                          <div style={{flex:1}}>
                            <div className="sy" style={{fontSize:14,fontWeight:700,color:"#000"}}>{h.name} <span style={{color:"#000",fontWeight:500,fontSize:12}}>({h.barrier||h.number})</span></div>
                            <div className="sy" style={{fontSize:12,color:"#000",marginTop:1}}>
                              Win <strong style={{color:"#1a3a1a"}}>${h.winOdds.toFixed(2)}</strong> · Place <strong style={{color:"#1d4ed8"}}>${h.placeOdds.toFixed(2)}</strong>
                            </div>
                          </div>
                          <button style={{background:"none",border:"none",fontSize:18,color:"#000",cursor:"pointer",padding:"4px"}} onClick={()=>{setWinSel(null);setPlaceSel(null);setSel({});}}>×</button>
                        </div>
                      ):null;
                    })()
                ):(
                  boxed?(
                    <div>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        {(sel[0]||[]).length===0
                          ?<span className="sy" style={{fontSize:12,color:"#1a3a1a",fontWeight:600,fontStyle:"italic"}}>← Select on each horse</span>
                          :(sel[0]||[]).map(n=>(<span key={n} style={{fontSize:12,padding:"4px 10px",background:"#1a3a1a",color:"#fff",borderRadius:20,fontWeight:700}}>#{n}</span>))}
                      </div>
                      {combos>0&&<p className="sy" style={{fontSize:12,color:C.green,marginTop:6,fontWeight:700}}>✓ {combos} combination{combos!==1?"s":""}</p>}
                    </div>
                  ):(
                    <div>
                      {def.positions.map((pos,pi)=>{
                        const posHorses=(sel[pi]||[]).map(n=>race.horses.find(h=>h.number===n)).filter(Boolean);
                        return(
                          <div key={pi} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                            <span className="sy" style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:".06em",color:"#1a3a1a",width:28,flexShrink:0}}>{pos.label}</span>
                            {posHorses.length===0
                              ?<span className="sy" style={{fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>—</span>
                              :posHorses.map(h=>(
                                <span key={h.number} style={{fontSize:12,padding:"3px 9px",background:"#1a3a1a",color:"#fff",borderRadius:20,fontWeight:700}}>#{h.number}</span>
                              ))}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>

              {/* Stake section */}
              <div style={{padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <p className="sy" style={{fontSize:12,fontWeight:800,textTransform:"uppercase",letterSpacing:".1em",color:"#000",margin:0}}>Stake</p>
                  <p className="sy" style={{fontSize:12,color:"#1a3a1a",fontWeight:700,margin:0}}>{fmt(raceBalance)} left</p>
                </div>

                {/* Big stake input */}
                <div style={{position:"relative",marginBottom:10}}>
                  <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:20,fontWeight:700,color:"#000"}}>$</span>
                  <input className="inp sy" type="number" step="0.50" min="0.10" placeholder="0.00" value={stakeStr} onChange={e=>setStakeStr(e.target.value)}
                    onWheel={e=>e.target.blur()}
                    style={{paddingLeft:32,fontSize:22,fontWeight:800,padding:"12px 12px 12px 32px",width:"100%",borderRadius:10,border:"2px solid #e5e7eb",color:"#111"}}/>
                </div>

                {/* Quick amounts */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:12}}>
                  {[2,5,10,raceBalance].filter((v,i,a)=>a.indexOf(v)===i&&v>0).slice(0,4).map(v=>(
                    <button key={v} className="sy" style={{padding:"10px 4px",borderRadius:10,border:`2px solid ${stakeStr===String(v)?"#1a3a1a":"#e5e7eb"}`,background:stakeStr===String(v)?"#1a3a1a":"#fff",color:stakeStr===String(v)?"#fff":"#000",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>setStakeStr(String(v))}>
                      ${v}
                    </button>
                  ))}
                </div>

                {/* Cost summary */}
                {stake>0&&combos>0&&(
                  <div style={{padding:"10px 14px",background:"#f8f9fa",borderRadius:10,marginBottom:12,border:"1px solid #e5e7eb"}}>
                    {combos>1&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span className="sy" style={{fontSize:13,color:"#000",fontWeight:600}}>Combinations</span>
                      <span className="sy" style={{fontSize:12,fontWeight:700}}>{combos}</span>
                    </div>}
                    {(betType==="trifecta"||betType==="firstfour"||betType==="exacta"||betType==="quinella")&&combos>1&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span className="sy" style={{fontSize:13,color:"#000",fontWeight:600}}>Unit stake</span>
                      <span className="sy" style={{fontSize:12,fontWeight:700}}>{fmt(unitStake)} per combo</span>
                    </div>}
                    {(betType==="trifecta"||betType==="firstfour"||betType==="exacta"||betType==="quinella")&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span className="sy" style={{fontSize:13,color:"#000",fontWeight:600}}>Flexi %</span>
                      <span className="sy" style={{fontSize:12,fontWeight:700,color:flexiPct>=100?C.green:C.accent}}>{flexiPct}% {flexiPct<100?"⚠ under $1 unit":""}</span>
                    </div>}
                    {betType==="eachway"&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                      <span className="sy" style={{fontSize:13,color:"#000",fontWeight:600}}>Win + Place</span>
                      <span className="sy" style={{fontSize:12,fontWeight:700}}>{fmt(stake)} + {fmt(stake)}</span>
                    </div>}
                    <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #e5e7eb",paddingTop:6,marginTop:4}}>
                      <span className="sy" style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:"#374151"}}>Total outlay</span>
                      <span className="cg" style={{fontSize:20,fontWeight:900,color:totalCost>raceBalance?"#dc2626":"#111"}}>{fmt(totalCost)}</span>
                    </div>
                    {totalCost>raceBalance&&<p className="sy" style={{fontSize:12,color:"#dc2626",marginTop:4,fontWeight:600}}>⚠ Only {fmt(raceBalance)} remaining</p>}
                  </div>
                )}

                {/* Submit */}
                <button className="sy" disabled={!isReady()} onClick={handleAdd}
                  style={{width:"100%",padding:"15px",borderRadius:12,background:isReady()?"linear-gradient(135deg,#1a3a1a,#2d5a2d)":"#f3f4f6",color:isReady()?"#fff":"#9ca3af",fontSize:15,fontWeight:900,border:"none",cursor:isReady()?"pointer":"not-allowed",fontFamily:"inherit",boxShadow:isReady()?"0 4px 16px rgba(26,58,26,.35)":"none",letterSpacing:".01em",transition:"all .15s"}}>
                  {!isReady()
                    ?(stake<=0?"Enter stake amount":combos===0?"Select a horse first":"Over budget")
                    :betType==="eachway"?`✓ Confirm Each Way — ${fmt(totalCost)}`
                    :combos>1?`✓ Confirm ${combos} Bets — ${fmt(totalCost)}`
                    :`✓ Confirm Bet — ${fmt(totalCost)}`}
                </button>
              </div>
            </div>

            {/* Existing bets on this race */}
            {myBets.length>0&&(
              <div className="card" style={{padding:"16px"}}>
                <p className="sy" style={{fontSize:12,fontWeight:800,color:"#000",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Your Bets on This Race</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {myBets.map(b=>{
                    const d=BET_TYPES.find(t=>t.id===BASE_TYPE(b.type));
                    const canCancel = b.won===null && race.status==="upcoming";
                    const {names:horseNames,isTrueBox,isOrdered,groups,positions}=describeBetHorses(b);
                    return(
                      <div key={b.id} style={{padding:"10px 12px",background:b.won===true?C.greenBg:b.won===false?C.redBg:"#f8fffe",border:`1.5px solid ${b.won===true?C.greenBd:b.won===false?C.redBd:C.greenBd}`,borderRadius:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                          <div>
                            <span className="sy" style={{fontSize:13,fontWeight:700,color:C.text}}>{d?.label}</span>
                            <span className="sy" style={{fontSize:13,color:"#000"}}> · {fmt(b.stake)}</span>
                          </div>
                          <span className="sy" style={{fontSize:13,fontWeight:700,color:b.won===true?C.green:b.won===false?C.red:C.accent}}>
                            {b.won===true?`Won ${fmt(b.payout)}`:b.won===false?`Lost`:b.payout?`Won ${fmt(b.payout)}`:"Pending"}
                          </span>
                        </div>
                        {isOrdered?(
                          <div className="sy" style={{fontSize:13,color:"#000",display:"flex",flexWrap:"wrap",alignItems:"center",gap:5}}>
                            {horseNames.map((name,i)=>(
                              <Fragment key={i}>
                                <span><strong>{positions[i]?.label||`${i+1}th`}</strong> {name}</span>
                                {i<horseNames.length-1&&<span style={{color:"#888"}}>→</span>}
                              </Fragment>
                            ))}
                          </div>
                        ):groups?(
                          <div>
                            <div className="sy" style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:2,textTransform:"uppercase",letterSpacing:".04em"}}>🎯 Multi — any of these combos</div>
                            <div className="sy" style={{fontSize:13,color:"#000",display:"flex",flexWrap:"wrap",alignItems:"center",gap:5}}>
                              {groups.map((g,i)=>(
                                <Fragment key={i}>
                                  <span><strong>{g.label}</strong> {g.names.join(" / ")}</span>
                                  {i<groups.length-1&&<span style={{color:"#888"}}>→</span>}
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        ):(
                          <div>
                            {isTrueBox&&<div className="sy" style={{fontSize:11,fontWeight:700,color:"#888",marginBottom:2,textTransform:"uppercase",letterSpacing:".04em"}}>🎲 Boxed — any order</div>}
                            <div className="sy" style={{fontSize:13,color:"#000"}}>{horseNames.join(" · ")}</div>
                          </div>
                        )}
                        {canCancel&&(
                          <button className="sy" style={{marginTop:8,fontSize:12,padding:"5px 10px",borderRadius:6,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:700}}
                            onClick={()=>{ if(window.confirm("Cancel this bet?")) onCancelBet(b.id); }}>
                            Edit / Cancel Bet
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- LEADERBOARD --------------------------------------------------------------
function LeaderboardScreen({accounts,bets,races,getMovement,myAccount}) {
  const w=useWindowWidth();
  const isMobile=w<700;
  const [h2h,setH2h]=useState(null);
  const [copied,setCopied]=useState(false);
  const [search,setSearch]=useState("");
  const [expanded,setExpanded]=useState(null);
  const medals=["🥇","🥈","🥉"];

  // eslint-disable-next-line no-unused-vars
  const copyStandings=()=>{
    const lines=accounts.map((a,i)=>{
      const profit=parseFloat(a.totalWon.toFixed(2));
      return `${medals[i]||`#${i+1}`} ${a.name} ${profit>0?"+":""}$${Math.abs(profit).toFixed(2)}`;
    });
    navigator.clipboard.writeText(`🏆 Spring Carnival Standings\n\n${lines.join("\n")}`).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  };

  const filtered=accounts.filter(a=>!search||a.name.toLowerCase().includes(search.toLowerCase()));
  const finishedRaces=races.filter(r=>r.status==="finished"||r.status==="archived");
  const settled=bets.filter(b=>b.won!==null);

  // ── Season Awards calcs ──────────────────────────────────────────────
  const biggestWin=settled.filter(b=>b.won===true).sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
  const biggestWinAcc=biggestWin?accounts.find(a=>a.id===biggestWin.playerId):null;
  const biggestWinRace=biggestWin?races.find(r=>r.id===biggestWin.raceId):null;
  const biggestWinHorse=biggestWin?biggestWinRace?.horses?.find(h=>h.number===biggestWin.horses?.[0]):null;
  const roughies=settled.filter(b=>b.won===true&&b.potential&&b.stake&&b.potential/b.stake>=10).sort((a,b)=>(b.potential/b.stake)-(a.potential/a.stake));
  const biggestRoughie=roughies[0];
  const roughieAcc=biggestRoughie?accounts.find(a=>a.id===biggestRoughie.playerId):null;
  const roughieRace=biggestRoughie?races.find(r=>r.id===biggestRoughie.raceId):null;
  const roughieHorse=biggestRoughie?roughieRace?.horses?.find(h=>h.number===biggestRoughie.horses?.[0]):null;
  const bigTri=settled.filter(b=>b.won===true&&BASE_TYPE(b.type)==="trifecta").sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
  const bigTriAcc=bigTri?accounts.find(a=>a.id===bigTri.playerId):null;
  const bigTriRace=bigTri?races.find(r=>r.id===bigTri.raceId):null;
  const bigFF=settled.filter(b=>b.won===true&&BASE_TYPE(b.type)==="firstfour").sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
  const bigFFAcc=bigFF?accounts.find(a=>a.id===bigFF.playerId):null;
  const hotStreak=accounts.map(a=>{
    const ar=[...finishedRaces].reverse().map(r=>{const rb=bets.filter(b=>b.raceId===r.id&&b.playerId===a.id&&b.won!==null);if(!rb.length)return null;const p=rb.reduce((s,b)=>s+(b.won?(b.payout||0):0),0);return p;}).filter(x=>x!==null);
    let streak=0;for(const p of ar){if(p>0)streak++;else break;}
    return{name:a.name,streak};
  }).sort((a,b)=>b.streak-a.streak)[0];
  const coldStreak=accounts.map(a=>{
    const ar=[...finishedRaces].reverse().map(r=>{const rb=bets.filter(b=>b.raceId===r.id&&b.playerId===a.id&&b.won!==null);if(!rb.length)return null;const p=rb.reduce((s,b)=>s+(b.won?(b.payout||0):0),0);return p;}).filter(x=>x!==null);
    let streak=0;for(const p of ar){if(p<=0)streak++;else break;}
    return{name:a.name,streak};
  }).sort((a,b)=>b.streak-a.streak)[0];

  const awards=[
    {emoji:"🎯",label:"Biggest Win",name:biggestWinAcc?.name||"—",detail:biggestWinAcc?`+${fmt(biggestWin?.payout||0)}${biggestWinHorse?` · ${biggestWinHorse.name}`:""}${biggestWinRace?` · ${biggestWinRace.name}`:""}`:"-",active:!!biggestWinAcc},
    {emoji:"🐎",label:"Biggest Roughie",name:roughieAcc?.name||"—",detail:roughieAcc?`+${fmt(biggestRoughie.payout||0)} · $${(biggestRoughie.potential/biggestRoughie.stake).toFixed(1)} odds${roughieHorse?` · ${roughieHorse.name}`:""}`:"-",active:!!roughieAcc},
    {emoji:"💸",label:"Biggest Trifecta",name:bigTriAcc?.name||"—",detail:bigTriAcc?`+${fmt(bigTri.payout||0)}${bigTriRace?` · ${bigTriRace.name}`:""}`:"-",active:!!bigTriAcc},
    {emoji:"🤑",label:"Biggest First Four",name:bigFFAcc?.name||"TBD",detail:bigFFAcc?`+${fmt(bigFF.payout||0)}`:"-",active:!!bigFFAcc},
    {emoji:"🔥",label:"Hot Streak",name:hotStreak?.streak>0?hotStreak.name:"TBD",detail:hotStreak?.streak>0?`${hotStreak.streak} races in a row`:"No streak yet",active:hotStreak?.streak>0},
    {emoji:"❄️",label:"Cold Streak",name:coldStreak?.streak>0?coldStreak.name:"TBD",detail:coldStreak?.streak>0?`${coldStreak.streak} races without a profit`:"No streak yet",active:coldStreak?.streak>0},
  ];

  return (
    <div className="fu">

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div style={{background:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",borderRadius:16,padding:isMobile?"16px":"20px 24px",marginBottom:14,position:"relative",overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,.2)"}}>
        <div style={{position:"absolute",top:0,right:0,bottom:0,width:6,background:"repeating-linear-gradient(180deg,#fff 0,#fff 8px,#1a3a1a 8px,#1a3a1a 16px)",opacity:.12}}/>
        <div>
          <h2 className="cg" style={{fontSize:isMobile?20:26,fontWeight:900,color:"#fff",marginBottom:2}}>🏆 Leaderboard</h2>
          <p className="sy" style={{fontSize:12,color:"rgba(255,255,255,.7)",margin:0}}>Ranked by total winnings · {accounts.length} players</p>
        </div>
      </div>

      {/* ── SEASON AWARDS ──────────────────────────────────────────── */}
      {!search&&finishedRaces.length>0&&settled.length>0&&(
        <div style={{marginBottom:16}}>
          <h3 className="cg" style={{fontSize:isMobile?16:18,fontWeight:800,marginBottom:10,color:"#111"}}>🎖️ Season Awards</h3>
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:8}}>
            {awards.map(a=>(
              <div key={a.label} style={{background:"#fff",borderRadius:12,padding:"14px 12px",border:`1px solid ${C.border}`,boxShadow:"0 1px 4px rgba(0,0,0,.04)",opacity:a.active?1:0.55}}>
                <div style={{fontSize:24,marginBottom:6}}>{a.emoji}</div>
                <div className="sy" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".06em",color:"#000",marginBottom:4,fontWeight:700}}>{a.label}</div>
                <div className="sy" style={{fontSize:isMobile?13:14,fontWeight:800,color:"#111",marginBottom:3}}>{a.name}</div>
                <div className="sy" style={{fontSize:isMobile?11:12,color:"#444",lineHeight:1.4}}>{a.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* ── SEARCH ─────────────────────────────────────────────────── */}
      {accounts.length>10&&(
        <div style={{position:"relative",marginBottom:12}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"#9ca3af",pointerEvents:"none"}}>🔍</span>
          <input className="inp sy" placeholder={`Search ${accounts.length} players...`} value={search} onChange={e=>setSearch(e.target.value)}
            style={{paddingLeft:38,fontSize:14}}/>
          {search&&<button style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",fontSize:18,color:"#9ca3af",cursor:"pointer"}} onClick={()=>setSearch("")}>×</button>}
        </div>
      )}

      {/* ── MAIN TABLE — compact for 70-80 players ─────────────────── */}
      {filtered.length===0
        ?<div className="card" style={{textAlign:"center",padding:32,color:"#555"}}>No players match "{search}"</div>
        :(()=>{
          const maxProfit=Math.max(...accounts.map(a=>parseFloat(a.totalWon.toFixed(2))),0.01);
          return(
          <div style={{background:"#fff",borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 2px 8px rgba(0,0,0,.05)",marginBottom:16}}>
            {/* Table header */}
            <div style={{display:"grid",gridTemplateColumns:"50px 1fr auto",background:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",padding:"10px 14px"}}>
              <span className="sy" style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.7)",textTransform:"uppercase",letterSpacing:".08em"}}>#</span>
              <span className="sy" style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.7)",textTransform:"uppercase",letterSpacing:".08em"}}>Player</span>
              <span className="sy" style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,.7)",textTransform:"uppercase",letterSpacing:".08em",textAlign:"right"}}>Winnings</span>
            </div>

            {filtered.map((a,fi)=>{
              const i=accounts.indexOf(a);
              const profit=parseFloat(a.totalWon.toFixed(2));
              const barW=profit>0?Math.max(3,Math.round((profit/maxProfit)*100)):0;
              const pb=bets.filter(b=>b.playerId===a.id);
              const won=pb.filter(b=>b.won===true).length;
              const lost=pb.filter(b=>b.won===false).length;
              const pend=pb.filter(b=>b.won===null).length;
              const movement=getMovement?getMovement(a.id,i+1):null;
              const isMe=a.id===myAccount?.id;
              const isExp=expanded===a.id;
              const rowBg=isMe?"rgba(26,58,26,.06)":fi%2===0?"#fff":"#fafbfa";
              const mc2=["#ffd700","#c0c0c0","#cd7f32"];
              const leftBorderCol=i<3?mc2[i]:isMe?C.accent:C.border;
              const barCol=i===0?"#ffd700":i===1?"#a0a0a0":i===2?"#cd7f32":isMe?"#1a3a1a":C.green;

              // Form dots for expanded view
              const settledRaces=finishedRaces.map(r=>{
                const rb=pb.filter(b=>b.raceId===r.id&&b.won!==null);
                if(!rb.length)return null;
                const p=rb.reduce((s,b)=>s+(b.won?(b.payout||0):0),0);
                return{name:r.name,profit:p};
              }).filter(Boolean).slice(-8);
              const bestWin=pb.filter(b=>b.won===true).sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
              const bestWinRace=bestWin?races.find(r=>r.id===bestWin.raceId):null;
              const bestWinHorse=bestWin?bestWinRace?.horses?.find(h=>h.number===bestWin.horses?.[0]):null;

              return(
                <div key={a.id}>
                  {/* Main row */}
                  <div
                    onClick={()=>setExpanded(isExp?null:a.id)}
                    style={{display:"grid",gridTemplateColumns:isMobile?"40px 1fr auto":"50px 1fr auto",padding:isMobile?"9px 12px 7px":"10px 14px 8px",background:rowBg,borderBottom:`1px solid ${C.border}`,borderLeft:`3px solid ${leftBorderCol}`,cursor:"pointer",transition:"background .1s"}}
                    onMouseEnter={e=>e.currentTarget.style.background=isMe?"rgba(26,58,26,.1)":"#f0f7f0"}
                    onMouseLeave={e=>e.currentTarget.style.background=rowBg}>

                    {/* Rank */}
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,paddingTop:2}}>
                      {i<3
                        ?<span style={{fontSize:20}}>{medals[i]}</span>
                        :<span className="sy" style={{fontSize:13,fontWeight:700,color:C.text}}>#{i+1}</span>}
                      {movement!==null&&movement!==0&&(
                        <span style={{fontSize:9,padding:"1px 4px",borderRadius:10,background:movement>0?"#f0fdf4":"#fef2f2",color:movement>0?C.green:C.red,fontWeight:700,border:`1px solid ${movement>0?C.greenBd:C.redBd}`}}>
                          {movement>0?"↑":"↓"}{Math.abs(movement)}
                        </span>
                      )}
                    </div>

                    {/* Name + speed bar + W/L */}
                    <div style={{minWidth:0}}>
                      {/* Name row */}
                      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2,flexWrap:"nowrap",overflow:"hidden"}}>
                        <span className="sy" style={{fontSize:isMobile?13:14,fontWeight:isMe?800:600,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{a.name}</span>
                        {isMe&&<span style={{fontSize:9,padding:"1px 6px",background:C.accent,color:"#fff",borderRadius:20,fontWeight:700,flexShrink:0}}>YOU</span>}
                      </div>
                      {/* Personality badge — own line on mobile */}
                      {(()=>{
                        const ab=bets.filter(b=>b.playerId===a.id&&b.won!==null);
                        if(ab.length<3) return null;
                        const abWon=ab.filter(b=>b.won===true);
                        const ep=Math.round((ab.filter(b=>['trifecta','firstfour','exacta','quinella'].includes(BASE_TYPE(b.type))).length/ab.length)*100);
                        const bbp=Math.round((ab.filter(b=>b.stake>=15).length/ab.length)*100);
                        const ls=ab.filter(b=>b.potential&&b.stake>0&&b.potential/b.stake>=10).length;
                        const hr=Math.round((abWon.length/ab.length)*100);
                        const as=parseFloat((ab.reduce((s,b)=>s+b.stake,0)/ab.length).toFixed(1));
                        const ew=Math.round((ab.filter(b=>b.type==='eachway').length/ab.length)*100);
                        const be=ab.filter(b=>b.type==='trifecta'||b.type==='firstfour').length;
                        // Compute streaks locally for this player
                        const abRaces=[...new Set(ab.map(b=>b.raceId))];
                        let abWinStreak=0,abLossStreak=0,wCur=0,lCur=0;
                        abRaces.forEach(rid=>{const rb=ab.filter(b=>b.raceId===rid);const p=rb.reduce((s,b)=>s+(b.won?(b.payout||0):0),0);if(p>0){wCur++;abWinStreak=Math.max(abWinStreak,wCur);lCur=0;}else{lCur++;abLossStreak=Math.max(abLossStreak,lCur);wCur=0;}});
                        const sc={
                          exotic:(ep>=55?ep:0)+(be>=2?be*15:0),
                          roughie:ls>=3?ls*20:0,
                          eachway:ew>=40?ew:0,
                          hothand:abWinStreak>=3?abWinStreak*20:0,
                          analyst:hr>=60?hr:0,
                          machine:(hr>=45&&abLossStreak<=1&&as>=8&&as<=16)?hr+30:0,
                          highroller:bbp>=55?bbp:0,
                          tactician:as<=5?80:0,
                          cold:abLossStreak>=3&&abWinStreak<2?abLossStreak*20:0,
                        };
                        const types=[
                          {key:'exotic',icon:'🎰',label:'Exotic Punter',col:'#be185d',bg:'#fdf2f8'},
                          {key:'roughie',icon:'🐎',label:'Roughie Hunter',col:'#7c3aed',bg:'#f5f3ff'},
                          {key:'eachway',icon:'🤝',label:'The Safety Net',col:'#0891b2',bg:'#ecfeff'},
                          {key:'hothand',icon:'🔥',label:'The Hot Hand',col:'#ea580c',bg:'#fff7ed'},
                          {key:'analyst',icon:'🔬',label:'The Analyst',col:'#16a34a',bg:'#f0fdf4'},
                          {key:'machine',icon:'🤖',label:'The Machine',col:'#475569',bg:'#f1f5f9'},
                          {key:'highroller',icon:'💎',label:'High Roller',col:'#d97706',bg:'#fffbeb'},
                          {key:'tactician',icon:'♟️',label:'The Tactician',col:'#6d28d9',bg:'#f5f3ff'},
                          {key:'cold',icon:'📉',label:'The Drifter',col:'#1e40af',bg:'#eff6ff'},
                        ];
                        const t=types.reduce((a,b)=>(sc[b.key]||0)>(sc[a.key]||0)?b:a,types[0]);
                        if(!t) return null;
                        return(
                          <div style={{marginBottom:3}}>
                            <span style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:isMobile?9:10,fontWeight:700,color:t.col,background:t.bg,border:`1px solid ${t.col}44`,borderRadius:20,padding:isMobile?'1px 7px':'2px 8px',whiteSpace:'nowrap',boxShadow:`0 1px 4px ${t.col}22`}}>
                              <span style={{fontSize:isMobile?10:11}}>{t.icon}</span>
                              <span>{t.label}</span>
                            </span>
                          </div>
                        );
                      })()}
                      {/* Racing speed bar */}
                      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                        <span style={{fontSize:10,flexShrink:0}}>🐎</span>
                        <div style={{flex:1,height:5,background:"#f0f0f0",borderRadius:3,overflow:"hidden",position:"relative"}}>
                          <div style={{
                            position:"absolute",top:0,left:0,height:"100%",
                            width:`${barW}%`,
                            background:i<3?`linear-gradient(to right,${barCol}88,${barCol})`:isMe?`linear-gradient(to right,#1a3a1a88,#1a3a1a)`:`linear-gradient(to right,${C.green}66,${C.green})`,
                            borderRadius:3,
                            transformOrigin:"left center",
                            animation:`barFill 1s cubic-bezier(0.16,1,0.3,1) both`,
                            animationDelay:`${Math.min(fi*25,500)}ms`,
                          }}/>
                        </div>
                        <span style={{fontSize:10,flexShrink:0}}>🏁</span>
                      </div>
                      <div className="sy" style={{fontSize:11,color:"#000"}}>
                        <span style={{color:C.green,fontWeight:700}}>{won}W</span>
                        <span style={{margin:"0 3px",color:C.border}}> · </span>
                        <span style={{color:C.red,fontWeight:700}}>{lost}L</span>
                        {pend>0&&<><span style={{margin:"0 3px",color:C.border}}> · </span><span>{pend} pending</span></>}
                      </div>
                    </div>

                    {/* Winnings */}
                    <div style={{textAlign:"right",display:"flex",flexDirection:"column",justifyContent:"center"}}>
                      <span className="cg" style={{fontSize:isMobile?15:17,fontWeight:900,color:profit>0?C.green:profit===0?"#9ca3af":C.red}}><AnimatedMoney value={profit} delay={fi*25}/></span>
                      {!isMobile&&<span className="sy" style={{fontSize:10,color:"#000",marginTop:1}}>from {won} win{won!==1?"s":""}</span>}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExp&&(
                    <div style={{padding:"14px 16px 16px",background:"#f8fffe",borderBottom:`1px solid ${C.border}`,borderLeft:`3px solid ${leftBorderCol}`}}>
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:14,marginBottom:12}}>
                        {/* Form dots */}
                        <div>
                          <div className="sy" style={{fontSize:11,fontWeight:700,color:"#000",marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>
                            Last {settledRaces.length} Race{settledRaces.length!==1?"s":""}
                          </div>
                          {settledRaces.length===0
                            ?<span className="sy" style={{fontSize:12,color:"#000",fontStyle:"italic"}}>No settled races yet</span>
                            :<div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                              {settledRaces.map((r,fi)=>(
                                <div key={fi} title={`${r.name}: ${r.profit>0?"+":""}${fmt(r.profit)}`}
                                  style={{width:28,height:28,borderRadius:"50%",background:r.profit>0?C.green:"#f87171",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff"}}>
                                  {r.profit>0?"W":"L"}
                                </div>
                              ))}
                            </div>}
                        </div>
                        {/* Best win */}
                        <div>
                          <div className="sy" style={{fontSize:11,fontWeight:700,color:"#000",marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>🌟 Best Win</div>
                          {bestWin?(
                            <>
                              <div className="cg" style={{fontSize:20,fontWeight:900,color:C.green}}>+{fmt(bestWin.payout||0)}</div>
                              {bestWinHorse&&<div className="sy" style={{fontSize:13,fontWeight:700,color:"#111",marginTop:2}}>{bestWinHorse.name}</div>}
                              <div className="sy" style={{fontSize:12,color:"#000"}}>{BET_TYPES.find(t=>t.id===BASE_TYPE(bestWin.type))?.label} · {bestWinRace?.name}</div>
                            </>
                          ):<span className="sy" style={{fontSize:12,color:"#000",fontStyle:"italic"}}>No wins yet</span>}
                        </div>
                      </div>
                      {/* Stats grid */}
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:6,marginBottom:10}}>
                        {[["Bets",pb.length],["Won",won],["Staked",fmt(a.totalStaked)],["Returned",fmt(a.totalWon)]].map(([l,v])=>(
                          <div key={l} style={{background:"#fff",borderRadius:8,padding:"8px 6px",textAlign:"center",border:`1px solid ${C.border}`}}>
                            <div className="sy" style={{fontSize:10,color:"#555",fontWeight:600,marginBottom:2}}>{l}</div>
                            <div className="sy" style={{fontSize:13,fontWeight:700,color:"#111"}}>{v}</div>
                          </div>
                        ))}
                      </div>
                      {myAccount&&a.id!==myAccount.id&&(
                        <button className="sy" style={{fontSize:12,padding:"6px 14px",borderRadius:8,border:`1px solid ${C.border}`,background:"#fff",color:C.accent,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}
                          onClick={e=>{e.stopPropagation();setH2h({a:myAccount,b:a});}}>⚔️ Compare with me</button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          );
        })()}

      {/* ── H2H MODAL ──────────────────────────────────────────────── */}
      {h2h&&(()=>{
        const profitA=parseFloat(h2h.a.totalWon.toFixed(2));
        const profitB=parseFloat(h2h.b.totalWon.toFixed(2));
        const pa=bets.filter(b=>b.playerId===h2h.a.id&&b.won!==null);
        const pb2=bets.filter(b=>b.playerId===h2h.b.id&&b.won!==null);
        return(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>setH2h(null)}>
            <div className="card" style={{maxWidth:480,width:"100%",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h3 className="cg" style={{fontSize:20,fontWeight:800}}>⚔️ Head to Head</h3>
                <button style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.muted}} onClick={()=>setH2h(null)}>✕</button>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center",marginBottom:16,padding:"14px 12px",background:"#f8fffe",borderRadius:12,border:`1px solid ${C.border}`}}>
                {[h2h.a,h2h.b].map((p,pi)=>{
                  const prof=pi===0?profitA:profitB;
                  return(
                    <div key={pi} style={{textAlign:pi===0?"left":"right"}}>
                      <div className="sy" style={{fontSize:14,fontWeight:800,color:"#111"}}>{p.name}</div>
                      <div className="cg" style={{fontSize:24,fontWeight:900,color:prof>0?C.green:prof===0?"#9ca3af":C.red}}>{prof>0?"+":""}{fmt(prof)}</div>
                    </div>
                  );
                })}
                <div style={{textAlign:"center",fontSize:24}}>⚔️</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:0}}>
                {[
                  ["Total Bets",pa.length,pb2.length],
                  ["Wins",pa.filter(b=>b.won).length,pb2.filter(b=>b.won).length],
                  ["Hit Rate",`${pa.length?Math.round(pa.filter(b=>b.won).length/pa.length*100):0}%`,`${pb2.length?Math.round(pb2.filter(b=>b.won).length/pb2.length*100):0}%`],
                  ["Staked",fmt(h2h.a.totalStaked),fmt(h2h.b.totalStaked)],
                  ["Returned",fmt(h2h.a.totalWon),fmt(h2h.b.totalWon)],
                ].map(([l,va,vb])=>(
                  <div key={l} style={{display:"grid",gridTemplateColumns:"1fr 80px 1fr",gap:8,padding:"10px 0",borderBottom:`1px solid ${C.border}`,alignItems:"center"}}>
                    <span className="sy" style={{fontSize:14,fontWeight:700,color:"#111"}}>{va}</span>
                    <span className="sy" style={{fontSize:11,color:"#000",textAlign:"center",fontWeight:600}}>{l}</span>
                    <span className="sy" style={{fontSize:14,fontWeight:600,color:"#111",textAlign:"right"}}>{vb}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}



// --- SEASON SUMMARY -----------------------------------------------------------
function SeasonScreen({accounts, bets, races}) {
  const w = useWindowWidth();
  const isMobile = w < 700;

  const finishedRaces = races.filter(r => r.status === "finished" || r.status === "archived");

  // Build per-player season stats
  const playerStats = accounts.map(a => {
    const pb = bets.filter(b => b.playerId === a.id);
    const settled = pb.filter(b => b.won !== null);
    const won = settled.filter(b => b.won === true);
    const lost = settled.filter(b => b.won === false);
    const totalWon = won.reduce((s,b) => s + (b.payout||0), 0);
    const totalStaked = pb.reduce((s,b) => s + b.stake, 0);
    const profit = parseFloat((totalWon).toFixed(2));
    const winRate = settled.length ? Math.round((won.length / settled.length) * 100) : 0;

    // Best win
    const bestWin = won.length ? won.reduce((best,b) => (!best||b.payout>best.payout)?b:best, null) : null;
    const bestWinRace = bestWin ? races.find(r=>r.id===bestWin.raceId) : null;

    // Races bet on
    const racesBetOn = [...new Set(pb.map(b=>b.raceId))].length;

    return { ...a, pb, settled, won, lost, totalWon: parseFloat(totalWon.toFixed(2)), totalStaked: parseFloat(totalStaked.toFixed(2)), profit, winRate, bestWin, bestWinRace, racesBetOn };
  }).sort((a,b) => b.profit - a.profit);

  const medals = ["🥇","🥈","🥉"];
  const medalColors = ["#d4a017","#9ca3af","#b87333"];

  // Season totals
  const totalPaidOut = bets.filter(b=>b.won===true).reduce((s,b)=>s+(b.payout||0),0);
  const totalBets = bets.length;
  const biggestWin = bets.filter(b=>b.won===true).sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
  const biggestWinPlayer = biggestWin ? accounts.find(a=>a.id===biggestWin.playerId) : null;
  const biggestWinRace = biggestWin ? races.find(r=>r.id===biggestWin.raceId) : null;

  return (
    <div className="fu">
      <h2 className="cg" style={{fontSize:28,fontWeight:800,marginBottom:4}}>📊 Season Summary</h2>
      <p className="sy soft" style={{fontSize:14,marginBottom:20}}>{finishedRaces.length} race{finishedRaces.length!==1?"s":""} completed · {accounts.length} players · {totalBets} bets placed</p>

      {/* Season highlights */}
      {finishedRaces.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(4,1fr)",gap:12,marginBottom:24}}>
          {[
            ["Races Run", finishedRaces.length, C.accent],
            ["Total Bets", totalBets, C.blue],
            ["Total Paid Out", fmt(totalPaidOut), C.green],
            ["Biggest Single Win", biggestWin ? `${fmt(biggestWin.payout||0)}` : "-", C.gold],
          ].map(([l,v,col])=>(
            <div key={l} className="card" style={{textAlign:"center",borderTop:`4px solid ${col}`}}>
              <div className="sy soft" style={{fontSize:12,marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>{l}</div>
              <div className="cg" style={{fontSize:22,fontWeight:800,color:col}}>{v}</div>
              {l==="Biggest Single Win"&&biggestWinPlayer&&<div className="sy soft" style={{fontSize:12,marginTop:4}}>{biggestWinPlayer.name} · {biggestWinRace?.name}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      {/* Best bet callout */}
      {bets.filter(b=>b.won===true).length>0&&(()=>{
        const bestBet = bets.filter(b=>b.won===true).sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
        const bestPlayer = bestBet ? accounts.find(a=>a.id===bestBet.playerId) : null;
        const bestRace = bestBet ? races.find(r=>r.id===bestBet.raceId) : null;
        const bestType = bestBet ? BET_TYPES.find(t=>t.id===BASE_TYPE(bestBet.type)) : null;
        if (!bestPlayer) return null;
        return (
          <div className="card" style={{marginBottom:24,background:"linear-gradient(135deg,#fffbeb,#fef9e7)",border:`2px solid ${C.gold}`,textAlign:"center",padding:"20px 24px"}}>
            <div style={{fontSize:32,marginBottom:6}}>🌟</div>
            <div className="sy" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".1em",color:C.gold,fontWeight:700,marginBottom:4}}>Best Bet of the Season</div>
            <div className="cg" style={{fontSize:22,fontWeight:800,marginBottom:4}}>{bestPlayer.name}</div>
            <div className="sy" style={{fontSize:14,color:"#000",marginBottom:6}}>{bestType?.label} on {bestRace?.name}</div>
            <div className="cg" style={{fontSize:32,fontWeight:900,color:C.green}}>+{fmt(bestBet.payout||0)}</div>
          </div>
        );
      })()}

      <h3 className="cg" style={{fontSize:22,fontWeight:700,marginBottom:14}}>Season Leaderboard</h3>
      {playerStats.length === 0 ? (
        <div className="card" style={{textAlign:"center",padding:40}}>
          <div style={{fontSize:48,marginBottom:12}}>🏆</div>
          <p className="cg" style={{fontSize:20,marginBottom:6}}>No players yet</p>
          <p className="sy soft" style={{fontSize:14}}>The leaderboard will appear once players join and bets are settled.</p>
        </div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:28}}>
          {playerStats.map((p,i) => (
            <div key={p.id} className="card" style={{borderLeft:`5px solid ${medalColors[i]||C.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                <div style={{fontSize:28,width:36,textAlign:"center",flexShrink:0}}>
                  {medals[i] || <span className="sy soft" style={{fontSize:16}}>#{i+1}</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="cg" style={{fontSize:20,fontWeight:700}}>{p.name}</div>
                  <div style={{display:"flex",gap:12,marginTop:4,flexWrap:"wrap"}}>
                    <span className="sy soft" style={{fontSize:12}}>{p.settled.length} bets settled</span>
                    <span className="sy" style={{fontSize:12,color:C.green}}>{p.won.length} won</span>
                    <span className="sy" style={{fontSize:12,color:C.red}}>{p.lost.length} lost</span>
                    <span className="sy soft" style={{fontSize:12}}>{p.winRate}% win rate</span>
                    <span className="sy soft" style={{fontSize:12}}>{p.racesBetOn} race{p.racesBetOn!==1?"s":""} entered</span>
                  </div>
                  {p.bestWin&&(
                    <div className="sy" style={{fontSize:12,color:C.gold,marginTop:4}}>
                      🌟 Best win: {fmt(p.bestWin.payout||0)} on {p.bestWinRace?.name||""}
                    </div>
                  )}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em"}}>Net Profit</div>
                  <div className="cg" style={{fontSize:26,fontWeight:800,color:p.profit>0?C.green:profit<0?C.red:"#9ca3af"}}>
                    {p.profit>0?"+":""}{fmt(p.profit)}
                  </div>
                  <div className="sy soft" style={{fontSize:12}}>Won {fmt(p.totalWon)} · Staked {fmt(p.totalStaked)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Race by race breakdown */}
      {finishedRaces.length > 0 && (
        <>
          <h3 className="cg" style={{fontSize:22,fontWeight:700,marginBottom:14}}>Race by Race Results</h3>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {finishedRaces.map(race => {
              const raceBets = bets.filter(b=>b.raceId===race.id&&b.won!==null);
              const raceWinners = raceBets.filter(b=>b.won===true);
              const totalPaid = raceWinners.reduce((s,b)=>s+(b.payout||0),0);
              const winner1 = race.horses.find(h=>h.number===race.result?.first);
              return (
                <div key={race.id} className="card">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
                    <div>
                      <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                        <span className="badge sy" style={{background:C.greenBg,color:C.green,border:`1px solid ${C.greenBd}`}}>Finished</span>
                        <span className="badge sy" style={{background:"#f4f5f4",color:C.soft,border:`1px solid ${C.border}`}}>{race.venue} · {race.distance}</span>
                      </div>
                      <div className="cg" style={{fontSize:18,fontWeight:700}}>{race.name}</div>
                      <div className="sy soft" style={{fontSize:12,marginTop:2}}>{new Date(race.date).toLocaleDateString("en-AU",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>
                      {winner1&&<div className="sy" style={{fontSize:13,marginTop:6,color:C.accent,fontWeight:600}}>🥇 Winner: {winner1.name}</div>}
                      {race.result?.dividends&&(
                        <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
                          {[
                            ["Win",race.result.dividends.win],
                            ["Place 1st",race.result.dividends.place1],
                            ["Place 2nd",race.result.dividends.place2],
                            ["Place 3rd",race.result.dividends.place3],
                            ["Place 4th",race.result.dividends.place4],
                            ["Quinella",race.result.dividends.quinella],
                            ["Exacta",race.result.dividends.exacta],
                            ["Trifecta",race.result.dividends.trifecta],
                            ["First Four",race.result.dividends.firstfour],
                          ].filter(([,v])=>v&&v>0).map(([l,v])=>(
                            <span key={l} className="sy" style={{fontSize:12,padding:"2px 8px",background:C.greenBg,borderRadius:20,color:C.green,border:`1px solid ${C.greenBd}`}}>{l}: ${parseFloat(v).toFixed(2)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div className="sy soft" style={{fontSize:12}}>{raceWinners.length} winner{raceWinners.length!==1?"s":""}</div>
                      <div className="cg" style={{fontSize:18,fontWeight:700,color:C.green}}>{fmt(totalPaid)} paid out</div>
                    </div>
                  </div>
                  {raceWinners.length>0&&(
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,display:"flex",flexWrap:"wrap",gap:6}}>
                      {raceWinners.map(b=>{
                        const pl=accounts.find(a=>a.id===b.playerId);
                        const td=BET_TYPES.find(t=>t.id===BASE_TYPE(b.type));
                        return(
                          <span key={b.id} className="sy" style={{fontSize:12,padding:"4px 10px",background:C.greenBg,border:`1px solid ${C.greenBd}`,borderRadius:20,color:C.green}}>
                            🎉 {pl?.name} - {td?.label} +{fmt(b.payout||0)}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// --- PROFILE ------------------------------------------------------------------
function ProfileScreen({account,bets,races,getRaceBalance,onChangePin,onCancelBet}) {
  const w = useWindowWidth();
  const isMobile = w < 700;
  const [tab,setTab]=useState("active");
  const [showPinChange,setShowPinChange]=useState(false);
  const [newPin,setNewPin]=useState("");
  const [newPin2,setNewPin2]=useState("");
  const [pinStep,setPinStep]=useState("new");
  const [pinErr,setPinErr]=useState("");
  const [pinOk,setPinOk]=useState(false);

  const handleNewPin=()=>{ if(newPin.length<4) return; setPinStep("confirm"); setNewPin2(""); setPinErr(""); };
  const handleConfirmNewPin=val=>{
    setNewPin2(val);
    if(val.length===4){
      if(val!==newPin){setPinErr("PINs don't match.");setNewPin("");setNewPin2("");setPinStep("new");return;}
      const e=onChangePin(account.id,newPin);
      if(e){setPinErr(e);setNewPin("");setNewPin2("");setPinStep("new");}
      else{setPinOk(true);setShowPinChange(false);setNewPin("");setNewPin2("");setPinStep("new");setPinErr("");}
    }
  };

  if(!account) return null;
  const active=bets.filter(b=>b.won===null), settled=bets.filter(b=>b.won!==null);
  const winRate=settled.length?((settled.filter(b=>b.won).length/settled.length)*100).toFixed(0):0;
  const profit=parseFloat((account.totalWon-account.totalStaked).toFixed(2));
  const roi=account.totalStaked>0?(((account.totalWon-account.totalStaked)/account.totalStaked)*100).toFixed(1):0;

  return(
    <div className="fu">
      {/* Profile header */}
      <div className="card" style={{marginBottom:16,borderLeft:`4px solid ${C.accent}`}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#3b82f6)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#111",flexShrink:0}}>
            {account.name[0].toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <h2 className="cg" style={{fontSize:isMobile?20:26,fontWeight:700,marginBottom:2}}>{account.name}</h2>
            {!isMobile&&<p className="sy soft" style={{fontSize:12}}>{account.email} · Joined {new Date(account.createdAt).toLocaleDateString("en-AU",{month:"short",year:"numeric"})}</p>}
            <button className="sy" style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:12,fontWeight:700,textDecoration:"underline",padding:0,marginTop:2}} onClick={()=>{setShowPinChange(true);setPinStep("new");setNewPin("");setNewPin2("");setPinErr("");setPinOk(false);}}>
              Change PIN
            </button>
            {pinOk&&<span className="sy" style={{fontSize:12,color:C.green,marginLeft:10}}>✓ PIN updated!</span>}
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em"}}>Net Profit</div>
            <div className="cg" style={{fontSize:isMobile?22:28,fontWeight:700,color:profit>0?C.green:profit<0?C.red:"#9ca3af"}}>{profit>0?"+":""}{fmt(profit)}</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${isMobile?2:4},1fr)`,gap:10,marginBottom:16}}>
        {[["Bets Placed",bets.length],["Win Rate",`${winRate}%`],["Total Won",fmt(account.totalWon)],["ROI",`${roi}%`]].map(([l,v])=>(
          <div key={l} className="card" style={{textAlign:"center",padding:"14px 10px"}}>
            <div className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{l}</div>
            <div className="cg" style={{fontSize:isMobile?18:22,fontWeight:700}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Change PIN modal */}
      {showPinChange&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowPinChange(false)}>
          <div className="modal sr">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h3 className="cg" style={{fontSize:22,fontWeight:700}}>Change PIN</h3>
              <button className="btn btn-ghost sy" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>setShowPinChange(false)}>Close</button>
            </div>
            {pinStep==="new"&&(
              <>
                <p className="sy soft" style={{fontSize:13,marginBottom:16}}>Choose a new 4-digit PIN.</p>
                {pinErr&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10,textAlign:"center"}}>{pinErr}</p>}
                <PinPad value={newPin} onChange={v=>{setNewPin(v);setPinErr("");}}/>
                <button className="btn btn-gold" style={{width:"100%",marginTop:14,padding:12,fontSize:13}} disabled={newPin.length<4} onClick={handleNewPin}>Next →</button>
              </>
            )}
            {pinStep==="confirm"&&(
              <>
                <p className="sy soft" style={{fontSize:13,marginBottom:16}}>Confirm your new PIN.</p>
                {pinErr&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10,textAlign:"center"}}>{pinErr}</p>}
                <PinPad value={newPin2} onChange={handleConfirmNewPin}/>
                <button className="btn btn-ghost" style={{width:"100%",marginTop:10,padding:10,fontSize:12}} onClick={()=>{setPinStep("new");setNewPin("");setNewPin2("");setPinErr("");}}>← Back</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Per-race budgets */}
      <div style={{marginBottom:16}}>
        <h4 className="cg" style={{fontSize:isMobile?16:18,fontWeight:700,marginBottom:4}}>Race Budgets</h4>
        <p className="sy soft" style={{fontSize:12,marginBottom:10}}>Every Group 1 race has its own $24 - you must spend the full amount on each race.</p>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)",gap:8}}>
          {races.map(race=>{
            const bal=getRaceBalance(account.id,race.id);
            const used=STARTING_BALANCE-bal;
            const pct=Math.min((used/STARTING_BALANCE)*100,100);
            return(
              <div key={race.id} className="surface" style={{borderLeft:`3px solid ${race.status==="finished"?C.muted:bal>0?C.accent:C.green}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                  <div className="sy" style={{fontSize:12,fontWeight:800,color:"#000"}}>{race.name}</div>
                  <div className="sy" style={{fontSize:12,color:race.status==="finished"?"#9ca3af":bal===0?"#16a34a":"#1a3a1a",fontWeight:700}}>
                    {race.status==="finished"?"Finished":bal===0?"✓ Spent":fmt(bal)+" left"}
                  </div>
                </div>
                <div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden",marginBottom:4}}>
                  <div style={{height:"100%",width:`${pct}%`,background:race.status==="finished"?C.muted:bal===0?C.green:C.accent,borderRadius:3,transition:"width .3s"}}/>
                </div>
                {race.status==="upcoming"&&bal>0&&(
                  <div className="sy" style={{fontSize:12,color:"#dc2626",fontWeight:700}}>⚠ Must spend {fmt(bal)} more</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="tog" style={{marginBottom:14}}>
        <button className={`topt${tab==="active"?" on":""}`} onClick={()=>setTab("active")}>Active ({active.length})</button>
        <button className={`topt${tab==="settled"?" on":""}`} onClick={()=>setTab("settled")}>Settled ({settled.length})</button>
      </div>

      {(tab==="active"?active:settled).length===0?<p className="sy soft">{tab==="active"?"No active bets.":"No settled bets yet."}</p>:(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {(tab==="active"?active:settled).map(bet=>{
            const race=races.find(r=>r.id===bet.raceId), td=BET_TYPES.find(t=>t.id===BASE_TYPE(bet.type));
            const canCancel = bet.won===null && race?.status==="upcoming";
            const isTrueBox = IS_TRUE_BOX(bet.type);
            const isBoxedStyle = IS_BOXED_TYPE(bet.type);
            const isOrdered = td && td.positions.length>1 && !isBoxedStyle && BASE_TYPE(bet.type)!=="quinella";
            const shape = MULTI_SHAPE(bet.type);
            let groups = null;
            if (shape && td) {
              let idx=0;
              groups = td.positions.map((pos,i)=>{
                const count=shape[i]||0;
                const nums=bet.horses.slice(idx,idx+count);
                idx+=count;
                return {label:pos.label, nums};
              }).filter(g=>g.nums.length>0);
            }
            return(
              <div key={bet.id} className="surface" style={{borderLeft:`3px solid ${bet.won===true?C.green:bet.won===false?C.red:C.accent}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="cg" style={{fontSize:17,fontWeight:700}}>{race?.name}</div>
                    <div className="sy soft" style={{fontSize:12,marginTop:2}}>
                      {td?.label}
                      {isOrdered
                        ?bet.horses.map((n,i)=><span key={i}> · <strong>{td.positions[i]?.label||`${i+1}th`}</strong> #{n}</span>)
                        :groups
                        ?<> · 🎯 {groups.map((g,i)=><span key={i}>{i>0?" → ":""}<strong>{g.label}</strong> #{g.nums.join("/#")}</span>)}</>
                        :<> · {isTrueBox?"🎲 Boxed: ":""}#{bet.horses.join(", #")}</>
                      }
                      {" · "}{new Date(bet.placedAt).toLocaleDateString("en-AU",{day:"numeric",month:"short"})}
                    </div>
                    <div className="sy" style={{fontSize:12,marginTop:3,fontWeight:600,color:bet.won===true?C.green:bet.won===false?C.red:C.accent}}>
                      {bet.won===null&&bet.potential?`Potential: ${fmt(bet.potential)}`:bet.won===true?`Won ${fmt(bet.payout)}! `:bet.won===false?"Lost":"Pending"}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0,marginLeft:10}}>
                    <div className="cg" style={{fontSize:18,fontWeight:700}}>{fmt(bet.stake)}</div>
                    {canCancel&&(
                      <button className="sy" style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:600}}
                        onClick={()=>{ if(window.confirm("Cancel this bet? Your stake will be refunded to your race budget.")) onCancelBet(bet.id); }}>
                        Cancel Bet
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MyBetsScreen({account, bets, races, getRaceBalance, onChangePin, onCancelBet}) {
  const w = useWindowWidth();
  const isMobile = w < 700;
  const [showPinChange, setShowPinChange] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [pinStep, setPinStep] = useState("new");
  const [pinErr, setPinErr] = useState("");
  const [pinOk, setPinOk] = useState(false);
  const [hoveredRaceIdx, setHoveredRaceIdx] = useState(null);

  if (!account) return null;

  // Build race-level data - the fundamental unit
  const allRaces = [...new Set(bets.map(b=>b.raceId))].map(id=>races.find(r=>r.id===id)).filter(Boolean);
  const finishedRaces = allRaces.filter(r=>r.status==="finished"||r.status==="archived");
  const upcomingRaces = allRaces.filter(r=>r.status==="upcoming"||r.status==="closed");

  const raceStats = finishedRaces.map(race => {
    const rb = bets.filter(b=>b.raceId===race.id&&b.won!==null);
    const staked = rb.reduce((s,b)=>s+b.stake,0);
    const returned = rb.filter(b=>b.won===true).reduce((s,b)=>s+(b.payout||0),0);
    const raceProfit = parseFloat((returned).toFixed(2));
    const hadWin = rb.some(b=>b.won===true);
    const bestBet = rb.filter(b=>b.won===true).sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
    return { race, rb, staked, returned, profit:raceProfit, hadWin, bestBet };
  });

  const racesWon   = raceStats.filter(r=>r.profit>0).length;
  const racesLost  = raceStats.filter(r=>r.profit<=0).length;
  const totalSettledRaces = raceStats.length;
  const raceWinRate = totalSettledRaces ? Math.round((racesWon/totalSettledRaces)*100) : 0;
  const longestWinStreak=(()=>{let best=0,cur=0;[...raceStats].forEach(r=>{if(r.profit>0){cur++;best=Math.max(best,cur);}else cur=0;});return best;})();
  const longestLossStreak=(()=>{let best=0,cur=0;[...raceStats].forEach(r=>{if(r.profit<=0){cur++;best=Math.max(best,cur);}else cur=0;});return best;})();

  const profit = parseFloat((account.totalWon).toFixed(2));
  const settledStaked = raceStats.reduce((s,r)=>s+r.staked,0);
  const roi = settledStaked>0 ? parseFloat(((profit/settledStaked)*100).toFixed(1)) : 0;

  const pending = bets.filter(b=>b.won===null);

  // Best race

  // Best single win across all races
  const bestWin = bets.filter(b=>b.won===true).sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
  const bestWinRace = bestWin ? races.find(r=>r.id===bestWin.raceId) : null;

  // Current streak - by race
  const streak = (() => {
    const s=[...raceStats].reverse();
    if(!s.length) return null;
    const type = s[0].profit>0 ? "win" : "loss";
    let count=0;
    for(const r of s){ if((r.profit>0&&type==="win")||(r.profit<=0&&type==="loss")) count++; else break; }
    return { type, count };
  })();

  // Profit by bet type - based on race-level context
  const won = bets.filter(b=>b.won===true);
  const lost = bets.filter(b=>b.won===false);
  const settled = bets.filter(b=>b.won!==null);

  const handleNewPin = () => { if(newPin.length<4) return; setPinStep("confirm"); setNewPin2(""); setPinErr(""); };
  const handleConfirmPin = val => {
    setNewPin2(val);
    if(val.length===4){
      if(val===newPin){ onChangePin(newPin); setShowPinChange(false); setPinOk(true); setNewPin(""); setNewPin2(""); setPinStep("new"); setTimeout(()=>setPinOk(false),3000); }
      else { setPinErr("PINs don't match. Try again."); setPinStep("new"); setNewPin(""); setNewPin2(""); }
    }
  };

  return (
    <div className="fu">
      {/* Header */}
      <div style={{background:"linear-gradient(135deg,#1a3a1a 0%,#2d5a2d 100%)",borderRadius:14,padding:isMobile?"14px 16px":"18px 24px",marginBottom:16,boxShadow:"0 4px 20px rgba(26,58,26,.2)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(255,255,255,.18)",border:"2px solid rgba(255,255,255,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#fff",flexShrink:0}}>
            {account.name[0].toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <h2 className="cg" style={{fontSize:isMobile?17:22,fontWeight:800,color:"#fff",marginBottom:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{account.name}</h2>
            <p className="sy" style={{fontSize:12,color:"rgba(255,255,255,.8)",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{account.email}</p>
          </div>
          <button className="sy" style={{background:"rgba(255,255,255,.12)",border:"1px solid rgba(255,255,255,.25)",color:"#fff",cursor:"pointer",fontSize:11,fontWeight:600,padding:"6px 10px",borderRadius:8,fontFamily:"inherit",flexShrink:0}} onClick={()=>{setShowPinChange(true);setPinStep("new");setNewPin("");setNewPin2("");setPinErr("");setPinOk(false);}}>
            🔑 PIN
          </button>
        </div>

        {/* Streak badges */}
        {(()=>{
          const badges=[];
          if(streak?.type==="win"&&streak.count>=3) badges.push({icon:"🔥",label:`${streak.count} race hot streak`,col:"#ea580c",bg:"rgba(234,88,12,.2)"});
          if(streak?.type==="win"&&streak.count>=2&&streak.count<3) badges.push({icon:"📈",label:"Building momentum",col:"#16a34a",bg:"rgba(22,163,74,.2)"});
          if(streak?.type==="loss"&&streak.count>=3) badges.push({icon:"🧊",label:`${streak.count} race cold run`,col:"#93c5fd",bg:"rgba(147,197,253,.2)"});
          if(longestWinStreak>=3) badges.push({icon:"💯",label:`Best: ${longestWinStreak} in a row`,col:"#fbbf24",bg:"rgba(251,191,36,.2)"});
          if(raceWinRate>=60&&totalSettledRaces>=3) badges.push({icon:"🎯",label:`${raceWinRate}% win rate`,col:"#c4b5fd",bg:"rgba(196,181,253,.2)"});
          if(!badges.length) return null;
          return(
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {badges.map((b,i)=>(
                <span key={i} className="sy" style={{fontSize:12,fontWeight:700,color:"#fff",background:b.bg,padding:"5px 12px",borderRadius:20,border:`1px solid rgba(255,255,255,.25)`,display:"inline-flex",alignItems:"center",gap:5}}>
                  <span>{b.icon}</span><span style={{color:"rgba(255,255,255,.9)"}}>{b.label}</span>
                </span>
              ))}
            </div>
          );
        })()}

        <div style={{background:"rgba(255,255,255,.08)",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span className="sy" style={{fontSize:11,color:"rgba(255,255,255,.65)",textTransform:"uppercase",letterSpacing:".1em",fontWeight:700}}>Season Returns</span>
          <span className="cg" style={{fontSize:isMobile?22:26,fontWeight:900,color:profit>0?"#4ade80":profit<0?"#f87171":"rgba(255,255,255,.5)"}}>{profit>0?"+":""}{fmt(profit)}</span>
        </div>
        {pinOk&&<div className="sy" style={{fontSize:12,color:"#4ade80",marginTop:8,textAlign:"center"}}>✓ PIN updated successfully!</div>}
      </div>

      {/* Main stats - per race */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:6,marginBottom:8}}>
        {[
          ["Races",totalSettledRaces||0,null],
          ["Wins",racesWon,"#16a34a"],
          ["Losses",racesLost,"#dc2626"],
          ["Pending",bets.filter(b=>b.won===null).length,"#d97706"],
        ].map(([l,v,col])=>(
          <div key={l} style={{background:"#fff",borderRadius:10,padding:"10px 6px",textAlign:"center",border:`1px solid ${C.border}`}}>
            <div className="sy" style={{fontSize:10,color:"#555",marginBottom:3,fontWeight:600}}>{l}</div>
            <div className="cg" style={{fontSize:isMobile?18:22,fontWeight:800,color:col||"#111"}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:6,marginBottom:12}}>
        {[
          ["Win %",`${raceWinRate}%`,raceWinRate>=50?"#16a34a":raceWinRate>=30?"#d97706":"#dc2626"],
          ["ROI",`${roi}%`,roi>=0?"#16a34a":"#dc2626"],
          ["Staked",fmt(settledStaked),null],
          ["Won",fmt(account.totalWon),"#16a34a"],
        ].map(([l,v,col])=>(
          <div key={l} style={{background:"#fff",borderRadius:10,padding:"10px 6px",textAlign:"center",border:`1px solid ${C.border}`}}>
            <div className="sy" style={{fontSize:10,color:"#555",marginBottom:3,fontWeight:600}}>{l}</div>
            <div className="cg" style={{fontSize:isMobile?14:18,fontWeight:800,color:col||"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Highlights - compact, only show if not already in dark section */}
      {(bestWin||streak?.count>0)&&(
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:8,marginBottom:16}}>
          {bestWin&&(
            <div style={{background:"#f0fdf4",border:`1px solid ${C.greenBd}`,borderRadius:12,padding:"14px 16px"}}>
              <div className="sy" style={{fontSize:12,color:C.green,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>🌟 Best Single Win</div>
              <div className="cg" style={{fontSize:20,fontWeight:800,color:C.green}}>+{fmt(bestWin.payout||0)}</div>
              <div className="sy" style={{fontSize:12,color:"#000",marginTop:3}}>{BET_TYPES.find(t=>t.id===BASE_TYPE(bestWin.type))?.label} · {bestWinRace?.name}</div>
              <div className="sy" style={{fontSize:13,color:"#000",marginTop:1}}>{IS_TRUE_BOX(bestWin.type)?"🎲 ":IS_BOXED_TYPE(bestWin.type)?"🎯 ":""}#{bestWin.horses.join(" → #")}</div>
            </div>
          )}
          {streak&&streak.count>1&&(
            <div style={{background:streak.type==="win"?"#f0fdf4":"#fef2f2",border:`1px solid ${streak.type==="win"?C.greenBd:C.redBd}`,borderRadius:12,padding:"14px 16px"}}>
              <div className="sy" style={{fontSize:12,color:streak.type==="win"?C.green:C.red,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{streak.type==="win"?"🔥 Winning Streak":"❄️ Losing Streak"}</div>
              <div className="cg" style={{fontSize:20,fontWeight:800,color:streak.type==="win"?C.green:C.red}}>{streak.count} in a row</div>
            </div>
          )}
        </div>
      )}

            {/* ⑩ MOMENTUM & EFFICIENCY ───────────────────────────────── */}
            {raceStats.length>=3&&(()=>{
              const last3=[...raceStats].slice(-3);
              const momentum=last3.reduce((s,r)=>s+(r.profit>0?1:r.profit===0?0:-1),0);
              const momentumPct=Math.round(((momentum+3)/6)*100);
              const mCol=momentum>0?C.green:momentum<0?C.red:"#9ca3af";
              const mLabel=momentum>=2?"🔥 On Fire!":momentum===1?"📈 Building":momentum===0?"➡️ Neutral":momentum===-1?"📉 Cooling":"❄️ Cold Spell";
              const avgWinReturn=won.length>0?parseFloat((won.reduce((s,b)=>s+(b.payout||0),0)/won.length).toFixed(2)):0;
              const avgStakeAll=settled.length>0?parseFloat((settled.reduce((s,b)=>s+b.stake,0)/settled.length).toFixed(1)):0;
              const bestMultiplier=won.length>0?Math.max(...won.map(b=>b.potential&&b.stake>0?b.potential/b.stake:0)):0;
              return(
                <div className="card" style={{marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"2px solid #f0f7f0"}}><div className="cg" style={{fontSize:15,fontWeight:800,color:"#111"}}>⚡ Form & Momentum</div></div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr",gap:10}}>
                    <div>
                      <div className="sy" style={{fontSize:11,color:"#6b7280",fontWeight:600,marginBottom:8}}>Last 3 races</div>
                      <div style={{display:"flex",gap:6,marginBottom:10}}>
                        {last3.map((r,i)=>{
                          const col=r.profit>0?C.green:r.profit===0?"#9ca3af":C.red;
                          return(
                            <div key={i} style={{flex:1,height:isMobile?40:44,borderRadius:8,background:r.profit>0?"#f0fdf4":r.profit===0?"#f8f9fa":"#fef2f2",border:`2px solid ${col}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}>
                              <span style={{fontSize:16}}>{r.profit>0?"✅":r.profit===0?"🔘":"❌"}</span>
                              <span className="sy" style={{fontSize:9,color:col,fontWeight:700}}>{r.profit>0?"W":r.profit===0?"$0":"L"}</span>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span className="sy" style={{fontSize:12,fontWeight:700,color:mCol}}>{mLabel}</span>
                      </div>
                      <div style={{height:8,background:"#f0f0f0",borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${momentumPct}%`,background:`linear-gradient(to right,${mCol}66,${mCol})`,borderRadius:4}}/>
                      </div>
                    </div>
                    <div>
                      <div className="sy" style={{fontSize:11,color:"#000",marginBottom:8,fontWeight:600}}>Betting efficiency</div>
                      <div style={{display:"flex",flexDirection:"column",gap:7}}>
                        {[
                          ["Avg Win Return",`$${avgWinReturn.toFixed(2)}`,C.green],
                          ["Avg Bet Size",`$${avgStakeAll}`,C.accent],
                          ["Best Multiplier",bestMultiplier>0?`${bestMultiplier.toFixed(1)}×`:"—",C.gold],
                          ["Total Bets",settled.length,"#111"],
                        ].map(([l,v,col])=>(
                          <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:`1px solid ${C.border}`}}>
                            <span className="sy" style={{fontSize:12,color:"#000"}}>{l}</span>
                            <span className="sy" style={{fontSize:13,fontWeight:700,color:col}}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}




      {/* -- VISUAL STATS SECTION -- */}
      {totalSettledRaces===0?(
        <div style={{marginBottom:20,textAlign:"center",padding:"40px 20px",borderRadius:14,background:"#f8fffe",border:`1px solid ${C.greenBd}`}}>
          <div style={{fontSize:48,marginBottom:10}}>📈</div>
          <div className="cg" style={{fontSize:18,fontWeight:700,marginBottom:6}}>Your stats will appear here</div>
          <div className="sy" style={{fontSize:13,color:"#000"}}>Once races are settled you'll see your profit chart, win rates and more.</div>
        </div>
      ):(()=>{

        // ── Core calcs ──────────────────────────────────────────────
        const profitCurve=[];let curRun=0;
        raceStats.forEach(r=>{curRun=parseFloat((curRun+r.profit).toFixed(2));profitCurve.push({val:curRun,name:r.race.name,profit:r.profit});});
        const peakBal=Math.max(...profitCurve.map(b=>b.val),0);
        const troughBal=Math.min(...profitCurve.map(b=>b.val),0);
        const lineCol=profit>0?C.green:profit<0?C.red:"#9ca3af";

        // Bet type breakdown
        const typeColors={win:"#1a3a1a",place:"#1d4ed8",eachway:"#7c3aed",quinella:"#b45309",exacta:"#0e7490",trifecta:"#be185d",firstfour:"#d97706"};
        const typeData=BET_TYPES.map(t=>{
          const tb=settled.filter(b=>b.type===t.id);if(!tb.length)return null;
          const tw=tb.filter(b=>b.won===true);
          const payout=tw.reduce((s,b)=>s+(b.payout||0),0);
          const hitRate=Math.round((tw.length/tb.length)*100);
          return{label:t.label,id:t.id,payout,count:tb.length,wins:tw.length,hitRate,col:typeColors[t.id]||C.accent};
        }).filter(Boolean);

        // Stake buckets
        const buckets=[{label:"$1-4",min:1,max:4},{label:"$5-8",min:5,max:8},{label:"$9-12",min:9,max:12},{label:"$13-16",min:13,max:16},{label:"$17+",min:17,max:999}];
        const bucketData=buckets.map(b=>{const tb=settled.filter(x=>x.stake>=b.min&&x.stake<=b.max);const tw=tb.filter(x=>x.won===true);return{...b,total:tb.length,wins:tw.length,payout:tw.reduce((s,x)=>s+(x.payout||0),0),staked:tb.reduce((s,x)=>s+x.stake,0)};}).filter(b=>b.total>0);

        // Barrier frequency
        const numFreq={};bets.forEach(b=>b.horses.forEach(n=>{numFreq[n]=(numFreq[n]||0)+1;}));
        const maxFreq=Math.max(...Object.values(numFreq),1);

        // Best race & horse
        const bestRaceStat2=[...raceStats].sort((a,b)=>b.profit-a.profit)[0];
        const bestBetInBest=bestRaceStat2?.rb?.filter(b=>b.won===true).sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
        const bestHorse=bestBetInBest?races.find(r=>r.id===bestRaceStat2?.race?.id)?.horses?.find(h=>h.number===bestBetInBest?.horses?.[0]):null;

        // New stats ─────────────────────────────────────────────────
        // Lucky number: barrier that wins most
        const winningBarriers={};won.forEach(b=>b.horses.forEach(n=>{winningBarriers[n]=(winningBarriers[n]||0)+1;}));
        const luckyBarrier=Object.entries(winningBarriers).sort(([,a],[,b])=>b-a)[0];

        // Average odds backed (potential/stake ratio)
        const oddsArr=settled.filter(b=>b.potential&&b.stake>0).map(b=>b.potential/b.stake);
        const avgOdds=oddsArr.length?parseFloat((oddsArr.reduce((s,o)=>s+o,0)/oddsArr.length).toFixed(1)):0;

        // Biggest single race payday
        const biggestPayout=won.sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
        const biggestPayoutRace=biggestPayout?races.find(r=>r.id===biggestPayout.raceId):null;

        // Total bets count by type
        const mostUsedType=typeData.sort((a,b)=>b.count-a.count)[0];
        const bestTypeByHitRate=typeData.filter(t=>t.count>=2).sort((a,b)=>b.hitRate-a.hitRate)[0];

        // Chart sizing - ensure fits within card padding
        const svgW=isMobile?Math.min(window.innerWidth-56,320):480;
        const svgH=110; const pad=14;
        const pts=profitCurve.map((p,i)=>{
          const mn=Math.min(...profitCurve.map(x=>x.val),0),mx=Math.max(...profitCurve.map(x=>x.val),.01),rng=mx-mn||1;
          const x=pad+(i/(profitCurve.length-1||1))*(svgW-pad*2);
          const y=pad+((mx-p.val)/rng)*(svgH-pad*2);
          return[x,y];
        });
        const pathD=pts.length>1?"M"+pts.map(p=>p.join(",")).join(" L"):"";
        const fillD=pts.length>1?`M${pts[0][0]},${svgH-pad} L`+pts.map(p=>p.join(",")).join(" L")+` L${pts[pts.length-1][0]},${svgH-pad} Z`:"";

        return(
          <div style={{marginBottom:24}}>

            {/* ── INSIGHTS ROW ─────────────────────────────────────── */}
            {(()=>{
              // Best / worst track
              const byVenue={};
              raceStats.forEach(r=>{
                const v=r.race.venue||"Unknown";
                if(!byVenue[v])byVenue[v]={venue:v,races:0,wins:0,returned:0};
                byVenue[v].races++;
                if(r.profit>0)byVenue[v].wins++;
                byVenue[v].returned+=r.returned;
              });
              const venues=Object.values(byVenue).filter(v=>v.races>=1);
              const bestVenue=venues.sort((a,b)=>b.returned-a.returned)[0];
              const worstVenue=[...venues].sort((a,b)=>a.returned-b.returned)[0];

              // Lucky barrier
              const barrierWins={};
              won.forEach(b=>{
                const race=races.find(r=>r.id===b.raceId);
                b.horses.forEach(n=>{
                  const h=race?.horses?.find(h=>h.number===n);
                  if(h){barrierWins[n]=(barrierWins[n]||0)+1;}
                });
              });
              const topBarrier=Object.entries(barrierWins).sort((a,b)=>b[1]-a[1])[0];

              // Bet timing
              const timingGroups={early:0,mid:0,late:0};
              const timingWins={early:0,mid:0,late:0};
              bets.filter(b=>b.won!==null&&b.placedAt).forEach(b=>{
                const race=races.find(r=>r.id===b.raceId);
                if(!race?.raceTime||!race?.date) return;
                const raceMs=new Date(`${race.date}T${race.raceTime}:00`).getTime();
                const betMs=new Date(b.placedAt).getTime();
                const minsBeforeRace=(raceMs-betMs)/60000;
                const group=minsBeforeRace>60?"early":minsBeforeRace>15?"mid":"late";
                timingGroups[group]++;
                if(b.won===true)timingWins[group]++;
              });
              const bestTiming=Object.entries(timingGroups).filter(([k,v])=>v>0).sort((a,b)=>(timingWins[b[0]]/b[1])-(timingWins[a[0]]/a[1]))[0];
              const timingLabel={early:"Early 60min+",mid:"15-60 mins",late:"Last 15min"};
              const timingIcon={early:"☀️",mid:"⏰",late:"⚡"};

              if(!bestVenue&&!topBarrier&&!bestTiming) return null;
              return(
                <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)",gap:8,marginBottom:12}}>
                  {/* Best Track */}
                  {bestVenue&&(
                    <div className="card" style={{textAlign:"center",padding:"16px 10px"}}>
                      <div style={{fontSize:28,marginBottom:8}}>🏟️</div>
                      <div className="sy" style={{fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>Best Track</div>
                      <div className="cg" style={{fontSize:13,fontWeight:800,color:"#111",marginBottom:2}}>{bestVenue.venue}</div>
                      <div className="sy" style={{fontSize:11,color:C.green,fontWeight:700}}>{bestVenue.wins}/{bestVenue.races} wins</div>
                      {worstVenue&&worstVenue.venue!==bestVenue.venue&&(
                        <div className="sy" style={{fontSize:10,color:C.red,marginTop:2}}>📉 Avoid: {worstVenue.venue}</div>
                      )}
                    </div>
                  )}
                  {/* Lucky Barrier */}
                  {topBarrier&&(
                    <div className="card" style={{textAlign:"center",padding:"14px 10px"}}>
                      <div style={{fontSize:26,marginBottom:6}}>🍀</div>
                      <div className="sy" style={{fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>Lucky Number</div>
                      <div style={{width:36,height:36,borderRadius:10,background:"#1a3a1a",color:"#fff",fontSize:18,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 4px"}}>{topBarrier[0]}</div>
                      <div className="sy" style={{fontSize:11,color:C.green,fontWeight:700}}>{topBarrier[1]} win{topBarrier[1]!==1?"s":""}</div>
                    </div>
                  )}
                  {/* Bet Timing */}
                  {bestTiming&&timingGroups[bestTiming[0]]>=2&&(
                    <div className="card" style={{textAlign:"center",padding:"12px 8px"}}>
                      <div style={{fontSize:24,marginBottom:4}}>{timingIcon[bestTiming[0]]||"⏱️"}</div>
                      <div className="sy" style={{fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>Best Bet Time</div>
                      <div className="cg" style={{fontSize:12,fontWeight:800,color:"#111",marginBottom:2}}>{timingLabel[bestTiming[0]]||bestTiming[0]}</div>
                      <div className="sy" style={{fontSize:11,color:C.green,fontWeight:700}}>{timingWins[bestTiming[0]]}/{timingGroups[bestTiming[0]]} wins</div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ② JOCKEY & TRAINER ─────────────────────────────── */}
            {(()=>{
              const js2={};const ts2={};
              settled.forEach(b=>{const race=races.find(r=>r.id===b.raceId);b.horses.forEach(n=>{const h=race?.horses?.find(h=>h.number===n);const j=h?.jockey?.replace(/^J\s+/i,'').replace(/^J\./i,'').trim();if(j&&j!=='TBA'&&j!==''){if(!js2[j])js2[j]={bets:0,wins:0};js2[j].bets++;if(b.won===true)js2[j].wins++;}const t=h?.trainer?.replace(/^T\s+/i,'').replace(/^T\./i,'').trim();if(t&&t!=='TBA'&&t!==''){if(!ts2[t])ts2[t]={bets:0,wins:0};ts2[t].bets++;if(b.won===true)ts2[t].wins++;}});});
              const tj=Object.entries(js2).filter(([,v])=>v.bets>=2).sort((a,b)=>b[1].wins-a[1].wins||b[1].bets-a[1].bets)[0];
              const tt=Object.entries(ts2).filter(([,v])=>v.bets>=2).sort((a,b)=>b[1].wins-a[1].wins||b[1].bets-a[1].bets)[0];
              if(!tj&&!tt) return null;
              const items=[
                tj&&{icon:"🧑\u200d✈️",label:"Your Top Jockey",name:tj[0],wins:tj[1].wins,bets:tj[1].bets,col:"#1d4ed8",bg:"#eff6ff"},
                tt&&{icon:"🕵️",label:"Your Top Trainer",name:tt[0],wins:tt[1].wins,bets:tt[1].bets,col:"#7c3aed",bg:"#f5f3ff"},
              ].filter(Boolean);
              return(
                <div className="card" style={{marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"2px solid #f0f7f0"}}><div className="cg" style={{fontSize:15,fontWeight:800,color:"#111"}}>🎽 In the Silks</div></div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)",gap:8}}>
                    {items.map(item=>(
                      <div key={item.label} style={{borderRadius:10,padding:"12px 14px",background:item.bg,border:`1.5px solid ${item.col}33`,display:"flex",alignItems:"center",gap:12}}>
                        <div style={{width:42,height:42,borderRadius:10,background:item.col,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{item.icon}</div>
                        <div style={{minWidth:0}}>
                          <div className="sy" style={{fontSize:10,fontWeight:700,color:item.col,textTransform:"uppercase",letterSpacing:".06em",marginBottom:2}}>{item.label}</div>
                          <div className="cg" style={{fontSize:14,fontWeight:800,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:2}}>{item.name}</div>
                          <div style={{display:"flex",gap:8}}>
                            <span className="sy" style={{fontSize:11,fontWeight:700,color:item.col}}>{item.wins}W</span>
                            <span className="sy" style={{fontSize:11,color:"#9ca3af"}}>{item.bets} bets</span>
                            <span className="sy" style={{fontSize:11,fontWeight:700,color:item.wins>0?"#16a34a":"#9ca3af"}}>{item.bets>0?Math.round((item.wins/item.bets)*100):0}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}


            {/* ⑨ PUNTER PERSONALITY ───────────────────────────────── */}
            {(()=>{
              const exoticBets=settled.filter(b=>["trifecta","firstfour","exacta","quinella"].includes(BASE_TYPE(b.type)));
              const exoticPct=settled.length?Math.round((exoticBets.length/settled.length)*100):0;
              const avgStakeP=settled.length?parseFloat((settled.reduce((s,b)=>s+b.stake,0)/settled.length).toFixed(1)):0;
              const bigBets=settled.filter(b=>b.stake>=15).length;
              const bigBetPct=settled.length?Math.round((bigBets/settled.length)*100):0;
              const highOddsBets=settled.filter(b=>b.potential&&b.stake>0&&b.potential/b.stake>=10).length;
              const trifectaBets=settled.filter(b=>BASE_TYPE(b.type)==="trifecta");
              const firstFourBets=settled.filter(b=>BASE_TYPE(b.type)==="firstfour");
              const bigExoticBets=trifectaBets.length+firstFourBets.length;
              const bigExoticWins=won.filter(b=>BASE_TYPE(b.type)==="trifecta"||BASE_TYPE(b.type)==="firstfour");
              const bestBigPayout=bigExoticWins.length?Math.max(...bigExoticWins.map(b=>b.payout||0)):0;
              const ewBets=settled.filter(b=>b.type==="eachway");
              const ewPct=settled.length?Math.round((ewBets.length/settled.length)*100):0;
              const hasEnough=settled.length>=3;

              // Score each type — highest score wins (fully exclusive)
              const getScore=(key)=>{
                if(key==="exotic")  return (exoticPct>=55?exoticPct:0)+(bigExoticBets>=2?bigExoticBets*15:0);
                if(key==="roughie") return highOddsBets>=3?highOddsBets*20:0;
                if(key==="eachway") return ewPct>=40?ewPct:0;
                if(key==="hothand") return longestWinStreak>=3?longestWinStreak*20:0;
                if(key==="analyst") return raceWinRate>=60?raceWinRate:0;
                if(key==="machine") return (raceWinRate>=45&&longestLossStreak<=1&&avgStakeP>=8&&avgStakeP<=16)?raceWinRate+30:0;
                if(key==="highroller") return bigBetPct>=55?bigBetPct:0;
                if(key==="tactician") return avgStakeP<=5&&settled.length>=3?80:0;
                if(key==="cold") return longestLossStreak>=3&&longestWinStreak<2?longestLossStreak*20:0;
                return 0;
              };

              const allTypes=[
                {key:"exotic",icon:"🎰",name:"The Exotic Punter",hint:"55%+ of your bets are exotics, or 2+ trifectas/first fours",desc:"Trifectas, First Fours, Quinellas — always building the dream ticket and chasing the big one",col:"#be185d",bg:"#fdf2f8",stats:[`${exoticPct}% exotics`,bigExoticBets>0?`${bigExoticBets} tri/FF bets`:"-",bestBigPayout>0?`Best +${fmt(bestBigPayout)}`:"Still hunting"]},
                {key:"roughie",icon:"🐎",name:"The Roughie Hunter",hint:"Back 3+ horses at $10 odds or higher",desc:"Longshots only — $10 odds minimum, $100 payout in the dream. One day it'll come",col:"#7c3aed",bg:"#f5f3ff",stats:[`${highOddsBets} longshots backed`,`$10+ odds`,`${raceWinRate}% hit rate`]},
                {key:"eachway",icon:"🤝",name:"The Safety Net",hint:"40%+ of your bets are Each Way",desc:"Each Way every race — you want a piece of the action but you're not going home empty handed",col:"#0891b2",bg:"#ecfeff",stats:[`${ewPct}% Each Way`,`${ewBets.length} EW bets`,`$${avgStakeP} avg stake`]},
                {key:"hothand",icon:"🔥",name:"The Hot Hand",hint:"Win 3 or more races in a row",desc:"On a winning run and can't be stopped — you're in the zone and you know it",col:"#ea580c",bg:"#fff7ed",stats:[`${longestWinStreak} race win streak`,`${raceWinRate}% overall`,`${racesWon} profitable races`]},
                {key:"analyst",icon:"🔬",name:"The Analyst",hint:"Hit rate of 60%+ without chasing longshots or big stakes",desc:"You study the form, weigh up the odds, and only bet when you're certain — cold, precise, and rarely wrong",col:"#16a34a",bg:"#f0fdf4",stats:[`${raceWinRate}% win rate`,`${racesWon} wins from ${raceStats.length}`,"Picks winners"]},
                {key:"machine",icon:"🤖",name:"The Machine",hint:"45%+ win rate, never lose more than 1 race in a row",desc:"Same stake, same process, same result — methodical and immune to tilt",col:"#475569",bg:"#f8fafc",stats:[`${raceWinRate}% win rate`,`Max ${longestLossStreak} race loss run`,"No emotion"]},
                {key:"highroller",icon:"💎",name:"The High Roller",hint:"55%+ of your bets are $15 or more",desc:"Maximum stakes, maximum confidence — if you're going to punt, go big or go home",col:"#d97706",bg:"#fffbeb",stats:[`${bigBetPct}% big bets ($15+)`,`$${avgStakeP} avg stake`,"All in mentality"]},
                {key:"tactician",icon:"♟️",name:"The Tactician",hint:"Keep your average bet under $5",desc:"Small stakes, every angle covered — you think three moves ahead and never over-commit",col:"#6d28d9",bg:"#f5f3ff",stats:[`$${avgStakeP} avg stake`,`${settled.length} bets placed`,"Strategic coverage"]},
                {key:"cold",icon:"📉",name:"The Drifter",hint:"Currently on a 3+ race losing streak",desc:"The runs just aren't coming — but every cold streak ends. Keep showing up and the winner will land",col:"#1e40af",bg:"#eff6ff",stats:[`${longestLossStreak} race cold run`,`${raceWinRate}% overall hit rate`,"Due for one"]},
              ].map(t=>({...t,score:getScore(t.key),active:false}));

              // Pick single highest scoring type
              let current=null;
              if(hasEnough){
                let best=allTypes[allTypes.length-1];
                for(const t of allTypes){if(t.score>best.score)best=t;}
                best.active=true;
                current=best;
              }

              return(
                <div className="card" style={{marginBottom:12,padding:0,overflow:"hidden"}}>

                  {/* ── Header bar ── */}
                  <div style={{background:"linear-gradient(135deg,#1a3a1a,#0f2010)",padding:"12px 16px",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:18}}>🧠</span>
                    <div className="cg" style={{fontSize:15,fontWeight:800,color:"#fff",lineHeight:1}}>Your Punter Personality</div>
                  </div>

                  <div style={{padding:"14px"}}>

                  {/* ── Active card ── */}
                  {current&&(
                    <div style={{
                      background:`linear-gradient(135deg,${current.col},${current.col}cc)`,
                      borderRadius:12,padding:isMobile?"14px":"16px",
                      marginBottom:12,position:"relative",overflow:"hidden",
                      boxShadow:`0 4px 20px ${current.col}44`,
                    }}>
                      <div style={{position:"absolute",right:-8,top:-8,fontSize:80,opacity:.1,lineHeight:1,pointerEvents:"none"}}>{current.icon}</div>
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                        <div style={{
                          width:isMobile?52:60,height:isMobile?52:60,
                          borderRadius:14,background:"rgba(255,255,255,.2)",
                          backdropFilter:"blur(8px)",border:"2px solid rgba(255,255,255,.3)",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:isMobile?28:34,flexShrink:0,
                        }}>{current.icon}</div>
                        <div>
                          <div style={{fontSize:8,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"rgba(255,255,255,.65)",marginBottom:3}}>Your type</div>
                          <div className="cg" style={{fontSize:isMobile?18:22,fontWeight:900,color:"#fff",lineHeight:1,marginBottom:4}}>{current.name}</div>
                          <div className="sy" style={{fontSize:isMobile?11:12,color:"rgba(255,255,255,.88)",lineHeight:1.4}}>{current.desc}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        {current.stats.map((st,i)=>(
                          <span key={i} style={{
                            fontSize:10,padding:"4px 10px",
                            background:"rgba(255,255,255,.2)",
                            color:"#fff",borderRadius:20,fontWeight:700,
                            border:"1px solid rgba(255,255,255,.3)",
                          }}>{st}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Locked state ── */}
                  {!current&&(
                    <div style={{background:"linear-gradient(135deg,#0f2010,#1a3a1a)",border:"2px solid rgba(255,255,255,.1)",borderRadius:16,padding:"24px 20px",marginBottom:16,textAlign:"center",position:"relative",overflow:"hidden"}}>
                      <div style={{position:"absolute",top:-20,right:-20,fontSize:120,opacity:.05,lineHeight:1}}>🏇</div>
                      <div style={{fontSize:40,marginBottom:10}}>🏇</div>
                      <div className="cg" style={{fontSize:18,fontWeight:800,color:"#fff",marginBottom:6}}>Still in the barriers...</div>
                      <div className="sy" style={{fontSize:13,color:"rgba(255,255,255,.7)",lineHeight:1.6,marginBottom:12}}>
                        Your punter personality reveals itself once you've had a few races settled. The gates are about to open.
                      </div>
                      <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,.1)",borderRadius:20,padding:"6px 16px",border:"1px solid rgba(255,255,255,.2)"}}>
                        <div style={{display:"flex",gap:4}}>
                          {[0,1,2].map(i=>(
                            <div key={i} style={{width:8,height:8,borderRadius:"50%",background:i<settled.length?"#4ade80":"rgba(255,255,255,.2)",transition:"all .3s"}}/>
                          ))}
                        </div>
                        <span className="sy" style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.8)"}}>
                          {settled.length===0?"Place your first bets to begin":settled.length<3?`${3-settled.length} more settled race${3-settled.length===1?"":"s"} to go`:""}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* ── Grid of all 9 types ── */}
                  <div className="sy" style={{fontSize:10,fontWeight:700,color:"#9ca3af",textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>All personality types</div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(3,1fr)":"repeat(3,1fr)",gap:8}}>
                    {allTypes.map((t)=>{
                      const isActive=t.active;
                      const revealed=!!current; // once you have ANY type, all cards reveal
                      return(
                        <div key={t.key} style={{
                          borderRadius:14,padding:"14px 8px",
                          background:revealed
                            ?isActive?`linear-gradient(160deg,${t.col}22,${t.col}0e)`:t.bg
                            :"#f1f5f9",
                          border:`2px solid ${revealed?(isActive?t.col+"88":t.col+"30"):"#e2e8f0"}`,
                          opacity:revealed?(isActive?1:0.6):0.5,
                          display:"flex",flexDirection:"column",alignItems:"center",
                          textAlign:"center",gap:5,
                          boxShadow:isActive?`0 4px 20px ${t.col}44`:"none",
                          transition:"all .4s ease",
                          filter:revealed?"none":"grayscale(1)",
                        }}>
                          <div style={{
                            width:40,height:40,borderRadius:12,
                            background:revealed
                              ?isActive?`linear-gradient(135deg,${t.col},${t.col}bb)`:`${t.col}30`
                              :"#cbd5e1",
                            display:"flex",alignItems:"center",justifyContent:"center",
                            fontSize:20,
                            boxShadow:isActive?`0 4px 12px ${t.col}55`:"none",
                            transition:"all .4s ease",
                          }}>{t.icon}</div>
                          <div className="sy" style={{
                            fontSize:isMobile?10:11,fontWeight:800,
                            color:revealed?(isActive?t.col:"#1f2937"):"#94a3b8",
                            lineHeight:1.2,
                            transition:"color .4s ease",
                          }}>{t.name.replace("The ","")}</div>
                          {isActive
                            ?<span style={{fontSize:9,padding:"2px 8px",background:t.col,color:"#fff",borderRadius:20,fontWeight:700}}>✓ You</span>
                            :revealed
                              ?<div className="sy" style={{fontSize:9,color:"#4b5563",lineHeight:1.3}}>{t.hint}</div>
                              :<div className="sy" style={{fontSize:9,color:"#cbd5e1",lineHeight:1.3}}>–</div>
                          }
                        </div>
                      );
                    })}
                  </div>

                  </div>{/* end padding wrapper */}
                </div>
              );
            })()}



            {/* ⑪ TROPHY CABINET ──────────────────────────────────── */}
            {settled.length>0&&(()=>{
              const achievements=[
                {icon:"🎯",name:"First Bet",desc:"You're on the board!",hint:"Place your first bet",unlocked:settled.length>=1},
                {icon:"💸",name:"Full Send",desc:"Spent your whole $24 in one race!",hint:"Use your entire budget in a single race",unlocked:allRaces.some(r=>getRaceBalance(account.id,r.id)===0)},
                {icon:"🔥",name:"On a Roll",desc:"2 wins in a row!",hint:"Win 2 races in a row",unlocked:longestWinStreak>=2},
                {icon:"🏆",name:"Hat Trick",desc:"3 wins in a row!",hint:"Win 3 races in a row",unlocked:longestWinStreak>=3},
                {icon:"💰",name:"Ton Up",desc:"$100+ returned!",hint:"Return over $100 total",unlocked:account.totalWon>=100},
                {icon:"💎",name:"High Roller",desc:"Living large!",hint:"Place a single bet of $20+",unlocked:settled.some(b=>b.stake>=20)},
                {icon:"🐎",name:"Roughie King",desc:"Longshot landed!",hint:"Win a bet at $10+ odds",unlocked:won.some(b=>b.potential&&b.stake>0&&b.potential/b.stake>=10)},
                {icon:"🎰",name:"Exotic Lover",desc:"Exotic winner!",hint:"Win a trifecta or first four",unlocked:won.some(b=>BASE_TYPE(b.type)==="trifecta"||BASE_TYPE(b.type)==="firstfour")},
                {icon:"🌟",name:"Big Winner",desc:"Massive payout!",hint:"Win $50+ in a single bet",unlocked:won.some(b=>(b.payout||0)>=50)},
                {icon:"📈",name:"Consistent",desc:"5 profitable races!",hint:"Be profitable in 5+ races",unlocked:racesWon>=5},
              ];
              const unlocked=achievements.filter(a=>a.unlocked);
              const pct=Math.round((unlocked.length/achievements.length)*100);
              const allUnlocked=unlocked.length===achievements.length;
              return(
                <div style={{marginBottom:12,borderRadius:14,overflow:"hidden",border:`1px solid ${allUnlocked?"#fbbf24":"#e8d48b"}`,boxShadow:allUnlocked?"0 4px 24px rgba(251,191,36,.25)":"0 2px 12px rgba(184,134,11,.08)"}}>
                  {/* Dark gold header */}
                  <div style={{background:allUnlocked?"linear-gradient(135deg,#78350f,#92400e,#b45309)":"linear-gradient(135deg,#1a1200,#2d2000)",padding:"12px 16px",position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:-16,right:-16,fontSize:80,opacity:.08,lineHeight:1}}>🏆</div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div>
                        <div className="sy" style={{fontSize:9,fontWeight:700,letterSpacing:".14em",textTransform:"uppercase",color:"rgba(251,191,36,.6)",marginBottom:2}}>{allUnlocked?"🎉 Complete!":"Season Progress"}</div>
                        <div className="cg" style={{fontSize:16,fontWeight:900,color:"#fbbf24"}}>🏅 Trophy Cabinet</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div className="cg" style={{fontSize:22,fontWeight:900,color:"#fbbf24",lineHeight:1}}>{unlocked.length}<span style={{fontSize:13,color:"rgba(251,191,36,.5)"}}>/{achievements.length}</span></div>
                        <div className="sy" style={{fontSize:10,color:"rgba(251,191,36,.5)"}}>{allUnlocked?"all done! 🌟":"unlocked"}</div>
                      </div>
                    </div>
                    {/* Gold progress bar */}
                    <div style={{height:5,background:"rgba(255,255,255,.08)",borderRadius:3,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${pct}%`,background:allUnlocked?"linear-gradient(to right,#fef08a,#fbbf24,#fef08a)":"linear-gradient(to right,#b45309,#fbbf24,#fef08a)",borderRadius:3,boxShadow:`0 0 ${allUnlocked?12:6}px rgba(251,191,36,${allUnlocked?.7:.35})`,animation:allUnlocked?"shimmer 2s ease-in-out infinite":"none"}}/>
                    </div>
                  </div>

                  {/* All unlocked celebration banner */}
                  {allUnlocked&&(
                    <div style={{background:"linear-gradient(135deg,#fffbeb,#fef3c7)",padding:"14px 18px",borderBottom:"1px solid #fbbf2444",textAlign:"center"}}>
                      <div style={{fontSize:28,marginBottom:4}}>🏆🌟🏆</div>
                      <div className="cg" style={{fontSize:15,fontWeight:900,color:"#92400e",marginBottom:2}}>Trophy Cabinet Complete!</div>
                      <div className="sy" style={{fontSize:12,color:"#b45309"}}>You've unlocked every achievement this season. Legendary punter.</div>
                    </div>
                  )}

                  {/* Trophies grid */}
                  <div style={{background:"#fff",padding:"14px"}}>
                    <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(5,1fr)",gap:isMobile?6:8}}>
                      {achievements.map(a=>(
                        <div key={a.name} style={{
                          borderRadius:12,padding:"12px 8px",textAlign:"center",
                          background:a.unlocked?"linear-gradient(135deg,#fffbeb,#fef3c7)":"#f8f9fa",
                          border:`1.5px solid ${a.unlocked?"#fbbf2466":C.border}`,
                          boxShadow:a.unlocked?"0 2px 8px rgba(251,191,36,.15)":"none",
                          transition:"all .2s",
                          position:"relative",
                          overflow:"hidden",
                        }}>
                          {a.unlocked&&<div style={{position:"absolute",top:4,right:4,width:8,height:8,borderRadius:"50%",background:"#fbbf24",boxShadow:"0 0 6px #fbbf24"}}/>}
                          {!a.unlocked&&<div style={{position:"absolute",top:6,right:6,fontSize:13,lineHeight:1}}>🔒</div>}
                          <div style={{fontSize:a.unlocked?28:22,filter:a.unlocked?"none":"grayscale(1)",opacity:a.unlocked?1:0.35,marginBottom:5,lineHeight:1}}>{a.icon}</div>
                          <div className="sy" style={{fontSize:isMobile?10:11,fontWeight:700,color:a.unlocked?"#92400e":"#374151",lineHeight:1.2,marginBottom:3}}>{a.name}</div>
                          {a.unlocked
                            ?<div className="sy" style={{fontSize:9,color:"#b45309",lineHeight:1.3,fontWeight:600}}>{a.desc}</div>
                            :<div className="sy" style={{fontSize:9,color:"#6b7280",lineHeight:1.3}}>{a.hint}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}


            {/* ① PROFIT JOURNEY ─────────────────────────────────── */}
            <div className="card" style={{marginBottom:12,background:"linear-gradient(135deg,#f0fff8,#f8fffe)",padding:isMobile?"14px":"20px 22px"}}>
              <div style={{marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"2px solid #f0f7f0"}}><div className="cg" style={{fontSize:15,fontWeight:800,color:"#111"}}>📈 Profit Journey</div></div>
                <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                  <div className="cg" style={{fontSize:isMobile?22:32,fontWeight:900,color:profit>0?C.green:profit<0?C.red:"#9ca3af",lineHeight:1}}>{profit>0?"+":""}{fmt(profit)}</div>
                  <div style={{display:"flex",gap:8}}>
                    <div style={{textAlign:"center",background:"#f0fdf4",borderRadius:8,padding:"5px 10px",border:`1px solid ${C.greenBd}`}}>
                      <div className="sy" style={{fontSize:10,color:"#000"}}>Peak</div>
                      <div className="cg" style={{fontSize:13,fontWeight:800,color:C.green}}>+{fmt(peakBal)}</div>
                    </div>
                    <div style={{textAlign:"center",background:"#fef2f2",borderRadius:8,padding:"5px 10px",border:`1px solid ${C.redBd}`}}>
                      <div className="sy" style={{fontSize:10,color:"#000"}}>Low</div>
                      <div className="cg" style={{fontSize:13,fontWeight:800,color:C.red}}>{fmt(troughBal)}</div>
                    </div>
                  </div>
                </div>
                <div className="sy" style={{fontSize:12,color:"#000",marginTop:4}}>{raceStats.length} races settled</div>
              </div>
              <div style={{overflowX:"auto"}}>
                <svg width={svgW} height={svgH} style={{display:"block"}}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={lineCol} stopOpacity="0.3"/>
                      <stop offset="100%" stopColor={lineCol} stopOpacity="0.02"/>
                    </linearGradient>
                  </defs>
                  {[.25,.5,.75].map((t,i)=><line key={i} x1={pad} y1={pad+t*(svgH-pad*2)} x2={svgW-pad} y2={pad+t*(svgH-pad*2)} stroke="rgba(0,0,0,.06)" strokeWidth="1"/>)}
                  {fillD&&<path d={fillD} fill="url(#pg)"/>}
                  {pathD&&<path d={pathD} fill="none" stroke={lineCol} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
                  {pts.map(([x,y],i)=><circle key={i} cx={x} cy={y} r={i===pts.length-1?5:3} fill={profitCurve[i].profit>0?C.green:profitCurve[i].profit===0?"#9ca3af":C.red} stroke="#fff" strokeWidth={i===pts.length-1?2:0}/>)}
                </svg>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
                <span className="sy" style={{fontSize:11,color:"#000"}}>Race 1</span>
                <span className="sy" style={{fontSize:11,color:"#000"}}>Race {profitCurve.length}</span>
              </div>
            </div>

            {/* ② KEY NUMBERS ─────────────────────────────────────── */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:12}}>
              <div className="card" style={{textAlign:"center",padding:"16px 12px"}}>
                <div style={{fontSize:32,marginBottom:4}}>🏆</div>
                <div className="sy" style={{fontSize:11,color:"#000",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>Best Race</div>
                <div className="cg" style={{fontSize:20,fontWeight:900,color:C.green}}>+{fmt(bestRaceStat2?.profit||0)}</div>
                <div className="sy" style={{fontSize:12,color:"#000",marginTop:2}}>{bestRaceStat2?.race?.name||"-"}</div>
                {bestHorse&&<div className="sy" style={{fontSize:12,fontWeight:700,color:C.accent,marginTop:2}}>🐎 {bestHorse.name}</div>}
              </div>
              <div className="card" style={{textAlign:"center",padding:"16px 12px"}}>
                <div style={{fontSize:32,marginBottom:4}}>💰</div>
                <div className="sy" style={{fontSize:11,color:"#000",textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>Biggest Win</div>
                <div className="cg" style={{fontSize:20,fontWeight:900,color:C.green}}>+{fmt(biggestPayout?.payout||0)}</div>
                <div className="sy" style={{fontSize:12,color:"#000",marginTop:2}}>{biggestPayoutRace?.name||"-"}</div>
                <div className="sy" style={{fontSize:12,fontWeight:700,color:C.accent,marginTop:2}}>{BET_TYPES.find(t=>t.id===BASE_TYPE(biggestPayout?.type))?.label||""}</div>
              </div>
            </div>

            {/* ③ WIN RATE RING + STREAK ────────────────────────────── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              <div className="card" style={{textAlign:"center",padding:"18px 12px"}}>
                <div className="sy" style={{fontSize:10,fontWeight:700,color:"#000",marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Win Rate</div>
                {(()=>{
                  const ringCol=raceWinRate>=50?C.green:raceWinRate>=30?C.gold:C.red;
                  const sz=isMobile?88:112; const r=34; const cx=sz/2; const cy=sz/2;
                  const circ=2*Math.PI*r; const dash=(raceWinRate/100)*circ;
                  return(
                    <div style={{position:"relative",width:sz,height:sz,margin:"0 auto 10px"}}>
                      <svg width={sz} height={sz}>
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth="8"/>
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke={ringCol} strokeWidth="8"
                          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}/>
                      </svg>
                      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                        <span className="cg" style={{fontSize:isMobile?20:24,fontWeight:900,color:ringCol,lineHeight:1}}>{raceWinRate}%</span>
                        <span className="sy" style={{fontSize:10,color:"#000",marginTop:1}}>hit rate</span>
                      </div>
                    </div>
                  );
                })()}
                <div style={{display:"flex",gap:16,justifyContent:"center"}}>
                  <div><div className="cg" style={{fontSize:18,fontWeight:800,color:C.green}}>{racesWon}</div><div className="sy" style={{fontSize:11,color:"#000"}}>Wins</div></div>
                  <div style={{width:1,background:C.border}}/>
                  <div><div className="cg" style={{fontSize:18,fontWeight:800,color:C.red}}>{racesLost}</div><div className="sy" style={{fontSize:11,color:"#000"}}>Losses</div></div>
                </div>
              </div>
              <div className="card" style={{textAlign:"center",padding:"18px 12px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                <div className="sy" style={{fontSize:10,fontWeight:700,color:"#000",marginBottom:8,textTransform:"uppercase",letterSpacing:".06em"}}>Streak</div>
                {streak&&streak.count>0?(<>
                  <div style={{fontSize:28,lineHeight:1,marginBottom:4}}>{streak.type==="win"?"🔥":"❄️"}</div>
                  <div className="cg" style={{fontSize:32,fontWeight:900,color:streak.type==="win"?C.green:C.red,lineHeight:1}}>{streak.count}</div>
                  <div className="sy" style={{fontSize:12,color:streak.type==="win"?C.green:C.red,marginTop:4,fontWeight:600}}>{streak.type==="win"?"wins":"losses"} in a row</div>
                  <div style={{display:"flex",gap:16,marginTop:10}}>
                    <div style={{textAlign:"center"}}>
                      <div className="sy" style={{fontSize:10,color:"#000"}}>Best run</div>
                      <div className="sy" style={{fontSize:13,fontWeight:700,color:C.green}}>{longestWinStreak} 🔥</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div className="sy" style={{fontSize:10,color:"#000"}}>Worst run</div>
                      <div className="sy" style={{fontSize:13,fontWeight:700,color:C.red}}>{longestLossStreak} ❄️</div>
                    </div>
                  </div>
                </>):<div className="sy" style={{fontSize:13,color:"#000"}}>No streak yet</div>}
              </div>
            </div>

            {/* ④ SNAPSHOT + JOCKEY/TRAINER ─────────────────── */}
            {(()=>{
              const jockeyStats={};
              settled.forEach(b=>{const race=races.find(r=>r.id===b.raceId);b.horses.forEach(n=>{const h=race?.horses?.find(h=>h.number===n);const j=h?.jockey?.replace(/^Js+/i,'').replace(/^J./i,'').trim();if(j&&j!=='TBA'&&j!==''){if(!jockeyStats[j])jockeyStats[j]={bets:0,wins:0};jockeyStats[j].bets++;if(b.won===true)jockeyStats[j].wins++;}});});
              const topJockey=Object.entries(jockeyStats).filter(([,v])=>v.bets>=2).sort((a,b)=>b[1].wins-a[1].wins||b[1].bets-a[1].bets)[0];
              const trainerStats={};
              settled.forEach(b=>{const race=races.find(r=>r.id===b.raceId);b.horses.forEach(n=>{const h=race?.horses?.find(h=>h.number===n);const t=h?.trainer?.replace(/^Ts+/i,'').replace(/^T./i,'').trim();if(t&&t!=='TBA'&&t!==''){if(!trainerStats[t])trainerStats[t]={bets:0,wins:0};trainerStats[t].bets++;if(b.won===true)trainerStats[t].wins++;}});});
              const topTrainer=Object.entries(trainerStats).filter(([,v])=>v.bets>=2).sort((a,b)=>b[1].wins-a[1].wins||b[1].bets-a[1].bets)[0];
              const snapItems=[
                {emoji:'🎯',label:'Avg Odds',value:`$${avgOdds}`,sub:'per bet'},
                {emoji:'🍀',label:'Lucky Gate',value:luckyBarrier?`#${luckyBarrier[0]}`:'-',sub:luckyBarrier?`${luckyBarrier[1]}W`:'no wins'},
                {emoji:'📊',label:'Best Type',value:bestTypeByHitRate?.label||mostUsedType?.label||'-',sub:bestTypeByHitRate?`${bestTypeByHitRate.hitRate}% hit`:'keep going!'},
              ].filter(i=>i.value!=='-'||i.label==='Avg Odds');
              return(
                <>
                  <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.min(snapItems.length,isMobile?2:3)},1fr)`,gap:6,marginBottom:12}}>
                    {snapItems.map(({emoji,label,value,sub})=>(
                      <div key={label} className="card" style={{textAlign:"center",padding:"14px 10px"}}>
                        <div style={{fontSize:20,marginBottom:4}}>{emoji}</div>
                        <div className="sy" style={{fontSize:10,color:"#6b7280",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{label}</div>
                        <div className="cg" style={{fontSize:isMobile?14:16,fontWeight:900,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</div>
                        <div className="sy" style={{fontSize:10,color:"#9ca3af",marginTop:2}}>{sub}</div>
                      </div>
                    ))}
                  </div>

                </>
              );
            })()}

            {/* ⑤ RACE BY RACE BARS ────────────────────────────────── */}
            {raceStats.length>0&&(
              <div className="card" style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"2px solid #f0f7f0"}}><div className="cg" style={{fontSize:15,fontWeight:800,color:"#111"}}>🐎 Race by Race</div></div>
                <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
                  {(()=>{
                    const maxAbs=Math.max(...raceStats.map(x=>Math.abs(x.profit)),.01);
                    const maxH=90;
                    const n=raceStats.length;
                    return(
                      <div style={{display:"flex",gap:4,alignItems:"flex-end",width:"100%",paddingBottom:4}}>
                        {raceStats.map((r,i)=>{
                          const h=Math.max(10,Math.round((Math.abs(r.profit)/maxAbs)*maxH));
                          const col=r.profit>0?C.green:r.profit===0?"#9ca3af":C.red;
                          const emoji=r.profit>0?"👍":"👎";
                          return(
                            <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flex:1}} title={`${r.race.name}: ${r.profit>0?"+":""}${fmt(r.profit)}`}>
                              <span style={{fontSize:isMobile?11:13}}>{emoji}</span>
                              <span className="sy" style={{fontSize:8,color:col,fontWeight:700}}>{r.profit>0?"+":""}{fmt(r.profit)}</span>
                              <div style={{width:"85%",height:h,background:col,opacity:.8,borderRadius:"3px 3px 0 0",flexShrink:0}}/>
                              <span className="sy" style={{fontSize:8,color:"#000"}}>R{i+1}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ⑥ BET TYPE PERFORMANCE ─────────────────────────────── */}
            {typeData.length>0&&(
              <div className="card" style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"2px solid #f0f7f0"}}><div className="cg" style={{fontSize:15,fontWeight:800,color:"#111"}}>🎯 Bet Type Performance</div></div>
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {typeData.map(t=>(
                    <div key={t.id}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:t.col,flexShrink:0}}/>
                          <span className="sy" style={{fontSize:14,fontWeight:600}}>{t.label}</span>
                          <span className="sy" style={{fontSize:12,color:"#000"}}>{t.wins}/{t.count}</span>
                        </div>
                        <div style={{display:"flex",gap:12,alignItems:"center"}}>
                          <span style={{fontSize:12,color:"#000",fontFamily:"inherit"}}>{t.hitRate}%</span>
                          <span className="sy" style={{fontSize:14,fontWeight:700,color:t.payout>0?C.green:"#9ca3af",minWidth:60,textAlign:"right"}}>{t.payout>0?"+":""}{fmt(t.payout)}</span>
                        </div>
                      </div>
                      <div style={{height:8,background:"#f3f4f6",borderRadius:4,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${t.hitRate}%`,background:t.col,borderRadius:4,opacity:.85}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ⑦ BARRIER SPEED MAP ────────────────────────────────── */}
            {Object.keys(numFreq).length>0&&(
              <div className="card" style={{marginBottom:12,overflow:"hidden"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"2px solid #f0f7f0"}}><div className="cg" style={{fontSize:15,fontWeight:800,color:"#111"}}>🏇 Barrier Speed Map</div></div>
                  {luckyBarrier&&<div className="sy" style={{fontSize:12,color:C.accent,fontWeight:700}}>#{luckyBarrier[0]} most backed</div>}
                </div>
                {/* Racing lanes - light theme */}
                <div style={{background:"#f0f7f0",borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`}}>
                  {/* Header */}
                  <div style={{display:"flex",alignItems:"center",padding:"6px 10px",background:"#1a3a1a",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{width:30,flexShrink:0}}/>
                    <div style={{flex:1}}/>
                    <div style={{fontSize:9,color:"rgba(255,255,255,.7)",fontFamily:"system-ui",letterSpacing:".1em",marginRight:4}}>FREQUENCY →</div>
                    <div style={{fontSize:11}}>🏁</div>
                  </div>
                  {Array.from({length:Math.max(...Object.keys(numFreq).map(Number),1)},(_,i)=>i+1).map((n,idx)=>{
                    const freq=numFreq[n]||0;
                    const barW=freq>0?Math.max(6,Math.round((freq/maxFreq)*100)):0;
                    const isLucky=luckyBarrier&&n===parseInt(luckyBarrier[0]);
                    const laneCol=idx%2===0?"#fff":"#f5f9f5";
                    return(
                      <div key={n} style={{display:"flex",alignItems:"center",height:28,background:laneCol,borderBottom:`1px solid #e8f0e8`}}>
                        {/* Barrier number */}
                        <div style={{width:30,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",borderRight:`2px solid #d1e8d1`,background:isLucky?"#fef3c7":"#e8f5e8"}}>
                          <span style={{fontSize:11,fontWeight:800,color:isLucky?"#d97706":C.accent,fontFamily:"system-ui"}}>{n}</span>
                        </div>
                        {/* Track lane */}
                        <div style={{flex:1,position:"relative",height:"100%",display:"flex",alignItems:"center",paddingLeft:6,paddingRight:8}}>
                          {freq>0?(
                            <>
                              {/* Bar */}
                              <div style={{
                                width:`${barW}%`,height:12,
                                background:isLucky?`linear-gradient(to right,#fbbf2444,#fbbf24)`:`linear-gradient(to right,${C.accent}44,${C.accent})`,
                                borderRadius:4,flexShrink:0,
                              }}/>
                              <span style={{fontSize:12,marginLeft:5}}>🐎</span>
                              <span style={{fontSize:11,marginLeft:3,color:"#555",fontFamily:"system-ui",fontWeight:600}}>{freq}×</span>
                              {isLucky&&<span style={{fontSize:11,marginLeft:5,color:"#d97706",fontWeight:700}}>⭐</span>}
                            </>
                          ):(
                            <span style={{fontSize:11,color:"#ccc",marginLeft:6,fontFamily:"system-ui"}}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {luckyBarrier&&(
                  <div style={{display:"flex",alignItems:"center",gap:6,marginTop:10}}>
                    <span style={{fontSize:16}}>⭐</span>
                    <span className="sy" style={{fontSize:13,color:C.accent,fontWeight:700}}>Barrier #{luckyBarrier[0]} backed {luckyBarrier[1]}× — your go-to gate</span>
                  </div>
                )}
              </div>
            )}

            {/* ⑧ STAKE SIZE RESULTS ────────────────────────────────── */}
            {bucketData.length>0&&(
              <div className="card" style={{marginBottom:12}}>
                <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"2px solid #f0f7f0"}}><div className="cg" style={{fontSize:15,fontWeight:800,color:"#111"}}>💰 Results by Stake Size</div></div>
                <div className="sy" style={{fontSize:12,color:"#000",marginBottom:14}}>Do your bigger bets pay off?</div>
                {(()=>{
                  const profits2=bucketData.map(b=>parseFloat((b.payout-b.staked).toFixed(2)));
                  const totalProfit=parseFloat(profits2.reduce((s,p)=>s+p,0).toFixed(2));
                  const cCol=totalProfit>0?C.green:totalProfit<0?C.red:"#9ca3af";
                  const cW=isMobile?Math.min(window.innerWidth-56,320):460;
                  // Extra padding so labels don't clip
                  const cPadL=8,cPadR=8,cPadT=28,cPadB=36;
                  const cH=cPadT+80+cPadB;
                  const chartH=80;
                  const cumulativePts=[];let cum=0;
                  bucketData.forEach((b,i)=>{cum=parseFloat((cum+profits2[i]).toFixed(2));cumulativePts.push({x:b.label,y:cum,profit:profits2[i]});});
                  const cVals=cumulativePts.map(p=>p.y);
                  const cMin=Math.min(...cVals,0),cMax=Math.max(...cVals,.01),cRng=cMax-cMin||1;
                  const cPts=cumulativePts.map((p,i)=>{
                    const x=cPadL+(i/(cumulativePts.length-1||1))*(cW-cPadL-cPadR);
                    const y=cPadT+((cMax-p.y)/cRng)*chartH;
                    return[x,y,p];
                  });
                  const cPath=cPts.length>1?"M"+cPts.map(p=>p[0]+","+p[1]).join(" L"):"";
                  const cFill=cPts.length>1?`M${cPts[0][0]},${cPadT+chartH} L`+cPts.map(p=>p[0]+","+p[1]).join(" L")+` L${cPts[cPts.length-1][0]},${cPadT+chartH} Z`:"";
                  return(<>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:10}}>
                      <div className="cg" style={{fontSize:isMobile?22:26,fontWeight:900,color:cCol}}>{totalProfit>0?"+":""}{fmt(totalProfit)}</div>
                      <div className="sy" style={{fontSize:12,color:"#000"}}>cumulative return</div>
                    </div>
                    <div style={{overflowX:"auto"}}>
                      <svg width={cW} height={cH} style={{display:"block"}}>
                        <defs>
                          <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={cCol} stopOpacity="0.2"/>
                            <stop offset="100%" stopColor={cCol} stopOpacity="0.02"/>
                          </linearGradient>
                        </defs>
                        {/* grid */}
                        {[0,.5,1].map((t,i)=><line key={i} x1={cPadL} y1={cPadT+t*chartH} x2={cW-cPadR} y2={cPadT+t*chartH} stroke="rgba(0,0,0,.06)" strokeWidth="1" strokeDasharray="3,4"/>)}
                        {cFill&&<path d={cFill} fill="url(#cg2)"/>}
                        {cPath&&<path d={cPath} fill="none" stroke={cCol} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
                        {cPts.map(([x,y,p],i)=>{
                          const dotCol=p.profit>0?C.green:p.profit<0?C.red:"#9ca3af";
                          const label=`${p.profit>0?"+":""}$${Math.abs(Math.round(p.profit))}`;
                          // Alternate label above/below to avoid collisions
                          const labelY=i%2===0?y-11:y+18;
                          return(
                            <g key={i}>
                              <circle cx={x} cy={y} r={5} fill={dotCol} stroke="#fff" strokeWidth="2"/>
                              <text x={x} y={labelY} textAnchor="middle" fontSize="9" fill={dotCol} fontFamily="system-ui" fontWeight="700">{label}</text>
                              <text x={x} y={cPadT+chartH+14} textAnchor="middle" fontSize="9" fill="#555" fontFamily="system-ui">{p.x}</text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                    {/* Summary pills */}
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:8}}>
                      {bucketData.map((b,i)=>{
                        const col2=profits2[i]>0?C.green:profits2[i]<0?C.red:"#9ca3af";
                        const hitRate2=b.total?Math.round((b.wins/b.total)*100):0;
                        return(
                          <div key={b.label} style={{flex:1,minWidth:isMobile?58:72,background:"#f8f9fa",borderRadius:8,padding:"8px 6px",textAlign:"center",border:`1px solid ${C.border}`}}>
                            <div className="sy" style={{fontSize:12,fontWeight:700,color:"#111"}}>{b.label}</div>
                            <div className="sy" style={{fontSize:12,color:col2,fontWeight:700}}>{profits2[i]>0?"+":""}{fmt(profits2[i])}</div>
                            <div className="sy" style={{fontSize:11,color:"#000"}}>{hitRate2}% hit</div>
                          </div>
                        );
                      })}
                    </div>
                  </>);
                })()}
              </div>
            )}


          </div>
        );
      })()}


      {/* Pending bets */}
      {upcomingRaces.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"2px solid #f0f7f0"}}><div className="cg" style={{fontSize:15,fontWeight:800,color:"#111"}}>📋 Upcoming Bets</div></div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {upcomingRaces.map(race=>{
              const rb=bets.filter(b=>b.raceId===race.id);
              const bal=getRaceBalance(account.id,race.id);
              return(
                <div key={race.id} className="card" style={{borderLeft:`3px solid ${bal===0?C.green:C.accent}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div className="cg" style={{fontSize:16,fontWeight:700}}>{race.name}</div>
                      <div className="sy" style={{fontSize:13,color:"#000"}}>{race.venue} · {new Date(race.date).toLocaleDateString("en-AU",{day:"numeric",month:"short"})}</div>
                    </div>
                    <span className="badge sy" style={{background:bal===0?C.greenBg:C.accentGlow,color:bal===0?C.green:C.accent,border:`1px solid ${bal===0?C.greenBd:C.accent}`,fontSize:12}}>{bal===0?"✓ Spent":"$"+bal.toFixed(2)+" left"}</span>
                  </div>
                  {rb.length>0?(
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {rb.map(b=>{
                        const td=BET_TYPES.find(t=>t.id===BASE_TYPE(b.type));
                        const isTrueBox = IS_TRUE_BOX(b.type);
                        const isBoxedStyle = IS_BOXED_TYPE(b.type);
                        const isOrdered = td && td.positions.length>1 && !isBoxedStyle && BASE_TYPE(b.type)!=="quinella";
                        const shape = MULTI_SHAPE(b.type);
                        let groups = null;
                        if (shape && td) {
                          let idx=0;
                          groups = td.positions.map((pos,i)=>{
                            const count=shape[i]||0;
                            const nums=b.horses.slice(idx,idx+count);
                            idx+=count;
                            return {label:pos.label, nums};
                          }).filter(g=>g.nums.length>0);
                        }
                        return(
                          <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,gap:8}}>
                            <div style={{minWidth:0}}>
                              <span className="sy" style={{fontSize:13,fontWeight:700}}>{td?.label}</span>
                              {isOrdered ? (
                                <div className="sy" style={{fontSize:12,color:"#000",marginTop:2,display:"flex",flexWrap:"wrap",gap:4}}>
                                  {b.horses.map((n,i)=>(
                                    <span key={i}>
                                      <strong>{td.positions[i]?.label||`${i+1}th`}</strong> #{n}{i<b.horses.length-1?" → ":""}
                                    </span>
                                  ))}
                                </div>
                              ) : groups ? (
                                <div className="sy" style={{fontSize:12,color:"#000",marginTop:2,display:"flex",flexWrap:"wrap",gap:4}}>
                                  <span style={{fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",width:"100%"}}>🎯 Multi — any combo</span>
                                  {groups.map((g,i)=>(
                                    <span key={i}>
                                      <strong>{g.label}</strong> #{g.nums.join("/#")}{i<groups.length-1?" → ":""}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="sy" style={{fontSize:13,color:"#000"}}> · {isTrueBox?"🎲 Boxed: ":""}#{b.horses.join(", #")}</span>
                              )}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                              <span className="sy" style={{fontSize:13,fontWeight:700}}>{fmt(b.stake)}</span>
                              {race.status==="upcoming"&&(
                                <button className="sy" style={{fontSize:12,padding:"3px 8px",borderRadius:5,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:700}} onClick={()=>{if(window.confirm("Cancel this bet?")) onCancelBet(b.id);}}>Cancel</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ):<p className="sy" style={{fontSize:13,color:C.red,fontWeight:600}}>⚠ No bets placed yet - must spend {fmt(bal)}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Race by race results */}
      {finishedRaces.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",marginBottom:10,paddingBottom:8,borderBottom:"2px solid #f0f7f0"}}><div className="cg" style={{fontSize:15,fontWeight:800,color:"#111"}}>✅ Race Results</div></div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {finishedRaces.map(race=>{
              const rb=bets.filter(b=>b.raceId===race.id);
              const racePayout=rb.filter(b=>b.won===true).reduce((s,b)=>s+(b.payout||0),0);
              const raceStaked=rb.reduce((s,b)=>s+b.stake,0);
              const raceProfit=parseFloat((racePayout-raceStaked).toFixed(2));
              const winner=race.horses?.find(h=>h.number===race.result?.first);
              return(
                <div key={race.id} className="card" style={{borderLeft:`3px solid ${raceProfit>=0?C.green:C.red}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:rb.length>0?8:0}}>
                    <div>
                      <div className="cg" style={{fontSize:16,fontWeight:700}}>{race.name}</div>
                      <div className="sy" style={{fontSize:13,color:"#000"}}>{race.venue} · {new Date(race.date).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}</div>
                      {winner&&<div className="sy" style={{fontSize:12,marginTop:2,color:C.accent,fontWeight:600}}>🥇 {winner.name}</div>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div className="sy" style={{fontSize:13,color:"#000"}}>Your result</div>
                      <div className="cg" style={{fontSize:18,fontWeight:700,color:raceProfit>=0?C.green:C.red}}>{raceProfit>=0?"+":""}{fmt(raceProfit)}</div>
                    </div>
                  </div>
                  {rb.length>0&&(
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {rb.map(b=>{
                        const td=BET_TYPES.find(t=>t.id===BASE_TYPE(b.type));
                        const isTrueBox = IS_TRUE_BOX(b.type);
                        const isMulti = IS_BOXED_TYPE(b.type) && !isTrueBox;
                        return(
                          <div key={b.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 10px",background:b.won===true?C.greenBg:b.won===false?C.redBg:C.surface,border:`1px solid ${b.won===true?C.greenBd:b.won===false?C.redBd:C.border}`,borderRadius:7}}>
                            <span className="sy" style={{fontSize:12}}><strong>{td?.label}</strong> · {isTrueBox?"🎲 ":isMulti?"🎯 ":""}#{b.horses.join(" → #")} · {fmt(b.stake)}</span>
                            <span className="sy" style={{fontSize:13,fontWeight:700,color:b.won===true?C.green:b.won===false?C.red:C.soft,flexShrink:0,marginLeft:8}}>
                              {b.won===true?`+${fmt(b.payout)}`:b.won===false?`-${fmt(b.stake)}`:"Pending"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {bets.length===0&&upcomingRaces.length===0&&finishedRaces.length===0&&(
        <div className="card" style={{textAlign:"center",padding:40}}>
          <div style={{fontSize:48,marginBottom:12}}>🏇</div>
          <p className="cg" style={{fontSize:20,marginBottom:6}}>No bets yet</p>
          <p className="sy" style={{fontSize:14,color:"#000"}}>Head to the Races tab to place your first bet!</p>
        </div>
      )}

      {/* Change PIN modal */}
      {showPinChange&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowPinChange(false)}>
          <div className="modal sr">
            <h3 className="cg" style={{fontSize:22,fontWeight:700,marginBottom:16}}>Change PIN</h3>
            {pinStep==="new"?(
              <>
                <p className="sy" style={{fontSize:14,color:"#000",marginBottom:14}}>Enter your new 4-digit PIN:</p>
                <PinPad value={newPin} onChange={v=>{setNewPin(v);if(v.length===4)handleNewPin();}}/>
                {pinErr&&<p className="sy" style={{color:C.red,fontSize:13,marginTop:10,textAlign:"center"}}>{pinErr}</p>}
              </>
            ):(
              <>
                <p className="sy" style={{fontSize:14,color:"#000",marginBottom:14}}>Confirm your new PIN:</p>
                <PinPad value={newPin2} onChange={handleConfirmPin}/>
                <button className="btn btn-ghost" style={{width:"100%",marginTop:10,fontSize:13}} onClick={()=>{setPinStep("new");setNewPin("");setNewPin2("");setPinErr("");}}>← Back</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- ADMIN --------------------------------------------------------------------
function AdminScreen({races, accounts, bets, adminUnlocked, setAdminUnlocked, onSettle, onScratch, onResetPin, onAddRace, onAddHorse, onAddHorses, onDeleteRace, onEditRace, onEditHorse, seasonMessage, onSeasonMessage, toast, onLockRace}) {
  const w = useWindowWidth();
  const isMobile = w < 700;
  const [inputs, setInputs] = useState({});
  const [adminPasswordEntry, setAdminPasswordEntry] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminTab, setAdminTab] = useState("races");
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [resetPinFor, setResetPinFor] = useState(null);
  const [resetPinVal, setResetPinVal] = useState("");
  const [resetPinStep, setResetPinStep] = useState("new");
  const [resetPinVal2, setResetPinVal2] = useState("");
  const [resetPinErr, setResetPinErr] = useState("");
  const [showAddRace, setShowAddRace] = useState(false);
  const [newRace, setNewRace] = useState({name:"",venue:"",date:"",distance:"",raceNum:"",raceTime:"",oddsAsOf:"",grade:"Group 1"});
  const [newRaceErr, setNewRaceErr] = useState("");
  const [addHorseFor, setAddHorseFor] = useState(null);
  const [horseForm, setHorseForm] = useState({name:"",jockey:"",trainer:"",winOdds:"",placeOdds:"",form:"",weight:"",silkUrl:""});
  const [horseErr, setHorseErr] = useState("");
  const [bulkImportFor, setBulkImportFor] = useState(null);
  const [bulkText, setBulkText] = useState("");
  const [bulkErr, setBulkErr] = useState("");
  const [bulkPreview, setBulkPreview] = useState([]);
  // Edit state
  const [editRaceFor, setEditRaceFor] = useState(null);
  const [editRaceForm, setEditRaceForm] = useState({});
  const [editHorseFor, setEditHorseFor] = useState(null); // {raceId, horseNum}
  const [editHorseForm, setEditHorseForm] = useState({});
  const [silkCheckOpen, setSilkCheckOpen] = useState(false);
  const [silkCheckResults, setSilkCheckResults] = useState(null); // null=not run, [] while running, array when done
  const [silkCheckProgress, setSilkCheckProgress] = useState({done:0,total:0});

  const runSilkCheck = () => {
    const items = [];
    races.filter(r=>r.status!=="archived"&&r.status!=="deleted").forEach(race=>{
      race.horses.forEach(h=>{
        if(h.scratched) return;
        items.push({raceId:race.id, raceName:`${race.venue} · ${race.name}`, horseNum:h.number, horseName:h.name, silkUrl:h.silkUrl||"", status: h.silkUrl?"checking":"missing"});
      });
    });
    setSilkCheckResults(items);
    setSilkCheckProgress({done:items.filter(i=>i.status!=="checking").length,total:items.length});
    items.forEach((item,idx)=>{
      if(item.status!=="checking") return;
      const img=new Image();
      img.onload=()=>{
        setSilkCheckResults(prev=>{
          const next=[...prev]; next[idx]={...next[idx],status:"ok"}; return next;
        });
        setSilkCheckProgress(p=>({...p,done:p.done+1}));
      };
      img.onerror=()=>{
        setSilkCheckResults(prev=>{
          const next=[...prev]; next[idx]={...next[idx],status:"broken"}; return next;
        });
        setSilkCheckProgress(p=>({...p,done:p.done+1}));
      };
      img.src=item.silkUrl;
    });
  };

  const handleAddRace = () => {
    if (!newRace.name.trim()) return setNewRaceErr("Race name is required.");
    if (!newRace.venue.trim()) return setNewRaceErr("Venue is required.");
    if (!newRace.date) return setNewRaceErr("Date is required.");
    if (!newRace.raceTime) return setNewRaceErr("Race time is required.");
    if (!newRace.distance.trim()) return setNewRaceErr("Distance is required.");
    const race = {
      id: `r${Date.now()}`,
      name: newRace.name.trim(),
      venue: newRace.venue.trim(),
      date: newRace.date,
      raceTime: newRace.raceTime,
      distance: newRace.distance.trim(),
      raceNum: newRace.raceNum.trim() || "Group 1",
      oddsAsOf: newRace.oddsAsOf.trim(),
      grade: newRace.grade||"Group 1",
      status: "upcoming",
      horses: [],
      result: null,
    };
    onAddRace(race);
    setNewRace({name:"",venue:"",date:"",distance:"",raceNum:"",raceTime:"",oddsAsOf:"",grade:"Group 1"});
    setNewRaceErr("");
    setShowAddRace(false);
  };

  const getInp = (raceId) => inputs[raceId] || { finishers: [null,null,null,null], divs: {} };

  // Parse bulk horse import text
  // Accepts lines like: "1. Horse Name | Jockey | Trainer | 5.00 | 1.95"
  // or simpler: "1 Horse Name J Smith T Jones 5.00 1.95"
  const parseBulkHorses = (text, existingCount) => {
    const lines = text.trim().split("\n").filter(l => l.trim());
    const horses = [];
    const errors = [];

    lines.forEach((line, i) => {
      const raw = line.trim();
      if (!raw) return;

      let num, name, jockey = "TBA", trainer = "TBA", winOdds, placeOdds, form = [], weight = "", silkUrl = "";

      // Try pipe-separated format: "1. Name (barrier) | Jockey | Trainer | 5.00 | 1.95 | form | weight | silkUrl"
      if (raw.includes("|")) {
        const parts = raw.split("|").map(p => p.trim());
        const numMatch = parts[0].match(/^(\d+)/);
        num = numMatch ? parseInt(numMatch[1]) : existingCount + horses.length + 1;
        // Strip leading number from name
        name = parts[0].replace(/^\d+[\.\):\s]+/, "").trim();
        jockey = parts[1] || "TBA";
        trainer = parts[2] || "TBA";
        winOdds = parseFloat(parts[3]);
        placeOdds = parseFloat(parts[4]);
        if (parts[5]) form = parts[5].trim().split("").filter(c=>/[0-9xXfF]/.test(c));
        if (parts[6]) weight = parts[6].trim();
        if (parts[7]) silkUrl = parts[7].trim();
      } else {
        // Try to extract from free text - look for numbers at end for odds
        const numMatch = raw.match(/^(\d+)[\.\):\s]+/);
        num = numMatch ? parseInt(numMatch[1]) : existingCount + horses.length + 1;
        const rest = numMatch ? raw.slice(numMatch[0].length) : raw;
        // Find odds at end (two decimal numbers)
        const oddsMatch = rest.match(/(\d+\.?\d*)\s+(\d+\.?\d*)\s*$/);
        if (oddsMatch) {
          winOdds = parseFloat(oddsMatch[1]);
          placeOdds = parseFloat(oddsMatch[2]);
          const beforeOdds = rest.slice(0, rest.lastIndexOf(oddsMatch[0])).trim();
          // Try J/T split
          const jMatch = beforeOdds.match(/\bJ\s+[A-Z]/i);
          const tMatch = beforeOdds.match(/\bT\s+[A-Z]/i);
          if (jMatch && tMatch) {
            const ji = beforeOdds.indexOf(jMatch[0]);
            const ti = beforeOdds.indexOf(tMatch[0]);
            name = beforeOdds.slice(0, Math.min(ji, ti)).trim();
            if (ji < ti) { jockey = beforeOdds.slice(ji, ti).trim(); trainer = beforeOdds.slice(ti).trim(); }
            else { trainer = beforeOdds.slice(ti, ji).trim(); jockey = beforeOdds.slice(ji).trim(); }
          } else {
            name = beforeOdds;
          }
        } else {
          name = rest;
        }
      }

      // Extract barrier from horse name if it contains "(N)" e.g. "Red Sentinel (2)"
      // The number in brackets = barrier, the leading number = runner number
      const barrierMatch = name.match(/\((\d+)\)\s*$/);
      let barrier = "";
      if (barrierMatch) {
        barrier = barrierMatch[1];
        name = name.replace(/\s*\(\d+\)\s*$/, "").trim();
      }
      // Remove any remaining leading number from name
      name = name.replace(/^\d+[\.\):\s]+/, "").trim();

      if (!name) { errors.push(`Line ${i+1}: couldn't read horse name`); return; }
      if (!winOdds || winOdds <= 0) { errors.push(`Line ${i+1} (${name}): missing win odds`); return; }
      if (!placeOdds || placeOdds <= 0) { errors.push(`Line ${i+1} (${name}): missing place odds`); return; }

      horses.push({
        number: num,
        name, jockey, trainer,
        winOdds, placeOdds,
        form, weight, silkUrl, barrier, scratched: false,
      });
    });

    return { horses, errors };
  };

  // eslint-disable-next-line no-unused-vars
  const toggleFinisher = (raceId, pos, horseNum) => {
    setInputs(prev => {
      const cur = getInp(raceId);
      const f = [...(cur.finishers||[null,null,null,null])];
      // If clicking same horse in same pos, deselect
      if (f[pos] === horseNum) { f[pos] = null; }
      else {
        // Remove horse from any other position first
        for (let i=0; i<4; i++) if (f[i]===horseNum) f[i]=null;
        f[pos] = horseNum;
      }
      return { ...prev, [raceId]: { ...cur, finishers: f } };
    });
  };

  const setDiv = (raceId, key, val) => {
    setInputs(prev => {
      const cur = getInp(raceId);
      return { ...prev, [raceId]: { ...cur, divs: { ...(cur.divs||{}), [key]: val } } };
    });
  };

  const settle = (raceId) => {
    const inp = getInp(raceId);
    const f = inp.finishers || [];
    if (f.filter(Boolean).length < 4) return toast("Select all 4 finishing horses", "err");
    if (!inp.divs?.win || parseFloat(inp.divs.win)<=0) return toast("Enter the Win dividend", "err");
    if (!inp.divs?.place1 || parseFloat(inp.divs.place1)<=0) return toast("Enter the 1st Place dividend", "err");
    const result = { first:f[0], second:f[1], third:f[2], fourth:f[3] };
    const dividends = {
      win:       parseFloat(inp.divs.win       || 0),
      place1:    parseFloat(inp.divs.place1    || 0),
      place2:    parseFloat(inp.divs.place2    || 0),
      place3:    parseFloat(inp.divs.place3    || 0),
      place4:    parseFloat(inp.divs.place4    || 0),
      quinella:  parseFloat(inp.divs.quinella  || 0),
      exacta:    parseFloat(inp.divs.exacta    || 0),
      trifecta:  parseFloat(inp.divs.trifecta  || 0),
      firstfour: parseFloat(inp.divs.firstfour || 0),
    };
    onSettle(raceId, result, dividends);
  };

  if (!adminUnlocked) return (
    <div className="fu" style={{maxWidth:360, margin:"60px auto"}}>
      <div className="card">
        <h2 className="cg" style={{fontSize:22, marginBottom:4}}>Admin Access</h2>
        <p className="sy soft" style={{fontSize:12, marginBottom:20}}>Enter the admin password to manage races.</p>
        <div style={{position:"relative", marginBottom:14}}>
          <input
            className="inp sy"
            type={showAdminPassword?"text":"password"}
            placeholder="Admin password"
            value={adminPasswordEntry}
            onChange={e=>setAdminPasswordEntry(e.target.value)}
            onKeyDown={e=>{
              if(e.key==="Enter"){
                if(adminPasswordEntry===ADMIN_PASSWORD) setAdminUnlocked(true);
                else { toast("Incorrect password", "err"); setAdminPasswordEntry(""); }
              }
            }}
            style={{paddingRight:44}}
            autoFocus
          />
          <button
            type="button"
            onClick={()=>setShowAdminPassword(s=>!s)}
            style={{position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", fontSize:16, color:C.muted, padding:4}}
            aria-label={showAdminPassword?"Hide password":"Show password"}
          >{showAdminPassword?"🙈":"👁️"}</button>
        </div>
        <button className="btn btn-gold" style={{width:"100%", padding:13, fontSize:14}} onClick={()=>{
          if(adminPasswordEntry===ADMIN_PASSWORD) setAdminUnlocked(true);
          else { toast("Incorrect password", "err"); setAdminPasswordEntry(""); }
        }}>Unlock →</button>
      </div>
    </div>
  );

  return (
    <div className="fu">
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
        <h2 className="cg" style={{fontSize:26, fontWeight:700}}>Admin</h2>
        <div style={{display:"flex", gap:8}}>
          <span className="badge sy" style={{background:C.greenBg, color:C.green, border:`1px solid ${C.greenBd}`}}>🔓 Active</span>
          <button className="btn btn-ghost sy" style={{fontSize:12}} onClick={() => {setAdminUnlocked(false);setAdminPasswordEntry("");}}>Lock</button>
        </div>
      </div>

      <div className="tog" style={{marginBottom:20}}>
        <button className={`topt${adminTab==="races"?" on":""}`} onClick={() => setAdminTab("races")}>Race Management</button>
        <button className={`topt${adminTab==="players"?" on":""}`} onClick={() => setAdminTab("players")}>Players ({accounts.length})</button>
      </div>

      {adminTab === "players" && (
        <div>
          {accounts.length === 0 ? (
            <div className="card" style={{textAlign:"center", padding:40}}>
              <div style={{fontSize:40, marginBottom:12}}>👥</div>
              <p className="cg" style={{fontSize:20, marginBottom:6}}>No players yet</p>
              <p className="sy soft" style={{fontSize:13}}>Players will appear here once they create an account.</p>
            </div>
          ) : (
            <div style={{display:"flex", flexDirection:"column", gap:10}}>
              {accounts.map(player => {
                const playerBets  = bets.filter(b => b.playerId === player.id);
                const activeBets  = playerBets.filter(b => b.won === null);
                const wonBets     = playerBets.filter(b => b.won === true);
                const lostBets    = playerBets.filter(b => b.won === false);
                const totalWon    = wonBets.reduce((s,b) => s + b.payout, 0);
                const totalStaked = playerBets.reduce((s,b) => s + b.stake, 0);
                const profit      = parseFloat((totalWon - totalStaked).toFixed(2));
                const isExpanded  = expandedPlayer === player.id;
                const betsByRace  = {};
                playerBets.forEach(b => { if (!betsByRace[b.raceId]) betsByRace[b.raceId] = []; betsByRace[b.raceId].push(b); });
                const racesUnbet  = races.filter(r => r.status === "upcoming" && !betsByRace[r.id]);
                return (
                  <div key={player.id} className="card" style={{borderLeft:`3px solid ${C.accent}`}}>
                    <div style={{display:"flex", alignItems:"center", gap:12, cursor:"pointer"}} onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}>
                      <div style={{width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${C.accent},#3b82f6)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:"#111", flexShrink:0}}>
                        {player.name[0].toUpperCase()}
                      </div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
                          <span className="cg" style={{fontSize:18, fontWeight:700}}>{player.name}</span>
                          {activeBets.length > 0 && <span className="badge sy" style={{background:C.blueBg, color:C.blue, border:`1px solid ${C.blueBd}`}}>{activeBets.length} pending</span>}
                          {racesUnbet.length > 0 && <span className="badge sy" style={{background:C.redBg, color:C.red, border:`1px solid ${C.redBd}`}}>{racesUnbet.length} race{racesUnbet.length>1?"s":""} unbet</span>}
                          <button className="sy" style={{fontSize:12,padding:"2px 8px",borderRadius:5,border:`1px solid ${C.border}`,background:"#f4f5f7",color:C.soft,cursor:"pointer",fontWeight:600}}
                            onClick={e=>{e.stopPropagation();setResetPinFor(player.id);setResetPinVal("");setResetPinVal2("");setResetPinStep("new");setResetPinErr("");}}>
                            🔑 Reset PIN
                          </button>
                        </div>
                        <div className="sy soft" style={{fontSize:12, marginTop:2}}>{player.email} · Joined {new Date(player.createdAt).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}</div>
                      </div>
                      <div style={{textAlign:"right", flexShrink:0}}>
                        <div className="sy soft" style={{fontSize:12, textTransform:"uppercase", letterSpacing:".08em"}}>Net profit</div>
                        <div className="cg" style={{fontSize:18, fontWeight:700, color:profit>0?C.green:profit<0?C.red:"#9ca3af"}}>{profit>0?"+":""}{fmt(profit)}</div>
                      </div>
                      <span style={{fontSize:14, color:"#000", marginLeft:4}}>{isExpanded ? "▲" : "▼"}</span>
                    </div>

                    <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8, marginTop:12, padding:"10px 0", borderTop:`1px solid ${C.border}`}}>
                      {[["Bets",playerBets.length],["Won",wonBets.length],["Lost",lostBets.length],["Pending",activeBets.length]].map(([l,v]) => (
                        <div key={l} style={{textAlign:"center"}}>
                          <div className="sy soft" style={{fontSize:12, textTransform:"uppercase", letterSpacing:".08em", marginBottom:2}}>{l}</div>
                          <div className="sy" style={{fontSize:16, fontWeight:700}}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {isExpanded && (
                      <div style={{marginTop:12}}>
                        {racesUnbet.length > 0 && (
                          <div style={{padding:"8px 12px", background:C.redBg, border:`1px solid ${C.redBd}`, borderRadius:8, marginBottom:12}}>
                            <p className="sy" style={{fontSize:12, color:C.red, fontWeight:700, marginBottom:4}}>⚠ No bets placed on:</p>
                            {racesUnbet.map(r => <p key={r.id} className="sy" style={{fontSize:12, color:C.red}}>· {r.name} ({new Date(r.date).toLocaleDateString("en-AU",{day:"numeric",month:"short"})})</p>)}
                          </div>
                        )}
                        {Object.entries(betsByRace).map(([rid, rbets]) => {
                          const race = races.find(r => r.id === rid);
                          return (
                            <div key={rid} style={{marginBottom:12}}>
                              <div style={{display:"flex", alignItems:"center", gap:8, marginBottom:6}}>
                                <span className="sy" style={{fontSize:12, fontWeight:700}}>{race?.name}</span>
                                <span className="badge sy" style={{background:race?.status==="finished"?C.greenBg:C.blueBg, color:race?.status==="finished"?C.green:C.blue, border:`1px solid ${race?.status==="finished"?C.greenBd:C.blueBd}`}}>{race?.status}</span>
                              </div>
                              {rbets.map(b => {
                                const def = BET_TYPES.find(t => t.id === BASE_TYPE(b.type));
                                const isTrueBox = IS_TRUE_BOX(b.type);
                                const isMulti = IS_BOXED_TYPE(b.type) && !isTrueBox;
                                const horses = b.horses.map(n => { const h = race?.horses.find(x => x.number===n); return `#${n} ${h?.name||""}`; }).join(" → ");
                                return (
                                  <div key={b.id} style={{display:"flex", justifyContent:"space-between", padding:"7px 10px", marginBottom:4, background:b.won===true?C.greenBg:b.won===false?C.redBg:C.surface, border:`1px solid ${b.won===true?C.greenBd:b.won===false?C.redBd:C.border}`, borderRadius:7}}>
                                    <span className="sy" style={{fontSize:12}}><strong>{def?.label}</strong> · {isTrueBox?"🎲 ":isMulti?"🎯 ":""}{horses}</span>
                                    <span className="sy" style={{fontSize:12, fontWeight:700, color:b.won===true?C.green:b.won===false?C.red:C.soft, flexShrink:0, marginLeft:10}}>
                                      {b.won===true ? `Won ${fmt(b.payout)}` : b.won===false ? `Lost ${fmt(b.stake)}` : `${fmt(b.stake)} staked`}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                        {playerBets.length === 0 && <p className="sy soft" style={{fontSize:12}}>No bets placed yet.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {adminTab === "races" && (
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:8,flexWrap:"wrap"}}>
            <p className="sy" style={{fontSize:13,color:"#000"}}>Click horses into finishing order, enter TAB dividends, then settle.</p>
            <div style={{display:"flex",gap:8,flexShrink:0}}>
              <button className="btn btn-ghost sy" style={{fontSize:12,padding:"8px 14px"}} onClick={()=>{setSilkCheckOpen(true);setSilkCheckResults(null);runSilkCheck();}}>🔍 Check Silks</button>
              <button className="btn btn-gold sy" style={{fontSize:12,padding:"8px 16px"}} onClick={()=>setShowAddRace(true)}>+ Add Race</button>
            </div>
          </div>

          {/* Race day checklist */}
          {races.filter(r=>r.status==="upcoming"||r.status==="closed").map(race=>{
            const hasHorses = race.horses.filter(h=>!h.scratched).length > 0;
            const hasOddsAsOf = !!race.oddsAsOf;
                      const steps = [
              {label:"Race added", done:true},
              {label:"Horses imported", done:hasHorses},
              {label:"Odds as of set", done:hasOddsAsOf},
              {label:"Scratching checked", done:hasOddsAsOf&&hasHorses},
            ];
            const allDone = steps.every(s=>s.done);
            return(
              <div key={race.id} className="card" style={{marginBottom:10,background:allDone?"rgba(21,128,61,.04)":"rgba(184,134,11,.04)",border:`1px solid ${allDone?C.greenBd:"rgba(184,134,11,.3)"}`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                  <span className="sy" style={{fontSize:13,fontWeight:700}}>{allDone?"✅":"📋"} {race.name} - Race Day Checklist</span>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {steps.map(step=>(
                    <span key={step.label} className="sy" style={{fontSize:12,padding:"3px 10px",borderRadius:20,background:step.done?C.greenBg:C.redBg,color:step.done?C.green:C.red,border:`1px solid ${step.done?C.greenBd:C.redBd}`,fontWeight:600}}>
                      {step.done?"✓":"✗"} {step.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Season message toggle */}
          <div className="card" style={{marginBottom:16,background:"rgba(30,92,30,.04)",border:`1px solid rgba(30,92,30,.15)`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:0}}>
                <p className="sy" style={{fontSize:13,fontWeight:700,color:C.text,marginBottom:2}}>📢 Calendar Message</p>
                <p className="sy soft" style={{fontSize:12}}>Show a message to players when no races are listed.</p>
              </div>
              <button onClick={()=>onSeasonMessage({...seasonMessage,enabled:!seasonMessage?.enabled})}
                style={{flexShrink:0,width:52,height:28,borderRadius:14,border:"none",background:seasonMessage?.enabled?C.accent:C.border,cursor:"pointer",position:"relative",transition:"background .2s"}}>
                <div style={{position:"absolute",top:3,left:seasonMessage?.enabled?26:3,width:22,height:22,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 4px rgba(0,0,0,.2)"}}/>
              </button>
            </div>
            <div style={{marginTop:12}}>
              <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:6}}>Message text</label>
              <textarea className="inp sy" rows={3}
                value={seasonMessage?.text||""}
                onChange={e=>onSeasonMessage({...seasonMessage,text:e.target.value})}
                style={{fontSize:13,resize:"none",width:"100%"}}/>
              {seasonMessage?.enabled&&<p className="sy" style={{fontSize:12,marginTop:6,color:C.green}}>✓ Message is live on the Race Calendar.</p>}
            </div>
          </div>

          {races.length===0&&(
            <div className="card" style={{textAlign:"center",padding:48}}>
              <div style={{fontSize:44,marginBottom:12}}>🏇</div>
              <h3 className="cg" style={{fontSize:22,marginBottom:6}}>No races yet</h3>
              <p className="sy soft" style={{fontSize:13,marginBottom:16}}>Add your first Group 1 race to get started.</p>
              <button className="btn btn-gold sy" style={{fontSize:13}} onClick={()=>setShowAddRace(true)}>+ Add First Race</button>
            </div>
          )}
          <div style={{display:"flex", flexDirection:"column", gap:14}}>
            {races.map(race => {
              const rb = bets.filter(b => b.raceId === race.id);
              const wb = rb.filter(b => b.won === true);
              return (
                <div key={race.id} className="card">
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12, flexWrap:"wrap"}}>
                    <div>
                      <div style={{display:"flex", gap:5, marginBottom:6}}>
                        <span className="badge sy" style={{background:C.accentGlow, color:C.accent, border:"1px solid rgba(26,86,160,.2)"}}>{race.grade}</span>
                        <span className="badge sy" style={{background:race.status==="finished"?C.greenBg:C.blueBg, color:race.status==="finished"?C.green:C.blue, border:`1px solid ${race.status==="finished"?C.greenBd:C.blueBd}`}}>{race.status}</span>
                      </div>
                      <h4 className="cg" style={{fontSize:19, fontWeight:700}}>{race.name}</h4>
                      <p className="sy soft" style={{fontSize:12, marginTop:2}}>{race.venue} · {race.distance} · {new Date(race.date).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}</p>
                      <p className="sy soft" style={{fontSize:12}}>{rb.length} bet{rb.length!==1?"s":""} placed</p>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                      {/* Quick Lock button */}
                      {race.status==="upcoming"&&(
                        <button className="sy" style={{fontSize:12,padding:"7px 14px",borderRadius:8,border:"2px solid #dc2626",background:"#dc2626",color:"#111",cursor:"pointer",fontWeight:700}}
                          onClick={()=>{ if(window.confirm(`Lock betting on "${race.name}" now? Players won't be able to place more bets.`)) onLockRace(race.id); }}>
                          🔒 Lock Betting Now
                        </button>
                      )}
                      <div style={{display:"flex",gap:6}}>
                        <button className="sy" style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"#f4f5f4",color:C.soft,cursor:"pointer",fontWeight:600}}
                          onClick={()=>{
                            const r=races.find(x=>x.id===race.id);
                            setEditRaceFor(race.id);
                            setEditRaceForm({name:r.name,venue:r.venue,date:r.date,distance:r.distance,raceNum:r.raceNum,raceTime:r.raceTime||"",oddsAsOf:r.oddsAsOf||""});
                          }}>
                          ✏️ Edit Race
                        </button>
                        {race.status !== "finished" && rb.length === 0 && (
                          <button className="sy" style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:600}}
                            onClick={()=>{ if(window.confirm(`Delete "${race.name}"? This cannot be undone.`)) onDeleteRace(race.id); }}>
                            🗑 Delete
                          </button>
                        )}
                        {race.status === "finished" && (
                          <button className="sy" style={{fontSize:12,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:600}}
                            onClick={()=>{ if(window.confirm(`Delete "${race.name}"? All bet history will be removed.`)) onDeleteRace(race.id); }}>
                            🗑 Delete
                          </button>
                        )}
                      </div>
                      {race.status === "finished" && (
                      <div className="sy" style={{textAlign:"right",fontSize:12}}>
                        <div style={{color:C.accent,fontWeight:700,marginBottom:3}}>Final Result</div>
                        {["first","second","third","fourth"].map((k,i)=>{
                          const h=race.horses.find(x=>x.number===race.result[k]);
                          return h?<div key={k} style={{color:i===0?C.accent:C.soft}}>{["1st","2nd","3rd","4th"][i]}: #{h.number} {h.name}</div>:null;
                        })}
                        {race.result?.dividends&&(
                          <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${C.border}`}}>
                            {[
                              ["Win",race.result.dividends.win],
                              ["Place 1st",race.result.dividends.place1],
                              ["Place 2nd",race.result.dividends.place2],
                              ["Place 3rd",race.result.dividends.place3],
                              ["Place 4th",race.result.dividends.place4],
                              ["Quinella",race.result.dividends.quinella],
                              ["Exacta",race.result.dividends.exacta],
                              ["Trifecta",race.result.dividends.trifecta],
                              ["First Four",race.result.dividends.firstfour],
                            ].filter(([,v])=>v&&v>0).map(([l,v])=>(
                              <div key={l} style={{color:C.green,fontSize:12}}>{l}: ${parseFloat(v).toFixed(2)}</div>
                            ))}
                          </div>
                        )}
                        {wb.length>0&&<div style={{marginTop:4,color:C.green}}>{wb.length} winner{wb.length!==1?"s":""} paid</div>}
                      </div>
                      )}
                    </div>
                  </div>
                  {(race.status === "upcoming" || race.status === "closed") && (
                    <div style={{marginTop:14}}>

                      {/* Add horses / Scratch horses */}
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <p className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".1em"}}>Horses ({race.horses.filter(h=>!h.scratched).length} active)</p>
                        <div style={{display:"flex",gap:6}}>
                          <button className="sy" style={{fontSize:12,padding:"3px 10px",borderRadius:5,border:`1px solid ${C.border}`,background:"#f4f5f7",color:C.soft,cursor:"pointer",fontWeight:600}}
                            onClick={()=>{
                              let saved="";
                              try{saved=localStorage.getItem(`bulkDraft_${race.id}`)||"";}catch(e){}
                              setBulkImportFor(race.id);setBulkText(saved);setBulkErr("");setBulkPreview([]);
                            }}>
                            📋 Bulk Import
                          </button>
                          <button className="sy" style={{fontSize:12,padding:"3px 10px",borderRadius:5,border:`1px solid ${C.accent}`,background:C.accentGlow,color:C.accent,cursor:"pointer",fontWeight:700}}
                            onClick={()=>{setAddHorseFor(race.id);setHorseForm({name:"",jockey:"",trainer:"",winOdds:"",placeOdds:""});setHorseErr("");}}>
                            + Add Horse
                          </button>
                        </div>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:race.horses.length>0?16:8}}>
                        {race.horses.length===0
                          ? <p className="sy soft" style={{fontSize:12}}>No horses added yet. Click + Add Horse to build the field.</p>
                          : race.horses.map(h=>(
                            <button key={h.number} className="sy" style={{fontSize:12,padding:"3px 9px",borderRadius:6,border:`1px solid ${h.scratched?C.redBd:C.border}`,background:h.scratched?C.redBg:"#f4f5f7",color:h.scratched?C.red:C.soft,cursor:"pointer",textDecoration:h.scratched?"line-through":"",display:"inline-flex",alignItems:"center",gap:4}}>
                              <span title={h.scratched?"Click to un-scratch":"Click to scratch"} onClick={()=>onScratch(race.id,h.number)}>#{h.number} {h.name}{h.scratched?" SCR ↺":""}</span>
                              {!h.scratched&&<span style={{color:C.accent,fontSize:12}} onClick={e=>{e.stopPropagation();setEditHorseFor({raceId:race.id,horseNum:h.number});setEditHorseForm({name:h.name,jockey:h.jockey||"",trainer:h.trainer||"",winOdds:String(h.winOdds),placeOdds:String(h.placeOdds),weight:h.weight||"",silkUrl:h.silkUrl||""});}}>✏️</span>}
                            </button>
                          ))
                        }
                      </div>

                      {/* Click-to-select finishers */}
                      <p className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>Select Finishing Order - click a horse then tap a position</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:12}}>
                        {["1st 🥇","2nd 🥈","3rd 🥉","4th"].map((label,pos)=>{
                          const finishers = getInp(race.id).finishers || [null,null,null,null];
                          const sel = finishers[pos];
                          const horse = sel ? race.horses.find(h=>h.number===sel) : null;
                          return (
                            <div key={pos} style={{textAlign:"center"}}>
                              <div className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",marginBottom:5}}>{label}</div>
                              <div style={{minHeight:52,padding:"6px 8px",border:`2px solid ${sel?C.accent:C.border}`,borderRadius:8,background:sel?"#eef3ff":"#fafbfc",cursor:"default",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                                {horse
                                  ? <><div style={{fontWeight:700,fontSize:12,color:C.accent}}>#{horse.number}</div><div className="sy" style={{fontSize:12,color:C.text}}>{horse.name}</div></>
                                  : <span className="sy soft" style={{fontSize:12}}>-</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:16}}>
                        {race.horses.filter(h=>!h.scratched).map(h=>{
                          const finishers = getInp(race.id).finishers || [];
                          const posIdx = finishers.indexOf(h.number);
                          const posLabel = posIdx>=0?["1st","2nd","3rd","4th"][posIdx]:null;
                          const posColor = posIdx===0?"#d4a017":posIdx===1?"#9ca3af":posIdx===2?"#cd7f32":C.accent;
                          return (
                            <div key={h.number} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                              {/* Horse card - tap cycles through 1st-2nd-3rd-4th-off */}
                              <button className="sy" style={{
                                width:isMobile?72:80,padding:"10px 6px",borderRadius:10,
                                border:`2.5px solid ${posLabel?posColor:C.border}`,
                                background:posLabel?`${posColor}18`:"#fff",
                                cursor:"pointer",textAlign:"center",transition:"all .13s",
                                fontFamily:"inherit",
                              }} onClick={()=>{
                                const cur = getInp(race.id).finishers||[null,null,null,null];
                                const idx = cur.indexOf(h.number);
                                if(idx>=0) {
                                  // Move to next position or clear
                                  const next = [...cur];
                                  next[idx]=null;
                                  if(idx<3) { next[idx+1]=h.number; }
                                  setInputs(p=>({...p,[race.id]:{...getInp(race.id),finishers:next}}));
                                } else {
                                  // Place in first empty slot
                                  const next = [...cur];
                                  const slot = next.indexOf(null);
                                  if(slot>=0) { next[slot]=h.number; setInputs(p=>({...p,[race.id]:{...getInp(race.id),finishers:next}})); }
                                }
                              }}>
                                {h.silkUrl&&<img src={h.silkUrl} alt="" referrerPolicy="no-referrer" style={{width:28,height:28,objectFit:"contain",marginBottom:3}} onError={e=>{e.target.style.display="none";}}/>}
                                <div className="cg" style={{fontSize:13,fontWeight:700,color:posLabel?posColor:C.text}}>#{h.number}</div>
                                <div className="sy" style={{fontSize:12,color:posLabel?posColor:C.soft,fontWeight:posLabel?700:400,marginTop:1}}>{h.name.split(" ")[0]}</div>
                              </button>
                              {/* Position badge */}
                              <span className="sy" style={{fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:20,background:posLabel?`${posColor}22`:"#f0f0f0",color:posLabel?posColor:C.muted}}>
                                {posLabel||"-"}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* TAB Dividends */}
                      <p className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>Enter TAB Dividends (actual paid prices)</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
                        {[
                          ["win",      "Win - 1st",         true],
                          ["place1",   "Place - 1st",       true],
                          ["place2",   "Place - 2nd",       false],
                          ["place3",   "Place - 3rd",       false],
                          ["place4",   "Place - 4th",       false],
                          ["quinella", "Quinella",          false],
                          ["exacta",   "Exacta",            false],
                          ["trifecta", "Trifecta",          false],
                          ["firstfour","First Four",        false],
                        ].map(([key,label,required])=>(
                          <div key={key}>
                            <label className="sy" style={{fontSize:12,display:"block",marginBottom:3,fontWeight:required?700:400,color:required?C.text:C.soft}}>
                              {label}{required?" *":""}
                            </label>
                            <div style={{position:"relative"}}>
                              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#000",pointerEvents:"none"}}>$</span>
                              <input className="inp-sm sy" type="number" step="0.01" min="0" placeholder="0.00"
                                value={getInp(race.id).divs?.[key]||""}
                                onChange={e=>setDiv(race.id,key,e.target.value)}
                                onWheel={e=>e.target.blur()}
                                style={{paddingLeft:22}}/>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{padding:"10px 14px",background:"rgba(26,86,160,.05)",border:"1px solid rgba(26,86,160,.15)",borderRadius:8,marginBottom:12}}>
                        <p className="sy soft" style={{fontSize:12}}>* Win and Place 1st are required. Only enter dividends for bet types that were actually placed on this race.</p>
                      </div>

                      {/* Pre-settlement checklist */}
                      {(()=>{
                        const raceBets = bets.filter(b=>b.raceId===race.id&&b.won===null);
                        const playersDone = [...new Set(raceBets.map(b=>b.playerId))];
                        const missingPlayers = accounts.filter(a=>!playersDone.includes(a.id));
                        const inp = getInp(race.id);
                        const hasWinDiv = parseFloat(inp.divs?.win||0)>0;
                        const hasPlace1Div = parseFloat(inp.divs?.place1||0)>0;
                        const defaultHorse = race.horses.filter(h=>!h.scratched).sort((a,b)=>a.number-b.number)[0];
                        const checks = [
                          {label:`${playersDone.length}/${accounts.length} players have bet`, done:playersDone.length===accounts.length},
                          {label:"1st place selected", done:!!inp.finishers?.[0]},
                          {label:"2nd place selected", done:!!inp.finishers?.[1]},
                          {label:"Win dividend entered", done:hasWinDiv},
                          {label:"Place dividend entered", done:hasPlace1Div},
                        ];
                        const allGood = checks.every(c=>c.done);
                        return(
                          <div style={{marginBottom:12}}>
                            <div style={{padding:"10px 14px",borderRadius:8,background:allGood?"rgba(21,128,61,.05)":"rgba(184,134,11,.05)",border:`1px solid ${allGood?C.greenBd:"rgba(184,134,11,.3)"}`,marginBottom:missingPlayers.length>0?8:0}}>
                              <div className="sy" style={{fontSize:12,fontWeight:700,marginBottom:6,color:allGood?C.green:C.gold}}>
                                {allGood?"✅ Ready to settle":"📋 Pre-settlement checklist"}
                              </div>
                              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                                {checks.map(c=>(
                                  <span key={c.label} className="sy" style={{fontSize:12,padding:"2px 8px",borderRadius:20,background:c.done?C.greenBg:C.redBg,color:c.done?C.green:C.red,border:`1px solid ${c.done?C.greenBd:C.redBd}`,fontWeight:600}}>
                                    {c.done?"✓":"✗"} {c.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {missingPlayers.length>0&&defaultHorse&&(
                              <div style={{padding:"10px 14px",borderRadius:8,background:"rgba(184,134,11,.08)",border:"1px solid rgba(184,134,11,.4)"}}>
                                <div className="sy" style={{fontSize:12,fontWeight:700,color:C.gold,marginBottom:4}}>
                                  🤖 Auto-bet will be applied to {missingPlayers.length} player{missingPlayers.length>1?"s":""}:
                                </div>
                                <div className="sy" style={{fontSize:12,color:C.text,marginBottom:4}}>
                                  <strong>$24 Win on #{defaultHorse.number} {defaultHorse.name}</strong> (horse #1 by runner number)
                                </div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                                  {missingPlayers.map(a=>(
                                    <span key={a.id} className="sy" style={{fontSize:12,padding:"2px 8px",borderRadius:20,background:"rgba(184,134,11,.15)",color:C.gold,border:"1px solid rgba(184,134,11,.3)",fontWeight:600}}>{a.name}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <button className="btn btn-gold sy" style={{fontSize:13,width:"100%",padding:14,marginTop:4}} onClick={()=>settle(race.id)}>
                        ✓ Settle Race & Pay Out
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Silk Checker modal */}
      {silkCheckOpen&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setSilkCheckOpen(false)}>
          <div className="modal sr" style={{maxWidth:600}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <h3 className="cg" style={{fontSize:20,fontWeight:700}}>🔍 Silk Checker</h3>
              <button className="btn btn-ghost sy" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>setSilkCheckOpen(false)}>Close</button>
            </div>
            <p className="sy soft" style={{fontSize:12,marginBottom:14}}>Checks every active (non-scratched) horse across all races for a missing or broken silk image.</p>

            {!silkCheckResults ? (
              <p className="sy" style={{fontSize:13,color:C.soft}}>Starting…</p>
            ) : (()=>{
              const missing = silkCheckResults.filter(i=>i.status==="missing");
              const broken = silkCheckResults.filter(i=>i.status==="broken");
              const ok = silkCheckResults.filter(i=>i.status==="ok");
              const checking = silkCheckResults.filter(i=>i.status==="checking");
              return (
                <>
                  <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                    <div style={{flex:1,minWidth:90,textAlign:"center",padding:"10px 6px",borderRadius:10,background:"#dcfce7",border:"1px solid #86efac"}}>
                      <div style={{fontSize:20,fontWeight:900,color:"#15803d"}}>{ok.length}</div>
                      <div style={{fontSize:11,fontWeight:700,color:"#15803d"}}>OK</div>
                    </div>
                    <div style={{flex:1,minWidth:90,textAlign:"center",padding:"10px 6px",borderRadius:10,background:"#fef3c7",border:"1px solid #fcd34d"}}>
                      <div style={{fontSize:20,fontWeight:900,color:"#92400e"}}>{missing.length}</div>
                      <div style={{fontSize:11,fontWeight:700,color:"#92400e"}}>Missing</div>
                    </div>
                    <div style={{flex:1,minWidth:90,textAlign:"center",padding:"10px 6px",borderRadius:10,background:"#fee2e2",border:"1px solid #fca5a5"}}>
                      <div style={{fontSize:20,fontWeight:900,color:"#b91c1c"}}>{broken.length}</div>
                      <div style={{fontSize:11,fontWeight:700,color:"#b91c1c"}}>Broken link</div>
                    </div>
                    {checking.length>0&&(
                      <div style={{flex:1,minWidth:90,textAlign:"center",padding:"10px 6px",borderRadius:10,background:"#f3f4f6",border:`1px solid ${C.border}`}}>
                        <div style={{fontSize:20,fontWeight:900,color:"#555"}}>{checking.length}</div>
                        <div style={{fontSize:11,fontWeight:700,color:"#555"}}>Checking…</div>
                      </div>
                    )}
                  </div>

                  {(missing.length>0||broken.length>0) ? (
                    <div style={{maxHeight:340,overflowY:"auto"}}>
                      {[...broken,...missing].map((item,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:8,background:item.status==="broken"?"#fef2f2":"#fffbeb",marginBottom:6}}>
                          <span style={{fontSize:11,fontWeight:800,color:item.status==="broken"?"#b91c1c":"#92400e",flexShrink:0,width:60}}>{item.status==="broken"?"Broken":"Missing"}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:"#111"}}>#{item.horseNum} {item.horseName}</div>
                            <div style={{fontSize:11,color:"#666",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.raceName}{item.silkUrl?` · ${item.silkUrl}`:""}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    checking.length===0&&<p className="sy" style={{fontSize:13,color:"#15803d",fontWeight:600}}>✓ Every active horse has a working silk image.</p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Bulk Import modal */}
      {bulkImportFor&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setBulkImportFor(null)}>
          <div className="modal sr" style={{maxWidth:560}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h3 className="cg" style={{fontSize:22,fontWeight:700}}>📋 Bulk Import Horses</h3>
              <button className="btn btn-ghost sy" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>setBulkImportFor(null)}>Close</button>
            </div>
            <p className="cg" style={{fontSize:16,fontWeight:700,marginBottom:4}}>{races.find(r=>r.id===bulkImportFor)?.name}</p>
            <p className="sy soft" style={{fontSize:12,marginBottom:10}}>Paste one horse per line in this format. Your text is auto-saved as you type, so it's safe even if you close this or refresh.</p>
            <div style={{padding:"10px 14px",background:"#f0f4ff",border:`1px solid rgba(26,86,160,.2)`,borderRadius:8,marginBottom:14,fontFamily:"monospace",fontSize:12,color:C.soft,lineHeight:1.8}}>
              1. Red Sentinel (2) | J D Gibbons | T G Ryan & S Alexiou | 15.00 | 3.60 | f6 | 58.5<br/>
              <span style={{opacity:.6}}>form, weight and silk URL (last 3 columns) are all optional</span>
            </div>
            <textarea
              className="inp sy"
              rows={isMobile?8:12}
              placeholder={"1. Sacrify | J A Bullock | T Annabel & R Archibald | 5.00 | 1.95\n2. Amplify | J C Schofield | T C Maher | 9.50 | 2.90\n3. Tambeloa | J M Fitzgerald | T K Buchanan | 7.00 | 2.40"}
              value={bulkText}
              onChange={e=>{
                setBulkText(e.target.value);
                setBulkErr("");
                setBulkPreview([]);
                try{localStorage.setItem(`bulkDraft_${bulkImportFor}`, e.target.value);}catch(err){}
              }}
              style={{marginBottom:10,fontFamily:"monospace",fontSize:isMobile?11:12,resize:"vertical",minHeight:isMobile?140:200}}
            />
            {bulkErr&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10}}>{bulkErr}</p>}

            {/* Preview */}
            {bulkPreview.length>0&&(
              <div style={{marginBottom:14}}>
                <p className="sy" style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:8}}>✓ {bulkPreview.length} horses ready to import:</p>
                <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                  {bulkPreview.map((h,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,gap:8,alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,position:"relative"}}>
                        {h.silkUrl&&<img src={h.silkUrl} alt="silk" referrerPolicy="no-referrer" style={{width:24,height:24,objectFit:"contain",borderRadius:3}} onError={e=>{e.target.style.display="none";}}/>}
                        <span className="sy"><strong>#{h.number} {h.name}</strong> <span style={{color:C.soft}}>· {h.jockey} · {h.trainer}</span></span>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                        {h.form&&h.form.length>0&&<span className="sy" style={{fontSize:13,color:"#000"}}>{h.form.slice(-6).join("-")}</span>}
                        <span className="sy" style={{color:C.accent,fontWeight:700}}>${h.winOdds.toFixed(2)} / ${h.placeOdds.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:8}}>
              {bulkPreview.length===0?(
                <button className="btn btn-gold" style={{flex:1,padding:12,fontSize:13}} onClick={()=>{
                  const race = races.find(r=>r.id===bulkImportFor);
                  const {horses,errors} = parseBulkHorses(bulkText, race.horses.length);
                  if (errors.length>0) return setBulkErr(errors.join(" · "));
                  if (horses.length===0) return setBulkErr("No horses found - check your format.");
                  setBulkPreview(horses);
                }}>Preview Import →</button>
              ):(
                <>
                  <button className="btn btn-ghost" style={{padding:12,fontSize:13}} onClick={()=>setBulkPreview([])}>← Edit</button>
                  <button className="btn btn-gold" style={{flex:1,padding:12,fontSize:13}} onClick={()=>{
                    onAddHorses(bulkImportFor, bulkPreview);
                    try{localStorage.removeItem(`bulkDraft_${bulkImportFor}`);}catch(err){}
                    setBulkImportFor(null);
                    setBulkText("");
                    setBulkPreview([]);
                  }}>✓ Import {bulkPreview.length} Horses</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Horse modal */}
      {addHorseFor&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setAddHorseFor(null)}>
          <div className="modal sr">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 className="cg" style={{fontSize:22,fontWeight:700}}>Add Horse</h3>
              <button className="btn btn-ghost sy" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>setAddHorseFor(null)}>Close</button>
            </div>
            <p className="sy soft" style={{fontSize:12,marginBottom:14}}>Adding to: <strong style={{color:C.text}}>{races.find(r=>r.id===addHorseFor)?.name}</strong></p>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
              <div>
                <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Horse Name *</label>
                <input className="inp sy" placeholder="e.g. Without A Fight" value={horseForm.name} onChange={e=>setHorseForm(p=>({...p,name:e.target.value}))}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Jockey</label>
                  <input className="inp sy" placeholder="e.g. J. McDonald" value={horseForm.jockey} onChange={e=>setHorseForm(p=>({...p,jockey:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Trainer</label>
                  <input className="inp sy" placeholder="e.g. C. Waller" value={horseForm.trainer} onChange={e=>setHorseForm(p=>({...p,trainer:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Win Odds *</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#000",pointerEvents:"none"}}>$</span>
                    <input className="inp sy" type="number" step="0.1" min="1" placeholder="4.50" value={horseForm.winOdds} onChange={e=>setHorseForm(p=>({...p,winOdds:e.target.value}))} onWheel={e=>e.target.blur()} style={{paddingLeft:22}}/>
                  </div>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Place Odds *</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:"#000",pointerEvents:"none"}}>$</span>
                    <input className="inp sy" type="number" step="0.1" min="1" placeholder="1.80" value={horseForm.placeOdds} onChange={e=>setHorseForm(p=>({...p,placeOdds:e.target.value}))} onWheel={e=>e.target.blur()} style={{paddingLeft:22}}/>
                  </div>
                </div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Weight <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
                <input className="inp sy" placeholder="e.g. 58" value={horseForm.weight||""} onChange={e=>setHorseForm(p=>({...p,weight:e.target.value}))}/>
              </div>
              <div>
                <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Recent Form <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
                <input className="inp sy" placeholder="e.g. 1x2x3x4" value={horseForm.form||""} onChange={e=>setHorseForm(p=>({...p,form:e.target.value}))}/>
              </div>
            </div>
            <div>
              <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Silk Image URL <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
              <input className="inp sy" placeholder="https://..." value={horseForm.silkUrl||""} onChange={e=>setHorseForm(p=>({...p,silkUrl:e.target.value}))}/>
            </div>
            {horseErr&&<p className="sy" style={{color:C.red,fontSize:12,marginTop:6}}>{horseErr}</p>}
            <div style={{display:"flex",gap:8,marginTop:12}}>
              <button className="btn btn-gold" style={{flex:1,padding:12,fontSize:13}} onClick={()=>{
                if(!horseForm.name.trim()) return setHorseErr("Horse name is required.");
                if(!horseForm.winOdds||parseFloat(horseForm.winOdds)<=0) return setHorseErr("Win odds are required.");
                if(!horseForm.placeOdds||parseFloat(horseForm.placeOdds)<=0) return setHorseErr("Place odds are required.");
                const race = races.find(r=>r.id===addHorseFor);
                const nextNum = race.horses.length + 1;
                const horse = {
                  number: nextNum,
                  name: horseForm.name.trim(),
                  jockey: horseForm.jockey.trim() || "TBA",
                  trainer: horseForm.trainer.trim() || "TBA",
                  winOdds: parseFloat(horseForm.winOdds),
                  placeOdds: parseFloat(horseForm.placeOdds),
                  weight: horseForm.weight.trim() || "",
                  silkUrl: horseForm.silkUrl.trim() || "",
                  form: horseForm.form ? horseForm.form.split(/[x\-,\s]+/).map(s=>s.trim()).filter(Boolean) : [],
                  scratched: false,
                };
                onAddHorse(addHorseFor, horse);
                setHorseForm({name:"",jockey:"",trainer:"",winOdds:"",placeOdds:"",form:"",weight:"",silkUrl:""});
                setHorseErr("");
              }}>Add Horse</button>
              <button className="btn btn-ghost" style={{padding:12,fontSize:13}} onClick={()=>{setAddHorseFor(null);setHorseForm({name:"",jockey:"",trainer:"",winOdds:"",placeOdds:"",form:"",weight:"",silkUrl:""});setHorseErr("");}}>Done</button>
            </div>
            <p className="sy soft" style={{fontSize:12,marginTop:10}}>You can keep adding horses one by one. Click Done when the full field is entered.</p>
          </div>
        </div>
      )}

      {/* Add Race modal */}
      {showAddRace&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowAddRace(false)}>
          <div className="modal sr">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h3 className="cg" style={{fontSize:22,fontWeight:700}}>Add New Race</h3>
              <button className="btn btn-ghost sy" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>setShowAddRace(false)}>Close</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
              <div>
                <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Race Name *</label>
                <input className="inp sy" placeholder="e.g. Turnbull Stakes" value={newRace.name} onChange={e=>setNewRace(p=>({...p,name:e.target.value}))}/>
              </div>
              <div>
                <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:6}}>Grade *</label>
                <div style={{display:"flex",gap:8}}>
                  {["Group 1","Feature Race"].map(g=>(
                    <button key={g} className="sy" style={{flex:1,padding:"10px",borderRadius:8,border:`2px solid ${newRace.grade===g?C.accent:C.border}`,background:newRace.grade===g?C.accentGlow:"#fff",color:newRace.grade===g?C.accent:C.text,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}
                      onClick={()=>setNewRace(p=>({...p,grade:g}))}>
                      {g==="Group 1"?"🏆 Group 1":"⭐ Feature Race"}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Venue *</label>
                  <input className="inp sy" placeholder="e.g. Flemington" value={newRace.venue} onChange={e=>setNewRace(p=>({...p,venue:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Date *</label>
                  <input className="inp sy" type="date" value={newRace.date} onChange={e=>setNewRace(p=>({...p,date:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Race Time (AEST) *</label>
                  <input className="inp sy" type="time" value={newRace.raceTime} onChange={e=>setNewRace(p=>({...p,raceTime:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Distance *</label>
                  <input className="inp sy" placeholder="e.g. 2000m" value={newRace.distance} onChange={e=>setNewRace(p=>({...p,distance:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Race No.</label>
                  <input className="inp sy" placeholder="e.g. Race 7" value={newRace.raceNum} onChange={e=>setNewRace(p=>({...p,raceNum:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Odds As Of <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
                  <input className="inp sy" placeholder="e.g. Thursday 10am" value={newRace.oddsAsOf} onChange={e=>setNewRace(p=>({...p,oddsAsOf:e.target.value}))}/>
                </div>
              </div>
            </div>
            {newRaceErr&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10}}>{newRaceErr}</p>}
            <p className="sy soft" style={{fontSize:12,marginBottom:14}}>Once created, you can add horses via the race card in Race Management.</p>
            <button className="btn btn-gold" style={{width:"100%",padding:13,fontSize:13}} onClick={handleAddRace}>Create Race</button>
          </div>
        </div>
      )}

      {/* Edit Race modal */}
      {editRaceFor&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setEditRaceFor(null)}>
          <div className="modal sr">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h3 className="cg" style={{fontSize:22,fontWeight:700}}>✏️ Edit Race</h3>
              <button className="btn btn-ghost sy" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>setEditRaceFor(null)}>Close</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
              <div>
                <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Race Name</label>
                <input className="inp sy" value={editRaceForm.name||""} onChange={e=>setEditRaceForm(p=>({...p,name:e.target.value}))}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Venue</label>
                  <input className="inp sy" value={editRaceForm.venue||""} onChange={e=>setEditRaceForm(p=>({...p,venue:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Date</label>
                  <input className="inp sy" type="date" value={editRaceForm.date||""} onChange={e=>setEditRaceForm(p=>({...p,date:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Race Time (AEST)</label>
                  <input className="inp sy" type="time" value={editRaceForm.raceTime||""} onChange={e=>setEditRaceForm(p=>({...p,raceTime:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Distance</label>
                  <input className="inp sy" placeholder="e.g. 2000m" value={editRaceForm.distance||""} onChange={e=>setEditRaceForm(p=>({...p,distance:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Race No.</label>
                <input className="inp sy" placeholder="e.g. Race 7" value={editRaceForm.raceNum||""} onChange={e=>setEditRaceForm(p=>({...p,raceNum:e.target.value}))}/>
              </div>
              <div>
                <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Odds As Of <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
                <input className="inp sy" placeholder="e.g. Thursday 10am" value={editRaceForm.oddsAsOf||""} onChange={e=>setEditRaceForm(p=>({...p,oddsAsOf:e.target.value}))}/>
              </div>
            </div>
            <button className="btn btn-gold" style={{width:"100%",padding:13,fontSize:14}} onClick={()=>{
              if(!editRaceForm.name?.trim()) return;
              onEditRace(editRaceFor, editRaceForm);
              setEditRaceFor(null);
            }}>Save Changes ✓</button>
          </div>
        </div>
      )}

      {/* Edit Horse modal */}
      {editHorseFor&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setEditHorseFor(null)}>
          <div className="modal sr">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h3 className="cg" style={{fontSize:22,fontWeight:700}}>✏️ Edit Horse</h3>
              <button className="btn btn-ghost sy" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>setEditHorseFor(null)}>Close</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
              <div>
                <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Horse Name</label>
                <input className="inp sy" value={editHorseForm.name||""} onChange={e=>setEditHorseForm(p=>({...p,name:e.target.value}))}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Jockey</label>
                  <input className="inp sy" value={editHorseForm.jockey||""} onChange={e=>setEditHorseForm(p=>({...p,jockey:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Trainer</label>
                  <input className="inp sy" value={editHorseForm.trainer||""} onChange={e=>setEditHorseForm(p=>({...p,trainer:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Win Odds</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#555"}}>$</span>
                    <input className="inp sy" type="number" step="0.1" value={editHorseForm.winOdds||""} onChange={e=>setEditHorseForm(p=>({...p,winOdds:e.target.value}))} onWheel={e=>e.target.blur()} style={{paddingLeft:22}}/>
                  </div>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Place Odds</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#555"}}>$</span>
                    <input className="inp sy" type="number" step="0.1" value={editHorseForm.placeOdds||""} onChange={e=>setEditHorseForm(p=>({...p,placeOdds:e.target.value}))} onWheel={e=>e.target.blur()} style={{paddingLeft:22}}/>
                  </div>
                </div>
              </div>
              <div>
                <label className="sy soft" style={{fontSize:12,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Silk Image URL <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
                <input className="inp sy" placeholder="https://..." value={editHorseForm.silkUrl||""} onChange={e=>setEditHorseForm(p=>({...p,silkUrl:e.target.value}))}/>
              </div>
            </div>
            <button className="btn btn-gold" style={{width:"100%",padding:13,fontSize:14}} onClick={()=>{
              if(!editHorseForm.name?.trim()) return;
              onEditHorse(editHorseFor.raceId, editHorseFor.horseNum, {
                name: editHorseForm.name.trim(),
                jockey: editHorseForm.jockey.trim()||"TBA",
                trainer: editHorseForm.trainer.trim()||"TBA",
                winOdds: parseFloat(editHorseForm.winOdds)||0,
                placeOdds: parseFloat(editHorseForm.placeOdds)||0,
                weight: editHorseForm.weight?.trim()||"",
                silkUrl: editHorseForm.silkUrl?.trim()||"",
              });
              setEditHorseFor(null);
            }}>Save Changes ✓</button>
          </div>
        </div>
      )}

      {/* Admin Reset PIN modal */}
      {resetPinFor&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setResetPinFor(null)}>
          <div className="modal sr">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <h3 className="cg" style={{fontSize:22,fontWeight:700}}>Reset PIN</h3>
              <button className="btn btn-ghost sy" style={{fontSize:12,padding:"5px 10px"}} onClick={()=>setResetPinFor(null)}>Close</button>
            </div>
            <p className="sy soft" style={{fontSize:13,marginBottom:16}}>
              Setting a new PIN for <strong style={{color:C.text}}>{accounts.find(a=>a.id===resetPinFor)?.name}</strong>. Let them know their new PIN once set.
            </p>
            {resetPinStep==="new"&&(
              <>
                <p className="sy" style={{fontSize:13,fontWeight:700,marginBottom:12}}>Choose a new PIN for this player:</p>
                {resetPinErr&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10,textAlign:"center"}}>{resetPinErr}</p>}
                <PinPad value={resetPinVal} onChange={v=>{setResetPinVal(v);setResetPinErr("");}}/>
                <button className="btn btn-gold" style={{width:"100%",marginTop:14,padding:12}} disabled={resetPinVal.length<4}
                  onClick={()=>{ if(resetPinVal.length<4) return; setResetPinStep("confirm"); setResetPinVal2(""); setResetPinErr(""); }}>
                  Next - Confirm →
                </button>
              </>
            )}
            {resetPinStep==="confirm"&&(
              <>
                <p className="sy" style={{fontSize:13,fontWeight:700,marginBottom:12}}>Confirm the new PIN:</p>
                {resetPinErr&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10,textAlign:"center"}}>{resetPinErr}</p>}
                <PinPad value={resetPinVal2} onChange={val=>{
                  setResetPinVal2(val);
                  if(val.length===4){
                    if(val!==resetPinVal){setResetPinErr("PINs don't match.");setResetPinVal("");setResetPinVal2("");setResetPinStep("new");return;}
                    const e=onResetPin(resetPinFor,resetPinVal);
                    if(e){setResetPinErr(e);setResetPinVal("");setResetPinVal2("");setResetPinStep("new");}
                    else{toast(`PIN reset for ${accounts.find(a=>a.id===resetPinFor)?.name}`);setResetPinFor(null);}
                  }
                }}/>
                <button className="btn btn-ghost" style={{width:"100%",marginTop:10,padding:10,fontSize:12}}
                  onClick={()=>{setResetPinStep("new");setResetPinVal("");setResetPinVal2("");setResetPinErr("");}}>
                  ← Back
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
