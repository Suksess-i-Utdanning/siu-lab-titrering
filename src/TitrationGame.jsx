import React, { useState, useMemo, useEffect } from 'react';

/*
 * SiU Lab – Magisk KjemiLab (Step 6)
 *
 * This version extends the practical laboratory exam game so that every
 * experiment type contains a hands‑on simulation panel where the student
 * selects reagents and equipment just as they would in a real laboratory.
 *
 * Major changes in this step:
 *  • Precipitation (Felling) tasks now allow the student to choose two
 *    salts from a list. The simulator computes whether a precipitate
 *    forms and classifies it as insoluble, slightly soluble or soluble.
 *    It also reports typical colours for common precipitates. Students
 *    must pick the correct salt combination for the given question.
 *  • The galvanic category has been renamed “Elektrokjemi” and now
 *    comprises three sub‑experiments: galvanisk celle (galvanic cell),
 *    elektrolyse (electrolysis of aqueous solutions) and smelte (molten
 *    salt electrolysis). Each sub‑experiment presents its own panel with
 *    appropriate choices: electrodes, electrolytes, salt bridge, water
 *    addition and voltage source. Tasks check that the student selects
 *    the correct configuration for the target reaction.
 *  • Calorimetry panels now include apparatus selection (styrofoam cup
 *    vs bomb calorimeter), a thermometer toggle and mass/temperature
 *    inputs. Tasks may require students to choose the correct apparatus
 *    for a given reaction.
 *
 * The overall structure remains similar to Step 5: the student starts
 * on the home screen, selects an experiment type, and then answers a
 * series of tasks. Each task presents a question, optional numeric or
 * multiple‑choice answer input, hint/solution toggles, and an
 * interactive panel matching the experiment. After all tasks are
 * answered the student receives a score and can retry or choose another
 * experiment.
 */

// -----------------------------------------------------------------------------
// Constants and helpers

// Acid/base definitions for titration simulation.
const ACIDS = {
  HCl: { name: 'HCl (saltsyre)', Ka: Infinity, strong: true, info: 'Sterk syre', colour: '#3461FF' },
  HNO3: { name: 'HNO₃ (salpetersyre)', Ka: Infinity, strong: true, info: 'Sterk syre', colour: '#2B7DFB' },
  CH3COOH: { name: 'CH₃COOH (eddiksyre)', Ka: 1.8e-5, strong: false, info: 'Svak syre', colour: '#9EC5FF' },
  HCOOH: { name: 'HCOOH (maursyre)', Ka: 1.77e-4, strong: false, info: 'Svak syre', colour: '#7FB0FF' },
  HCN: { name: 'HCN (blåsyre)', Ka: 4.9e-10, strong: false, info: 'Meget svak syre', colour: '#B0C8FF' },
};
const BASES = {
  NaOH: { name: 'NaOH (natriumhydroksid)', Kb: Infinity, strong: true, info: 'Sterk base', colour: '#00C2D7' },
  KOH: { name: 'KOH (kaliumhydroksid)', Kb: Infinity, strong: true, info: 'Sterk base', colour: '#00D1E0' },
  NH3: { name: 'NH₃ (ammoniakk)', Kb: 1.8e-5, strong: false, info: 'Svak base', colour: '#28D8C5' },
  CH3NH2: { name: 'CH₃NH₂ (metylamin)', Kb: 4.4e-4, strong: false, info: 'Aminbase', colour: '#53E3C1' },
};
// Indicator definitions for titration.
const INDICATORS = {
  Phenolphthalein: {
    name: 'Fenolftalein',
    range: [8.2, 10.0],
    colours: ['#FFFFFF', '#E83E8C'],
    use: 'Svak syre ↔ sterk base (basisk område)',
  },
  MethylOrange: {
    name: 'Metyloransje',
    range: [3.1, 4.4],
    colours: ['#E74C3C', '#F1C40F'],
    use: 'Sterk syre ↔ svak base (surt område)',
  },
  BromothymolBlue: {
    name: 'Bromtymolblått',
    range: [6.0, 7.6],
    colours: ['#F4D03F', '#3498DB'],
    use: 'Sterk syre ↔ sterk base (nøytralområde)',
  },
  MethylRed: {
    name: 'Metylrødt',
    range: [4.2, 6.3],
    colours: ['#FF6B6B', '#F9D56E'],
    use: 'Mellomsterke systemer',
  },
};

// Standard reduction potentials (V) versus SHE for common couples.
const E0 = {
  'Cu': 0.34,
  'Zn': -0.76,
  'Ag': 0.80,
  'Fe': -0.44, // Fe2+/Fe(s) (approx.), used for demonstration
};

// Solubility products (Ksp) and colour info for precipitation reactions.
// The keys are the insoluble product formulas; each entry records Ksp and colour.
const PRECIPITATE_INFO = {
  'AgCl': { ksp: 1.8e-10, colour: 'hvitt' },
  'BaSO4': { ksp: 1.1e-10, colour: 'hvitt' },
  'CaCO3': { ksp: 4.8e-9, colour: 'hvitt' },
  'Cu(OH)2': { ksp: 1.6e-19, colour: 'blått' },
  'Fe(OH)3': { ksp: 2.8e-39, colour: 'rustbrunt' },
};

// Reaction map for precipitation tasks. Each key is a pair of salts
// joined with '+', the value specifies the insoluble product formed (if any).
const PRECIPITATION_REACTIONS = {
  'AgNO3+NaCl': 'AgCl',
  'AgNO3+KCl': 'AgCl',
  'AgNO3+CaCl2': 'AgCl',
  'CaCl2+Na2CO3': 'CaCO3',
  'CaCl2+K2CO3': 'CaCO3',
  'BaCl2+Na2SO4': 'BaSO4',
  'BaCl2+K2SO4': 'BaSO4',
  'CuSO4+NaOH': 'Cu(OH)2',
  'FeCl3+NaOH': 'Fe(OH)3',
};

// List of salts available for precipitation experiments. Each entry has
// a formula and a description. Only salts whose ions are present in
// PRECIPITATION_REACTIONS or will not produce precipitate.
const SALT_OPTIONS = [
  { formula: 'AgNO3', description: 'Sølvnitrat' },
  { formula: 'NaCl', description: 'Natriumklorid' },
  { formula: 'KCl', description: 'Kaliumklorid' },
  { formula: 'CaCl2', description: 'Kalsiumklorid' },
  { formula: 'Na2CO3', description: 'Natriumkarbonat' },
  { formula: 'K2CO3', description: 'Kaliumkarbonat' },
  { formula: 'BaCl2', description: 'Bariumsalt av klorid' },
  { formula: 'Na2SO4', description: 'Natriumsulfat' },
  { formula: 'K2SO4', description: 'Kaliumsulfat' },
  { formula: 'CuSO4', description: 'Kobbersulfat' },
  { formula: 'NaOH', description: 'Natriumhydroksid' },
  { formula: 'FeCl3', description: 'Jern(III)klorid' },
];

