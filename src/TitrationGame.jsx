import React, { useState, useMemo, useEffect } from 'react';

// Data for acids, bases, and indicators (monoprotic simplification)
const ACIDS = {
  HCl: { name: 'HCl (saltsyre)', Ka: Infinity, strong: true, info: 'Sterk syre (full protolyse).', color: '#3461FF' },
  HNO3: { name: 'HNO₃ (salpetersyre)', Ka: Infinity, strong: true, info: 'Sterk syre brukt i analyse.', color: '#2B7DFB' },
  CH3COOH: { name: 'CH₃COOH (eddiksyre)', Ka: 1.8e-5, strong: false, info: 'Svak syre brukt i buffere.', color: '#9EC5FF' },
  HCOOH: { name: 'HCOOH (maursyre)', Ka: 1.77e-4, strong: false, info: 'Svak syre, litt sterkere enn eddiksyre.', color: '#7FB0FF' },
  HCN: { name: 'HCN (blåsyre)', Ka: 4.9e-10, strong: false, info: 'Meget svak syre (giftig; kun teoretisk her).', color: '#B0C8FF' },
};

const BASES = {
  NaOH: { name: 'NaOH (natriumhydroksid)', Kb: Infinity, strong: true, info: 'Sterk base, full protolyse.', color: '#00C2D7' },
  KOH:  { name: 'KOH (kaliumhydroksid)', Kb: Infinity, strong: true, info: 'Sterk base tilsvarende NaOH.', color: '#00D1E0' },
  NH3:  { name: 'NH₃ (ammoniakk)', Kb: 1.8e-5, strong: false, info: 'Svak base, danner NH₄⁺ i vann.', color: '#28D8C5' },
  CH3NH2: { name: 'CH₃NH₂ (metylamin)', Kb: 4.4e-4, strong: false, info: 'Aminbase, sterkere enn NH₃.', color: '#53E3C1' },
};

const INDICATORS = {
  Phenolphthalein: {
    name: 'Fenolftalein',
    range: [8.2, 10.0],
    colours: ['#FFFFFF','#E83E8C'],
    use: 'Sterk syre ↔ sterk base (sluttpunkt) eller svak syre ↔ sterk base (etter ekvivalens).'
  },
  MethylOrange: {
    name: 'Metyloransje',
    range: [3.1, 4.4],
    colours: ['#E74C3C','#F1C40F'],
    use: 'Sterk syre ↔ sterk base (begynn) eller sterk syre ↔ svak base.'
  },
  BromothymolBlue: {
    name: 'Bromtymolblått',
    range: [6.0, 7.6],
    colours: ['#F4D03F','#3498DB'],
    use: 'Når ekvivalens ligger nær nøytral pH (sterk/sterk).'
  },
  MethylRed: {
    name: 'Metylrødt',
    range: [4.2, 6.3],
    colours: ['#FF6B6B','#F9D56E'],
    use: 'Mellomsterke systemer (svak syre ↔ sterk base før ekvivalens).'
  },
  Litmus: {
    name: 'Lakmus',
    range: [4.5,8.3],
    colours: ['#D63031','#0984E3'],
    use: 'Grovindikator rundt nøytralområdet.'
  }
};

// Helper functions
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function log10(x) { return Math.log(x) / Math.log(10); }
function interpolateColour(a,b,t) {
  const ah = parseInt(a.replace('#',''), 16);
  const ar=(ah>>16)&0xFF, ag=(ah>>8)&0xFF, ab=ah&0xFF;
  const bh = parseInt(b.replace('#',''), 16);
  const br=(bh>>16)&0xFF, bg=(bh>>8)&0xFF, bb=bh&0xFF;
  const rr=Math.round(ar+(br-ar)*t);
  const gg=Math.round(ag+(bg-ag)*t);
  const bb2=Math.round(ab+(bb-ab)*t);
  return '#' + ((rr<<16)|(gg<<8)|bb2).toString(16).padStart(6,'0');
}

function pHColour(pH) {
  const t = clamp(pH/14, 0, 1);
  return t < 0.5
    ? interpolateColour('#2B7DFB','#5AD49E', t/0.5)
    : interpolateColour('#5AD49E','#E83E8C', (t-0.5)/0.5);
}

// Compute pH for titration (monoprotic)
function computePH(acid, base, Ca, Cb, Va, Vb) {
  const nA = Ca * Va;
  const nB = Cb * Vb;
  const Vt = Va + Vb;
  if (Vt <= 0) return 7;
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
      return 14 - ( -log10(Kb) + Math.log10(nBHplus / nBfree) );
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
  return 14 - ( -log10(base.Kb) + Math.log10(nA / (nB - nA)) );
}

// Standard potentials for E° tasks
const E0 = {
  'Cu2+/Cu': 0.34,
  'Zn2+/Zn': -0.76,
  'Ag+/Ag': 0.80,
  'Fe3+/Fe2+': 0.77,
  'Cl2/Cl-': 1.36,
  'H+/H2': 0.00,
};

// Solubility products for precipitation
const KSP = {
  'AgCl': 1.8e-10,
  'BaSO4': 1.1e-10,
  'CaF2': 3.9e-11,
};

// Helper for numeric formatting
function numFmt(x, d = 2) {
  return parseFloat(x.toFixed(d));
}

