import React, { useState, useEffect, useMemo } from 'react';

// -----------------------------------------------------------------------------
// TitrationGameStep5
//
// This component implements Step 5 of the SiU Lab titration project.  It
// restructures the exam engine to focus on practical laboratory experiments
// required in the Norwegian Kjemi 2 course.  Each exam task is accompanied
// by an interactive laboratory panel that lets the student simulate the
// experiment and observe key variables such as concentrations, volumes,
// precipitation formation, cell potentials, mass deposition or heat change.
//
// The student begins by choosing which experiment type to practise (e.g.
// titration, precipitation, galvanic cells, electrolysis or calorimetry).
// The exam mode then presents only tasks relevant to that type.  Each task
// still provides hints and solutions, and uses numeric or multiple choice
// answers to evaluate the student’s understanding.  The interactive panels
// are for visualisation and calculation support; answers are entered in
// separate fields.

// -----------------------------------------------------------------------------
// Constants and helpers

// Acid/base/indicator definitions for the titration simulation (monoprotic).
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

const INDICATORS = {
  Phenolphthalein: {
    name: 'Fenolftalein',
    range: [8.2, 10.0],
    colours: ['#FFFFFF', '#E83E8C'],
    use: 'Svak syre mot sterk base; skifter i basisk område',
  },
  MethylOrange: {
    name: 'Metyloransje',
    range: [3.1, 4.4],
    colours: ['#E74C3C', '#F1C40F'],
    use: 'Sterk syre mot svak base; skifter i surt område',
  },
  BromothymolBlue: {
    name: 'Bromtymolblått',
    range: [6.0, 7.6],
    colours: ['#F4D03F', '#3498DB'],
    use: 'Sterk syre mot sterk base; skifter rundt pH 7',
  },
  MethylRed: {
    name: 'Metylrødt',
    range: [4.2, 6.3],
    colours: ['#FF6B6B', '#F9D56E'],
    use: 'Mellomsterke systemer',
  },
};

// Standard reduction potentials (V) versus SHE for selected couples.
const E0 = {
  'Cu2+/Cu': 0.34,
  'Zn2+/Zn': -0.76,
  'Ag+/Ag': 0.80,
  'Fe3+/Fe2+': 0.77,
};

// Solubility products (Ksp) for selected salts.
const KSP = {
  AgCl: 1.8e-10,
  BaSO4: 1.1e-10,
  CaCO3: 4.8e-9,
};

// Helper: log10 with safe domain.
function log10(x) {
  return Math.log(x) / Math.log(10);
}

// pH calculation helper for titrations (monoprotic).  Supports strong/strong,
// weak/strong, strong/weak and weak/weak (approx.). Va and Vb in litres.
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
  // weak/weak (approx.)
  const pKa = -log10(acid.Ka);
  const pKb = -log10(base.Kb);
  if (Math.abs(nA - nB) < 1e-12) return 7 + 0.5 * (pKa - pKb);
  if (nB < nA) return -log10(acid.Ka) + Math.log10(nB / (nA - nB));
  return 14 - (-log10(base.Kb) + Math.log10(nA / (nB - nA)));
}

// Linear interpolation between two hex colours.
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

// Colour of solution based on pH for titration curve (blue–green–pink).
function pHColour(pH) {
  const t = Math.max(0, Math.min(1, pH / 14));
  if (t < 0.5) {
    return interpolateColour('#2B7DFB', '#5AD49E', t / 0.5);
  }
  return interpolateColour('#5AD49E', '#E83E8C', (t - 0.5) / 0.5);
}

// -----------------------------------------------------------------------------
// Experiment definitions

// Define the list of experiment types available in exam mode.
const EXPERIMENT_TYPES = [
  { key: 'titration', name: 'Titrering', description: 'Syre–base titrering med burette, indikator og pH‑kurve.' },
  { key: 'precipitation', name: 'Felling', description: 'Løselighet og bunnfall ved blanding av ioneløsninger.' },
  { key: 'galvanic', name: 'Galvanisk celle', description: 'Bygg en galvanisk celle og mål spenning.' },
  { key: 'electrolysis', name: 'Elektrolyse', description: 'Beregn masse eller volum av produkter ved elektrolyse.' },
  { key: 'calorimetry', name: 'Kalorimetri', description: 'Bestem varmeutvikling i en reaksjon via temperaturendring.' },
];

