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
    id:"trifecta", label:"Trifecta", desc:"Pick 1st, 2nd & 3rd in order",
    positions:[{label:"1st",key:"p1"},{label:"2nd",key:"p2"},{label:"3rd",key:"p3"}],
    check:(horses,res) => horses[0]===res.first && horses[1]===res.second && horses[2]===res.third,
    multiplier:(horses,om) => {
      const o = n => om[n]?.winOdds||1;
      return parseFloat((o(horses[0])*o(horses[1])*o(horses[2])/6).toFixed(2));
    },
  },
  {
    id:"firstfour", label:"First Four", desc:"Pick 1st, 2nd, 3rd & 4th in order",
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
const formColor = f => f==="1"?"#16803a":f==="2"?"#1a56a0":f==="3"?"#b8860b":["4","5"].includes(f)?"#9aa0b0":"#d1d5db";

// Get how much a player has already staked on a specific race
function raceStaked(bets, playerId, raceId) {
  return bets
    .filter(b => b.playerId === playerId && b.raceId === raceId)
    .reduce((s, b) => s + b.stake, 0);
}

// ─── THEME — Racing green, gold & white. Clear for ages 20-70 ────────────────
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
  text:"#0f1a0f",    // near-black with green tint — very readable
  soft:"#4a5c4a",    // medium green-grey
  muted:"#8a9e8a",   // light for placeholders
};

