import React, { useState, useEffect, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Exam task definitions for Kjemi 2.
//
// Each task covers a different competency from the Kjemi 2 curriculum.
// These tasks are varied to test buffer calculations, reaction types,
// electrochemistry and catalysis.  Each entry provides a question, the
// correct answer, an optional tolerance for numeric questions, multiple‑choice
// options, a hint, and an explanation displayed after the exam.
const examTasks = [
  {
    question:
      'Beregn pH til en buffer som inneholder 0,10 M eddiksyre (CH₃COOH) og 0,10 M natriumacetat. (pKa(eddiksyre) ≈ 4,76)',
    type: 'numeric',
    answer: 4.76,
    tolerance: 0.1,
    hint:
      'Bruk Henderson–Hasselbalch-formelen: pH = pKa + log([A⁻]/[HA]). Når konsentrasjonene er like, er log-delen 0.',
    explanation:
      'Eddiksyre har pKa ≈ 4,76. Bufferen har [A⁻] = [HA], så pH ≈ pKa = 4,76.',
  },
  {
    question:
      'Hvilken reaksjonstype beskriver følgende prosess: CH₂=CH₂ + H₂ → CH₃–CH₃?',
    type: 'mcq',
    options: ['Addisjon', 'Eliminering', 'Substitusjon', 'Kondensasjon'],
    answer: 0,
    hint:
      'Reaktantene går fra to molekyler til ett produkt uten å miste noen atomer.',
    explanation:
      'Hydrogen legger seg på etene slik at bindingen brytes og etan dannes. Dette er en addisjonsreaksjon.',
  },
  {
    question:
      'Hva er den omtrentlige standard cellespenningen for galvanisk cellen Zn/Zn²⁺(aq) || Cu²⁺(aq)/Cu?',
    type: 'mcq',
    options: ['1,10 V', '0,76 V', '0,34 V', '0,42 V'],
    answer: 0,
    hint:
      'Cellepotensialet E° = E°(katode) – E°(anode). Zn²⁺/Zn har E° ≈ –0,76 V og Cu²⁺/Cu har E° ≈ +0,34 V.',
    explanation:
      'E°cell ≈ 0,34 V – (–0,76 V) = 1,10 V.',
  },
  {
    question:
      'Hva er riktig beskrivelse av en katalysators rolle i en kjemisk reaksjon?',
    type: 'mcq',
    options: [
      'Den øker aktiveringsenergien',
      'Den senker aktiveringsenergien og forbrukes',
      'Den senker aktiveringsenergien og forbrukes ikke',
      'Den endrer likevektskonstanten',
    ],
    answer: 2,
    hint:
      'Katalysatorer påvirker reaksjonshastighet ved å åpne en ny reaksjonsvei.',
    explanation:
      'Katalysatorer senker aktiveringsenergien uten å bli brukt opp, og påvirker ikke likevektskonstanten.',
  },
];

/*
 * TitrationGame.jsx
 *
 * This component implements a full-featured acid–base titration simulator
 * tailored for SiU Lab. It supports weak/strong acids and bases, shows a
 * realtime pH vs volume curve, animates lab glassware, and provides
 * difficulty modes so that both novices and advanced students are
 * challenged.  The design draws inspiration from Kurzgesagt and
 * siuskole.no while remaining original and playful.  No external assets
 * are required; the visuals are rendered via SVG and CSS.
 */

// Define the available acids.  Each acid has a name, a label for the UI,
// its type (strong or weak), and, for weak acids, a pKa value.  The
// logarithmic pKa values are used to compute equilibrium pH in buffer
// regions and at the equivalence point.  Strong acids omit pKa because
// they fully dissociate.
const acids = [
  { name: 'HCl', label: 'HCl (sterk syre)', type: 'strong' },
  { name: 'HNO3', label: 'HNO₃ (sterk syre)', type: 'strong' },
  { name: 'CH3COOH', label: 'CH₃COOH (svak syre)', type: 'weak', pKa: 4.76 },
  { name: 'HCN', label: 'HCN (svak syre)', type: 'weak', pKa: 9.21 },
];

// Define the available bases.  Each base has a similar structure.  For
// weak bases, pKb is provided to compute pH at equivalence and after
// neutralisation.  Strong bases omit pKb because they fully dissociate.
const bases = [
  { name: 'NaOH', label: 'NaOH (sterk base)', type: 'strong' },
  { name: 'KOH', label: 'KOH (sterk base)', type: 'strong' },
  { name: 'NH3', label: 'NH₃ (svak base)', type: 'weak', pKb: 4.76 },
];

// Define indicator options with their colour change ranges and start/end
// colours.  Colours are specified in hex triplets; interpolation is
// performed in RGB space.
const indicators = [
  {
    name: 'Phenolphthalein',
    range: [8.2, 10.0],
    colours: ['#ffffff', '#e75480'], // colourless to pink
  },
  {
    name: 'Methyl Orange',
    range: [3.1, 4.4],
    colours: ['#d73027', '#fee08b'], // red to yellow
  },
  {
    name: 'Bromothymol Blue',
    range: [6.0, 7.6],
    colours: ['#ffff66', '#2c7bb6'], // yellow to blue
  },
];

const pKw = 14.0;

// Utility: base-10 logarithm.  JavaScript lacks a built‑in log10, so
// compute via natural log.
function log10(x) {
  return Math.log(x) / Math.LN10;
}

// Interpolate between two hex colours.  Given two colour strings like
// '#ff0000' and '#00ff00' and a fraction t between 0 and 1, return an
// intermediate colour.  This helper is used to animate the indicator
// colour as pH passes through the indicator's transition range.
function interpolateColour(hex1, hex2, t) {
  const c1 = hex1.replace('#', '');
  const c2 = hex2.replace('#', '');
  const r1 = parseInt(c1.substring(0, 2), 16);
  const g1 = parseInt(c1.substring(2, 4), 16);
  const b1 = parseInt(c1.substring(4, 6), 16);
  const r2 = parseInt(c2.substring(0, 2), 16);
  const g2 = parseInt(c2.substring(2, 4), 16);
  const b2 = parseInt(c2.substring(4, 6), 16);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute the pH of the solution after adding Vb litres of base to
 * an initial volume Va of acid.  Ca and Cb are molar concentrations.
 * The calculation accounts for combinations of strong/weak acids and
 * bases using common approximations appropriate for introductory
 * titration curves.  The returned value is bounded between 0 and 14.
 */
function computePH(acid, base, Ca, Va, Cb, Vb) {
  const mAcid0 = Ca * Va; // initial moles of acid
  const mBase = Cb * Vb; // moles of base added
  const Vtot = Va + Vb;
  // guard against zero volume
  if (Vtot === 0) return 7;

  // Case 1: strong acid + strong base
  if (acid.type === 'strong' && base.type === 'strong') {
    if (mBase < mAcid0) {
      const h = (mAcid0 - mBase) / Vtot;
      return Math.max(0, Math.min(14, -log10(h)));
    } else if (mBase > mAcid0) {
      const oh = (mBase - mAcid0) / Vtot;
      const pH = pKw + log10(oh);
      return Math.max(0, Math.min(14, pH));
    } else {
      return 7.0;
    }
  }

  // Case 2: weak acid + strong base
  if (acid.type === 'weak' && base.type === 'strong') {
    const Ka = Math.pow(10, -acid.pKa);
    if (Vb === 0) {
      // initial weak acid
      // pH ≈ 0.5 * (pKa - log10(Ca))
      const ph = 0.5 * (acid.pKa - log10(Ca));
      return Math.max(0, Math.min(14, ph));
    }
    if (mBase < mAcid0) {
      // buffer region: Henderson–Hasselbalch
      const ratio = mBase / (mAcid0 - mBase);
      const ph = acid.pKa + log10(ratio);
      return Math.max(0, Math.min(14, ph));
    } else if (mBase > mAcid0) {
      // past equivalence: strong base dominates
      const oh = (mBase - mAcid0) / Vtot;
      const ph = pKw + log10(oh);
      return Math.max(0, Math.min(14, ph));
    } else {
      // at equivalence: solution of the salt of weak acid
      const Csalt = mAcid0 / Vtot;
      const ph = 0.5 * (pKw + acid.pKa + log10(Csalt));
      return Math.max(0, Math.min(14, ph));
    }
  }

  // Case 3: strong acid + weak base
  if (acid.type === 'strong' && base.type === 'weak') {
    const pKaBH = pKw - base.pKb; // pKa of the conjugate acid BH+
    if (mBase === 0) {
      // initial strong acid
      const h = mAcid0 / Vtot;
      return Math.max(0, Math.min(14, -log10(h)));
    }
    if (mBase < mAcid0) {
      // strong acid still in excess; pH governed by excess H+
      const h = (mAcid0 - mBase) / Vtot;
      return Math.max(0, Math.min(14, -log10(h)));
    } else if (mBase > mAcid0) {
      // excess weak base; compute pOH from weak base approximation
      const Cb_ex = (mBase - mAcid0) / Vtot;
      const pOH = 0.5 * (base.pKb - log10(Cb_ex));
      const ph = pKw - pOH;
      return Math.max(0, Math.min(14, ph));
    } else {
      // at equivalence: weak acid BH+ present
      const Csalt = mAcid0 / Vtot;
      const ph = 0.5 * (pKaBH - log10(Csalt));
      return Math.max(0, Math.min(14, ph));
    }
  }

  // Case 4: weak acid + weak base
  if (acid.type === 'weak' && base.type === 'weak') {
    // Use Henderson–Hasselbalch generalization: pH = 7 + 0.5*(pKa - pKb) + log10(n_base/n_acid)
    const nAcid = mAcid0 - mBase;
    const nBase = mBase;
    // before equivalence: buffer of weak acid and weak base
    if (nAcid > 0 && nBase >= 0) {
      const ratio = nBase / nAcid;
      const ph = 7 + 0.5 * (acid.pKa - base.pKb) + log10(ratio);
      return Math.max(0, Math.min(14, ph));
    }
    if (mBase === mAcid0) {
      // at equivalence
      const ph = 7 + 0.5 * (acid.pKa - base.pKb);
      return Math.max(0, Math.min(14, ph));
    }
    // after equivalence: base in excess (weak)
    const Cb_ex = (mBase - mAcid0) / Vtot;
    const pOH = 0.5 * (base.pKb - log10(Cb_ex));
    const ph = pKw - pOH;
    return Math.max(0, Math.min(14, ph));
  }

  // default fallback: neutral
  return 7;
}

/**
 * Main component implementing the interactive titration game.  Players can
 * choose the analyte (acid), titrant (base), and indicator, adjust
 * concentrations and volumes, and then add titrant in small increments
 * while observing the pH change, colour shift, and titration curve.
 * Difficulty modes hide certain information for advanced play.
 */
export default function TitrationGame() {
  // State variables controlling the choice of reagents and their
  // concentrations/volumes.  Concentrations are in mol/L, volumes in
  // litres.  Vb is the cumulative titrant volume added.  We store
  // difficulty mode as a string ('Beginner', 'Intermediate', 'Advanced').
  const [acid, setAcid] = useState(acids[0]);
  const [base, setBase] = useState(bases[0]);
  const [indicator, setIndicator] = useState(indicators[0]);
  const [Ca, setCa] = useState(0.1);
  const [Va, setVa] = useState(0.025);
  const [Cb, setCb] = useState(0.1);
  const [Vb, setVb] = useState(0);
  const [mode, setMode] = useState('Beginner');
  const [message, setMessage] = useState('');

  // -------------------------------------------------------------------------
  // Exam state and navigation.  View can be 'titration', 'exam' or 'results'.
  // Additional state variables track progress through the exam.
  const [view, setView] = useState('titration');
  const [taskIndex, setTaskIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [examScore, setExamScore] = useState(0);
  const [examFinished, setExamFinished] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // Start a new exam: reset progress and scores.
  const startExam = () => {
    setView('exam');
    setTaskIndex(0);
    setExamScore(0);
    setUserAnswer('');
    setExamFinished(false);
    setShowHint(false);
  };

  // Evaluate the current answer, update score and progress.
  const submitAnswer = () => {
    const task = examTasks[taskIndex];
    let correct = false;
    if (task.type === 'numeric') {
      const val = parseFloat(userAnswer.replace(',', '.'));
      if (!isNaN(val)) {
        const tol = task.tolerance ?? 0;
        if (Math.abs(val - task.answer) <= tol) {
          correct = true;
        }
      }
    } else if (task.type === 'mcq') {
      if (parseInt(userAnswer, 10) === task.answer) {
        correct = true;
      }
    }
    if (correct) {
      setExamScore(prev => prev + 1);
    }
    if (taskIndex + 1 < examTasks.length) {
      setTaskIndex(prev => prev + 1);
      setUserAnswer('');
      setShowHint(false);
    } else {
      setExamFinished(true);
      setView('results');
    }
  };

  // Toggle hint visibility.
  const toggleHint = () => {
    setShowHint(prev => !prev);
  };

  // Navigate back to the titration simulator.
  const goToSimulation = () => {
    setView('titration');
    setExamFinished(false);
    setTaskIndex(0);
    setUserAnswer('');
    setShowHint(false);
  };

  // Compute equivalence volume in litres.  Guard division by zero.
  const equivalence = useMemo(() => {
    return Cb > 0 ? (Ca * Va) / Cb : Infinity;
  }, [Ca, Va, Cb]);

  // Current pH based on state.  We guard NaN by defaulting to 7.
  const pH = useMemo(() => {
    const phVal = computePH(acid, base, Ca, Va, Cb, Vb);
    return isNaN(phVal) ? 7 : phVal;
  }, [acid, base, Ca, Va, Cb, Vb]);

  // -------------------------------------------------------------------------
  // Fluid physics helpers
  //
  // We introduce a generic clamp function and two derived state values to
  // represent how much liquid remains in the burette and how full the
  // Erlenmeyer‑kolbe is.  These values are used to drive more realistic
  // animations in the laboratory illustration.

  // Clamp a number into a range [low, high].
  const clamp = (value, low, high) => {
    if (value < low) return low;
    if (value > high) return high;
    return value;
  };

  // Fraction of the total base volume still in the burette.  We assume the
  // burette initially contains twice the equivalence volume of titrant, so
  // that the animation continues smoothly past the equivalence point.
  const buretteLevel = useMemo(() => {
    const totalVol = equivalence !== Infinity ? equivalence * 2 : (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
    if (!totalVol || totalVol <= 0) return 0;
    return clamp((totalVol - Vb) / totalVol, 0, 1);
  }, [equivalence, Ca, Va, Cb, Vb]);

  // Fraction of the flask filled with solution (analyte + titrant).  When the
  // titration passes twice the equivalence, we treat the flask as full.
  const flaskLevel = useMemo(() => {
    const maxVol = equivalence !== Infinity ? Va + equivalence * 2 : Va + (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
    if (!maxVol || maxVol <= 0) return 0;
    return clamp((Va + Vb) / maxVol, 0, 1);
  }, [Va, Vb, equivalence, Ca, Cb]);

  // Determine the current solution colour based on the indicator and pH.
  const solutionColour = useMemo(() => {
    const [start, end] = indicator.range;
    const [c1, c2] = indicator.colours;
    let t;
    if (pH <= start) t = 0;
    else if (pH >= end) t = 1;
    else t = (pH - start) / (end - start);
    return interpolateColour(c1, c2, t);
  }, [indicator, pH]);

  // Generate the titration curve path only when the reagents or
  // concentrations change.  We sample 150 points between 0 and 1.5×V_eq.
  const graphPath = useMemo(() => {
    // avoid heavy computation if Cb is zero or V_eq is invalid
    if (Cb <= 0) return '';
    const Vmax = equivalence * 1.5 || 0.05;
    const samples = 150;
    const width = 300;
    const height = 180;
    let d = '';
    for (let i = 0; i <= samples; i++) {
      const V = (Vmax * i) / samples;
      const ph = computePH(acid, base, Ca, Va, Cb, V);
      const x = (width * i) / samples;
      const y = height - (Math.max(0, Math.min(14, ph)) / 14) * height;
      if (i === 0) d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      else d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  }, [acid, base, Ca, Va, Cb, equivalence]);

  // Update instructional message based on current progress.  For
  // simplicity we distinguish three regions: before equivalence,
  // near equivalence (within 0.3 mL), and after equivalence.
  useEffect(() => {
    if (equivalence === Infinity) {
      setMessage('Skriv inn en gyldig konsentrasjon for base.');
      return;
    }
    const diff = Vb - equivalence;
    if (diff < -0.0003) {
      setMessage('Før ekvivalens: løsningen er syrerik.');
    } else if (Math.abs(diff) <= 0.0003) {
      setMessage('Ekvivalenspunkt: nøytralisering er fullført.');
    } else {
      setMessage('Etter ekvivalens: løsningen er baserik.');
    }
  }, [Vb, equivalence]);

  // Reset titration
  const reset = () => {
    setVb(0);
  };

  // Add a specified volume (in litres) of titrant.  We cap the volume at twice
  // the equivalence point to keep the simulation bounded.
  const addVolume = delta => {
    setVb(prev => {
      const maxV = equivalence * 2;
      const next = prev + delta;
      return next > maxV ? maxV : next;
    });
  };

  // Determine whether the selected indicator is appropriate based on
  // equivalence pH.  Provide a suggestion if not.
  const indicatorHint = useMemo(() => {
    // Compute pH at equivalence (approx) using computePH with Vb = V_eq
    if (equivalence === Infinity) return '';
    const phEq = computePH(acid, base, Ca, Va, Cb, equivalence);
    const [start, end] = indicator.range;
    if (phEq < start || phEq > end) {
      return `Tips: Velg en indikator som skifter rundt pH ${phEq.toFixed(2)}.`;
    }
    return '';
  }, [acid, base, Ca, Va, Cb, equivalence, indicator]);

  return (
    <div className="titration-container">
      {/* Dashboard header with navigation */}
      <header className="dashboard-header">
        <h1>SiU Lab – Kjemispill</h1>
        <p>Utforsk syre–base titrering og test kjemikunnskapene dine</p>
        <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'center', gap: '0.6rem' }}>
          <button
            className="button-primary"
            onClick={goToSimulation}
            disabled={view === 'titration'}
          >
            Titrering
          </button>
          <button
            className="button-primary"
            onClick={startExam}
            disabled={view === 'exam' || view === 'results'}
          >
            Eksamen
          </button>
        </div>
      </header>
      <div className="game-dashboard" style={{ display: view === 'titration' ? 'block' : 'none' }}>
        {/* Control panel */}
        <section className="panel controls-panel">
          <div className="control-group">
            <label>Syre:</label>
            <select value={acid.name} onChange={e => setAcid(acids.find(a => a.name === e.target.value))}>
              {acids.map(a => (
                <option key={a.name} value={a.name}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Base:</label>
            <select value={base.name} onChange={e => setBase(bases.find(b => b.name === e.target.value))}>
              {bases.map(b => (
                <option key={b.name} value={b.name}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Indikator:</label>
            <select value={indicator.name} onChange={e => setIndicator(indicators.find(i => i.name === e.target.value))}>
              {indicators.map(i => (
                <option key={i.name} value={i.name}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="control-group">
            <label>Konsentrasjon syre (mol/L):</label>
            <input
              type="number"
              step="0.05"
              min="0.01"
              value={Ca}
              onChange={e => setCa(Math.max(0.001, parseFloat(e.target.value) || 0))}
            />
          </div>
          <div className="control-group">
            <label>Volum syre (mL):</label>
            <input
              type="number"
              step="0.5"
              min="1"
              value={Va * 1000}
              onChange={e => setVa(Math.max(0.0001, parseFloat(e.target.value) / 1000 || 0))}
            />
          </div>
          <div className="control-group">
            <label>Konsentrasjon base (mol/L):</label>
            <input
              type="number"
              step="0.05"
              min="0.01"
              value={Cb}
              onChange={e => setCb(Math.max(0.001, parseFloat(e.target.value) || 0))}
            />
          </div>
          <div className="control-group">
            <label>Modus:</label>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="Beginner">Lett</option>
              <option value="Intermediate">Middels</option>
              <option value="Advanced">Avansert</option>
            </select>
          </div>
          <div className="control-group" style={{ marginTop: '0.5rem' }}>
            <button className="button-primary" onClick={() => addVolume(0.0005)}>+0,5 mL</button>
            <button className="button-primary" onClick={() => addVolume(0.001)} style={{ marginLeft: '0.5rem' }}>
              +1,0 mL
            </button>
            <button className="button-secondary" onClick={reset} style={{ marginLeft: '0.5rem' }}>
              Nullstill
            </button>
          </div>
        </section>
        {/* Laboratory view and graph */}
        <section className="panel display-panel">
          {/* Laboratory illustration */}
          <div className="lab-view">
            <svg width="200" height="260" viewBox="0 0 700 320">
              <defs>
                {/* Gradient definitions for glass and meniscus */}
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
                {/* Tube */}
                <rect x="0" y="0" width="20" height="200" fill="url(#glassGrad)" stroke="#94a3b8" strokeWidth="1" rx="6" />
                {/* Tick marks */}
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
                {/* Liquid level */}
                <rect x="1" y="0" width="18" height={200 * buretteLevel} fill={solutionColour} opacity="0.65" />
                {/* Meniscus */}
                <ellipse
                  cx="10"
                  cy={200 * buretteLevel}
                  rx="9"
                  ry="3"
                  fill="url(#meniscusGrad)"
                  opacity="0.8"
                />
                {/* Stopcock and nozzle */}
                <rect x="17" y="200" width="10" height="12" fill="#94a3b8" rx="2" />
                <rect x="25" y="210" width="35" height="6" fill="#94a3b8" rx="3" />
              </g>
              {/* Droplet falling when titrant is added */}
              {Vb > 0 && (
                <g>
                  <circle cx="120" cy="225" r="4" fill={solutionColour}>
                    <animate attributeName="cy" values="210; 225; 210" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                </g>
              )}
              {/* Erlenmeyer flask */}
              <g transform="translate(200,110)">
                {/* Flask body */}
                <path
                  d="M60,0 L100,0 L112,90 C116,120 -4,120 0,90 Z"
                  fill="url(#glassGrad)"
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
                {/* Neck */}
                <rect x="70" y="-38" width="20" height="40" fill="url(#glassGrad)" stroke="#94a3b8" strokeWidth="1" rx="5" />
                {/* Liquid with curved meniscus */}
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
                {/* Indicator tint overlay */}
                <path
                  d="M10,90 C12,50 100,50 102,90 Z"
                  fill={solutionColour}
                  opacity="0.25"
                />
                {/* Bubble animations */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const cx = 20 + Math.random() * 80;
                  const cy = 70 + Math.random() * 20;
                  const r = 2 + Math.random() * 3;
                  const dur = (4 + Math.random() * 4).toFixed(2) + 's';
                  const delay = (Math.random() * 2).toFixed(2) + 's';
                  return (
                    <circle key={i} cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.85)">
                      <animate attributeName="cy" values={cy + '; ' + (cy - 30) + '; ' + cy} dur={dur} repeatCount="indefinite" begin={delay} />
                    </circle>
                  );
                })}
              </g>
            </svg>
          </div>
          {/* Graph */}
          <div className="graph-view">
            <svg width="300" height="200" viewBox="0 0 300 180">
              <rect x="0" y="0" width="300" height="180" fill="#f0f4f8" stroke="#ddd" />
              {/* pH curve */}
              {graphPath && <path d={graphPath} stroke="#2c7bb6" strokeWidth="2" fill="none" />}
              {/* Marker for current point */}
              {(() => {
                if (!Cb || equivalence === Infinity) return null;
                const Vmax = equivalence * 1.5 || 0.05;
                const x = Math.min(1, Vb / Vmax) * 300;
                const y = 180 - (Math.max(0, Math.min(14, pH)) / 14) * 180;
                return <circle cx={x} cy={y} r="4" fill="#d73027" />;
              })()}
              {/* Equivalence line */}
              {(() => {
                if (!Cb || equivalence === Infinity) return null;
                const Vmax = equivalence * 1.5 || 0.05;
                const xEq = Math.min(1, equivalence / Vmax) * 300;
                return <line x1={xEq} y1="0" x2={xEq} y2="180" stroke="#999" strokeDasharray="4,4" />;
              })()}
            </svg>
            <div className="graph-labels">
              <span>0 mL</span>
              <span style={{ marginLeft: 'auto' }}>{(equivalence * 1000 * 1.5).toFixed(1)} mL</span>
            </div>
          </div>
        </section>
        {/* Information panel */}
        <section className="panel info-panel">
          <p>
            Volum tilsatt: {(Vb * 1000).toFixed(2)} mL{' '}
            {equivalence !== Infinity && ` (ekvivalens ved ${(equivalence * 1000).toFixed(2)} mL)`}
          </p>
          {mode !== 'Advanced' && <p>pH = {pH.toFixed(2)}</p>}
          {mode === 'Advanced' && <p>pH = ??? (skjult)</p>}
          <p>{message}</p>
        {indicatorHint && <p style={{ color: '#d73027' }}>{indicatorHint}</p>}
        </section>
      </div>

      {view === 'exam' && (
        <div className="game-dashboard">
          <section className="panel display-panel">
            <h2>Eksamen</h2>
            <p>Oppgave {taskIndex + 1} av {examTasks.length}</p>
            <p>{examTasks[taskIndex].question}</p>
            {examTasks[taskIndex].type === 'numeric' ? (
              <input
                type="number"
                step="0.01"
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', margin: '0.5rem 0' }}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0.5rem 0' }}>
                {examTasks[taskIndex].options.map((opt, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <input
                      type="radio"
                      name="mcq"
                      value={idx}
                      checked={userAnswer === String(idx)}
                      onChange={e => setUserAnswer(e.target.value)}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
            {showHint && (
              <p style={{ fontStyle: 'italic', color: '#7058a5', marginTop: '0.5rem' }}>
                {examTasks[taskIndex].hint}
              </p>
            )}
            <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.6rem' }}>
              <button className="button-secondary" onClick={toggleHint}>Vis hint</button>
              <button
                className="button-primary"
                onClick={submitAnswer}
                disabled={userAnswer === ''}
              >
                {taskIndex + 1 === examTasks.length ? 'Fullfør' : 'Neste'}
              </button>
              <button className="button-secondary" onClick={goToSimulation}>Avbryt</button>
            </div>
            <p style={{ marginTop: '0.6rem' }}>Poeng: {examScore}</p>
          </section>
        </div>
      )}

      {view === 'results' && (
        <div className="game-dashboard">
          <section className="panel display-panel">
            <h2>Resultat</h2>
            <p>Du fikk {examScore} av {examTasks.length} riktige svar.</p>
            <div style={{ marginTop: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
              {examTasks.map((task, idx) => (
                <div key={idx} style={{ marginBottom: '0.8rem' }}>
                  <strong>Oppgave {idx + 1}:</strong> {task.question}
                  <br />
                  <strong>Riktig svar:</strong>{' '}
                  {task.type === 'numeric'
                    ? `${task.answer.toFixed(2)}`
                    : task.options[task.answer]}
                  <br />
                  <em>{task.explanation}</em>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.6rem' }}>
              <button className="button-primary" onClick={startExam}>Prøv igjen</button>
              <button className="button-secondary" onClick={goToSimulation}>Tilbake til titrering</button>
            </div>
          </section>
        </div>
      )}

    </div>
  );
}