// Task generators
function t_buffer_basic() {
  const pKas = [3.75, 4.76, 5.0];
  const pKa = pKas[Math.floor(Math.random() * pKas.length)];
  const Ca = numFmt(0.05 + Math.random() * 0.45, 2);
  const ratio = 0.5 + Math.random() * 1.5;
  const Cb = numFmt(Ca * ratio, 2);
  const pH = pKa + log10(Cb / Ca);
  return {
    question: `En buffer lages av en svak syre med pKₐ = ${pKa.toFixed(2)} og dens konjugerte base.
Konsentrasjonene er [syre] = ${Ca.toFixed(2)} M og [base] = ${Cb.toFixed(2)} M. Hva er pH?`,
    type: 'numeric',
    answer: numFmt(pH, 2),
    tolerance: 0.1,
    hint: 'Bruk Henderson–Hasselbalch: pH = pKₐ + log([base]/[syre]).',
    explanation: `pH = pKₐ + log([base]/[syre]) = ${pKa.toFixed(2)} + log(${(Cb/Ca).toFixed(2)}) ≈ ${numFmt(pH,2)}.`,
  };
}

function t_titration_weak_strong() {
  const pKa = 4.76;
  const Ca = numFmt(0.05 + Math.random()*0.10, 2);
  const Va = numFmt(0.015 + Math.random()*0.02, 3);
  const Cb = numFmt(0.05 + Math.random()*0.10, 2);
  const nA = Ca * Va;
  const Veq = nA / Cb;
  const Vb = numFmt(Math.max(0.001, Math.min(Veq * (0.2 + Math.random()*1.6), 2*Veq)), 3);
  const pHval = computePH({Ka: Math.pow(10,-pKa)}, {Kb: Infinity}, Ca, Cb, Va, Vb);
  return {
    question: `En svak syre (pKₐ = ${pKa}) med konsentrasjon ${Ca} M og volum ${Va} L titreres med ${Cb} M NaOH.
Hva blir pH etter at ${Vb} L base er tilsatt?`,
    type: 'numeric',
    answer: numFmt(pHval, 2),
    tolerance: 0.1,
    hint: 'Bestem om vi er før, ved eller etter ekvivalens; bruk buffer- eller overskuddsformel.',
    explanation: `n(HA) = ${numFmt(nA,3)} mol, n(OH⁻) = ${(Cb*Vb).toFixed(3)} mol, totalvolum = ${(Va+Vb).toFixed(3)} L. Basert på regionen finner man pH ≈ ${numFmt(pHval,2)}.`,
  };
}

function t_precipitation() {
  const salts = Object.keys(KSP);
  const salt = salts[Math.floor(Math.random()*salts.length)];
  const ksp = KSP[salt];
  const C1 = numFmt(0.02 + Math.random()*0.13, 2);
  const C2 = numFmt(0.02 + Math.random()*0.13, 2);
  const V1 = numFmt(0.04 + Math.random()*0.06, 3);
  const V2 = numFmt(0.04 + Math.random()*0.06, 3);
  const Ct1 = (C1 * V1)/(V1+V2);
  const Ct2 = (C2 * V2)/(V1+V2);
  const Q = Ct1 * Ct2;
  const will = Q > ksp;
  return {
    question: `Blander du ${V1} L av ${C1} M og ${V2} L av ${C2} M av løsninger som danner ${salt}. Vil ${salt} felles ut? (K_sp = ${ksp.toExponential()})`,
    type: 'mcq',
    options: ['Ja, bunnfall dannes','Nei, ingen bunnfall'],
    answer: will ? 'Ja, bunnfall dannes' : 'Nei, ingen bunnfall',
    hint: 'Beregn ionekonsentrasjoner etter fortynning og sammenlign Q med Ksp.',
    explanation: `Etter fortynning: [ion1] = ${numFmt(Ct1,3)} M, [ion2] = ${numFmt(Ct2,3)} M. Q = ${numFmt(Q,3)}. siden Q ${will?'>':'<='} K_sp (${ksp.toExponential()}), ${will?'dannes bunnfall':'dannes ikke bunnfall'}.`,
  };
}

function t_cell_potential() {
  const pairs = Object.keys(E0);
  const p1 = pairs[Math.floor(Math.random()*pairs.length)];
  let p2 = pairs[Math.floor(Math.random()*pairs.length)];
  while (p2 === p1) p2 = pairs[Math.floor(Math.random()*pairs.length)];
  const E = E0[p1] - E0[p2];
  return {
    question: `Beregn standard cellepotensial for galvanisk celle: (${p2}) || (${p1}).`,
    type: 'numeric',
    answer: numFmt(E, 2),
    tolerance: 0.05,
    hint: 'E°_celle = E°_katode − E°_anode; den mest positive er katode.',
    explanation: `E°(katode) = E°(${p1}) = ${E0[p1]} V, E°(anode) = E°(${p2}) = ${E0[p2]} V. E°_celle = ${numFmt(E,2)} V.`,
  };
}

function t_arrhenius() {
  const k1 = numFmt(0.003 + Math.random()*0.017,3);
  const factor = 2 + Math.random()*4;
  const k2 = numFmt(k1 * factor, 3);
  const T1 = Math.floor(293 + Math.random()*12);
  const T2 = T1 + Math.floor(10 + Math.random()*15);
  const R = 8.314;
  const Ea = (R * Math.log(k2/k1) / (1/T1 - 1/T2)) / 1000;
  return {
    question: `For en reaksjon er k₁ = ${k1} s⁻¹ ved T₁ = ${T1} K og k₂ = ${k2} s⁻¹ ved T₂ = ${T2} K. Hva er aktiveringsenergien Eₐ (kJ/mol)?`,
    type: 'numeric',
    answer: numFmt(Ea, 2),
    tolerance: 0.5,
    hint: 'Bruk ln(k₂/k₁) = Eₐ/R · (1/T₁ − 1/T₂).',
    explanation: `ln(k₂/k₁) = ln(${numFmt(k2/k1,3)}) og 1/T₁ − 1/T₂ = ${(1/T1 - 1/T2).toFixed(5)}. Eₐ = R·ln(k₂/k₁)/(1/T₁−1/T₂) ≈ ${numFmt(Ea,2)} kJ/mol.`,
  };
}

