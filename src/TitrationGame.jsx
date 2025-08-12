import React, { useState, useMemo, useEffect } from 'react';

/*
 * TitrationGame is a single–page React component that simulates a
 * volumetric titration between an acid and a base. The game
 * accommodates strong and weak acids and bases, offers multiple
 * difficulty levels and a playful, console–style aesthetic. A
 * realistic burette and Erlenmeyer flask are drawn with SVG and
 * animate as you add titrant. An indicator strip shows the active
 * colour range, while a simple graph traces pH as the titration
 * progresses.  This component contains no external dependencies
 * beyond React – everything else (animations, graphing, colours) is
 * built with vanilla JavaScript and CSS for maximum portability.
 */

// Monoprotic acid and base definitions.  Ka values are
// representative at 25 °C.  Colours are used for the indicator chip
// next to each reagent name and do not affect the reaction itself.
const ACIDS = {
  'HCl': { name: 'HCl', Ka: Infinity, colour: '#2E86DE' },            // strong acid
  'HNO3': { name: 'HNO₃', Ka: Infinity, colour: '#F26716' },          // strong acid
  'CH3COOH': { name: 'CH₃COOH', Ka: 1.8e-5, colour: '#58B19F' },      // acetic acid, weak
  'HCN': { name: 'HCN', Ka: 4.9e-10, colour: '#E55039' }              // hydrocyanic acid, weak
};

const BASES = {
  'NaOH': { name: 'NaOH', Kb: Infinity, colour: '#8E44AD' },          // strong base
  'KOH': { name: 'KOH', Kb: Infinity, colour: '#16A085' },            // strong base
  'NH3': { name: 'NH₃', Kb: 1.8e-5, colour: '#D35400' },              // ammonia, weak
  'CH3NH2': { name: 'CH₃NH₂', Kb: 4.4e-4, colour: '#2471A3' }         // methylamine, weak
};

// pKa/pKb helper functions
const log10 = (x) => Math.log(x) / Math.log(10);

// Indicator definitions: pH range and associated colours.  The
// simulator does not enforce a specific choice but offers hints based
// on the equivalence pH.
const INDICATORS = {
  'Phenolphthalein': { name: 'Phenolphthalein', range: [8.2, 10.0], colours: ['#FDFEFE', '#E84393'] },
  'Methyl Orange': { name: 'Methyl orange', range: [3.1, 4.4], colours: ['#A93226', '#F1C40F'] },
  'Bromothymol Blue': { name: 'Bromothymol blue', range: [6.0, 7.6], colours: ['#F4D03F', '#3498DB'] }
};