// Tasks for Step 5.  Each task belongs to a single experiment type and
// contains everything needed for evaluation.  Interactive panels display
// additional details but are not used for grading.  Titration tasks reuse
// acid/base parameters from earlier steps.
const LAB_TASKS = [
  // Titration tasks (interactive; answer entered via simulation evaluation)
  {
    experiment: 'titration',
    question: 'Titrer 25,0 mL av en 0,10 M HCl‑løsning med 0,10 M NaOH til ekvivalens. Velg riktig indikator.',
    type: 'titration',
    acid: 'HCl',
    base: 'NaOH',
    Ca: 0.10,
    Cb: 0.10,
    Va: 0.025,
    expectedVolume: 0.025,
    indicator: 'BromothymolBlue',
    answer: null, // interactive; evaluation uses evaluateInteractiveTask
    hint: 'Sterk syre mot sterk base gir pH ≈ 7 ved ekvivalens. Velg indikator som skifter rundt nøytral pH.',
    solution: 'Ved ekvivalens: V_b = (C_a·V_a)/C_b = (0,10·0,025)/0,10 = 0,025 L. pH ved ekvivalens ≈ 7 → Bromtymolblått passer.',
  },
  {
    experiment: 'titration',
    question: 'Titrer 30,0 mL av en 0,10 M eddiksyre (CH₃COOH) med 0,10 M NaOH til ekvivalens. Velg riktig indikator.',
    type: 'titration',
    acid: 'CH3COOH',
    base: 'NaOH',
    Ca: 0.10,
    Cb: 0.10,
    Va: 0.030,
    expectedVolume: 0.030,
    indicator: 'Phenolphthalein',
    answer: null,
    hint: 'Svak syre titrert med sterk base gir pH > 7 ved ekvivalens. Velg en indikator med omslagsområde over 8.',
    solution: 'V_b = (0,10·0,030)/0,10 = 0,030 L. CH₃COOH er en svak syre, så pH ved ekvivalens er over 7. Fenolftalein (pH 8,2–10) er best.',
  },
  {
    experiment: 'titration',
    question: 'Titrer 20,0 mL av en 0,10 M HCl‑løsning med 0,10 M NH₃ til ekvivalens. Velg riktig indikator.',
    type: 'titration',
    acid: 'HCl',
    base: 'NH3',
    Ca: 0.10,
    Cb: 0.10,
    Va: 0.020,
    expectedVolume: 0.020,
    indicator: 'MethylOrange',
    answer: null,
    hint: 'Sterk syre mot svak base gir surt ekvivalenspunkt. Velg en indikator med omslagsområde i surt område.',
    solution: 'V_b = (0,10·0,020)/0,10 = 0,020 L. HCl er sterk syre, NH₃ er svak base; pH ved ekvivalens er under 7. Metyloransje (pH 3,1–4,4) passer.',
  },
  {
    experiment: 'titration',
    question: 'Titrer 40,0 mL av en 0,10 M maursyre (HCOOH) med 0,10 M NaOH til ekvivalens. Velg riktig indikator.',
    type: 'titration',
    acid: 'HCOOH',
    base: 'NaOH',
    Ca: 0.10,
    Cb: 0.10,
    Va: 0.040,
    expectedVolume: 0.040,
    indicator: 'Phenolphthalein',
    answer: null,
    hint: 'Svak syre mot sterk base gir pH > 7 ved ekvivalens. Velg en basisk indikator.',
    solution: 'V_b = (0,10·0,040)/0,10 = 0,040 L. Maursyre er svak syre; pH ved ekvivalens > 7, så fenolftalein er egnet.',
  },
  // Precipitation tasks (MCQ)
  {
    experiment: 'precipitation',
    question: 'Bestem om det dannes bunnfall når du blander 50,0 mL av 0,10 M AgNO₃ med 50,0 mL av 0,10 M NaCl. Bruk fellepanelet til å se Q og K_sp.',
    type: 'mcq',
    options: ['Ja', 'Nei'],
    answer: 0,
    params: { salt1: 'AgNO3', salt2: 'NaCl', c1: 0.10, c2: 0.10, v1: 0.050, v2: 0.050, ksp: KSP.AgCl, expectedPrecipitate: true },
    hint: 'Beregn Q = [Ag⁺][Cl⁻] etter fortynning og sammenlign med K_sp.',
    solution: '[Ag⁺] = [Cl⁻] = (0,10·0,050)/(0,100) = 0,05 M. Q = 0,05² = 2,5×10⁻³ >> 1,8×10⁻¹⁰, så bunnfall dannes.',
  },
  {
    experiment: 'precipitation',
    question: 'Vil BaSO₄ felles ut når 30,0 mL av 0,05 M BaCl₂ blandes med 70,0 mL av 0,05 M Na₂SO₄? Se på Q og K_sp.',
    type: 'mcq',
    options: ['Ja', 'Nei'],
    answer: 0,
    params: { salt1: 'BaCl2', salt2: 'Na2SO4', c1: 0.05, c2: 0.05, v1: 0.030, v2: 0.070, ksp: KSP.BaSO4, expectedPrecipitate: true },
    hint: 'Q = [Ba²⁺][SO₄²⁻]; hvis Q > K_sp oppstår bunnfall.',
    solution: '[Ba²⁺] = (0,05·0,030)/0,100 = 0,015 M; [SO₄²⁻] = (0,05·0,070)/0,100 = 0,035 M. Q = 5,25×10⁻⁴ >> 1,1×10⁻¹⁰ → bunnfall.',
  },
  {
    experiment: 'precipitation',
    question: 'Vil CaCO₃ felles ut når 25,0 mL av 0,10 M Ca(NO₃)₂ blandes med 50,0 mL av 0,10 M Na₂CO₃? Se Q vs K_sp.',
    type: 'mcq',
    options: ['Ja', 'Nei'],
    answer: 0,
    params: { salt1: 'Ca(NO3)2', salt2: 'Na2CO3', c1: 0.10, c2: 0.10, v1: 0.025, v2: 0.050, ksp: KSP.CaCO3, expectedPrecipitate: true },
    hint: 'Fortynn konsentrasjonene og sammenlign Q med K_sp for CaCO₃.',
    solution: '[Ca²⁺] = (0,10·0,025)/(0,075) = 0,0333 M; [CO₃²⁻] = (0,10·0,050)/(0,075) = 0,0667 M; Q = 0,00222 >> 4,8×10⁻⁹ → bunnfall.',
  },
  // Galvanic cell tasks (numeric)
  {
    experiment: 'galvanic',
    question: 'Bygg en galvanisk celle med Zn(s)/Zn²⁺(1,0 M) og Cu²⁺(1,0 M)/Cu(s). Hva er E° for cellen?',
    type: 'numeric',
    answer: 1.10,
    tolerance: 0.05,
    params: { anode: 'Zn2+/Zn', cathode: 'Cu2+/Cu' },
    hint: 'E°_celle = E°_katode − E°_anode. Zn→Zn²⁺ oksidasjon; Cu²⁺→Cu reduksjon.',
    solution: 'Katode: Cu²⁺/Cu (0,34 V), Anode: Zn²⁺/Zn (−0,76 V). E° = 0,34 − (−0,76) = 1,10 V.',
  },
  {
    experiment: 'galvanic',
    question: 'Bygg en galvanisk celle med Fe³⁺/Fe²⁺ og Ag⁺/Ag. Hva er E° for cellen?',
    type: 'numeric',
    answer: 0.03,
    tolerance: 0.05,
    params: { anode: 'Fe3+/Fe2+', cathode: 'Ag+/Ag' },
    hint: 'Velg reaksjonen med høyest E° som katode.',
    solution: 'E°(Fe³⁺/Fe²⁺)=0,77 V; E°(Ag⁺/Ag)=0,80 V. Katode: Ag⁺/Ag, Anode: Fe³⁺/Fe²⁺. E° = 0,80 − 0,77 = 0,03 V.',
  },
  // Electrolysis tasks (numeric)
  {
    experiment: 'electrolysis',
    question: 'Elektrolyser en CuSO₄-løsning med strøm 1,50 A i 2000 s. Hvor mange gram Cu avsettes?',
    type: 'numeric',
    answer: 0.99,
    tolerance: 0.05,
    params: { metal: 'Cu', current: 1.5, time: 2000, z: 2, M: 63.546 },
    hint: 'Faradays lov: m = (I·t)/(z·F) · M.',
    solution: 'm = (1,50·2000)/(2·96485)·63,546 ≈ 0,99 g.',
  },
  {
    experiment: 'electrolysis',
    question: 'Elektrolyser en AgNO₃-løsning med strøm 0,800 A i 1200 s. Hvor mange gram Ag avsettes?',
    type: 'numeric',
    answer: 1.07,
    tolerance: 0.05,
    params: { metal: 'Ag', current: 0.8, time: 1200, z: 1, M: 107.868 },
    hint: 'Bruk Faradays lov. Husk z for sølv.',
    solution: 'm = (0,800·1200)/(1·96485)·107,868 ≈ 1,07 g.',
  },
  // Calorimetry tasks (numeric)
  {
    experiment: 'calorimetry',
    question: 'I et kalorimeter blandes 100,0 g vann med 0,50 M HCl og 0,50 M NaOH (samme volum). Temperaturen stiger fra 20,0 °C til 26,0 °C. Hvor mye varme (kJ) er frigitt til vannet?',
    type: 'numeric',
    answer: 2.51,
    tolerance: 0.10,
    params: { mass: 100, deltaT: 6.0, Cp: 4.18 },
    hint: 'q = m·C_p·ΔT; konverter J til kJ.',
    solution: 'q = 100 g·4,18 J/g·K·6,0 K = 2508 J = 2,51 kJ.',
  },
  {
    experiment: 'calorimetry',
    question: '200,0 g vann varmes opp 5,0 °C i en kalorimeter. Hvor mye varme (kJ) er tilført?',
    type: 'numeric',
    answer: 4.18,
    tolerance: 0.10,
    params: { mass: 200, deltaT: 5.0, Cp: 4.18 },
    hint: 'q = m·C_p·ΔT; m = masse vann.',
    solution: 'q = 200 g·4,18 J/g·K·5,0 K = 4180 J = 4,18 kJ.',
  },
];