// Helper: safe log10
function log10(x) {
  return Math.log(x) / Math.log(10);
}

// Computes pH for titration (monoprotic). Supports strong/strong, weak/strong,
// strong/weak and weak/weak approximations. Va and Vb in litres. Ca, Cb in mol/L.
function computePH(acid, base, Ca, Va, Cb, Vb) {
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
    if (nB < nA) {
      const nHA = nA - nB;
      const nAminus = nB;
      return -log10(Ka) + Math.log10(nAminus / nHA);
    }
    if (Math.abs(nB - nA) < 1e-12) {
      const Kb = 1e-14 / Ka;
      const Csalt = nA / Vt;
      const OH = Math.sqrt(Kb * Csalt);
      return 14 + log10(OH);
    }
    return 14 + log10((nB - nA) / Vt);
  }
  // strong acid + weak base
  if (acid.Ka === Infinity && base.Kb !== Infinity) {
    const Kb = base.Kb;
    if (nA < nB) {
      const nBfree = nB - nA;
      const nBHplus = nA;
      const pOH = -log10(Kb) + Math.log10(nBHplus / nBfree);
      return 14 - pOH;
    }
    if (Math.abs(nA - nB) < 1e-12) {
      const Ka = 1e-14 / Kb;
      const Csalt = nB / Vt;
      const H = Math.sqrt(Ka * Csalt);
      return -log10(H);
    }
    return -log10((nA - nB) / Vt);
  }
  // weak/weak (approx)
  const pKa = -log10(acid.Ka);
  const pKb = -log10(base.Kb);
  if (Math.abs(nA - nB) < 1e-12) return 7 + 0.5 * (pKa - pKb);
  if (nB < nA) return -log10(acid.Ka) + Math.log10(nB / (nA - nB));
  return 14 - (-log10(base.Kb) + Math.log10(nA / (nB - nA)));
}

// Linear interpolate between two hex colours.
function interpolateColour(a, b, t) {
  const ah = parseInt(a.replace('#', ''), 16);
  const bh = parseInt(b.replace('#', ''), 16);
  const ar = (ah >> 16) & 0xff;
  const ag = (ah >> 8) & 0xff;
  const ab = ah & 0xff;
  const br = (bh >> 16) & 0xff;
  const bg = (bh >> 8) & 0xff;
  const bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const gg = Math.round(ag + (bg - ag) * t);
  const bb2 = Math.round(ab + (bb - ab) * t);
  return '#' + ((rr << 16) | (gg << 8) | bb2).toString(16).padStart(6, '0');
}

// Colour gradient for pH indicator in titration panel.
function pHColour(pH) {
  const t = Math.max(0, Math.min(1, pH / 14));
  if (t < 0.5) return interpolateColour('#2B7DFB', '#5AD49E', t / 0.5);
  return interpolateColour('#5AD49E', '#E83E8C', (t - 0.5) / 0.5);
}