function t_calorimetry() {
  const m = Math.floor(50 + Math.random()*100);
  const dT = numFmt(3 + Math.random()*5, 1);
  const C = 4.18;
  const q = (m * C * dT) / 1000;
  return {
    question: `I et kalorimeter varmes ${m} g vann opp ${dT} K. Hva er reaksjonsvarmen (kJ) som overføres til vannet? (C=4,18 J/(g·K))`,
    type: 'numeric',
    answer: numFmt(q, 2),
    tolerance: 0.3,
    hint: 'q = m · C · ΔT, del på 1000 for kJ.',
    explanation: `q = m·C·ΔT = ${m} g × 4,18 J/(g·K) × ${dT} K = ${(m*4.18*dT).toFixed(0)} J = ${numFmt(q,2)} kJ.`,
  };
}

function t_equilibrium() {
  const K = numFmt(2 + Math.random()*23, 1);
  const C0 = numFmt(0.2 + Math.random()*0.8, 2);
  const x = (K * C0) / (1 + K);
  return {
    question: `For likevekten A ⇌ B er K = ${K}. Start med [A]₀ = ${C0} M og [B]₀ = 0. Beregn [B] ved likevekt (M).`,
    type: 'numeric',
    answer: numFmt(x, 3),
    tolerance: 0.01,
    hint: 'Sett opp ICE-tabell og løsningsformel x = K·C₀/(1+K).',
    explanation: `x = K·C₀/(1+K) = ${numFmt(x,3)} M.`,
  };
}

function t_electrolysis() {
  const I = numFmt(0.5 + Math.random()*2.5, 2);
  const t = Math.floor(600 + Math.random()*3000);
  const z = 2;
  const M = 63.546;
  const F = 96485;
  const m = (I * t / (z * F)) * M;
  return {
    question: `Under elektrolyse av Cu²⁺-løsning kjøres en strøm på ${I} A i ${t} s. Hvor mange gram Cu avsettes?`,
    type: 'numeric',
    answer: numFmt(m, 3),
    tolerance: 0.02,
    hint: 'm = (I·t)/(zF) · M (Faradays lov).',
    explanation: `Mol e⁻ = I·t/F = ${(I*t/F).toFixed(4)}, mol Cu = ${(I*t/(z*F)).toFixed(4)}. Masse = mol·M = ${numFmt(m,3)} g.`,
  };
}

// MCQ categories
function t_organic_mcq() {
  const qList = [
    {
      q: 'Hva er produktet av oksidasjon av en primær alkohol?',
      opts: ['Aldehyd','Keton','Karboksylsyre','Eter'],
      ans: 'Aldehyd',
      exp: 'Primære alkoholer oksideres først til aldehyder og videre til karboksylsyrer.',
    },
    {
      q: 'Hva kalles CH₃–CH₂–O–CH₂–CH₃?',
      opts: ['Dietyleter','Metyletylketon','Etylacetat','Propanal'],
      ans: 'Dietyleter',
      exp: 'Et oksygen binder to etylgrupper; dette er dietyleter.',
    },
    {
      q: 'Hva er produktet av hydrogenering av en alkyn?',
      opts: ['Alken','Alkan','Aromatisk forbindelse','Keton'],
      ans: 'Alkan',
      exp: 'Alkyner hydrogeneres først til alken og videre til alkan med nok H₂.',
    },
    {
      q: 'Hva er IUPAC-navnet for CH₃-CH(CH₃)-CH₂-COOH?',
      opts: ['2-metylpropanol','2-metylpropansyre','butansyre','3-metylpropansyre'],
      ans: '2-metylpropansyre',
      exp: 'Syren har fire karboner og en metyl på karbon 2; navnet er 2-metylpropansyre.',
    },
  ];
  const item = qList[Math.floor(Math.random()*qList.length)];
  return {
    question: item.q,
    type: 'mcq',
    options: item.opts,
    answer: item.ans,
    hint: 'Tenk på antall karboner og funksjonelle grupper.',
    explanation: item.exp,
  };
}

function t_ir_mcq() {
  const qList = [
    {
      q: 'Hvilket IR-bånd er typisk for en alkohol O–H strekk?',
      opts: ['~3300 cm⁻¹ (bred)','~1715 cm⁻¹','~2100 cm⁻¹','~1550 cm⁻¹'],
      ans: '~3300 cm⁻¹ (bred)',
      exp: 'En bred topp rundt 3200–3600 cm⁻¹ er karakteristisk for O–H strekk i alkoholer.',
    },
    {
      q: 'Hvilket område viser et sterkt C≡N-bånd?',
      opts: ['~2200–2300 cm⁻¹','~1600 cm⁻¹','~3000 cm⁻¹','~1000 cm⁻¹'],
      ans: '~2200–2300 cm⁻¹',
      exp: 'Nitrilgruppe (C≡N) gir skarpt bånd rundt 2250 cm⁻¹.',
    },
    {
      q: 'Hvor finner du karbonylbåndet i estere?',
      opts: ['~1735 cm⁻¹','~1650 cm⁻¹','~2300 cm⁻¹','~3200 cm⁻¹'],
      ans: '~1735 cm⁻¹',
      exp: 'Estere har karbonylbånd litt høyere enn ketoner/syrer, typisk 1735 cm⁻¹.',
    },
  ];
  const item = qList[Math.floor(Math.random()*qList.length)];
  return {
    question: item.q,
    type: 'mcq',
    options: item.opts,
    answer: item.ans,
    hint: 'Husk karakteristiske IR frekvenser for funksjonelle grupper.',
    explanation: item.exp,
  };
}