// -----------------------------------------------------------------------------
// Panels for each experiment type

// Precipitation panel: shows mixture of two salts, volumes, concentrations and
// calculates Q vs Ksp.  The student can adjust volumes, but grading is based
// on answering MCQ in the task.
function PrecipitationPanel({ task }) {
  const { salt1, salt2, c1, c2, v1, v2, ksp } = task.params;
  const [vol1, setVol1] = useState(v1);
  const [vol2, setVol2] = useState(v2);
  const total = vol1 + vol2;
  const conc1 = total > 0 ? (c1 * vol1) / total : 0;
  const conc2 = total > 0 ? (c2 * vol2) / total : 0;
  const Q = conc1 * conc2;
  const precip = Q > ksp;
  return (
    <div className="panel" style={{ marginTop: '1rem' }}>
      <h4>Felleforsøk</h4>
      <p>Bland {salt1} og {salt2}.</p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <label>Volum {salt1} (L)
          <input type="number" step="0.001" value={vol1} onChange={e => setVol1(parseFloat(e.target.value) || 0)} />
        </label>
        <label>Volum {salt2} (L)
          <input type="number" step="0.001" value={vol2} onChange={e => setVol2(parseFloat(e.target.value) || 0)} />
        </label>
      </div>
      <p>Q = {Q.toExponential(2)}; K<sub>sp</sub> = {ksp.toExponential(2)} → {precip ? 'Bunnfall dannes' : 'Ingen bunnfall'}</p>
    </div>
  );
}

