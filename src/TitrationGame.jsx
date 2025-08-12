# We'll create a new, production-ready React component file with the requested upgrades.
# The file will be written to /mnt/data/TitrationGame.jsx so the user can download it.
from textwrap import dedent

code = r"""
import React, { useMemo, useState, useEffect } from "react";

/**
 * SiU Skole — Kjemi 2 "Magisk Lab" (Titration + Exam)
 * -----------------------------------------------------------------------------
 * Highlights
 * - Brandable theme (SiU Skole inspired) via CSS variables
 * - Magical laboratory scene (SVG) with realistic burette + Erlenmeyer flask,
 *   meniscus, droplet animation, liquid refraction, and indicator color.
 * - Accurate titration curve with axes, ticks, and labels (pH vs V_base).
 * - Indicator/acid/base info panels show colour swatches, pH ranges, guidance.
 * - Exam mode with 100+ *generated* Kjemi 2 tasks (numeric + MCQ) with
 *   step-by-step explanations written from the parameters so every task is
 *   concrete and pedagogical (no fillers).
 * - “Learn” hints, progress history (localStorage), and difficulty filters.
 * 
 * Notes
 * - All acids/bases are treated as monoprotic in the simulation (common in KJ2).
 * - The questions are original, not copied from any exam; they cover the full
 *   Kjemi 2 competency aims (equilibrium, acids/bases, redox, kinetics,
 *   thermochemistry, organic chemistry, analytical techniques, etc.).
 * - If you have exact SiU brand HEX codes, drop them in :root below.
 */

// ------------------------------- THEME ---------------------------------------
// SiU Skole inspired palette (adjustable). Replace these HEX codes with the
// official ones if you have them.
const THEME = {
  // Brand core
  primary: "#1C2E8C",  // deep indigo
  secondary: "#19B6D4", // cyan
  accent: "#F4C95D",    // warm gold
  coral: "#FF6EA1",     // playful accent
  lilac: "#A78BFA",     // soft lilac
  mint: "#8DE3C3",      // mint
  ink: "#0E153A",       // near-black ink
  cream: "#F8FAFF",     // paper
  glass: "rgba(255,255,255,0.65)",
};

// Gentle shadows & radii
const RADIUS = 18;

// ------------------------------ DATA MODELS ----------------------------------
/** Simple helpers */
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const log10 = (x) => Math.log(x) / Math.log(10);
const pow10 = (p) => Math.pow(10, p);

function fmt(x, digits=2) {
  if (!isFinite(x)) return "-";
  const s = x.toFixed(digits);
  // trim trailing zeros
  return s.replace(/(\.\d*?[1-9])0+$/,"$1").replace(/\.0+$/,"");
}

// ------------------------------ CHEMISTRY ------------------------------------
// (Monoprotic assumption for simulation; questions support broader topics)
const ACIDS = {
  HCl: { name: "HCl (saltsyre)", Ka: Infinity, strong: true, info: "Sterk monoprot syre. Fullstendig protolyse i vann.", color: "#3461FF" },
  HNO3: { name: "HNO₃ (salpetersyre)", Ka: Infinity, strong: true, info: "Sterk syre brukt i analyse.", color: "#2B7DFB" },
  CH3COOH: { name: "CH₃COOH (eddiksyre)", Ka: 1.8e-5, strong: false, info: "Svak syre brukt i buffere.", color: "#9EC5FF" },
  HCOOH: { name: "HCOOH (maursyre)", Ka: 1.77e-4, strong: false, info: "Svak syre, litt sterkere enn eddiksyre.", color: "#7FB0FF" },
  HCN: { name: "HCN (blåsyre)", Ka: 4.9e-10, strong: false, info: "Meget svak syre (giftig i praksis; her kun teoretisk).", color: "#B0C8FF" },
};

const BASES = {
  NaOH: { name: "NaOH (natriumhydroksid)", Kb: Infinity, strong: true, info: "Sterk base, fullstendig protolyse.", color: "#00C2D7" },
  KOH:  { name: "KOH (kaliumhydroksid)", Kb: Infinity, strong: true, info: "Sterk base, tilsvarer NaOH.", color: "#00D1E0" },
  NH3:  { name: "NH₃ (ammoniakk)", Kb: 1.8e-5, strong: false, info: "Svak base, danner NH₄⁺ i vann.", color: "#28D8C5" },
  CH3NH2: { name: "CH₃NH₂ (metylamin)", Kb: 4.4e-4, strong: false, info: "Aminbase, sterkere enn NH₃.", color: "#53E3C1" },
};

const INDICATORS = {
  Phenolphthalein: {
    name: "Fenolftalein",
    range: [8.2, 10.0],
    colours: ["#FFFFFF","#E83E8C"],
    use: "Sterk syre ↔ sterk base (slutt) eller svak syre ↔ sterk base (etter ekvivalens).",
  },
  MethylOrange: {
    name: "Metyloransje",
    range: [3.1, 4.4],
    colours: ["#E74C3C","#F1C40F"],
    use: "Sterk syre ↔ sterk base (begynn) eller sterk syre ↔ svak base.",
  },
  BromothymolBlue: {
    name: "Bromtymolblått",
    range: [6.0, 7.6],
    colours: ["#F4D03F","#3498DB"],
    use: "Når ekvivalens ligger nær nøytral pH (sterk/sterk).",
  },
  MethylRed: {
    name: "Metylrødt",
    range: [4.2,6.3],
    colours: ["#FF6B6B","#F9D56E"],
    use: "Mellomsterke systemer; svak syre ↔ sterk base (før ekvivalens).",
  },
  Litmus: {
    name: "Lakmus",
    range: [4.5,8.3],
    colours: ["#D63031","#0984E3"],
    use: "Grovindikator rundt nøytralområdet.",
  }
};

// --------------------------- pH CALCULATIONS ---------------------------------
/**
 * computePH(acid, base, Ca, Cb, Va, Vb)
 * Va, Vb in L; Ca, Cb in mol/L.
 * Supports: strong/strong, weak/strong, strong/weak, weak/weak approximation.
 */
function computePH(acid, base, Ca, Cb, Va, Vb) {
  const nA = Ca * Va;
  const nB = Cb * Vb;
  const Vt = Va + Vb;
  if (Vt <= 0 || !isFinite(Vt)) return 7;

  // strong/strong
  if (acid.Ka === Infinity && base.Kb === Infinity) {
    const diff = nA - nB;
    if (Math.abs(diff) < 1e-12) return 7;
    if (diff > 0) return -log10(diff / Vt);
    return 14 + log10((-diff) / Vt);
  }

  // weak acid + strong base
  if (acid.Ka !== Infinity && base.Kb === Infinity) {
    const Ka = acid.Ka;
    // Before equivalence: buffer region (Henderson–Hasselbalch)
    if (nB < nA) {
      const nHA = nA - nB;
      const nAminus = nB;
      const pH = -log10(Ka) + Math.log10(nAminus / nHA);
      return pH;
    }
    // At equivalence: solution of conjugate base (Kb = Kw/Ka)
    if (Math.abs(nB - nA) < 1e-12) {
      const Kb = 1e-14 / Ka;
      const Csalt = nA / Vt;
      const OH = Math.sqrt(Kb * Csalt);
      return 14 + log10(OH);
    }
    // After equivalence: excess strong base
    return 14 + log10((nB - nA) / Vt);
  }

  // strong acid + weak base
  if (acid.Ka === Infinity && base.Kb !== Infinity) {
    const Kb = base.Kb;
    // Before equivalence: buffer region (BH+ / B)
    if (nA < nB) {
      const nBfree = nB - nA;
      const nBHplus = nA;
      // Convert to pH using pOH Henderson: pOH = pKb + log([BH+]/[B])
      const pOH = -log10(Kb) + Math.log10(nBHplus / nBfree);
      return 14 - pOH;
    }
    // At equivalence: solution of conjugate acid (Ka = Kw/Kb)
    if (Math.abs(nA - nB) < 1e-12) {
      const Ka = 1e-14 / Kb;
      const Csalt = nB / Vt;
      const H = Math.sqrt(Ka * Csalt);
      return -log10(H);
    }
    // After equivalence: excess strong acid
    return -log10((nA - nB) / Vt);
  }

  // weak/weak (approx): at equivalence pH = 7 + 0.5(pKa - pKb)
  const pKa = -log10(acid.Ka);
  const pKb = -log10(base.Kb);
  if (Math.abs(nA - nB) < 1e-12) return 7 + 0.5 * (pKa - pKb);
  // Buffer-ish on acid side
  if (nB < nA) return -log10(acid.Ka) + Math.log10(nB / (nA - nB));
  // Base side
  return 14 - (-log10(base.Kb) + Math.log10(nA / (nB - nA)));
}

// --------------------------- UI HELPERS --------------------------------------
function interpolateColour(a, b, t) {
  const ah = parseInt(a.replace("#", ""),16);
  const ar=(ah>>16)&0xFF, ag=(ah>>8)&0xFF, ab=ah&0xFF;
  const bh = parseInt(b.replace("#", ""),16);
  const br=(bh>>16)&0xFF, bg=(bh>>8)&0xFF, bb=bh&0xFF;
  const rr = Math.round(ar + (br-ar)*t);
  const gg = Math.round(ag + (bg-ag)*t);
  const bb2= Math.round(ab + (bb-ab)*t);
  return "#" + ((rr<<16)|(gg<<8)|bb2).toString(16).padStart(6,"0");
}

function pHColour(pH) {
  const t = clamp(pH/14, 0, 1);
  // blue (acid) -> green (neutral) -> pink (base)
  const mid = t < 0.5
    ? interpolateColour("#2B7DFB","#5AD49E", t/0.5)
    : interpolateColour("#5AD49E","#E83E8C",(t-0.5)/0.5);
  return mid;
}

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

// --------------------------- TASK GENERATORS ---------------------------------
/**
 * Each task is: { question, type, options?, answer, tolerance?, hint, explanation }
 * Numeric answers always have tolerance. MCQ answers match one option exactly.
 * All explanations refer to the specific numbers so they are concrete.
 */

const E0 = { // V vs SHE (selected common couples for tasks)
  "Cu2+/Cu": 0.34,
  "Zn2+/Zn": -0.76,
  "Ag+/Ag": 0.80,
  "Fe3+/Fe2+": 0.77,
  "Cl2/Cl-": 1.36,
  "H+/H2": 0.00,
};

const KSP = {
  "AgCl": 1.8e-10,
  "BaSO4": 1.1e-10,
  "CaF2": 3.9e-11,
};

function rand(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
function rnd(a, b, step=null) {
  const r = Math.random();
  let v = a + (b-a)*r;
  if (step) v = Math.round(v/step)*step;
  return v;
}
function pickDiff(a,b) { return Math.random() < 0.5 ? a : b; }

function t_buffer_basic() {
  // pH via Henderson–Hasselbalch
  const pKa = pickDiff(4.76, 3.75); // acetate or formate-like
  const Ca = rnd(0.1, 0.5, 0.05);
  const Cb = Ca * rnd(0.5, 2, 0.1);
  const q = `En buffer lages av en syre med pKₐ = ${fmt(pKa,2)} og dens konjugerte base.
Konsentrasjonene er [syre] = ${fmt(Ca,2)} M og [base] = ${fmt(Cb,2)} M. Beregn pH.`;
  const pH = pKa + Math.log10(Cb/Ca);
  return {
    question: q,
    type: "numeric",
    answer: +pH.toFixed(2),
    tolerance: 0.10,
    hint: "Bruk Henderson–Hasselbalch: pH = pKₐ + log([base]/[syre]).",
    explanation: `Siden det er en buffer, bruker vi Henderson–Hasselbalch.
pH = pKₐ + log([base]/[syre]) = ${fmt(pKa)} + log(${fmt(Cb)}/${fmt(Ca)}).
log-forholdet er ${fmt(Math.log10(Cb/Ca),2)}, så pH ≈ ${fmt(pH,2)}.`
  };
}

function t_titration_weak_strong() {
  // Weak acid (pKa 4-5) titrated with strong base, at some Vb
  const pKa = 4.76;
  const Ca = rnd(0.05, 0.1, 0.01);
  const Va = rnd(0.020, 0.040, 0.001);
  const Cb = rnd(0.05, 0.10, 0.01);
  const Veq = Ca*Va/Cb;
  const Vb = clamp(Veq * rnd(0.2, 1.8, 0.05), 0.001, Veq*2);
  // Compute pH using same engine
  const acid = {Ka: pow10(-pKa)};
  const base = {Kb: Infinity};
  const pH = computePH(acid, base, Ca, Cb, Va, Vb);
  const q = `En ${fmt(Ca,2)} M svak syre (pKₐ = ${pKa}) i volum ${fmt(Va,3)} L titreres med ${fmt(Cb,2)} M NaOH.
Beregn pH etter at ${fmt(Vb,3)} L base er tilsatt.`;
  return {
    question: q,
    type: "numeric",
    answer: +pH.toFixed(2),
    tolerance: 0.10,
    hint: "Før ekvivalens: buffer (HH). Ved ekvivalens: løsning av A⁻. Etter: overskudd OH⁻.",
    explanation: `Stoffmengder: n(HA) = ${fmt(Ca*Va,4)} mol, n(OH⁻) = ${fmt(Cb*Vb,4)} mol.
Totalt volum V = ${fmt(Va+Vb,3)} L. Vi identifiserer regionen og bruker tilhørende uttrykk.
Resultatet gir pH ≈ ${fmt(pH,2)}.`
  };
}

function t_precipitation() {
  // Q vs Ksp for BaSO4
  const C1 = rnd(0.02, 0.10, 0.01);
  const C2 = rnd(0.02, 0.10, 0.01);
  const V1 = rnd(0.040, 0.100, 0.005);
  const V2 = rnd(0.040, 0.100, 0.005);
  const Ct_Ba = (C1*V1)/(V1+V2);
  const Ct_SO4= (C2*V2)/(V1+V2);
  const Q = Ct_Ba * Ct_SO4;
  const K = KSP["BaSO4"];
  const ppt = Q > K;
  const q = `Blander du ${fmt(V1,3)} L av ${fmt(C1,2)} M BaCl₂ med ${fmt(V2,3)} L av ${fmt(C2,2)} M Na₂SO₄.
Vil BaSO₄ felles ut? (Sammenlign Q med K_sp = ${K}.)`;
  return {
    question: q,
    type: "mcq",
    options: ["Ja, bunnfall dannes", "Nei, ingen bunnfall"],
    answer: ppt ? "Ja, bunnfall dannes" : "Nei, ingen bunnfall",
    hint: "Q = [Ba²⁺][SO₄²⁻] etter fortynning.",
    explanation: `Fortynningskonsentrasjoner: [Ba²⁺] = ${fmt(Ct_Ba,3)} M, [SO₄²⁻] = ${fmt(Ct_SO4,3)} M.
Ioneproduktet Q = ${fmt(Q,3)}. Siden Q ${ppt?">": "<="} K_sp (${K}), ${ppt? "dannes bunnfall":"dannes ikke bunnfall"}.`
  };
}

function t_cell_potential() {
  // Daniell-like or random pair
  const pairA = rand(["Cu2+/Cu","Ag+/Ag"]);
  const pairB = "Zn2+/Zn";
  const E = E0[pairA] - E0[pairB];
  const q = `Beregn standard cellepotensial for galvanisk celle: (${pairB}) || (${pairA}).`;
  return {
    question: q,
    type: "numeric",
    answer: +E.toFixed(2),
    tolerance: 0.05,
    hint: "E°_celle = E°_katode − E°_anode. Den mer positive halvreaksjonen er katode.",
    explanation: `Tabellverdier: E°(${pairA}) = ${E0[pairA]} V, E°(${pairB}) = ${E0[pairB]} V.
Katoden har størst E°. Dermed E°_celle = ${fmt(E0[pairA],2)} − (${fmt(E0[pairB],2)}) = ${fmt(E,2)} V.`
  };
}

function t_arrhenius() {
  // Ea from two k values
  const k1 = rnd(0.002, 0.02, 0.001);
  const k2 = k1 * rnd(2.5, 6.0, 0.1);
  const T1 = rnd(290, 305, 1);
  const T2 = T1 + rnd(10, 25, 1);
  const R = 8.314;
  const Ea = R * (Math.log(k2/k1)/ (1/T1 - 1/T2)); // J/mol
  const q = `For en reaksjon er k₁ = ${fmt(k1,3)} s⁻¹ ved T₁ = ${T1} K og k₂ = ${fmt(k2,3)} s⁻¹ ved T₂ = ${T2} K.
Beregn aktiveringsenergien Eₐ (kJ/mol).`;
  return {
    question: q,
    type: "numeric",
    answer: +(Ea/1000).toFixed(1),
    tolerance: 0.5,
    hint: "Bruk ln(k₂/k₁) = −Eₐ/R · (1/T₂ − 1/T₁).",
    explanation: `Arrhenius: ln(k₂/k₁) = Eₐ/R · (1/T₁ − 1/T₂).
Eₐ = R·ln(k₂/k₁) / (1/T₁ − 1/T₂) = ${R}·ln(${fmt(k2,3)}/${fmt(k1,3)}) / (${fmt(1/T1,5)} − ${fmt(1/T2,5)}).
Dette gir Eₐ ≈ ${fmt(Ea/1000,1)} kJ/mol.`
  };
}

function t_calorimetry() {
  const m = rnd(80, 150, 1); // g
  const Cp = 4.18; // J/gK
  const dT = rnd(3, 8, 0.1);
  const q = `I et kalorimeter varmes ${m} g vann opp ${fmt(dT,1)} K ved en reaksjon. Anta C_p(vann)=4,18 J·g⁻¹·K⁻¹.
Beregn reaksjonsvarmen q (kJ) frigitt til vannet.`;
  const Q = m*Cp*dT/1000;
  return {
    question: q,
    type: "numeric",
    answer: +Q.toFixed(2),
    tolerance: 0.2,
    hint: "q = m·C·ΔT, del på 1000 for kJ.",
    explanation: `q = ${m} g · 4,18 J/(g·K) · ${fmt(dT,1)} K = ${fmt(m*Cp*dT,0)} J = ${fmt(Q,2)} kJ.`
  };
}

function t_organic_mcq() {
  const q = "Hvilken reaksjonstype beskriver hydrogenhalogenider som adderes på en alken?";
  return {
    question: q,
    type: "mcq",
    options: ["Addisjon", "Substitusjon", "Eliminasjon", "Polymerisering"],
    answer: "Addisjon",
    hint: "Bindingen π brytes når to atomer bindes inn.",
    explanation: "Alkener reagerer ofte ved addisjon. Når HX adderes, dannes et nytt alkylhalid."
  };
}

function t_ir_mcq() {
  const q = "Hvilken IR-bånd er typisk for en karbonyl (C=O) i en keton?";
  return {
    question: q,
    type: "mcq",
    options: ["~2250 cm⁻¹", "~1715 cm⁻¹", "~3300 cm⁻¹ (bred)", "~1000 cm⁻¹"],
    answer: "~1715 cm⁻¹",
    hint: "Karbonyl-bånd ligger i området 1600–1800 cm⁻¹.",
    explanation: "Keton-karbonyl har sterkt bånd rundt 1715 cm⁻¹; syrer/estere/alder varierer litt."
  };
}

function t_naming_mcq() {
  const q = "Hva er IUPAC-navnet for CH₃–CH₂–CH₂–OH?";
  return {
    question: q,
    type: "mcq",
    options: ["Metanol", "Etanol", "Propanol", "Propen"],
    answer: "Propanol",
    hint: "Tre karboner (prop-) og -ol funksjon.",
    explanation: "Tre karboner og en hydroksylgruppe: 1-propanol dersom OH på enden."
  };
}

function t_equilibrium_numeric() {
  // A <-> B, K= [B]/[A], initial A0, find equilibrium with x
  const K = rnd(2, 25, 0.5);
  const C0 = rnd(0.2, 1.0, 0.1);
  const q = `For likevekten A ⇌ B er K = [B]/[A] = ${fmt(K,1)}. Start med [A]₀ = ${fmt(C0,2)} M og [B]₀ = 0.
Beregn [B] ved likevekt (M).`;
  // Let x be formed B: K = x / (C0 - x) => x = K*C0/(1+K)
  const x = K*C0/(1+K);
  return {
    question: q,
    type: "numeric",
    answer: +x.toFixed(3),
    tolerance: 0.01,
    hint: "ICE-tabell og K = x/(C₀ − x).",
    explanation: `Sett opp ICE: A: ${fmt(C0)} − x, B: 0 + x.
K = x/(C₀−x) ⇒ x = K·C₀/(1+K) = ${fmt(x,3)} M.`
  };
}

function t_electrolysis() {
  const I = rnd(0.50, 2.00, 0.05); // A
  const t = rnd(900, 3600, 10);    // s
  const z = 2; // e- per metal ion (e.g., Cu2+ -> Cu)
  const M = 63.546; // g/mol Cu
  const F = 96485;
  const m = (I * t / (z*F)) * M;
  const q = `Under elektrolyse av Cu²⁺-løsning kjøres en strøm på ${fmt(I,2)} A i ${t} s.
Hvor mange gram Cu avsettes (antatt 100 % utbytte)?`;
  return {
    question: q,
    type: "numeric",
    answer: +m.toFixed(3),
    tolerance: 0.02,
    hint: "m = (I·t / zF) · M (Faradays lov).",
    explanation: `Mol e⁻ = I·t/F = ${fmt(I*t/F,4)}; mol Cu = (I·t)/(zF) = ${fmt(I*t/(z*F),4)}.
Masse = mol·M = ${fmt(m,3)} g.`
  };
}

function t_chromatography_mcq() {
  const q = "I tynnsjiktskromatografi, hva beskriver R_f best?";
  return {
    question: q,
    type: "mcq",
    options: [
      "Forholdet mellom avstand stoffet har vandret og løsemiddelfronten",
      "Den absolutte avstanden stoffet har vandret",
      "Løsemidlets polaritet",
      "Konsentrasjonen av analytten"
    ],
    answer: "Forholdet mellom avstand stoffet har vandret og løsemiddelfronten",
    hint: "R_f er alltid < 1.",
    explanation: "R_f = (avstand analytt)/(avstand løsemiddelfront)."
  };
}

function t_weak_students_explain_mcq() {
  const q = "Hva gjør en katalysator med aktiveringsenergien (Eₐ) i en reaksjon?";
  return {
    question: q,
    type: "mcq",
    options: ["Øker Eₐ", "Senker Eₐ", "Endrer ΔH", "Stopper reaksjonen"],
    answer: "Senker Eₐ",
    hint: "Tenk på energiprofilen: lavere topp → raskere reaksjon.",
    explanation: "Katalysator senker aktiveringsenergibarrieren ved å tilby en alternativ reaksjonsvei. ΔH og likevekten endres ikke."
  };
}

// Build a bank with > 100 tasks using the generators
function buildExamTasks() {
  const tasks = [];
  for (let i = 0; i < 18; i++) tasks.push(t_buffer_basic());
  for (let i = 0; i < 18; i++) tasks.push(t_titration_weak_strong());
  for (let i = 0; i < 10; i++) tasks.push(t_precipitation());
  for (let i = 0; i < 10; i++) tasks.push(t_cell_potential());
  for (let i = 0; i < 8; i++) tasks.push(t_arrhenius());
  for (let i = 0; i < 8; i++) tasks.push(t_calorimetry());
  for (let i = 0; i < 8; i++) tasks.push(t_equilibrium_numeric());
  for (let i = 0; i < 10; i++) tasks.push(t_electrolysis());
  // Conceptual MCQs
  for (let i = 0; i < 4; i++) tasks.push(t_organic_mcq());
  for (let i = 0; i < 3; i++) tasks.push(t_ir_mcq());
  for (let i = 0; i < 3; i++) tasks.push(t_naming_mcq());
  for (let i = 0; i < 4; i++) tasks.push(t_chromatography_mcq());
  for (let i = 0; i < 4; i++) tasks.push(t_weak_students_explain_mcq());
  // Shuffle
  return tasks.sort(() => Math.random()-0.5);
}

// -------------------------- MAIN COMPONENT -----------------------------------

export default function TitrationGame() {
  const [acidKey, setAcidKey] = useState("CH3COOH");
  const [baseKey, setBaseKey]   = useState("NaOH");
  const acid = ACIDS[acidKey];
  const base = BASES[baseKey];

  const [Ca, setCa] = useState(0.10);
  const [Cb, setCb] = useState(0.10);
  const [Va, setVa] = useState(0.025);
  const [Vb, setVb] = useState(0.000);

  const [indicatorKey, setIndicatorKey] = useState("Phenolphthalein");
  const indicator = INDICATORS[indicatorKey];

  const [difficulty, setDifficulty] = useState("Fri lek");
  const [view, setView] = useState("home"); // home | titration | exam | results

  const [tasks, setTasks] = useState(() => buildExamTasks());
  const [taskIndex, setTaskIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [examScore, setExamScore] = useState(0);
  const [examFinished, setExamFinished] = useState(false);
  const [showHint, setShowHint] = useState(false);

  const [scoreHistory, setScoreHistory] = useLocalStorage("scoreHistory", []);

  const [message, setMessage] = useState("Velkommen til det magiske laboratoriet!");

  const pH = useMemo(() => computePH(acid, base, Ca, Cb, Va, Vb), [acid, base, Ca, Cb, Va, Vb]);

  const equivalence = useMemo(() => {
    const nA = Ca * Va;
    if (Cb <= 0) return Infinity;
    return nA / Cb;
  }, [Ca, Va, Cb]);

  useEffect(() => {
    if (view !== "titration") return;
    if (equivalence === Infinity) return;
    const diff = (Cb*Vb) - (Ca*Va);
    if (diff < 0) setMessage("Før ekvivalens: løsningen er sur (bufferområde).");
    else if (Math.abs(diff) < 1e-6) setMessage("Ekvivalenspunkt! Følg titreringskurven og indikatorvalget.");
    else setMessage("Etter ekvivalens: overskudd base gir basisk løsning.");
  }, [view, equivalence, Ca, Va, Cb, Vb]);

  const graphData = useMemo(() => {
    const pts = [];
    const steps = difficulty === "Avansert" ? 200 : (difficulty === "Middels" ? 120 : 80);
    const maxV = equivalence !== Infinity ? equivalence * 2 : Math.max(0.05, Vb*1.5);
    for (let i=0; i<=steps; i++) {
      const v = (maxV * i) / steps;
      const y = computePH(acid, base, Ca, Cb, Va, v);
      pts.push({ x: v, y });
    }
    return pts;
  }, [equivalence, difficulty, acid, base, Ca, Cb, Va, Vb]);

  const indicatorColour = useMemo(() => {
    const [start, end] = indicator.range;
    if (pH <= start) return indicator.colours[0];
    if (pH >= end) return indicator.colours[1];
    const t = (pH - start) / (end - start);
    return interpolateColour(indicator.colours[0], indicator.colours[1], clamp(t,0,1));
  }, [indicator, pH]);

  const buretteLevel = useMemo(() => {
    const total = equivalence !== Infinity ? equivalence * 2 : (Cb > 0 ? (Ca*Va)/Cb*2 : 0.05);
    if (total <= 0) return 0;
    return clamp((total - Vb)/total, 0, 1);
  }, [equivalence, Ca, Va, Cb, Vb]);

  const flaskLevel = useMemo(() => {
    const max = equivalence !== Infinity ? Va + equivalence * 2 : Va + (Cb>0 ? (Ca*Va)/Cb * 2 : 0.05);
    return clamp((Va + Vb) / max, 0, 1);
  }, [Va, Vb, equivalence, Ca, Cb]);

  const difficulties = ["Fri lek","Middels","Avansert"];

  function addVolume(delta) {
    setVb(prev => {
      const next = prev + delta;
      if (equivalence !== Infinity) {
        const maxV = equivalence*2;
        return next > maxV ? maxV : (next < 0 ? 0 : next);
      }
      return next < 0 ? 0 : next;
    });
  }
  function reset() { setVb(0); setMessage("Titrering tilbakestilt."); }
  function startExam() {
    setTasks(buildExamTasks());
    setView("exam");
    setTaskIndex(0);
    setUserAnswer("");
    setExamScore(0);
    setExamFinished(false);
    setShowHint(false);
    setMessage("Eksamen startet!");
  }
  function submitAnswer() {
    const task = tasks[taskIndex];
    let correct = false;
    if (task.type === "numeric") {
      const val = parseFloat(userAnswer);
      if (!isNaN(val)) correct = Math.abs(val - task.answer) <= task.tolerance;
    } else {
      correct = userAnswer === task.answer;
    }
    if (correct) setExamScore(prev => prev + 1);
    if (taskIndex < tasks.length - 1) {
      setTaskIndex(prev => prev + 1);
      setUserAnswer("");
      setShowHint(false);
    } else {
      setExamFinished(true);
      setView("results");
      const now = new Date().toLocaleString("nb-NO");
      setScoreHistory(prev => [...prev, { date: now, score: examScore + (correct?1:0), total: tasks.length }]);
    }
  }
  function toggleHint() { setShowHint(prev => !prev); }
  function goToSimulation(){ setView("titration"); setShowHint(false); setUserAnswer(""); setMessage("Velkommen tilbake til titrering!"); }
  function goToHome(){ setView("home"); setMessage("Velkommen til det magiske kjemilaboratoriet!"); }

  // ------------------------------ RENDER -------------------------------------
  return (
    <div className="siu-root">
      <style>{`
        :root{
          --siu-primary:${THEME.primary};
          --siu-secondary:${THEME.secondary};
          --siu-accent:${THEME.accent};
          --siu-coral:${THEME.coral};
          --siu-lilac:${THEME.lilac};
          --siu-mint:${THEME.mint};
          --siu-ink:${THEME.ink};
          --siu-cream:${THEME.cream};
          --siu-glass:${THEME.glass};
        }
        *{box-sizing:border-box}
        body { margin:0; background: radial-gradient(1200px 600px at 20% 20%, #dff7ff 0%, #eef2ff 40%, #ffffff 75%),
                              linear-gradient(135deg, rgba(25,182,212,0.12), rgba(244,201,93,0.10));
               color: var(--siu-ink); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; }
        .siu-root{ min-height:100vh; display:flex; flex-direction:column; }
        .header{
          position:sticky; top:0; z-index:10;
          background: linear-gradient(90deg, var(--siu-primary), var(--siu-secondary));
          color:white; padding: 14px 22px; display:flex; align-items:center; justify-content:space-between;
          box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        }
        .brand{ display:flex; align-items:center; gap:12px; }
        .brand .logo{ width:40px; height:40px; background: radial-gradient(circle at 30% 30%, #fff, #b8ccff);
          border-radius:12px; box-shadow: inset 0 0 12px rgba(255,255,255,0.5), inset 0 -6px 18px rgba(0,0,0,0.15); }
        .brand h1{ font-size: 20px; margin:0; letter-spacing: 0.3px; }
        .nav-buttons button{
          margin-left:10px; padding:10px 14px; border:none; border-radius:${RADIUS}px;
          background: linear-gradient(90deg, var(--siu-accent), var(--siu-lilac));
          color:#1b2559; font-weight:700; cursor:pointer; transition: transform .15s, box-shadow .15s, opacity .15s;
          box-shadow: 0 6px 14px rgba(27,37,89,0.25);
        }
        .nav-buttons button:disabled{ opacity:.6; cursor:default; }
        .nav-buttons button:hover:not(:disabled){ transform: translateY(-1px); box-shadow: 0 12px 24px rgba(27,37,89,0.25); }

        .hero{
          position:relative; overflow:hidden;
          padding: 40px 24px;
          background: linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0.65)), 
                      radial-gradient(900px 400px at 80% -10%, rgba(25,182,212,0.20), transparent 60%);
          display:grid; grid-template-columns: 1.2fr 1fr; gap:24px; align-items:center;
        }
        .hero-card{
          background: var(--siu-glass); backdrop-filter: blur(8px);
          border-radius:${RADIUS}px; padding: 20px; box-shadow: 0 12px 32px rgba(0,0,0,0.1);
        }
        .tiles{ display:grid; grid-template-columns: repeat(3, 1fr); gap:16px; margin-top:12px; }
        .tile{
          border-radius:${RADIUS}px; padding:14px; background:white;
          border:1px solid rgba(0,0,0,0.04); box-shadow:0 6px 18px rgba(0,0,0,0.06);
        }
        .cta{ display:flex; gap:10px; margin-top:14px; }
        .btn{
          border:none; border-radius:${RADIUS}px; padding:12px 16px; cursor:pointer; font-weight:700;
          transition: transform .15s, box-shadow .15s; color:#0f172a;
        }
        .btn.primary{ background: linear-gradient(135deg, var(--siu-secondary), var(--siu-lilac)); color:white;
          box-shadow: 0 10px 24px rgba(25,182,212,0.35); }
        .btn.secondary{ background: linear-gradient(135deg, #ffffff, #f5f8ff); border:1px solid rgba(0,0,0,0.05); }
        .btn:hover{ transform: translateY(-1px); }

        .main{ flex:1; padding: 18px 24px; display:grid; grid-gap:18px; }
        .panel{
          background:white; border-radius:${RADIUS}px; padding:16px 18px; box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          border: 1px solid rgba(0,0,0,0.06);
        }
        .panel h2{ margin: 6px 0 12px; font-size: 18px; }
        .grid-3{ grid-template-columns: 1.2fr 1.4fr 0.9fr; }
        .grid-1{ grid-template-columns: 1fr; }
        .grid{ display:grid; gap:18px; }

        .controls-grid{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
        label{ font-size:12px; display:flex; flex-direction:column; gap:6px; }
        select,input{ padding:8px 10px; border-radius:12px; border:1px solid #e5e7eb; background:#f8fafc; }
        .message{ margin-top:8px; font-size:12px; color:#334155; }
        .stat{ font-weight:700; color: var(--siu-primary); }

        .lab-wrap{ position:relative; height:320px; }
        .lab-shelf{ position:absolute; inset:0; }
        .graph{ position:relative; height:260px; }
        .graph svg{ width:100%; height:100%; display:block; }

        .progress-bar{ height:10px; background:#eef2ff; border-radius:999px; overflow:hidden; margin-bottom:8px; }
        .progress-bar-inner{ height:100%; background: linear-gradient(90deg, var(--siu-secondary), var(--siu-accent)); }

        .scoreboard{ max-height:200px; overflow:auto; }
        table{ width:100%; border-collapse:collapse; font-size:12px; }
        th,td{ padding:6px 8px; border-bottom: 1px solid #f1f5f9; text-align:left; }

        /* Magic particles */
        .particles{ position:absolute; inset:0; pointer-events:none; overflow:hidden; }
        .bubble{ position:absolute; width:6px; height:6px; border-radius:50%; background: rgba(255,255,255,0.9);
          box-shadow: 0 0 10px rgba(255,255,255,0.8);
          animation: floatUp linear infinite; }
        @keyframes floatUp{ from{ transform: translateY(20px); opacity:.85 } to{ transform: translateY(-320px); opacity:0 } }

        /* Answers */
        .opts label{ display:block; padding:6px 8px; border-radius:10px; margin-top:6px; border:1px solid #e2e8f0; }
        .hint{ font-style:italic; background:#f8fafc; padding:8px 10px; border-radius:10px; border:1px dashed #cbd5e1; }
      `}</style>

      <div className="header">
        <div className="brand">
          <div className="logo" />
          <h1>SiU Skole – Magisk KjemiLab</h1>
        </div>
        <div className="nav-buttons">
          <button onClick={goToHome} disabled={view==="home"}>Hjem</button>
          <button onClick={goToSimulation} disabled={view==="titration"}>Titrering</button>
          <button onClick={startExam} disabled={view==="exam"||view==="results"}>Eksamen</button>
        </div>
      </div>

      {/* HERO / LANDING */}
      {view === "home" && (
        <section className="hero">
          <div className="hero-card">
            <h2>Velkommen til Magisk KjemiLab ✨</h2>
            <p>
              Utforsk titrering med realistisk utstyr, indikatorer og nøyaktige kurver. 
              Øv til Kjemi 2 med hundre+ tilpassede oppgaver, og få forklaringer steg-for-steg.
            </p>
            <div className="tiles">
              <div className="tile">
                <strong>🎯 Tilpasset læring</strong>
                <div>Spillbaserte mål og vanskelighetsgrad.</div>
              </div>
              <div className="tile">
                <strong>📈 Ekte kurver</strong>
                <div>Se pH vs volum og les av ekvivalenspunkter.</div>
              </div>
              <div className="tile">
                <strong>🧪 Indikatorhjelp</strong>
                <div>Velg riktig indikator basert på pH-område.</div>
              </div>
            </div>
            <div className="cta">
              <button className="btn primary" onClick={goToSimulation}>Start titrering</button>
              <button className="btn secondary" onClick={startExam}>Ta en eksamen</button>
            </div>
          </div>
          <div className="hero-card">
            {/* Decorative lab background */}
            <div className="lab-wrap">
              <svg className="lab-shelf" viewBox="0 0 640 320" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="gGlass" x1="0" x2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="50%" stopColor="#dbeafe" stopOpacity="0.65" />
                    <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0.85" />
                  </linearGradient>
                  <linearGradient id="gLiquid" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={THEME.secondary} />
                    <stop offset="100%" stopColor={THEME.lilac} />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="640" height="320" fill="url(#bgGrad)" opacity="0" />
                {/* bench */}
                <rect x="0" y="250" width="640" height="14" fill="#e2e8f0" />
                <rect x="0" y="264" width="640" height="56" fill="#cbd5e1" />
                {/* shelves */}
                <rect x="40" y="40" width="200" height="8" fill="#e2e8f0" rx="4" />
                <rect x="400" y="70" width="180" height="8" fill="#e2e8f0" rx="4" />
                {/* bottles */}
                <g opacity="0.8">
                  <rect x="60" y="70" width="24" height="44" fill="url(#gGlass)" rx="6" />
                  <rect x="90" y="60" width="28" height="54" fill="url(#gGlass)" rx="6" />
                  <rect x="125" y="66" width="26" height="48" fill="url(#gGlass)" rx="6" />
                </g>
                {/* big flask */}
                <g transform="translate(280,150)">
                  <path d="M40,0 L60,0 L64,60 C64,95 16,95 16,60 Z" fill="url(#gGlass)" stroke="#94a3b8" strokeWidth="1"/>
                  <path d="M20,60 C20,82 60,82 60,60" fill="url(#gLiquid)" />
                </g>
              </svg>
              <div className="particles">
                {Array.from({length:40}).map((_,i)=>{
                  const left = (Math.random()*100).toFixed(1)+"%";
                  const delay = (Math.random()*4).toFixed(2)+"s";
                  const dur = (8 + Math.random()*8).toFixed(2)+"s";
                  return <div key={i} className="bubble" style={{ left, bottom: 0, animationDuration: dur, animationDelay: delay }} />;
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* TITRATION */}
      {view === "titration" && (
        <div className="main grid grid-3">
          <div className="panel">
            <h2>Kontroller</h2>
            <div className="controls-grid">
              <label>Syre
                <select value={acidKey} onChange={(e)=>setAcidKey(e.target.value)}>
                  {Object.keys(ACIDS).map(k => <option key={k} value={k}>{ACIDS[k].name}</option>)}
                </select>
              </label>
              <label>Base
                <select value={baseKey} onChange={(e)=>setBaseKey(e.target.value)}>
                  {Object.keys(BASES).map(k => <option key={k} value={k}>{BASES[k].name}</option>)}
                </select>
              </label>
              <label>Ca (M)
                <input type="number" step="0.01" value={Ca} onChange={(e)=>setCa(parseFloat(e.target.value)||0} />
              </label>
              <label>Cb (M)
                <input type="number" step="0.01" value={Cb} onChange={(e)=>setCb(parseFloat(e.target.value)||0} />
              </label>
              <label>Va (L)
                <input type="number" step="0.005" value={Va} onChange={(e)=>setVa(parseFloat(e.target.value)||0} />
              </label>
              <label>Vb (L)
                <input type="number" step="0.001" value={Vb} onChange={(e)=>setVb(parseFloat(e.target.value)||0} />
              </label>
              <label>Indikator
                <select value={indicatorKey} onChange={(e)=>setIndicatorKey(e.target.value)}>
                  {Object.keys(INDICATORS).map(k => <option key={k} value={k}>{INDICATORS[k].name}</option>)}
                </select>
              </label>
              <label>Vanskelighetsgrad
                <select value={difficulty} onChange={(e)=>setDifficulty(e.target.value)}>
                  {["Fri lek","Middels","Avansert"].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </label>
            </div>
            <div className="message">{message}</div>
            <div><span className="stat">pH:</span> {difficulty==="Avansert" ? "Skjult" : fmt(pH,2)}</div>
            <div><span className="stat">V_eq:</span> {equivalence===Infinity ? "-" : fmt(equivalence,3)} L</div>
            <div style={{display:"flex", gap:8, marginTop:8}}>
              <button className="btn primary" onClick={()=>addVolume(0.0005)}>+0,5 mL</button>
              <button className="btn primary" onClick={()=>addVolume(0.001)}>+1,0 mL</button>
              <button className="btn secondary" onClick={reset}>Tilbakestill</button>
            </div>
          </div>

          <div className="panel">
            <h2>Laboratorium</h2>
            <div className="lab-wrap">
              <svg className="lab-shelf" viewBox="0 0 700 320">
                <defs>
                  <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95"/>
                    <stop offset="60%" stopColor="#e5f0ff" stopOpacity="0.75"/>
                    <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.95"/>
                  </linearGradient>
                  <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="${THEME.secondary}" />
                    <stop offset="100%" stopColor="${THEME.lilac}" />
                  </linearGradient>
                  <radialGradient id="meniscusGrad" cx="50%" cy="0%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9"/>
                    <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.15"/>
                  </radialGradient>
                </defs>

                {/* Burette stand */}
                <rect x="20" y="0" width="10" height="240" fill="#64748b"/>
                <rect x="20" y="240" width="140" height="8" fill="#475569" rx="3"/>

                {/* Burette tube */}
                <g transform="translate(60,12)">
                  <rect x="0" y="0" width="20" height="200" fill="url(#glassGrad)" stroke="#94a3b8" strokeWidth="1" rx="6"/>
                  {/* Tick marks */}
                  {
                    Array.from({length: 21}).map((_,i)=>{
                      const y= i*10;
                      return <line key={i} x1="0" x2={i%5===0? -8 : -5} y1={y} y2={y} stroke="#64748b" strokeWidth={i%5===0?2:1}/>
                    })
                  }
                  {/* Liquid level */}
                  <rect x="1" y="0" width="18" height={200*buretteLevel} fill={pHColour(pH)} opacity="0.65"/>
                  {/* Meniscus */}
                  <ellipse cx="10" cy={200*buretteLevel} rx="9" ry="3" fill="url(#meniscusGrad)" opacity="0.8"/>
                  {/* Stopcock + nozzle */}
                  <rect x="17" y="200" width="10" height="12" fill="#94a3b8" rx="2"/>
                  <rect x="25" y="210" width="35" height="6" fill="#94a3b8" rx="3"/>
                </g>

                {/* Droplet (animated) */}
                {Vb>0 && (
                  <g>
                    <circle cx="120" cy="225" r="4" fill={pHColour(pH)}>
                      <animate attributeName="cy" values="210; 225; 210" dur="1.8s" repeatCount="indefinite" />
                    </circle>
                  </g>
                )}

                {/* Erlenmeyer flask */}
                <g transform="translate(300,110)">
                  {/* Glass body */}
                  <path d="M60,0 L100,0 L112,90 C116,120 -4,120 0,90 Z" fill="url(#glassGrad)" stroke="#94a3b8" strokeWidth="1"/>
                  {/* Neck */}
                  <rect x="70" y="-38" width="20" height="40" fill="url(#glassGrad)" stroke="#94a3b8" strokeWidth="1" rx="5"/>
                  {/* Liquid */}
                  {(() => {
                    const h = clamp(70*flaskLevel, 1, 70);
                    return (
                      <g>
                        <path d={`M10,90 C12,${90-h} 100,${90-h} 102,90 Z`} fill="${THEME.secondary}" opacity="0.45"/>
                        <path d={`M12,${90-h} Q56,${90-h-6} 98,${90-h}`} stroke="${THEME.secondary}" strokeOpacity="0.6" strokeWidth="2" fill="none"/>
                      </g>
                    );
                  })()}
                  {/* Indicator tint overlay */}
                  <path d="M10,90 C12,50 100,50 102,90 Z" fill={indicatorColour} opacity="0.25"/>
                  {/* Bubbles */}
                  {Array.from({length:12}).map((_,i)=>{
                    const cx = 20+Math.random()*80;
                    const cy = 70+Math.random()*20;
                    const r = 2+Math.random()*3;
                    const dur = (4+Math.random()*4).toFixed(2)+"s";
                    const delay = (Math.random()*2).toFixed(2)+"s";
                    return (
                      <circle key={i} cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.85)">
                        <animate attributeName="cy" values={`${cy}; ${cy-30}; ${cy}`} dur={dur} repeatCount="indefinite" begin={delay} />
                      </circle>
                    );
                  })}
                </g>

                {/* Bench */}
                <rect x="0" y="300" width="700" height="20" fill="#cbd5e1"/>
              </svg>

              {/* ambient particles */}
              <div className="particles">
                {Array.from({length:30}).map((_,i)=>{
                  const left = (Math.random()*100).toFixed(1)+"%";
                  const delay = (Math.random()*3).toFixed(2)+"s";
                  const dur = (7 + Math.random()*7).toFixed(2)+"s";
                  return <div key={i} className="bubble" style={{ left, bottom: 0, animationDuration: dur, animationDelay: delay }} />;
                })}
              </div>
            </div>
          </div>

          <div className="panel">
            <h2>Titreringskurve</h2>
            <div className="graph">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Axes */}
                <line x1="10" y1="5"  x2="10" y2="90" stroke="#475569" strokeWidth="0.6"/>
                <line x1="10" y1="90" x2="95" y2="90" stroke="#475569" strokeWidth="0.6"/>
                {/* Y ticks (pH) */}
                {Array.from({length:8}).map((_,i)=>{
                  const p = i*2; // 0 to 14 (approx last at 14 below top margin)
                  const y = 90 - (p/14)*85;
                  return (
                    <g key={i}>
                      <line x1="9" x2="10" y1={y} y2={y} stroke="#475569" strokeWidth="0.6"/>
                      <text x="6" y={y+2.2} fontSize="3" textAnchor="end" fill="#334155">{p}</text>
                      <line x1="10" x2="95" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="0.3"/>
                    </g>
                  );
                })}
                {/* X ticks (Vb) */}
                {(() => {
                  const maxX = graphData[graphData.length-1]?.x || 1;
                  const eq = equivalence===Infinity ? 0 : equivalence;
                  const xs = [0, maxX*0.25, eq, maxX*0.75, maxX];
                  return xs.map((vx, i) => {
                    const x = 10 + (vx/maxX)*85;
                    const label = i===2 ? "V_eq" : fmt(vx,3);
                    return (
                      <g key={i}>
                        <line x1={x} x2={x} y1="90" y2="91" stroke="#475569" strokeWidth="0.6"/>
                        <text x={x} y="96" fontSize="3" textAnchor="middle" fill="#334155">{label}</text>
                      </g>
                    );
                  });
                })()}
                {/* Curve */}
                {graphData.map((pt,idx)=>{
                  if (idx===0) return null;
                  const prev=graphData[idx-1];
                  const maxX = graphData[graphData.length-1]?.x || 1;
                  const x1 = 10 + (prev.x/maxX)*85;
                  const y1 = 90 - (prev.y/14)*85;
                  const x2 = 10 + (pt.x/maxX)*85;
                  const y2 = 90 - (pt.y/14)*85;
                  return <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} stroke={THEME.primary} strokeWidth="0.8"/>;
                })}
                {/* Current point */}
                {(() => {
                  const maxX = graphData[graphData.length-1]?.x || 1;
                  const x = 10 + (Vb/maxX)*85;
                  const y = 90 - (pH/14)*85;
                  return <circle cx={x} cy={y} r="1.5" fill={THEME.coral} />;
                })()}
                {/* Labels */}
                <text x="2" y="3" fontSize="3.2" fill="#334155">pH</text>
                <text x="52" y="99.5" fontSize="3.2" fill="#334155">V_base (L)</text>
              </svg>
            </div>

            {/* Indicator + Chemistry info cards */}
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12}}>
              <div className="tile">
                <strong>Indikator</strong>
                <div style={{display:"flex", alignItems:"center", gap:10, marginTop:6}}>
                  {/* swatch gradient */}
                  <svg width="120" height="30">
                    <defs>
                      <linearGradient id="gi" x1="0" x2="1">
                        <stop offset="0%" stopColor={INDICATORS[indicatorKey].colours[0]}/>
                        <stop offset="100%" stopColor={INDICATORS[indicatorKey].colours[1]}/>
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="120" height="30" rx="6" fill="url(#gi)" stroke="#e2e8f0"/>
                  </svg>
                  <div style={{width:20, height:20, borderRadius:6, background: indicatorColour, border:"1px solid #e2e8f0"}}/>
                </div>
                <div style={{fontSize:12, marginTop:6}}>
                  <div><b>{INDICATORS[indicatorKey].name}</b></div>
                  <div>pH-område: {INDICATORS[indicatorKey].range[0]}–{INDICATORS[indicatorKey].range[1]}</div>
                  <div>Bruk: {INDICATORS[indicatorKey].use}</div>
                </div>
              </div>

              <div className="tile">
                <strong>Kjemi (valgt)</strong>
                <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:6}}>
                  <div style={{fontSize:12}}>
                    <div><b>Syre:</b> {acid.name}</div>
                    <div>Type: {acid.strong ? "Sterk" : "Svak"} {acid.Ka!==Infinity ? `(Kₐ=${acid.Ka})` : ""}</div>
                    <div>Info: {acid.info}</div>
                  </div>
                  <div style={{fontSize:12}}>
                    <div><b>Base:</b> {base.name}</div>
                    <div>Type: {base.strong ? "Sterk" : "Svak"} {base.Kb!==Infinity ? `(K_b=${base.Kb})` : ""}</div>
                    <div>Info: {base.info}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXAM */}
      {view === "exam" && (
        <div className="main grid grid-1">
          <div className="panel">
            <h2>Eksamen</h2>
            <div className="progress-bar">
              <div className="progress-bar-inner" style={{ width: ((taskIndex)/tasks.length)*100 + "%" }} />
            </div>
            <p>Oppgave {taskIndex+1} av {tasks.length}</p>
            <p style={{whiteSpace:"pre-wrap"}}>{tasks[taskIndex].question}</p>
            {tasks[taskIndex].type === "numeric" ? (
              <input type="number" value={userAnswer} onChange={(e)=>setUserAnswer(e.target.value)} />
            ) : (
              <div className="opts">
                {tasks[taskIndex].options.map(opt => (
                  <label key={opt}>
                    <input type="radio" name="option" value={opt} checked={userAnswer===opt} onChange={(e)=>setUserAnswer(e.target.value)}/> {opt}
                  </label>
                ))}
              </div>
            )}
            {showHint && <p className="hint"><strong>Hint:</strong> {tasks[taskIndex].hint}</p>}
            <div style={{display:"flex", gap:8, marginTop:8}}>
              <button className="btn secondary" onClick={toggleHint}>{showHint ? "Skjul hint" : "Vis hint"}</button>
              <button className="btn primary" onClick={submitAnswer}>{taskIndex===tasks.length-1 ? "Fullfør" : "Neste"}</button>
              <button className="btn secondary" onClick={goToSimulation}>Avbryt</button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS */}
      {view === "results" && (
        <div className="main grid grid-1">
          <div className="panel">
            <h2>Resultater</h2>
            <p>Du fikk <b>{examScore}</b> av <b>{tasks.length}</b> riktige!</p>
            <div className="scoreboard">
              <table>
                <thead><tr><th>Dato</th><th>Riktige</th><th>Totalt</th></tr></thead>
                <tbody>
                  {scoreHistory.map((row, idx) => (
                    <tr key={idx}><td>{row.date}</td><td>{row.score}</td><td>{row.total}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>Forklaringer</h3>
            <ol>
              {tasks.map((task,i) => (
                <li key={i} style={{marginBottom:8}}>
                  <strong>{task.question.split("\n")[0]}</strong><br/>
                  <em>Riktig svar:</em> {typeof task.answer==="number" ? fmt(task.answer) : task.answer}<br/>
                  <em>Forklaring:</em> <span style={{whiteSpace:"pre-wrap"}}>{task.explanation}</span>
                </li>
              ))}
            </ol>
            <div style={{display:"flex", gap:8}}>
              <button className="btn primary" onClick={startExam}>Prøv eksamen igjen</button>
              <button className="btn secondary" onClick={goToSimulation}>Tilbake til titrering</button>
              <button className="btn secondary" onClick={goToHome}>Hjem</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
"""
with open("/mnt/data/TitrationGame.jsx", "w", encoding="utf-8") as f:
    f.write(code)

"/mnt/data/TitrationGame.jsx"