// Exam tasks covering major topics in Kjemi 2.  Each task contains a question, the type of
// answer expected (numeric or multiple‑choice), the correct answer with an optional
// tolerance for numeric values, a hint to assist struggling students, and a
// detailed explanation of the correct reasoning.  These tasks span acid–base
// equilibria, redoks, solubility, organic reaction types, catalysis,
// chromatography, biopolymers and green chemistry principles.
const examTasks = [
  {
    question: 'Beregn pH i en buffer laget av 0.1 M CH₃COOH og 0.1 M CH₃COONa. Ka for CH₃COOH = 1.8×10⁻⁵.',
    type: 'numeric',
    answer: 4.74,
    tolerance: 0.1,
    hint: 'Bruk Henderson–Hasselbalch‑ligningen: pH = pKa + log([base]/[acid]).',
    explanation: 'Siden [base] = [acid] gir brøken log(1) = 0. pKa = −log(1.8×10⁻⁵) ≈ 4.74, så pH ≈ 4.74.'
  },
  {
    question: 'Hvilken type organisk reaksjon beskriver hydrogenering av en dobbeltbinding i en alkene?',
    type: 'mcq',
    options: ['Substitusjon', 'Eliminasjon', 'Addisjon', 'Kondensasjon'],
    answer: 'Addisjon',
    hint: 'Ved hydrogenering brytes en dobbeltbinding og to atomer legges til.',
    explanation: 'Hydrogenering av en alken innebærer å addere H₂ over dobbeltbindingen; det er derfor en addisjonsreaksjon.'
  },
  {
    question: 'Hva er standard cellepotensial for Daniell‑elementet (Zn|Zn²⁺||Cu²⁺|Cu)?',
    type: 'numeric',
    answer: 1.10,
    tolerance: 0.05,
    hint: 'E°_cell = E°_katode − E°_anode. Se reduksjonspotensialene for Zn²⁺/Zn (−0.76 V) og Cu²⁺/Cu (+0.34 V).',
    explanation: 'Katoden er Cu²⁺/Cu (+0.34 V) og anoden er Zn²⁺/Zn (−0.76 V). E° = 0.34 V − (−0.76 V) = 1.10 V.'
  },
  {
    question: 'Hva gjør en katalysator i en reaksjon?',
    type: 'mcq',
    options: ['Øker aktiveringsenergien', 'Flytter likevekten', 'Øker reaksjonshastigheten uten å forbrukes', 'Øker entalpien'],
    answer: 'Øker reaksjonshastigheten uten å forbrukes',
    hint: 'En katalysator endrer reaksjonsmekanismen men forbrukes ikke.',
    explanation: 'Katalysatoren senker aktiveringsenergien og øker dermed reaksjonshastigheten uten å selv bli brukt opp.'
  },
  {
    question: 'Vil det dannes bunnfall når du blander like volumer av 0,05 M BaCl₂ og 0,05 M Na₂SO₄? (Kₛₚ for BaSO₄ = 1,1×10⁻¹⁰)',
    type: 'mcq',
    options: ['Ja', 'Nei'],
    answer: 'Ja',
    hint: 'Beregn [Ba²⁺] og [SO₄²⁻] etter blanding (fortynnes til halv konsentrasjon) og sammenlikn produktet med Kₛₚ.',
    explanation: 'Etter blanding er [Ba²⁺] = [SO₄²⁻] = 0,025 M. Ioneproduktet (0,025×0,025 = 6,25×10⁻⁴) er større enn Kₛₚ, så BaSO₄ felles ut.'
  },
  {
    question: 'Hvilken komponent i papirkromatografi vandrer lengst med løsemiddelfronten?',
    type: 'mcq',
    options: ['Den mest polare', 'Den som binder sterkest til papiret', 'Den som er mest løselig i den mobile fasen', 'Den tyngste molekylen'],
    answer: 'Den som er mest løselig i den mobile fasen',
    hint: 'I kromatografi separeres stoffer etter fordeling mellom stasjonær og mobil fase.',
    explanation: 'Komponenten med høyest løselighet i løsningsmidlet (mobil fase) og lav affinitet til papiret (stasjonær fase) vandrer lengst.'
  },
  {
    question: 'Hva er monomeren i polysakkaridet cellulose?',
    type: 'mcq',
    options: ['Glukose', 'Fruktose', 'Galaktose', 'Sukrose'],
    answer: 'Glukose',
    hint: 'Cellulose består av lange kjeder av et hexose-sukker bundet med β-1,4-glykosidbindinger.',
    explanation: 'Cellulose er bygget av β-D-glukoseenheter og er et eksempel på et polysakkarid av glukose.'
  },
  {
    question: 'Hvilket prinsipp for grønn kjemi vektlegger bruk av fornybare råvarer?',
    type: 'mcq',
    options: ['Forebygg avfall', 'Atomøkonomi', 'Fornybare råvarer', 'Design for nedbrytning'],
    answer: 'Fornybare råvarer',
    hint: 'Et av de 12 prinsippene oppfordrer til å bruke biologiske eller andre fornybare ressurser.',
    explanation: 'Prinsippet «Fornybare råstoffer» fremhever bruken av ikke-fossile, fornybare kilder i kjemisk produksjon.'
  }
  ,
  {
    question: 'Hva skjer med likevekten til en eksoterm reaksjon når temperaturen økes?',
    type: 'mcq',
    options: ['Forskyves mot produkter', 'Forskyves mot reaktanter', 'Den påvirkes ikke', 'Reaksjonen stopper'],
    answer: 'Forskyves mot reaktanter',
    hint: 'Le Chateliers prinsipp: varme er et produkt i eksoterme reaksjoner.',
    explanation: 'Når temperaturen økes i en eksoterm reaksjon, opptrer varme som et produkt. Økt temperatur favoriserer den motsatte, endotermiske retningen, slik at likevekten forskyves mot reaktanter.'
  },
  {
    question: 'Hvilket tegn har ΔG for en spontan prosess under standardbetingelser?',
    type: 'mcq',
    options: ['Positiv', 'Null', 'Negativ', 'Kan ikke bestemmes'],
    answer: 'Negativ',
    hint: 'Spontane prosesser frigjør fri energi.',
    explanation: 'For spontane prosesser er den Gibbs frie energiendringen (ΔG) negativ under standardbetingelser.'
  },
  {
    question: 'Hvor mye energi frigjøres når 2 mol butan (ΔH = −2877 kJ/mol) brenner fullstendig?',
    type: 'numeric',
    answer: 5754,
    tolerance: 10,
    hint: 'Multipliser reaksjonsentalpien med antall mol.',
    explanation: 'Forbrenning av butan frigjør −2877 kJ per mol. For 2 mol frigjøres 2 × 2877 kJ = 5754 kJ.'
  },
  {
    question: 'Hvilken av følgende er en oksidasjonsreaksjon?',
    type: 'mcq',
    options: ['Fe²⁺ → Fe³⁺ + e⁻', 'Cl₂ + 2 e⁻ → 2 Cl⁻', 'Cu²⁺ + 2 e⁻ → Cu', 'Ag⁺ + e⁻ → Ag'],
    answer: 'Fe²⁺ → Fe³⁺ + e⁻',
    hint: 'Oksidasjon innebærer tap av elektroner.',
    explanation: 'Fe²⁺ mister et elektron for å danne Fe³⁺. Det er en oksidasjon; de andre er reduksjoner.'
  },
  {
    question: 'Hvor mange gram NaCl trengs for å lage 250 mL av en 0,20 M løsning? (Molmasse NaCl = 58,44 g/mol)',
    type: 'numeric',
    answer: 2.93,
    tolerance: 0.1,
    hint: 'Bruk formelen m = c × V × M.',
    explanation: 'm = 0,20 mol/L × 0,250 L × 58,44 g/mol = 2,93 g.'
  },
  {
    question: 'Hvilken kromatografiteknikk er best egnet for varmefølsomme forbindelser?',
    type: 'mcq',
    options: ['Gasskromatografi', 'Tynnsjiktskromatografi (TLC)', 'HPLC', 'Papirkromatografi'],
    answer: 'HPLC',
    hint: 'HPLC kan utføres ved romtemperatur og med høy oppløsning.',
    explanation: 'HPLC (high‑performance liquid chromatography) bruker et trykksatt system og kan separere varmefølsomme stoffer uten oppvarming, til forskjell fra gasskromatografi.'
  },
  {
    question: 'Hva er den generelle formelen for alkaner?',
    type: 'mcq',
    options: ['CₙH₂ₙ', 'CₙH₂ₙ₊₂', 'CₙH₂ₙ₋₂', 'CₙHₙ'],
    answer: 'CₙH₂ₙ₊₂',
    hint: 'Metan, etan, propan følger dette mønsteret.',
    explanation: 'Alkaner er mettede hydrokarboner med formel CₙH₂ₙ₊₂.'
  },
  {
    question: 'Hvilken type polymerisering brukes for å fremstille nylon‑6,6?',
    type: 'mcq',
    options: ['Addisjonspolymerisering', 'Kondensasjonspolymerisering', 'Radikalpolymerisering', 'Koordinasjonspolymerisering'],
    answer: 'Kondensasjonspolymerisering',
    hint: 'Nylon‑6,6 dannes fra en diamin og en dikarboksylsyre med eliminasjon av små molekyler.',
    explanation: 'Nylon‑6,6 dannes via kondensasjonspolymerisering av heksametylendiamin og adipinsyre, der vann elimineres ved hver kobling.'
  },
];