function t_naming_mcq() {
  const qList = [
    {
      q: 'Hva er navnet på CH₃–CH₂–CH₂–CH₂–OH?',
      opts: ['Propanol','Butanol','Pentan','Metanol'],
      ans: 'Butanol',
      exp: 'Fire karboner og en alkoholgruppe → 1-butanol.',
    },
    {
      q: 'Hva er IUPAC-navnet for CH₃–CH₂–CH₂–NH₂?',
      opts: ['Metanol','Etanol','Propanal','Propan-1-amin'],
      ans: 'Propan-1-amin',
      exp: 'Amin med tre karboner på karbon 1: propan-1-amin.',
    },
    {
      q: 'Hva kalles CH₃–CH₂–COOCH₃?',
      opts: ['Etylmetanavat','Metyletylketon','Metylpropionat','Etylacetat'],
      ans: 'Metylpropionat',
      exp: 'Ester: syre fra propansyre, alkohol fra metanol: metylpropionat.',
    },
  ];
  const item = qList[Math.floor(Math.random()*qList.length)];
  return {
    question: item.q,
    type: 'mcq',
    options: item.opts,
    answer: item.ans,
    hint: 'Identifiser antall karboner og funksjonelle grupper.',
    explanation: item.exp,
  };
}

function t_chromatography_mcq() {
  const qList = [
    {
      q: 'Hva beskriver R_f i tynnsjiktskromatografi?',
      opts: ['Avstand stoffet har vandret','Forholdet mellom avstand stoffet og front','Polariteten til løsemidlet','Konsentrasjonen av analytten'],
      ans: 'Forholdet mellom avstand stoffet og front',
      exp: 'R_f = (avstand analytt)/(avstand løsemiddelfront).',
    },
    {
      q: 'Hva gir best separasjon i gasskromatografi?',
      opts: ['Høy kolonne-temperatur','Lang kolonne og lav strømning','Kort kolonne og høy temperatur','Lav viskositet'],
      ans: 'Lang kolonne og lav strømning',
      exp: 'Lang kolonne og sakte bærerstrøm gir bedre separasjon.',
    },
    {
      q: 'Hvilken detektor brukes ofte i HPLC for UV-absorberende stoffer?',
      opts: ['Massespektrometer','NMR-detektor','UV-vis detektor','IR-detektor'],
      ans: 'UV-vis detektor',
      exp: 'UV-vis detektorer er vanlige i HPLC for stoffer som absorberer lys.',
    },
  ];
  const item = qList[Math.floor(Math.random()*qList.length)];
  return {
    question: item.q,
    type: 'mcq',
    options: item.opts,
    answer: item.ans,
    hint: 'Husk definisjon av R_f og kromatografiske parametre.',
    explanation: item.exp,
  };
}

function t_catalysis_mcq() {
  const qList = [
    {
      q: 'Hva gjør en katalysator med aktiveringsenergien i en reaksjon?',
      opts: ['Øker den','Senker den','Endrer ΔH','Stopper reaksjonen'],
      ans: 'Senker den',
      exp: 'Katalysatoren senker Eₐ ved å tilby en alternativ reaksjonsvei.',
    },
    {
      q: 'Hva skjer med likevekten når en katalysator tilsettes?',
      opts: ['Skifter mot produkter','Skifter mot reaktanter','Ingen endring','Likevekten opphører'],
      ans: 'Ingen endring',
      exp: 'Katalysatoren påvirker reaksjonshastigheter men ikke likevektskonstanten.',
    },
    {
      q: 'Hva gjør enzymene i kroppen?',
      opts: ['Øker ΔG','Stabiliserer overgangstilstanden','Forbrukes i reaksjonen','Øker aktiveringsenergien'],
      ans: 'Stabiliserer overgangstilstanden',
      exp: 'Enzymer er biologiske katalysatorer som senker Eₐ ved å stabilisere overgangstilstanden.',
    },
  ];
  const item = qList[Math.floor(Math.random()*qList.length)];
  return {
    question: item.q,
    type: 'mcq',
    options: item.opts,
    answer: item.ans,
    hint: 'Tenk på katalysatorens påvirkning av energiprofilen.',
    explanation: item.exp,
  };
}

// Build exam tasks
function buildExamTasks(num = 120) {
  const tasks = [];
  const categories = [t_buffer_basic, t_titration_weak_strong, t_precipitation, t_cell_potential, t_arrhenius, t_calorimetry, t_equilibrium, t_electrolysis, t_organic_mcq, t_ir_mcq, t_naming_mcq, t_chromatography_mcq, t_catalysis_mcq];
  let i = 0;
  while (tasks.length < num) {
    const task = categories[i % categories.length]();
    tasks.push(task);
    i++;
  }
  // Shuffle tasks
  return tasks.sort(() => Math.random() - 0.5);
}