// Helper: clamp value between lo and hi.
function clamp(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

// Determine precipitate outcome when mixing two salts. Returns an object:
// { product: string|null, ksp: number|null, colour: string|null, category: 'uløselig'|'tungtløselig'|'lettløselig' }
function getPrecipitateOutcome(salt1, salt2) {
  const key1 = `${salt1}+${salt2}`;
  const key2 = `${salt2}+${salt1}`;
  const prod = PRECIPITATION_REACTIONS[key1] || PRECIPITATION_REACTIONS[key2] || null;
  if (!prod) {
    return { product: null, ksp: null, colour: null, category: 'lettløselig' };
  }
  const info = PRECIPITATE_INFO[prod];
  let category;
  if (!info) {
    category = 'tungtløselig';
    return { product: prod, ksp: null, colour: null, category };
  }
  // Classify based on Ksp thresholds. These thresholds are arbitrary but
  // illustrate the concept: very low Ksp (<1e-10) = insoluble, 1e-10 to 1e-6 = slightly soluble.
  if (info.ksp < 1e-10) category = 'uløselig';
  else if (info.ksp < 1e-6) category = 'tungtløselig';
  else category = 'lettløselig';
  return { product: prod, ksp: info.ksp, colour: info.colour, category };
}

// -----------------------------------------------------------------------------
// Experiment definitions and tasks

/*
 * experimentTypes: list of high‑level experiment categories. Each entry has a
 * key and a human‑readable name. The electrochemistry category has
 * sub‑experiments handled by tasks themselves.
 */
const EXPERIMENT_TYPES = [
  { key: 'titration', name: 'Titrering' },
  { key: 'precipitation', name: 'Felling' },
  { key: 'electrochem', name: 'Elektrokjemi' },
  { key: 'calorimetry', name: 'Kalorimetri' },
];

/*
 * labTasks: list of all tasks. Each task includes:
 * - experiment: high‑level category key
 * - subExperiment: for electrochemistry tasks, the sub‑experiment key
 *   ('galvanic', 'electrolysis', 'molten')
 * - question: text shown to student
 * - type: 'numeric', 'mcq', or 'interactive' (for titration and precipitation, electrochem)
 * - choices: optional list of options for mcq tasks
 * - answer: expected numeric value or index for mcq; null for interactive tasks
 * - tolerance: acceptable deviation for numeric tasks
 * - params: parameters for the experiment panel and evaluation
 * - hint: hint text
 * - solution: explanation text
 */
const LAB_TASKS = [
  // Titration tasks (interactive)
  {
    experiment: 'titration',
    subExperiment: null,
    question: 'Titrer 25,0 mL av en 0,10 M HCl‑løsning med 0,10 M NaOH. Velg indikator og still inn utstyret.',
    type: 'interactive',
    params: { acid: 'HCl', base: 'NaOH', Ca: 0.10, Cb: 0.10, Va: 0.025, indicator: 'BromothymolBlue', expectedVolume: 0.025 },
    hint: 'Sterk syre ↔ sterk base gir pH ≈ 7 ved ekvivalens, så velg en indikator rundt nøytral pH.',
    solution: 'Ekvivalens ved V_b = (C_a·V_a)/C_b = 0,025 L. Bromtymolblått skifter ved pH ~7.'
  },
  {
    experiment: 'titration',
    subExperiment: null,
    question: 'Titrer 30,0 mL av en 0,10 M CH₃COOH‑løsning med 0,10 M NaOH. Velg indikator.',
    type: 'interactive',
    params: { acid: 'CH3COOH', base: 'NaOH', Ca: 0.10, Cb: 0.10, Va: 0.030, indicator: 'Phenolphthalein', expectedVolume: 0.030 },
    hint: 'Svak syre ↔ sterk base gir basisk pH ved ekvivalens.',
    solution: 'Ekvivalens ved V_b = 0,030 L. Fenolftalein (pH 8,2–10) passer.'
  },
  // Precipitation tasks (interactive)
  {
    experiment: 'precipitation',
    subExperiment: null,
    question: 'Velg to salter som danner et hvitt uløselig bunnfall når de blandes. Angi også om bunnfallet er uløselig, tungtløselig eller lettløselig.',
    type: 'interactive',
    params: { expectedSalt1: 'AgNO3', expectedSalt2: 'NaCl', expectedCategory: 'uløselig', expectedColour: 'hvitt' },
    hint: 'Tenk på sølvhalider og deres løselighet.',
    solution: 'Ag⁺ reagerer med Cl⁻ til AgCl (K_sp ≈ 10⁻¹⁰). AgCl er uløselig og hvitt.'
  },
  {
    experiment: 'precipitation',
    subExperiment: null,
    question: 'Bland to salter slik at du danner en blå felling av Cu(OH)₂. Velg riktig kombinasjon.',
    type: 'interactive',
    params: { expectedSalt1: 'CuSO4', expectedSalt2: 'NaOH', expectedCategory: 'uløselig', expectedColour: 'blått' },
    hint: 'Kobber(II) danner et blått hydroksid når det reagerer med hydroksidioner.',
    solution: 'Cu²⁺ + 2 OH⁻ → Cu(OH)₂ (K_sp ≈ 10⁻¹⁹). Kobbersulfat og natriumhydroksid gir et blått, uløselig bunnfall.'
  },
  {
    experiment: 'precipitation',
    subExperiment: null,
    question: 'Velg to salter som ikke danner bunnfall når de blandes (lettløselige ioner).',
    type: 'interactive',
    params: { expectedSalt1: 'NaCl', expectedSalt2: 'K2SO4', expectedCategory: 'lettløselig', expectedColour: null },
    hint: 'Salter fra alkalimetaller og sulfater er generelt lettløselige.',
    solution: 'Natrium- og kaliumsalter er generelt løselige. Blandingen gir ingen felling.'
  },
  // Electrochemistry tasks
  {
    experiment: 'electrochem',
    subExperiment: 'galvanic',
    question: 'Bygg en galvanisk celle som produserer omtrent 1,10 V. Velg riktige elektroder (anode og katode) og saltbro.',
    type: 'interactive',
    params: { correctAnode: 'Zn', correctCathode: 'Cu', correctSaltBridge: 'KNO3' },
    hint: 'En Zn/Cu-celle med KNO₃-saltbro gir E° ≈ 1,10 V.',
    solution: 'Anoden er Zn(s) → Zn²⁺ (oksidasjon). Katoden er Cu²⁺ → Cu(s) (reduksjon). Saltbro KNO₃ fullfører kretsen. Gir E°=1,10 V.'
  },
  {
    experiment: 'electrochem',
    subExperiment: 'electrolysis',
    question: 'Elektrolyser en 0,1 M CuSO₄-løsning. Velg riktige elektroder (anode/kathode) og angi om vann må være tilstede. Hvilket produkt avsettes på katoden?',
    type: 'interactive',
    params: { expectedCathode: 'Cu', expectedAnode: 'Graphite', requiresWater: true, expectedProduct: 'Cu' },
    hint: 'I elektrolyse av CuSO₄(aq) deponeres Cu på katoden. Bruk kobberkatode og inert anode.',
    solution: 'Kobber(II)sulfat i vann gir Cu²⁺ + SO₄²⁻. Ved katoden reduseres Cu²⁺ til Cu(s) (bruk kobber-elektrode). Anoden bør være inert (grafitt eller Pt). Vann må være tilstede.'
  },
  {
    experiment: 'electrochem',
    subExperiment: 'molten',
    question: 'Elektrolyser smeltet NaCl (smelte). Velg riktige elektroder og angi om vann brukes. Hvilke produkter dannes ved elektrodene?',
    type: 'interactive',
    params: { expectedCathode: 'Graphite', expectedAnode: 'Graphite', requiresWater: false, expectedProductCathode: 'Na', expectedProductAnode: 'Cl2' },
    hint: 'Smeltet NaCl gir Na(l) ved katoden og Cl₂(g) ved anoden. Ingen vann skal tilsettes.',
    solution: 'I smeltet NaCl: Na⁺ + e⁻ → Na(l) ved katoden; 2 Cl⁻ → Cl₂(g) + 2 e⁻ ved anoden. Elektrodene kan være grafitt. Vann må ikke være tilstede.'
  },
  // Calorimetry tasks
  {
    experiment: 'calorimetry',
    subExperiment: null,
    question: 'Et nøytralt kalorimeter består av to isoporkopper med vann, termometer og omrører. Velg riktig oppsett for å måle nøytraliseringsvarme ved blanding av HCl og NaOH.',
    type: 'interactive',
    params: { correctCalorimeter: 'Styrofoam', requiresThermometer: true, requiresStirrer: true, mass: 100, deltaT: 5.0, Cp: 4.18 },
    hint: 'Isoporkopper isolerer godt. Termometer og omrører er nødvendig.',
    solution: 'Et typisk enkelt kalorimeter: to isoporkopper for isolasjon, termometer for temperaturmåling og omrører for jevn temperatur. q = m·C·ΔT.'
  },
  {
    experiment: 'calorimetry',
    subExperiment: null,
    question: 'For en forbrenningsreaksjon i en bombekalorimeter, velg riktig apparat og beregn varmen fra ΔT = 3 °C, C_bomb = 10 kJ/°C.',
    type: 'interactive',
    params: { correctCalorimeter: 'Bomb', requiresThermometer: true, requiresStirrer: false, bombConstant: 10, deltaT: 3.0 },
    hint: 'Bombekalorimeter har kjent varme-kapasitet; q = C_bomb·ΔT.',
    solution: 'Bombekalorimeter krever termometer. Omrører er ikke alltid nødvendig. q = 10 kJ/°C × 3 °C = 30 kJ.'
  },
];

// -----------------------------------------------------------------------------
// Interactive panels for each experiment type

// Titration panel: reused from previous steps. Students can adjust acid/base,
// concentrations, volumes and indicator and titrate to equivalence. For step 6 we
// incorporate evaluation via evaluateTitrationTask.
function TitrationPanel({ params, evaluate }) {
  const { acid: acidInit, base: baseInit, Ca: CaInit, Cb: CbInit, Va: VaInit, indicator: indicatorInit, expectedVolume } = params;
  const [acidKey, setAcidKey] = useState(acidInit);
  const [baseKey, setBaseKey] = useState(baseInit);
  const [Ca, setCa] = useState(CaInit);
  const [Cb, setCb] = useState(CbInit);
  const [Va, setVa] = useState(VaInit);
  const [Vb, setVb] = useState(0);
  const [indicatorKey, setIndicatorKey] = useState(indicatorInit);

  const acid = ACIDS[acidKey];
  const base = BASES[baseKey];
  const indicator = INDICATORS[indicatorKey];

  const equivalence = useMemo(() => (Cb > 0 ? (Ca * Va) / Cb : Infinity), [Ca, Va, Cb]);
  const pH = useMemo(() => computePH(acid, base, Ca, Va, Cb, Vb), [acid, base, Ca, Va, Cb, Vb]);
  const solutionColour = useMemo(() => {
    const [start, end] = indicator.range;
    const [c1, c2] = indicator.colours;
    let t;
    if (pH <= start) t = 0;
    else if (pH >= end) t = 1;
    else t = (pH - start) / (end - start);
    return interpolateColour(c1, c2, Math.max(0, Math.min(1, t)));
  }, [indicator, pH]);
  const buretteLevel = useMemo(() => {
    const total = equivalence !== Infinity ? equivalence * 2 : (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
    return total > 0 ? clamp((total - Vb) / total, 0, 1) : 0;
  }, [equivalence, Ca, Va, Cb, Vb]);
  const flaskLevel = useMemo(() => {
    const maxV = equivalence !== Infinity ? Va + equivalence * 2 : Va + (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
    return maxV > 0 ? clamp((Va + Vb) / maxV, 0, 1) : 0;
  }, [Va, Vb, equivalence, Ca, Cb]);

  function addVolume(delta) {
    setVb(prev => {
      const maxV = equivalence !== Infinity ? equivalence * 2 : (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
      const next = prev + delta;
      return clamp(next, 0, maxV);
    });
  }

  function reset() { setVb(0); }

  // Evaluate the titration configuration when requested. Returns feedback
  // string and whether the answer is correct according to params.
  // Local feedback message for titration evaluation
  const [feedbackMsg, setFeedbackMsg] = useState('');
  function check() {
    let msgs = [];
    let correct = true;
    if (acidKey !== acidInit) { msgs.push('Feil syre'); correct = false; }
    if (baseKey !== baseInit) { msgs.push('Feil base'); correct = false; }
    if (Math.abs(Ca - CaInit) > 0.001) { msgs.push('Feil Ca'); correct = false; }
    if (Math.abs(Cb - CbInit) > 0.001) { msgs.push('Feil Cb'); correct = false; }
    if (Math.abs(Va - VaInit) > 1e-5) { msgs.push('Feil Va'); correct = false; }
    if (Math.abs(Vb - expectedVolume) > 0.0005) { msgs.push('Feil Vb ved ekvivalens'); correct = false; }
    if (indicatorKey !== indicatorInit) { msgs.push('Feil indikator'); correct = false; }
    if (correct) msgs.push('Alt korrekt!');
    setFeedbackMsg(msgs.join('. '));
    return { correct, feedback: msgs.join('. ') };
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: '0.8rem' }}>
        <h4>Titreringskontroller</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
          <label>Syre
            <select value={acidKey} onChange={e => setAcidKey(e.target.value)}>
              {Object.keys(ACIDS).map(k => <option key={k} value={k}>{ACIDS[k].name}</option>)}
            </select>
          </label>
          <label>Base
            <select value={baseKey} onChange={e => setBaseKey(e.target.value)}>
              {Object.keys(BASES).map(k => <option key={k} value={k}>{BASES[k].name}</option>)}
            </select>
          </label>
          <label>Ca (M)
            <input type="number" step="0.01" value={Ca} onChange={e => setCa(parseFloat(e.target.value) || 0)} />
          </label>
          <label>Cb (M)
            <input type="number" step="0.01" value={Cb} onChange={e => setCb(parseFloat(e.target.value) || 0)} />
          </label>
          <label>Va (L)
            <input type="number" step="0.001" value={Va} onChange={e => setVa(parseFloat(e.target.value) || 0)} />
          </label>
          <label>Vb (L)
            <input type="number" step="0.0005" value={Vb} onChange={e => setVb(parseFloat(e.target.value) || 0)} />
          </label>
          <label>Indikator
            <select value={indicatorKey} onChange={e => setIndicatorKey(e.target.value)}>
              {Object.keys(INDICATORS).map(k => <option key={k} value={k}>{INDICATORS[k].name}</option>)}
            </select>
          </label>
        </div>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem' }}>
          <button className="button-primary" onClick={() => addVolume(0.0005)}>+0,5 mL</button>
          <button className="button-primary" onClick={() => addVolume(0.001)}>+1,0 mL</button>
          <button className="button-secondary" onClick={reset}>Nullstill</button>
          <button className="button-primary" onClick={() => {
            const res = check();
            evaluate(res.correct);
          }}>Kontroller</button>
        </div>
        <p style={{ marginTop: '0.4rem' }}>pH: {pH.toFixed(2)} – Ekvivalens ved V_b = {equivalence === Infinity ? '-' : equivalence.toFixed(3)} L</p>
        {feedbackMsg && <p style={{ marginTop: '0.3rem', fontSize: '13px', color: feedbackMsg.startsWith('Alt') ? '#2a925a' : '#b04848' }}>{feedbackMsg}</p>}
      </div>
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '1rem' }}>
        <div>
          {/* Lab illustration similar to Step5 but with dynamic fill */}
          <svg width="240" height="300" viewBox="0 0 700 320">
            <defs>
              <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="60%" stopColor="#e5f0ff" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#dbeafe" stopOpacity="0.95" />
              </linearGradient>
              <radialGradient id="meniscusGrad" cx="50%" cy="0%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#94a3b8" stopOpacity="0.15" />
              </radialGradient>
            </defs>
            {/* Bench */}
            <rect x="0" y="300" width="700" height="20" fill="#cbd5e1" />
            {/* Burette stand */}
            <rect x="20" y="0" width="10" height="240" fill="#64748b" />
            <rect x="20" y="240" width="120" height="8" fill="#475569" rx="3" />
            {/* Burette tube */}
            <g transform="translate(50,10)">
              <rect x="0" y="0" width="20" height="200" fill="url(#glassGrad)" stroke="#94a3b8" strokeWidth="1" rx="6" />
              {/* Tick marks */}
              {Array.from({ length: 21 }).map((_, i) => {
                const y = i * 10;
                return <line key={i} x1="0" x2={i % 5 === 0 ? -8 : -5} y1={y} y2={y} stroke="#64748b" strokeWidth={i % 5 === 0 ? 2 : 1} />;
              })}
              {/* Liquid level */}
              <rect x="1" y="0" width="18" height={200 * buretteLevel} fill={solutionColour} opacity="0.65" />
              {/* Meniscus */}
              <ellipse cx="10" cy={200 * buretteLevel} rx="9" ry="3" fill="url(#meniscusGrad)" opacity="0.8" />
              {/* Stopcock */}
              <rect x="17" y="200" width="10" height="12" fill="#94a3b8" rx="2" />
              <rect x="25" y="210" width="35" height="6" fill="#94a3b8" rx="3" />
            </g>
            {/* Dripping droplet */}
            {Vb > 0 && (
              <g>
                <circle cx="120" cy="225" r="4" fill={solutionColour}>
                  <animate attributeName="cy" values="210;225;210" dur="1.8s" repeatCount="indefinite" />
                </circle>
              </g>
            )}
            {/* Erlenmeyer flask */}
            <g transform="translate(200,110)">
              <path d="M60,0 L100,0 L112,90 C116,120 -4,120 0,90 Z" fill="url(#glassGrad)" stroke="#94a3b8" strokeWidth="1" />
              <rect x="70" y="-38" width="20" height="40" fill="url(#glassGrad)" stroke="#94a3b8" strokeWidth="1" rx="5" />
              {(() => {
                const h = Math.max(1, 70 * flaskLevel);
                return (
                  <g>
                    <path d={`M10,90 C12,${90 - h} 100,${90 - h} 102,90 Z`} fill={solutionColour} opacity="0.45" />
                    <path d={`M12,${90 - h} Q56,${90 - h - 6} 98,${90 - h}`} stroke={solutionColour} strokeOpacity="0.6" strokeWidth="2" fill="none" />
                  </g>
                );
              })()}
              <path d="M10,90 C12,50 100,50 102,90 Z" fill={solutionColour} opacity="0.25" />
            </g>
          </svg>
        </div>
        {/* Graph */}
        <div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="200">
            {/* Axes */}
            <line x1="10" y1="5" x2="10" y2="90" stroke="#475569" strokeWidth="0.6" />
            <line x1="10" y1="90" x2="95" y2="90" stroke="#475569" strokeWidth="0.6" />
            {/* Y ticks */}
            {Array.from({ length: 8 }).map((_, i) => {
              const p = i * 2;
              const y = 90 - (p / 14) * 85;
              return (
                <g key={i}>
                  <line x1="9" x2="10" y1={y} y2={y} stroke="#475569" strokeWidth="0.6" />
                  <text x="6" y={y + 2.2} fontSize="3" textAnchor="end" fill="#334155">{p}</text>
                  <line x1="10" x2="95" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="0.3" />
                </g>
              );
            })}
            {/* X ticks */}
            {(() => {
              const maxX = equivalence === Infinity ? 1 : equivalence * 1.5;
              const xs = [0, maxX * 0.25, equivalence, maxX * 0.75, maxX];
              return xs.map((vx, i) => {
                const x = 10 + (vx / maxX) * 85;
                const label = i === 2 ? 'V_eq' : vx.toFixed(2);
                return (
                  <g key={i}>
                    <line x1={x} x2={x} y1="90" y2="91" stroke="#475569" strokeWidth="0.6" />
                    <text x={x} y="96" fontSize="3" textAnchor="middle" fill="#334155">{label}</text>
                  </g>
                );
              });
            })()}
            {/* Curve */}
            {(() => {
              const pts = [];
              const maxX = equivalence === Infinity ? 1 : equivalence * 1.5;
              const samples = 100;
              for (let i = 0; i <= samples; i++) {
                const vx = (maxX * i) / samples;
                const yv = computePH(acid, base, Ca, Va, Cb, vx);
                const x = 10 + (vx / maxX) * 85;
                const y = 90 - (Math.max(0, Math.min(14, yv)) / 14) * 85;
                pts.push({ x, y });
              }
              return pts.map((pt, idx) => {
                if (idx === 0) return null;
                const prev = pts[idx - 1];
                return <line key={idx} x1={prev.x} y1={prev.y} x2={pt.x} y2={pt.y} stroke="#1C2E8C" strokeWidth="0.7" />;
              });
            })()}
            {/* Current point */}
            {(() => {
              const maxX = equivalence === Infinity ? 1 : equivalence * 1.5;
              const x = 10 + (Vb / maxX) * 85;
              const y = 90 - (pH / 14) * 85;
              return <circle cx={x} cy={y} r="1.5" fill="#E83E8C" />;
            })()}
          </svg>
        </div>
      </div>
    </div>
  );
}