// Compute the pH for a given titration state.  The function
// distinguishes four cases: strong acid/strong base, weak acid/strong
// base, strong acid/weak base, and weak acid/weak base.  Inputs are
// the acid/base objects (with Ka or Kb), concentrations Ca/Cb, and
// volumes Va/Vb in litres.  Ka = Infinity denotes a strong acid and
// Kb = Infinity denotes a strong base.
function computePH(acid, base, Ca, Cb, Va, Vb) {
  // Total moles of acid and base
  const nA = Ca * Va;
  const nB = Cb * Vb;
  const Vt = Va + Vb;
  // Avoid division by zero
  if (Vt <= 0) return 7;
  // Case 1: strong acid + strong base
  if (acid.Ka === Infinity && base.Kb === Infinity) {
    const diff = nA - nB;
    if (Math.abs(diff) < 1e-12) return 7;
    if (diff > 0) {
      const H = diff / Vt;
      return -log10(H);
    } else {
      const OH = (-diff) / Vt;
      return 14 + log10(OH);
    }
  }
  // Case 2: weak acid + strong base
  if (acid.Ka !== Infinity && base.Kb === Infinity) {
    const Ka = acid.Ka;
    if (nB < nA) {
      // Buffer region: Henderson–Hasselbalch
      const nHA = nA - nB; // remaining weak acid
      const nAminus = nB;  // conjugate base formed
      return (Math.log10(nAminus / nHA) + (-Math.log10(Ka)));
    } else if (Math.abs(nB - nA) < 1e-12) {
      // Equivalence: solution of conjugate base
      const Csalt = nA / Vt;
      const Kb = 1e-14 / Ka;
      const OH = Math.sqrt(Kb * Csalt);
      return 14 + log10(OH);
    } else {
      // After equivalence: excess strong base
      const OH = (nB - nA) / Vt;
      return 14 + log10(OH);
    }
  }
  // Case 3: strong acid + weak base
  if (acid.Ka === Infinity && base.Kb !== Infinity) {
    const Kb = base.Kb;
    if (nA < nB) {
      // Buffer: Henderson–Hasselbalch for base + conjugate acid
      const nBfree = nB - nA;
      const nBHplus = nA;
      return 14 - (Math.log10(nBfree / nBHplus) + (-Math.log10(Kb)));
    } else if (Math.abs(nA - nB) < 1e-12) {
      const Csalt = nB / Vt;
      const Ka = 1e-14 / Kb;
      const H = Math.sqrt(Ka * Csalt);
      return -log10(H);
    } else {
      // After equivalence: excess strong acid
      const H = (nA - nB) / Vt;
      return -log10(H);
    }
  }
  // Case 4: weak acid + weak base
  if (acid.Ka !== Infinity && base.Kb !== Infinity) {
    if (Math.abs(nA - nB) < 1e-12) {
      // At equivalence: pH depends on pKa and pKb
      const pKa = -log10(acid.Ka);
      const pKb = -log10(base.Kb);
      return 7 + 0.5 * (pKa - pKb);
    }
    if (nB < nA) {
      // Before equivalence: buffer dominated by acid and its conjugate base
      const nHA = nA - nB;
      const nAminus = nB;
      return (Math.log10(nAminus / nHA) + (-log10(acid.Ka)));
    } else {
      // After equivalence: buffer dominated by base and its conjugate acid
      const nBfree = nB - nA;
      const nBHplus = nA;
      return 14 - (Math.log10(nBfree / nBHplus) + (-log10(base.Kb)));
    }
  }
  return 7;
}