export default function TitrationGame() {
  // State declarations
  const [acidKey, setAcidKey] = useState('CH3COOH');
  const [baseKey, setBaseKey] = useState('NaOH');
  const acid = ACIDS[acidKey];
  const base = BASES[baseKey];
  const [Ca, setCa] = useState(0.10);
  const [Cb, setCb] = useState(0.10);
  const [Va, setVa] = useState(0.025);
  const [Vb, setVb] = useState(0.00);
  const [indicatorKey, setIndicatorKey] = useState('Phenolphthalein');
  const indicator = INDICATORS[indicatorKey];
  const [difficulty, setDifficulty] = useState('Fri lek');
  const [view, setView] = useState('home');
  const [tasks, setTasks] = useState(() => buildExamTasks());
  const [taskIndex, setTaskIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [examScore, setExamScore] = useState(0);
  const [examFinished, setExamFinished] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [scoreHistory, setScoreHistory] = useState(() => {
    try {
      const raw = localStorage.getItem('scoreHistory');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try { localStorage.setItem('scoreHistory', JSON.stringify(scoreHistory)); } catch {};
  }, [scoreHistory]);
  const [message, setMessage] = useState('Velkommen til det magiske laboratoriet!');

  // Derived values
  const pH = useMemo(() => computePH(acid, base, Ca, Cb, Va, Vb), [acid, base, Ca, Cb, Va, Vb]);
  const equivalence = useMemo(() => {
    const nA = Ca * Va;
    if (Cb <= 0) return Infinity;
    return nA / Cb;
  }, [Ca, Va, Cb]);
  useEffect(() => {
    if (view !== 'titration') return;
    if (equivalence === Infinity) return;
    const diff = (Cb * Vb) - (Ca * Va);
    if (diff < 0) setMessage('Før ekvivalens: løsningen er sur (bufferområde).');
    else if (Math.abs(diff) < 1e-6) setMessage('Ekvivalenspunkt! Følg titreringskurven og indikatorvalget.');
    else setMessage('Etter ekvivalens: overskudd base gir basisk løsning.');
  }, [view, equivalence, Ca, Va, Cb, Vb]);

  const graphData = useMemo(() => {
    const pts = [];
    const steps = difficulty === 'Avansert' ? 200 : (difficulty === 'Middels' ? 120 : 80);
    const maxV = equivalence !== Infinity ? equivalence * 2 : (Vb > 0 ? Vb * 1.5 : 0.05);
    for (let i = 0; i <= steps; i++) {
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
    return interpolateColour(indicator.colours[0], indicator.colours[1], t);
  }, [indicator, pH]);

  const buretteLevel = useMemo(() => {
    const total = equivalence !== Infinity ? equivalence * 2 : (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
    if (total <= 0) return 0;
    return clamp((total - Vb) / total, 0, 1);
  }, [equivalence, Ca, Va, Cb, Vb]);
  const flaskLevel = useMemo(() => {
    const max = equivalence !== Infinity ? Va + equivalence * 2 : Va + (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
    return clamp((Va + Vb) / max, 0, 1);
  }, [Va, Vb, equivalence, Ca, Cb]);

  const difficulties = ['Fri lek','Middels','Avansert'];

  function addVolume(delta) {
    setVb(prev => {
      let next = prev + delta;
      if (equivalence !== Infinity) {
        const maxV = equivalence * 2;
        if (next > maxV) next = maxV;
      }
      return Math.max(0, next);
    });
  }
  function reset() { setVb(0); setMessage('Titreringen tilbakestilt.'); }
  function startExam() {
    const newTasks = buildExamTasks();
    setTasks(newTasks);
    setView('exam');
    setTaskIndex(0);
    setUserAnswer('');
    setExamScore(0);
    setExamFinished(false);
    setShowHint(false);
    setMessage('Eksamen startet!');
  }
  function submitAnswer() {
    const task = tasks[taskIndex];
    let correct = false;
    if (task.type === 'numeric') {
      const val = parseFloat(userAnswer);
      if (!isNaN(val)) correct = Math.abs(val - task.answer) <= task.tolerance;
    } else {
      correct = userAnswer === task.answer;
    }
    if (correct) setExamScore(prev => prev + 1);
    if (taskIndex < tasks.length - 1) {
      setTaskIndex(prev => prev + 1);
      setUserAnswer('');
      setShowHint(false);
    } else {
      setExamFinished(true);
      setView('results');
      const now = new Date().toLocaleString('nb-NO');
      setScoreHistory(prev => [...prev, { date: now, score: examScore + (correct ? 1 : 0), total: tasks.length }]);
    }
  }
  function toggleHint() { setShowHint(prev => !prev); }
  function goToSimulation() { setView('titration'); setShowHint(false); setUserAnswer(''); setMessage('Velkommen tilbake til titrering!'); }
  function goToHome() { setView('home'); setMessage('Velkommen til det magiske laboratoriet!'); }

  return (
    <div className="siu-root">
      <style>{`
        :root { --primary:#1C2E8C; --secondary:#19B6D4; --accent:#F4C95D; --lilac:#A78BFA; --mint:#8DE3C3; }
        .siu-root { min-height:100vh; display:flex; flex-direction:column; background: radial-gradient(circle at 30% 15%, #DFF7FF 0%, #EEF2FF 40%, #FFFFFF 75%), linear-gradient(135deg, rgba(25,182,212,0.12), rgba(244,201,93,0.12)); color:#0E153A; }
        .header { position:sticky; top:0; z-index:10; background: linear-gradient(90deg, var(--primary), var(--secondary)); color:#fff; padding:14px 22px; display:flex; justify-content:space-between; align-items:center; box-shadow: 0 6px 16px rgba(0,0,0,0.1); }
        .header .title { font-size:20px; font-weight:700; }
        .nav-buttons button { margin-left:10px; padding:8px 14px; border:none; border-radius:16px; background: linear-gradient(120deg, var(--accent), var(--lilac)); color:#1C2E8C; font-weight:600; cursor:pointer; box-shadow:0 6px 12px rgba(0,0,0,0.15); transition:transform .2s, box-shadow .2s; }
        .nav-buttons button:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 10px 20px rgba(0,0,0,0.2); }
        .nav-buttons button:disabled { opacity:0.6; cursor:default; }
        .main { flex:1; padding:18px 22px; display:grid; grid-gap:20px; }
        .panel { background:rgba(255,255,255,0.8); backdrop-filter:blur(8px); border-radius:18px; padding:16px 20px; box-shadow:0 8px 20px rgba(0,0,0,0.1); border:1px solid rgba(0,0,0,0.05); }
        .panel h2 { margin-top:0; margin-bottom:12px; font-size:18px; color:var(--primary); }
        .controls-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        label { display:flex; flex-direction:column; font-size:14px; color:var(--primary); }
        select, input { padding:6px 9px; border:1px solid #CED7E8; border-radius:10px; background:#F8FBFF; font-size:14px; color:var(--primary); }
        .primary { margin-top:8px; padding:8px 12px; border:none; border-radius:14px; background:linear-gradient(135deg, var(--secondary), var(--lilac)); color:#fff; font-weight:600; cursor:pointer; box-shadow:0 6px 16px rgba(0,0,0,0.15); transition:transform .2s; }
        .primary:hover { transform:translateY(-2px); box-shadow:0 10px 20px rgba(0,0,0,0.2); }
        .secondary { margin-top:8px; padding:8px 12px; border:none; border-radius:14px; background:linear-gradient(135deg, #FFFFFF, #F8FAFF); color:var(--primary); font-weight:600; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.1); transition:transform .2s; }
        .secondary:hover { transform:translateY(-2px); box-shadow:0 8px 16px rgba(0,0,0,0.15); }
        .graph { position:relative; height:260px; margin-top:8px; }
        .graph svg { width:100%; height:100%; display:block; }
        .progress-bar { height:8px; background:#E5EDFB; border-radius:4px; overflow:hidden; margin-bottom:8px; }
        .progress-bar-inner { height:100%; background:linear-gradient(90deg, var(--secondary), var(--accent)); }
        .scoreboard { max-height:200px; overflow-y:auto; font-size:13px; }
        .scoreboard table { width:100%; border-collapse:collapse; }
        .scoreboard th, .scoreboard td { padding:4px 6px; border-bottom:1px solid #E5EDFB; text-align:left; }
        .scoreboard tr:nth-child(even) { background:rgba(229,237,251,0.5); }
        .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px; font-size:13px; }
      `}</style>
      {/* HEADER */}
      <div className="header">
        <div className="title">SiU KjemiLab</div>
        <div className="nav-buttons">
          <button onClick={goToHome} disabled={view === 'home'}>Hjem</button>
          <button onClick={goToSimulation} disabled={view === 'titration'}>Titrering</button>
          <button onClick={startExam} disabled={view === 'exam' || view === 'results'}>Eksamen</button>
        </div>
      </div>
      {/* HOME */}
      {view === 'home' && (
        <div className="main" style={{ gridTemplateColumns:'1fr' }}>
          <div className="panel">
            <h2>Velkommen!</h2>
            <p>Utforsk titrering i et magisk laboratorium og forbered deg til Kjemi 2 med et omfattende utvalg av oppgaver. Designet er inspirert av eventyrlige farger og gir en hyggelig læringsopplevelse.</p>
            <button className="primary" onClick={goToSimulation}>Start titrering</button>
            <button className="secondary" onClick={startExam}>Ta eksamen</button>
          </div>
        </div>
      )}
      {/* TITRATION */}
      {view === 'titration' && (
        <div className="main" style={{ gridTemplateColumns:'1fr 1fr 1fr' }}>
          <div className="panel">
            <h2>Kontroller</h2>
            <div className="controls-grid">
              <label>Syre
                <select value={acidKey} onChange={e => setAcidKey(e.target.value)}>{Object.keys(ACIDS).map(k => <option key={k} value={k}>{ACIDS[k].name}</option>)}</select>
              </label>
              <label>Base
                <select value={baseKey} onChange={e => setBaseKey(e.target.value)}>{Object.keys(BASES).map(k => <option key={k} value={k}>{BASES[k].name}</option>)}</select>
              </label>
              <label>Ca (M)
                <input type="number" step="0.01" value={Ca} onChange={e => setCa(parseFloat(e.target.value) || 0)} />
              </label>
              <label>Cb (M)
                <input type="number" step="0.01" value={Cb} onChange={e => setCb(parseFloat(e.target.value) || 0)} />
              </label>
              <label>Va (L)
                <input type="number" step="0.005" value={Va} onChange={e => setVa(parseFloat(e.target.value) || 0)} />
              </label>
              <label>Vb (L)
                <input type="number" step="0.001" value={Vb} onChange={e => setVb(parseFloat(e.target.value) || 0)} />
              </label>
              <label>Indikator
                <select value={indicatorKey} onChange={e => setIndicatorKey(e.target.value)}>{Object.keys(INDICATORS).map(k => <option key={k} value={k}>{INDICATORS[k].name}</option>)}</select>
              </label>
              <label>Vanskelighetsgrad
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>{difficulties.map(l => <option key={l} value={l}>{l}</option>)}</select>
              </label>
            </div>
            <div style={{ marginTop:'8px', fontSize:'13px' }}>{message}</div>
            <div style={{ marginTop:'4px' }}>pH: {difficulty === 'Avansert' ? 'Skjult' : pH.toFixed(2)}</div>
            <div>V_eq: {equivalence === Infinity ? '-' : equivalence.toFixed(3)} L</div>
            <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
              <button className="primary" onClick={() => addVolume(0.0005)}>+0,5 mL</button>
              <button className="primary" onClick={() => addVolume(0.001)}>+1,0 mL</button>
              <button className="secondary" onClick={reset}>Tilbakestill</button>
            </div>
          </div>
          {/* Lab */}
          <div className="panel">
            <h2>Laboratorium</h2>
            <svg width="100%" height="260" viewBox="0 0 700 260" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#F1F5FF" stopOpacity="0.7" />
                  <stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="liquidGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#19B6D4" />
                  <stop offset="100%" stopColor="#A78BFA" />
                </linearGradient>
                <radialGradient id="meniscusGrad" cx="50%" cy="0%" r="50%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#94A3B8" stopOpacity="0.2" />
                </radialGradient>
              </defs>
              {/* Stand and shelf */}
              <rect x="20" y="10" width="12" height="220" fill="#475569" />
              <rect x="20" y="230" width="140" height="8" fill="#334155" rx="3" />
              {/* Burette */}
              <g transform="translate(60,20)">
                <rect x="0" y="0" width="24" height="200" fill="url(#glassGrad)" stroke="#94A3B8" strokeWidth="1" rx="7" />
                {Array.from({ length: 21 }).map((_, i) => {
                  const y = i * 10;
                  return (
                    <line key={i} x1="0" x2={i % 5 === 0 ? -10 : -6} y1={y} y2={y} stroke="#475569" strokeWidth={i % 5 === 0 ? 2 : 1} />
                  );
                })}
                <rect x="2" y={200 * (1 - buretteLevel)} width="20" height={200 * buretteLevel} fill={pHColour(pH)} opacity="0.6" />
                <ellipse cx="12" cy={200 * (1 - buretteLevel)} rx="11" ry="4" fill="url(#meniscusGrad)" opacity="0.9" />
                <rect x="22" y="200" width="12" height="14" fill="#94A3B8" rx="3" />
                <rect x="34" y="212" width="40" height="8" fill="#94A3B8" rx="4" />
              </g>
              {Vb > 0 && (
                <circle cx="120" cy="230" r="5" fill={pHColour(pH)}>
                  <animate attributeName="cy" values="220; 230; 220" dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <g transform="translate(300,100)">
                <path d="M60,0 L100,0 L112,90 C116,120 -4,120 0,90 Z" fill="url(#glassGrad)" stroke="#94A3B8" strokeWidth="1" />
                <rect x="70" y="-38" width="20" height="40" fill="url(#glassGrad)" stroke="#94A3B8" strokeWidth="1" rx="5" />
                {(() => {
                  const h = Math.max(1, 70 * flaskLevel);
                  return (
                    <g>
                      <path d={`M12,90 C14,${90 - h} 98,${90 - h} 100,90 Z`} fill="url(#liquidGrad)" opacity="0.5" />
                      <path d={`M14,${90 - h} Q56,${90 - h - 5} 96,${90 - h}`} stroke="#19B6D4" strokeWidth="2" fill="none" />
                    </g>
                  );
                })()}
                <path d="M12,90 C14,50 98,50 100,90 Z" fill={indicatorColour} opacity="0.25" />
                {Array.from({ length: 14 }).map((_, i) => {
                  const cx = 20 + Math.random() * 80;
                  const cy = 70 + Math.random() * 20;
                  const r = 2 + Math.random() * 3;
                  const dur = (4 + Math.random() * 4).toFixed(2) + 's';
                  const delay = (Math.random() * 2).toFixed(2) + 's';
                  return (
                    <circle key={i} cx={cx} cy={cy} r={r} fill="rgba(255,255,255,0.85)">
                      <animate attributeName="cy" values={`${cy}; ${cy - 30}; ${cy}`} dur={dur} repeatCount="indefinite" begin={delay} />
                    </circle>
                  );
                })}
              </g>
              <rect x="0" y="248" width="700" height="12" fill="#C3D5E4" />
            </svg>
            <div className="graph">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="10" y1="5" x2="10" y2="90" stroke="#334155" strokeWidth="0.6" />
                <line x1="10" y1="90" x2="95" y2="90" stroke="#334155" strokeWidth="0.6" />
                {Array.from({ length: 8 }).map((_, i) => {
                  const p = i * 2;
                  const y = 90 - (p / 14) * 85;
                  return (
                    <g key={i}>
                      <line x1="9" x2="10" y1={y} y2={y} stroke="#334155" strokeWidth="0.6" />
                      <text x="6" y={y + 2.2} fontSize="3" textAnchor="end" fill="#475569">{p}</text>
                      <line x1="10" x2="95" y1={y} y2={y} stroke="#E5EDFB" strokeWidth="0.3" />
                    </g>
                  );
                })}
                {(() => {
                  const maxX = graphData[graphData.length - 1]?.x || 1;
                  const eq = equivalence === Infinity ? 0 : equivalence;
                  const xs = [0, maxX * 0.25, eq, maxX * 0.75, maxX];
                  return xs.map((vx, i) => {
                    const x = 10 + (vx / maxX) * 85;
                    const label = i === 2 ? 'V_eq' : vx.toFixed(3);
                    return (
                      <g key={i}>
                        <line x1={x} x2={x} y1="90" y2="91" stroke="#334155" strokeWidth="0.6" />
                        <text x={x} y="96" fontSize="3" textAnchor="middle" fill="#475569">{label}</text>
                        <line x1={x} x2={x} y1="10" y2="90" stroke="#E5EDFB" strokeWidth="0.3" />
                      </g>
                    );
                  });
                })()}
                {graphData.map((pt, idx) => {
                  if (idx === 0) return null;
                  const prev = graphData[idx - 1];
                  const maxX = graphData[graphData.length - 1]?.x || 1;
                  const x1 = 10 + (prev.x / maxX) * 85;
                  const y1 = 90 - (prev.y / 14) * 85;
                  const x2 = 10 + (pt.x / maxX) * 85;
                  const y2 = 90 - (pt.y / 14) * 85;
                  return <line key={idx} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1C2E8C" strokeWidth="0.8" />;
                })}
                {(() => {
                  const maxX = graphData[graphData.length - 1]?.x || 1;
                  const x = 10 + (Vb / maxX) * 85;
                  const y = 90 - (pH / 14) * 85;
                  return <circle cx={x} cy={y} r="1.5" fill="#E83E8C" />;
                })()}
                <text x="4" y="4" fontSize="3" fill="#475569" transform="rotate(-90,4,4)">pH</text>
                <text x="52" y="99" fontSize="3" fill="#475569">V_base (L)</text>
              </svg>
            </div>
          </div>
          <div className="panel">
            <h2>Informasjon</h2>
            <div className="info-grid">
              <div>
                <strong>Indikator</strong>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'6px' }}>
                  <svg width="120" height="20">
                    <defs>
                      <linearGradient id="indiGrad" x1="0" x2="1">
                        <stop offset="0%" stopColor={INDICATORS[indicatorKey].colours[0]} />
                        <stop offset="100%" stopColor={INDICATORS[indicatorKey].colours[1]} />
                      </linearGradient>
                    </defs>
                    <rect x="0" y="0" width="120" height="20" rx="6" fill="url(#indiGrad)" stroke="#E5EDFB" />
                  </svg>
                  <div style={{ width:'20px', height:'20px', borderRadius:'6px', background: indicatorColour, border:'1px solid #E5EDFB' }}></div>
                </div>
                <div style={{ marginTop:'4px' }}>
                  <div><b>{INDICATORS[indicatorKey].name}</b></div>
                  <div>pH-område: {INDICATORS[indicatorKey].range[0]}–{INDICATORS[indicatorKey].range[1]}</div>
                  <div>Bruk: {INDICATORS[indicatorKey].use}</div>
                </div>
              </div>
              <div>
                <strong>Kjemi</strong>
                <div style={{ marginTop:'4px' }}>
                  <div><b>Syre:</b> {acid.name}</div>
                  <div>Type: {acid.strong ? 'Sterk' : 'Svak'} {acid.Ka !== Infinity ? `(Kₐ=${acid.Ka})` : ''}</div>
                  <div>Info: {acid.info}</div>
                  <div style={{ marginTop:'8px' }}><b>Base:</b> {base.name}</div>
                  <div>Type: {base.strong ? 'Sterk' : 'Svak'} {base.Kb !== Infinity ? `(K_b=${base.Kb})` : ''}</div>
                  <div>Info: {base.info}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* EXAM */}
      {view === 'exam' && (
        <div className="main" style={{ gridTemplateColumns:'1fr' }}>
          <div className="panel">
            <h2>Eksamen</h2>
            <div className="progress-bar"><div className="progress-bar-inner" style={{ width: ((taskIndex) / tasks.length) * 100 + '%' }}></div></div>
            <p>Oppgave {taskIndex + 1} av {tasks.length}</p>
            <p style={{ whiteSpace:'pre-wrap' }}>{tasks[taskIndex].question}</p>
            {tasks[taskIndex].type === 'numeric' ? (
              <input type="number" value={userAnswer} onChange={e => setUserAnswer(e.target.value)} />
            ) : (
              <div>{tasks[taskIndex].options.map(opt => (
                <label key={opt} style={{ display:'block', marginTop:'4px' }}>
                  <input type="radio" name="option" value={opt} checked={userAnswer === opt} onChange={e => setUserAnswer(e.target.value)} /> {opt}
                </label>
              ))}</div>
            )}
            {showHint && <p style={{ fontStyle:'italic', background:'#F8FBFF', padding:'6px', borderRadius:'8px', border:'1px dashed #D3DFF5' }}><strong>Hint:</strong> {tasks[taskIndex].hint}</p>}
            <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
              <button className="secondary" onClick={toggleHint}>{showHint ? 'Skjul hint' : 'Vis hint'}</button>
              <button className="primary" onClick={submitAnswer}>{taskIndex === tasks.length - 1 ? 'Fullfør' : 'Neste'}</button>
              <button className="secondary" onClick={goToSimulation}>Avbryt</button>
            </div>
          </div>
        </div>
      )}
      {/* RESULTS */}
      {view === 'results' && (
        <div className="main" style={{ gridTemplateColumns:'1fr' }}>
          <div className="panel">
            <h2>Resultater</h2>
            <p>Du fikk <b>{examScore}</b> av <b>{tasks.length}</b> riktige!</p>
            <div className="scoreboard">
              <table><thead><tr><th>Dato</th><th>Riktige</th><th>Totalt</th></tr></thead><tbody>{scoreHistory.map((row, idx) => (<tr key={idx}><td>{row.date}</td><td>{row.score}</td><td>{row.total}</td></tr>))}</tbody></table>
            </div>
            <h3>Forklaringer</h3>
            <ol style={{ paddingLeft:'16px' }}>{tasks.map((task,i) => (
              <li key={i} style={{ marginBottom:'8px' }}>
                <strong>{task.question.split('
')[0]}</strong><br />
                <em>Riktig svar:</em> {typeof task.answer === 'number' ? task.answer : task.answer.toString()}<br />
                <em>Forklaring:</em> {task.explanation}
              </li>
            ))}</ol>
            <div style={{ display:'flex', gap:'8px', marginTop:'8px' }}>
              <button className="primary" onClick={startExam}>Prøv igjen</button>
              <button className="secondary" onClick={goToSimulation}>Tilbake til titrering</button>
              <button className="secondary" onClick={goToHome}>Hjem</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