// Galvanic cell panel: shows half-cells, allows student to choose anode and
// cathode (read-only for this exercise) and computes cell potential.
function GalvanicPanel({ task }) {
  const { anode, cathode } = task.params;
  const potential = E0[cathode] - E0[anode];
  return (
    <div className="panel" style={{ marginTop: '1rem' }}>
      <h4>Galvanisk celle</h4>
      <p>Katode: {cathode}, Anode: {anode}</p>
      <p>E°<sub>celle</sub> = E°({cathode}) − E°({anode}) = {potential.toFixed(2)} V</p>
    </div>
  );
}

// Electrolysis panel: shows current and time and computes mass deposited for a given metal.
function ElectrolysisPanel({ task }) {
  const { current, time, z, M, metal } = task.params;
  const [I, setI] = useState(current);
  const [t, setT] = useState(time);
  const F = 96485;
  const molesElectron = (I * t) / F;
  const molesMetal = molesElectron / z;
  const mass = molesMetal * M;
  return (
    <div className="panel" style={{ marginTop: '1rem' }}>
      <h4>Elektrolyse</h4>
      <p>Metall: {metal}</p>
      <label>Strøm (A)
        <input type="number" step="0.01" value={I} onChange={e => setI(parseFloat(e.target.value) || 0)} />
      </label>
      <label>Tid (s)
        <input type="number" step="1" value={t} onChange={e => setT(parseFloat(e.target.value) || 0)} />
      </label>
      <p>Masse {metal} = {mass.toFixed(3)} g</p>
    </div>
  );
}

