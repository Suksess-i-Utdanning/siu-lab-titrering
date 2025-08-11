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
  return (
    <div className="titration-game">
      <h1 className="title">SiU titreringsspill</h1>
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
          <button onClick={() => addVolume(0.0005)}>+0.5 mL</button>
          <button onClick={() => addVolume(0.0025)}>+2.5 mL</button>
          <button onClick={() => addVolume(0.01)}>+10 mL</button>
          <button onClick={reset}>Tilbakestill</button>
        </div>
      </div>
      {/* Laboratory illustration and graph */}
      <div className="lab-and-graph">
        <div className="lab-view">
          <svg viewBox="0 0 200 300" width="200" height="300">
            {/* Stand */}
            <rect x="95" y="10" width="10" height="280" fill="#6C5CE7" />
            {/* Burette outline */}
            <rect x="120" y="20" width="20" height="200" fill="none" stroke="#2C3E50" strokeWidth="2" rx="5" />
            {/* Burette liquid */}
            <rect x="120" y={20 + (1 - buretteLevel) * 200} width="20" height={200 * buretteLevel} fill="#3498DB" />
            {/* Stopcock */}
            <rect x="132" y="220" width="6" height="20" fill="#34495E" />
            {/* Drip animation: show droplet when adding titrant */}
            {Vb > 0 && (
              <circle cx="130" cy="250" r="4" fill={indicatorColour} style={{ animation: 'drip 1s infinite' }} />
            )}
            {/* Erlenmeyer flask */}
            <path d="M50 200 L80 50 L120 50 L150 200 Z" fill="#ecf0f1" stroke="#2C3E50" strokeWidth="2" />
            {/* Flask liquid */}
            <path d={`M60 ${200 - 100 * flaskLevel} L140 ${200 - 100 * flaskLevel} L130 200 L70 200 Z`} fill={indicatorColour} />
          </svg>
        </div>
        <div className="graph-view">
          <svg viewBox="0 0 300 200" width="300" height="200">
            {/* Axes */}
            <line x1="40" y1="10" x2="40" y2="190" stroke="#2C3E50" strokeWidth="2" />
            <line x1="40" y1="190" x2="290" y2="190" stroke="#2C3E50" strokeWidth="2" />
            {/* Axis labels */}
            <text x="5" y="15" fontSize="10">pH</text>
            <text x="270" y="210" fontSize="10">V_b (L)</text>
            {/* Plot polyline */}
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
            {/* Current point marker */}
            {(() => {
              const maxX = graphData[graphData.length - 1]?.x || 0.01;
              const x = 40 + (Vb / (maxX || 0.01)) * 250;
              const y = 190 - (Math.min(14, Math.max(0, pH)) / 14) * 180;
              return <circle cx={x} cy={y} r="4" fill="#16A085" />;
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
      <style>{`
        .titration-game { font-family: Arial, sans-serif; color: #2C3E50; background: linear-gradient(180deg, #D6EAF8, #FDFEFE); padding: 20px; border-radius: 8px; }
        .title { text-align: center; color: #1F618D; margin-bottom: 16px; }
        .controls { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .select-row, .input-row, .button-row { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
        label { display: flex; flex-direction: column; font-size: 12px; color: #34495E; }
        select, input { border: 1px solid #BDC3C7; border-radius: 4px; padding: 4px; min-width: 80px; }
        button { background-color: #3498DB; color: white; border: none; border-radius: 4px; padding: 6px 10px; cursor: pointer; transition: background-color 0.2s; font-size: 12px; }
        button:hover { background-color: #2980B9; }
        .lab-and-graph { display: flex; gap: 16px; justify-content: center; }
        .lab-view { background: #ECF0F1; border: 1px solid #BDC3C7; border-radius: 8px; padding: 8px; }
        .graph-view { background: #FBFCFC; border: 1px solid #BDC3C7; border-radius: 8px; padding: 8px; }
        .info-panel { margin-top: 16px; text-align: center; }
        .hint { color: #7D3C98; font-size: 12px; }
        .message { margin-top: 8px; font-weight: bold; color: #1ABC9C; }
        @keyframes drip { 0% { opacity: 0; transform: translateY(0); } 50% { opacity: 1; transform: translateY(10px); } 100% { opacity: 0; transform: translateY(20px); } }
          /* Design improvements - pastel colours and improved layout */
  .titration-game {
    background: linear-gradient(180deg, #F5F9FF 0%, #F1F5FF 100%);
    color: #2d2d3a;
    border-radius: 12px;
    padding: 20px;
  }
  .title {
    color: #3e3275;
    font-size: 1.4em;
    margin-bottom: 16px;
  }
  .controls {
    flex-wrap: wrap;
    gap: 16px;
  }
  .select-row,
  .input-row,
  .button-row {
    gap: 16px;
  }
  label {
    color: #343a6e;
    font-size: 0.9em;
  }
  select,
  input {
    border: 1px solid #bcbcf2;
    border-radius: 8px;
    padding: 6px 10px;
    font-size: 14px;
  }
  button {
    background-color: #7058a5;
    color: #fff;
    border-radius: 8px;
    padding: 8px 16px;
    transition: background-color 0.2s ease;
  }
  button:hover {
    background-color: #614a8f;
  }
  .lab-view, .graph-view, .info-panel {
    background: #f8f6ff;
    border-radius: 12px;
    border: 1px solid #e0ddf7;
  }
  .hint {
    color: #8050a0;
    font-size: 12px;
  }
  .message {
    color: #49406f;
    font-size: 14px;
    font-weight: 500;
  }


      `}</style>
    </div>
  );
}
