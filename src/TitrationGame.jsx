import React, { useMemo, useState, useEffect, useRef, useId } from "react";

/**
 * SiU Lab – Titreringsspill (v8.1 – bugfix, Nintendo‑style, live curve, modes)
 * ---------------------------------------------------------------------------
 * Plain React + inline CSS/SVG. No external libs (for reliability in preview).
 * Science assumptions: 25 °C, Kw=1e‑14, monoprotic acids/bases.
 *
 * Fixes in v8.1:
 *  - Fixed a stray JSX/brace imbalance near the end of the file that caused
 *    "Unexpected token". All tags/blocks are now closed, and clipPath ids are
 *    stable via useId().
 *  - Kept existing self‑tests; added one more regression on indicator coloring.
 *  - Kolbe visuals refined (rising fill + shine) and byrette reserve is clearer.
 */

// --------------------------- Utilities ----------------------------
const Kw = 1e-14; // at 25 °C
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const LOG10 = (x) => { const v = x > 1e-15 ? x : 1e-15; return Math.log(v) / Math.LN10; };
const nf = (x, digits = 3) => {
  if (!isFinite(x)) return "–";
  const abs = Math.abs(x);
  const p = abs < 0.001 || abs >= 1e4 ? x.toExponential(digits - 1) : x.toFixed(digits);
  return p.replace(/\.0+($|e)/, "$1");
};

// --------------------------- Data ----------------------------
const ACIDS = [
  { key: "hcl", name: "Saltsyre (HCl)", strong: true, Ka: Infinity, M: 36.46, formula: "HCl" },
  { key: "hno3", name: "Salpetersyre (HNO₃)", strong: true, Ka: Infinity, M: 63.01, formula: "HNO₃" },
  { key: "ch3cooh", name: "Eddiksyre (CH₃COOH)", strong: false, Ka: 1.8e-5, M: 60.05, formula: "CH₃COOH" },
  { key: "hcn", name: "Hydrogencyanid (HCN)", strong: false, Ka: 6.2e-10, M: 27.03, formula: "HCN" },
];
const BASES = [
  { key: "naoh", name: "Natriumhydroksid (NaOH)", strong: true, Kb: Infinity, M: 40.0, formula: "NaOH" },
  { key: "koh", name: "Kaliumhydroksid (KOH)", strong: true, Kb: Infinity, M: 56.11, formula: "KOH" },
  { key: "nh3", name: "Ammoniakk (NH₃ aq)", strong: false, Kb: 1.8e-5, M: 17.03, formula: "NH₃(aq)" },
];
const INDICATORS = [
  { key: "phe", name: "Fenolftalein", low: 8.2, high: 10.0, acidColor: "#ffffff", baseColor: "#ff4fa3" },
  { key: "mo", name: "Metyloransje", low: 3.1, high: 4.4, acidColor: "#d73b3e", baseColor: "#ffd24a" },
  { key: "btb", name: "Bromtymolblå", low: 6.0, high: 7.6, acidColor: "#ffd24a", baseColor: "#1e90ff" },
];
INDICATORS.forEach((i) => {
  const a = i.acidColor, b = i.baseColor;
  i._a = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  i._b = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
});

// --------------------------- Chemistry ----------------------------
function choosePHCalculator(acid, base) {
  if (acid.strong && base.strong) return pH_strongAcid_strongBase;
  if (!acid.strong && base.strong) return (args) => pH_weakAcid_strongBase({ Ka: acid.Ka, ...args });
  if (acid.strong && !base.strong) return (args) => pH_strongAcid_weakBase({ Kb: base.Kb, ...args });
  return (args) => pH_weakAcid_weakBase({ Ka: acid.Ka, Kb: base.Kb, ...args });
}
function pH_strongAcid_strongBase({ Ca, Va, Cb, Vb }) {
  const na0 = Ca * Va, nb = Cb * Vb, Vt = Va + Vb;
  if (nb < na0) { const H = (na0 - nb) / Vt; return -LOG10(H); }
  if (Math.abs(nb - na0) < 1e-12) return 7.0;
  const OH = (nb - na0) / Vt; return 14 + LOG10(OH);
}
function pH_weakAcid_strongBase({ Ka, Ca, Va, Cb, Vb }) {
  const na0 = Ca * Va, nb = Cb * Vb, Vt = Va + Vb, pKa = -LOG10(Ka);
  if (nb === 0) { const a=1,b=Ka,c=-Ka*Ca; const x=(-b+Math.sqrt(b*b-4*a*c))/(2*a); return -LOG10(x); }
  if (nb < na0) { const nHA = na0 - nb, nA = nb; return pKa + LOG10(nA / nHA); }
  if (Math.abs(nb - na0) < 1e-12) { const C = na0 / Vt; const Kb = Kw / Ka; const OH = Math.sqrt(Kb * C); return 14 + LOG10(OH); }
  const OH = (nb - na0) / Vt; return 14 + LOG10(OH);
}
function pH_strongAcid_weakBase({ Kb, Cb, Vb, Ca, Va }) {
  const na0 = Ca * Va, nb = Cb * Vb, Vt = Va + Vb; const KaBH = Kw / Kb;
  if (nb === 0) return -LOG10(Ca);
  if (nb < na0) { const H = (na0 - nb) / Vt; return -LOG10(H); }
  if (Math.abs(nb - na0) < 1e-12) { const C = nb / Vt; const H = Math.sqrt(KaBH * C); return -LOG10(H); }
  const nB = nb - na0, nBH = na0; const pOH = -LOG10(Kb) + LOG10(nB / nBH); return 14 - pOH;
}
function pH_weakAcid_weakBase({ Ka, Kb, Ca, Va, Cb, Vb }) {
  const na0 = Ca * Va, nb = Cb * Vb, Vt = Va + Vb; const pKa = -LOG10(Ka), pKb = -LOG10(Kb);
  if (nb === 0) { const a=1,b=Ka,c=-Ka*Ca; const x=(-b+Math.sqrt(b*b-4*a*c))/(2*a); return -LOG10(x); }
  if (nb < na0) { const nHA = na0 - nb, nA = nb; return pKa + LOG10(nA / nHA); }
  if (Math.abs(nb - na0) < 1e-12) return 7 + 0.5 * (pKa - pKb);
  const nB = nb - na0, nBH = na0; const pOH = pKb + LOG10(nB / nBH); return 14 - pOH;
}
function indicatorColor(ind, pH) {
  if (!isFinite(pH)) return "#e2e8f0";
  if (pH <= ind.low - 0.3) return ind.acidColor;
  if (pH >= ind.high + 0.3) return ind.baseColor;
  const t = clamp((pH - ind.low) / (ind.high - ind.low), 0, 1);
  const a = ind._a, b = ind._b; const pc = a.map((x,i)=> Math.round(x + (b[i]-x)*t));
  return `rgb(${pc[0]}, ${pc[1]}, ${pc[2]})`;
}