// Precipitation panel: allows selection of two salts and volumes; computes
// precipitate outcome and classification. When evaluate() is called, the
// chosen salts are compared with expected values in params.
function PrecipitationPanel({ params, evaluate }) {
  const { expectedSalt1, expectedSalt2, expectedCategory, expectedColour } = params;
  const [salt1, setSalt1] = useState(expectedSalt1);
  const [salt2, setSalt2] = useState(expectedSalt2);
  const [vol1, setVol1] = useState(0.05);
  const [vol2, setVol2] = useState(0.05);
  const outcome = useMemo(() => getPrecipitateOutcome(salt1, salt2), [salt1, salt2]);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  function check() {
    let correct = true;
    let msgs = [];
    const chosen = [salt1, salt2].sort().join('+');
    const expected = [expectedSalt1, expectedSalt2].sort().join('+');
    if (chosen !== expected) { correct = false; msgs.push('Feil kombinasjon av salter'); }
    if (expectedColour && outcome.colour !== expectedColour) { correct = false; msgs.push('Feil farge på bunnfall'); }
    if (expectedCategory && outcome.category !== expectedCategory) { correct = false; msgs.push(`Feil kategori: du valgte ${outcome.category}`); }
    if (correct) msgs.push('Riktig!');
    setFeedbackMsg(msgs.join('. '));
    evaluate(correct);
  }
  return (
    <div className="panel" style={{ marginTop: '0.8rem' }}>
      <h4>Fellepanel</h4>
      {/* Illustration of precipitation: two tubes pouring into a beaker */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>
        <svg width="220" height="90" viewBox="0 0 200 90">
          <defs>
            <linearGradient id="tube1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#cce6ff" />
              <stop offset="100%" stopColor="#add8e6" />
            </linearGradient>
            <linearGradient id="tube2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffd6e7" />
              <stop offset="100%" stopColor="#f4c2c2" />
            </linearGradient>
          </defs>
          {/* left test tube */}
          <path d="M20 5 v40 a10 10 0 0 0 20 0 v-40 z" fill="url(#tube1)" stroke="#94a3b8" strokeWidth="1" />
          {/* right test tube */}
          <path d="M160 5 v40 a10 10 0 0 1 -20 0 v-40 z" fill="url(#tube2)" stroke="#94a3b8" strokeWidth="1" />
          {/* streams */}
          <path d="M40 45 c0 15 20 15 30 30" stroke="#add8e6" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M160 45 c0 15 -20 15 -30 30" stroke="#f4c2c2" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* beaker */}
          <path d="M70 65 v15 h60 v-15" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
          {/* precipitate dots */}
          <circle cx="100" cy="72" r="3" fill="#94a3b8" />
          <circle cx="92" cy="78" r="2" fill="#94a3b8" />
          <circle cx="108" cy="78" r="2" fill="#94a3b8" />
        </svg>
      </div>
      <p>Velg to ioneløsninger (salter). Resultatet vises automatisk.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <label>Salt 1
          <select value={salt1} onChange={e => setSalt1(e.target.value)}>
            {SALT_OPTIONS.map(opt => <option key={opt.formula} value={opt.formula}>{opt.description}</option>)}
          </select>
        </label>
        <label>Salt 2
          <select value={salt2} onChange={e => setSalt2(e.target.value)}>
            {SALT_OPTIONS.map(opt => <option key={opt.formula} value={opt.formula}>{opt.description}</option>)}
          </select>
        </label>
        <label>Volum salt 1 (L)
          <input type="number" step="0.001" value={vol1} onChange={e => setVol1(parseFloat(e.target.value) || 0)} />
        </label>
        <label>Volum salt 2 (L)
          <input type="number" step="0.001" value={vol2} onChange={e => setVol2(parseFloat(e.target.value) || 0)} />
        </label>
      </div>
      <p>Bunnfall: {outcome.product ? outcome.product : 'ingen'}</p>
      <p>Kategori: {outcome.category}</p>
      {outcome.colour && <p>Farge: {outcome.colour}</p>}
      {feedbackMsg && <p style={{ marginTop: '0.3rem', fontSize: '13px', color: feedbackMsg.startsWith('Riktig') ? '#2a925a' : '#b04848' }}>{feedbackMsg}</p>}
      <button className="button-primary" onClick={check}>Kontroller</button>
    </div>
  );
}

// Electrochemistry panel: covers galvanic, electrolysis and molten experiments.
function ElectrochemPanel({ params, subExperiment, evaluate }) {
  // Shared state: chosen electrodes, salt bridge, solution type, water addition
  const metalOptions = ['Zn', 'Cu', 'Ag', 'Fe'];
  const electrodeOptions = ['Graphite', 'Copper', 'Platinum'];
  const saltBridgeOptions = ['KNO3', 'NaNO3', 'NH4NO3'];
  const electrolyteOptions = ['CuSO4(aq)', 'NaCl(aq)', 'NaCl(l)', 'H2O'];
  const [anode, setAnode] = useState(params.correctAnode || 'Zn');
  const [cathode, setCathode] = useState(params.correctCathode || 'Cu');
  const [saltBridge, setSaltBridge] = useState(params.correctSaltBridge || 'KNO3');
  const [electrolyte, setElectrolyte] = useState('CuSO4(aq)');
  const [useWater, setUseWater] = useState(params.requiresWater || false);
  const [voltage, setVoltage] = useState(3.0);

  const [feedbackMsg, setFeedbackMsg] = useState('');
  function check() {
    let correct = true;
    let msgs = [];
    if (subExperiment === 'galvanic') {
      if (anode !== params.correctAnode) { correct = false; msgs.push('Feil anode'); }
      if (cathode !== params.correctCathode) { correct = false; msgs.push('Feil katode'); }
      if (saltBridge !== params.correctSaltBridge) { correct = false; msgs.push('Feil saltbro'); }
    } else if (subExperiment === 'electrolysis') {
      if (cathode !== params.expectedCathode) { correct = false; msgs.push('Feil katode'); }
      if (anode !== params.expectedAnode) { correct = false; msgs.push('Feil anode'); }
      if (useWater !== params.requiresWater) { correct = false; msgs.push(params.requiresWater ? 'Vann må være tilstede' : 'Vann skal ikke brukes'); }
    } else if (subExperiment === 'molten') {
      if (cathode !== params.expectedCathode) { correct = false; msgs.push('Feil katode'); }
      if (anode !== params.expectedAnode) { correct = false; msgs.push('Feil anode'); }
      if (useWater !== params.requiresWater) { correct = false; msgs.push('Vann må ikke tilsettes i smelte'); }
    }
    if (correct) msgs.push('Riktig!');
    setFeedbackMsg(msgs.join('. '));
    evaluate(correct);
  }

  return (
    <div className="panel" style={{ marginTop: '0.8rem' }}>
      <h4>Elektrokjemi – {subExperiment === 'galvanic' ? 'Galvanisk celle' : subExperiment === 'electrolysis' ? 'Elektrolyse' : 'Smelte'}</h4>
      {/* Diagram showing apparatus for each electrochemistry type */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{renderDiagram()}</div>
      {/* Options vary by subExperiment */}
      {subExperiment === 'galvanic' && (
        <>
          <label>Anode (oksidasjon)
            <select value={anode} onChange={e => setAnode(e.target.value)}>
              {metalOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>Katode (reduksjon)
            <select value={cathode} onChange={e => setCathode(e.target.value)}>
              {metalOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>Saltbro
            <select value={saltBridge} onChange={e => setSaltBridge(e.target.value)}>
              {saltBridgeOptions.map(sb => <option key={sb} value={sb}>{sb}</option>)}
            </select>
          </label>
          <p>Beregn E° = E°(katode) − E°(anode) = {(E0[cathode] - E0[anode]).toFixed(2)} V</p>
        </>
      )}
      {subExperiment === 'electrolysis' && (
        <>
          <label>Anode
            <select value={anode} onChange={e => setAnode(e.target.value)}>
              {electrodeOptions.map(el => <option key={el} value={el}>{el}</option>)}
            </select>
          </label>
          <label>Katode
            <select value={cathode} onChange={e => setCathode(e.target.value)}>
              {electrodeOptions.map(el => <option key={el} value={el}>{el}</option>)}
            </select>
          </label>
          <label>Elektrolytt
            <select value={electrolyte} onChange={e => setElectrolyte(e.target.value)}>
              {electrolyteOptions.filter(opt => opt.endsWith('(aq)')).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <label>Tilsett vann?
            <input type="checkbox" checked={useWater} onChange={e => setUseWater(e.target.checked)} />
          </label>
          <label>Spenning (V)
            <input type="number" step="0.1" value={voltage} onChange={e => setVoltage(parseFloat(e.target.value) || 0)} />
          </label>
          <p>Forventet produkt på katoden: {params.expectedProduct}</p>
        </>
      )}
      {subExperiment === 'molten' && (
        <>
          <label>Anode
            <select value={anode} onChange={e => setAnode(e.target.value)}>
              {electrodeOptions.map(el => <option key={el} value={el}>{el}</option>)}
            </select>
          </label>
          <label>Katode
            <select value={cathode} onChange={e => setCathode(e.target.value)}>
              {electrodeOptions.map(el => <option key={el} value={el}>{el}</option>)}
            </select>
          </label>
          <label>Salt
            <select value={electrolyte} onChange={e => setElectrolyte(e.target.value)}>
              {electrolyteOptions.filter(opt => opt.endsWith('(l)')).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </label>
          <label>Tilsett vann?
            <input type="checkbox" checked={useWater} onChange={e => setUseWater(e.target.checked)} />
          </label>
          <label>Spenning (V)
            <input type="number" step="0.1" value={voltage} onChange={e => setVoltage(parseFloat(e.target.value) || 0)} />
          </label>
          <p>Forventede produkter: Katode → {params.expectedProductCathode}, Anode → {params.expectedProductAnode}</p>
        </>
      )}
      {feedbackMsg && <p style={{ marginTop: '0.4rem', fontSize: '13px', color: feedbackMsg.startsWith('Riktig') ? '#2a925a' : '#b04848' }}>{feedbackMsg}</p>}
      <button className="button-primary" onClick={check} style={{ marginTop: '0.5rem' }}>Kontroller</button>
    </div>
  );
}

// Calorimetry panel with apparatus selection.
function CalorimetryPanel({ params, evaluate }) {
  const { correctCalorimeter, requiresThermometer, requiresStirrer, mass, deltaT, Cp, bombConstant } = params;
  const calorimeterOptions = ['Styrofoam', 'Bomb'];
  const [calorimeter, setCalorimeter] = useState(correctCalorimeter);
  const [thermometer, setThermometer] = useState(requiresThermometer);
  const [stirrer, setStirrer] = useState(requiresStirrer || false);
  const [m, setM] = useState(mass || 100);
  const [dT, setDT] = useState(deltaT || 5);
  // Local feedback message for calorimetry evaluation
  const [feedbackMsg, setFeedbackMsg] = useState('');
  function check() {
    let correct = true;
    const msgs = [];
    if (calorimeter !== correctCalorimeter) { correct = false; msgs.push('Feil kalorimeter'); }
    if (thermometer !== requiresThermometer) { correct = false; msgs.push(requiresThermometer ? 'Termometer må være med' : 'Termometer skal ikke brukes'); }
    if ((requiresStirrer || false) !== stirrer) { correct = false; msgs.push(requiresStirrer ? 'Omrører må være med' : 'Omrører skal ikke brukes'); }
    if (correct) msgs.push('Riktig!');
    setFeedbackMsg(msgs.join('. '));
    evaluate(correct);
  }
  // compute heat
  const heat_kJ = useMemo(() => {
    if (calorimeter === 'Bomb' && bombConstant) {
      return bombConstant * dT;
    }
    return (m * Cp * dT) / 1000;
  }, [calorimeter, m, Cp, dT, bombConstant]);
  return (
    <div className="panel" style={{ marginTop: '0.8rem' }}>
      <h4>Kalorimetri</h4>
      {/* Simple illustration of a calorimeter: nested cups, lid, thermometer and stirrer */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>
        <svg width="180" height="80" viewBox="0 0 180 80">
          <defs>
            <linearGradient id="caloOuter" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8eefc" />
              <stop offset="100%" stopColor="#d1d9ec" />
            </linearGradient>
            <linearGradient id="caloInner" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#bcd7f6" />
              <stop offset="100%" stopColor="#8bb7e2" />
            </linearGradient>
          </defs>
          {/* outer cup */}
          <rect x="30" y="20" width="120" height="50" rx="8" fill="url(#caloOuter)" stroke="#94a3b8" />
          {/* inner cup */}
          <rect x="50" y="30" width="80" height="40" rx="6" fill="url(#caloInner)" stroke="#94a3b8" />
          {/* lid */}
          <rect x="40" y="15" width="100" height="8" rx="4" fill="#a3b8d8" />
          {/* thermometer */}
          <line x1="90" y1="10" x2="90" y2="40" stroke="#c75d5d" strokeWidth="2" />
          <circle cx="90" cy="10" r="5" fill="#c75d5d" />
          {/* stirrer */}
          <line x1="100" y1="10" x2="100" y2="35" stroke="#6b7280" strokeWidth="2" />
          <circle cx="100" cy="10" r="4" fill="#6b7280" />
        </svg>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <label>Kalorimeter
          <select value={calorimeter} onChange={e => setCalorimeter(e.target.value)}>
            {calorimeterOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </label>
        <label>Termometer?
          <input type="checkbox" checked={thermometer} onChange={e => setThermometer(e.target.checked)} />
        </label>
        <label>Omrører?
          <input type="checkbox" checked={stirrer} onChange={e => setStirrer(e.target.checked)} />
        </label>
        <label>Masse vann (g)
          <input type="number" step="1" value={m} onChange={e => setM(parseFloat(e.target.value) || 0)} />
        </label>
        <label>ΔT (°C)
          <input type="number" step="0.1" value={dT} onChange={e => setDT(parseFloat(e.target.value) || 0)} />
        </label>
      </div>
      <p>q = {heat_kJ.toFixed(2)} kJ</p>
      {feedbackMsg && <p style={{ marginTop: '0.4rem', fontSize: '13px', color: feedbackMsg.startsWith('Riktig') ? '#2a925a' : '#b04848' }}>{feedbackMsg}</p>}
      <button className="button-primary" onClick={check}>Kontroller</button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main component
export default function TitrationGame() {
  // View: 'home' | 'select' | 'exam' | 'results'
  const [view, setView] = useState('home');
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [taskIndex, setTaskIndex] = useState(0);
  const [examScore, setExamScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [userInput, setUserInput] = useState('');

  function startExamFor(exp) {
    // Filter tasks by experiment
    const filtered = LAB_TASKS.filter(t => t.experiment === exp);
    setSelectedExperiment(exp);
    setTasks(filtered);
    setTaskIndex(0);
    setExamScore(0);
    setShowHint(false);
    setShowSolution(false);
    setUserInput('');
    setView('exam');
  }
  function submitAnswer() {
    const task = tasks[taskIndex];
    let correct = false;
    if (task.type === 'numeric') {
      const val = parseFloat(userInput);
      if (!isNaN(val) && Math.abs(val - task.answer) <= (task.tolerance || 0.05)) correct = true;
    } else if (task.type === 'mcq') {
      if (parseInt(userInput, 10) === task.answer) correct = true;
    }
    if (correct) setExamScore(prev => prev + 1);
    if (taskIndex + 1 < tasks.length) {
      setTaskIndex(prev => prev + 1);
      setUserInput('');
      setShowHint(false);
      setShowSolution(false);
    } else {
      setView('results');
    }
  }
  function prevTask() {
    if (taskIndex > 0) {
      setTaskIndex(prev => prev - 1);
      setUserInput('');
      setShowHint(false);
      setShowSolution(false);
    }
  }
  function randomTask() {
    if (tasks.length === 0) return;
    const idx = Math.floor(Math.random() * tasks.length);
    setTaskIndex(idx);
    setUserInput('');
    setShowHint(false);
    setShowSolution(false);
  }
  function resetExam() {
    setView('select');
    setSelectedExperiment(null);
    setTasks([]);
    setTaskIndex(0);
    setExamScore(0);
    setShowHint(false);
    setShowSolution(false);
    setUserInput('');
  }

  const HomeView = () => (
    <div style={{ textAlign: 'center' }}>
      <h2>Velkommen til SiU Magisk KjemiLab</h2>
      <p>Øv på praktiske laboratorieoppgaver fra Kjemi 2. Velg en eksperimenttype for å starte.</p>
      <button className="button-primary" onClick={() => setView('select')} style={{ margin: '0.5rem', padding: '0.8rem 1.2rem' }}>Start eksamen</button>
      <button className="button-secondary" onClick={() => startExamFor('titration')} style={{ margin: '0.5rem', padding: '0.8rem 1.2rem' }}>Utforsk titrering</button>
    </div>
  );
  const SelectView = () => (
    <div>
      <h3>Velg eksperimenttype</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {EXPERIMENT_TYPES.map(et => (
          <div key={et.key} className="panel" style={{ flex: '1 1 45%', cursor: 'pointer' }} onClick={() => startExamFor(et.key)}>
            <h4>{et.name}</h4>
            {et.key === 'electrochem' && <p style={{ fontSize: '0.9rem' }}>Inneholder galvanisk celle, elektrolyse og smelte.</p>}
            {et.key === 'titration' && <p style={{ fontSize: '0.9rem' }}>Syre–base titrering med pH‑kurve og indikatorer.</p>}
            {et.key === 'precipitation' && <p style={{ fontSize: '0.9rem' }}>Bland salter og se om bunnfall dannes.</p>}
            {et.key === 'calorimetry' && <p style={{ fontSize: '0.9rem' }}>Mål varmeendringer i reaksjoner.</p>}
          </div>
        ))}
      </div>
      <button className="button-secondary" onClick={() => setView('home')} style={{ marginTop: '1rem' }}>Tilbake</button>
    </div>
  );
  const ExamView = () => {
    const task = tasks[taskIndex];
    // function to handle evaluation of interactive tasks
    function handleInteractive(correct) {
      if (correct) setExamScore(prev => prev + 1);
      if (taskIndex + 1 < tasks.length) {
        setTaskIndex(prev => prev + 1);
        setShowHint(false);
        setShowSolution(false);
        setUserInput('');
      } else {
        setView('results');
      }
    }
    return (
      <div>
        <h3 style={{ marginBottom: '0.5rem' }}>Oppgave {taskIndex + 1} av {tasks.length}</h3>
        <p style={{ whiteSpace: 'pre-wrap' }}>{task.question}</p>
        {task.type === 'numeric' && (
          <input type="number" value={userInput} onChange={e => setUserInput(e.target.value)} style={{ width: '100%', padding: '0.4rem', marginTop: '0.5rem' }} />
        )}
        {task.type === 'mcq' && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {task.choices.map((opt, idx) => (
              <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="radio" name="mcq" value={idx} checked={userInput === String(idx)} onChange={e => setUserInput(e.target.value)} /> {opt}
              </label>
            ))}
          </div>
        )}
        {task.type === 'interactive' && task.experiment !== 'titration' && (<p style={{ fontSize: '13px', marginTop: '0.5rem' }}>Utfør eksperimentet ved hjelp av panelet under og klikk «Kontroller» når du er ferdig.</p>)}
        {showHint && <p style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#7058a5' }}><strong>Hint:</strong> {task.hint}</p>}
        {showSolution && <p style={{ marginTop: '0.5rem', fontSize: '13px', whiteSpace: 'pre-wrap' }}><strong>Fasit:</strong> {task.solution}</p>}
        <div style={{ marginTop: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {task.type === 'numeric' || task.type === 'mcq' ? (
            <button className="button-primary" onClick={submitAnswer}>{taskIndex + 1 === tasks.length ? 'Fullfør' : 'Neste'}</button>
          ) : null}
          <button className="button-secondary" onClick={prevTask} disabled={taskIndex === 0}>Forrige</button>
          <button className="button-secondary" onClick={randomTask}>Tilfeldig</button>
          <button className="button-secondary" onClick={() => setShowHint(prev => !prev)}>{showHint ? 'Skjul hint' : 'Hint'}</button>
          <button className="button-secondary" onClick={() => setShowSolution(prev => !prev)}>{showSolution ? 'Skjul fasit' : 'Fasit'}</button>
          <button className="button-secondary" onClick={resetExam}>Til eksperimentvalg</button>
        </div>
        <p style={{ marginTop: '0.5rem' }}>Poeng: {examScore}</p>
        {/* Show interactive panels based on experiment and subExperiment */}
        {task.experiment === 'titration' && <TitrationPanel params={task.params} evaluate={handleInteractive} />}
        {task.experiment === 'precipitation' && <PrecipitationPanel params={task.params} evaluate={handleInteractive} />}
        {task.experiment === 'electrochem' && (
          <ElectrochemPanel params={task.params} subExperiment={task.subExperiment} evaluate={handleInteractive} />
        )}
        {task.experiment === 'calorimetry' && <CalorimetryPanel params={task.params} evaluate={handleInteractive} />}
      </div>
    );
  };
  const ResultsView = () => (
    <div style={{ textAlign: 'center' }}>
      <h3>Eksamen ferdig</h3>
      <p>Du fikk {examScore} av {tasks.length} riktige.</p>
      <button className="button-primary" onClick={() => startExamFor(selectedExperiment)} style={{ margin: '0.5rem' }}>Prøv samme eksperiment igjen</button>
      <button className="button-secondary" onClick={resetExam} style={{ margin: '0.5rem' }}>Velg nytt eksperiment</button>
      <button className="button-secondary" onClick={() => setView('home')} style={{ margin: '0.5rem' }}>Hjem</button>
    </div>
  );
  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 20%, #f7faff, #e6f0ff)', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '1100px', margin: '0 auto', background: 'rgba(255,255,255,0.90)', padding: '2rem', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '2rem', color: '#1c2e8c' }}>SiU Lab – Magisk KjemiLab (Steg 6)</h1>
        {view === 'home' && <HomeView />}
        {view === 'select' && <SelectView />}
        {view === 'exam' && <ExamView />}
        {view === 'results' && <ResultsView />}
      </div>
    </div>
  );
}
