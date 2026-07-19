import { useState, useCallback, useEffect } from "react";

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

// Countdown hook — returns {h, m, s, urgent, expired}
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

// ─── SUPABASE ─────────────────────────────────────────────────────────────────
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

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const STARTING_BALANCE = 24.00;
const ADMIN_PIN = "7379";

// Each individual Group 1 race gets its own $24 budget per player.

// ─── RACE DATA ────────────────────────────────────────────────────────────────
// Races are added via the Admin panel
const INITIAL_RACES = [];

// ─── BET TYPES: Win, Place, Trifecta, First Four only ────────────────────────
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
    id:"eachway", label:"Each Way", desc:"Win + Place — costs 2× your stake",
    positions:[{label:"Horse",key:"horse"}],
    check:(horses,res) => horses[0]===res.first || [res.first,res.second,res.third].includes(horses[0]),
    multiplier:(horses,om) => (om[horses[0]]?.winOdds||0) + (om[horses[0]]?.placeOdds||0),
    eachway: true,
  },
  {
    id:"quinella", label:"Quinella", desc:"Pick 2 horses to finish 1st & 2nd — any order",
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

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getOddsMap = horses => Object.fromEntries(horses.map(h=>[h.number,h]));
const fmt = v => `$${Math.abs(parseFloat(v)).toFixed(2)}`;
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
function RaceCountdown({date, time}) {
  const r = useCountdown(date, time);
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
  bg:"#f0f2f0",        // soft off-white with a hint of green
  card:"#ffffff",
  surface:"#f7f8f7",
  header:"#1a3a1a",   // deep racing green for header

  // Borders
  border:"#d4dbd4",
  borderMid:"#b8c4b8",

  // Primary accent — racing green
  accent:"#1e5c1e",
  accentL:"#2d7a2d",
  accentGlow:"rgba(30,92,30,0.08)",
  accentSoft:"rgba(30,92,30,0.05)",

  // Gold — for winners, highlights
  gold:"#b8860b",
  goldL:"#d4a017",
  goldBg:"rgba(184,134,11,0.08)",
  goldBd:"rgba(184,134,11,0.3)",

  // Status colours
  green:"#15803d",  greenBg:"rgba(21,128,61,0.08)",  greenBd:"rgba(21,128,61,0.3)",
  red:"#b91c1c",    redBg:"rgba(185,28,28,0.07)",    redBd:"rgba(185,28,28,0.3)",
  blue:"#1d4ed8",   blueBg:"rgba(29,78,216,0.07)",   blueBd:"rgba(29,78,216,0.25)",

  // Text
  text:"#111111",    // near-black — maximum readability
  soft:"#333333",    // dark grey — still clearly readable
  muted:"#666666",   // medium grey — for placeholders only
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

/* Inputs — large and clear */
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

/* ── RESPONSIVE ── */
@media(max-width:640px){
  .desktop-nav{display:none!important}
  .mobile-nav{display:flex!important}
  .mobile-hide{display:none!important}
  .card{padding:14px;border-radius:10px}
  .surface{padding:10px}
  .modal{border-radius:20px 20px 0 0;padding:20px 16px 40px;max-height:92vh}
  .btn{font-size:15px;padding:13px 18px}
  .inp{font-size:16px;padding:12px 14px}
  .inp-sm{font-size:14px;padding:8px 10px}
  h2.cg{font-size:20px!important}
  h3.cg{font-size:17px!important}
  h4.cg{font-size:15px!important}
  .badge{font-size:11px;padding:4px 9px}
  .hrow{padding:8px 10px!important}
}
@media(min-width:641px){
  .desktop-nav{display:flex!important}
  .mobile-nav{display:none!important}
  .modal-bg{align-items:center;padding:16px}
  .modal{border-radius:16px;padding:28px;max-width:540px;max-height:90vh}
}
@media(min-width:641px) and (max-width:900px){
  .card{padding:16px}
}
`;

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [accounts, setAccounts] = useState([]);
  const [session, setSession] = useState(null);
  const [races, setRaces] = useState(INITIAL_RACES);
  const [bets, setBets] = useState([]);
  const [screen, setScreen] = useState("auth");
  const [raceId, setRaceId] = useState(null);
  const [toast, setToast] = useState(null);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [showBetslip, setShowBetslip] = useState(false);
  const [pendingBets, setPendingBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seasonMessage, setSeasonMessage] = useState(() => {
    try {
      const saved = localStorage.getItem("sc_season_msg");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { enabled: false, text: "No races have been added yet. Check back soon — the season is coming! 🏇" };
  });
  const [resultsBanner, setResultsBanner] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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

        // Load season message — Supabase overrides localStorage
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

        // Load races from Supabase — these include all admin-added races
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
    } catch(e) { showToast("Refresh failed — check connection", "err"); }
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

  // Poll Supabase every 30s — keeps all clients in sync and catches failed saves
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
  const queueBet = (raceId, type, horses, stake) => {
    const race = races.find(r=>r.id===raceId);
    const om = getOddsMap(race.horses);
    const def = BET_TYPES.find(t=>t.id===type);
    const mult = def.multiplier(horses,om);
    const potential = parseFloat((stake*mult).toFixed(2));
    setPendingBets(p=>[...p,{id:Date.now().toString(),raceId,type,horses,stake,potential,mult}]);
    setShowBetslip(true);
  };

  // CONFIRM BETSLIP
  const confirmBetslip = () => {
    if (!liveAccount) return;
    // Validate each race's budget independently
    const betsByRace = {};
    for (const b of pendingBets) {
      if (!betsByRace[b.raceId]) betsByRace[b.raceId] = [];
      betsByRace[b.raceId].push(b);
    }
    for (const [rid, rBets] of Object.entries(betsByRace)) {
      const available = getRaceBalance(liveAccount.id, rid);
      const pendingForRace = rBets.reduce((s, b) => s + b.stake, 0);
      if (pendingForRace > available) {
        const race = races.find(r => r.id === rid);
        return showToast(`${race?.name}: only ${fmt(available)} remaining for this race`, "err");
      }
    }
    const now = Date.now();
    const confirmed = pendingBets.map((b,i)=>({
      ...b, id:(now+i).toString(),
      playerId:liveAccount.id,
      won:null, payout:null,
      placedAt:new Date().toISOString(),
    }));
    setBets(p=>[...p,...confirmed]);
    const total = pendingBets.reduce((s,b)=>s+b.stake,0);
    updateAccount(liveAccount.id, a=>({
      totalStaked:parseFloat((a.totalStaked+total).toFixed(2)),
    }));
    // Save bets to Supabase
    if (liveAccount) {
      confirmed.forEach(b => sb.insert("bets", {
        id: b.id, player_id: b.playerId, race_id: b.raceId,
        type: b.type, horses: JSON.stringify(b.horses),
        stake: b.stake, potential: b.potential,
        won: null, payout: null, placed_at: b.placedAt,
      }));
    }
    setPendingBets([]);
    setShowBetslip(false);
    showToast(`${confirmed.length} bet${confirmed.length>1?"s":""} placed! Total: ${fmt(total)}`);
  };

  const removePending = id => setPendingBets(p=>p.filter(b=>b.id!==id));

  // SETTLE RACE — uses actual TAB dividends entered by admin
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

    // Payout calculator using real dividends
    const calcDividendPayout = (bet) => {
      const { type, horses, stake } = bet;
      const { first, second, third } = result;
      const d = dividends;
      if (type === "win")   return parseFloat((stake * (d.win || 0)).toFixed(2));
      if (type === "place") {
        const placeDiv = horses[0]===first ? d.place1 : horses[0]===second ? d.place2 : horses[0]===third ? d.place3 : 0;
        return parseFloat((stake * (placeDiv || 0)).toFixed(2));
      }
      if (type === "eachway") {
        const winDiv   = horses[0]===first ? (d.win || 0) : 0;
        const placeDiv = horses[0]===first ? d.place1 : horses[0]===second ? d.place2 : horses[0]===third ? d.place3 : 0;
        return parseFloat((stake * (winDiv + (placeDiv || 0))).toFixed(2));
      }
      if (type === "exacta")    return parseFloat((stake * (d.exacta    || 0)).toFixed(2));
      if (type === "trifecta")  return parseFloat((stake * (d.trifecta  || 0)).toFixed(2));
      if (type === "firstfour") return parseFloat((stake * (d.firstfour || 0)).toFixed(2));
      // quinella — use exacta div / 2 as fallback if no quinella div entered
      if (type === "quinella")  return parseFloat((stake * (d.quinella  || (d.exacta ? d.exacta/2 : 0))).toFixed(2));
      return 0;
    };

    let wins=0, paid=0;
    const allBetsForRace = [...bets, ...autoBets];
    const settled = allBetsForRace.map(b=>{
      if (b.raceId!==raceId||b.won!==null) return b;
      const def = BET_TYPES.find(t=>t.id===b.type);
      const won = def.check(b.horses, result);
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
    mergedBets.filter(b=>b.raceId===raceId&&b.won===true).forEach(b=>{
      updateAccount(b.playerId,a=>({
        totalWon:parseFloat((a.totalWon+b.payout).toFixed(2)),
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
          const def = BET_TYPES.find(t=>t.id===b.type);
          const horseLine = b.horses.map(n=>{const h=race.horses.find(x=>x.number===n); return `#${n} ${h?.name||""}`; }).join(" → ");
          return `${b.won?"✅":"❌"} ${def?.label}: ${horseLine} — Staked ${fmt(b.stake)}${b.won?` | Won ${fmt(b.payout)}`:" | Lost"}`;
        }).join("\n");

        emailjs.send(
          "YOUR_SERVICE_ID",       // ← replace with your EmailJS Service ID
          "YOUR_TEMPLATE_ID",      // ← replace with your EmailJS Template ID
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
            net_result: totalWon > 0 ? `🎉 You won ${fmt(totalWon)}!` : `Better luck next race!`,
            leaderboard_url: window.location.href,
          },
          "YOUR_PUBLIC_KEY"        // ← replace with your EmailJS Public Key
        ).catch(()=>{/* silent fail — email is best-effort */});
      });
    }

    showToast(`Race settled — ${wins} winner${wins!==1?"s":""}, ${fmt(paid)} paid out`);

    // Show results banner for the logged-in player
    const myWins = settled.filter(b => b.playerId === session && b.won === true);
    setResultsBanner({ raceName: races.find(r=>r.id===raceId)?.name, myWins: myWins.length, myPayout: myWins.reduce((s,b)=>s+(b.payout||0),0) });
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
      showToast("Race archived — removed from calendar, history kept");
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
    showToast("Bet cancelled — your budget has been refunded");
  };

  const [scratchAlert, setScratchAlert] = useState(null); // {horseName, raceName, affectedBets}

  const scratchHorse = (raceId, num) => {
    const race = races.find(r=>r.id===raceId);
    const horse = race?.horses.find(h=>h.number===num);
    const updatedHorses = race.horses.map(h=>h.number===num?{...h,scratched:true}:h);
    setRaces(p=>p.map(r=>r.id!==raceId?r:{...r,horses:updatedHorses}));
    // Save to Supabase
    sb.update("races", raceId, { horses: updatedHorses });
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
    const profitA = a.totalWon - a.totalStaked;
    const profitB = b.totalWon - b.totalStaked;
    return profitB - profitA;
  });

  // Track position movements — save current positions to localStorage and compare
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

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",width:"100%"}}>
      <style>{CSS}</style>

      {loading&&(
        <div style={{position:"fixed",inset:0,background:`linear-gradient(160deg,${C.header} 0%,#2d5a2d 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999}}>
          <div style={{fontSize:56,marginBottom:16}}>🏇</div>
          <h2 className="cg" style={{fontSize:32,fontWeight:900,color:"#fff",marginBottom:10}}>Spring Carnival</h2>
          <p className="sy" style={{fontSize:15,color:"rgba(255,255,255,.7)"}}>Loading...</p>
        </div>
      )}

      {scratchAlert&&(
        <div className="modal-bg" onClick={()=>setScratchAlert(null)}>
          <div className="modal sr" onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:48,marginBottom:8}}>⚠️</div>
              <h3 className="cg" style={{fontSize:22,fontWeight:700,color:C.red,marginBottom:6}}>Horse Scratched!</h3>
              <p className="sy" style={{fontSize:15,fontWeight:700,marginBottom:4}}>{scratchAlert.horseName} has been scratched from {scratchAlert.raceName}</p>
              <p className="sy" style={{fontSize:13,color:C.soft}}>The following players have active bets that include this horse:</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
              {scratchAlert.affectedPlayers.map(name=>{
                const playerBets = scratchAlert.affectedBets.filter(b=>accounts.find(a=>a.id===b.playerId)?.name===name);
                return (
                  <div key={name} style={{padding:"10px 14px",background:C.redBg,border:`1px solid ${C.redBd}`,borderRadius:8}}>
                    <div className="sy" style={{fontSize:14,fontWeight:700,color:C.red,marginBottom:4}}>🚨 {name}</div>
                    {playerBets.map(b=>{
                      const td=BET_TYPES.find(t=>t.id===b.type);
                      return <div key={b.id} className="sy" style={{fontSize:12,color:C.soft}}>{td?.label} · #{b.horses.join(" → #")} · {fmt(b.stake)}</div>;
                    })}
                  </div>
                );
              })}
            </div>
            <p className="sy" style={{fontSize:12,color:C.soft,marginBottom:14,textAlign:"center"}}>These players will see a red alert on their race card and should update their bets before betting closes.</p>
            <button className="btn btn-gold" style={{width:"100%",padding:13,fontSize:14}} onClick={()=>setScratchAlert(null)}>Got it</button>
          </div>
        </div>
      )}

      {showConfetti&&<Confetti/>}

      {/* Results banner */}
      {resultsBanner&&(
        <div style={{position:"fixed",top:72,left:16,right:16,zIndex:9990,maxWidth:520,margin:"0 auto",background:resultsBanner.myWins>0?"rgba(21,128,61,.97)":"rgba(30,92,30,.95)",borderRadius:14,padding:"16px 20px",boxShadow:"0 8px 40px rgba(0,0,0,.25)",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,animation:"notif .3s ease"}}>
          <div>
            <div className="sy" style={{fontSize:15,fontWeight:800,color:"#fff"}}>
              {resultsBanner.myWins>0?`🎉 You won on ${resultsBanner.raceName}!`:`📋 ${resultsBanner.raceName} has been settled`}
            </div>
            {resultsBanner.myWins>0&&<div className="sy" style={{fontSize:13,color:"rgba(255,255,255,.85)",marginTop:2}}>+{fmt(resultsBanner.myPayout)} — check My Bets for details</div>}
            {resultsBanner.myWins===0&&<div className="sy" style={{fontSize:13,color:"rgba(255,255,255,.75)",marginTop:2}}>Check My Bets to see the results</div>}
          </div>
          <button onClick={()=>setResultsBanner(null)} style={{background:"none",border:"none",color:"rgba(255,255,255,.7)",fontSize:22,cursor:"pointer",flexShrink:0,lineHeight:1}}>×</button>
        </div>
      )}

      {toast&&(
        <div style={{position:"fixed",top:72,right:16,left:16,zIndex:9999,padding:"14px 18px",borderRadius:12,background:toast.type==="err"?"rgba(254,242,242,.98)":"rgba(240,253,244,.98)",border:`1px solid ${toast.type==="err"?C.redBd:C.greenBd}`,color:toast.type==="err"?C.red:C.green,animation:"notif .28s ease",fontSize:14,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",backdropFilter:"blur(16px)",boxShadow:"0 8px 40px rgba(0,0,0,.15)",fontWeight:600,maxWidth:480,margin:"0 auto"}}>
          {toast.msg}
        </div>
      )}

      {screen!=="auth"&&(
        <>
          {/* ── HEADER ── */}
          <header style={{background:C.header,padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:62,position:"sticky",top:0,zIndex:500,boxShadow:"0 3px 16px rgba(0,0,0,.3)"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span className="cg" style={{fontSize:19,fontWeight:900,color:"#fff",whiteSpace:"nowrap"}}>🏇 Spring Carnival</span>
              {/* Desktop nav */}
              <nav className="desktop-nav" style={{display:"flex",gap:2}}>
                {[["lobby","Races"],["leaderboard","Leaderboard"],["mybets","My Bets"],["admin","Admin"]].map(([s,l])=>(
                  <button key={s} className={`tab${screen===s||(screen==="race"&&s==="lobby")?" on":""}`} onClick={()=>setScreen(s)}>{l}</button>
                ))}
              </nav>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {pendingBets.length>0&&(
                <button className="sy" style={{fontSize:13,padding:"7px 12px",background:"rgba(255,255,255,.15)",border:"1.5px solid rgba(255,255,255,.3)",borderRadius:8,color:"#fff",cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:6}} onClick={()=>setShowBetslip(true)}>
                  🎫 <span style={{background:C.goldL,color:"#fff",borderRadius:"50%",width:20,height:20,display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800}}>{pendingBets.length}</span>
                </button>
              )}
              {liveAccount&&(
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span className="sy mobile-hide" style={{fontSize:13,color:"rgba(255,255,255,.85)"}}>Hi, <strong style={{color:"#fff"}}>{liveAccount.name}</strong></span>
                  <button className="sy" style={{fontSize:12,padding:"6px 10px",background:"rgba(255,255,255,.12)",border:"1.5px solid rgba(255,255,255,.25)",borderRadius:8,color:"rgba(255,255,255,.85)",cursor:"pointer",fontWeight:600}} onClick={manualRefresh}>↻</button>
                  <button className="sy" style={{fontSize:12,padding:"6px 10px",background:"rgba(255,255,255,.12)",border:"1.5px solid rgba(255,255,255,.25)",borderRadius:8,color:"rgba(255,255,255,.85)",cursor:"pointer",fontWeight:600}} onClick={doLogout}>Log out</button>
                </div>
              )}
            </div>
          </header>

          {/* ── MOBILE BOTTOM NAV ── */}
          <nav className="mobile-nav" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:500,background:C.header,borderTop:"1px solid rgba(255,255,255,.12)",display:"flex",boxShadow:"0 -2px 20px rgba(0,0,0,.3)",paddingBottom:"max(env(safe-area-inset-bottom, 12px), 12px)"}}>
            {[["lobby","Races"],["leaderboard","Leaderboard"],["mybets","My Bets"],["admin","Admin"]].map(([s,l])=>{
              const active = screen===s||(screen==="race"&&s==="lobby");
              return (
                <button key={s} onClick={()=>setScreen(s)}
                  style={{flex:1,padding:"14px 4px 12px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"transparent",border:"none",cursor:"pointer",position:"relative",transition:"all .15s",minHeight:56}}>
                  {active&&<div style={{position:"absolute",top:0,left:"15%",right:"15%",height:3,background:C.goldL,borderRadius:"0 0 3px 3px"}}/>}
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
          ⚠️ You're offline — bets cannot be placed until you reconnect
        </div>
      )}

      {screen==="auth"&&<AuthScreen onRegister={doRegister} onLogin={doLogin} accounts={accounts}/>}

      {screen!=="auth"&&<main style={{maxWidth:1100,margin:"0 auto",padding:`${isOffline?54:18}px ${window.innerWidth<641?"12px":"20px"} 120px`}}>
        {screen==="lobby"&&<LobbyScreen races={races.filter(r=>r.status!=="archived"&&r.status!=="deleted")} bets={bets} account={liveAccount} leaderboard={leaderboard} getRaceBalance={getRaceBalance} onSelect={id=>{setRaceId(id);setScreen("race");}} seasonMessage={seasonMessage} accounts={accounts}/>}
        {screen==="race"&&selectedRace&&<RaceScreen race={selectedRace} account={liveAccount} bets={bets} getRaceBalance={getRaceBalance} myBets={bets.filter(b=>b.raceId===raceId&&b.playerId===liveAccount?.id)} onBack={()=>setScreen("lobby")} onQueue={queueBet} onCancelBet={cancelBet}/>}
        {screen==="leaderboard"&&<LeaderboardScreen accounts={leaderboard} bets={bets} races={races} getMovement={getMovement} myAccount={liveAccount}/>}
        {screen==="mybets"&&<MyBetsScreen account={liveAccount} bets={bets.filter(b=>b.playerId===liveAccount?.id)} races={races} getRaceBalance={getRaceBalance} onChangePin={doChangePin} onCancelBet={cancelBet}/>}
        {screen==="admin"&&<AdminScreen races={races} accounts={accounts} bets={bets} adminUnlocked={adminUnlocked} setAdminUnlocked={setAdminUnlocked} onSettle={settleRace} onScratch={scratchHorse} onResetPin={doAdminResetPin} onAddRace={addRace} onAddHorse={addHorseToRace} onAddHorses={addHorsesToRace} onDeleteRace={deleteRace} onEditRace={editRace} onEditHorse={editHorse} seasonMessage={seasonMessage} onSeasonMessage={(next)=>{
          setSeasonMessage(next);
          localStorage.setItem("sc_season_msg", JSON.stringify(next));
          sb.upsert("settings", { key: "season_message", value: next });
        }} toast={showToast} onLockRace={id=>{editRace(id,{status:"closed"});showToast("Betting locked 🔒");}}/>}
      </main>}

      {showBetslip&&(
        <BetslipModal pendingBets={pendingBets} races={races} account={liveAccount} getRaceBalance={getRaceBalance} onRemove={removePending} onConfirm={confirmBetslip} onClose={()=>setShowBetslip(false)}/>
      )}
    </div>
  );
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
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
      <p className="sy" style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:12}}>You can also type your PIN using the keyboard</p>
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
  const handleLoginPin = val => {
    setPin(val); setErr("");
    if (val.length === 4) { const e = onLogin(val); if (e) { setErr(e); setPin(""); } }
  };
  const handleForgotPin = () => {
    const acc = accounts.find(a=>a.email.toLowerCase()===fpEmail.toLowerCase().trim());
    if (!acc) return setFpMsg("No account found with that email address.");
    setFpMsg(`Your PIN starts with ${acc.pin[0]}••• — if you still can't remember, ask the organiser to reset it for you in the Admin panel.`);
  };

  if (forgotPin) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:`linear-gradient(160deg,${C.header} 0%,#2d5a2d 50%,#1a3a1a 100%)`}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:52,marginBottom:8}}>🏇</div>
          <h1 className="cg" style={{fontSize:40,fontWeight:900,color:"#fff"}}>Spring Carnival</h1>
        </div>
        <div className="card fu">
          <h3 className="cg" style={{fontSize:24,marginBottom:6}}>Forgot your PIN?</h3>
          <p className="sy" style={{fontSize:14,color:C.soft,marginBottom:16}}>Enter the email address you signed up with and we'll give you a hint.</p>
          <input className="inp sy" type="email" placeholder="Your email address" value={fpEmail} onChange={e=>{setFpEmail(e.target.value);setFpMsg("");}} onKeyDown={e=>e.key==="Enter"&&handleForgotPin()} style={{marginBottom:10}}/>
          {fpMsg&&(
            <div style={{padding:"12px 16px",background:fpMsg.includes("No account")?C.redBg:C.greenBg,border:`1px solid ${fpMsg.includes("No account")?C.redBd:C.greenBd}`,borderRadius:10,marginBottom:12}}>
              <p className="sy" style={{fontSize:14,color:fpMsg.includes("No account")?C.red:C.green}}>{fpMsg}</p>
            </div>
          )}
          <button className="btn btn-gold" style={{width:"100%",padding:14,fontSize:15,marginBottom:10}} onClick={handleForgotPin}>Get PIN Hint →</button>
          <button className="btn btn-ghost" style={{width:"100%",padding:12,fontSize:14}} onClick={()=>setForgotPin(false)}>← Back to Sign In</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,background:`linear-gradient(160deg,${C.header} 0%,#2d5a2d 50%,#1a3a1a 100%)`}}>
      <div style={{width:"100%",maxWidth:520}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:60,marginBottom:8}}>🏇</div>
          <h1 className="cg" style={{fontSize:52,fontWeight:900,color:"#fff",lineHeight:1.05}}>Spring Carnival</h1>
          <p className="sy" style={{fontSize:13,marginTop:10,color:"rgba(255,255,255,.7)",letterSpacing:".16em",textTransform:"uppercase"}}>GROUP 1 COMPETITION</p>
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
                    <p className="sy" style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:4}}>Welcome back!</p>
                    <p className="sy soft" style={{fontSize:12}}>Enter the name you signed up with.</p>
                  </div>
                  {err&&(
                    <div style={{padding:"10px 14px",background:C.redBg,border:`1px solid ${C.redBd}`,borderRadius:8,marginBottom:12,textAlign:"center"}}>
                      <p className="sy" style={{color:C.red,fontSize:12}}>{err}</p>
                      {err.includes("No account")&&<p className="sy" style={{fontSize:11,color:C.soft,marginTop:4}}>Haven't signed up? <button className="sy" style={{background:"none",border:"none",color:C.accent,fontWeight:700,cursor:"pointer",fontSize:11,textDecoration:"underline"}} onClick={()=>resetAll("register")}>Create an account →</button></p>}
                    </div>
                  )}
                  <input className="inp sy" placeholder="Your full name" value={name} onChange={e=>{setName(e.target.value);setErr("");}} onKeyDown={e=>{if(e.key==="Enter"){const found=accounts.find(a=>a.name.toLowerCase()===name.toLowerCase().trim());if(!found){setErr("No account found with that name.");}else{setErr("");setStep("pin");setPin("");}}}} style={{marginBottom:10}}/>
                  <button className="btn btn-gold" style={{width:"100%",padding:13,fontSize:13}} onClick={()=>{
                    const found = accounts.find(a=>a.name.toLowerCase()===name.toLowerCase().trim());
                    if(!found) return setErr("No account found with that name.");
                    setErr(""); setStep("pin"); setPin("");
                  }}>Next — Enter PIN →</button>
                  <div style={{display:"flex",justifyContent:"space-between",marginTop:14}}>
                    <button className="sy" style={{background:"none",border:"none",color:C.soft,cursor:"pointer",fontSize:11,textDecoration:"underline"}} onClick={()=>setForgotPin(true)}>Forgot PIN?</button>
                    <button className="sy" style={{background:"none",border:"none",color:C.accent,fontWeight:700,cursor:"pointer",fontSize:11,textDecoration:"underline"}} onClick={()=>resetAll("register")}>New? Create account →</button>
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
                    <button className="sy" style={{background:"none",border:"none",color:C.soft,cursor:"pointer",fontSize:11,textDecoration:"underline"}} onClick={()=>setForgotPin(true)}>Forgot PIN?</button>
                    <button className="sy" style={{background:"none",border:"none",color:C.soft,cursor:"pointer",fontSize:11,textDecoration:"underline"}} onClick={()=>{setStep("details");setPin("");setErr("");}}>← Back</button>
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
                    <input className="inp sy" type="email" placeholder="Email address" value={email} onChange={e=>{setEmail(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&handleDetailsNext()}/>
                  </div>
                  {err&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10}}>{err}</p>}
                  <button className="btn btn-gold" style={{width:"100%",padding:13,fontSize:13}} onClick={handleDetailsNext}>Next — Choose PIN →</button>
                  <div style={{marginTop:14,padding:"10px 14px",background:"rgba(26,86,160,.06)",border:"1px solid rgba(26,86,160,.15)",borderRadius:8}}>
                    <p className="sy" style={{fontSize:12,color:C.soft}}>🎯 You <strong style={{color:C.accent}}>must spend $24.00</strong> on each individual Group 1 race — every race has its own $24 budget.</p>
                  </div>
                </>
              )}
              {step==="pin"&&(
                <>
                  <div style={{textAlign:"center",marginBottom:12}}>
                    <p className="sy" style={{fontSize:14,fontWeight:700,marginBottom:4}}>Choose your 4-digit PIN</p>
                    <p className="sy soft" style={{fontSize:12}}>Choose something memorable — a birthday, lucky number, jersey number etc.</p>
                  </div>
                  {err&&(
                    <div style={{padding:"10px 14px",background:C.redBg,border:`1px solid ${C.redBd}`,borderRadius:8,marginBottom:12,textAlign:"center"}}>
                      <p className="sy" style={{color:C.red,fontSize:12}}>{err}</p>
                    </div>
                  )}
                  <PinPad value={pin} onChange={v=>{setPin(v);setErr("");}}/>
                  <button className="btn btn-gold" style={{width:"100%",marginTop:14,padding:13,fontSize:13}} disabled={pin.length<4} onClick={handlePinNext}>Next — Confirm PIN →</button>
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


// ─── LOBBY ────────────────────────────────────────────────────────────────────
function LobbyScreen({races,bets,account,leaderboard,getRaceBalance,onSelect,seasonMessage,accounts}) {
  const w = useWindowWidth();
  const isMobile = w < 700;
  const myBets = bets.filter(b=>b.playerId===account?.id);
  const grouped={};
  races.forEach(r=>{if(!grouped[r.date])grouped[r.date]=[];grouped[r.date].push(r);});
  const upcoming = races.filter(r=>r.status==="upcoming").length;
  const finished = races.filter(r=>r.status==="finished").length;

  return (
    <div className="fu" style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 240px",gap:20,alignItems:"start"}}>
      <div>
        {/* Page header */}
        <div style={{marginBottom:isMobile?16:24}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
            <h2 className="cg" style={{fontSize:isMobile?22:32,fontWeight:800,letterSpacing:"-.5px"}}>Race Calendar</h2>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {upcoming>0&&<span className="sy" style={{fontSize:11,fontWeight:700,color:C.accent,background:C.accentGlow,padding:"3px 10px",borderRadius:20,border:`1px solid ${C.accent}`}}>{upcoming} upcoming</span>}
              {finished>0&&<span className="sy" style={{fontSize:11,fontWeight:600,color:C.soft,background:"#f4f5f7",padding:"3px 10px",borderRadius:20,border:`1px solid ${C.border}`}}>{finished} finished</span>}
            </div>
          </div>
          {account&&<p className="sy" style={{fontSize:isMobile?12:13,color:C.soft}}>Welcome back, <strong style={{color:C.text}}>{account.name}</strong></p>}
        </div>

        {/* Season message */}
        {(races.length===0||seasonMessage?.enabled)&&(
          <div style={{padding:isMobile?"28px 20px":"44px 36px",borderRadius:16,background:"linear-gradient(135deg, #1a3a1a 0%, #2d5a2d 100%)",marginBottom:24,textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:12}}>🏇</div>
            <h3 className="cg" style={{fontSize:isMobile?18:24,fontWeight:700,marginBottom:8,color:"#fff"}}>
              {seasonMessage?.text||"No races yet — the season is coming!"}
            </h3>
          </div>
        )}

        {Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([date,dayRaces])=>(
          <div key={date} style={{marginBottom:isMobile?16:24}}>
            {/* Date divider */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <div style={{height:1,flex:1,background:"linear-gradient(to right, transparent, #e5e7eb)"}}/>
              <span className="sy" style={{fontSize:isMobile?10:11,color:C.soft,textTransform:"uppercase",letterSpacing:".12em",whiteSpace:"nowrap",fontWeight:600}}>
                {new Date(date+"T12:00:00").toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
              </span>
              <div style={{height:1,flex:1,background:"linear-gradient(to left, transparent, #e5e7eb)"}}/>
            </div>

            {dayRaces.map(race=>{
              const rb=myBets.filter(b=>b.raceId===race.id);
              const active=race.horses.filter(h=>!h.scratched).length;
              const fav=race.horses.filter(h=>!h.scratched).sort((a,b)=>a.winOdds-b.winOdds)[0];
              const raceBal=account?getRaceBalance(account.id,race.id):STARTING_BALANCE;
              const hasScratched=rb.some(b=>b.won===null&&b.horses.some(n=>race.horses.find(h=>h.number===n)?.scratched));
              const statusColor=race.status==="finished"?C.green:race.status==="closed"?C.red:raceBal===0?C.green:raceBal===STARTING_BALANCE?C.red:C.accent;

              return(
                <div key={race.id} style={{
                  marginBottom:isMobile?8:10,
                  borderRadius:14,
                  background:"#fff",
                  border:`1px solid ${C.border}`,
                  borderLeft:`4px solid ${statusColor}`,
                  boxShadow:"0 1px 4px rgba(0,0,0,.05)",
                  cursor:race.status==="upcoming"?"pointer":"default",
                  transition:"all .18s",
                  overflow:"hidden",
                }}
                  onMouseEnter={e=>{if(!isMobile&&race.status==="upcoming"){e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 32px rgba(0,0,0,.1)";}}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.05)";}}
                  onClick={()=>race.status==="upcoming"&&onSelect(race.id)}>

                  {/* Scratched warning */}
                  {hasScratched&&(
                    <div style={{padding:"8px 16px",background:"#fff3cd",borderBottom:"1px solid #ffc107",display:"flex",gap:8,alignItems:"center"}}>
                      <span>⚠️</span>
                      <span className="sy" style={{fontSize:12,fontWeight:700,color:"#856404"}}>A selection has been scratched — tap to update</span>
                    </div>
                  )}

                  <div style={{padding:isMobile?"12px 14px":"14px 18px"}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                      <div style={{flex:1,minWidth:0}}>
                        {/* Badges */}
                        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:isMobile?5:8}}>
                          <span className="badge sy" style={{background:race.grade==="Feature Race"?"rgba(184,134,11,.12)":C.accentGlow,color:race.grade==="Feature Race"?C.gold:C.accent,border:`1.5px solid ${race.grade==="Feature Race"?C.gold:C.accent}`,fontSize:isMobile?10:11,padding:isMobile?"2px 8px":"3px 10px",fontWeight:700}}>{race.grade}</span>
                          {race.venue&&<span className="badge sy" style={{background:"#f4f5f7",color:"#374151",border:`1px solid ${C.border}`,fontSize:isMobile?10:11,padding:isMobile?"2px 8px":"3px 10px",fontWeight:500}}>{race.venue}</span>}
                          {race.raceNum&&<span className="badge sy" style={{background:"#f4f5f7",color:"#374151",border:`1px solid ${C.border}`,fontSize:isMobile?10:11,padding:isMobile?"2px 8px":"3px 10px",fontWeight:500}}>{race.raceNum}</span>}
                          <span className="badge sy" style={{
                            background:race.status==="finished"?C.greenBg:race.status==="closed"?"#fff0f0":race.status==="upcoming"?"#f0fff4":"#f4f5f7",
                            color:race.status==="finished"?C.green:race.status==="closed"?C.red:race.status==="upcoming"?C.green:C.soft,
                            border:`1.5px solid ${race.status==="finished"?C.greenBd:race.status==="closed"?C.redBd:race.status==="upcoming"?C.greenBd:C.border}`,
                            fontSize:isMobile?10:11,padding:isMobile?"2px 8px":"3px 10px",fontWeight:700,
                          }}>{race.status==="closed"?"🔒 Closed":race.status==="upcoming"?"🟢 Bets Open":race.status==="finished"?"✓ Finished":race.status}</span>
                        </div>

                        {/* Race name */}
                        <h3 className="cg" style={{fontSize:isMobile?15:20,fontWeight:700,marginBottom:3,lineHeight:1.2,color:"#111"}}>{race.name}</h3>

                        {/* Info row */}
                        <p className="sy" style={{fontSize:isMobile?11:13,color:C.soft,marginBottom:isMobile?3:5}}>
                          {race.distance} · {active} runners{active<race.horses.length?` (${race.horses.length-active} scr)`:""}
                          {fav?<span> · <span style={{color:C.gold}}>⭐</span> <strong style={{color:"#111"}}>{fav.name}</strong> <span style={{color:C.gold,fontWeight:700}}>${fav.winOdds.toFixed(1)}</span></span>:null}
                        </p>

                        {/* Countdown + odds */}
                        {race.raceTime&&race.status==="upcoming"&&(
                          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                            <RaceCountdown date={race.date} time={race.raceTime}/>
                            {race.oddsAsOf&&<span className="sy" style={{fontSize:isMobile?10:11,color:C.muted}}>🕐 Odds: {race.oddsAsOf}</span>}
                          </div>
                        )}

                        {/* Player dots */}
                        {race.status==="upcoming"&&accounts?.length>0&&(()=>{
                          const playersWithBets=accounts.filter(a=>bets.some(b=>b.raceId===race.id&&b.playerId===a.id&&b.won===null)).length;
                          const allIn=playersWithBets===accounts.length;
                          return(
                            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3}}>
                              {accounts.map(a=>{
                                const has=bets.some(b=>b.raceId===race.id&&b.playerId===a.id&&b.won===null);
                                return <div key={a.id} style={{width:7,height:7,borderRadius:"50%",background:has?"#1a3a1a":"#d1d5db"}}/>;
                              })}
                              <span className="sy" style={{fontSize:10,color:allIn?C.green:C.muted,fontWeight:allIn?700:400}}>{playersWithBets}/{accounts.length} {allIn?"✓ All in":"bet"}</span>
                            </div>
                          );
                        })()}

                        {/* Budget warning */}
                        {race.status==="upcoming"&&account&&raceBal>0&&rb.length>0&&race.raceTime&&race.date&&(()=>{
                          const mins=(new Date(`${race.date}T${race.raceTime}:00`)-new Date())/60000;
                          if(mins>10||mins<0) return null;
                          return <div style={{marginTop:4,padding:"3px 8px",borderRadius:6,background:"#fff3cd",border:"1px solid #ffc107",display:"inline-flex",alignItems:"center",gap:4}}><span style={{fontSize:10}}>⚠️</span><span className="sy" style={{fontSize:10,color:"#856404",fontWeight:700}}>{fmt(raceBal)} unspent — {Math.round(mins)}m left!</span></div>;
                        })()}

                        {/* Results */}
                        {race.status==="finished"&&race.result&&(
                          <div style={{marginTop:6,display:"flex",gap:isMobile?8:16,flexWrap:"wrap"}}>
                            {["first","second","third","fourth"].map((k,i)=>{
                              const h=race.horses.find(x=>x.number===race.result[k]);
                              return h?<span key={k} className="sy" style={{fontSize:isMobile?10:12,color:i===0?"#111":C.soft,fontWeight:i===0?700:400}}>
                                <span style={{color:i===0?C.accent:C.muted,fontWeight:700}}>{["1st","2nd","3rd","4th"][i]}</span> #{h.number} {h.name}
                              </span>:null;
                            })}
                          </div>
                        )}

                        {/* Who's backing what */}
                        {(race.status==="closed"||race.status==="finished")&&(()=>{
                          const counts={};
                          bets.filter(b=>b.raceId===race.id&&(b.type==="win"||b.type==="eachway")).forEach(b=>{
                            const h=race.horses.find(x=>x.number===b.horses[0]);
                            if(h&&!h.scratched) counts[h.name]=(counts[h.name]||0)+1;
                          });
                          const sorted=Object.entries(counts).sort(([,a],[,b])=>b-a).slice(0,4);
                          if(!sorted.length) return null;
                          return(
                            <div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
                              <span className="sy" style={{fontSize:10,color:C.green,fontWeight:700}}>🏇</span>
                              {sorted.map(([name,count],i)=>(
                                <span key={name} className="sy" style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700,background:i===0?C.green:"rgba(30,92,30,.08)",color:i===0?"#fff":C.green,border:`1px solid ${C.green}`}}>{count}× {name}</span>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Bet strips */}
                        {rb.length>0&&(
                          <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid #f3f4f6`,display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>
                            {(()=>{
                              const displayed=[];const ewPairs=new Set();
                              rb.forEach((b,idx)=>{
                                if(ewPairs.has(b.id)) return;
                                if(b.type==="win"){const pair=rb.find((x,xi)=>xi>idx&&x.type==="place"&&x.horses[0]===b.horses[0]&&Math.abs(new Date(x.placedAt)-new Date(b.placedAt))<5000);if(pair){ewPairs.add(pair.id);displayed.push({...b,type:"eachway",pairPayout:(b.payout||0)+(pair.payout||0),pairWon:b.won||pair.won,bothLost:b.won===false&&pair.won===false});return;}}
                                if(!ewPairs.has(b.id)) displayed.push(b);
                              });
                              return displayed.map(b=>{
                                const def2=BET_TYPES.find(t=>t.id===b.type);
                                const isEW=b.type==="eachway"&&b.pairPayout!==undefined;
                                const hasScr=b.won===null&&b.horses.some(n=>race.horses.find(h=>h.number===n)?.scratched);
                                const hn=race.horses.find(h=>h.number===b.horses[0]);
                                const won=isEW?b.pairWon:b.won===true;
                                const lost=isEW?b.bothLost:b.won===false;
                                return(
                                  <div key={b.id} className="sy" style={{fontSize:isMobile?10:11,padding:isMobile?"3px 9px":"4px 11px",borderRadius:20,background:hasScr?"#fff3cd":won?C.greenBg:lost?C.redBg:"#f4f5f4",border:`1px solid ${hasScr?"#ffc107":won?C.greenBd:lost?C.redBd:C.border}`,color:hasScr?"#856404":won?C.green:lost?C.red:C.text,fontWeight:600}}>
                                    {hasScr?"⚠️ ":won?"✓ ":""}<strong>{isEW?"EW":def2?.label}</strong> · #{b.horses[0]} {hn?.name} · {fmt(b.stake)}{won?` → +${fmt(isEW?b.pairPayout:b.payout)}`:lost?" · Lost":""}
                                  </div>
                                );
                              });
                            })()}
                            {race.status==="upcoming"&&rb.some(b=>b.won===null)&&(
                              <button className="sy" style={{fontSize:isMobile?10:11,padding:isMobile?"3px 9px":"4px 11px",borderRadius:20,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:700}}
                                onClick={e=>{e.stopPropagation();onSelect(race.id);}}>Change ✕</button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right CTA */}
                      <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                        {race.status==="upcoming"&&account&&(
                          raceBal===0?(
                            <div style={{textAlign:"right"}}>
                              <div style={{padding:isMobile?"7px 12px":"8px 14px",borderRadius:10,background:C.greenBg,border:`1.5px solid ${C.greenBd}`,cursor:"pointer"}} onClick={e=>{e.stopPropagation();onSelect(race.id);}}>
                                <div style={{fontSize:isMobile?11:12,fontWeight:800,color:C.green}}>✅ Confirmed</div>
                              </div>
                              {rb[0]?.placedAt&&<div className="sy" style={{fontSize:9,color:C.muted,marginTop:2,textAlign:"right"}}>{new Date(rb[rb.length-1].placedAt).toLocaleTimeString("en-AU",{hour:"2-digit",minute:"2-digit"})}</div>}
                            </div>
                          ):rb.length>0?(
                            <button className="sy" style={{padding:isMobile?"8px 12px":"9px 16px",borderRadius:10,border:`1.5px solid ${C.gold}`,background:"rgba(184,134,11,.08)",color:C.gold,cursor:"pointer",fontWeight:700,fontSize:isMobile?11:12}}
                              onClick={e=>{e.stopPropagation();onSelect(race.id);}}>⚡ {fmt(raceBal)} left</button>
                          ):(
                            <button className="sy" style={{padding:isMobile?"10px 14px":"12px 20px",borderRadius:10,background:"#dc2626",border:"none",color:"#fff",cursor:"pointer",fontWeight:900,fontSize:isMobile?13:14,animation:"pulse 1.5s infinite",boxShadow:"0 4px 16px rgba(185,28,28,.35)",whiteSpace:"nowrap"}}
                              onClick={e=>{e.stopPropagation();onSelect(race.id);}}>🚨 Bet Now!</button>
                          )
                        )}
                        {race.status==="finished"&&race.result&&(
                          <div className="sy" style={{fontSize:isMobile?9:10,textAlign:"right",color:C.soft,lineHeight:1.6}}>
                            {["first","second","third","fourth"].map((k,i)=>{
                              const h=race.horses.find(x=>x.number===race.result[k]);
                              return h?<div key={k} style={{fontWeight:i===0?700:400,color:i===0?C.accent:C.muted}}>{["1st","2nd","3rd","4th"][i]}: #{h.number}</div>:null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Right sidebar */}
      {!isMobile&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Mini leaderboard */}
          {leaderboard.length>0&&(
            <div style={{background:"#fff",borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
              <div style={{background:"#1a3a1a",padding:"12px 16px"}}>
                <h3 className="cg" style={{fontSize:14,fontWeight:700,color:"#fff",margin:0}}>🏆 Standings</h3>
              </div>
              <div style={{padding:"8px 0"}}>
                {leaderboard.slice(0,5).map((a,i)=>(
                  <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 16px",background:a.id===account?.id?"rgba(26,58,26,.04)":"transparent",borderLeft:a.id===account?.id?"3px solid #1a3a1a":"3px solid transparent"}}>
                    <span className="sy" style={{fontSize:13,fontWeight:700,color:i===0?"#f59e0b":i===1?"#9ca3af":i===2?"#b45309":"#9ca3af",width:18,flexShrink:0}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}.`}</span>
                    <span className="sy" style={{flex:1,fontSize:13,fontWeight:a.id===account?.id?700:500,color:"#111",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</span>
                    <span className="sy" style={{fontSize:13,fontWeight:700,color:a.totalWon-a.totalStaked>=0?C.green:C.red}}>{a.totalWon-a.totalStaked>=0?"+":""}{fmt(a.totalWon-a.totalStaked)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How to play */}
          <div style={{background:"#fff",borderRadius:14,border:`1px solid ${C.border}`,padding:"14px 16px",boxShadow:"0 1px 4px rgba(0,0,0,.05)"}}>
            <h3 className="cg" style={{fontSize:13,fontWeight:700,marginBottom:10,color:"#111"}}>How it works</h3>
            {[
              ["💰","$24 per race","Each race has its own $24 budget — you must spend it all"],
              ["🎯","Pick your bet","Win, Place, Exotics — choose wisely"],
              ["🏆","Most profit wins","Leaderboard ranked by net profit across all races"],
            ].map(([icon,title,desc])=>(
              <div key={title} style={{display:"flex",gap:10,marginBottom:10}}>
                <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
                <div>
                  <div className="sy" style={{fontSize:12,fontWeight:700,color:"#111"}}>{title}</div>
                  <div className="sy" style={{fontSize:11,color:C.soft,marginTop:1}}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RACE SCREEN ──────────────────────────────────────────────────────────────
function RaceScreen({race,account,bets,myBets,getRaceBalance,onBack,onQueue,onCancelBet}) {
  const w = useWindowWidth();
  const isMobile = w < 700;
  const [betType,setBetType]=useState("win");
  const [sel,setSel]=useState({});
  const [stakeStr,setStakeStr]=useState("");
  const [boxed,setBoxed]=useState(false);
  const [winSel,setWinSel]=useState(null);
  const [placeSel,setPlaceSel]=useState(null);
  const [showBetPanel,setShowBetPanel]=useState(false);

  // Bet lock countdown — always called at top level (not inside callback)
  const countdown = useCountdown(race.date, race.raceTime);

  const def=BET_TYPES.find(t=>t.id===betType);
  const om=getOddsMap(race.horses);
  const activeHorses=race.horses.filter(h=>!h.scratched);
  const fav=activeHorses.sort((a,b)=>a.winOdds-b.winOdds)[0];
  const raceBalance = account ? getRaceBalance(account.id, race.id) : 0;

  const numPositions=def.positions.length;
  const stake=parseFloat(stakeStr)||0;

  const changeType=id=>{setBetType(id);setSel({});setWinSel(null);setPlaceSel(null);};

  // Sync winSel/placeSel → sel so combo counting works for win/place/eachway
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
    const allSel=[...new Set(Object.values(effectiveSel).flat())];
    if(allSel.length<numPositions) return [];
    // Quinella boxed = unordered pairs (combinations, not permutations)
    if(betType==="quinella"){
      const pairs=[];
      for(let i=0;i<allSel.length;i++)
        for(let j=i+1;j<allSel.length;j++)
          pairs.push([allSel[i],allSel[j]]);
      return pairs;
    }
    // Exacta/Trifecta/First Four boxed = ordered permutations
    function perms(arr,r){if(r===0)return[[]]; return arr.flatMap((v,i)=>perms([...arr.slice(0,i),...arr.slice(i+1)],r-1).map(p=>[v,...p]));}
    return perms(allSel,numPositions);
  };

  const allCombos = boxed&&canShowBoxed ? getBoxedCombos() : getUnboxedCombos();
  const combos = allCombos.length;
  const unitStake = combos > 0 ? parseFloat((stake / combos).toFixed(4)) : stake;

  // Flexi % = unit stake as a % of $1.00 standard dividend unit
  // e.g. if you split $24 across 6 trifecta combos = $4 each = 400% flexi per combo
  const flexiPct = combos > 0 ? parseFloat(((stake / combos) * 100).toFixed(1)) : 0;

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
      // Each Way = two separate bets: one Win + one Place, each at full stake
      allCombos.forEach(h=>{
        onQueue(race.id,"win",h,stake);
        onQueue(race.id,"place",h,stake);
      });
    } else {
      allCombos.forEach(h=>onQueue(race.id,betType,h,unitStake));
    }
    setSel({});
    setWinSel(null);
    setPlaceSel(null);
    setStakeStr("");
  };

  // Which positions each horse is selected for
  const horsePositions=(num)=>{
    if(boxed) return (effectiveSel[0]||[]).includes(num)?["Selected"]:[];
    return def.positions.map((p,i)=>(effectiveSel[i]||[]).includes(num)?p.label:null).filter(Boolean);
  };

  const canShowBoxed=betType==="trifecta"||betType==="firstfour"||betType==="exacta"||betType==="quinella";

  return (
    <div className="sr">
      {/* Compact header */}
      <div style={{marginBottom:isMobile?8:16}}>
        <button className="btn btn-ghost sy" style={{marginBottom:10,fontSize:13,padding:"8px 14px",fontWeight:600}} onClick={onBack}>← Back</button>

        {/* Countdown */}
        {race.status==="upcoming"&&race.raceTime&&race.date&&countdown&&!countdown.expired&&(()=>{
          const r=countdown; const totalMins=r.h*60+r.m;
          if(totalMins>30) return null;
          const urgent=totalMins<5;
          const label=r.h>0?`${r.h}h ${String(r.m).padStart(2,"0")}m`:`${String(r.m).padStart(2,"0")}:${String(r.s).padStart(2,"0")}`;
          return(
            <div style={{marginBottom:8,padding:"10px 14px",borderRadius:10,background:urgent?"#dc2626":"#b45309",display:"flex",alignItems:"center",justifyContent:"space-between",animation:urgent?"pulse 1s infinite":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>⏰</span>
                <div className="sy" style={{fontSize:13,fontWeight:700,color:"#fff"}}>Closes in {label} {urgent?"— Last chance!":""}</div>
              </div>
              {!isMobile&&<div className="cg" style={{fontSize:22,fontWeight:900,color:"#fff"}}>{label}</div>}
            </div>
          );
        })()}

        {/* Race header card */}
        <div style={{marginBottom:isMobile?8:14,padding:isMobile?"12px 14px":"16px 20px",background:"#fff",borderRadius:14,border:`1px solid ${C.border}`,boxShadow:"0 1px 6px rgba(0,0,0,.06)"}}>
          <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
            <span className="badge sy" style={{background:race.grade==="Feature Race"?"rgba(184,134,11,.12)":C.accentGlow,color:race.grade==="Feature Race"?C.gold:C.accent,border:`1.5px solid ${race.grade==="Feature Race"?C.gold:C.accent}`,fontSize:isMobile?11:12,padding:"4px 10px",fontWeight:700}}>{race.grade}</span>
            <span className="badge sy" style={{background:"#f4f5f7",color:C.soft,border:`1px solid ${C.border}`,fontSize:isMobile?11:12,padding:"4px 10px",fontWeight:500}}>{race.raceNum}</span>
            {fav&&<span className="badge sy" style={{background:C.accentGlow,color:C.accent,border:`1.5px solid ${C.accent}`,fontSize:isMobile?11:12,padding:"4px 10px",fontWeight:600}}>⭐ {fav.name} <strong>${fav.winOdds?.toFixed(1)}</strong></span>}
            {race.oddsAsOf&&<span className="badge sy" style={{background:"#f4f5f7",color:C.soft,border:`1px solid ${C.border}`,fontSize:isMobile?10:11,padding:"3px 9px",fontWeight:500}}>🕐 Odds as of: {race.oddsAsOf}</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
            <div style={{flex:1,minWidth:0}}>
              <h2 className="cg" style={{fontSize:isMobile?20:26,fontWeight:800,lineHeight:1.2,marginBottom:2}}>{race.name}</h2>
              <p className="sy" style={{fontSize:isMobile?12:13,color:C.soft}}>{race.venue} · {race.distance} · {race.horses.filter(h=>!h.scratched).length} runners</p>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div className="cg" style={{fontSize:isMobile?22:26,fontWeight:900,color:raceBalance===0?C.green:raceBalance===STARTING_BALANCE?C.red:C.accent,lineHeight:1}}>{fmt(raceBalance)}</div>
              <div className="sy" style={{fontSize:10,color:C.muted}}>of $24 left</div>
            </div>
          </div>
          {/* Odds disclaimer */}
          {race.oddsAsOf&&race.status==="upcoming"&&(
            <div style={{marginTop:6,padding:"5px 10px",borderRadius:6,background:"rgba(184,134,11,.06)",border:"1px solid rgba(184,134,11,.2)",display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:12}}>ℹ️</span>
              <span className="sy" style={{fontSize:isMobile?10:11,color:"#92400e"}}>These are indicative odds — actual dividends are confirmed once the race is settled</span>
            </div>
          )}
          <div style={{marginTop:8,padding:"8px 12px",borderRadius:8,background:raceBalance===0?"rgba(21,128,61,.08)":raceBalance===STARTING_BALANCE?"rgba(185,28,28,.06)":"rgba(21,128,61,.04)",border:`1.5px solid ${raceBalance===0?C.greenBd:raceBalance===STARTING_BALANCE?C.redBd:C.greenBd}`}}>
            <span className="sy" style={{fontSize:isMobile?12:13,fontWeight:700,color:raceBalance===0?C.green:raceBalance===STARTING_BALANCE?C.red:C.accent}}>
              {raceBalance===0?"✅ Full $24 bet — you're locked in!":raceBalance===STARTING_BALANCE?"⚠️ No bets placed yet — you must bet your full $24":`⚡ ${fmt(raceBalance)} still to allocate`}
            </span>
          </div>

          {/* Your bets — right in the header so always visible */}
          {myBets.length>0&&(
            <div style={{marginTop:10,borderTop:`1px solid ${C.border}`,paddingTop:10}}>
              <p className="sy" style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>Your Bets on This Race</p>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {myBets.map(b=>{
                  const d=BET_TYPES.find(t=>t.id===b.type);
                  const horse=race.horses.find(h=>h.number===b.horses[0]);
                  const canCancel=b.won===null&&race.status==="upcoming";
                  return(
                    <div key={b.id} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:8,background:b.won===true?C.greenBg:b.won===false?C.redBg:"rgba(26,58,26,.06)",border:`1.5px solid ${b.won===true?C.greenBd:b.won===false?C.redBd:"#1a3a1a"}`}}>
                      <span className="sy" style={{fontSize:12,fontWeight:700,color:b.won===true?C.green:b.won===false?C.red:"#1a3a1a"}}>{d?.label}</span>
                      {horse&&<span className="sy" style={{fontSize:11,color:C.soft}}>#{horse.number} {horse.name}</span>}
                      <span className="sy" style={{fontSize:12,fontWeight:700,color:"#1a3a1a"}}>{fmt(b.stake)}</span>
                      {b.won===true&&<span className="sy" style={{fontSize:11,color:C.green,fontWeight:700}}>→ +{fmt(b.payout)}</span>}
                      {b.won===false&&<span className="sy" style={{fontSize:11,color:C.red}}>Lost</span>}
                      {canCancel&&<button className="sy" style={{fontSize:10,padding:"2px 7px",borderRadius:5,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:700}} onClick={()=>{if(window.confirm("Cancel this bet?"))onCancelBet(b.id);}}>✕</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TAB-style bet type tabs + Place Bet button on mobile */}
      {isMobile&&(
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",gap:0,overflowX:"auto",borderBottom:`2px solid ${C.border}`,WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
            {BET_TYPES.map(t=>(
              <button key={t.id} className="sy" style={{flexShrink:0,padding:"8px 14px",fontSize:12,fontWeight:betType===t.id?700:500,background:"transparent",border:"none",cursor:"pointer",color:betType===t.id?"#1a3a1a":C.soft,borderBottom:`2px solid ${betType===t.id?"#1a3a1a":"transparent"}`,marginBottom:-2,whiteSpace:"nowrap"}}
                onClick={()=>{changeType(t.id);if(t.id!=="win"&&t.id!=="place"&&t.id!=="eachway"){setShowBetPanel(true);}}}>{t.label}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 290px",gap:14,alignItems:"start"}}>
        {/* Horse field */}
        <div>
          {/* Desktop column headers */}
          {!isMobile&&(
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,padding:"0 12px",marginBottom:4}}>
              <span className="sy" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:C.muted,width:80,textAlign:"center"}}>WIN</span>
              <span className="sy" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",color:C.muted,width:80,textAlign:"center"}}>PLACE</span>
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
                marginBottom:isMobile?3:8,
                borderRadius:isMobile?8:12,
                border:`${isMobile?"1.5px":"2px"} solid ${(winActive||placeActive||highlighted)?C.accent:scr?"#e5e7eb":C.border}`,
                background:(winActive||placeActive||highlighted)?"rgba(30,92,30,.05)":scr?"#f9f9f9":"#fff",
                overflow:"hidden",opacity:scr?0.6:1,transition:"all .15s",
              }}>
                <div style={{display:"flex",alignItems:"center",gap:0}}>
                  {/* Number + Silk — dark green TAB style */}
                  <div style={{flexShrink:0,display:"flex",alignItems:"stretch",overflow:"hidden",borderRadius:isMobile?"7px 0 0 7px":"10px 0 0 10px",borderRight:`1px solid ${C.border}`}}>
                    {/* Dark green number */}
                    <div style={{width:isMobile?36:44,display:"flex",alignItems:"center",justifyContent:"center",background:scr?"#6b7280":"#1a3a1a"}}>
                      <span style={{fontSize:isMobile?15:17,fontWeight:900,color:"#fff",letterSpacing:"-0.5px"}}>{h.number}</span>
                    </div>
                    {/* Silk */}
                    <div style={{width:isMobile?48:56,display:"flex",alignItems:"center",justifyContent:"center",padding:isMobile?"6px 6px":"8px 8px",background:"#fff"}}>
                      {h.silkUrl
                        ?<img src={h.silkUrl} alt="" style={{width:isMobile?34:40,height:isMobile?34:40,objectFit:"contain",display:"block"}}
                           onError={e=>{e.target.style.display="none";const fb=e.target.parentNode.querySelector(".silk-fb");if(fb)fb.style.display="flex";}}/>
                        :null}
                      <div className="silk-fb" style={{width:isMobile?32:36,height:isMobile?32:36,borderRadius:"50%",background:silkCol(h.number),display:h.silkUrl?"none":"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?12:14,fontWeight:800,color:"#fff"}}>{h.number}</div>
                    </div>
                  </div>

                  {/* Horse info */}
                  <div style={{flex:1,padding:isMobile?"8px 8px":"10px 12px",minWidth:0,cursor:scr?"default":"pointer"}}
                    onClick={()=>{if(scr)return;if(!isMobile){if(betType==="win"||betType==="place")toggleHorse(0,h.number);if(canShowBoxed&&boxed)toggleHorse(0,h.number);}}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:2}}>
                      <span className="sy" style={{fontWeight:700,fontSize:isMobile?14:16,textDecoration:scr?"line-through":"",color:scr?C.muted:C.text}}>{h.name}{h.barrier?<span style={{fontWeight:400,color:C.muted,fontSize:isMobile?12:14}}> ({h.barrier})</span>:""}</span>
                      {!scr&&h.number===fav?.number&&<span style={{fontSize:10,padding:"1px 6px",background:"#fffbeb",color:C.gold,border:`1px solid ${C.gold}`,borderRadius:20,fontWeight:800}}>⭐ FAV</span>}
                      {scr&&<span style={{fontSize:10,padding:"1px 6px",background:C.redBg,color:C.red,border:`1px solid ${C.redBd}`,borderRadius:20,fontWeight:700}}>SCR</span>}
                      {!isMobile&&posLabels.map(pl=>(<span key={pl} style={{fontSize:10,padding:"1px 6px",background:C.accent,color:"#fff",borderRadius:20,fontWeight:700}}>{pl}</span>))}
                    </div>
                    <div className="sy" style={{fontSize:isMobile?11:12,color:C.soft,lineHeight:1.3}}>
                      <strong style={{color:C.text,fontWeight:600}}>J</strong> {h.jockey?.replace(/^J\s+/i,"").replace(/^J\./i,"")} · <strong style={{color:C.text,fontWeight:600}}>T</strong> {h.trainer?.replace(/^T\s+/i,"").replace(/^T\./i,"")}{h.weight?` · ${h.weight}kg`:""}
                    </div>
                    {h.form&&h.form.length>0&&(
                      <div style={{display:"flex",gap:2,marginTop:isMobile?2:4}}>
                        {h.form.slice(-5).map((f,fi)=>(<span key={fi} style={{width:isMobile?12:16,height:isMobile?12:16,borderRadius:2,background:formColor(f),display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMobile?7:9,fontWeight:800,color:"#fff"}}>{f.toUpperCase()}</span>))}
                      </div>
                    )}
                    {/* Desktop: position pills for exotics inline */}
                    {!isMobile&&!scr&&canShowBoxed&&!boxed&&(
                      <div style={{display:"flex",gap:3,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                        <span className="sy" style={{fontSize:11,color:C.accent,fontWeight:600}}>${h.winOdds.toFixed(2)}W · ${h.placeOdds.toFixed(2)}P</span>
                      </div>
                    )}
                    {!isMobile&&!scr&&canShowBoxed&&boxed&&(
                      <div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                        <span className="sy" style={{fontSize:11,color:C.accent}}>${h.winOdds.toFixed(2)}W · ${h.placeOdds.toFixed(2)}P</span>
                      </div>
                    )}
                  </div>

                  {/* Right side — TAB style buttons */}
                  {!scr ? (
                    isMobile ? (
                      /* Mobile: TAB-style — Win/Place buttons OR position buttons depending on bet type */
                      betType==="win"||betType==="place"||betType==="eachway" ? (
                        <div style={{display:"flex",gap:4,padding:"8px 8px",flexShrink:0}}>
                          {/* WIN button */}
                          <button className="sy" style={{
                            width:62,padding:"9px 0",borderRadius:8,textAlign:"center",fontFamily:"inherit",cursor:"pointer",
                            border:`2px solid ${winSel===h.number?"#1a3a1a":"#d1fae5"}`,
                            background:winSel===h.number?"#1a3a1a":"#f0fdf4",
                            color:winSel===h.number?"#fff":"#1a3a1a",
                          }} onClick={e=>{e.stopPropagation();setWinSel(h.number);setPlaceSel(null);setBetType("win");setSel({0:[h.number]});setShowBetPanel(true);}}>
                            <div style={{fontSize:14,fontWeight:800}}>${h.winOdds.toFixed(2)}</div>
                            <div style={{fontSize:8,fontWeight:700,opacity:.75,letterSpacing:".04em"}}>WIN</div>
                          </button>
                          {/* PLACE button */}
                          <button className="sy" style={{
                            width:62,padding:"9px 0",borderRadius:8,textAlign:"center",fontFamily:"inherit",cursor:"pointer",
                            border:`2px solid ${placeSel===h.number&&betType!=="win"?"#1d4ed8":"#dbeafe"}`,
                            background:placeSel===h.number&&betType!=="win"?"#1d4ed8":"#eff6ff",
                            color:placeSel===h.number&&betType!=="win"?"#fff":"#1d4ed8",
                          }} onClick={e=>{e.stopPropagation();setPlaceSel(h.number);setWinSel(null);setBetType("place");setSel({0:[h.number]});setShowBetPanel(true);}}>
                            <div style={{fontSize:14,fontWeight:800}}>${h.placeOdds.toFixed(2)}</div>
                            <div style={{fontSize:8,fontWeight:700,opacity:.75,letterSpacing:".04em"}}>PLACE</div>
                          </button>
                        </div>
                      ) : canShowBoxed&&!boxed ? (
                        /* Exotic position buttons — right side, one line always */
                        <div style={{display:"flex",flexDirection:"column",gap:4,padding:"8px 8px",flexShrink:0,alignItems:"flex-end",justifyContent:"center"}}>
                          <div style={{display:"flex",gap:3}}>
                            {def.positions.map((pos,pi)=>{
                              const isThis=(sel[pi]||[]).includes(h.number);
                              return(
                                <button key={pi} className="sy" style={{
                                  width:isMobile?40:48,height:isMobile?38:44,
                                  borderRadius:8,
                                  border:`2px solid ${isThis?"#1a3a1a":"#d1d5db"}`,
                                  background:isThis?"#1a3a1a":"#fff",
                                  color:isThis?"#fff":"#374151",
                                  cursor:"pointer",fontWeight:800,
                                  fontSize:isMobile?def.positions.length>3?10:12:13,
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
                          {posLabels.length>0&&<div className="sy" style={{fontSize:9,color:"#1a3a1a",fontWeight:700,textAlign:"right"}}>{posLabels.join("·")}</div>}
                        </div>
                      ) : canShowBoxed&&boxed ? (
                        /* Boxed — single select button */
                        <div style={{padding:"8px 10px",flexShrink:0,display:"flex",alignItems:"center"}}>
                          <button className="sy" style={{padding:"10px 16px",borderRadius:10,border:`2px solid ${(sel[0]||[]).includes(h.number)?"#1a3a1a":"#d1d5db"}`,background:(sel[0]||[]).includes(h.number)?"#1a3a1a":"#fff",color:(sel[0]||[]).includes(h.number)?"#fff":"#374151",cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"inherit"}}
                            onClick={e=>{e.stopPropagation();toggleHorse(0,h.number);}}>
                            {(sel[0]||[]).includes(h.number)?"✓ In":"Select"}
                          </button>
                        </div>
                      ) : null
                    ) : (
                      /* Desktop right side — position buttons for exotics, WIN/PLACE for win/place/ew */
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
                          <button className="sy" style={{width:72,padding:"9px 0",borderRadius:7,border:`2px solid ${winSel===h.number?"#1a3a1a":"rgba(30,92,30,.3)"}`,background:winSel===h.number?"#1a3a1a":"rgba(30,92,30,.06)",color:winSel===h.number?"#fff":"#1a3a1a",cursor:"pointer",textAlign:"center",fontFamily:"inherit"}}
                            onClick={e=>{e.stopPropagation();const next=winSel===h.number?null:h.number;setWinSel(next);if(next&&placeSel===h.number){setBetType("eachway");setSel({0:[h.number]});}else if(next){setBetType("win");setSel({0:[h.number]});}else if(placeSel===h.number){setBetType("place");setSel({0:[h.number]});}else{setBetType("win");setSel({});}}}>
                            <div style={{fontSize:15,fontWeight:800}}>${h.winOdds.toFixed(2)}</div>
                            <div style={{fontSize:9,fontWeight:700,opacity:.8,letterSpacing:".04em"}}>WIN</div>
                          </button>
                          <button className="sy" style={{width:72,padding:"9px 0",borderRadius:7,border:`2px solid ${placeSel===h.number?"#1d4ed8":"#d1d5db"}`,background:placeSel===h.number?"#1d4ed8":"#f8f9fb",color:placeSel===h.number?"#fff":"#4b5563",cursor:"pointer",textAlign:"center",fontFamily:"inherit"}}
                            onClick={e=>{e.stopPropagation();const next=placeSel===h.number?null:h.number;setPlaceSel(next);if(next&&winSel===h.number){setBetType("eachway");setSel({0:[h.number]});}else if(next){setBetType("place");setSel({0:[h.number]});}else if(winSel===h.number){setBetType("win");setSel({0:[h.number]});}else{setBetType("place");setSel({});}}}>
                            <div style={{fontSize:15,fontWeight:800}}>${h.placeOdds.toFixed(2)}</div>
                            <div style={{fontSize:9,fontWeight:700,opacity:.8,letterSpacing:".04em"}}>PLACE</div>
                          </button>
                        </div>
                      )
                    )
                  ) : null}
                  {scr&&(
                    <div style={{display:"flex",gap:6,padding:"12px 10px",flexShrink:0}}>
                      <div style={{width:isMobile?68:78,padding:"10px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"#f3f4f6",textAlign:"center"}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.muted}}>SCR</div>
                      </div>
                      <div style={{width:isMobile?68:78,padding:"10px 0",borderRadius:8,border:`1px solid ${C.border}`,background:"#f3f4f6",textAlign:"center"}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.muted}}>SCR</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile bet panel — simple clean design */}
        {isMobile&&showBetPanel&&(
          <>
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:899}} onClick={()=>{setShowBetPanel(false);setSel({});setWinSel(null);setPlaceSel(null);setStakeStr("");}}/>
            <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:900,background:"#fff",borderRadius:"24px 24px 0 0",boxShadow:"0 -4px 30px rgba(0,0,0,.2)",paddingBottom:"env(safe-area-inset-bottom,20px)"}}>

              {/* Handle */}
              <div style={{width:36,height:4,borderRadius:2,background:"#e5e7eb",margin:"14px auto 0"}}/>

              {/* Header — bet type + close */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 20px 0"}}>
                <div style={{display:"flex",gap:6}}>
                  {["win","place","eachway","quinella","exacta","trifecta","firstfour"].map(id=>{
                    const t=BET_TYPES.find(x=>x.id===id);
                    return <button key={id} className="sy" style={{padding:"6px 12px",borderRadius:20,border:`2px solid ${betType===id?"#1a3a1a":"#e5e7eb"}`,background:betType===id?"#1a3a1a":"#fff",color:betType===id?"#fff":"#6b7280",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit"}} onClick={()=>changeType(id)}>{t?.label}</button>;
                  })}
                </div>
                <button style={{width:32,height:32,borderRadius:"50%",background:"#f3f4f6",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#6b7280",flexShrink:0}} onClick={()=>{setShowBetPanel(false);setSel({});setWinSel(null);setPlaceSel(null);setStakeStr("");}}>✕</button>
              </div>

              <div style={{padding:"16px 20px",overflowY:"auto",maxHeight:"65vh"}}>

                {/* Selected horse card */}
                {(()=>{
                  const selNum=winSel||placeSel||(sel[0]||[])[0]||(Object.values(effectiveSel).flat()[0]);
                  const selH=selNum?race.horses.find(x=>x.number===selNum):null;
                  return selH?(
                    <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"#f0fdf4",borderRadius:14,marginBottom:16,border:"2px solid #bbf7d0"}}>
                      <div style={{width:34,height:34,borderRadius:"50%",background:"#1a3a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,color:"#fff",flexShrink:0}}>{selH.number}</div>
                      {selH.silkUrl&&<img src={selH.silkUrl} alt="" style={{width:30,height:30,objectFit:"contain",flexShrink:0}} onError={e=>e.target.style.display="none"}/>}
                      <div style={{flex:1}}>
                        <div className="sy" style={{fontSize:15,fontWeight:700}}>{selH.name}</div>
                        <div className="sy" style={{fontSize:12,color:"#4b7c4b"}}>Win ${selH.winOdds.toFixed(2)} · Place ${selH.placeOdds.toFixed(2)}</div>
                      </div>
                      <button style={{background:"none",border:"none",fontSize:18,color:"#9ca3af",cursor:"pointer"}} onClick={()=>{setWinSel(null);setPlaceSel(null);setSel({});}}>×</button>
                    </div>
                  ):null;
                })()}

                {/* Horse picker — only for win/place/ew when no horse selected */}
                {(betType==="win"||betType==="place"||betType==="eachway")&&!winSel&&!placeSel&&(
                  <div style={{marginBottom:16}}>
                    <p className="sy" style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>Pick a horse</p>
                    <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:220,overflowY:"auto"}}>
                      {race.horses.filter(h=>!h.scratched).map(h=>(
                        <button key={h.number} className="sy" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${winSel===h.number||placeSel===h.number?"#1a3a1a":"#e5e7eb"}`,background:winSel===h.number||placeSel===h.number?"#f0fdf4":"#fafafa",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}
                          onClick={()=>{if(betType==="win"){setWinSel(h.number);setSel({0:[h.number]});}else if(betType==="place"){setPlaceSel(h.number);setSel({0:[h.number]});}else{setWinSel(h.number);setPlaceSel(h.number);setSel({0:[h.number]});}}}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:"#1a3a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>{h.number}</div>
                          {h.silkUrl&&<img src={h.silkUrl} alt="" style={{width:24,height:24,objectFit:"contain"}} onError={e=>e.target.style.display="none"}/>}
                          <span className="sy" style={{flex:1,fontSize:14,fontWeight:600}}>{h.name} <span style={{color:"#9ca3af",fontWeight:400,fontSize:12}}>({h.barrier||h.number})</span></span>
                          <span className="sy" style={{fontSize:13,fontWeight:700,color:"#1a3a1a"}}>${h.winOdds.toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Exotics horse picker */}
                {(betType==="quinella"||betType==="exacta"||betType==="trifecta"||betType==="firstfour")&&(
                  <div style={{marginBottom:16}}>
                    {canShowBoxed&&(
                      <div style={{display:"flex",gap:6,marginBottom:12}}>
                        <button className="sy" style={{flex:1,padding:"9px",borderRadius:10,border:`2px solid ${!boxed?"#1a3a1a":"#e5e7eb"}`,background:!boxed?"#1a3a1a":"#fff",color:!boxed?"#fff":"#374151",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>{setBoxed(false);setSel({});}}>Unboxed</button>
                        <button className="sy" style={{flex:1,padding:"9px",borderRadius:10,border:`2px solid ${boxed?"#1a3a1a":"#e5e7eb"}`,background:boxed?"#1a3a1a":"#fff",color:boxed?"#fff":"#374151",fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>{setBoxed(true);setSel({});}}>Boxed</button>
                      </div>
                    )}
                    <p className="sy" style={{fontSize:12,fontWeight:700,color:"#374151",marginBottom:8}}>{boxed?`Select ${numPositions}+ horses (any order)`:`Select position for each horse`}</p>
                    <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:220,overflowY:"auto"}}>
                      {race.horses.filter(h=>!h.scratched).map(h=>{
                        if(boxed){
                          const inSel=(sel[0]||[]).includes(h.number);
                          return(
                            <button key={h.number} className="sy" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:`1.5px solid ${inSel?"#1a3a1a":"#e5e7eb"}`,background:inSel?"#f0fdf4":"#fafafa",cursor:"pointer",textAlign:"left",fontFamily:"inherit"}} onClick={()=>toggleHorse(0,h.number)}>
                              <div style={{width:28,height:28,borderRadius:"50%",background:"#1a3a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>{h.number}</div>
                              <span className="sy" style={{flex:1,fontSize:14,fontWeight:600}}>{h.name}</span>
                              <span className="sy" style={{fontSize:13,fontWeight:700,color:"#1a3a1a"}}>${h.winOdds.toFixed(2)}</span>
                              {inSel&&<span style={{fontSize:16,color:"#1a3a1a"}}>✓</span>}
                            </button>
                          );
                        }
                        const myPositions=def.positions.map((p,pi)=>(sel[pi]||[]).includes(h.number)?p.label:null).filter(Boolean);
                        return(
                          <div key={h.number} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",borderRadius:10,border:`1.5px solid ${myPositions.length?"#1a3a1a":"#e5e7eb"}`,background:myPositions.length?"#f0fdf4":"#fafafa"}}>
                            <div style={{width:26,height:26,borderRadius:"50%",background:"#1a3a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:"#fff",flexShrink:0}}>{h.number}</div>
                            <span className="sy" style={{flex:1,fontSize:13,fontWeight:600}}>{h.name}</span>
                            <div style={{display:"flex",gap:4}}>
                              {def.positions.map((pos,pi)=>{
                                const isThis=(sel[pi]||[]).includes(h.number);
                                return <button key={pi} className="sy" style={{padding:"5px 9px",borderRadius:7,border:`2px solid ${isThis?"#1a3a1a":"#d1d5db"}`,background:isThis?"#1a3a1a":"#fff",color:isThis?"#fff":"#374151",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>toggleHorse(pi,h.number)}>{pos.label}</button>;
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {combos>0&&<div style={{marginTop:8,padding:"8px 12px",background:"#f0fdf4",borderRadius:8,display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:14,color:"#1a3a1a"}}>✓</span><span className="sy" style={{fontSize:12,color:"#1a3a1a",fontWeight:700}}>{combos} combination{combos!==1?"s":" "}{combos>1?`· ${flexiPct}% flexi`:""}</span></div>}
                  </div>
                )}

                {/* Stake section */}
                <div style={{borderTop:"1px solid #f3f4f6",paddingTop:16}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <span className="sy" style={{fontSize:13,fontWeight:700,color:"#374151"}}>Stake</span>
                    <span className="sy" style={{fontSize:12,color:"#6b7280"}}>{fmt(raceBalance)} remaining</span>
                  </div>

                  {/* Big stake input */}
                  <div style={{position:"relative",marginBottom:10}}>
                    <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",fontSize:22,fontWeight:700,color:"#9ca3af"}}>$</span>
                    <input className="inp sy" type="number" min="0.5" step="0.5" placeholder="0.00" value={stakeStr} onChange={e=>setStakeStr(e.target.value)}
                      style={{paddingLeft:36,fontSize:24,fontWeight:700,padding:"14px 14px 14px 36px",width:"100%",borderRadius:12,border:"2px solid #e5e7eb",textAlign:"left"}}/>
                  </div>

                  {/* Quick amounts */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:14}}>
                    {[2,5,10,raceBalance].filter((v,i,a)=>v>0&&a.indexOf(v)===i).slice(0,4).map(v=>(
                      <button key={v} className="sy" style={{padding:"10px 4px",borderRadius:10,border:`1.5px solid ${stakeStr===String(v)?"#1a3a1a":"#e5e7eb"}`,background:stakeStr===String(v)?"#1a3a1a":"#fff",color:stakeStr===String(v)?"#fff":"#374151",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
                        onClick={()=>setStakeStr(String(v))}>
                        ${v}
                      </button>
                    ))}
                  </div>

                  {betType==="eachway"&&stake>0&&<p className="sy" style={{fontSize:12,color:"#6b7280",marginBottom:10}}>Each Way = {fmt(stake)} Win + {fmt(stake)} Place = <strong>{fmt(totalCost)}</strong> total</p>}
                  {totalCost>raceBalance&&stake>0&&<p className="sy" style={{fontSize:12,color:"#dc2626",marginBottom:10,fontWeight:600}}>⚠ Only {fmt(raceBalance)} remaining</p>}

                  {/* Add to betslip */}
                  <button className="sy" disabled={!isReady()} onClick={()=>{handleAdd();setShowBetPanel(false);setSel({});setWinSel(null);setPlaceSel(null);setStakeStr("");}}
                    style={{width:"100%",padding:"16px",borderRadius:14,background:isReady()?"#1a3a1a":"#e5e7eb",color:isReady()?"#fff":"#9ca3af",fontSize:16,fontWeight:800,border:"none",cursor:isReady()?"pointer":"not-allowed",fontFamily:"inherit",transition:"all .15s"}}>
                    {!isReady()?(stake<=0?"Enter a stake":combos===0?"Select a horse":"Over budget"):`Add to Betslip${stake>0?` — ${fmt(totalCost)}`:""}`}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}


        {/* Desktop: sticky right bet panel */}
        {!isMobile&&(
          <div style={{position:"sticky",top:70,display:"flex",flexDirection:"column",gap:10}}>

            {/* Bet type selector — compact pills */}
            <div className="card" style={{padding:"16px"}}>
              <p className="sy" style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:C.muted,marginBottom:10}}>Bet Type</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:canShowBoxed?10:0}}>
                {BET_TYPES.map(t=>(
                  <button key={t.id} onClick={()=>changeType(t.id)} className="sy" style={{
                    padding:"10px 8px",borderRadius:8,
                    border:`2px solid ${betType===t.id?C.accent:C.border}`,
                    background:betType===t.id?"#1a3a1a":"#fff",
                    color:betType===t.id?"#fff":C.text,
                    cursor:"pointer",textAlign:"center",transition:"all .13s",
                    fontWeight:betType===t.id?700:500,fontSize:13,
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Boxed toggle */}
              {canShowBoxed&&(
                <div>
                  <div className="tog" style={{marginBottom:6}}>
                    <button className={`topt${!boxed?" on":""}`} onClick={()=>{setBoxed(false);setSel({});}}>Unboxed</button>
                    <button className={`topt${boxed?" on":""}`} onClick={()=>{setBoxed(true);setSel({});}}>Boxed</button>
                  </div>
                  <p className="sy" style={{fontSize:10,color:C.soft,lineHeight:1.5}}>
                    {boxed?`Select ${numPositions}+ horses — all permutations covered`:`Tap position buttons next to each horse`}
                  </p>
                </div>
              )}
            </div>

            {/* Selection + stake card */}
            <div className="card" style={{padding:"16px"}}>
              {/* Selection summary */}
              <div style={{marginBottom:14,minHeight:32}}>
                {(betType==="win"||betType==="place"||betType==="eachway")?(
                  (sel[0]||[]).length===0&&!winSel&&!placeSel
                    ?<p className="sy" style={{fontSize:12,color:C.muted,fontStyle:"italic"}}>Tap WIN or PLACE on a horse ↑</p>
                    :<div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {[...new Set([...(sel[0]||[]),winSel,placeSel].filter(Boolean))].map(n=>{
                          const h=race.horses.find(x=>x.number===n);
                          return(
                            <div key={n} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#f8fffe",border:`2px solid ${C.green}`,borderRadius:10}}>
                              {h?.silkUrl?<img src={h.silkUrl} alt="" style={{width:24,height:24,objectFit:"contain"}} onError={e=>e.target.style.display="none"}/>
                                :<div style={{width:22,height:22,borderRadius:"50%",background:"#1a3a1a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff"}}>{n}</div>}
                              <div>
                                <div className="sy" style={{fontSize:13,fontWeight:700}}>{h?.name}</div>
                                <div className="sy" style={{fontSize:11,color:C.soft}}>${h?.winOdds?.toFixed(2)} W · ${h?.placeOdds?.toFixed(2)} P</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                ):(
                  boxed?(
                    <div>
                      <p className="sy" style={{fontSize:11,color:C.soft,marginBottom:6}}>{(sel[0]||[]).length} of {numPositions}+ selected</p>
                      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                        {(sel[0]||[]).length===0
                          ?<span className="sy" style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>Tap Select on each horse ↑</span>
                          :(sel[0]||[]).map(n=>{const h=race.horses.find(x=>x.number===n);return <span key={n} className="sy" style={{fontSize:11,padding:"3px 9px",background:"#1a3a1a",color:"#fff",borderRadius:20,fontWeight:600}}>#{n} {h?.name}</span>;})}
                      </div>
                      {(sel[0]||[]).length>=numPositions&&<p className="sy" style={{fontSize:11,color:C.green,marginTop:6,fontWeight:700}}>✓ {combos} combination{combos!==1?"s":""}</p>}
                    </div>
                  ):(
                    <div>
                      {def.positions.map((pos,pi)=>{
                        const posHorses=(sel[pi]||[]).map(n=>race.horses.find(h=>h.number===n)).filter(Boolean);
                        return(
                          <div key={pi} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                            <span className="sy" style={{fontSize:10,fontWeight:800,textTransform:"uppercase",letterSpacing:".06em",color:"#1a3a1a",width:30,flexShrink:0}}>{pos.label}</span>
                            {posHorses.length===0
                              ?<span className="sy" style={{fontSize:11,color:C.muted,fontStyle:"italic"}}>not selected</span>
                              :posHorses.map(h=>(
                                <span key={h.number} style={{fontSize:11,padding:"3px 9px",background:"#1a3a1a",color:"#fff",borderRadius:20,fontWeight:600}}>#{h.number} {h.name}</span>
                              ))}
                          </div>
                        );
                      })}
                    </div>
                  )
                )}
              </div>

              {/* Stake */}
              <div className="divider"/>
              <p className="sy" style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",color:C.muted,marginBottom:8}}>Stake</p>
              <div style={{position:"relative",marginBottom:8}}>
                <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:18,fontWeight:700,color:C.muted}}>$</span>
                <input className="inp sy" type="number" step="0.50" min="0.10" placeholder="0.00" value={stakeStr} onChange={e=>setStakeStr(e.target.value)}
                  style={{paddingLeft:28,fontSize:18,fontWeight:700,padding:"12px 12px 12px 28px",width:"100%",borderRadius:8}}/>
              </div>
              {/* Quick amounts */}
              <div style={{display:"flex",gap:6,marginBottom:12}}>
                {[2,5,10,raceBalance].filter((v,i,a)=>a.indexOf(v)===i&&v>0).slice(0,4).map(v=>(
                  <button key={v} className="sy" style={{flex:1,padding:"8px 4px",borderRadius:7,border:`1.5px solid ${C.border}`,background:stakeStr===String(v)?"#1a3a1a":"#f8f9fa",color:stakeStr===String(v)?"#fff":C.text,fontSize:12,fontWeight:700,cursor:"pointer"}} onClick={()=>setStakeStr(String(v))}>
                    ${v}
                  </button>
                ))}
              </div>

              {/* Cost breakdown */}
              {stake>0&&combos>0&&(
                <div style={{padding:"10px 12px",background:"rgba(26,86,160,.04)",border:"1px solid rgba(26,86,160,.1)",borderRadius:8,marginBottom:10}}>
                  {combos>1&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span className="sy" style={{fontSize:11,color:C.soft}}>Combinations</span><span className="sy" style={{fontSize:12,fontWeight:700}}>{combos}</span></div>}
                  {(betType==="trifecta"||betType==="firstfour"||betType==="exacta"||betType==="quinella")&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span className="sy" style={{fontSize:11,color:C.soft}}>Flexi %</span><span className="sy" style={{fontSize:12,fontWeight:700,color:C.accent}}>{flexiPct}%</span></div>}
                  {betType==="eachway"&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span className="sy" style={{fontSize:11,color:C.soft}}>Win + Place</span><span className="sy" style={{fontSize:12,fontWeight:700}}>{fmt(stake)} + {fmt(stake)}</span></div>}
                  <div style={{display:"flex",justifyContent:"space-between",borderTop:`1px solid rgba(0,0,0,.06)`,paddingTop:6,marginTop:4}}>
                    <span className="sy" style={{fontSize:11,color:C.soft,textTransform:"uppercase",letterSpacing:".06em"}}>Total</span>
                    <span className="cg" style={{fontSize:18,fontWeight:800,color:totalCost>raceBalance?C.red:C.text}}>{fmt(totalCost)}</span>
                  </div>
                  {totalCost>raceBalance&&<p className="sy" style={{fontSize:11,color:C.red,marginTop:4}}>⚠ Exceeds your {fmt(raceBalance)} remaining</p>}
                </div>
              )}

              {/* Submit */}
              <button className="btn btn-gold" disabled={!isReady()} onClick={handleAdd}
                style={{width:"100%",padding:"14px",fontSize:14,fontWeight:700,borderRadius:10}}>
                {!isReady()
                  ?(stake<=0?"Enter a stake":combos===0?"Select a horse":"Over budget")
                  :betType==="eachway"?`Add Each Way — ${fmt(totalCost)}`
                  :combos>1?`Add ${combos} bets — ${fmt(totalCost)}`
                  :`Add to Betslip — ${fmt(totalCost)}`}
              </button>
            </div>

            {/* Existing bets on this race */}
            {myBets.length>0&&(
              <div className="card" style={{padding:"16px"}}>
                <p className="sy" style={{fontSize:10,fontWeight:700,color:C.muted,textTransform:"uppercase",letterSpacing:".1em",marginBottom:10}}>Your Bets on This Race</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {myBets.map(b=>{
                    const d=BET_TYPES.find(t=>t.id===b.type);
                    const canCancel = b.won===null && race.status==="upcoming";
                    const horses = b.horses.map(n=>{const h=race.horses.find(x=>x.number===n); return `#${n} ${h?.name||""}`}).join(" → ");
                    return(
                      <div key={b.id} style={{padding:"10px 12px",background:b.won===true?C.greenBg:b.won===false?C.redBg:"#f8fffe",border:`1.5px solid ${b.won===true?C.greenBd:b.won===false?C.redBd:C.greenBd}`,borderRadius:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
                          <div>
                            <span className="sy" style={{fontSize:13,fontWeight:700,color:C.text}}>{d?.label}</span>
                            <span className="sy" style={{fontSize:12,color:C.soft}}> · {fmt(b.stake)}</span>
                          </div>
                          <span className="sy" style={{fontSize:13,fontWeight:700,color:b.won===true?C.green:b.won===false?C.red:C.accent}}>
                            {b.won===true?`Won ${fmt(b.payout)}`:b.won===false?`Lost`:b.payout?`Won ${fmt(b.payout)}`:"Pending"}
                          </span>
                        </div>
                        <div className="sy" style={{fontSize:11,color:C.soft}}>{horses}</div>
                        {canCancel&&(
                          <button className="sy" style={{marginTop:8,fontSize:11,padding:"5px 10px",borderRadius:6,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:700}}
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

// ─── BETSLIP MODAL
function BetslipModal({pendingBets,races,account,getRaceBalance,onRemove,onConfirm,onClose}) {
  const total=pendingBets.reduce((s,b)=>s+b.stake,0);

  // Check per-race budget constraints
  const raceTotals={};
  pendingBets.forEach(b=>{ raceTotals[b.raceId]=(raceTotals[b.raceId]||0)+b.stake; });
  const raceIssues=Object.entries(raceTotals).filter(([rid,amt])=>{
    const bal=account?getRaceBalance(account.id,rid):0;
    return amt>bal;
  });
  const canAfford=raceIssues.length===0;

  return (
    <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal sr">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h3 className="cg" style={{fontSize:24,fontWeight:700}}>Betslip</h3>
          <button className="btn btn-ghost sy" style={{fontSize:10,padding:"5px 10px"}} onClick={onClose}>Close</button>
        </div>

        {pendingBets.length===0?(
          <p className="sy soft" style={{fontSize:13}}>No bets added yet.</p>
        ):(
          <>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:16,maxHeight:340,overflowY:"auto"}}>
              {pendingBets.map(b=>{
                const race=races.find(r=>r.id===b.raceId);
                const def=BET_TYPES.find(t=>t.id===b.type);
                return(
                  <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"10px 12px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div className="cg" style={{fontSize:15,fontWeight:700,marginBottom:2}}>{race?.name}</div>
                      <div className="sy" style={{fontSize:12,color:C.soft}}>{def?.label} · #{b.horses.join(" → #")}</div>
                      <div style={{marginTop:4}}>
                        <span className="sy" style={{fontSize:13,fontWeight:700,color:C.text}}>Stake: {fmt(b.stake)}</span>
                      </div>
                    </div>
                    <button className="sy" style={{fontSize:22,background:"none",border:"none",cursor:"pointer",color:C.muted,padding:"0 0 0 8px",lineHeight:1}} onClick={()=>onRemove(b.id)}>×</button>
                  </div>
                );
              })}
            </div>

            {raceIssues.length>0&&(
              <div style={{padding:"10px 12px",background:C.redBg,border:`1px solid ${C.redBd}`,borderRadius:8,marginBottom:12}}>
                {raceIssues.map(([rid])=>{
                  const race=races.find(r=>r.id===rid);
                  const bal=account?getRaceBalance(account.id,rid):0;
                  return <p key={rid} className="sy" style={{fontSize:11,color:C.red}}>{race?.name}: only {fmt(bal)} remaining</p>;
                })}
              </div>
            )}

            <div style={{padding:"12px 14px",background:"rgba(26,86,160,.05)",border:"1px solid rgba(26,86,160,.15)",borderRadius:8,marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span className="sy" style={{fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em"}}>Total Cost</span>
                <span className="cg gold" style={{fontSize:24,fontWeight:700}}>{fmt(total)}</span>
              </div>
              <div className="sy soft" style={{fontSize:11,marginTop:4}}>{pendingBets.length} bet{pendingBets.length>1?"s":""} across {new Set(pendingBets.map(b=>b.raceId)).size} race{new Set(pendingBets.map(b=>b.raceId)).size>1?"s":""}</div>
            </div>

            <button className="btn btn-gold" style={{width:"100%",padding:14,fontSize:13}} disabled={!canAfford} onClick={onConfirm}>
              ✓ Confirm &amp; Place All Bets
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────
function LeaderboardScreen({accounts,bets,races,getMovement,myAccount}) {
  const w = useWindowWidth();
  const isMobile = w < 700;
  const [h2h, setH2h] = useState(null);
  const [compareId, setCompareId] = useState(null);
  const medals=["🥇","🥈","🥉"]; const medalC=["#ffd700","#c0c0c0","#cd7f32"];

  const copyStandings = () => {
    const lines = accounts.map((a,i) => {
      const profit = parseFloat((a.totalWon - a.totalStaked).toFixed(2));
      const medal = medals[i] || `#${i+1}`;
      return `${medal} ${a.name} — ${profit>=0?"+":""}${fmt(profit)}`;
    });
    const text = `🏇 Spring Carnival Standings\n\n${lines.join("\n")}`;
    navigator.clipboard.writeText(text).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  };
  return (
    <div className="fu">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:10}}>
        <h2 className="cg" style={{fontSize:isMobile?22:28,fontWeight:700}}>🏆 Leaderboard</h2>
      </div>
      <p className="sy" style={{fontSize:13,color:C.soft,marginBottom:18}}>Ranked by net profit across all races.</p>

      {/* Season Awards — above leaderboard */}
      {accounts.length>0&&(()=>{
        const wins = bets.filter(b=>b.won===true);
        const finishedRaces = races.filter(r=>r.status==="finished"||r.status==="archived");
        const mostProfitable = [...accounts].sort((a,b)=>(b.totalWon-b.totalStaked)-(a.totalWon-a.totalStaked))[0];
        const mostProfitableProfit = mostProfitable ? parseFloat((mostProfitable.totalWon-mostProfitable.totalStaked).toFixed(2)) : 0;
        const biggestRoughie = wins.reduce((best,b)=>{
          const h=races.find(r=>r.id===b.raceId)?.horses?.find(x=>x.number===b.horses[0]);
          const odds=h?.winOdds||0;
          return odds>(best?.odds||0)?{...b,odds,horse:h?.name,player:accounts.find(a=>a.id===b.playerId)?.name}:best;
        },{odds:0});
        const luckiestWin = [...wins].sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
        const luckiestPlayer = luckiestWin ? accounts.find(a=>a.id===luckiestWin.playerId) : null;
        const luckiestRace = luckiestWin ? races.find(r=>r.id===luckiestWin.raceId) : null;
        const biggestLoser = [...accounts].sort((a,b)=>(a.totalWon-a.totalStaked)-(b.totalWon-b.totalStaked))[0];
        const biggestLoserProfit = biggestLoser ? parseFloat((biggestLoser.totalWon-biggestLoser.totalStaked).toFixed(2)) : 0;
        const biggestTri = [...wins].filter(b=>b.type==="trifecta").sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
        const biggestTriPlayer = biggestTri ? accounts.find(a=>a.id===biggestTri.playerId) : null;
        const biggestFF = [...wins].filter(b=>b.type==="firstfour").sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
        const biggestFFPlayer = biggestFF ? accounts.find(a=>a.id===biggestFF.playerId) : null;
        const awards = [
          {
            emoji:"🏆",label:"Most Profitable",
            name:mostProfitable?.name||"TBD",
            detail:mostProfitable?`${mostProfitableProfit>=0?"+":""}${fmt(mostProfitableProfit)} profit`:"—",
          },
          {
            emoji:"🐎",label:"Biggest Roughie",
            name:biggestRoughie.odds>0?biggestRoughie.player||"TBD":"TBD",
            detail:biggestRoughie.odds>0?`${biggestRoughie.horse} @ $${biggestRoughie.odds?.toFixed(2)} · ${races.find(r=>r.id===biggestRoughie.raceId)?.name||""}`:"No winners yet",
          },
          {
            emoji:"💸",label:"Biggest Trifecta",
            name:biggestTriPlayer?.name||"TBD",
            detail:biggestTri?`${fmt(biggestTri.payout||0)} · #${biggestTri.horses?.join("-")} · ${races.find(r=>r.id===biggestTri.raceId)?.name}`:"None yet",
          },
          {
            emoji:"🤑",label:"Biggest First Four",
            name:biggestFFPlayer?.name||"TBD",
            detail:biggestFF?`${fmt(biggestFF.payout||0)} · #${biggestFF.horses?.join("-")} · ${races.find(r=>r.id===biggestFF.raceId)?.name}`:"None yet",
          },
          {
            emoji:"🔥",label:"Hot Streak",
            name:luckiestPlayer?.name||"TBD",
            detail:luckiestWin?`${fmt(luckiestWin.payout||0)} · ${BET_TYPES.find(t=>t.id===luckiestWin.type)?.label} · ${luckiestRace?.name}`:"No wins yet",
          },
          {
            emoji:"❄️",label:"Cold Streak",
            name:biggestLoserProfit<0?biggestLoser?.name||"TBD":"Everyone's up!",
            detail:biggestLoserProfit<0?`${fmt(Math.abs(biggestLoserProfit))} down`:"🎉",
          },
        ];
        return(
          <div style={{marginBottom:24}}>
            <h3 className="cg" style={{fontSize:isMobile?17:20,fontWeight:700,marginBottom:12}}>🎖️ Season Awards</h3>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(3,1fr)",gap:10}}>
              {awards.map(a=>(
                <div key={a.label} className="card" style={{textAlign:"center",padding:"16px 12px"}}>
                  <div style={{fontSize:28,marginBottom:5}}>{a.emoji}</div>
                  <div className="sy" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".08em",color:C.soft,marginBottom:4}}>{a.label}</div>
                  <div className="cg" style={{fontSize:14,fontWeight:700,marginBottom:3}}>{a.name}</div>
                  <div className="sy" style={{fontSize:11,color:C.soft,lineHeight:1.3}}>{a.detail}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {accounts.length===0?<p className="sy soft">No players yet.</p>:(
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:28}}>
          {accounts.map((a,i)=>{
            const pb=bets.filter(b=>b.playerId===a.id);
            const won=pb.filter(b=>b.won===true).length, lost=pb.filter(b=>b.won===false).length, pend=pb.filter(b=>b.won===null).length;
            const profit=parseFloat((a.totalWon-a.totalStaked).toFixed(2));
            const movement = getMovement ? getMovement(a.id, i+1) : null;

            // Best win this season
            const bestWin = pb.filter(b=>b.won===true).sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
            const bestWinRace = bestWin ? races.find(r=>r.id===bestWin.raceId) : null;
            const bestWinType = bestWin ? BET_TYPES.find(t=>t.id===bestWin.type) : null;

            // Last 5 races - profit/loss per race
            const settledRaces = races
              .filter(r=>r.status==="finished"||r.status==="archived")
              .map(r=>{
                const rb = pb.filter(b=>b.raceId===r.id&&b.won!==null);
                if(!rb.length) return null;
                const raceProfit = rb.reduce((s,b)=>s+(b.won?(b.payout||0)-b.stake:-b.stake),0);
                return { raceId:r.id, name:r.name, profit:raceProfit };
              })
              .filter(Boolean)
              .slice(-5);

            return(
              <div key={a.id} className="card" style={{borderLeft:`4px solid ${medalC[i]||C.border}`,position:"relative"}}>
                {/* Main row */}
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:i<3?28:16,width:36,textAlign:"center",flexShrink:0,fontWeight:700}}>
                    {medals[i]||<span className="sy" style={{color:C.muted}}>#{i+1}</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                      <div className="cg" style={{fontSize:isMobile?16:20,fontWeight:700}}>{a.name}</div>
                      {movement!==null&&movement!==0&&(
                        <span className="sy" style={{fontSize:12,fontWeight:700,padding:"2px 7px",borderRadius:20,display:"inline-flex",alignItems:"center",gap:3,background:movement>0?C.greenBg:C.redBg,color:movement>0?C.green:C.red,border:`1px solid ${movement>0?C.greenBd:C.redBd}`}}>
                          {movement>0?`▲ ${movement}`:`▼ ${Math.abs(movement)}`}
                        </span>
                      )}
                    </div>
                    <div className="sy" style={{fontSize:12,marginTop:3,color:C.soft}}>
                      <span style={{color:C.green,fontWeight:600}}>{won}W</span>
                      <span style={{margin:"0 4px",color:C.muted}}>·</span>
                      <span style={{color:C.red,fontWeight:600}}>{lost}L</span>
                      {pend>0&&<><span style={{margin:"0 4px",color:C.muted}}>·</span><span>{pend} pending</span></>}
                      <span style={{margin:"0 4px",color:C.muted}}>·</span>
                      <span>{pb.length} bets</span>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div className="cg" style={{fontSize:isMobile?20:24,fontWeight:700,color:profit>=0?C.green:C.red}}>{profit>=0?"+":""}{fmt(profit)}</div>
                    {!isMobile&&<div className="sy" style={{fontSize:11,marginTop:2,color:C.soft}}>Won {fmt(a.totalWon)} · Staked {fmt(a.totalStaked)}</div>}
                  </div>
                </div>

                {/* Form + Best Win strip */}
                <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>

                  {/* Last 5 race form dots */}
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span className="sy" style={{fontSize:11,color:C.muted,marginRight:2}}>Form</span>
                    {settledRaces.length===0?(
                      <span className="sy" style={{fontSize:12,color:C.muted,fontStyle:"italic"}}>No races settled yet</span>
                    ):settledRaces.map((r,fi)=>(
                      <div key={fi} title={`${r.name}: ${r.profit>=0?"+":""}$${Math.abs(r.profit).toFixed(2)}`}
                        style={{width:22,height:22,borderRadius:"50%",background:r.profit>=0?C.green:C.red,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff",flexShrink:0,cursor:"default"}}>
                        {r.profit>=0?"W":"L"}
                      </div>
                    ))}
                    {settledRaces.length>0&&settledRaces.length<5&&Array.from({length:5-settledRaces.length}).map((_,fi)=>(
                      <div key={`e${fi}`} style={{width:22,height:22,borderRadius:"50%",background:C.border,flexShrink:0}}/>
                    ))}
                  </div>

                  {/* Best win */}
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    {bestWin?(()=>{
                      const bestWinHorse = bestWinRace?.horses?.find(h=>h.number===bestWin.horses[0]);
                      return(
                        <div style={{background:C.greenBg,border:`1px solid ${C.greenBd}`,borderRadius:8,padding:"8px 12px"}}>
                          <span className="sy" style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>🌟 Best Win</span>
                          <div style={{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap"}}>
                            <span className="cg" style={{fontSize:16,fontWeight:800,color:C.green}}>+{fmt(bestWin.payout||0)}</span>
                            <span className="sy" style={{fontSize:11,color:C.accent,fontWeight:600}}>{bestWinType?.label}</span>
                          </div>
                          {bestWinHorse&&<span className="sy" style={{fontSize:12,fontWeight:700,color:C.text,display:"block",marginTop:3}}>{bestWinHorse.name} <span style={{color:C.muted,fontWeight:400}}>@ ${bestWinHorse.winOdds?.toFixed(2)}</span></span>}
                          <span className="sy" style={{fontSize:11,color:C.soft,display:"block",marginTop:1}}>{bestWinRace?.name}</span>
                        </div>
                      );
                    })():(
                      <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`}}>
                        <span style={{fontSize:14}}>🥶</span>
                        <span className="sy" style={{fontSize:12,color:C.soft}}>Yet to get off the mark</span>
                      </div>
                    )}
                    {a.id&&(
                      <button className="sy" style={{fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:8,border:`1.5px solid ${C.accent}`,background:C.accentGlow,color:C.accent,cursor:"pointer",display:"flex",alignItems:"center",gap:5,flexShrink:0}}
                        onClick={(e)=>{
                          e.stopPropagation();
                          setH2h(a.id);
                          // Default compare to first other player
                          const other = accounts.find(x=>x.id!==a.id);
                          setCompareId(other?.id||null);
                        }}>
                        🥊 Head2Head
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* H2H Modal */}
      {h2h&&(()=>{
        const player1 = accounts.find(a=>a.id===h2h);
        if(!player1) return null;
        const player2 = accounts.find(a=>a.id===compareId);
        const finishedRaces = races.filter(r=>r.status==="finished"||r.status==="archived");
        const getProfit=(acc)=>race=>{
          if(!acc) return 0;
          const rb=bets.filter(b=>b.raceId===race.id&&b.playerId===acc.id&&b.won!==null);
          return parseFloat(rb.reduce((s,b)=>s+(b.won?(b.payout||0)-b.stake:-b.stake),0).toFixed(2));
        };
        const getBets=(acc)=>bets.filter(b=>b.playerId===acc?.id);
        const getWins=(acc)=>bets.filter(b=>b.playerId===acc?.id&&b.won===true);
        const p1fn=getProfit(player1), p2fn=getProfit(player2);
        const p1Total=parseFloat((player1.totalWon-player1.totalStaked).toFixed(2));
        const p2Total=player2?parseFloat((player2.totalWon-player2.totalStaked).toFixed(2)):0;
        let p1Wins=0,p2Wins=0,draws=0;
        let biggestGapRace=null,biggestGap=0;
        if(player2) finishedRaces.forEach(r=>{
          const a=p1fn(r),b=p2fn(r);
          if(a>b){p1Wins++;if(a-b>biggestGap){biggestGap=a-b;biggestGapRace={race:r,winner:player1.name,gap:a-b};}}
          else if(b>a){p2Wins++;if(b-a>biggestGap){biggestGap=b-a;biggestGapRace={race:r,winner:player2.name,gap:b-a};}}
          else draws++;
        });

        // Best single bet for each
        const p1BestBet = getWins(player1).sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
        const p2BestBet = player2?getWins(player2).sort((a,b)=>(b.payout||0)-(a.payout||0))[0]:null;

        // Fav bet type
        const favType=(acc)=>{
          const b=getBets(acc); if(!b.length) return "—";
          const counts={}; b.forEach(x=>{counts[x.type]=(counts[x.type]||0)+1;});
          const top=Object.entries(counts).sort(([,a],[,b])=>b-a)[0];
          return BET_TYPES.find(t=>t.id===top?.[0])?.label||"—";
        };

        // Avg stake
        const avgStake=(acc)=>{
          const b=getBets(acc); return b.length?parseFloat((b.reduce((s,x)=>s+x.stake,0)/b.length).toFixed(2)):0;
        };

        // Current streak
        const getStreak=(acc)=>{
          const settled=getBets(acc).filter(b=>b.won!==null);
          if(!settled.length) return null;
          const type=settled[settled.length-1].won?"🔥 Win":"❄️ Loss";
          let count=0;
          for(let i=settled.length-1;i>=0;i--){
            if((settled[i].won&&type.includes("Win"))||(!settled[i].won&&type.includes("Loss")))count++; else break;
          }
          return `${type} ×${count}`;
        };

        return(
          <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setH2h(null)}>
            <div className="modal sr" style={{maxWidth:580}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <h3 className="cg" style={{fontSize:20,fontWeight:700}}>🥊 Head2Head</h3>
                <button onClick={()=>setH2h(null)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:C.soft}}>×</button>
              </div>

              {/* Player picker */}
              <div style={{marginBottom:14}}>
                <label className="sy" style={{fontSize:11,color:C.soft,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>Compare {player1.name} vs</label>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {accounts.filter(a=>a.id!==h2h).map(a=>(
                    <button key={a.id} className="sy" style={{fontSize:12,fontWeight:700,padding:"6px 14px",borderRadius:20,border:`1.5px solid ${compareId===a.id?C.accent:C.border}`,background:compareId===a.id?C.accentGlow:"#fff",color:compareId===a.id?C.accent:C.soft,cursor:"pointer"}}
                      onClick={()=>setCompareId(a.id)}>{a.name}</button>
                  ))}
                </div>
              </div>

              {player2&&(
                <div style={{display:"flex",flexDirection:"column",gap:10,maxHeight:"70vh",overflowY:"auto"}}>
                  {/* Score card */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center"}}>
                    <div className="card" style={{textAlign:"center",padding:"14px 10px",background:"rgba(30,92,30,.05)",border:`2px solid ${C.green}`}}>
                      <div className="cg" style={{fontSize:15,fontWeight:700,marginBottom:4}}>{player1.name}</div>
                      <div className="cg" style={{fontSize:22,fontWeight:800,color:p1Total>=0?C.green:C.red}}>{p1Total>=0?"+":""}{fmt(p1Total)}</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div className="cg" style={{fontSize:26,fontWeight:900}}>{p1Wins}-{p2Wins}</div>
                      {draws>0&&<div className="sy" style={{fontSize:10,color:C.soft}}>{draws} draw{draws>1?"s":""}</div>}
                      <div className="sy" style={{fontSize:9,color:C.muted,marginTop:2}}>races won</div>
                      <div className="sy" style={{fontSize:11,fontWeight:700,marginTop:4,color:p1Total>p2Total?C.green:p2Total>p1Total?C.red:C.soft}}>
                        {p1Total>p2Total?`↑ ${fmt(p1Total-p2Total)} ahead`:p2Total>p1Total?`↓ ${fmt(p2Total-p1Total)} behind`:"Even"}
                      </div>
                    </div>
                    <div className="card" style={{textAlign:"center",padding:"14px 10px",background:"rgba(184,134,11,.05)",border:`2px solid ${C.gold}`}}>
                      <div className="cg" style={{fontSize:15,fontWeight:700,marginBottom:4}}>{player2.name}</div>
                      <div className="cg" style={{fontSize:22,fontWeight:800,color:p2Total>=0?C.green:C.red}}>{p2Total>=0?"+":""}{fmt(p2Total)}</div>
                    </div>
                  </div>

                  {/* Fun stats comparison */}
                  <div className="card" style={{padding:"14px"}}>
                    <div className="sy" style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:C.soft,marginBottom:10}}>Season Stats</div>
                    {[
                      ["Best Win", fmt(p1BestBet?.payout||0), fmt(p2BestBet?.payout||0)],
                      ["Fav Bet Type", favType(player1), favType(player2)],
                      ["Avg Stake", fmt(avgStake(player1)), fmt(avgStake(player2))],
                      ["Current Streak", getStreak(player1)||"—", getStreak(player2)||"—"],
                      ["Bets Placed", getBets(player1).length, getBets(player2).length],
                      ["Win Rate", getBets(player1).filter(b=>b.won!==null).length?Math.round(getWins(player1).length/getBets(player1).filter(b=>b.won!==null).length*100)+"%":"—", getBets(player2).filter(b=>b.won!==null).length?Math.round(getWins(player2).length/getBets(player2).filter(b=>b.won!==null).length*100)+"%":"—"],
                    ].map(([label,v1,v2])=>(
                      <div key={label} style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
                        <span className="sy" style={{fontSize:12,fontWeight:700,color:C.green,textAlign:"right"}}>{v1}</span>
                        <span className="sy" style={{fontSize:10,color:C.muted,textAlign:"center",minWidth:80}}>{label}</span>
                        <span className="sy" style={{fontSize:12,fontWeight:700,color:C.gold}}>{v2}</span>
                      </div>
                    ))}
                  </div>

                  {/* Biggest race gap */}
                  {biggestGapRace&&(
                    <div className="card" style={{padding:"12px 14px",background:"rgba(30,92,30,.04)"}}>
                      <div className="sy" style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:C.soft,marginBottom:6}}>🏆 Biggest Single Race Gap</div>
                      <div className="cg" style={{fontSize:15,fontWeight:700}}>{biggestGapRace.race.name}</div>
                      <div className="sy" style={{fontSize:13,marginTop:3}}><strong style={{color:C.green}}>{biggestGapRace.winner}</strong> won by <strong style={{color:C.green}}>{fmt(biggestGapRace.gap)}</strong></div>
                    </div>
                  )}

                  {/* Race by race */}
                  <div>
                    <div className="sy" style={{fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:C.soft,marginBottom:8}}>Race by Race</div>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {finishedRaces.length===0&&<p className="sy" style={{fontSize:13,color:C.soft,textAlign:"center",padding:20}}>No settled races yet</p>}
                      {finishedRaces.map(race=>{
                        const p1P=p1fn(race),p2P=p2fn(race);
                        const winner=p1P>p2P?"p1":p2P>p1P?"p2":"draw";
                        return(
                          <div key={race.id} style={{padding:"10px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:winner==="draw"?"#f9f9f9":winner==="p1"?"rgba(21,128,61,.05)":"rgba(185,28,28,.05)"}}>
                            <div className="sy" style={{fontSize:12,fontWeight:700,color:C.soft,marginBottom:5}}>{race.name}</div>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span className="sy" style={{fontSize:15,fontWeight:700,color:p1P>=0?C.green:C.red}}>{p1P>=0?"+":""}{fmt(p1P)}</span>
                              <span className="sy" style={{fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:20,background:winner==="p1"?C.greenBg:winner==="p2"?C.redBg:"#f0f0f0",color:winner==="p1"?C.green:winner==="p2"?C.red:C.soft}}>
                                {winner==="p1"?`${player1.name} ✓`:winner==="p2"?`${player2.name} ✓`:"Draw"}
                              </span>
                              <span className="sy" style={{fontSize:15,fontWeight:700,color:p2P>=0?C.green:C.red}}>{p2P>=0?"+":""}{fmt(p2P)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── SEASON SUMMARY ───────────────────────────────────────────────────────────
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
    const profit = parseFloat((totalWon - totalStaked).toFixed(2));
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
            ["Biggest Single Win", biggestWin ? `${fmt(biggestWin.payout||0)}` : "—", C.gold],
          ].map(([l,v,col])=>(
            <div key={l} className="card" style={{textAlign:"center",borderTop:`4px solid ${col}`}}>
              <div className="sy soft" style={{fontSize:11,marginBottom:6,textTransform:"uppercase",letterSpacing:".06em"}}>{l}</div>
              <div className="cg" style={{fontSize:22,fontWeight:800,color:col}}>{v}</div>
              {l==="Biggest Single Win"&&biggestWinPlayer&&<div className="sy soft" style={{fontSize:11,marginTop:4}}>{biggestWinPlayer.name} · {biggestWinRace?.name}</div>}
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
        const bestType = bestBet ? BET_TYPES.find(t=>t.id===bestBet.type) : null;
        if (!bestPlayer) return null;
        return (
          <div className="card" style={{marginBottom:24,background:"linear-gradient(135deg,#fffbeb,#fef9e7)",border:`2px solid ${C.gold}`,textAlign:"center",padding:"20px 24px"}}>
            <div style={{fontSize:32,marginBottom:6}}>🌟</div>
            <div className="sy" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".1em",color:C.gold,fontWeight:700,marginBottom:4}}>Best Bet of the Season</div>
            <div className="cg" style={{fontSize:22,fontWeight:800,marginBottom:4}}>{bestPlayer.name}</div>
            <div className="sy" style={{fontSize:14,color:C.soft,marginBottom:6}}>{bestType?.label} on {bestRace?.name}</div>
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
                  <div className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em"}}>Net Profit</div>
                  <div className="cg" style={{fontSize:26,fontWeight:800,color:p.profit>=0?C.green:C.red}}>
                    {p.profit>=0?"+":""}{fmt(p.profit)}
                  </div>
                  <div className="sy soft" style={{fontSize:11}}>Won {fmt(p.totalWon)} · Staked {fmt(p.totalStaked)}</div>
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
                      <div className="sy soft" style={{fontSize:11}}>{raceWinners.length} winner{raceWinners.length!==1?"s":""}</div>
                      <div className="cg" style={{fontSize:18,fontWeight:700,color:C.green}}>{fmt(totalPaid)} paid out</div>
                    </div>
                  </div>
                  {raceWinners.length>0&&(
                    <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`,display:"flex",flexWrap:"wrap",gap:6}}>
                      {raceWinners.map(b=>{
                        const pl=accounts.find(a=>a.id===b.playerId);
                        const td=BET_TYPES.find(t=>t.id===b.type);
                        return(
                          <span key={b.id} className="sy" style={{fontSize:12,padding:"4px 10px",background:C.greenBg,border:`1px solid ${C.greenBd}`,borderRadius:20,color:C.green}}>
                            🎉 {pl?.name} — {td?.label} +{fmt(b.payout||0)}
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

// ─── PROFILE ──────────────────────────────────────────────────────────────────
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
          <div style={{width:48,height:48,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#3b82f6)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:"#fff",flexShrink:0}}>
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
            <div className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".06em"}}>Net Profit</div>
            <div className="cg" style={{fontSize:isMobile?22:28,fontWeight:700,color:profit>=0?C.green:C.red}}>{profit>=0?"+":""}{fmt(profit)}</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${isMobile?2:4},1fr)`,gap:10,marginBottom:16}}>
        {[["Bets Placed",bets.length],["Win Rate",`${winRate}%`],["Total Won",fmt(account.totalWon)],["ROI",`${roi}%`]].map(([l,v])=>(
          <div key={l} className="card" style={{textAlign:"center",padding:"14px 10px"}}>
            <div className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".06em",marginBottom:4}}>{l}</div>
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
              <button className="btn btn-ghost sy" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>setShowPinChange(false)}>Close</button>
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
        <p className="sy soft" style={{fontSize:12,marginBottom:10}}>Every Group 1 race has its own $24 — you must spend the full amount on each race.</p>
        <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(2,1fr)",gap:8}}>
          {races.map(race=>{
            const bal=getRaceBalance(account.id,race.id);
            const used=STARTING_BALANCE-bal;
            const pct=Math.min((used/STARTING_BALANCE)*100,100);
            return(
              <div key={race.id} className="surface" style={{borderLeft:`3px solid ${race.status==="finished"?C.muted:bal>0?C.accent:C.green}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                  <div className="sy" style={{fontSize:12,fontWeight:700}}>{race.name}</div>
                  <div className="sy" style={{fontSize:11,color:race.status==="finished"?C.muted:bal===0?C.green:C.accent,fontWeight:600}}>
                    {race.status==="finished"?"Finished":bal===0?"✓ Spent":fmt(bal)+" left"}
                  </div>
                </div>
                <div style={{height:5,background:C.border,borderRadius:3,overflow:"hidden",marginBottom:4}}>
                  <div style={{height:"100%",width:`${pct}%`,background:race.status==="finished"?C.muted:bal===0?C.green:C.accent,borderRadius:3,transition:"width .3s"}}/>
                </div>
                {race.status==="upcoming"&&bal>0&&(
                  <div className="sy" style={{fontSize:11,color:C.red,fontWeight:600}}>⚠ Must spend {fmt(bal)} more</div>
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
            const race=races.find(r=>r.id===bet.raceId), td=BET_TYPES.find(t=>t.id===bet.type);
            const canCancel = bet.won===null && race?.status==="upcoming";
            return(
              <div key={bet.id} className="surface" style={{borderLeft:`3px solid ${bet.won===true?C.green:bet.won===false?C.red:C.accent}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="cg" style={{fontSize:16,fontWeight:700}}>{race?.name}</div>
                    <div className="sy soft" style={{fontSize:12,marginTop:2}}>{td?.label} · #{bet.horses.join(" → #")} · {new Date(bet.placedAt).toLocaleDateString("en-AU",{day:"numeric",month:"short"})}</div>
                    <div className="sy" style={{fontSize:12,marginTop:3,fontWeight:600,color:bet.won===true?C.green:bet.won===false?C.red:C.accent}}>
                      {bet.won===null&&bet.potential?`Potential: ${fmt(bet.potential)}`:bet.won===true?`Won ${fmt(bet.payout)}! 🎉`:bet.won===false?"Lost":"Pending"}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0,marginLeft:10}}>
                    <div className="cg" style={{fontSize:18,fontWeight:700}}>{fmt(bet.stake)}</div>
                    {canCancel&&(
                      <button className="sy" style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:600}}
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

  // Build race-level data — the fundamental unit
  const allRaces = [...new Set(bets.map(b=>b.raceId))].map(id=>races.find(r=>r.id===id)).filter(Boolean);
  const finishedRaces = allRaces.filter(r=>r.status==="finished"||r.status==="archived");
  const upcomingRaces = allRaces.filter(r=>r.status==="upcoming"||r.status==="closed");

  const raceStats = finishedRaces.map(race => {
    const rb = bets.filter(b=>b.raceId===race.id&&b.won!==null);
    const staked = rb.reduce((s,b)=>s+b.stake,0);
    const returned = rb.filter(b=>b.won===true).reduce((s,b)=>s+(b.payout||0),0);
    const raceProfit = parseFloat((returned-staked).toFixed(2));
    const hadWin = rb.some(b=>b.won===true);
    const bestBet = rb.filter(b=>b.won===true).sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
    return { race, rb, staked, returned, profit:raceProfit, hadWin, bestBet };
  });

  const racesWon   = raceStats.filter(r=>r.profit>0).length;
  const racesLost  = raceStats.filter(r=>r.profit<=0).length;
  const totalSettledRaces = raceStats.length;
  const raceWinRate = totalSettledRaces ? Math.round((racesWon/totalSettledRaces)*100) : 0;

  const profit = parseFloat((account.totalWon - account.totalStaked).toFixed(2));
  const settledStaked = raceStats.reduce((s,r)=>s+r.staked,0);
  const roi = settledStaked>0 ? parseFloat(((profit/settledStaked)*100).toFixed(1)) : 0;

  const pending = bets.filter(b=>b.won===null);

  // Best race
  const bestRaceStat = raceStats.sort((a,b)=>b.profit-a.profit)[0];
  const worstRaceStat = [...raceStats].sort((a,b)=>a.profit-b.profit)[0];

  // Best single win across all races
  const bestWin = bets.filter(b=>b.won===true).sort((a,b)=>(b.payout||0)-(a.payout||0))[0];
  const bestWinRace = bestWin ? races.find(r=>r.id===bestWin.raceId) : null;

  // Current streak — by race
  const streak = (() => {
    const s=[...raceStats].reverse();
    if(!s.length) return null;
    const type = s[0].profit>0 ? "win" : "loss";
    let count=0;
    for(const r of s){ if((r.profit>0&&type==="win")||(r.profit<=0&&type==="loss")) count++; else break; }
    return { type, count };
  })();

  // Profit by bet type — based on race-level context
  const won = bets.filter(b=>b.won===true);
  const lost = bets.filter(b=>b.won===false);
  const settled = bets.filter(b=>b.won!==null);
  const byType = BET_TYPES.map(t=>{
    const tb = settled.filter(b=>b.type===t.id);
    const tw = tb.filter(b=>b.won===true);
    const payout = tw.reduce((s,b)=>s+(b.payout||0),0);
    const staked = tb.reduce((s,b)=>s+b.stake,0);
    return { label:t.label, total:tb.length, wins:tw.length, payout, staked, profit:parseFloat((payout-staked).toFixed(2)) };
  }).filter(t=>t.total>0);

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
      <div className="card" style={{marginBottom:16,borderLeft:`4px solid ${C.accent}`}}>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#2d7a2d)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"#fff",flexShrink:0}}>
            {account.name[0].toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <h2 className="cg" style={{fontSize:isMobile?20:24,fontWeight:700}}>{account.name}</h2>
            <p className="sy" style={{fontSize:12,color:C.soft}}>{account.email}</p>
            <button className="sy" style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:12,fontWeight:700,textDecoration:"underline",padding:0,marginTop:2}} onClick={()=>{setShowPinChange(true);setPinStep("new");setNewPin("");setNewPin2("");setPinErr("");setPinOk(false);}}>
              Change PIN
            </button>
            {pinOk&&<span className="sy" style={{fontSize:12,color:C.green,marginLeft:10}}>✓ PIN updated!</span>}
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div className="sy" style={{fontSize:11,color:C.soft,textTransform:"uppercase",letterSpacing:".06em"}}>Season Profit</div>
            <div className="cg" style={{fontSize:isMobile?24:30,fontWeight:800,color:profit>=0?C.green:C.red}}>{profit>=0?"+":""}{fmt(profit)}</div>
          </div>
        </div>
      </div>

      {/* Main stats — per race */}
      <div style={{display:"grid",gridTemplateColumns:`repeat(${isMobile?2:4},1fr)`,gap:10,marginBottom:16}}>
        {[
          ["Races Entered", totalSettledRaces||0, null],
          ["Profitable Races", racesWon, C.green],
          ["Losing Races", racesLost, C.red],
          ["Pending", pending.length, null],
        ].map(([l,v,col])=>(
          <div key={l} className="card" style={{textAlign:"center",padding:"14px 10px"}}>
            <div className="sy" style={{fontSize:11,color:C.soft,marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>{l}</div>
            <div className="cg" style={{fontSize:isMobile?20:24,fontWeight:700,color:col||C.text}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{display:"grid",gridTemplateColumns:`repeat(${isMobile?2:4},1fr)`,gap:10,marginBottom:20}}>
        {[
          ["Race Win Rate", `${raceWinRate}%`, raceWinRate>=50?C.green:raceWinRate>=30?C.gold:C.red],
          ["ROI", `${roi}%`, roi>=0?C.green:C.red],
          ["Total Staked", fmt(settledStaked), null],
          ["Total Returned", fmt(account.totalWon), C.green],
        ].map(([l,v,col])=>(
          <div key={l} className="card" style={{textAlign:"center",padding:"14px 10px"}}>
            <div className="sy" style={{fontSize:11,color:C.soft,marginBottom:4,textTransform:"uppercase",letterSpacing:".06em"}}>{l}</div>
            <div className="cg" style={{fontSize:isMobile?18:22,fontWeight:700,color:col||C.text}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Highlights — race-based */}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:10,marginBottom:20}}>
        {bestWin&&(
          <div className="card" style={{background:"rgba(21,128,61,.05)",border:`1px solid ${C.greenBd}`}}>
            <div className="sy" style={{fontSize:11,color:C.green,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>🌟 Best Single Win</div>
            <div className="cg" style={{fontSize:22,fontWeight:800,color:C.green}}>+{fmt(bestWin.payout||0)}</div>
            <div className="sy" style={{fontSize:12,color:C.soft,marginTop:3}}>{BET_TYPES.find(t=>t.id===bestWin.type)?.label} · {bestWinRace?.name}</div>
            <div className="sy" style={{fontSize:11,color:C.muted,marginTop:1}}>#{bestWin.horses.join(" → #")}</div>
          </div>
        )}
        {bestRaceStat&&(
          <div className="card" style={{background:"rgba(21,128,61,.05)",border:`1px solid ${C.greenBd}`}}>
            <div className="sy" style={{fontSize:11,color:C.green,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>🏆 Best Race</div>
            <div className="cg" style={{fontSize:22,fontWeight:800,color:C.green}}>+{fmt(bestRaceStat.profit)}</div>
            <div className="sy" style={{fontSize:12,color:C.soft,marginTop:3}}>{bestRaceStat.race.name}</div>
            <div className="sy" style={{fontSize:11,color:C.muted,marginTop:1}}>{bestRaceStat.rb.length} bet{bestRaceStat.rb.length!==1?"s":""} · Staked {fmt(bestRaceStat.staked)}</div>
          </div>
        )}
        {streak&&streak.count>1&&(
          <div className="card" style={{background:streak.type==="win"?"rgba(21,128,61,.05)":"rgba(185,28,28,.05)",border:`1px solid ${streak.type==="win"?C.greenBd:C.redBd}`}}>
            <div className="sy" style={{fontSize:11,color:streak.type==="win"?C.green:C.red,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>{streak.type==="win"?"🔥 Winning Streak":"📉 Losing Streak"}</div>
            <div className="cg" style={{fontSize:22,fontWeight:800,color:streak.type==="win"?C.green:C.red}}>{streak.count} races in a row</div>
            <div className="sy" style={{fontSize:12,color:C.soft,marginTop:3}}>Current {streak.type==="win"?"profitable":"losing"} run</div>
          </div>
        )}
        {worstRaceStat&&worstRaceStat.profit<0&&(
          <div className="card" style={{background:"rgba(185,28,28,.05)",border:`1px solid ${C.redBd}`}}>
            <div className="sy" style={{fontSize:11,color:C.red,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>💸 Worst Race</div>
            <div className="cg" style={{fontSize:22,fontWeight:800,color:C.red}}>{fmt(worstRaceStat.profit)}</div>
            <div className="sy" style={{fontSize:12,color:C.soft,marginTop:3}}>{worstRaceStat.race.name}</div>
            <div className="sy" style={{fontSize:11,color:C.muted,marginTop:1}}>{worstRaceStat.rb.length} bet{worstRaceStat.rb.length!==1?"s":""} · Staked {fmt(worstRaceStat.staked)}</div>
          </div>
        )}
      </div>

      {/* Bet type breakdown */}
      {byType.length>0&&(
        <div style={{marginBottom:20}}>
          <h3 className="cg" style={{fontSize:18,fontWeight:700,marginBottom:10}}>By Bet Type</h3>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {byType.map(t=>(
              <div key={t.label} className="card" style={{padding:"12px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <span className="sy" style={{fontSize:14,fontWeight:700}}>{t.label}</span>
                  <span className="cg" style={{fontSize:16,fontWeight:700,color:t.profit>=0?C.green:C.red}}>{t.profit>=0?"+":""}{fmt(t.profit)}</span>
                </div>
                <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                  <span className="sy" style={{fontSize:12,color:C.soft}}>{t.total} bets</span>
                  <span className="sy" style={{fontSize:12,color:C.green}}>{t.wins} won</span>
                  <span className="sy" style={{fontSize:12,color:C.red}}>{t.total-t.wins} lost</span>
                  <span className="sy" style={{fontSize:12,color:C.soft}}>{t.total?Math.round((t.wins/t.total)*100):0}% hit rate</span>
                  <span className="sy" style={{fontSize:12,color:C.soft}}>{fmt(t.staked)} staked</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── VISUAL STATS SECTION ── */}
      {totalSettledRaces === 0 ? (
        <div className="card" style={{marginBottom:20,textAlign:"center",padding:"40px 20px",background:"linear-gradient(135deg,rgba(30,92,30,.04),rgba(184,134,11,.04))",border:`1px dashed ${C.border}`}}>
          <div style={{fontSize:56,marginBottom:12}}>📈</div>
          <div className="cg" style={{fontSize:20,fontWeight:700,marginBottom:6}}>Your stats will light up here</div>
          <div className="sy" style={{fontSize:14,color:C.soft}}>Once races are settled you'll see your profit curve, bet breakdown, form heatmap and more.</div>
        </div>
      ) : (()=>{
        const numFreq={};
        bets.forEach(b=>b.horses.forEach(n=>{numFreq[n]=(numFreq[n]||0)+1;}));
        const maxFreq=Math.max(...Object.values(numFreq),1);
        const luckyNum=Object.entries(numFreq).sort(([,a],[,b])=>b-a)[0];
        const buckets=[{label:"$1-4",min:1,max:4},{label:"$5-8",min:5,max:8},{label:"$9-12",min:9,max:12},{label:"$13-16",min:13,max:16},{label:"$17+",min:17,max:999}];
        const bucketData=buckets.map(b=>{const tb=settled.filter(x=>x.stake>=b.min&&x.stake<=b.max);const tw=tb.filter(x=>x.won===true);return{...b,total:tb.length,wins:tw.length,payout:tw.reduce((s,x)=>s+(x.payout||0),0),staked:tb.reduce((s,x)=>s+x.stake,0)};}).filter(b=>b.total>0);
        const profitCurve=[];let curRun=0;
        raceStats.forEach(r=>{curRun=parseFloat((curRun+r.profit).toFixed(2));profitCurve.push({val:curRun,name:r.race.name,profit:r.profit});});
        const maxCurve=Math.max(...profitCurve.map(p=>p.val),0.01);
        const minCurve=Math.min(...profitCurve.map(p=>p.val),0);
        const curveRange=maxCurve-minCurve||1;
        const typeColors={win:"#1e5c1e",place:"#1d4ed8",eachway:"#7c3aed",quinella:"#b45309",exacta:"#0e7490",trifecta:"#be185d",firstfour:"#d97706"};
        const typeData=BET_TYPES.map(t=>{const tb=settled.filter(b=>b.type===t.id);if(!tb.length)return null;const tw=tb.filter(b=>b.won===true);const p=parseFloat((tw.reduce((s,b)=>s+(b.payout||0),0)-tb.reduce((s,b)=>s+b.stake,0)).toFixed(2));const hitRate=Math.round((tw.length/tb.length)*100);return{label:t.label,id:t.id,profit:p,count:tb.length,wins:tw.length,hitRate,col:typeColors[t.id]||C.accent};}).filter(Boolean);
        const svgW=isMobile?300:500;const svgH=100;
        const pts=profitCurve.map((p,i)=>{const x=(i/(profitCurve.length-1||1))*svgW;const y=svgH-((p.val-minCurve)/curveRange)*svgH;return[x,y];});
        const pathD=pts.length>1?"M"+pts.map(p=>p.join(",")).join(" L"):"";
        const fillD=pts.length>1?"M"+pts[0][0]+","+svgH+" L"+pts.map(p=>p.join(",")).join(" L")+" L"+pts[pts.length-1][0]+","+svgH+" Z":"";
        const zeroY=svgH-((0-minCurve)/curveRange)*svgH;
        let runBal=0;
        const balanceHistory=raceStats.map(r=>{runBal=parseFloat((runBal+r.profit).toFixed(2));return{name:r.race.name,profit:r.profit,bal:runBal};});
        const peakBal=Math.max(...balanceHistory.map(b=>b.bal),0);
        const troughBal=Math.min(...balanceHistory.map(b=>b.bal),0);
        return(
          <div style={{marginBottom:24}}>
            <h3 className="cg" style={{fontSize:18,fontWeight:700,marginBottom:14}}>📈 Your Season in Charts</h3>

            {/* SVG Profit Journey */}
            <div className="card" style={{marginBottom:12,padding:"20px 16px",background:"linear-gradient(135deg,#f8fffe,#f0fff8)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:14}}>
                <div>
                  <span className="cg" style={{fontSize:15,fontWeight:700}}>📈 Profit Journey</span>
                  <div className="sy" style={{fontSize:11,color:C.soft,marginTop:2}}>Cumulative profit race by race</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <span className="cg" style={{fontSize:22,fontWeight:800,color:profit>=0?C.green:C.red}}>{profit>=0?"+":""}{fmt(profit)}</span>
                  <div className="sy" style={{fontSize:10,color:C.soft}}>total</div>
                </div>
              </div>
              <div style={{overflowX:"auto"}}>
                <svg width={svgW} height={svgH+20} style={{display:"block"}}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={profit>=0?"#15803d":"#dc2626"} stopOpacity="0.3"/>
                      <stop offset="100%" stopColor={profit>=0?"#15803d":"#dc2626"} stopOpacity="0.02"/>
                    </linearGradient>
                  </defs>
                  <line x1="0" y1={zeroY} x2={svgW} y2={zeroY} stroke="#e5e7eb" strokeWidth="1.5" strokeDasharray="4,3"/>
                  {fillD&&<path d={fillD} fill="url(#profitGrad)"/>}
                  {pts.map(([x,y],i)=>(<circle key={i} cx={x} cy={y} r="3" fill={profitCurve[i].profit>=0?"#15803d":"#dc2626"} opacity=".8"/>))}
                  {pathD&&<path d={pathD} fill="none" stroke={profit>=0?"#15803d":"#dc2626"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>}
                  {profitCurve.length>0&&<text x="2" y={svgH+16} fontSize="9" fill="#9ca3af">Race 1</text>}
                  {profitCurve.length>1&&<text x={svgW-30} y={svgH+16} fontSize="9" fill="#9ca3af">Race {profitCurve.length}</text>}
                </svg>
              </div>
            </div>

            {/* Win Rate + Streak */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
              <div className="card" style={{textAlign:"center",padding:"20px 12px"}}>
                <div className="sy" style={{fontSize:11,fontWeight:700,color:C.soft,marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Race Win Rate</div>
                <div style={{position:"relative",width:90,height:90,margin:"0 auto 10px"}}>
                  <svg viewBox="0 0 36 36" style={{transform:"rotate(-90deg)",width:90,height:90}}>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0f0f0" strokeWidth="3.5"/>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke={raceWinRate>=50?"#15803d":raceWinRate>=30?"#b45309":"#dc2626"} strokeWidth="3.5" strokeDasharray={`${raceWinRate} ${100-raceWinRate}`} strokeLinecap="round"/>
                  </svg>
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                    <span className="cg" style={{fontSize:22,fontWeight:800,color:raceWinRate>=50?"#15803d":raceWinRate>=30?"#b45309":"#dc2626"}}>{raceWinRate}%</span>
                  </div>
                </div>
                <div className="sy" style={{fontSize:12,color:C.soft}}>{racesWon}W · {racesLost}L</div>
              </div>
              <div className="card" style={{textAlign:"center",padding:"20px 12px",background:streak&&streak.count>1?(streak.type==="win"?"rgba(21,128,61,.05)":"rgba(185,28,28,.05)"):"transparent"}}>
                <div className="sy" style={{fontSize:11,fontWeight:700,color:C.soft,marginBottom:10,textTransform:"uppercase",letterSpacing:".06em"}}>Current Streak</div>
                {streak&&streak.count>0?(
                  <><div style={{fontSize:44,marginBottom:4}}>{streak.type==="win"?"🔥":"❄️"}</div>
                  <div className="cg" style={{fontSize:26,fontWeight:800,color:streak.type==="win"?C.green:C.red}}>{streak.count}</div>
                  <div className="sy" style={{fontSize:12,color:streak.type==="win"?C.green:C.red,marginTop:2}}>{streak.type==="win"?"wins":"losses"} in a row</div></>
                ):<div className="sy" style={{fontSize:13,color:C.muted,marginTop:24}}>No streak yet</div>}
              </div>
            </div>

            {/* Bet Type Hit Rate — mini rings */}
            {typeData.length>0&&(
              <div className="card" style={{marginBottom:12,padding:"20px 16px"}}>
                <div className="sy" style={{fontSize:14,fontWeight:700,marginBottom:16}}>🎯 Bet Type Hit Rate</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:16,justifyContent:"center",marginBottom:14}}>
                  {typeData.map(t=>(
                    <div key={t.id} style={{textAlign:"center",width:70}}>
                      <div style={{position:"relative",width:60,height:60,margin:"0 auto 6px"}}>
                        <svg viewBox="0 0 36 36" style={{transform:"rotate(-90deg)",width:60,height:60}}>
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#f0f0f0" strokeWidth="4"/>
                          <circle cx="18" cy="18" r="14" fill="none" stroke={t.col} strokeWidth="4" strokeDasharray={`${t.hitRate} ${100-t.hitRate}`} strokeLinecap="round"/>
                        </svg>
                        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <span style={{fontSize:10,fontWeight:800,color:t.col}}>{t.hitRate}%</span>
                        </div>
                      </div>
                      <div className="sy" style={{fontSize:10,fontWeight:700}}>{t.label}</div>
                      <div className="sy" style={{fontSize:9,color:C.soft,marginTop:1}}>{t.wins}/{t.count}</div>
                      <div className="sy" style={{fontSize:10,fontWeight:700,color:t.profit>=0?C.green:C.red,marginTop:1}}>{t.profit>=0?"+":""}{fmt(t.profit)}</div>
                    </div>
                  ))}
                </div>
                {typeData.map(t=>(
                  <div key={t.id} style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:t.col,flexShrink:0}}/>
                    <span className="sy" style={{fontSize:10,color:C.soft,width:56,flexShrink:0}}>{t.label}</span>
                    <div style={{display:"flex",gap:2,flex:1,flexWrap:"wrap"}}>
                      {settled.filter(b=>b.type===t.id).map((b,bi)=>(
                        <div key={bi} style={{width:10,height:10,borderRadius:2,background:b.won?t.col:"#e5e7eb",flexShrink:0}} title={b.won?"Won +"+fmt(b.payout||0):"Lost -"+fmt(b.stake)}/>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="sy" style={{fontSize:9,color:C.muted,marginTop:8}}>Each square = one bet · Coloured = hit · Grey = missed</div>
              </div>
            )}

            {/* Race Form Timeline */}
            {raceStats.length>0&&(
              <div className="card" style={{marginBottom:12,padding:"20px 16px"}}>
                <div className="sy" style={{fontSize:14,fontWeight:700,marginBottom:12}}>🗓 Race Form Timeline</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {raceStats.map((r,i)=>{
                    const intensity=Math.min(1,Math.abs(r.profit)/Math.max(...raceStats.map(x=>Math.abs(x.profit)),1));
                    const bg=r.profit>=0?"rgba(21,128,61,"+(0.15+intensity*0.75)+")":"rgba(220,38,38,"+(0.15+intensity*0.75)+")";
                    return(<div key={i} title={r.race.name+": "+(r.profit>=0?"+":"")+r.profit.toFixed(2)} style={{width:isMobile?28:36,height:isMobile?28:36,borderRadius:6,background:bg,display:"flex",alignItems:"center",justifyContent:"center",cursor:"default",flexShrink:0}}><span style={{fontSize:isMobile?9:10,fontWeight:700,color:"#fff"}}>{r.profit>=0?"W":"L"}</span></div>);
                  })}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:10,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:3}}>{[0.2,0.5,0.8].map((v,i)=><div key={i} style={{width:14,height:14,borderRadius:3,background:"rgba(21,128,61,"+v+")"}}/>)}</div>
                  <span className="sy" style={{fontSize:9,color:C.muted}}>Small→Big Win</span>
                  <div style={{display:"flex",gap:3}}>{[0.2,0.5,0.8].map((v,i)=><div key={i} style={{width:14,height:14,borderRadius:3,background:"rgba(220,38,38,"+v+")"}}/>)}</div>
                  <span className="sy" style={{fontSize:9,color:C.muted}}>Small→Big Loss</span>
                </div>
              </div>
            )}

            {/* Barrier Heatmap */}
            {Object.keys(numFreq).length>0&&(
              <div className="card" style={{marginBottom:12,padding:"20px 16px"}}>
                <div className="sy" style={{fontSize:14,fontWeight:700,marginBottom:4}}>🎯 Favourite Barriers</div>
                <div className="sy" style={{fontSize:11,color:C.soft,marginBottom:12}}>Which barrier numbers you back most</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {Array.from({length:Math.max(...Object.keys(numFreq).map(Number),1)},(_,i)=>i+1).map(n=>{
                    const freq=numFreq[n]||0;const intensity=freq/maxFreq;
                    return(<div key={n} style={{width:36,height:36,borderRadius:8,background:freq>0?"rgba(30,92,30,"+(0.1+intensity*0.85)+")":"#f4f5f7",display:"flex",alignItems:"center",justifyContent:"center",cursor:"default"}} title={"#"+n+": backed "+freq+" time"+(freq!==1?"s":"")}><span style={{fontSize:12,fontWeight:700,color:freq>0?(intensity>0.5?"#fff":C.accent):C.muted}}>{n}</span></div>);
                  })}
                </div>
                {luckyNum&&<div className="sy" style={{fontSize:12,color:C.accent,fontWeight:700,marginTop:10}}>Your luckiest barrier: #{luckyNum[0]} ({luckyNum[1]}× backed)</div>}
              </div>
            )}

            {/* Stake size breakdown */}
            {bucketData.length>0&&(
              <div className="card" style={{marginBottom:12,padding:"20px 16px"}}>
                <div className="sy" style={{fontSize:14,fontWeight:700,marginBottom:4}}>💰 Results by Stake Size</div>
                <div className="sy" style={{fontSize:11,color:C.soft,marginBottom:12}}>Do bigger bets pay off?</div>
                {bucketData.map(b=>{
                  const bProfit=parseFloat((b.payout-b.staked).toFixed(2));
                  const hitRate=b.total?Math.round((b.wins/b.total)*100):0;
                  return(<div key={b.label} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span className="sy" style={{fontSize:12,fontWeight:600}}>{b.label} <span style={{color:C.muted,fontWeight:400}}>· {b.total} bets · {hitRate}% hit</span></span><span className="sy" style={{fontSize:12,fontWeight:700,color:bProfit>=0?C.green:C.red}}>{bProfit>=0?"+":""}{fmt(bProfit)}</span></div><div style={{height:10,background:"#f0f0f0",borderRadius:5,overflow:"hidden"}}><div style={{height:"100%",width:hitRate+"%",background:bProfit>=0?C.green:C.red,borderRadius:5}}/></div></div>);
                })}
              </div>
            )}

            {/* Balance tracker */}
            <div className="card" style={{padding:"20px 16px"}}>
              <div className="sy" style={{fontSize:14,fontWeight:700,marginBottom:12}}>⚖️ Balance Tracker</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:10}}>
                <div style={{textAlign:"center",padding:"10px 6px",background:"rgba(21,128,61,.07)",borderRadius:8}}>
                  <div className="sy" style={{fontSize:9,color:C.soft,marginBottom:3,textTransform:"uppercase",letterSpacing:".06em"}}>Peak</div>
                  <div className="cg" style={{fontSize:16,fontWeight:700,color:C.green}}>+{fmt(peakBal)}</div>
                </div>
                <div style={{textAlign:"center",padding:"10px 6px",background:profit>=0?"rgba(21,128,61,.07)":"rgba(185,28,28,.07)",borderRadius:8}}>
                  <div className="sy" style={{fontSize:9,color:C.soft,marginBottom:3,textTransform:"uppercase",letterSpacing:".06em"}}>Now</div>
                  <div className="cg" style={{fontSize:16,fontWeight:700,color:profit>=0?C.green:C.red}}>{profit>=0?"+":""}{fmt(profit)}</div>
                </div>
                <div style={{textAlign:"center",padding:"10px 6px",background:"rgba(185,28,28,.07)",borderRadius:8}}>
                  <div className="sy" style={{fontSize:9,color:C.soft,marginBottom:3,textTransform:"uppercase",letterSpacing:".06em"}}>Trough</div>
                  <div className="cg" style={{fontSize:16,fontWeight:700,color:C.red}}>{fmt(troughBal)}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:3,height:40,alignItems:"flex-end"}}>
                {balanceHistory.map((b,i)=>(<div key={i} title={b.name+": "+(b.profit>=0?"+":"")+b.profit.toFixed(2)} style={{flex:1,height:"100%",display:"flex",flexDirection:"column",justifyContent:b.profit>=0?"flex-end":"flex-start",cursor:"default"}}><div style={{background:b.profit>=0?C.green:C.red,borderRadius:2,height:Math.max(4,Math.abs(b.profit)/Math.max(...raceStats.map(r=>Math.abs(r.profit)),1)*38)+"px",opacity:.8}}/></div>))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                <span className="sy" style={{fontSize:9,color:C.muted}}>Race 1</span>
                <span className="sy" style={{fontSize:9,color:C.muted}}>Race {raceStats.length}</span>
              </div>
            </div>
          </div>
        );
      })()}


      {/* Pending bets */}
      {upcomingRaces.length>0&&(
        <div style={{marginBottom:20}}>
          <h3 className="cg" style={{fontSize:18,fontWeight:700,marginBottom:10}}>Upcoming Bets</h3>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {upcomingRaces.map(race=>{
              const rb=bets.filter(b=>b.raceId===race.id);
              const bal=getRaceBalance(account.id,race.id);
              return(
                <div key={race.id} className="card" style={{borderLeft:`3px solid ${bal===0?C.green:C.accent}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div className="cg" style={{fontSize:16,fontWeight:700}}>{race.name}</div>
                      <div className="sy" style={{fontSize:12,color:C.soft}}>{race.venue} · {new Date(race.date).toLocaleDateString("en-AU",{day:"numeric",month:"short"})}</div>
                    </div>
                    <span className="badge sy" style={{background:bal===0?C.greenBg:C.accentGlow,color:bal===0?C.green:C.accent,border:`1px solid ${bal===0?C.greenBd:C.accent}`,fontSize:12}}>{bal===0?"✓ Spent":"$"+bal.toFixed(2)+" left"}</span>
                  </div>
                  {rb.length>0?(
                    <div style={{display:"flex",flexDirection:"column",gap:4}}>
                      {rb.map(b=>{
                        const td=BET_TYPES.find(t=>t.id===b.type);
                        return(
                          <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7}}>
                            <div>
                              <span className="sy" style={{fontSize:13,fontWeight:700}}>{td?.label}</span>
                              <span className="sy" style={{fontSize:12,color:C.soft}}> · #{b.horses.join(" → #")}</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                              <span className="sy" style={{fontSize:13,fontWeight:700}}>{fmt(b.stake)}</span>
                              {race.status==="upcoming"&&(
                                <button className="sy" style={{fontSize:11,padding:"3px 8px",borderRadius:5,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:700}} onClick={()=>{if(window.confirm("Cancel this bet?")) onCancelBet(b.id);}}>Cancel</button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ):<p className="sy" style={{fontSize:13,color:C.red,fontWeight:600}}>⚠ No bets placed yet — must spend {fmt(bal)}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Race by race results */}
      {finishedRaces.length>0&&(
        <div style={{marginBottom:20}}>
          <h3 className="cg" style={{fontSize:18,fontWeight:700,marginBottom:10}}>Race Results</h3>
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
                      <div className="sy" style={{fontSize:12,color:C.soft}}>{race.venue} · {new Date(race.date).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}</div>
                      {winner&&<div className="sy" style={{fontSize:12,marginTop:2,color:C.accent,fontWeight:600}}>🥇 {winner.name}</div>}
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <div className="sy" style={{fontSize:11,color:C.soft}}>Your result</div>
                      <div className="cg" style={{fontSize:18,fontWeight:700,color:raceProfit>=0?C.green:C.red}}>{raceProfit>=0?"+":""}{fmt(raceProfit)}</div>
                    </div>
                  </div>
                  {rb.length>0&&(
                    <div style={{display:"flex",flexDirection:"column",gap:3}}>
                      {rb.map(b=>{
                        const td=BET_TYPES.find(t=>t.id===b.type);
                        return(
                          <div key={b.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 10px",background:b.won===true?C.greenBg:b.won===false?C.redBg:C.surface,border:`1px solid ${b.won===true?C.greenBd:b.won===false?C.redBd:C.border}`,borderRadius:7}}>
                            <span className="sy" style={{fontSize:12}}><strong>{td?.label}</strong> · #{b.horses.join(" → #")} · {fmt(b.stake)}</span>
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
          <p className="sy" style={{fontSize:14,color:C.soft}}>Head to the Races tab to place your first bet!</p>
        </div>
      )}

      {/* Change PIN modal */}
      {showPinChange&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowPinChange(false)}>
          <div className="modal sr">
            <h3 className="cg" style={{fontSize:22,fontWeight:700,marginBottom:16}}>Change PIN</h3>
            {pinStep==="new"?(
              <>
                <p className="sy" style={{fontSize:14,color:C.soft,marginBottom:14}}>Enter your new 4-digit PIN:</p>
                <PinPad value={newPin} onChange={v=>{setNewPin(v);if(v.length===4)handleNewPin();}}/>
                {pinErr&&<p className="sy" style={{color:C.red,fontSize:13,marginTop:10,textAlign:"center"}}>{pinErr}</p>}
              </>
            ):(
              <>
                <p className="sy" style={{fontSize:14,color:C.soft,marginBottom:14}}>Confirm your new PIN:</p>
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

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminScreen({races, accounts, bets, adminUnlocked, setAdminUnlocked, onSettle, onScratch, onResetPin, onAddRace, onAddHorse, onAddHorses, onDeleteRace, onEditRace, onEditHorse, seasonMessage, onSeasonMessage, toast, onLockRace}) {
  const w = useWindowWidth();
  const isMobile = w < 700;
  const [inputs, setInputs] = useState({});
  const [adminPinEntry, setAdminPinEntry] = useState("");
  const [adminTab, setAdminTab] = useState("races");
  const [expandedPlayer, setExpandedPlayer] = useState(null);
  const [resetPinFor, setResetPinFor] = useState(null);
  const [resetPinVal, setResetPinVal] = useState("");
  const [resetPinStep, setResetPinStep] = useState("new");
  const [resetPinVal2, setResetPinVal2] = useState("");
  const [resetPinErr, setResetPinErr] = useState("");
  const [showAddRace, setShowAddRace] = useState(false);
  const [newRace, setNewRace] = useState({name:"",venue:"",date:"",distance:"",raceNum:"",raceTime:"",oddsAsOf:""});
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
      grade: "Group 1",
      status: "upcoming",
      horses: [],
      result: null,
    };
    onAddRace(race);
    setNewRace({name:"",venue:"",date:"",distance:"",raceNum:"",raceTime:"",oddsAsOf:""});
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
        // Try to extract from free text — look for numbers at end for odds
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
        <p className="sy soft" style={{fontSize:12, marginBottom:20}}>Enter your admin PIN to manage races.</p>
        <PinPad value={adminPinEntry} onChange={v => {
          setAdminPinEntry(v);
          if (v.length === 4) {
            if (v === ADMIN_PIN) setAdminUnlocked(true);
            else { toast("Incorrect PIN", "err"); setAdminPinEntry(""); }
          }
        }}/>
      </div>
    </div>
  );

  return (
    <div className="fu">
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16}}>
        <h2 className="cg" style={{fontSize:26, fontWeight:700}}>Admin</h2>
        <div style={{display:"flex", gap:8}}>
          <span className="badge sy" style={{background:C.greenBg, color:C.green, border:`1px solid ${C.greenBd}`}}>🔓 Active</span>
          <button className="btn btn-ghost sy" style={{fontSize:10}} onClick={() => setAdminUnlocked(false)}>Lock</button>
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
                      <div style={{width:40, height:40, borderRadius:"50%", background:`linear-gradient(135deg,${C.accent},#3b82f6)`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color:"#fff", flexShrink:0}}>
                        {player.name[0].toUpperCase()}
                      </div>
                      <div style={{flex:1, minWidth:0}}>
                        <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
                          <span className="cg" style={{fontSize:18, fontWeight:700}}>{player.name}</span>
                          {activeBets.length > 0 && <span className="badge sy" style={{background:C.blueBg, color:C.blue, border:`1px solid ${C.blueBd}`}}>{activeBets.length} pending</span>}
                          {racesUnbet.length > 0 && <span className="badge sy" style={{background:C.redBg, color:C.red, border:`1px solid ${C.redBd}`}}>{racesUnbet.length} race{racesUnbet.length>1?"s":""} unbet</span>}
                          <button className="sy" style={{fontSize:10,padding:"2px 8px",borderRadius:5,border:`1px solid ${C.border}`,background:"#f4f5f7",color:C.soft,cursor:"pointer",fontWeight:600}}
                            onClick={e=>{e.stopPropagation();setResetPinFor(player.id);setResetPinVal("");setResetPinVal2("");setResetPinStep("new");setResetPinErr("");}}>
                            🔑 Reset PIN
                          </button>
                        </div>
                        <div className="sy soft" style={{fontSize:11, marginTop:2}}>{player.email} · Joined {new Date(player.createdAt).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}</div>
                      </div>
                      <div style={{textAlign:"right", flexShrink:0}}>
                        <div className="sy soft" style={{fontSize:9, textTransform:"uppercase", letterSpacing:".08em"}}>Net profit</div>
                        <div className="cg" style={{fontSize:18, fontWeight:700, color:profit>=0?C.green:C.red}}>{profit>=0?"+":""}{fmt(profit)}</div>
                      </div>
                      <span style={{fontSize:14, color:C.muted, marginLeft:4}}>{isExpanded ? "▲" : "▼"}</span>
                    </div>

                    <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8, marginTop:12, padding:"10px 0", borderTop:`1px solid ${C.border}`}}>
                      {[["Bets",playerBets.length],["Won",wonBets.length],["Lost",lostBets.length],["Pending",activeBets.length]].map(([l,v]) => (
                        <div key={l} style={{textAlign:"center"}}>
                          <div className="sy soft" style={{fontSize:9, textTransform:"uppercase", letterSpacing:".08em", marginBottom:2}}>{l}</div>
                          <div className="sy" style={{fontSize:16, fontWeight:700}}>{v}</div>
                        </div>
                      ))}
                    </div>

                    {isExpanded && (
                      <div style={{marginTop:12}}>
                        {racesUnbet.length > 0 && (
                          <div style={{padding:"8px 12px", background:C.redBg, border:`1px solid ${C.redBd}`, borderRadius:8, marginBottom:12}}>
                            <p className="sy" style={{fontSize:12, color:C.red, fontWeight:700, marginBottom:4}}>⚠ No bets placed on:</p>
                            {racesUnbet.map(r => <p key={r.id} className="sy" style={{fontSize:11, color:C.red}}>· {r.name} ({new Date(r.date).toLocaleDateString("en-AU",{day:"numeric",month:"short"})})</p>)}
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
                                const def = BET_TYPES.find(t => t.id === b.type);
                                const horses = b.horses.map(n => { const h = race?.horses.find(x => x.number===n); return `#${n} ${h?.name||""}`; }).join(" → ");
                                return (
                                  <div key={b.id} style={{display:"flex", justifyContent:"space-between", padding:"7px 10px", marginBottom:4, background:b.won===true?C.greenBg:b.won===false?C.redBg:C.surface, border:`1px solid ${b.won===true?C.greenBd:b.won===false?C.redBd:C.border}`, borderRadius:7}}>
                                    <span className="sy" style={{fontSize:12}}><strong>{def?.label}</strong> · {horses}</span>
                                    <span className="sy" style={{fontSize:11, fontWeight:700, color:b.won===true?C.green:b.won===false?C.red:C.soft, flexShrink:0, marginLeft:10}}>
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
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <p className="sy" style={{fontSize:12,color:C.soft}}>Click horses into finishing order, enter TAB dividends, then settle.</p>
            <button className="btn btn-gold sy" style={{fontSize:12,padding:"8px 16px",flexShrink:0}} onClick={()=>setShowAddRace(true)}>+ Add Race</button>
          </div>

          {/* Race day checklist */}
          {races.filter(r=>r.status==="upcoming"||r.status==="closed").map(race=>{
            const hasHorses = race.horses.filter(h=>!h.scratched).length > 0;
            const hasOddsAsOf = !!race.oddsAsOf;
            const hasScratchCheck = true; // reminder only
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
                  <span className="sy" style={{fontSize:13,fontWeight:700}}>{allDone?"✅":"📋"} {race.name} — Race Day Checklist</span>
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {steps.map(step=>(
                    <span key={step.label} className="sy" style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:step.done?C.greenBg:C.redBg,color:step.done?C.green:C.red,border:`1px solid ${step.done?C.greenBd:C.redBd}`,fontWeight:600}}>
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
              <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:6}}>Message text</label>
              <textarea className="inp sy" rows={3}
                value={seasonMessage?.text||""}
                onChange={e=>onSeasonMessage({...seasonMessage,text:e.target.value})}
                style={{fontSize:13,resize:"none",width:"100%"}}/>
              {seasonMessage?.enabled&&<p className="sy" style={{fontSize:11,marginTop:6,color:C.green}}>✓ Message is live on the Race Calendar.</p>}
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
                      <p className="sy soft" style={{fontSize:11, marginTop:2}}>{race.venue} · {race.distance} · {new Date(race.date).toLocaleDateString("en-AU",{day:"numeric",month:"short",year:"numeric"})}</p>
                      <p className="sy soft" style={{fontSize:11}}>{rb.length} bet{rb.length!==1?"s":""} placed</p>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
                      {/* Quick Lock button */}
                      {race.status==="upcoming"&&(
                        <button className="sy" style={{fontSize:12,padding:"7px 14px",borderRadius:8,border:"2px solid #dc2626",background:"#dc2626",color:"#fff",cursor:"pointer",fontWeight:700}}
                          onClick={()=>{ if(window.confirm(`Lock betting on "${race.name}" now? Players won't be able to place more bets.`)) onLockRace(race.id); }}>
                          🔒 Lock Betting Now
                        </button>
                      )}
                      <div style={{display:"flex",gap:6}}>
                        <button className="sy" style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"#f4f5f4",color:C.soft,cursor:"pointer",fontWeight:600}}
                          onClick={()=>{
                            const r=races.find(x=>x.id===race.id);
                            setEditRaceFor(race.id);
                            setEditRaceForm({name:r.name,venue:r.venue,date:r.date,distance:r.distance,raceNum:r.raceNum,raceTime:r.raceTime||"",oddsAsOf:r.oddsAsOf||""});
                          }}>
                          ✏️ Edit Race
                        </button>
                        {race.status !== "finished" && rb.length === 0 && (
                          <button className="sy" style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:600}}
                            onClick={()=>{ if(window.confirm(`Delete "${race.name}"? This cannot be undone.`)) onDeleteRace(race.id); }}>
                            🗑 Delete
                          </button>
                        )}
                        {race.status === "finished" && (
                          <button className="sy" style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:600}}
                            onClick={()=>{ if(window.confirm(`Delete "${race.name}"? All bet history will be removed.`)) onDeleteRace(race.id); }}>
                            🗑 Delete
                          </button>
                        )}
                      </div>
                      {race.status === "finished" && (
                      <div className="sy" style={{textAlign:"right",fontSize:11}}>
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
                              <div key={l} style={{color:C.green,fontSize:11}}>{l}: ${parseFloat(v).toFixed(2)}</div>
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
                        <p className="sy soft" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em"}}>Horses ({race.horses.filter(h=>!h.scratched).length} active)</p>
                        <div style={{display:"flex",gap:6}}>
                          <button className="sy" style={{fontSize:11,padding:"3px 10px",borderRadius:5,border:`1px solid ${C.border}`,background:"#f4f5f7",color:C.soft,cursor:"pointer",fontWeight:600}}
                            onClick={()=>{setBulkImportFor(race.id);setBulkText("");setBulkErr("");setBulkPreview([]);}}>
                            📋 Bulk Import
                          </button>
                          <button className="sy" style={{fontSize:11,padding:"3px 10px",borderRadius:5,border:`1px solid ${C.accent}`,background:C.accentGlow,color:C.accent,cursor:"pointer",fontWeight:700}}
                            onClick={()=>{setAddHorseFor(race.id);setHorseForm({name:"",jockey:"",trainer:"",winOdds:"",placeOdds:""});setHorseErr("");}}>
                            + Add Horse
                          </button>
                        </div>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:race.horses.length>0?16:8}}>
                        {race.horses.length===0
                          ? <p className="sy soft" style={{fontSize:12}}>No horses added yet. Click + Add Horse to build the field.</p>
                          : race.horses.map(h=>(
                            <button key={h.number} className="sy" style={{fontSize:10,padding:"3px 9px",borderRadius:6,border:`1px solid ${h.scratched?C.redBd:C.border}`,background:h.scratched?C.redBg:"#f4f5f7",color:h.scratched?C.red:C.soft,cursor:"pointer",textDecoration:h.scratched?"line-through":"",display:"inline-flex",alignItems:"center",gap:4}}>
                              <span onClick={()=>!h.scratched&&onScratch(race.id,h.number)}>#{h.number} {h.name}{h.scratched?" SCR":""}</span>
                              {!h.scratched&&<span style={{color:C.accent,fontSize:11}} onClick={e=>{e.stopPropagation();setEditHorseFor({raceId:race.id,horseNum:h.number});setEditHorseForm({name:h.name,jockey:h.jockey||"",trainer:h.trainer||"",winOdds:String(h.winOdds),placeOdds:String(h.placeOdds),weight:h.weight||"",silkUrl:h.silkUrl||""});}}>✏️</span>}
                            </button>
                          ))
                        }
                      </div>

                      {/* Click-to-select finishers */}
                      <p className="sy soft" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>Select Finishing Order — click a horse then tap a position</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:12}}>
                        {["1st 🥇","2nd 🥈","3rd 🥉","4th"].map((label,pos)=>{
                          const finishers = getInp(race.id).finishers || [null,null,null,null];
                          const sel = finishers[pos];
                          const horse = sel ? race.horses.find(h=>h.number===sel) : null;
                          return (
                            <div key={pos} style={{textAlign:"center"}}>
                              <div className="sy soft" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".08em",marginBottom:5}}>{label}</div>
                              <div style={{minHeight:52,padding:"6px 8px",border:`2px solid ${sel?C.accent:C.border}`,borderRadius:8,background:sel?"#eef3ff":"#fafbfc",cursor:"default",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                                {horse
                                  ? <><div style={{fontWeight:700,fontSize:12,color:C.accent}}>#{horse.number}</div><div className="sy" style={{fontSize:11,color:C.text}}>{horse.name}</div></>
                                  : <span className="sy soft" style={{fontSize:11}}>—</span>}
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
                              {/* Horse card — tap cycles through 1st→2nd→3rd→4th→off */}
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
                                {h.silkUrl&&<img src={h.silkUrl} alt="" style={{width:28,height:28,objectFit:"contain",marginBottom:3}} onError={e=>e.target.style.display="none"}/>}
                                <div className="cg" style={{fontSize:13,fontWeight:700,color:posLabel?posColor:C.text}}>#{h.number}</div>
                                <div className="sy" style={{fontSize:10,color:posLabel?posColor:C.soft,fontWeight:posLabel?700:400,marginTop:1}}>{h.name.split(" ")[0]}</div>
                              </button>
                              {/* Position badge */}
                              <span className="sy" style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:20,background:posLabel?`${posColor}22`:"#f0f0f0",color:posLabel?posColor:C.muted}}>
                                {posLabel||"—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* TAB Dividends */}
                      <p className="sy soft" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>Enter TAB Dividends (actual paid prices)</p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:14}}>
                        {[
                          ["win",      "Win — 1st",         true],
                          ["place1",   "Place — 1st",       true],
                          ["place2",   "Place — 2nd",       false],
                          ["place3",   "Place — 3rd",       false],
                          ["place4",   "Place — 4th",       false],
                          ["quinella", "Quinella",          false],
                          ["exacta",   "Exacta",            false],
                          ["trifecta", "Trifecta",          false],
                          ["firstfour","First Four",        false],
                        ].map(([key,label,required])=>(
                          <div key={key}>
                            <label className="sy" style={{fontSize:10,display:"block",marginBottom:3,fontWeight:required?700:400,color:required?C.text:C.soft}}>
                              {label}{required?" *":""}
                            </label>
                            <div style={{position:"relative"}}>
                              <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.muted,pointerEvents:"none"}}>$</span>
                              <input className="inp-sm sy" type="number" step="0.01" min="0" placeholder="0.00"
                                value={getInp(race.id).divs?.[key]||""}
                                onChange={e=>setDiv(race.id,key,e.target.value)}
                                style={{paddingLeft:22}}/>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{padding:"10px 14px",background:"rgba(26,86,160,.05)",border:"1px solid rgba(26,86,160,.15)",borderRadius:8,marginBottom:12}}>
                        <p className="sy soft" style={{fontSize:11}}>* Win and Place 1st are required. Only enter dividends for bet types that were actually placed on this race.</p>
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
                              <div className="sy" style={{fontSize:11,fontWeight:700,marginBottom:6,color:allGood?C.green:C.gold}}>
                                {allGood?"✅ Ready to settle":"📋 Pre-settlement checklist"}
                              </div>
                              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                                {checks.map(c=>(
                                  <span key={c.label} className="sy" style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:c.done?C.greenBg:C.redBg,color:c.done?C.green:C.red,border:`1px solid ${c.done?C.greenBd:C.redBd}`,fontWeight:600}}>
                                    {c.done?"✓":"✗"} {c.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {missingPlayers.length>0&&defaultHorse&&(
                              <div style={{padding:"10px 14px",borderRadius:8,background:"rgba(184,134,11,.08)",border:"1px solid rgba(184,134,11,.4)"}}>
                                <div className="sy" style={{fontSize:11,fontWeight:700,color:C.gold,marginBottom:4}}>
                                  🤖 Auto-bet will be applied to {missingPlayers.length} player{missingPlayers.length>1?"s":""}:
                                </div>
                                <div className="sy" style={{fontSize:11,color:C.text,marginBottom:4}}>
                                  <strong>$24 Win on #{defaultHorse.number} {defaultHorse.name}</strong> (horse #1 by runner number)
                                </div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                                  {missingPlayers.map(a=>(
                                    <span key={a.id} className="sy" style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(184,134,11,.15)",color:C.gold,border:"1px solid rgba(184,134,11,.3)",fontWeight:600}}>{a.name}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <button className="btn btn-gold sy" style={{fontSize:12,width:"100%",padding:12}} onClick={()=>settle(race.id)}>
                        ✓ Settle Race &amp; Pay Winnings
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk Import modal */}
      {bulkImportFor&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setBulkImportFor(null)}>
          <div className="modal sr" style={{maxWidth:560}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <h3 className="cg" style={{fontSize:22,fontWeight:700}}>📋 Bulk Import Horses</h3>
              <button className="btn btn-ghost sy" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>setBulkImportFor(null)}>Close</button>
            </div>
            <p className="cg" style={{fontSize:16,fontWeight:700,marginBottom:4}}>{races.find(r=>r.id===bulkImportFor)?.name}</p>
            <p className="sy soft" style={{fontSize:12,marginBottom:10}}>Paste one horse per line in this format:</p>
            <div style={{padding:"10px 14px",background:"#f0f4ff",border:`1px solid rgba(26,86,160,.2)`,borderRadius:8,marginBottom:14,fontFamily:"monospace",fontSize:11,color:C.soft,lineHeight:1.8}}>
              1. Red Sentinel (2) | J D Gibbons | T G Ryan & S Alexiou | 15.00 | 3.60 | f6 | 58.5<br/>
              <span style={{opacity:.6}}>form, weight and silk URL (last 3 columns) are all optional</span>
            </div>
            <textarea
              className="inp sy"
              rows={10}
              placeholder={"1. Sacrify | J A Bullock | T Annabel & R Archibald | 5.00 | 1.95\n2. Amplify | J C Schofield | T C Maher | 9.50 | 2.90\n3. Tambeloa | J M Fitzgerald | T K Buchanan | 7.00 | 2.40"}
              value={bulkText}
              onChange={e=>{
                setBulkText(e.target.value);
                setBulkErr("");
                setBulkPreview([]);
              }}
              style={{marginBottom:10,fontFamily:"monospace",fontSize:12,resize:"vertical"}}
            />
            {bulkErr&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10}}>{bulkErr}</p>}

            {/* Preview */}
            {bulkPreview.length>0&&(
              <div style={{marginBottom:14}}>
                <p className="sy" style={{fontSize:12,fontWeight:700,color:C.green,marginBottom:8}}>✓ {bulkPreview.length} horses ready to import:</p>
                <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
                  {bulkPreview.map((h,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,fontSize:12,gap:8,alignItems:"center"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        {h.silkUrl&&<img src={h.silkUrl} alt="silk" style={{width:24,height:24,objectFit:"contain",borderRadius:3}}/>}
                        <span className="sy"><strong>#{h.number} {h.name}</strong> <span style={{color:C.soft}}>· {h.jockey} · {h.trainer}</span></span>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
                        {h.form&&h.form.length>0&&<span className="sy" style={{fontSize:11,color:C.soft}}>{h.form.join("-")}</span>}
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
                  if (horses.length===0) return setBulkErr("No horses found — check your format.");
                  setBulkPreview(horses);
                }}>Preview Import →</button>
              ):(
                <>
                  <button className="btn btn-ghost" style={{padding:12,fontSize:13}} onClick={()=>setBulkPreview([])}>← Edit</button>
                  <button className="btn btn-gold" style={{flex:1,padding:12,fontSize:13}} onClick={()=>{
                    onAddHorses(bulkImportFor, bulkPreview);
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
              <button className="btn btn-ghost sy" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>setAddHorseFor(null)}>Close</button>
            </div>
            <p className="sy soft" style={{fontSize:12,marginBottom:14}}>Adding to: <strong style={{color:C.text}}>{races.find(r=>r.id===addHorseFor)?.name}</strong></p>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
              <div>
                <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Horse Name *</label>
                <input className="inp sy" placeholder="e.g. Without A Fight" value={horseForm.name} onChange={e=>setHorseForm(p=>({...p,name:e.target.value}))}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Jockey</label>
                  <input className="inp sy" placeholder="e.g. J. McDonald" value={horseForm.jockey} onChange={e=>setHorseForm(p=>({...p,jockey:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Trainer</label>
                  <input className="inp sy" placeholder="e.g. C. Waller" value={horseForm.trainer} onChange={e=>setHorseForm(p=>({...p,trainer:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Win Odds *</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.muted,pointerEvents:"none"}}>$</span>
                    <input className="inp sy" type="number" step="0.1" min="1" placeholder="4.50" value={horseForm.winOdds} onChange={e=>setHorseForm(p=>({...p,winOdds:e.target.value}))} style={{paddingLeft:22}}/>
                  </div>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Place Odds *</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",fontSize:13,color:C.muted,pointerEvents:"none"}}>$</span>
                    <input className="inp sy" type="number" step="0.1" min="1" placeholder="1.80" value={horseForm.placeOdds} onChange={e=>setHorseForm(p=>({...p,placeOdds:e.target.value}))} style={{paddingLeft:22}}/>
                  </div>
                </div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div>
                <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Weight <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
                <input className="inp sy" placeholder="e.g. 58" value={horseForm.weight||""} onChange={e=>setHorseForm(p=>({...p,weight:e.target.value}))}/>
              </div>
              <div>
                <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Recent Form <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
                <input className="inp sy" placeholder="e.g. 1x2x3x4" value={horseForm.form||""} onChange={e=>setHorseForm(p=>({...p,form:e.target.value}))}/>
              </div>
            </div>
            <div>
              <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Silk Image URL <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
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
            <p className="sy soft" style={{fontSize:11,marginTop:10}}>You can keep adding horses one by one. Click Done when the full field is entered.</p>
          </div>
        </div>
      )}

      {/* Add Race modal */}
      {showAddRace&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setShowAddRace(false)}>
          <div className="modal sr">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h3 className="cg" style={{fontSize:22,fontWeight:700}}>Add New Race</h3>
              <button className="btn btn-ghost sy" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>setShowAddRace(false)}>Close</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
              <div>
                <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Race Name *</label>
                <input className="inp sy" placeholder="e.g. Turnbull Stakes" value={newRace.name} onChange={e=>setNewRace(p=>({...p,name:e.target.value}))}/>
              </div>
              <div>
                <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:6}}>Grade *</label>
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
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Venue *</label>
                  <input className="inp sy" placeholder="e.g. Flemington" value={newRace.venue} onChange={e=>setNewRace(p=>({...p,venue:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Date *</label>
                  <input className="inp sy" type="date" value={newRace.date} onChange={e=>setNewRace(p=>({...p,date:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Race Time (AEST) *</label>
                  <input className="inp sy" type="time" value={newRace.raceTime} onChange={e=>setNewRace(p=>({...p,raceTime:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Distance *</label>
                  <input className="inp sy" placeholder="e.g. 2000m" value={newRace.distance} onChange={e=>setNewRace(p=>({...p,distance:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Race No.</label>
                  <input className="inp sy" placeholder="e.g. Race 7" value={newRace.raceNum} onChange={e=>setNewRace(p=>({...p,raceNum:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Odds As Of <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
                  <input className="inp sy" placeholder="e.g. Thursday 10am" value={newRace.oddsAsOf} onChange={e=>setNewRace(p=>({...p,oddsAsOf:e.target.value}))}/>
                </div>
              </div>
            </div>
            {newRaceErr&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10}}>{newRaceErr}</p>}
            <p className="sy soft" style={{fontSize:11,marginBottom:14}}>Once created, you can add horses via the race card in Race Management.</p>
            <button className="btn btn-gold" style={{width:"100%",padding:13,fontSize:13}} onClick={handleAddRace}>Create Race →</button>
          </div>
        </div>
      )}

      {/* Edit Race modal */}
      {editRaceFor&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setEditRaceFor(null)}>
          <div className="modal sr">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <h3 className="cg" style={{fontSize:22,fontWeight:700}}>✏️ Edit Race</h3>
              <button className="btn btn-ghost sy" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>setEditRaceFor(null)}>Close</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
              <div>
                <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Race Name</label>
                <input className="inp sy" value={editRaceForm.name||""} onChange={e=>setEditRaceForm(p=>({...p,name:e.target.value}))}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Venue</label>
                  <input className="inp sy" value={editRaceForm.venue||""} onChange={e=>setEditRaceForm(p=>({...p,venue:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Date</label>
                  <input className="inp sy" type="date" value={editRaceForm.date||""} onChange={e=>setEditRaceForm(p=>({...p,date:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Race Time (AEST)</label>
                  <input className="inp sy" type="time" value={editRaceForm.raceTime||""} onChange={e=>setEditRaceForm(p=>({...p,raceTime:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Distance</label>
                  <input className="inp sy" placeholder="e.g. 2000m" value={editRaceForm.distance||""} onChange={e=>setEditRaceForm(p=>({...p,distance:e.target.value}))}/>
                </div>
              </div>
              <div>
                <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Race No.</label>
                <input className="inp sy" placeholder="e.g. Race 7" value={editRaceForm.raceNum||""} onChange={e=>setEditRaceForm(p=>({...p,raceNum:e.target.value}))}/>
              </div>
              <div>
                <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Odds As Of <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
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
              <button className="btn btn-ghost sy" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>setEditHorseFor(null)}>Close</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:12}}>
              <div>
                <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Horse Name</label>
                <input className="inp sy" value={editHorseForm.name||""} onChange={e=>setEditHorseForm(p=>({...p,name:e.target.value}))}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Jockey</label>
                  <input className="inp sy" value={editHorseForm.jockey||""} onChange={e=>setEditHorseForm(p=>({...p,jockey:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Trainer</label>
                  <input className="inp sy" value={editHorseForm.trainer||""} onChange={e=>setEditHorseForm(p=>({...p,trainer:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Win Odds</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.muted}}>$</span>
                    <input className="inp sy" type="number" step="0.1" value={editHorseForm.winOdds||""} onChange={e=>setEditHorseForm(p=>({...p,winOdds:e.target.value}))} style={{paddingLeft:22}}/>
                  </div>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Place Odds</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:C.muted}}>$</span>
                    <input className="inp sy" type="number" step="0.1" value={editHorseForm.placeOdds||""} onChange={e=>setEditHorseForm(p=>({...p,placeOdds:e.target.value}))} style={{paddingLeft:22}}/>
                  </div>
                </div>
              </div>
              <div>
                <label className="sy soft" style={{fontSize:11,textTransform:"uppercase",letterSpacing:".06em",display:"block",marginBottom:4}}>Silk Image URL <span style={{fontWeight:400,textTransform:"none"}}>(optional)</span></label>
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
              <button className="btn btn-ghost sy" style={{fontSize:10,padding:"5px 10px"}} onClick={()=>setResetPinFor(null)}>Close</button>
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
                  Next — Confirm →
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