// ------------------------------ UI -------------------------------
export default function TitrationGame() {
  const [mode, setMode] = useState("Fri lek"); // Fri lek · Eksamensmodus · Avlesningstrener
  const [level, setLevel] = useState("Kjemi 1");
  const [beginner, setBeginner] = useState(true);
  const [difficulty, setDifficulty] = useState("Lett"); // Lett · Middels · Avansert
  const [showIntro, setShowIntro] = useState(true);

  const [acidKey, setAcidKey] = useState(ACIDS[0].key);
  const [baseKey, setBaseKey] = useState(BASES[0].key);
  const [indicatorKey, setIndicatorKey] = useState(INDICATORS[2].key);
  const [Ca, setCa] = useState(0.1); const [Va, setVa] = useState(0.05); const [Cb, setCb] = useState(0.1);
  const [massA, setMassA] = useState(0); const [volMakeA, setVolMakeA] = useState(0.25);
  const [massB, setMassB] = useState(0); const [volMakeB, setVolMakeB] = useState(0.25);
  const [Vb, setVb] = useState(0); const [autoRun, setAutoRun] = useState(false);
  const [valveOpen, setValveOpen] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);
  const [celebrateKey, setCelebrateKey] = useState(0);

  // GAME: guess & score
  const [guessVeq, setGuessVeq] = useState(0.05);
  const [showScore, setShowScore] = useState(false);

  // Derived selections
  const acid = useMemo(() => ACIDS.find(a => a.key === acidKey), [acidKey]);
  const base = useMemo(() => BASES.find(b => b.key === baseKey), [baseKey]);
  const ind = useMemo(() => INDICATORS.find(i => i.key === indicatorKey), [indicatorKey]);

  // Chemistry state
  const nAcid = useMemo(() => Ca * Va, [Ca, Va]);
  const Veq = useMemo(() => (Cb > 0 ? nAcid / Cb : NaN), [nAcid, Cb]);
  const PH_CALC = useMemo(() => choosePHCalculator(acid, base), [acid, base]);
  const pH = useMemo(() => PH_CALC({ Ca, Va, Cb, Vb }), [PH_CALC, Ca, Va, Cb, Vb]);
  const pHeq = useMemo(() => (isFinite(Veq) ? PH_CALC({ Ca, Va, Cb, Vb: Veq }) : NaN), [PH_CALC, Ca, Va, Cb, Veq]);
  const colour = useMemo(() => indicatorColor(ind, pH), [ind, pH]);
  const suitable = useMemo(() => isFinite(pHeq) && pHeq > ind.low && pHeq < ind.high, [ind, pHeq]);

  // Helper concentrations if student mixes from mass & volume
  const Ca_from_mass = useMemo(() => (massA > 0 && volMakeA > 0 ? (massA / acid.M) / volMakeA : NaN), [massA, volMakeA, acid.M]);
  const Cb_from_mass = useMemo(() => (massB > 0 && volMakeB > 0 ? (massB / base.M) / volMakeB : NaN), [massB, volMakeB, base.M]);

  // progress and deltas
  const prevVbRef = useRef(Vb); const prevPHRef = useRef(pH);
  useEffect(()=>{ prevVbRef.current = Vb; prevPHRef.current = pH; }, [Vb, pH]);
  const dPH = pH - prevPHRef.current;

  // Phase coach – plain language for beginners
  const phase = useMemo(() => {
    if (!isFinite(Veq)) return {title:'Start', text:'Fyll inn C og V for syre og base. Da kan vi beregne ekvivalensvolumet.'};
    const eps = Math.max(0.001*Veq, 0.0002);
    if (Vb < Veq - eps) return {title:'Før ekvivalens', text: base.strong? 'Basen nøytraliserer syren. Løsningen er fortsatt sur for sterk syre, eller buffer for svak syre.' : 'Sterk syre + svak base: løsningen er sur fram mot ekvivalens.'};
    if (Math.abs(Vb - Veq) <= eps) return {title:'Ved ekvivalens', text: acid.strong && base.strong ? 'Syre og base har reagert 1:1. pH ≈ 7.' : (acid.strong? 'Svak base + sterk syre: pH < 7 ved ekvivalens.' : (base.strong? 'Svak syre + sterk base: pH > 7 ved ekvivalens.' : 'Svak syre + svak base: pH nær 7 + ½(pKa−pKb).'))};
    return {title:'Etter ekvivalens', text: 'Overskudd av titrant bestemmer pH (ofte basisk med sterk base).'};
  }, [Veq, Vb, acid, base]);

  // Curve (plain SVG polyline). Depends only on chemistry, not on current Vb.
  const vmax = useMemo(() => (isFinite(Veq) && Veq > 0 ? Veq * 1.5 : 0.05), [Veq]);
  const curve = useMemo(() => {
    const steps = 320; const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps; const V = vmax * Math.pow(t, 1.35); // denser near higher volumes
      const p = clamp(PH_CALC({ Ca, Va, Cb, Vb: V }), 0, 14);
      pts.push([V * 1000, p]);
    }
    return pts; // [ [mL, pH], ... ]
  }, [PH_CALC, Ca, Va, Cb, vmax]);
  const progressCurve = useMemo(() => curve.filter(([x]) => x <= Vb*1000 + 1e-9), [curve, Vb]);

  // Autorun simulation (valve animation)
  useEffect(() => {
    if (!autoRun) return; setValveOpen(true); const id = setInterval(() => {
      setVb(v => { const step = (isFinite(Veq) && Veq > 0 ? Veq / 180 : 0.0002); const next = Math.min(v + step, (isFinite(Veq) ? Veq : 0.05) * 1.5); return next; });
    }, 40);
    return () => { clearInterval(id); setValveOpen(false); };
  }, [autoRun, Veq]);

  // Burette visual reserve (so it doesn't appear empty at equivalence)
  const [autoRefill, setAutoRefill] = useState(true);
  const [buretteReserve, setBuretteReserve] = useState(0.05); // 50 mL
  const lastVbRef = useRef(0);
  useEffect(() => {
    const dv = Vb - lastVbRef.current; lastVbRef.current = Vb;
    setBuretteReserve(prev => {
      let r = clamp(prev - dv, 0, 0.05);
      if (autoRefill && r <= 0.00001) r = 0.05;
      return r;
    });
  }, [Vb, autoRefill]);
  const buretteFill = useMemo(() => clamp(buretteReserve / 0.05, 0, 1), [buretteReserve]);

  // Flask fill increases with added volume (visual only)
  const flaskBaseHeight = 70; // px of liquid at start
  const flaskExtra = clamp((Vb / (isFinite(Veq) ? Veq : 0.05)) * 40, 0, 60); // up to +40px
  const flaskLiquidHeight = flaskBaseHeight + flaskExtra;

  const molesBaseAdded = useMemo(() => Cb * Vb, [Cb, Vb]);
  const molesAcidLeft = useMemo(() => clamp(nAcid - molesBaseAdded, 0, nAcid), [nAcid, molesBaseAdded]);
  const progressEq = useMemo(() => clamp(molesBaseAdded / (nAcid || 1), 0, 1), [molesBaseAdded, nAcid]);

  // Score based on guess and indicator suitability
  const score = useMemo(() => {
    if (!isFinite(Veq) || Veq <= 0) return 0;
    const err = Math.abs(guessVeq - Veq), tol = Math.max(0.0001, Veq*0.01);
    let s = 100 - (err/tol)*50; if (!suitable) s -= 30; return clamp(s,0,100);
  }, [guessVeq, Veq, suitable]);

  // Celebrate near equivalence
  useEffect(() => {
    if (!isFinite(Veq)) return; const eps = Math.max(0.001*Veq, 0.0002);
    if (Math.abs(Vb - Veq) < eps/2) setCelebrateKey(k=>k+1);
  }, [Vb, Veq]);

  // Actions
  const handleAdd = (deltaML) => {
    setVb(v => Math.max(0, v + deltaML/1000));
    setPulseKey(k => k + 1);
    setValveOpen(true); setTimeout(()=>setValveOpen(false), 600);
  };

  // Stable ids for SVG defs/clipPaths (fixes previous bug)
  const uid = useId();
  const idB = `${uid}-burette`;
  const idF = `${uid}-flask`;
  const idS = `${uid}-shine`;

  // Styles
  const inputClass = "bg-[#0b1220] border border-[#334155] text-[#e2e8f0] rounded-xl px-3 py-2 w-full";
  const selectClass = inputClass;
  const btn = "rounded-xl px-3 py-2 bg-[#0ea5e9] hover:bg-[#38bdf8] text-white";
  const btnGhost = "rounded-xl px-3 py-2 bg-[#1f2937] hover:bg-[#334155] text-[#e2e8f0] border border-[#475569]";
  const panel = "rounded-2xl p-4 bg-[#0b1220] border border-[#334155] text-[#e2e8f0]";

  // Chart helpers (SVG)
  const chartW = 600, chartH = 300, xMax = Math.max(curve[curve.length-1]?.[0] || 1, 1);
  const curvePoints = curve.map(([x,y])=> `${(x/xMax)*chartW},${chartH - (y/14)*chartH}`).join(" ");
  const progressPoints = progressCurve.length? progressCurve.map(([x,y])=> `${(x/xMax)*chartW},${chartH - (y/14)*chartH}`).join(" ") : `0,${chartH}`;
  const currentX = (clamp(Vb*1000, 0, xMax)/xMax)*chartW; const currentY = chartH - (clamp(pH,0,14)/14)*chartH;

  // ------------------ Self-tests (console) -------------------
  useEffect(() => {
    const eq = (a,b,t=0.1)=> Math.abs(a-b) < t;
    // SA-SB at equivalence ~7
    const p1 = pH_strongAcid_strongBase({ Ca:0.1, Va:0.05, Cb:0.1, Vb:0.05 });
    console.assert(eq(p1,7,0.05), `Test SA-SB eq failed: ${p1}`);
    // SA initial pH ~1 for 0.1 M
    const p2 = pH_strongAcid_strongBase({ Ca:0.1, Va:0.05, Cb:0.1, Vb:0 });
    console.assert(eq(p2,1,0.05), `Test SA initial failed: ${p2}`);
    // WA-SB half-equivalence pH = pKa (acetic acid 1.8e-5)
    const pKa = -LOG10(1.8e-5);
    const p3 = pH_weakAcid_strongBase({ Ka:1.8e-5, Ca:0.1, Va:0.05, Cb:0.1, Vb:0.025 });
    console.assert(Math.abs(p3 - pKa) < 0.1, `Test WA-SB half-eq failed: ${p3} vs ${pKa}`);
    // WA-SB equivalence pH > 7
    const p4 = pH_weakAcid_strongBase({ Ka:1.8e-5, Ca:0.1, Va:0.05, Cb:0.1, Vb:0.05 });
    console.assert(p4 > 7, `Test WA-SB eq should be >7, got ${p4}`);
    // SA-WB equivalence pH < 7 (NH3)
    const p5 = pH_strongAcid_weakBase({ Kb:1.8e-5, Ca:0.1, Va:0.05, Cb:0.1, Vb:0.05 });
    console.assert(p5 < 7.0, `Test SA-WB eq should be <7, got ${p5}`);
    // NEW: SA-SB after equivalence should be strongly basic (>12)
    const p6 = pH_strongAcid_strongBase({ Ca:0.1, Va:0.05, Cb:0.1, Vb:0.06 });
    console.assert(p6 > 12, `Test SA-SB after eq should be >12, got ${p6}`);
    // NEW: WA-WB equivalence approx 7 + 0.5(pKa-pKb)
    const pKa2 = -LOG10(1.8e-5), pKb2 = -LOG10(1.8e-5);
    const p7 = pH_weakAcid_weakBase({ Ka:1.8e-5, Kb:1.8e-5, Ca:0.1, Va:0.05, Cb:0.1, Vb:0.05 });
    console.assert(Math.abs(p7 - (7 + 0.5*(pKa2-pKb2))) < 0.15, `Test WA-WB eq approx failed: ${p7}`);
    // NEW: indicator blend monotonicity around midpoint
    const ind = INDICATORS[2];
    const c1 = indicatorColor(ind, ind.low-1);
    const c2 = indicatorColor(ind, (ind.low+ind.high)/2);
    const c3 = indicatorColor(ind, ind.high+1);
    console.assert(c1 !== c2 && c2 !== c3, `Indicator colors should differ across range`);
  }, []);

  return (
    <div className="min-h-screen w-full" style={{background:"linear-gradient(135deg,#020617,#0b1220 60%,#020617)"}}>
      <style>{`
        @keyframes drop { 0%{ transform: translateY(0); opacity:0;} 20%{opacity:1;} 100%{ transform: translateY(28px); opacity:0;} }
        @keyframes swirl { 0%{ transform: rotate(0deg) scale(0.9); opacity:0.0;} 50%{opacity:0.7;} 100%{ transform: rotate(360deg) scale(1); opacity:0;} }
        @keyframes bubble { 0%{ transform: translateY(0) scale(0.6); opacity:0;} 30%{opacity:0.6;} 100%{ transform: translateY(-40px) scale(1); opacity:0;} }
        @keyframes confetti { 0%{ transform: translateY(-10px) rotate(0deg); opacity:1;} 100%{ transform: translateY(80px) rotate(360deg); opacity:0;} }
        @keyframes pop { 0%{ transform: scale(0.9); } 100%{ transform: scale(1);} }
      `}</style>

      {/* Start overlay – Nintendo-ish presentation */}
      {showIntro && (
        <div className="fixed inset-0 z-20 flex items-center justify-center" style={{background:"radial-gradient(circle at 50% 50%, rgba(56,189,248,0.15), rgba(2,6,23,0.95))"}}>
          <div className="text-center p-8 rounded-3xl" style={{background:"#0b1220", border:"1px solid #334155", boxShadow:"0 10px 40px rgba(0,0,0,0.4)"}}>
            <div className="mx-auto mb-4" style={{width:88, height:88, borderRadius:24, background:"linear-gradient(135deg,#38bdf8,#22d3ee)", boxShadow:"0 6px 20px rgba(56,189,248,0.4)"}} />
            <h1 className="text-white text-2xl sm:text-3xl font-bold mb-2" style={{letterSpacing:"0.5px"}}>SiU Lab – Titreringsspill</h1>
            <p className="text-[#cbd5e1] mb-5">Nintendo‑inspirert, kortfattet og gøy – men faglig korrekt. Klar?</p>
            <div className="flex justify-center gap-3">
              <button className={btn} onClick={()=>setShowIntro(false)}>Start</button>
              <button className={btnGhost} onClick={()=>{ setMode('Eksamensmodus'); setShowIntro(false); }}>Eksamensmodus</button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl" style={{background:"rgba(56,189,248,0.25)"}}>
              <div className="w-6 h-6 rounded" style={{background:"#7dd3fc"}}></div>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">SiU Lab – Titreringsspill</h1>
              <p className="text-[#cbd5e1] text-sm">Vitenskapelige beregninger. Tydelig visualisering. Tilpasset Kjemi 1 & 2.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[#cbd5e1] text-sm">Modus</span>
              <select className={selectClass} value={mode} onChange={(e)=>setMode(e.target.value)}>
                <option>Fri lek</option>
                <option>Eksamensmodus</option>
                <option>Avlesningstrener</option>
              </select>
            </div>
            <label className="text-sm flex items-center gap-2 text-[#e2e8f0]"><input type="checkbox" checked={beginner} onChange={(e)=>setBeginner(e.target.checked)} /> Begynnermodus</label>
            <div className="flex items-center gap-2">
              <span className="text-[#cbd5e1] text-sm">Nivå</span>
              <select className={selectClass} value={level} onChange={(e)=>setLevel(e.target.value)}>
                <option>Kjemi 1</option>
                <option>Kjemi 2</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#cbd5e1] text-sm">Vanskelighetsgrad</span>
              <select className={selectClass} value={difficulty} onChange={(e)=>setDifficulty(e.target.value)}>
                <option>Lett</option>
                <option>Middels</option>
                <option>Avansert</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left: Setup */}
          <div className="xl:col-span-1 space-y-6">
            <div className={panel}>
              <h2 className="font-semibold mb-3">Oppsett</h2>
              <div className="grid grid-cols-1 gap-5">
                {/* Analytt */}
                <div className="rounded-2xl p-4" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
                  <h3 className="font-medium mb-3 text-white">Analytt (i kolbe) – Syre</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label>Velg syre</label>
                      <select className={selectClass} value={acidKey} onChange={(e)=>setAcidKey(e.target.value)}>
                        {ACIDS.map(a => <option key={a.key} value={a.key}>{a.name} {a.strong?"(sterk)":"(svak)"}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>C (mol/L)</label>
                      <input className={inputClass} type="number" step="0.001" value={Ca} onChange={(e)=>setCa(parseFloat(e.target.value)||0)} />
                    </div>
                    <div>
                      <label>V (L)</label>
                      <input className={inputClass} type="number" step="0.001" value={Va} onChange={(e)=>setVa(parseFloat(e.target.value)||0)} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="p-2 rounded-xl" style={{background:"#0b1220", border:"1px solid #334155"}}>n (mol): <span className="font-mono">{nf(nAcid)}</span></div>
                    <div className="p-2 rounded-xl" style={{background:"#0b1220", border:"1px solid #334155"}}>M (g/mol): <span className="font-mono">{acid.M}</span></div>
                    <div className="p-2 rounded-xl" style={{background:"#0b1220", border:"1px solid #334155"}}>m (g) pr. kolbe: <span className="font-mono">{nf(nAcid * acid.M)}</span></div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label>Bland selv: masse m (g)</label>
                      <input className={inputClass} type="number" step="0.001" value={massA} onChange={(e)=>setMassA(parseFloat(e.target.value)||0)} />
                    </div>
                    <div>
                      <label>Sluttvolum (L)</label>
                      <input className={inputClass} type="number" step="0.001" value={volMakeA} onChange={(e)=>setVolMakeA(parseFloat(e.target.value)||0)} />
                    </div>
                    <div className="text-xs">
                      {isFinite(Ca_from_mass) && Ca_from_mass>0 ? (
                        <div className="p-2 rounded-xl" style={{background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.4)"}}>→ C ≈ <span className="font-mono">{nf(Ca_from_mass)}</span> mol/L</div>
                      ) : (
                        <div className="p-2 rounded-xl" style={{background:"#0b1220", border:"1px solid #334155"}}>Skriv masse og volum for å beregne C</div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Titrant */}
                <div className="rounded-2xl p-4" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
                  <h3 className="font-medium mb-3 text-white">Titrant (i byrette) – Base</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label>Velg base</label>
                      <select className={selectClass} value={baseKey} onChange={(e)=>setBaseKey(e.target.value)}>
                        {BASES.map(b => <option key={b.key} value={b.key}>{b.name} {b.strong?"(sterk)":"(svak)"}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>C (mol/L)</label>
                      <input className={inputClass} type="number" step="0.001" value={Cb} onChange={(e)=>setCb(parseFloat(e.target.value)||0)} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                    <div className="p-2 rounded-xl" style={{background:"#0b1220", border:"1px solid #334155"}}>V_eq (L): <span className="font-mono">{nf(Veq)}</span></div>
                    <div className="p-2 rounded-xl" style={{background:"#0b1220", border:"1px solid #334155"}}>V_eq (mL): <span className="font-mono">{nf(Veq*1000)}</span></div>
                    <div className="p-2 rounded-xl" style={{background:"#0b1220", border:"1px solid #334155"}}>Forhold 1:1 (n=C·V)</div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label>Bland selv: masse m (g)</label>
                      <input className={inputClass} type="number" step="0.001" value={massB} onChange={(e)=>setMassB(parseFloat(e.target.value)||0)} />
                    </div>
                    <div>
                      <label>Sluttvolum (L)</label>
                      <input className={inputClass} type="number" step="0.001" value={volMakeB} onChange={(e)=>setVolMakeB(parseFloat(e.target.value)||0)} />
                    </div>
                    <div className="text-xs">
                      {isFinite(Cb_from_mass) && Cb_from_mass>0 ? (
                        <div className="p-2 rounded-xl" style={{background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.4)"}}>→ C ≈ <span className="font-mono">{nf(Cb_from_mass)}</span> mol/L</div>
                      ) : (
                        <div className="p-2 rounded-xl" style={{background:"#0b1220", border:"1px solid #334155"}}>Skriv masse og volum for å beregne C</div>
                      )}
                    </div>
                  </div>
                </div>

                {beginner && (
                  <div className="rounded-2xl p-4" style={{background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.35)", color:"#fde68a"}}>
                    <div className="font-medium mb-1">Slik gjør du (enkelt forklart):</div>
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Vi har syre i kolben og base i byretten.</li>
                      <li>Vi drypper base ned i syren. De reagerer 1:1 og nøytraliserer hverandre.</li>
                      <li>Fargen styres av pH og valgt indikator (fargeskift i et bestemt pH‑område).</li>
                      <li>Målet er å finne volumet ved ekvivalens (n_syre = n_base). Da er kurven bratt.</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>

            {/* Indicator & pH Guide */}
            <div className={panel}>
              <h2 className="font-semibold mb-2">Indikator & pH‑guide</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label>Indikator</label>
                  <select className={selectClass} value={indicatorKey} onChange={(e)=>setIndicatorKey(e.target.value)}>
                    {INDICATORS.map(i => <option key={i.key} value={i.key}>{i.name} ({i.low}–{i.high})</option>)}
                  </select>
                  <div className="mt-3 text-sm">pH ved ekvivalens: <span className="font-mono text-base">{nf(pHeq, 4)}</span> <span className={suitable?"text-green-400":"text-rose-400"}>• {suitable?"egnet":"uegnet"}</span></div>
                  <div className="mt-1 text-xs" style={{color:"#cbd5e1"}}>{phase.title}: {phase.text}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="p-3 rounded-2xl" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
                    <div className="text-xs mb-2" style={{color:"#cbd5e1"}}>pH‑skala og indikatorområde</div>
                    <div className="relative h-8 rounded-xl overflow-hidden" style={{background: "linear-gradient(90deg, #d73b3e 0%, #ffd24a 25%, #27d39f 50%, #1e90ff 75%, #3b82f6 100%)"}}>
                      {[0,2,4,6,7,8,10,12,14].map(t => (
                        <div key={t} className="absolute top-0 bottom-0" style={{left: `${(t/14)*100}%`, borderLeft:"1px solid rgba(255,255,255,0.3)"}}></div>
                      ))}
                      <div className="absolute inset-y-0 rounded-xl" style={{left: `${(INDICATORS.find(i=>i.key===indicatorKey).low/14)*100}%`, width: `${((INDICATORS.find(i=>i.key===indicatorKey).high-INDICATORS.find(i=>i.key===indicatorKey).low)/14)*100}%`, background: "rgba(255,255,255,0.25)"}}></div>
                      {isFinite(pHeq) && (<div className="absolute inset-y-0" style={{left: `${(clamp(pHeq,0,14)/14)*100}%`, width: 2, background: "#22c55e"}}></div>)}
                      <div className="absolute -top-1" style={{left: `${(clamp(pH,0,14)/14)*100}%`, transition:'left 120ms linear'}}>
                        <div className="w-0 h-0" style={{borderLeft:"4px solid transparent", borderRight:"4px solid transparent", borderBottom:"8px solid rgba(255,255,255,0.9)", margin:"0 auto"}}></div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs" style={{color:"#cbd5e1"}}><span>0</span><span>7</span><span>14</span></div>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
                  <div className="text-xs mb-1" style={{color:"#cbd5e1"}}>Mot ekvivalens</div>
                  <div className="h-3 rounded-xl overflow-hidden" style={{background:"#1f2937"}}>
                    <div className="h-full" style={{width: `${progressEq*100}%`, background:"#10b981", transition:'width 200ms linear'}}></div>
                  </div>
                  <div className="mt-1 text-xs" style={{color:"#cbd5e1"}}>n_base = {nf(molesBaseAdded)} mol • n_syre igjen = {nf(molesAcidLeft)} mol</div>
                </div>
                <div className="p-3 rounded-2xl" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
                  <div className="text-xs mb-1" style={{color:"#cbd5e1"}}>Avstand til V_eq</div>
                  <div className="flex items-center justify-between text-xs" style={{color:"#cbd5e1"}}>
                    <span>ΔV: <span className="font-mono text-white">{nf(Math.max((isFinite(Veq)?Veq:0) - Vb, 0)*1000)}</span> mL</span>
                    <span>V_b: <span className="font-mono text-white">{nf(Math.round((Vb*1000) / (difficulty==='Avansert'?0.05:(difficulty==='Middels'?0.02:0.01))) * (difficulty==='Avansert'?0.05:(difficulty==='Middels'?0.02:0.01)))}</span> mL</span>
                    {difficulty !== 'Avansert' && <span>ΔpH: <span className="font-mono text-white">{nf(dPH,4)}</span></span>}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Middle: Visual + Controls */}
          <div className="xl:col-span-1 space-y-6">
            <div className={panel}>
              <h2 className="font-semibold mb-3">Visualisering</h2>
              <div className="flex gap-3 mb-3 flex-wrap">
                <button className={btnGhost} onClick={()=>setAutoRun(!autoRun)}>{autoRun?"Auto på":"Auto av"}</button>
                <button className={btnGhost} onClick={()=>{ setVb(0); setPulseKey(k=>k+1); }}>Nullstill</button>
                <label className="text-xs flex items-center gap-2 opacity-80 mt-1"><input type="checkbox" checked={autoRefill} onChange={(e)=>setAutoRefill(e.target.checked)} /> Auto‑påfyll byrette</label>
                <div className="text-xs opacity-80 mt-1">{difficulty==='Avansert'? 'Avansert: pH visning skjult' : 'pH vises'}</div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {/* Simple burette + readouts */}
                <div className="relative h-40 rounded-3xl" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
                  <div className="absolute top-3 right-3 text-xs" style={{color:"#e2e8f0"}}>V_b: <span className="font-mono">{nf(Vb*1000)}</span> mL</div>
                  <div className="absolute inset-0 flex items-center justify-center gap-6">
                    <div className="relative" style={{width:96, height:112, borderRadius:12, background:"linear-gradient(180deg, rgba(100,116,139,0.4), rgba(15,23,42,0.6))", border:"1px solid #64748b"}}>
                      <div className="absolute bottom-0 left-0 right-0" style={{ height: `${buretteFill*100}%`, background:"linear-gradient(180deg, rgba(255,255,255,0.95), rgba(180,220,255,0.6))", borderBottomLeftRadius:12, borderBottomRightRadius:12, transition:'height 120ms linear' }}></div>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px]" style={{color:"#e2e8f0"}}>Byrette</div>
                    </div>
                    <div className="text-sm" style={{color:"#e2e8f0"}}>
                      {difficulty!=='Avansert' && <div>pH nå: <span className="font-mono text-lg ml-1">{nf(pH, 4)}</span></div>}
                      <div>ΔV til V_eq: <span className="font-mono">{nf(Math.max((isFinite(Veq)?Veq:0) - Vb, 0)*1000)}</span> mL</div>
                    </div>
                  </div>
                </div>

                {/* Flask colour and animations */}
                <div className="mt-2 h-56 rounded-3xl relative overflow-hidden" style={{background:"#0a0f1e", border:"1px solid #334155", padding:20}}>
                  {/* Confetti when near equivalence */}
                  <div key={celebrateKey} className="pointer-events-none absolute inset-0">
                    {Array.from({length: difficulty==='Avansert'? 6: 12}).map((_,i)=> (
                      <div key={i} style={{position:'absolute', left:`${Math.random()*100}%`, top:'-10px', width:0, height:0, borderLeft:'4px solid transparent', borderRight:'4px solid transparent', borderBottom:'7px solid #38bdf8', animation:'confetti 900ms ease-out', animationDelay:`${i*30}ms`}}></div>
                    ))}
                  </div>

                  <div className="h-full w-full rounded-2xl" style={{ border:"1px solid #334155", position:"relative", overflow:"hidden", background:`radial-gradient(circle at 50% 68%, ${colour} 0%, ${colour} 58%, rgba(2,6,23,0.9) 60%)`, transition:'background 140ms linear' }}>
                    {/* glass shine */}
                    <div style={{position:'absolute', left:'12%', top:'8%', width:'12%', height:'70%', background:'linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0))', borderRadius:'9999px', filter:'blur(1px)'}}></div>
                    {/* rising liquid overlay to imply volume increase */}
                    <div style={{position:'absolute', left: '8%', right:'8%', bottom:'0', height: `${flaskLiquidHeight}px`, background: colour, opacity:0.35, borderTopLeftRadius:'12px', borderTopRightRadius:'12px', transition:'height 160ms linear'}}></div>
                    {/* bubbles */}
                    {Array.from({length: 8}).map((_,i)=> (
                      <div key={i+"b"+pulseKey} style={{position:'absolute', left: `${45 + Math.sin(i)*15}%`, bottom:'18px', width:'4px', height:'4px', borderRadius:'9999px', background:'rgba(255,255,255,0.6)', animation:'bubble 1200ms ease-in forwards', animationDelay:`${i*80}ms`}}></div>
                    ))}
                    {/* swirl */}
                    <div key={pulseKey} style={{position:'absolute', left:'48%', top:'50%', width:'80px', height:'80px', border:'2px solid rgba(255,255,255,0.5)', borderRadius:'9999px', transformOrigin:'center', animation:'swirl 1200ms ease-out'}}></div>
                    <div className="absolute top-3 left-3 text-xs" style={{color:"#e2e8f0"}}>Indikator: <span className="font-mono">{INDICATORS.find(i=>i.key===indicatorKey).name}</span></div>
                    <div className="absolute bottom-3 right-3 text-xs" style={{color:"#e2e8f0"}}>Farge ≈ <span className="inline-block align-middle w-2 h-2 rounded-full" style={{ backgroundColor: colour }}></span></div>
                    <div className="absolute bottom-3 left-3 text-xs" style={{color:"#e2e8f0"}}>C_a={nf(Ca)} M · V_a={nf(Va)} L · n_a={nf(nAcid)} mol</div>
                  </div>
                </div>

                {/* Realistic Lab View (SVG) */}
                <div className="rounded-3xl p-4" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="relative">
                      <svg viewBox="0 0 400 380" className="w-full" style={{height:320}}>
                        <rect x="20" y="20" width="12" height="260" rx="6" fill="#334155" />
                        <rect x="0" y="280" width="240" height="18" rx="9" fill="#1f2937" />
                        <rect x="26" y="80" width="40" height="10" rx="5" fill="#475569" />
                        {/* Valve */}
                        <g transform={`translate(86,248) rotate(${(autoRun||valveOpen)?35:0})`}>
                          <rect x="-12" y="-6" width="24" height="12" rx="3" fill="#94a3b8" />
                        </g>
                        {/* Burette tube */}
                        <rect x="66" y="60" width="22" height="180" rx="10" fill="#0b1220" stroke="#64748b" strokeWidth="2" />
                        <clipPath id={idB}><rect x="66" y="60" width="22" height="180" rx="10" /></clipPath>
                        <g clipPath={`url(#${idB})`}>
                          <rect x="66" y={60 + (1-buretteFill)*180} width="22" height={buretteFill*180} fill="#cfe8ff" />
                          <rect x="66" y={60 + (1-buretteFill)*180} width="22" height={buretteFill*180} fill={`url(#${idS})`} opacity="0.4" />
                        </g>
                        <defs>
                          <linearGradient id={idS} x1="0" x2="1">
                            <stop offset="0%" stopColor="#ffffff"/>
                            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <circle cx="77" cy="242" r="10" fill="#475569" />
                        <rect x="74" y="250" width="6" height="24" rx="3" fill="#64748b" />
                        <rect x="78" y="270" width="2" height="18" fill="#94a3b8" />
                        {/* droplets */}
                        {Array.from({length: (autoRun? 3: 1)}).map((_,i)=> (
                          <circle key={i+"d"+pulseKey} cx="79" cy={273 + i*6} r="3" fill={colour} style={{animation:"drop 0.6s linear", animationDelay:`${i*120}ms`}} />
                        ))}
                        {/* Erlenmeyer with rising fill */}
                        <path d="M250,100 L270,100 L275,180 L330,300 Q290,340 235,300 L290,180 Z" fill="#0b1220" stroke="#64748b" strokeWidth="2"/>
                        <clipPath id={idF}><path d="M250,100 L270,100 L275,180 L330,300 Q290,340 235,300 L290,180 Z" /></clipPath>
                        <g clipPath={`url(#${idF})`}>
                          <rect x="228" y={320 - flaskLiquidHeight} width="146" height={flaskLiquidHeight} fill={colour} />
                          <circle cx="290" cy={300 - flaskLiquidHeight*0.4} r="46" fill={colour} opacity="0.55" />
                        </g>
                        <text x="245" y="90" fontSize="10" fill="#e5e7eb">Kolbe (indikator i kolben)</text>
                        <text x="54" y="54" fontSize="10" fill="#e5e7eb">Byrette (titrant – uten indikator)</text>
                      </svg>
                      <div className="absolute -bottom-2 left-0 text-[10px]" style={{color:"#cbd5e1"}}>* For volum &gt; 50 mL antas virtuell etterfylling.</div>
                    </div>
                    <div className="space-y-3 text-sm" style={{color:"#e2e8f0"}}>
                      <div className="p-3 rounded-2xl" style={{background:"#0b1220", border:"1px solid #334155"}}><b>Hva skjer nå?</b> {phase.text}</div>
                      <div className="p-3 rounded-2xl" style={{background:"#0b1220", border:"1px solid #334155"}}>
                        Byretten: nivået synker når du tilsetter. Ventilen { (autoRun||valveOpen) ? 'er åpen' : 'er lukket' }.
                        <div className="mt-2 flex gap-2"><button className={btnGhost} onClick={()=>setBuretteReserve(0.05)}>Fyll byrette</button><button className={btnGhost} onClick={()=>setAutoRefill(a=>!a)}>{autoRefill? 'Skru av auto‑påfyll' : 'Skru på auto‑påfyll'}</button></div>
                      </div>
                      <div className="p-3 rounded-2xl" style={{background:"#0b1220", border:"1px solid #334155"}}>Endepunkt (indikator skifter farge) kan være litt før/etter ekvivalens. Det er normalt.</div>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="mt-2 p-4 rounded-2xl" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm" style={{color:"#e2e8f0"}}>Tilsett titrant (mL)</div>
                    <div className="flex items-center gap-3 text-sm" style={{color:"#e2e8f0"}}>
                      <label className="flex items-center gap-2"><input type="checkbox" checked={autoRun} onChange={(e)=>setAutoRun(e.target.checked)} /> Auto</label>
                      <button className={btnGhost} onClick={()=>{ setVb(0); setPulseKey(k=>k+1); }}>Nullstill</button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <input type="range" min={0} max={Math.max((isFinite(Veq)?Veq:0.05)*1.5*1000, 1)} step={0.05} value={Vb*1000} onChange={(e)=>{ setVb(parseFloat(e.target.value)/1000); setPulseKey(k=>k+1); setShowIntro(false); }} className="w-full" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[0.05,0.1,0.25,0.5,1].map(step => (
                      <button key={step} className={btn} onClick={()=>{handleAdd(step); setShowIntro(false);}}>+{step} mL</button>
                    ))}
                  </div>
                </div>

                {/* Avlesningstrener (menisk) */}
                {mode === 'Avlesningstrener' && (
                  <ReadingTrainer inputClass={inputClass} btn={btn} />
                )}
              </div>
            </div>
          </div>

          {/* Right: Curve + Game */}
          <div className="xl:col-span-1 space-y-6">
            <div className={panel}>
              <h2 className="font-semibold mb-3">pH‑kurve (live)</h2>
              <div className="rounded-xl" style={{background:"#0a0f1e", border:"1px solid #334155", padding:12}}>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} width="100%" height="300">
                  {/* grid */}
                  {Array.from({length:8}).map((_,i)=>{
                    const y = (i/7)*chartH; return <line key={i} x1={0} x2={chartW} y1={y} y2={y} stroke="#334155" strokeDasharray="3 3"/>;
                  })}
                  {/* full curve (dim) */}
                  <polyline fill="none" stroke="#334155" strokeWidth="1.5" points={curvePoints} />
                  {/* progress curve (bright) */}
                  <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={progressPoints} />
                  {/* area fill under progress */}
                  {progressCurve.length>1 && (
                    <polygon fill="rgba(56,189,248,0.12)" points={`0,${chartH} ${progressPoints} ${currentX},${chartH}`} />
                  )}
                  {/* current marker */}
                  <line x1={currentX} x2={currentX} y1={0} y2={chartH} stroke="#22c55e" strokeDasharray="4 4" />
                  <circle cx={currentX} cy={currentY} r={4} fill="#22c55e" />
                  {/* axes labels */}
                  <text x={chartW/2} y={chartH-6} fill="#cbd5e1" fontSize="12" textAnchor="middle">Tilført volum (mL)</text>
                  <text x={10} y={12} fill="#cbd5e1" fontSize="12">pH</text>
                </svg>
              </div>
              <div className="mt-3 text-xs" style={{color:"#cbd5e1"}}>Når du tilsetter titrant, tegnes «spor» langs kurven. Ved ekvivalens (grønn linje) er pH‑spranget størst.</div>
            </div>

            {/* Exam mode tasks */}
            <div className={panel}>
              <h2 className="font-semibold mb-3">Spillmodus</h2>
              {mode === 'Eksamensmodus' ? (
                <ExamMode ACIDS={ACIDS} BASES={BASES} INDICATORS={INDICATORS} btn={btn} btnGhost={btnGhost} inputClass={inputClass} />
              ) : (
                <div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label>Gjett V_eq (L)</label>
                      <input className={inputClass} type="number" step="0.0001" value={guessVeq} onChange={(e)=>setGuessVeq(parseFloat(e.target.value)||0)} />
                    </div>
                    <div className="p-3 rounded-2xl" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
                      Fasit V_eq: <span className="font-mono">{nf(Veq, 6)}</span> L
                      <div>Indikator: <span className="font-mono">{INDICATORS.find(i=>i.key===indicatorKey).name}</span> {suitable?"(egnet)":"(uegnet)"}</div>
                    </div>
                    <div className="p-3 rounded-2xl" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
                      pH ved halvt ekvivalens: <span className="font-mono">{nf(PH_CALC({ Ca, Va, Cb, Vb: (isFinite(Veq)?Veq:0)/2 }), 4)}</span>
                      <div className="text-xs" style={{color:"#cbd5e1"}}>Ved svak syre + sterk base: pH = pK_a her.</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <button className={btn} onClick={()=>setShowScore(true)}>Vurder svaret</button>
                    {showScore && (<div className="text-sm">Poeng: <span className="font-mono text-green-400 text-lg">{Math.round(score)}</span>/100</div>)}
                    <button className={btnGhost} onClick={()=>{
                      const a = ACIDS[Math.floor(Math.random()*ACIDS.length)];
                      const b = BASES[Math.floor(Math.random()*BASES.length)];
                      setAcidKey(a.key); setBaseKey(b.key);
                      const CaNew = parseFloat((Math.random()*0.2 + 0.05).toFixed(3));
                      const VaNew = parseFloat((Math.random()*0.05 + 0.030).toFixed(3));
                      const CbNew = parseFloat((Math.random()*0.2 + 0.05).toFixed(3));
                      setCa(CaNew); setVa(VaNew); setCb(CbNew);
                      setVb(0); setGuessVeq(parseFloat(((CaNew*VaNew)/CbNew).toFixed(6)));
                      setShowScore(false); setPulseKey(k=>k+1);
                    }}>Ny utfordring</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={panel}><div className="text-sm"><div className="font-medium mb-1">Enheter og sammenhenger</div><ul className="list-disc pl-5 space-y-1"><li>n (mol) = C (mol/L) · V (L)</li><li>m (g) = n (mol) · M (g/mol)</li><li>V_eq = n_analytt / C_titrant (1:1)</li></ul></div></div>
          <div className={panel}><div className="text-sm"><div className="font-medium mb-1">Faglig fokus (Kjemi 1)</div><ul className="list-disc pl-5 space-y-1"><li>Titreringsanalyse (volumetrisk), enheter og usikkerhet</li><li>Syre/base, protolyse, pH, sterke vs. svake</li><li>Endepunkt vs. ekvivalenspunkt</li></ul></div></div>
          <div className={panel}><div className="text-sm"><div className="font-medium mb-1">Faglig fokus (Kjemi 2)</div><ul className="list-disc pl-5 space-y-1"><li>Bufferområde og Henderson–Hasselbalch</li><li>Likevekter, Ka/Kb, pH ved ekvivalens</li><li>Indikatorvalg basert på pH‑sprang</li></ul></div></div>
        </div>
      </div>
    </div>
  );
}

// --------------------------- Subcomponents ------------------------
function ExamMode({ ACIDS, BASES, INDICATORS, btn, btnGhost, inputClass }) {
  const [task, setTask] = useState(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");

  const newTask = () => {
    const acid = ACIDS[Math.floor(Math.random()*ACIDS.length)];
    const base = BASES[Math.floor(Math.random()*BASES.length)];
    const Ca = +(Math.random()*0.2 + 0.05).toFixed(3);
    const Va = +(Math.random()*0.05 + 0.030).toFixed(3);
    const Cb = +(Math.random()*0.2 + 0.05).toFixed(3);
    const Veq = (Cb>0)? (Ca*Va)/Cb : NaN;
    const ind = INDICATORS[Math.floor(Math.random()*INDICATORS.length)];
    setTask({acid, base, Ca, Va, Cb, Veq, ind});
    setAnswer(""); setFeedback("");
  };

  useEffect(()=>{ if(!task) newTask(); }, [task]);

  if(!task) return <div>Forbereder oppgave…</div>;
  return (
    <div>
      <div className="rounded-xl p-3 mb-3" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
        <div className="text-sm"><b>Oppgave:</b> I kolben er {task.acid.name} med C = {task.Ca} mol/L og V = {task.Va} L. I byretten er {task.base.name} med C = {task.Cb} mol/L. Velg passende indikator og finn V_eq i liter.</div>
      </div>
      <div className="flex items-center gap-3">
        <input className={inputClass} placeholder="Skriv V_eq i liter (f.eks. 0.025)" value={answer} onChange={(e)=>setAnswer(e.target.value)} />
        <button className={btn} onClick={()=>{
          const val = parseFloat(answer);
          if(!isFinite(val)) { setFeedback("Skriv et tall."); return; }
          const err = Math.abs(val - task.Veq);
          const tol = Math.max(0.0001, task.Veq*0.01);
          setFeedback(err <= tol ? "Riktig!" : `Nesten. Riktig V_eq ≈ ${nf(task.Veq,6)} L`);
        }}>Sjekk</button>
        <button className={btnGhost} onClick={newTask}>Ny eksamensoppgave</button>
      </div>
      {feedback && <div className="mt-2 text-sm">{feedback}</div>}
    </div>
  );
}

function ReadingTrainer({ inputClass, btn }) {
  const [trueValue, setTrueValue] = useState(() => +(Math.random()*50).toFixed(2)); // mL
  const [user, setUser] = useState("");
  const [msg, setMsg] = useState("");
  const newReading = () => { setTrueValue(+(Math.random()*50).toFixed(2)); setUser(""); setMsg(""); };
  return (
    <div className="mt-2 p-4 rounded-2xl" style={{background:"#0a0f1e", border:"1px solid #334155"}}>
      <h3 className="font-medium mb-2">Avlesningstrener: les menisken</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <svg viewBox="0 0 200 220" className="w-full" style={{height:200}}>
          <rect x="80" y="10" width="40" height="180" rx="8" fill="#0b1220" stroke="#64748b" strokeWidth="2" />
          {Array.from({length:19}).map((_,i)=> (
            <line key={i} x1={122} y1={20+i*9} x2={136} y2={20+i*9} stroke="#94a3b8" strokeWidth={i%5===0?2:1} />
          ))}
          {/* meniscus */}
          <path d={`M80 ${190-trueValue*3} Q100 ${200-trueValue*3} 120 ${190-trueValue*3}`} fill="#7dd3fc" />
        </svg>
        <div>
          <div className="text-sm">Hva er avlesningen? (mL, ±0.02 mL korrekt)</div>
          <div className="flex items-center gap-2 mt-2">
            <input className={inputClass} placeholder="f.eks. 23.45" value={user} onChange={(e)=>setUser(e.target.value)} />
            <button className={btn} onClick={()=>{
              const val = parseFloat(user);
              if(!isFinite(val)) { setMsg("Skriv et tall."); return; }
              setMsg(Math.abs(val - trueValue) <= 0.02 ? "Korrekt!" : `Ikke helt – fasit: ${trueValue.toFixed(2)} mL`);
            }}>Sjekk</button>
            <button className={btn} onClick={newReading}>Ny</button>
          </div>
          {msg && <div className="mt-2 text-sm">{msg}</div>}
        </div>
      </div>
    </div>
  );
}