const silkCol = n => ["#dc2626","#1d4ed8","#15803d","#92400e","#7c3aed","#0e7490","#be185d","#d97706","#065f46","#1e3a8a","#9f1239","#0f766e","#b45309","#374151"][(n-1)%14];

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Merriweather:wght@700;900&family=Inter:wght@400;500;600;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:${C.bg};-webkit-font-smoothing:antialiased;font-size:16px}
.cg{font-family:'Merriweather',Georgia,serif}
.sy{font-family:'Inter',system-ui,sans-serif}
input,button,select,textarea{font-family:'Inter',system-ui,sans-serif}
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
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:13px 24px;border-radius:10px;border:none;cursor:pointer;font-weight:700;font-size:15px;letter-spacing:.02em;transition:all .15s;font-family:'Inter',sans-serif}
.btn-gold{background:${C.accent};color:#fff;box-shadow:0 2px 6px rgba(30,92,30,.25)}
.btn-gold:hover:not(:disabled){background:${C.accentL};transform:translateY(-1px);box-shadow:0 4px 14px rgba(30,92,30,.35)}
.btn-gold:disabled{opacity:.35;cursor:not-allowed}
.btn-ghost{background:#fff;color:${C.soft};border:2px solid ${C.border}}
.btn-ghost:hover{color:${C.text};border-color:${C.muted};background:${C.surface}}
.btn-danger{background:${C.redBg};color:${C.red};border:2px solid ${C.redBd}}
.btn-danger:hover{background:#fef2f2}

/* Nav tabs */
.tab{padding:9px 16px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600;border:none;background:transparent;color:rgba(255,255,255,.65);transition:all .15s;font-family:'Inter',sans-serif}
.tab.on{background:rgba(255,255,255,.18);color:#fff;font-weight:700}
.tab:hover:not(.on){background:rgba(255,255,255,.1);color:rgba(255,255,255,.9)}

/* Badges */
.badge{display:inline-block;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.03em;font-family:'Inter',sans-serif}

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
.topt{flex:1;padding:10px;text-align:center;cursor:pointer;font-size:13px;font-weight:700;transition:all .15s;border:none;background:transparent;color:${C.muted};font-family:'Inter',sans-serif}
.topt.on{background:${C.accent};color:#fff}
.topt:hover:not(.on){background:${C.surface}}

/* Animations */
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideR{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}
@keyframes notif{from{opacity:0;transform:translateX(110%)}to{opacity:1;transform:translateX(0)}}
.fu{animation:fadeUp .28s ease} .sr{animation:slideR .22s ease}

/* Modal */
.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:2000;backdrop-filter:blur(4px);padding:16px}
.modal{background:#fff;border:1px solid ${C.border};border-radius:16px;padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.18)}

/* Pin pad buttons */
.pin-btn{padding:18px 0;border-radius:12px;border:2px solid ${C.border};background:#fff;color:${C.text};font-size:22px;font-weight:700;cursor:pointer;transition:all .12s;font-family:'Inter',sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.pin-btn:hover{background:#f0f5f0;border-color:${C.accent};color:${C.accent}}

/* ── RESPONSIVE ── */
/* Mobile bottom nav — replaces header nav on small screens */
@media(max-width:640px){
  .desktop-nav{display:none!important}
  .mobile-nav{display:flex!important}
  .mobile-hide{display:none!important}
  .card{padding:16px}
  .modal{padding:20px;border-radius:12px}
  .btn{font-size:14px;padding:12px 18px}
  .inp{font-size:16px;padding:12px 14px}
  h1.cg{font-size:34px!important}
  h2.cg{font-size:24px!important}
  h3.cg{font-size:20px!important}
}
@media(min-width:641px){
  .desktop-nav{display:flex!important}
  .mobile-nav{display:none!important}
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

  // Load all data from Supabase on startup + restore session
  useEffect(() => {
    (async () => {
      try {
        const [accs, dbBets, dbRaces] = await Promise.all([
          sb.select("accounts", "order=created_at.asc"),
          sb.select("bets", "order=placed_at.asc"),
          sb.select("races"),
        ]);

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
        if (r.status !== "upcoming" || !r.raceTime || !r.date) return r;
        const raceDateTime = new Date(`${r.date}T${r.raceTime}:00`);
        if (now >= raceDateTime) {
          // Auto-close
          sb.update("races", r.id, { status: "closed" });
          return { ...r, status: "closed" };
        }
        return r;
      }));
    }, 30000); // check every 30 seconds
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
    const settled = bets.map(b=>{
      if (b.raceId!==raceId||b.won!==null) return b;
      const def = BET_TYPES.find(t=>t.id===b.type);
      const won = def.check(b.horses, result);
      const payout = won ? calcDividendPayout(b) : 0;
      if (won){wins++;paid=parseFloat((paid+payout).toFixed(2));}
      return {...b,won,payout};
    });
    setBets(settled);
    // Persist bet outcomes to Supabase
    settled.filter(b=>b.raceId===raceId).forEach(b=>{
      sb.update("bets", b.id, { won: b.won, payout: b.payout });
    });
    settled.filter(b=>b.raceId===raceId&&b.won===true).forEach(b=>{
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

    showToast(`Race settled — ${wins} winner${wins!==1?"s":""}, ${fmt(paid)} paid out. Emails sent!`);
  };

  const addRace = (race) => {
    setRaces(p=>[...p, race]);
    sb.insert("races", {
      id: race.id, name: race.name, venue: race.venue,
      date: race.date, race_time: race.raceTime, distance: race.distance,
      race_num: race.raceNum, status: "upcoming",
      horses: JSON.stringify([]), result: null,
    });
    showToast(`${race.name} added!`);
  };

  const addHorseToRace = (raceId, horse) => {
    setRaces(p => {
      const updated = p.map(r => r.id!==raceId ? r : {...r, horses:[...r.horses, horse]});
      const race = updated.find(r=>r.id===raceId);
      if (race) sb.update("races", raceId, { horses: JSON.stringify(race.horses) });
      return updated;
    });
    showToast(`${horse.name} added`);
  };

  const editRace = (raceId, updates) => {
    setRaces(p => p.map(r => r.id !== raceId ? r : {...r, ...updates}));
    sb.update("races", raceId, {
      name: updates.name, venue: updates.venue, date: updates.date,
      race_time: updates.raceTime, distance: updates.distance, race_num: updates.raceNum,
    });
    showToast("Race updated!");
  };

  const editHorse = (raceId, horseNum, updates) => {
    setRaces(p => {
      const updated = p.map(r => r.id !== raceId ? r : {
        ...r, horses: r.horses.map(h => h.number !== horseNum ? h : {...h, ...updates})
      });
      const race = updated.find(r => r.id === raceId);
      if (race) sb.update("races", raceId, { horses: JSON.stringify(race.horses) });
      return updated;
    });
    showToast("Horse updated!");
  };
    setRaces(p => p.filter(r => r.id !== raceId));
    sb.update("races", raceId, { status: "deleted" }).catch(()=>{});
    showToast("Race deleted");
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

  const scratchHorse = (raceId,num) => {
    setRaces(p=>p.map(r=>r.id!==raceId?r:{...r,horses:r.horses.map(h=>h.number===num?{...h,scratched:true}:h)}));
    showToast(`#${num} scratched`);
  };

  const leaderboard = [...accounts].sort((a,b)=>{
    // Sort by total won (winnings) — most profitable first
    const profitA = a.totalWon - a.totalStaked;
    const profitB = b.totalWon - b.totalStaked;
    return profitB - profitA;
  });

  const selectedRace = races.find(r=>r.id===raceId);

  return (
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:"'Syne',system-ui,sans-serif"}}>
      <style>{CSS}</style>

      {loading&&(
        <div style={{position:"fixed",inset:0,background:`linear-gradient(160deg,${C.header} 0%,#2d5a2d 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",zIndex:9999}}>
          <div style={{fontSize:56,marginBottom:16}}>🏇</div>
          <h2 className="cg" style={{fontSize:32,fontWeight:900,color:"#fff",marginBottom:10}}>Spring Carnival</h2>
          <p className="sy" style={{fontSize:15,color:"rgba(255,255,255,.7)"}}>Loading...</p>
        </div>
      )}

      {toast&&(
        <div style={{position:"fixed",top:16,right:16,zIndex:9999,padding:"12px 20px",borderRadius:10,background:toast.type==="err"?"rgba(254,242,242,.98)":"rgba(240,253,244,.98)",border:`1px solid ${toast.type==="err"?C.redBd:C.greenBd}`,color:toast.type==="err"?C.red:C.green,animation:"notif .28s ease",maxWidth:320,fontSize:13,fontFamily:"'Syne',sans-serif",backdropFilter:"blur(16px)",boxShadow:"0 8px 40px rgba(0,0,0,.12)"}}>
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
                {[["lobby","Races"],["leaderboard","Standings"],["season","Season"],["profile","My Account"],["admin","Admin"]].map(([s,l])=>(
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
                  <button className="sy" style={{fontSize:12,padding:"6px 10px",background:"rgba(255,255,255,.12)",border:"1.5px solid rgba(255,255,255,.25)",borderRadius:8,color:"rgba(255,255,255,.85)",cursor:"pointer",fontWeight:600}} onClick={doLogout}>Log out</button>
                </div>
              )}
            </div>
          </header>

          {/* ── MOBILE BOTTOM NAV ── */}
          <nav className="mobile-nav" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:500,background:C.header,borderTop:"2px solid rgba(255,255,255,.15)",display:"flex",boxShadow:"0 -4px 16px rgba(0,0,0,.25)"}}>
            {[["lobby","🏇","Races"],["leaderboard","🏆","Standings"],["season","📊","Season"],["profile","👤","Account"],["admin","⚙️","Admin"]].map(([s,icon,l])=>(
              <button key={s} onClick={()=>setScreen(s)}
                style={{flex:1,padding:"10px 0 8px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"transparent",border:"none",cursor:"pointer",color:screen===s||(screen==="race"&&s==="lobby")?"#fff":"rgba(255,255,255,.55)",transition:"all .15s"}}>
                <span style={{fontSize:20}}>{icon}</span>
                <span className="sy" style={{fontSize:10,fontWeight:700,letterSpacing:".03em"}}>{l}</span>
                {(screen===s||(screen==="race"&&s==="lobby"))&&<div style={{width:24,height:3,background:C.goldL,borderRadius:2,marginTop:2}}/>}
              </button>
            ))}
          </nav>
        </>
      )}

      <main style={{maxWidth:980,margin:"0 auto",padding:screen==="auth"?0:"22px 14px 80px 14px"}}>
        {screen==="auth"&&<AuthScreen onRegister={doRegister} onLogin={doLogin} accounts={accounts}/>}
        {screen==="lobby"&&<LobbyScreen races={races} bets={bets} account={liveAccount} leaderboard={leaderboard} getRaceBalance={getRaceBalance} onSelect={id=>{setRaceId(id);setScreen("race");}}/>}
        {screen==="race"&&selectedRace&&<RaceScreen race={selectedRace} account={liveAccount} bets={bets} getRaceBalance={getRaceBalance} myBets={bets.filter(b=>b.raceId===raceId&&b.playerId===liveAccount?.id)} onBack={()=>setScreen("lobby")} onQueue={queueBet} onCancelBet={cancelBet}/>}
        {screen==="leaderboard"&&<LeaderboardScreen accounts={leaderboard} bets={bets} races={races}/>}
        {screen==="season"&&<SeasonScreen accounts={accounts} bets={bets} races={races}/>}
        {screen==="profile"&&<ProfileScreen account={liveAccount} bets={bets.filter(b=>b.playerId===liveAccount?.id)} races={races} getRaceBalance={getRaceBalance} onChangePin={doChangePin} onCancelBet={cancelBet}/>}
        {screen==="admin"&&<AdminScreen races={races} accounts={accounts} bets={bets} adminUnlocked={adminUnlocked} setAdminUnlocked={setAdminUnlocked} onSettle={settleRace} onScratch={scratchHorse} onResetPin={doAdminResetPin} onAddRace={addRace} onAddHorse={addHorseToRace} onDeleteRace={deleteRace} onEditRace={editRace} onEditHorse={editHorse} toast={showToast}/>}
      </main>

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
  return (
    <div>
      <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:24}}>
        {Array.from({length:maxLen}).map((_,i)=>(
          <div key={i} style={{width:22,height:22,borderRadius:"50%",border:`3px solid ${digits[i]?C.accent:C.border}`,background:digits[i]?C.accent:"transparent",transition:"all .15s"}}/>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12}}>
        {["1","2","3","4","5","6","7","8","9","","0","⌫"].map((k,i)=>(
          <button key={i} onClick={()=>k==="⌫"?del():k===""?null:press(k)}
            style={{padding:"18px 0",borderRadius:12,border:k?`2px solid ${C.border}`:"none",background:k==="⌫"?"#fff2f2":k?"#fff":"transparent",color:k==="⌫"?C.red:C.text,fontSize:k==="⌫"?20:24,fontWeight:700,cursor:k?"pointer":"default",transition:"all .12s",fontFamily:"'Inter',sans-serif",boxShadow:k?"0 2px 6px rgba(0,0,0,.08)":"none"}}
            onMouseEnter={e=>{if(k&&k!=="⌫"){e.currentTarget.style.background="#f0f5f0";e.currentTarget.style.borderColor=C.accent;e.currentTarget.style.color=C.accent;}}}
            onMouseLeave={e=>{if(k&&k!=="⌫"){e.currentTarget.style.background="#fff";e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.text;}}}
          >{k}</button>
        ))}
      </div>
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
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:60,marginBottom:8}}>🏇</div>
          <h1 className="cg" style={{fontSize:46,fontWeight:900,color:"#fff",lineHeight:1.05}}>Spring Carnival</h1>
          <p className="sy" style={{fontSize:14,marginTop:8,color:"rgba(255,255,255,.7)",letterSpacing:".12em",textTransform:"uppercase"}}>Group 1 Tipping Competition</p>
        </div>
        <div className="card fu">
          <div className="tog" style={{marginBottom:22}}>
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
function LobbyScreen({races,bets,account,leaderboard,getRaceBalance,onSelect}) {
  const w = useWindowWidth();
  const isMobile = w < 700;
  const myBets = bets.filter(b=>b.playerId===account?.id);
  const grouped={};
  races.forEach(r=>{if(!grouped[r.date])grouped[r.date]=[];grouped[r.date].push(r);});

  return (
    <div className="fu" style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 220px",gap:16,alignItems:"start"}}>
      <div>
        <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:18}}>
          <h2 className="cg" style={{fontSize:28,fontWeight:700}}>Race Calendar</h2>
          <span className="sy soft" style={{fontSize:11}}>{races.filter(r=>r.status==="upcoming").length} races remaining</span>
        </div>
        {Object.entries(grouped).map(([date,dayRaces])=>{
          return (
            <div key={date} style={{marginBottom:24}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{height:1,flex:1,background:C.border}}/>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span className="sy" style={{fontSize:10,color:C.soft,textTransform:"uppercase",letterSpacing:".12em",whiteSpace:"nowrap"}}>
                    {new Date(date).toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                  </span>
                </div>
                <div style={{height:1,flex:1,background:C.border}}/>
              </div>
              {dayRaces.map(race=>{
                const rb=myBets.filter(b=>b.raceId===race.id);
                const active=race.horses.filter(h=>!h.scratched).length;
                const fav=race.horses.filter(h=>!h.scratched).sort((a,b)=>a.winOdds-b.winOdds)[0];
                const raceBal = account ? getRaceBalance(account.id, race.id) : STARTING_BALANCE;
                return (
                  <div key={race.id} className="card" style={{marginBottom:8,borderLeft:`3px solid ${race.status==="finished"?C.muted:race.status==="closed"?C.red:C.accent}`,cursor:race.status==="upcoming"?"pointer":"default",transition:"all .15s"}}
                    onMouseEnter={e=>{if(race.status==="upcoming"){e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow="0 6px 28px rgba(0,0,0,.5)";}}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}
                    onClick={()=>race.status==="upcoming"&&onSelect(race.id)}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:7}}>
                          <span className="badge sy" style={{background:C.accentGlow,color:C.accent,border:"1px solid rgba(26,86,160,.2)"}}>{race.grade}</span>
                          <span className="badge sy" style={{
                            background:race.status==="finished"?C.greenBg:race.status==="closed"?C.redBg:C.blueBg,
                            color:race.status==="finished"?C.green:race.status==="closed"?C.red:C.blue,
                            border:`1px solid ${race.status==="finished"?C.greenBd:race.status==="closed"?C.redBd:C.blueBd}`
                          }}>{race.status==="closed"?"🔒 Closed":race.status}</span>
                          <span className="badge sy" style={{background:"#f4f5f7",color:C.soft,border:`1px solid ${C.border}`}}>{race.raceNum}</span>
                          {rb.length>0&&<span className="badge sy" style={{background:C.accentGlow,color:C.accent,border:"1px solid rgba(26,86,160,.2)"}}>✓ {rb.length} bet{rb.length>1?"s":""}</span>}
                          {account&&race.status==="upcoming"&&<span className="badge sy" style={{background:raceBal>0?"rgba(26,86,160,.08)":C.redBg,color:raceBal>0?C.accent:C.red,border:`1px solid ${raceBal>0?"rgba(26,86,160,.18)":C.redBd}`}}>{fmt(raceBal)} left</span>}
                        </div>
                        <h3 className="cg" style={{fontSize:22,fontWeight:700,marginBottom:3}}>{race.name}</h3>
                        <p className="sy soft" style={{fontSize:11}}>{race.venue} · {race.distance} · {active} runners{active<race.horses.length?` (${race.horses.length-active} scr)`:""}</p>
                        {fav&&<p className="sy" style={{fontSize:11,marginTop:2,color:C.soft}}>FAV: {fav.name} <span style={{color:C.accent}}>${fav.winOdds.toFixed(1)}</span></p>}
                        {race.raceTime&&race.status==="upcoming"&&(
                          <p className="sy" style={{fontSize:11,marginTop:3,color:C.accent,fontWeight:700}}>🕐 Closes at {race.raceTime} AEST</p>
                        )}
                        {race.status==="closed"&&(
                          <p className="sy" style={{fontSize:11,marginTop:3,color:C.red,fontWeight:700}}>🔒 Betting closed — awaiting result</p>
                        )}
                      </div>
                      <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                        {race.status==="upcoming"&&<button className="btn btn-gold sy" style={{fontSize:10,padding:"6px 14px"}} onClick={e=>{e.stopPropagation();onSelect(race.id);}}>Bet →</button>}
                        {race.status==="finished"&&race.result&&(
                          <div className="sy" style={{fontSize:11,textAlign:"right"}}>
                            {["first","second","third","fourth"].map((k,i)=>{
                              const h=race.horses.find(x=>x.number===race.result[k]);
                              return h?<div key={k} style={{color:i===0?C.accentL:C.soft}}>{["1st","2nd","3rd","4th"][i]}: #{h.number} {h.name}</div>:null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    {rb.length>0&&(
                      <div style={{marginTop:10,display:"flex",flexWrap:"wrap",gap:5}}>
                        {rb.map(b=>{
                          const def=BET_TYPES.find(t=>t.id===b.type);
                          return (
                            <div key={b.id} className="sy" style={{fontSize:10,padding:"3px 9px",borderRadius:20,background:b.won===true?C.greenBg:b.won===false?C.redBg:"#f8f9fb",border:`1px solid ${b.won===true?C.greenBd:b.won===false?C.redBd:C.border}`,color:b.won===true?C.green:b.won===false?C.red:C.soft}}>
                              {def?.label} · {fmt(b.stake)}{b.won===true?` → Won ${fmt(b.payout)}! 🎉`:b.won===false?" · Lost":b.potential?` · pot. ${fmt(b.potential)}`:""}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Sidebar */}
      {!isMobile&&<div style={{position:"sticky",top:70,display:"flex",flexDirection:"column",gap:12}}>
        <div className="card">
          <h4 className="cg" style={{fontSize:17,fontWeight:700,marginBottom:12}}>🏆 Standings</h4>
          {leaderboard.length===0?<p className="sy soft" style={{fontSize:12}}>No players yet.</p>:
            leaderboard.slice(0,6).map((a,i)=>{
              const profit=parseFloat((a.totalWon-a.totalStaked).toFixed(2));
              return(
                <div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:i<Math.min(leaderboard.length-1,5)?`1px solid ${C.border}`:"none"}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <span style={{fontSize:13,width:18}}>{["🥇","🥈","🥉"][i]||`${i+1}.`}</span>
                    <span className="sy" style={{fontSize:12,fontWeight:600}}>{a.name}</span>
                  </div>
                  <span className="cg" style={{fontSize:14,fontWeight:700,color:profit>=0?C.green:C.red}}>{profit>=0?"+":""}{fmt(profit)}</span>
                </div>
              );
            })
          }
        </div>
        <div className="card" style={{background:"rgba(30,92,30,.04)",border:"1px solid rgba(30,92,30,.15)"}}>
          <p className="sy" style={{fontSize:13,color:C.soft,lineHeight:1.6}}>
            💡 <strong style={{color:C.accent}}>$24 per race</strong> — every Group 1 race has its own $24 budget. You must spend all $24 on each race. Leaderboard is ranked by net profit.
          </p>
        </div>
      </div>}
    </div>
  );
}

// ─── RACE SCREEN ──────────────────────────────────────────────────────────────
function RaceScreen({race,account,bets,myBets,getRaceBalance,onBack,onQueue,onCancelBet}) {
  const w = useWindowWidth();
  const isMobile = w < 700;
  const [betType,setBetType]=useState("win");
  const [sel,setSel]=useState({});      // {pos: horseNumber} for each position
  const [stakeStr,setStakeStr]=useState("");
  const [boxed,setBoxed]=useState(false);
  const [showForm,setShowForm]=useState(false);

  const def=BET_TYPES.find(t=>t.id===betType);
  const om=getOddsMap(race.horses);
  const activeHorses=race.horses.filter(h=>!h.scratched);
  const fav=activeHorses.sort((a,b)=>a.winOdds-b.winOdds)[0];
  const raceBalance = account ? getRaceBalance(account.id, race.id) : 0;

  const numPositions=def.positions.length;
  const stake=parseFloat(stakeStr)||0;

  const changeType=id=>{setBetType(id);setSel({});};

  // sel is always {posIdx: [horse numbers]} — supports multiple per position
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
    if(betType==="win"||betType==="place"){
      return (sel[0]||[]).map(n=>[n]);
    }
    const posArrays=def.positions.map((_,i)=>sel[i]||[]);
    if(posArrays.some(a=>a.length===0)) return [];
    return cartesian(posArrays);
  };

  const getBoxedCombos=()=>{
    const allSel=[...new Set(Object.values(sel).flat())];
    if(allSel.length<numPositions) return [];
    function perms(arr,r){if(r===0)return[[]]; return arr.flatMap((v,i)=>perms([...arr.slice(0,i),...arr.slice(i+1)],r-1).map(p=>[v,...p]));}
    return perms(allSel,numPositions);
  };

  const allCombos = boxed&&(betType==="trifecta"||betType==="firstfour") ? getBoxedCombos() : getUnboxedCombos();
  const combos = allCombos.length;

  // Full (standard) number of combos if it were a straight bet (1 combo = flexi 100%)
  // Flexi % = (unit_stake / full_bet_unit_stake) * (your_combos / 1) ... simplified:
  // Flexi % = (stake_per_combo * your_combos) / standard_single_bet_cost * 100
  // For TAB-style flexi: flexi % = stake_per_combo / standard_unit * 100
  // Standard unit for trifecta/firstfour = $1. So flexi% = stake * 100 (as % of $1 unit)
  // More accurately: flexi % = (total_outlay / num_combos) / standard_unit * 100
  // We'll show: flexi % = (stake_per_combo / 1.00) * 100 = stake * 100
  // But the real display is just: each combo is X% of a full unit dividend
  const standardUnit = 1.00;
  const totalCost = stake; // stake IS the total now
  const unitStake = combos > 0 ? parseFloat((stake / combos).toFixed(2)) : stake;
  const avgPotential = combos>0 ? parseFloat((allCombos.reduce((s,h)=>s+def.multiplier(h,om)*unitStake,0)/combos).toFixed(2)) : 0;

  const isReady=()=>{
    if(stake<=0) return false;
    if(combos===0) return false;
    if(stake>raceBalance) return false;
    return true;
  };

  const handleAdd=()=>{
    if(!isReady()) return;
    allCombos.forEach(h=>onQueue(race.id,betType,h,unitStake));
    setSel({});
    setStakeStr("");
  };

  // Which positions each horse is selected for
  const horsePositions=(num)=>{
    if(boxed) return (sel[0]||[]).includes(num)?["Selected"]:[];
    return def.positions.map((p,i)=>(sel[i]||[]).includes(num)?p.label:null).filter(Boolean);
  };

  const canShowBoxed=betType==="trifecta"||betType==="firstfour";

  return (
    <div className="sr">
      <button className="btn btn-ghost sy" style={{marginBottom:14,fontSize:10}} onClick={onBack}>← Back to Races</button>

      {/* Race header */}
      <div className="card" style={{marginBottom:16,borderLeft:`3px solid ${C.accent}`,background:`linear-gradient(135deg,${C.card},rgba(26,86,160,.03))`}}>
        <div style={{display:"flex",gap:5,marginBottom:7}}>
          <span className="badge sy" style={{background:C.accentGlow,color:C.accentL,border:"1px solid rgba(26,86,160,.2)"}}>{race.grade}</span>
          <span className="badge sy" style={{background:C.blueBg,color:C.blue,border:`1px solid ${C.blueBd}`}}>{race.raceNum}</span>
          {fav&&<span className="badge sy" style={{background:"#f4f5f7",color:C.soft,border:`1px solid ${C.border}`}}>FAV: {fav.name} ${fav.winOdds.toFixed(1)}</span>}
        </div>
        <h2 className="cg" style={{fontSize:28,fontWeight:700,marginBottom:3}}>{race.name}</h2>
        <p className="sy soft" style={{fontSize:11}}>{race.venue} · {race.distance} · {new Date(race.date).toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
        <div style={{marginTop:8,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <span className="sy" style={{fontSize:12}}>
            <span className="soft">Budget: </span>
            <strong style={{color:raceBalance>0?C.accentL:C.green}}>{fmt(raceBalance)} remaining</strong>
            <span className="soft"> of $24.00</span>
          </span>
          {raceBalance===STARTING_BALANCE&&(
            <span className="badge sy" style={{background:"rgba(240,79,79,.1)",color:C.red,border:`1px solid rgba(240,79,79,.25)`}}>⚠ You must spend all $24</span>
          )}
          {raceBalance>0&&raceBalance<STARTING_BALANCE&&(
            <span className="badge sy" style={{background:"rgba(26,86,160,.08)",color:C.accentL,border:"1px solid rgba(26,86,160,.2)"}}>Must spend {fmt(raceBalance)} more</span>
          )}
          {raceBalance===0&&(
            <span className="badge sy" style={{background:C.greenBg,color:C.green,border:`1px solid ${C.greenBd}`}}>✓ Full $24 spent</span>
          )}
          <button className="sy" style={{fontSize:11,color:C.soft,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}} onClick={()=>setShowForm(f=>!f)}>
            {showForm?"Hide":"Show"} form guide
          </button>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 290px",gap:14,alignItems:"start"}}>
        {/* Field */}
        <div>
          <div style={{display:"grid",gridTemplateColumns:isMobile?`22px 1fr 58px${showForm?" auto":""}` : `26px 1fr 66px 58px${showForm?" auto":""}`,gap:8,padding:"4px 12px",marginBottom:4}}>
            {["#","Horse / Jockey","Win",...(isMobile?[]:["Place"]),...(showForm?["Form"]:[""])].map((h,i)=>(
              <span key={i} className="sy soft" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em",textAlign:i>1&&i<4?"center":"left"}}>{h}</span>
            ))}
          </div>

          {race.horses.map((h,idx)=>{
            const scr=h.scratched;
            const posLabels=horsePositions(h.number);
            const isSel=posLabels.length>0;
            return (
              <div key={h.number} className={`hrow${scr?" scr":" clickable"}${isSel?" sel":""}`}
                style={{gridTemplateColumns:isMobile?`22px 1fr 58px${showForm?" auto":""}` : `26px 1fr 66px 58px${showForm?" auto":""}`,background:isSel?"#e8f5e8":idx%2===0?"#fafbfc":"transparent"}}
                onClick={()=>{
                  if(scr) return;
                  if(betType==="win"||betType==="place") toggleHorse(0,h.number);
                  // trifecta/firstfour: handled by position buttons
                }}>
                <div style={{width:22,height:22,borderRadius:"50%",background:scr?"#e5e7eb":silkCol(h.number),display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0}}>{h.number}</div>
                <div>
                  <div className="sy" style={{fontWeight:600,fontSize:13,textDecoration:scr?"line-through":"",display:"flex",alignItems:"center",gap:6}}>
                    {h.name}
                    {posLabels.length>0&&posLabels.map(pl=>(
                      <span key={pl} style={{fontSize:9,padding:"1px 5px",background:C.accent,color:"#fff",borderRadius:4,fontWeight:800}}>{pl}</span>
                    ))}
                    {scr&&<span className="badge sy" style={{background:C.redBg,color:C.red,border:`1px solid ${C.redBd}`,fontSize:9}}>SCR</span>}
                  </div>
                  <div className="sy soft" style={{fontSize:10,marginTop:1}}>{h.jockey} · {h.trainer}</div>
                  {/* Position buttons for trifecta/firstfour unboxed */}
                  {!scr&&(betType==="trifecta"||betType==="firstfour")&&(
                    <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
                      {boxed?(
                        <button className="sy" style={{fontSize:9,padding:"2px 8px",borderRadius:5,border:`1px solid ${(sel[0]||[]).includes(h.number)?C.accent:C.borderMid}`,background:(sel[0]||[]).includes(h.number)?C.accentGlow:"transparent",color:(sel[0]||[]).includes(h.number)?C.accent:C.muted,cursor:"pointer",fontWeight:700,letterSpacing:".04em"}}
                          onClick={e=>{e.stopPropagation();toggleHorse(0,h.number);}}>
                          {(sel[0]||[]).includes(h.number)?"✓ Selected":"+ Select"}
                        </button>
                      ):(
                        def.positions.map((pos,pi)=>{
                          const isThis=(sel[pi]||[]).includes(h.number);
                          return(
                            <button key={pi} className="sy" style={{fontSize:9,padding:"2px 7px",borderRadius:5,border:`1px solid ${isThis?C.accent:C.border}`,background:isThis?C.accentGlow:"transparent",color:isThis?C.accent:C.muted,cursor:"pointer",fontWeight:700,letterSpacing:".04em"}}
                              onClick={e=>{e.stopPropagation();toggleHorse(pi,h.number);}}>
                              {pos.label}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
                <div className="cg gold" style={{textAlign:"center",fontWeight:700,fontSize:16}}>${h.winOdds.toFixed(1)}</div>
                <div className="sy soft" style={{textAlign:"center",fontSize:12}}>${h.placeOdds.toFixed(1)}</div>
                {showForm&&(
                  <div style={{display:"flex",gap:3,alignItems:"center"}}>
                    {h.form.map((f,fi)=>(
                      <span key={fi} style={{width:15,height:15,borderRadius:3,background:formColor(f),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff"}}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bet panel */}
        <div style={{position:isMobile?"static":"sticky",top:70}}>
          <div className="card">
            <h3 className="cg" style={{fontSize:18,fontWeight:700,marginBottom:12}}>Place a Bet</h3>

            {/* Bet type selector */}
            <p className="sy soft" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}}>Bet Type</p>
            <div style={{display:"flex",flexDirection:"column",gap:3,marginBottom:12}}>
              {BET_TYPES.map(t=>(
                <button key={t.id} onClick={()=>changeType(t.id)} className="sy"
                  style={{padding:"9px 12px",borderRadius:7,border:`1px solid ${betType===t.id?C.accent:C.border}`,background:betType===t.id?C.accentGlow:"transparent",color:betType===t.id?C.accentL:C.soft,cursor:"pointer",textAlign:"left",fontSize:12,transition:"all .13s",fontWeight:betType===t.id?700:400}}>
                  <span style={{fontWeight:700}}>{t.label}</span>
                  <span style={{opacity:.55,fontSize:10,marginLeft:6}}>— {t.desc}</span>
                </button>
              ))}
            </div>

            {/* Boxed toggle for trifecta/firstfour */}
            {canShowBoxed&&(
              <div style={{marginBottom:12}}>
                <div className="tog">
                  <button className={`topt${!boxed?" on":""}`} onClick={()=>{setBoxed(false);setSel({});}}>Unboxed</button>
                  <button className={`topt${boxed?" on":""}`} onClick={()=>{setBoxed(true);setSel({});}}>Boxed</button>
                </div>
                <p className="sy" style={{fontSize:10,color:C.soft,marginTop:6,lineHeight:1.5}}>
                  {boxed
                    ? `Boxed: select ${numPositions}+ horses in any order. All permutations are covered — one bet per combo.`
                    : `Unboxed: click position buttons (${def.positions.map(p=>p.label).join(", ")}) next to each horse.`}
                </p>
              </div>
            )}

            {/* Selection summary */}
            <div className="divider"/>
            <div style={{marginBottom:12,minHeight:36}}>
              {betType==="win"||betType==="place"?(
                (sel[0]||[]).length===0
                  ? <p className="sy soft" style={{fontSize:11}}>← Tap a horse from the field to select</p>
                  : <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {(sel[0]||[]).map(n=>{
                        const h=race.horses.find(x=>x.number===n);
                        return <span key={n} style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",background:C.accentGlow,border:`1px solid rgba(26,86,160,.22)`,borderRadius:20}}>
                          <div style={{width:16,height:16,borderRadius:"50%",background:silkCol(n),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#fff"}}>{n}</div>
                          <span className="sy" style={{fontSize:11,fontWeight:600,color:C.text}}>{h?.name}</span>
                          <span className="sy" style={{fontSize:11,color:C.accent,fontWeight:700}}>${h?.winOdds.toFixed(1)}</span>
                        </span>;
                      })}
                    </div>
              ):(
                boxed?(
                  <div>
                    <p className="sy soft" style={{fontSize:10,marginBottom:5}}>Selected ({(sel[0]||[]).length} of {numPositions}+ needed):</p>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {(sel[0]||[]).length===0?<span className="sy soft" style={{fontSize:11}}>None — use Select buttons on each horse</span>:
                        (sel[0]||[]).map(n=>{
                          const h=race.horses.find(x=>x.number===n);
                          return <span key={n} className="sy" style={{fontSize:10,padding:"3px 8px",background:C.accentGlow,border:"1px solid rgba(26,86,160,.2)",borderRadius:20,color:C.accent}}>#{n} {h?.name}</span>;
                        })}
                    </div>
                  </div>
                ):(
                  <div>
                    <p className="sy soft" style={{fontSize:10,marginBottom:6}}>Use the position buttons on each horse row. You can select <strong style={{color:C.text}}>multiple horses per position</strong> for more combinations.</p>
                    {def.positions.map((pos,pi)=>{
                      const posHorses=(sel[pi]||[]).map(n=>race.horses.find(h=>h.number===n)).filter(Boolean);
                      return(
                        <div key={pi} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,flexWrap:"wrap"}}>
                          <span className="sy" style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.accent,width:26,flexShrink:0}}>{pos.label}</span>
                          {posHorses.length===0
                            ? <span className="sy soft" style={{fontSize:10}}>— not selected</span>
                            : posHorses.map(h=>(
                                <span key={h.number} style={{fontSize:10,padding:"2px 8px",background:C.accentGlow,border:"1px solid rgba(26,86,160,.2)",borderRadius:12,color:C.accent,fontFamily:"'Syne',sans-serif",fontWeight:600}}>
                                  #{h.number} {h.name}
                                </span>
                              ))
                          }
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>

            {/* Stake input */}
            <div className="divider"/>
            <p className="sy soft" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em",marginBottom:6}}>
              Stake
            </p>
            <input
              className="inp sy"
              type="number"
              step="0.50"
              min="0.10"
              placeholder="Enter amount (e.g. 2.00)"
              value={stakeStr}
              onChange={e=>setStakeStr(e.target.value)}
            />
            <p className="sy" style={{fontSize:10,marginTop:5,color:raceBalance===0?C.green:C.soft}}>
              {raceBalance===0
                ? "✓ Full $24 spent on this race"
                : <><span style={{color:C.soft}}>Remaining: </span><strong style={{color:raceBalance>0?C.accent:C.green}}>{fmt(raceBalance)}</strong><span style={{color:C.soft}}> — you must spend all $24</span></>
              }
            </p>

            {/* Cost breakdown with flexi % */}
            {stake>0&&combos>0&&(
              <div style={{marginTop:10,padding:"12px 14px",background:"rgba(26,86,160,.05)",border:"1px solid rgba(26,86,160,.15)",borderRadius:8}}>
                {combos>1&&(
                  <>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span className="sy soft" style={{fontSize:10}}>Combinations</span>
                      <span className="sy" style={{fontSize:13,fontWeight:700,color:C.text}}>{combos}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span className="sy soft" style={{fontSize:10}}>Per combination</span>
                      <span className="sy" style={{fontSize:12,color:C.text}}>{fmt(parseFloat((stake/combos).toFixed(2)))}</span>
                    </div>
                  </>
                )}
                {(betType==="trifecta"||betType==="firstfour")&&combos>1&&(
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,padding:"5px 8px",background:"rgba(26,86,160,.07)",borderRadius:5}}>
                    <span className="sy" style={{fontSize:10,fontWeight:700,color:C.accent}}>Flexi %</span>
                    <span className="sy" style={{fontSize:13,fontWeight:700,color:C.accent}}>{parseFloat(((stake/combos)/1*100).toFixed(1))}%</span>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",borderTop:combos>1?`1px solid rgba(26,86,160,.12)`:"none",paddingTop:combos>1?7:0,marginTop:combos>1?2:0}}>
                  <span className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em"}}>Total Stake</span>
                  <span className="cg" style={{fontSize:20,fontWeight:700,color:C.text}}>{fmt(stake)}</span>
                </div>
                {stake>raceBalance&&<p className="sy" style={{fontSize:10,color:C.red,marginTop:4}}>⚠ Exceeds race budget ({fmt(raceBalance)} remaining)</p>}
                {avgPotential>0&&(
                  <div style={{borderTop:`1px solid rgba(26,86,160,.12)`,marginTop:6,paddingTop:6,display:"flex",justifyContent:"space-between"}}>
                    <span className="sy soft" style={{fontSize:10}}>Avg potential payout</span>
                    <span className="sy" style={{fontSize:12,fontWeight:700,color:C.green}}>{fmt(avgPotential)}</span>
                  </div>
                )}
                {(betType==="trifecta"||betType==="firstfour")&&combos>1&&(
                  <p className="sy" style={{fontSize:10,color:C.soft,marginTop:6,lineHeight:1.5}}>
                    💡 Your ${fmt(stake)} stake is split across {combos} combinations ({fmt(parseFloat((stake/combos).toFixed(2)))} each). Flexi % = {parseFloat(((stake/combos)/1*100).toFixed(0))}% of the full dividend.
                  </p>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              className="btn btn-gold"
              disabled={!isReady()}
              onClick={handleAdd}
              style={{width:"100%",marginTop:12,padding:13,fontSize:13}}
            >
              {!isReady()
                ? (stake<=0?"Enter a stake amount"
                  :combos===0?"Complete your selection"
                  :stake>raceBalance?"Exceeds race budget"
                  :"Complete your selection")
                : `Add ${combos} bet${combos>1?"s":""} to Betslip →`}
            </button>

            {/* Existing bets on this race */}
            {myBets.length>0&&(
              <>
                <div className="divider"/>
                <p className="sy soft" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em",marginBottom:8}}>Your bets on this race</p>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {myBets.map(b=>{
                    const d=BET_TYPES.find(t=>t.id===b.type);
                    const canCancel = b.won===null && race.status==="upcoming";
                    return(
                      <div key={b.id} style={{padding:"8px 10px",background:b.won===true?C.greenBg:b.won===false?C.redBg:"#f4f5f7",border:`1px solid ${b.won===true?C.greenBd:b.won===false?C.redBd:C.border}`,borderRadius:8}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span className="sy" style={{fontSize:12,color:b.won===true?C.green:b.won===false?C.red:C.text,fontWeight:600}}>
                            {d?.label} · {fmt(b.stake)}
                          </span>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span className="sy" style={{fontSize:12,fontWeight:700,color:b.won===true?C.green:b.won===false?C.red:C.soft}}>
                              {b.won===true?`Won ${fmt(b.payout)}`:b.won===false?`Lost ${fmt(b.stake)}`:b.potential?`Pot. ${fmt(b.potential)}`:"Pending"}
                            </span>
                            {canCancel&&(
                              <button className="sy" style={{fontSize:10,padding:"3px 8px",borderRadius:5,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:600}}
                                onClick={()=>{ if(window.confirm("Cancel this bet? Your stake will be refunded.")) onCancelBet(b.id); }}>
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="sy soft" style={{fontSize:11,marginTop:3}}>
                          #{b.horses.join(" → ")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── BETSLIP MODAL ────────────────────────────────────────────────────────────
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
                      <div className="sy soft" style={{fontSize:11}}>{def?.label} · #{b.horses.join(" → #")}</div>
                      <div style={{display:"flex",gap:10,marginTop:3}}>
                        <span className="sy" style={{fontSize:11,color:C.accentL}}>Stake: {fmt(b.stake)}</span>
                        {b.potential>0&&<span className="sy" style={{fontSize:11,color:C.green}}>Pot: {fmt(b.potential)}</span>}
                      </div>
                    </div>
                    <button className="sy" style={{fontSize:18,background:"none",border:"none",cursor:"pointer",color:C.muted,padding:"0 0 0 8px",lineHeight:1}} onClick={()=>onRemove(b.id)}>×</button>
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
function LeaderboardScreen({accounts,bets,races}) {
  const medals=["🥇","🥈","🥉"]; const medalC=["#ffd700","#c0c0c0","#cd7f32"];
  return (
    <div className="fu">
      <h2 className="cg" style={{fontSize:28,fontWeight:700,marginBottom:6}}>Leaderboard</h2>
      <p className="sy soft" style={{fontSize:12,marginBottom:18}}>Ranked by net profit. Each Group 1 race has its own $24 budget — you must spend all $24 on every race.</p>
      {accounts.length===0?<p className="sy soft">No players yet.</p>:(
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:32}}>
          {accounts.map((a,i)=>{
            const pb=bets.filter(b=>b.playerId===a.id);
            const won=pb.filter(b=>b.won===true).length, lost=pb.filter(b=>b.won===false).length, pend=pb.filter(b=>b.won===null).length;
            const profit=parseFloat((a.totalWon-a.totalStaked).toFixed(2));
            return(
              <div key={a.id} className="card" style={{display:"flex",alignItems:"center",gap:14,borderLeft:`3px solid ${medalC[i]||C.border}`}}>
                <div className="cg" style={{fontSize:26,width:32,textAlign:"center",flexShrink:0}}>{medals[i]||<span className="sy soft" style={{fontSize:13}}>#{i+1}</span>}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className="cg" style={{fontSize:20,fontWeight:700}}>{a.name}</div>
                  <div className="sy soft" style={{fontSize:10,marginTop:1}}>{a.email}</div>
                  <div className="sy" style={{fontSize:10,marginTop:4,color:C.soft}}>
                    {pb.length} bets · <span style={{color:C.green}}>{won}W</span> · <span style={{color:C.red}}>{lost}L</span>{pend>0&&<span> · {pend} pending</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div className="sy soft" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em"}}>Net Profit</div>
                  <div className="cg" style={{fontSize:22,fontWeight:700,color:profit>=0?C.green:C.red}}>{profit>=0?"+":""}{fmt(profit)}</div>
                  <div className="sy soft" style={{fontSize:10}}>Won: {fmt(a.totalWon)} · Staked: {fmt(a.totalStaked)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3 className="cg" style={{fontSize:20,marginBottom:12}}>Results Log</h3>
      {!bets.filter(b=>b.won!==null).length?<p className="sy soft">No settled bets yet.</p>:(
        <div style={{display:"flex",flexDirection:"column",gap:3}}>
          {[...bets].filter(b=>b.won!==null).reverse().map(bet=>{
            const a=accounts.find(x=>x.id===bet.playerId), race=races.find(r=>r.id===bet.raceId), td=BET_TYPES.find(t=>t.id===bet.type);
            return(
              <div key={bet.id} className="sy" style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 12px",background:bet.won?C.greenBg:C.redBg,border:`1px solid ${bet.won?C.greenBd:C.redBd}`,borderRadius:6,fontSize:12}}>
                <div>
                  <span style={{fontWeight:600}}>{a?.name}</span>
                  <span style={{color:C.soft}}> · {race?.name} · {td?.label} · #{bet.horses.join(" → #")}</span>
                </div>
                <div style={{color:bet.won?C.green:C.red,fontWeight:700,flexShrink:0,marginLeft:10}}>{bet.won?`+${fmt(bet.payout)}`:`-${fmt(bet.stake)}`}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SEASON SUMMARY ───────────────────────────────────────────────────────────
function SeasonScreen({accounts, bets, races}) {
  const w = useWindowWidth();
  const isMobile = w < 700;

  const finishedRaces = races.filter(r => r.status === "finished");

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
      <div className="card" style={{marginBottom:20,borderLeft:`3px solid ${C.accent}`}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:50,height:50,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},#3b82f6)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:700,color:"#fff",flexShrink:0}}>
            {account.name[0].toUpperCase()}
          </div>
          <div style={{flex:1}}>
            <h2 className="cg" style={{fontSize:26,fontWeight:700}}>{account.name}</h2>
            <p className="sy soft" style={{fontSize:11}}>{account.email} · Joined {new Date(account.createdAt).toLocaleDateString("en-AU",{month:"short",year:"numeric"})}</p>
            <button className="sy" style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:11,fontWeight:700,textDecoration:"underline",padding:0,marginTop:4}} onClick={()=>{setShowPinChange(true);setPinStep("new");setNewPin("");setNewPin2("");setPinErr("");setPinOk(false);}}>
              Change PIN
            </button>
            {pinOk&&<span className="sy" style={{fontSize:11,color:C.green,marginLeft:10}}>✓ PIN updated!</span>}
          </div>
          <div style={{textAlign:"right"}}>
            <div className="sy soft" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em"}}>Net Profit</div>
            <div className="cg" style={{fontSize:26,fontWeight:700,color:profit>=0?C.green:C.red}}>{profit>=0?"+":""}{fmt(profit)}</div>
          </div>
        </div>
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

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:10,marginBottom:20}}>
        {[["Staked",fmt(account.totalStaked),null],["Won",fmt(account.totalWon),C.green],["Win Rate",`${winRate}%`,parseInt(winRate)>30?C.green:C.red],["ROI",`${roi}%`,parseFloat(roi)>=0?C.green:C.red]].map(([l,v,col])=>(
          <div key={l} className="surface" style={{textAlign:"center"}}>
            <div className="sy soft" style={{fontSize:9,textTransform:"uppercase",letterSpacing:".1em",marginBottom:4}}>{l}</div>
            <div className="cg" style={{fontSize:20,fontWeight:700,color:col||C.text}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Per-race budgets */}
      <div style={{marginBottom:20}}>
        <h4 className="cg" style={{fontSize:18,fontWeight:700,marginBottom:4}}>Race Budgets</h4>
        <p className="sy soft" style={{fontSize:11,marginBottom:10}}>Every Group 1 race has its own $24 — you must spend the full amount on each race.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
          {races.map(race=>{
            const bal=getRaceBalance(account.id,race.id);
            const used=STARTING_BALANCE-bal;
            const pct=Math.min((used/STARTING_BALANCE)*100,100);
            return(
              <div key={race.id} className="surface" style={{borderLeft:`3px solid ${race.status==="finished"?C.muted:bal>0?C.accent:C.red}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5}}>
                  <div className="sy" style={{fontSize:11,fontWeight:700}}>{race.name}</div>
                  <div className="sy" style={{fontSize:10,color:race.status==="finished"?C.muted:bal===0?C.green:C.accentL}}>
                    {race.status==="finished"?"Finished":bal===0?"✓ All spent":`${fmt(bal)} left`}
                  </div>
                </div>
                <div style={{height:3,background:C.border,borderRadius:2,overflow:"hidden",marginBottom:4}}>
                  <div style={{height:"100%",width:`${pct}%`,background:race.status==="finished"?C.muted:bal===0?C.green:C.accent,borderRadius:2,transition:"width .3s"}}/>
                </div>
                {race.status==="upcoming"&&bal>0&&(
                  <div className="sy" style={{fontSize:9,color:C.red}}>⚠ Must spend {fmt(bal)} more</div>
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

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminScreen({races, accounts, bets, adminUnlocked, setAdminUnlocked, onSettle, onScratch, onResetPin, onAddRace, onAddHorse, onDeleteRace, onEditRace, onEditHorse, toast}) {
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
  const [newRace, setNewRace] = useState({name:"",venue:"",date:"",distance:"",raceNum:"",raceTime:""});
  const [newRaceErr, setNewRaceErr] = useState("");
  const [addHorseFor, setAddHorseFor] = useState(null);
  const [horseForm, setHorseForm] = useState({name:"",jockey:"",trainer:"",winOdds:"",placeOdds:""});
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
      grade: "Group 1",
      status: "upcoming",
      horses: [],
      result: null,
    };
    onAddRace(race);
    setNewRace({name:"",venue:"",date:"",distance:"",raceNum:"",raceTime:""});
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

      let num, name, jockey = "TBA", trainer = "TBA", winOdds, placeOdds;

      // Try pipe-separated format: "1. Name | Jockey | Trainer | 5.00 | 1.95"
      if (raw.includes("|")) {
        const parts = raw.split("|").map(p => p.trim());
        // Extract number from first part
        const firstPart = parts[0].replace(/^\d+[\.\)]\s*/, "").trim();
        const numMatch = parts[0].match(/^(\d+)/);
        num = numMatch ? parseInt(numMatch[1]) : existingCount + horses.length + 1;
        name = firstPart || parts[0].trim();
        jockey = parts[1] || "TBA";
        trainer = parts[2] || "TBA";
        winOdds = parseFloat(parts[3]);
        placeOdds = parseFloat(parts[4]);
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

      // Clean up name — remove barrier numbers in parentheses like "(4)"
      name = name.replace(/\(\d+\)$/, "").trim();
      // Remove leading number from name if still there
      name = name.replace(/^\d+[\.\):\s]+/, "").trim();

      if (!name) { errors.push(`Line ${i+1}: couldn't read horse name`); return; }
      if (!winOdds || winOdds <= 0) { errors.push(`Line ${i+1} (${name}): missing win odds`); return; }
      if (!placeOdds || placeOdds <= 0) { errors.push(`Line ${i+1} (${name}): missing place odds`); return; }

      horses.push({
        number: num,
        name, jockey, trainer,
        winOdds, placeOdds,
        form: [], scratched: false,
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
      trifecta:  parseFloat(inp.divs.trifecta  || 0),
      firstfour: parseFloat(inp.divs.firstfour || 0),
      quinella:  parseFloat(inp.divs.quinella  || 0),
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
            <p className="sy soft" style={{fontSize:12}}>Click horses into finishing order, enter TAB dividends, then settle.</p>
            <button className="btn btn-gold sy" style={{fontSize:12,padding:"8px 16px",flexShrink:0}} onClick={()=>setShowAddRace(true)}>+ Add Race</button>
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
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12}}>
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
                      <div style={{display:"flex",gap:6}}>
                        <button className="sy" style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.border}`,background:"#f4f5f4",color:C.soft,cursor:"pointer",fontWeight:600}}
                          onClick={()=>{
                            const r=races.find(x=>x.id===race.id);
                            setEditRaceFor(race.id);
                            setEditRaceForm({name:r.name,venue:r.venue,date:r.date,distance:r.distance,raceNum:r.raceNum,raceTime:r.raceTime||""});
                          }}>
                          ✏️ Edit Race
                        </button>
                        {race.status !== "finished" && rb.length === 0 && (
                          <button className="sy" style={{fontSize:11,padding:"4px 10px",borderRadius:6,border:`1px solid ${C.redBd}`,background:C.redBg,color:C.red,cursor:"pointer",fontWeight:600}}
                            onClick={()=>{ if(window.confirm(`Delete "${race.name}"? This cannot be undone.`)) onDeleteRace(race.id); }}>
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
                              {!h.scratched&&<span style={{color:C.accent,fontSize:11}} onClick={e=>{e.stopPropagation();setEditHorseFor({raceId:race.id,horseNum:h.number});setEditHorseForm({name:h.name,jockey:h.jockey||"",trainer:h.trainer||"",winOdds:String(h.winOdds),placeOdds:String(h.placeOdds)});}}>✏️</span>}
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
                      <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:16}}>
                        {race.horses.filter(h=>!h.scratched).map(h=>{
                          const finishers = getInp(race.id).finishers || [];
                          const posIdx = finishers.indexOf(h.number);
                          const posLabel = posIdx>=0?["1st","2nd","3rd","4th"][posIdx]:null;
                          return (
                            <div key={h.number} style={{display:"flex",gap:3}}>
                              {[0,1,2,3].map(pos=>{
                                const active = finishers[pos]===h.number;
                                return (
                                  <button key={pos} className="sy" style={{fontSize:10,padding:"4px 8px",borderRadius:5,border:`1px solid ${active?C.accent:C.border}`,background:active?"#eef3ff":"#f4f5f7",color:active?C.accent:C.soft,cursor:"pointer",fontWeight:active?700:400,transition:"all .13s"}}
                                    onClick={()=>toggleFinisher(race.id,pos,h.number)}>
                                    #{h.number} {h.name} → {["1st","2nd","3rd","4th"][pos]}
                                  </button>
                                );
                              }).slice(0,1)}
                              <select className="inp-sm sy" style={{padding:"4px 6px",fontSize:10,width:"auto"}}
                                value={posIdx>=0?posIdx:""}
                                onChange={e=>{
                                  const pos=parseInt(e.target.value);
                                  if(!isNaN(pos)) toggleFinisher(race.id,pos,h.number);
                                }}>
                                <option value="">#{h.number} {h.name}</option>
                                {["1st","2nd","3rd","4th"].map((l,i)=><option key={i} value={i}>{l}</option>)}
                              </select>
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
                          ["trifecta", "Trifecta",          false],
                          ["firstfour","First Four",        false],
                          ["quinella", "Quinella",          false],
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
              1. Horse Name | J Jockey | T Trainer | 5.00 | 1.95<br/>
              2. Another Horse | J Smith | T Jones | 9.50 | 2.90<br/>
              <span style={{opacity:.6}}>— or simpler (name + odds only):</span><br/>
              1. Horse Name | 5.00 | 1.95
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
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,fontSize:12}}>
                      <span className="sy"><strong>#{h.number} {h.name}</strong> <span style={{color:C.soft}}>· {h.jockey} · {h.trainer}</span></span>
                      <span className="sy" style={{color:C.accent,fontWeight:700,flexShrink:0,marginLeft:10}}>${h.winOdds.toFixed(2)} / ${h.placeOdds.toFixed(2)}</span>
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
                    bulkPreview.forEach(horse => onAddHorse(bulkImportFor, horse));
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
            {horseErr&&<p className="sy" style={{color:C.red,fontSize:12,marginBottom:10}}>{horseErr}</p>}
            <div style={{display:"flex",gap:8}}>
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
                  form: [],
                  scratched: false,
                };
                onAddHorse(addHorseFor, horse);
                setHorseForm({name:"",jockey:"",trainer:"",winOdds:"",placeOdds:""});
                setHorseErr("");
              }}>Add Horse</button>
              <button className="btn btn-ghost" style={{padding:12,fontSize:13}} onClick={()=>{setAddHorseFor(null);setHorseForm({name:"",jockey:"",trainer:"",winOdds:"",placeOdds:""});setHorseErr("");}}>Done</button>
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
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Date *</label>
                  <input className="inp sy" type="date" value={newRace.date} onChange={e=>setNewRace(p=>({...p,date:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Race Time (AEST) *</label>
                  <input className="inp sy" type="time" value={newRace.raceTime} onChange={e=>setNewRace(p=>({...p,raceTime:e.target.value}))}/>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Distance *</label>
                  <input className="inp sy" placeholder="e.g. 2000m" value={newRace.distance} onChange={e=>setNewRace(p=>({...p,distance:e.target.value}))}/>
                </div>
                <div>
                  <label className="sy soft" style={{fontSize:10,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:4}}>Race No.</label>
                  <input className="inp sy" placeholder="e.g. Race 7" value={newRace.raceNum} onChange={e=>setNewRace(p=>({...p,raceNum:e.target.value}))}/>
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
            </div>
            <button className="btn btn-gold" style={{width:"100%",padding:13,fontSize:14}} onClick={()=>{
              if(!editHorseForm.name?.trim()) return;
              onEditHorse(editHorseFor.raceId, editHorseFor.horseNum, {
                name: editHorseForm.name.trim(),
                jockey: editHorseForm.jockey.trim()||"TBA",
                trainer: editHorseForm.trainer.trim()||"TBA",
                winOdds: parseFloat(editHorseForm.winOdds)||0,
                placeOdds: parseFloat(editHorseForm.placeOdds)||0,
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