// Interpolate between two hex colours a and b by fraction t (0–1)
function interpolateColour(a, b, t) {
  const ah = parseInt(a.replace('#', ''), 16);
  const ar = (ah >> 16) & 0xff;
  const ag = (ah >> 8) & 0xff;
  const ab = ah & 0xff;
  const bh = parseInt(b.replace('#', ''), 16);
  const br = (bh >> 16) & 0xff;
  const bg = (bh >> 8) & 0xff;
  const bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const gg = Math.round(ag + (bg - ag) * t);
  const bb2 = Math.round(ab + (bb - ab) * t);
  return `#${((rr << 16) | (gg << 8) | bb2).toString(16).padStart(6, '0')}`;
}

// Convert pH (0–14) to an approximate colour along a blue–red spectrum.
function pHColour(pH) {
  const t = Math.min(1, Math.max(0, pH / 14));
  return interpolateColour('#2E86DE', '#E74C3C', t);
}

export default function TitrationGame() {
  // Reagent selections
  const [acidKey, setAcidKey] = useState('CH3COOH');
  const [baseKey, setBaseKey] = useState('NaOH');
  const acid = ACIDS[acidKey];
  const base = BASES[baseKey];
  // Concentrations in mol/L and volumes in litres
  const [Ca, setCa] = useState(0.1);
  const [Cb, setCb] = useState(0.1);
  const [Va, setVa] = useState(0.025);
  const [Vb, setVb] = useState(0);
  // Indicator and difficulty
  const [indicatorKey, setIndicatorKey] = useState('Phenolphthalein');
  const indicator = INDICATORS[indicatorKey];
  const [difficulty, setDifficulty] = useState('Fri lek');
  // Exam view state: current view (titration, exam, results)
  const [view, setView] = useState('titration');
  // Index of the current exam task
  const [taskIndex, setTaskIndex] = useState(0);
  // Array of exam tasks in the order presented.  This state allows shuffling
  // tasks at the start of each exam so students get a varied experience.
  const [tasks, setTasks] = useState(examTasks);
  // User's current answer (string to accommodate numeric and MCQ)
  const [userAnswer, setUserAnswer] = useState('');
  // Number of correct answers given
  const [examScore, setExamScore] = useState(0);
  // Flag to indicate exam has finished (used to determine results view)
  const [examFinished, setExamFinished] = useState(false);
  // Toggle display of hint for current question
  const [showHint, setShowHint] = useState(false);
  // Derived values
  const pH = useMemo(() => computePH(acid, base, Ca, Cb, Va, Vb), [acid, base, Ca, Cb, Va, Vb]);
  // Equivalence volume (in litres).  Infinity if denominator is zero or acid or base strong-case symmetrical.
  const equivalence = useMemo(() => {
    const nA = Ca * Va;
    if (Cb <= 0) return Infinity;
    return nA / Cb;
  }, [Ca, Va, Cb]);
  // Message for the user
  const [message, setMessage] = useState('Velkommen til SiU titreringsspill!');
  // When pH crosses regions, update message
  useEffect(() => {
    if (equivalence === Infinity) return;
    const diff = (Cb * Vb) - (Ca * Va);
    if (diff < 0) {
      setMessage('Før ekvivalens: løsningen er sur.');
    } else if (Math.abs(diff) < 1e-6) {
      setMessage('Ekvivalenspunkt! Nytraliseringsreaksjon er fullført.');
    } else {
      setMessage('Etter ekvivalens: løsningen er basisk.');
    }
  }, [equivalence, Ca, Va, Cb, Vb]);
  // Add titrant by delta volume (in mL) respecting an upper bound
  function addVolume(delta) {
    setVb(prev => {
      const next = prev + delta;
      if (equivalence !== Infinity) {
        const maxV = equivalence * 2;
        return next > maxV ? maxV : next;
      }
      return next;
    });
  }
  // Reset the titration
  function reset() {
    setVb(0);
    setMessage('Titrering tilbakestilt.');
  }
  // Suggest a good indicator based on equivalence pH
  const indicatorHint = useMemo(() => {
    if (equivalence === Infinity) return '';
    const pHeq = computePH(acid, base, Ca, Cb, Va, equivalence);
    for (const key of Object.keys(INDICATORS)) {
      const [start, end] = INDICATORS[key].range;
      if (pHeq >= start && pHeq <= end) return '';
    }
    // If no indicator matches exactly, suggest the nearest
    let closest;
    let minDist = Infinity;
    Object.keys(INDICATORS).forEach(k => {
      const [start, end] = INDICATORS[k].range;
      const dist = Math.min(Math.abs(pHeq - start), Math.abs(pHeq - end));
      if (dist < minDist) {
        minDist = dist;
        closest = INDICATORS[k].name;
      }
    });
    return `Tips: ${closest} kan være et bedre indikatorvalg.`;
  }, [equivalence, acid, base, Ca, Cb, Va]);
  // Generate graph points up to current Vb.  The resolution adjusts
  // with difficulty: higher difficulty → more points (smoother curve).
  const graphData = useMemo(() => {
    const points = [];
    const steps = difficulty === 'Avansert' ? 200 : difficulty === 'Middels' ? 100 : 60;
    const maxV = equivalence !== Infinity ? equivalence * 2 : (Vb > 0 ? Vb * 1.5 : 0.05);
    for (let i = 0; i <= steps; i++) {
      const v = (maxV * i) / steps;
      const y = computePH(acid, base, Ca, Cb, Va, v);
      points.push({ x: v, y });
    }
    return points;
  }, [equivalence, difficulty, acid, base, Ca, Cb, Va, Vb]);
  // Compute current indicator colour for the flask based on pH
  const indicatorColour = useMemo(() => {
    const [start, end] = indicator.range;
    if (pH <= start) return indicator.colours[0];
    if (pH >= end) return indicator.colours[1];
    const t = (pH - start) / (end - start);
    return interpolateColour(indicator.colours[0], indicator.colours[1], t);
  }, [indicator, pH]);
  // A lighter version of the indicator colour for gradients.  Blend with
  // white to create a soft highlight effect in the flask liquid.
  const lighterIndicatorColour = useMemo(() => {
    return interpolateColour(indicatorColour, '#FFFFFF', 0.6);
  }, [indicatorColour]);
  // Height of burette liquid (0–1) and flask level relative to initial volume
  const buretteLevel = useMemo(() => {
    const total = equivalence !== Infinity ? equivalence * 2 : (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
    if (total <= 0) return 0;
    const remaining = total - Vb;
    return Math.max(0, Math.min(1, remaining / total));
  }, [equivalence, Ca, Va, Cb, Vb]);
  const flaskLevel = useMemo(() => {
    const filled = Va + Vb;
    const max = equivalence !== Infinity ? Va + equivalence * 2 : Va + (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
    return Math.min(1, filled / max);
  }, [Va, Vb, equivalence, Ca, Cb]);
  // Difficulty options for selection
  const difficulties = ['Fri lek', 'Middels', 'Avansert'];

  // Begin an exam: reset all exam‑related state and navigate to exam view
  function startExam() {
    // Shuffle tasks for a fresh exam and reset state
    const shuffled = [...examTasks].sort(() => Math.random() - 0.5);
    setTasks(shuffled);
    setView('exam');
    setTaskIndex(0);
    setUserAnswer('');
    setExamScore(0);
    setExamFinished(false);
    setShowHint(false);
    setMessage('Eksamen pågår...');
  }

  // Submit the current answer and advance to next question or finish the exam
  function submitAnswer() {
    const task = tasks[taskIndex];
    let correct = false;
    if (task.type === 'numeric') {
      const value = parseFloat(userAnswer);
      if (!isNaN(value)) {
        correct = Math.abs(value - task.answer) <= task.tolerance;
      }
    } else {
      correct = userAnswer === task.answer;
    }
    if (correct) {
      setExamScore(prev => prev + 1);
    }
    if (taskIndex < tasks.length - 1) {
      setTaskIndex(prev => prev + 1);
      setUserAnswer('');
      setShowHint(false);
    } else {
      setExamFinished(true);
      setView('results');
    }
  }

  // Toggle the hint display for the current question
  function toggleHint() {
    setShowHint(prev => !prev);
  }

  // Return to the titration simulation from exam or results view
  function goToSimulation() {
    setView('titration');
    setShowHint(false);
    setUserAnswer('');
    setMessage('Velkommen tilbake til titrering!');
  }
  return (
    <div className="titration-game">
      {/* Dashboard header with navigation */}
      <header className="dashboard-header">
        <h1>SiU Lab – Kjemispill</h1>
        <div className="nav-buttons">
          <button onClick={goToSimulation} disabled={view === 'titration'}>Titrering</button>
          <button onClick={startExam} disabled={view === 'exam' || view === 'results'}>Eksamen</button>
        </div>
      </header>
      {/* Render titration simulator when not in exam/results mode */}
      {view === 'titration' && (
        <>
          {/* Controls panel */}
          <div className="controls">
            <div className="select-row">
              <label>
                Syre:
                <select value={acidKey} onChange={e => setAcidKey(e.target.value)}>
                  {Object.keys(ACIDS).map(key => (
                    <option key={key} value={key}>{ACIDS[key].name}</option>
                  ))}
                </select>
              </label>
              <label>
                Base:
                <select value={baseKey} onChange={e => setBaseKey(e.target.value)}>
                  {Object.keys(BASES).map(key => (
                    <option key={key} value={key}>{BASES[key].name}</option>
                  ))}
                </select>
              </label>
              <label>
                Indikator:
                <select value={indicatorKey} onChange={e => setIndicatorKey(e.target.value)}>
                  {Object.keys(INDICATORS).map(key => (
                    <option key={key} value={key}>{INDICATORS[key].name}</option>
                  ))}
                </select>
              </label>
              <label>
                Vanskelighetsgrad:
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                  {difficulties.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="input-row">
              <label>
                Ca (mol/L):
                <input type="number" step="0.01" value={Ca} onChange={e => setCa(Math.max(1e-4, parseFloat(e.target.value) || 0))} />
              </label>
              <label>
                Cb (mol/L):
                <input type="number" step="0.01" value={Cb} onChange={e => setCb(Math.max(1e-4, parseFloat(e.target.value) || 0))} />
              </label>
              <label>
                Va (L):
                <input type="number" step="0.005" value={Va} onChange={e => setVa(Math.max(0.001, parseFloat(e.target.value) || 0))} />
              </label>
              <label>
                Vb (L):
                <input type="number" step="0.001" value={Vb} onChange={e => setVb(Math.max(0, parseFloat(e.target.value) || 0))} />
              </label>
            </div>
            <div className="button-row">
              <button onClick={() => addVolume(0.0005)}>+0,5 mL</button>
              <button onClick={() => addVolume(0.0025)}>+2,5 mL</button>
              <button onClick={() => addVolume(0.01)}>+10 mL</button>
              <button onClick={reset}>Tilbakestill</button>
            </div>
          </div>
          {/* Laboratory illustration and graph */}
          <div className="lab-and-graph">
            <div className="lab-view">
              <svg viewBox="0 0 200 300" width="200" height="300">
                <defs>
                  <linearGradient id="liquidGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lighterIndicatorColour} />
                    <stop offset="100%" stopColor={indicatorColour} />
                  </linearGradient>
                </defs>
                <rect x="95" y="10" width="10" height="280" fill="#A29BFE" />
                <rect x="120" y="20" width="20" height="200" fill="none" stroke="#2C3E50" strokeWidth="2" rx="5" />
                <rect x="120" y={20 + (1 - buretteLevel) * 200} width="20" height={200 * buretteLevel} fill="#4AA8E5" />
                <rect x="132" y="220" width="6" height="20" fill="#5D6D7E" />
                {Vb > 0 && (
                  <circle cx="130" cy="250" r="4" fill={indicatorColour} style={{ animation: 'drip 1s infinite' }} />
                )}
                <path d="M50 200 L80 50 L120 50 L150 200 Z" fill="#F5F9FF" stroke="#2C3E50" strokeWidth="2" />
                <path d={`M60 ${200 - 100 * flaskLevel} L140 ${200 - 100 * flaskLevel} L130 200 L70 200 Z`} fill="url(#liquidGradient)" />
              </svg>
            </div>
            <div className="graph-view">
              <svg viewBox="0 0 300 200" width="300" height="200">
                <line x1="40" y1="10" x2="40" y2="190" stroke="#2C3E50" strokeWidth="2" />
                <line x1="40" y1="190" x2="290" y2="190" stroke="#2C3E50" strokeWidth="2" />
                <text x="5" y="15" fontSize="10">pH</text>
                <text x="270" y="210" fontSize="10">V_b (L)</text>
                <polyline
                  fill="none"
                  stroke="#E67E22"
                  strokeWidth="2"
                  points={graphData.map(pt => {
                    const x = 40 + (pt.x / (graphData[graphData.length - 1].x || 0.01)) * 250;
                    const y = 190 - (Math.min(14, Math.max(0, pt.y)) / 14) * 180;
                    return `${x},${y}`;
                  }).join(' ')}
                />
                {(() => {
                  const maxX = graphData[graphData.length - 1]?.x || 0.01;
                  const x = 40 + (Vb / (maxX || 0.01)) * 250;
                  const y = 190 - (Math.min(14, Math.max(0, pH)) / 14) * 180;
                  return <circle cx={x} cy={y} r="4" fill="#9B59B6" />;
                })()}
              </svg>
            </div>
          </div>
          {/* Information panel */}
          <div className="info-panel">
            <p><strong>pH:</strong> {pH.toFixed(2)}</p>
            <p><strong>Veq:</strong> {equivalence === Infinity ? '—' : (equivalence).toFixed(3)} L</p>
            {indicatorHint && <p className="hint">{indicatorHint}</p>}
            <p className="message">{message}</p>
          </div>
        </>
      )}
      {/* Exam view */}
      {view === 'exam' && (
        <div className="exam-panel">
          <h2>Eksamen</h2>
          <p><strong>Oppgave {taskIndex + 1} av {tasks.length}</strong></p>
          <p>{tasks[taskIndex].question}</p>
          {tasks[taskIndex].type === 'numeric' ? (
            <input type="number" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} />
          ) : (
            tasks[taskIndex].options.map(opt => (
              <label key={opt} style={{ display: 'block', margin: '4px 0' }}>
                <input type="radio" name="mcq" value={opt} checked={userAnswer === opt} onChange={e => setUserAnswer(e.target.value)} />
                {opt}
              </label>
            ))
          )}
          <div className="exam-buttons">
            <button onClick={toggleHint}>{showHint ? 'Skjul hint' : 'Vis hint'}</button>
            <button onClick={submitAnswer}>{taskIndex === examTasks.length - 1 ? 'Fullfør' : 'Neste'}</button>
          </div>
          {showHint && <p className="hint">{tasks[taskIndex].hint}</p>}
        </div>
      )}
      {/* Results view */}
      {view === 'results' && (
        <div className="results-panel">
          <h2>Resultater</h2>
          <p>Du svarte riktig på {examScore} av {tasks.length} oppgaver.</p>
          <ul>
            {tasks.map((task, i) => (
              <li key={i} style={{ marginBottom: '8px' }}>
                <strong>Oppgave {i + 1}:</strong> {task.question}<br />
                Riktig svar: {task.answer}. {task.explanation}
              </li>
            ))}
          </ul>
          <div className="exam-buttons">
            <button onClick={startExam}>Ta eksamen på nytt</button>
            <button onClick={goToSimulation}>Tilbake til titrering</button>
          </div>
        </div>
      )}
      {/* Embedded styles for layout and components */}
      <style>{`
        /* Overall container styles */
        .titration-game {
          font-family: 'Segoe UI', Tahoma, sans-serif;
          color: #34495E;
          background: linear-gradient(180deg, #F5F9FF 0%, #FFFFFF 100%);
          padding: 24px;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        /* Dashboard header */
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: linear-gradient(90deg, #6C5CE7 0%, #0984E3 100%);
          padding: 12px 16px;
          border-radius: 12px;
          color: #ffffff;
          margin-bottom: 20px;
        }
        .dashboard-header h1 {
          font-size: 20px;
          margin: 0;
        }
        .nav-buttons button {
          margin-left: 8px;
          background: #74B9FF;
          color: #FFFFFF;
          border: none;
          border-radius: 6px;
          padding: 6px 12px;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
          font-size: 13px;
        }
        .nav-buttons button:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .nav-buttons button:not(:disabled):hover {
          background: #0984E3;
        }
        .nav-buttons button:active {
          transform: scale(0.97);
        }
        /* Control panel layout */
        .controls {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 20px;
        }
        .select-row,
        .input-row,
        .button-row {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          justify-content: center;
        }
        label {
          display: flex;
          flex-direction: column;
          font-size: 13px;
          color: #2C3E50;
        }
        select,
        input {
          border: 1px solid #D0D7DE;
          border-radius: 6px;
          padding: 6px;
          min-width: 90px;
          background: #FFFFFF;
          color: #34495E;
          font-size: 13px;
        }
        button {
          background-color: #007ACC;
          color: #FFFFFF;
          border: none;
          border-radius: 6px;
          padding: 8px 14px;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
          font-size: 13px;
        }
        button:hover {
          background-color: #005F99;
        }
        button:active {
          transform: scale(0.97);
        }
        /* Lab and graph containers */
        .lab-and-graph {
          display: flex;
          flex-direction: row;
          gap: 20px;
          justify-content: center;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .lab-view,
        .graph-view {
          background: #FFFFFF;
          border: 1px solid #E5EAF1;
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }
        .info-panel {
          margin-top: 20px;
          text-align: center;
          font-size: 14px;
        }
        .hint {
          color: #8E44AD;
          font-size: 13px;
        }
        .message {
          margin-top: 10px;
          font-weight: bold;
          color: #16A085;
        }
        /* Exam and results panels */
        .exam-panel, .results-panel {
          background: #FFFFFF;
          border: 1px solid #E5EAF1;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          max-width: 640px;
          margin: 0 auto;
          font-size: 14px;
        }
        .exam-buttons {
          margin-top: 12px;
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .results-panel ul {
          list-style: none;
          padding-left: 0;
        }
        /* Drip animation for titrant drops */
        @keyframes drip {
          0%   { opacity: 0; transform: translateY(0); }
          50%  { opacity: 1; transform: translateY(12px); }
          100% { opacity: 0; transform: translateY(24px); }
        }
      `}</style>
    </div>
  );
}