// Calorimetry panel: shows mass, Cp and ΔT and computes heat change.
function CalorimetryPanel({ task }) {
  const { mass, deltaT, Cp } = task.params;
  const [m, setM] = useState(mass);
  const [dT, setDT] = useState(deltaT);
  const qJ = m * Cp * dT;
  const qkJ = qJ / 1000;
  return (
    <div className="panel" style={{ marginTop: '1rem' }}>
      <h4>Kalorimetri</h4>
      <label>Masse vann (g)
        <input type="number" step="1" value={m} onChange={e => setM(parseFloat(e.target.value) || 0)} />
      </label>
      <label>Temperaturendring (°C)
        <input type="number" step="0.1" value={dT} onChange={e => setDT(parseFloat(e.target.value) || 0)} />
      </label>
      <p>q = {qkJ.toFixed(2)} kJ</p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main component

export default function TitrationGame() {
  // Overall view state: 'home' | 'select' | 'exam' | 'results'
  const [view, setView] = useState('home');
  // Selected experiment type key
  const [selectedExperiment, setSelectedExperiment] = useState(null);
  // Exam tasks and progress
  const [tasks, setTasks] = useState([]);
  const [taskIndex, setTaskIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [examScore, setExamScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  // Score history to track attempts (unused yet but could be added)

  // Simulation state for titration
  const [acidKey, setAcidKey] = useState('HCl');
  const [baseKey, setBaseKey] = useState('NaOH');
  const [Ca, setCa] = useState(0.10);
  const [Cb, setCb] = useState(0.10);
  const [Va, setVa] = useState(0.025);
  const [Vb, setVb] = useState(0);
  const [indicatorKey, setIndicatorKey] = useState('BromothymolBlue');
  const acid = ACIDS[acidKey];
  const base = BASES[baseKey];
  const indicator = INDICATORS[indicatorKey];

  // Derived values for titration simulation
  const equivalence = useMemo(() => {
    return Cb > 0 ? (Ca * Va) / Cb : Infinity;
  }, [Ca, Va, Cb]);
  const pH = useMemo(() => {
    const value = computePH(acid, base, Ca, Va, Cb, Vb);
    return isNaN(value) ? 7 : value;
  }, [acid, base, Ca, Va, Cb, Vb]);
  const solutionColour = useMemo(() => {
    const [start, end] = indicator.range;
    const [c1, c2] = indicator.colours;
    let t;
    if (pH <= start) t = 0;
    else if (pH >= end) t = 1;
    else t = (pH - start) / (end - start);
    return interpolateColour(c1, c2, Math.max(0, Math.min(1, t)));
  }, [indicator, pH]);
  const clamp = (v, lo, hi) => {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  };
  const buretteLevel = useMemo(() => {
    const total = equivalence !== Infinity ? equivalence * 2 : (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
    if (!total || total <= 0) return 0;
    return clamp((total - Vb) / total, 0, 1);
  }, [equivalence, Ca, Va, Cb, Vb]);
  const flaskLevel = useMemo(() => {
    const maxV = equivalence !== Infinity ? Va + equivalence * 2 : Va + (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
    if (!maxV || maxV <= 0) return 0;
    return clamp((Va + Vb) / maxV, 0, 1);
  }, [Va, Vb, equivalence, Ca, Cb]);

  // Graph path for titration curve
  const graphPath = useMemo(() => {
    if (Cb <= 0) return '';
    const Vmax = equivalence * 1.5 || 0.05;
    const samples = 150;
    let d = '';
    for (let i = 0; i <= samples; i++) {
      const V = (Vmax * i) / samples;
      const phVal = computePH(acid, base, Ca, Va, Cb, V);
      const x = (300 * i) / samples;
      const y = 180 - (Math.max(0, Math.min(14, phVal)) / 14) * 180;
      if (i === 0) d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  }, [acid, base, Ca, Va, Cb, equivalence]);

  // Helper for titration evaluation: checks acid/base/indicator/volume against task
  function evaluateTitrationTask(task) {
    let feedback = [];
    let correct = true;
    if (acidKey !== task.acid) { correct = false; feedback.push('Feil syre.'); }
    if (baseKey !== task.base) { correct = false; feedback.push('Feil base.'); }
    if (indicatorKey !== task.indicator) { correct = false; feedback.push('Feil indikator.'); }
    if (Math.abs(Ca - task.Ca) > 0.001) { correct = false; feedback.push('Feil konsentrasjon på syre.'); }
    if (Math.abs(Cb - task.Cb) > 0.001) { correct = false; feedback.push('Feil konsentrasjon på base.'); }
    if (Math.abs(Va - task.Va) > 1e-5) { correct = false; feedback.push('Feil volum av syre.'); }
    if (Math.abs(Vb - task.expectedVolume) > 0.0005) { correct = false; feedback.push('Feil titrantvolum ved ekvivalens.'); }
    if (correct) feedback.push('Alt stemmer!');
    return { correct, feedback: feedback.join(' ') };
  }

  // Reset titration simulation
  function resetTitration() {
    setVb(0);
  }
  // Add titrant volume
  function addVolume(delta) {
    setVb(prev => {
      const maxV = equivalence !== Infinity ? equivalence * 2 : (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
      const next = prev + delta;
      return clamp(next, 0, maxV);
    });
  }

  // Start exam for selected experiment type
  function startExamFor(type) {
    const filtered = LAB_TASKS.filter(t => t.experiment === type);
    setSelectedExperiment(type);
    setTasks(filtered);
    setTaskIndex(0);
    setExamScore(0);
    setUserInput('');
    setShowHint(false);
    setShowSolution(false);
    setView('exam');
  }

  // Submit answer for current task
  function submitAnswer() {
    const task = tasks[taskIndex];
    let isCorrect = false;
    let feedback = '';
    if (task.type === 'titration') {
      const result = evaluateTitrationTask(task);
      isCorrect = result.correct;
      feedback = result.feedback;
    } else if (task.type === 'numeric') {
      const val = parseFloat(userInput);
      if (!isNaN(val) && Math.abs(val - task.answer) <= (task.tolerance || 0.05)) isCorrect = true;
    } else if (task.type === 'mcq') {
      if (parseInt(userInput, 10) === task.answer) isCorrect = true;
    }
    if (isCorrect) setExamScore(prev => prev + 1);
    // Advance or finish
    if (taskIndex + 1 < tasks.length) {
      setTaskIndex(prev => prev + 1);
      setUserInput('');
      setShowHint(false);
      setShowSolution(false);
    } else {
      setView('results');
    }
  }

  // Navigation: previous task
  function prevTask() {
    if (taskIndex > 0) {
      setTaskIndex(prev => prev - 1);
      setUserInput('');
      setShowHint(false);
      setShowSolution(false);
    }
  }
  // Random task
  function randomTask() {
    const idx = Math.floor(Math.random() * tasks.length);
    setTaskIndex(idx);
    setUserInput('');
    setShowHint(false);
    setShowSolution(false);
  }

  // Reset entire exam selection
  function resetExam() {
    setSelectedExperiment(null);
    setTasks([]);
    setTaskIndex(0);
    setExamScore(0);
    setUserInput('');
    setView('select');
  }

  // Views
  const HomeView = () => (
    <div style={{ textAlign: 'center' }}>
      <h2>Velkommen til SiU Magisk KjemiLab</h2>
      <p>Øv på praktiske laboratorieoppgaver fra Kjemi 2. Velg en eksperimenttype for å starte en eksamen.</p>
      <button className="button-primary" onClick={() => setView('select')} style={{ padding: '0.8rem 1.2rem', fontSize: '1rem', marginTop: '1rem' }}>Start eksamen</button>
      <button className="button-secondary" onClick={() => setView('titration')} style={{ padding: '0.8rem 1.2rem', fontSize: '1rem', marginTop: '1rem', marginLeft: '1rem' }}>Utforsk titrering</button>
    </div>
  );

  const SelectExperimentView = () => (
    <div>
      <h3>Velg eksperimenttype</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {EXPERIMENT_TYPES.map(({ key, name, description }) => (
          <div key={key} className="panel" style={{ flex: '1 1 45%', cursor: 'pointer' }} onClick={() => startExamFor(key)}>
            <h4>{name}</h4>
            <p style={{ fontSize: '0.9rem' }}>{description}</p>
          </div>
        ))}
      </div>
      <button className="button-secondary" onClick={() => setView('home')} style={{ marginTop: '1rem' }}>Tilbake</button>
    </div>
  );

  // Panel for titration simulation (similar to Step4 but simplified).  We reuse the
  // same controls and lab illustration as the titration view from earlier steps.
  const TitrationPanel = () => (
    <div>
      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h4>Kontroller</h4>
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
            <input type="number" step="0.001" value={Vb} onChange={e => setVb(parseFloat(e.target.value) || 0)} />
          </label>
          <label>Indikator
            <select value={indicatorKey} onChange={e => setIndicatorKey(e.target.value)}>
              {Object.keys(INDICATORS).map(k => <option key={k} value={k}>{INDICATORS[k].name}</option>)}
            </select>
          </label>
        </div>
        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
          <button className="button-primary" onClick={() => addVolume(0.0005)}>+0,5 mL</button>
          <button className="button-primary" onClick={() => addVolume(0.001)}>+1,0 mL</button>
          <button className="button-secondary" onClick={resetTitration}>Nullstill</button>
        </div>
        <p style={{ marginTop: '0.5rem' }}>pH: {pH.toFixed(2)} – Ekvivalens ved V_b = {equivalence === Infinity ? '-' : equivalence.toFixed(3)} L</p>
      </div>
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '1rem' }}>
        {/* Lab illustration */}
        <div>
          <svg width="260" height="320" viewBox="0 0 700 320">
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
            {/* Burette tube and contents */}
            <g transform="translate(50,10)">
              <rect x="0" y="0" width="20" height="200" fill="url(#glassGrad)" stroke="#94a3b8" strokeWidth="1" rx="6" />
              {Array.from({ length: 21 }).map((_, i) => {
                const y = i * 10;
                return (
                  <line
                    key={i}
                    x1="0"
                    x2={i % 5 === 0 ? -8 : -5}
                    y1={y}
                    y2={y}
                    stroke="#64748b"
                    strokeWidth={i % 5 === 0 ? 2 : 1}
                  />
                );
              })}
              <rect x="1" y="0" width="18" height={200 * buretteLevel} fill={solutionColour} opacity="0.65" />
              <ellipse
                cx="10"
                cy={200 * buretteLevel}
                rx="9"
                ry="3"
                fill="url(#meniscusGrad)"
                opacity="0.8"
              />
              <rect x="17" y="200" width="10" height="12" fill="#94a3b8" rx="2" />
              <rect x="25" y="210" width="35" height="6" fill="#94a3b8" rx="3" />
            </g>
            {Vb > 0 && (
              <g>
                <circle cx="120" cy="225" r="4" fill={solutionColour}>
                  <animate attributeName="cy" values="210; 225; 210" dur="1.8s" repeatCount="indefinite" />
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
                    <path
                      d={'M10,90 C12,' + (90 - h) + ' 100,' + (90 - h) + ' 102,90 Z'}
                      fill={solutionColour}
                      opacity="0.45"
                    />
                    <path
                      d={'M12,' + (90 - h) + ' Q56,' + (90 - h - 6) + ' 98,' + (90 - h)}
                      stroke={solutionColour}
                      strokeOpacity="0.6"
                      strokeWidth="2"
                      fill="none"
                    />
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

  // Exam view: shows current task, answer input, hint, solution and corresponding panel
  const ExamView = () => {
    const task = tasks[taskIndex];
    return (
      <div>
        <h3 style={{ marginBottom: '0.5rem' }}>Oppgave {taskIndex + 1} av {tasks.length}</h3>
        <p style={{ whiteSpace: 'pre-wrap' }}>{task.question}</p>
        {/* Answer input */}
        {task.type === 'numeric' && (
          <input type="number" value={userInput} onChange={e => setUserInput(e.target.value)} style={{ width: '100%', padding: '0.4rem', marginTop: '0.5rem' }} />
        )}
        {task.type === 'mcq' && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {task.options.map((opt, idx) => (
              <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input type="radio" name="mcq" value={idx} checked={userInput === String(idx)} onChange={e => setUserInput(e.target.value)} /> {opt}
              </label>
            ))}
          </div>
        )}
        {task.type === 'titration' && (
          <div style={{ fontSize: '13px', marginTop: '0.5rem' }}>
            <p>Still inn syre, base, konsentrasjoner, syrevolum, indikator og titrer til ekvivalens. Trykk deretter «Kontroller» for å sjekke.</p>
          </div>
        )}
        {/* Hint and solution toggles */}
        {showHint && <p style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#7058a5' }}><strong>Hint:</strong> {task.hint}</p>}
        {showSolution && <p style={{ marginTop: '0.5rem', fontSize: '13px', whiteSpace: 'pre-wrap' }}><strong>Fasit:</strong> {task.solution}</p>}
        {/* Navigation buttons */}
        <div style={{ marginTop: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {task.type === 'titration' && <button className="button-primary" onClick={() => {
            const result = evaluateTitrationTask(task);
            alert(result.feedback);
          }}>Kontroller</button>}
          <button className="button-primary" onClick={submitAnswer}>{taskIndex + 1 === tasks.length ? 'Fullfør' : 'Neste'}</button>
          <button className="button-secondary" onClick={prevTask} disabled={taskIndex === 0}>Forrige</button>
          <button className="button-secondary" onClick={randomTask}>Tilfeldig</button>
          <button className="button-secondary" onClick={() => setShowHint(prev => !prev)}>{showHint ? 'Skjul hint' : 'Vis hint'}</button>
          <button className="button-secondary" onClick={() => setShowSolution(prev => !prev)}>{showSolution ? 'Skjul fasit' : 'Fasit'}</button>
          <button className="button-secondary" onClick={resetExam}>Tilbake</button>
        </div>
        <p style={{ marginTop: '0.5rem' }}>Poeng: {examScore}</p>
        {/* Interactive panel for the current task */}
        {task.experiment === 'titration' && <TitrationPanel />}
        {task.experiment === 'precipitation' && <PrecipitationPanel task={task} />}
        {task.experiment === 'galvanic' && <GalvanicPanel task={task} />}
        {task.experiment === 'electrolysis' && <ElectrolysisPanel task={task} />}
        {task.experiment === 'calorimetry' && <CalorimetryPanel task={task} />}
      </div>
    );
  };

  // Results view: shows score and offers restart
  const ResultsView = () => (
    <div style={{ textAlign: 'center' }}>
      <h3>Eksamen ferdig</h3>
      <p>Du fikk {examScore} av {tasks.length} riktige.</p>
      <button className="button-primary" onClick={() => startExamFor(selectedExperiment)}>Prøv samme eksperiment igjen</button>
      <button className="button-secondary" onClick={resetExam} style={{ marginLeft: '0.5rem' }}>Velg nytt eksperiment</button>
      <button className="button-secondary" onClick={() => setView('home')} style={{ marginLeft: '0.5rem' }}>Hjem</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 50% 20%, #f7faff, #e6f0ff)', padding: '2rem' }}>
      <div className="container" style={{ maxWidth: '1100px', margin: '0 auto', background: 'rgba(255,255,255,0.88)', padding: '2rem', borderRadius: '14px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '2rem', color: '#1c2e8c' }}>SiU Lab – Magisk KjemiLab (Steg 5)</h1>
        {view === 'home' && <HomeView />}
        {view === 'select' && <SelectExperimentView />}
        {view === 'exam' && <ExamView />}
        {view === 'results' && <ResultsView />}
      </div>
    </div>
  );
}
