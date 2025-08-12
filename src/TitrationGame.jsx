import React, { useState, useEffect, useMemo } from 'react';

// ---------------------------------------------------------------
// TitrationGameStep2
//
// This component implements Step 2 of the SiU Lab titration project.  It
// combines the improved laboratory illustration from Step 1 with a new
// titration‑based exam engine.  Students must perform complete
// acid–base titrations by selecting the correct reagents and volumes and
// reading the equivalence point off the curve.  Each task has hints and
// solutions, and the engine tracks progress through multiple tasks with
// navigation controls.

// Acid/base/indicator definitions (monoprotic assumption).  Colours are
// for display only.
const ACIDS = {
  HCl: { name: 'HCl (saltsyre)', Ka: Infinity, strong: true, info: 'Sterk syre', colour: '#3461FF' },
  HNO3: { name: 'HNO₃ (salpetersyre)', Ka: Infinity, strong: true, info: 'Sterk syre', colour: '#2B7DFB' },
  CH3COOH: { name: 'CH₃COOH (eddiksyre)', Ka: 1.8e-5, strong: false, info: 'Svak syre', colour: '#9EC5FF' },
  HCOOH: { name: 'HCOOH (maursyre)', Ka: 1.77e-4, strong: false, info: 'Svak syre', colour: '#7FB0FF' },
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

// pH calculation helper.  Supports strong/strong, weak/strong, strong/weak and
// weak/weak (approx.) titrations.  Va and Vb in litres.
function computePH(acid, base, Ca, Va, Cb, Vb) {
  const nA = Ca * Va;
  const nB = Cb * Vb;
  const Vt = Va + Vb;
  if (Vt <= 0 || !isFinite(Vt)) return 7;
  // strong/strong
  if (acid.Ka === Infinity && base.Kb === Infinity) {
    const diff = nA - nB;
    if (Math.abs(diff) < 1e-12) return 7;
    if (diff > 0) return -Math.log10(diff / Vt);
    return 14 + Math.log10((-diff) / Vt);
  }
  // weak acid + strong base
  if (acid.Ka !== Infinity && base.Kb === Infinity) {
    const Ka = acid.Ka;
    if (nB < nA) {
      const nHA = nA - nB;
      const nAminus = nB;
      return -Math.log10(Ka) + Math.log10(nAminus / nHA);
    }
    if (Math.abs(nB - nA) < 1e-12) {
      const Kb = 1e-14 / Ka;
      const Csalt = nA / Vt;
      const OH = Math.sqrt(Kb * Csalt);
      return 14 + Math.log10(OH);
    }
    return 14 + Math.log10((nB - nA) / Vt);
  }
  // strong acid + weak base
  if (acid.Ka === Infinity && base.Kb !== Infinity) {
    const Kb = base.Kb;
    if (nA < nB) {
      const nBfree = nB - nA;
      const nBHplus = nA;
      const pOH = -Math.log10(Kb) + Math.log10(nBHplus / nBfree);
      return 14 - pOH;
    }
    if (Math.abs(nA - nB) < 1e-12) {
      const Ka = 1e-14 / Kb;
      const Csalt = nB / Vt;
      const H = Math.sqrt(Ka * Csalt);
      return -Math.log10(H);
    }
    return -Math.log10((nA - nB) / Vt);
  }
  // weak/weak (approx.)
  const pKa = -Math.log10(acid.Ka);
  const pKb = -Math.log10(base.Kb);
  if (Math.abs(nA - nB) < 1e-12) return 7 + 0.5 * (pKa - pKb);
  if (nB < nA) return -Math.log10(acid.Ka) + Math.log10(nB / (nA - nB));
  return 14 - (-Math.log10(base.Kb) + Math.log10(nA / (nB - nA)));
}

// Colour interpolation helper for indicator colours.  Accepts hex strings.
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

// Interactive titration tasks.  Each task defines reagents, volumes and
// indicator.  Students must adjust the simulation to match these
// parameters and then verify their result.  Hints and solutions are
// provided for each task.
const TITRATION_TASKS = [
  {
    type: 'titration',
    question: 'Titrer 25,0 mL av en 0,10 M HCl‑løsning med 0,10 M NaOH til ekvivalens. Velg riktig indikator.',
    acid: 'HCl',
    base: 'NaOH',
    Ca: 0.10,
    Cb: 0.10,
    Va: 0.025,
    expectedVolume: 0.025,
    indicator: 'BromothymolBlue',
    hint: 'Sterk syre titrert med sterk base gir pH \u2248 7 ved ekvivalens. Velg en indikator som skifter rundt pH 7.',
    solution:
      'For en sterk syre som HCl og en sterk base som NaOH er pH ved ekvivalens 7. Støkiometrien gir V_b = (C_a * V_a) / C_b = (0,10 * 0,025) / 0,10 = 0,025 L. Bromtymolblått passer fordi den skifter rundt pH 7.',
  },
  {
    type: 'titration',
    question: 'Titrer 30,0 mL av en 0,10 M eddiksyre (CH₃COOH) med 0,10 M NaOH til ekvivalens. Velg riktig indikator.',
    acid: 'CH3COOH',
    base: 'NaOH',
    Ca: 0.10,
    Cb: 0.10,
    Va: 0.030,
    expectedVolume: 0.030,
    indicator: 'Phenolphthalein',
    hint: 'Svak syre titrert med sterk base gir pH > 7 ved ekvivalens. Fenolftalein skifter i basisk område.',
    solution:
      'Ved ekvivalens: V_b = (0,10 * 0,030) / 0,10 = 0,030 L. Siden CH₃COOH er en svak syre vil pH ved ekvivalens være > 7, og fenolftalein (pH 8,2–10) er passende.',
  },
  {
    type: 'titration',
    question: 'Titrer 20,0 mL av en 0,10 M HCl‑løsning med 0,10 M NH₃ til ekvivalens. Velg riktig indikator.',
    acid: 'HCl',
    base: 'NH3',
    Ca: 0.10,
    Cb: 0.10,
    Va: 0.020,
    expectedVolume: 0.020,
    indicator: 'MethylOrange',
    hint: 'Sterk syre titrert med svak base gir pH < 7 ved ekvivalens. Metyloransje skifter i surt område.',
    solution:
      'Ved ekvivalens: V_b = (0,10 * 0,020) / 0,10 = 0,020 L. HCl er sterk syre, NH₃ svak base: pH ved ekvivalens blir sur (<7). Metyloransje (pH 3,1–4,4) er egnet.',
  },
  {
    type: 'titration',
    question: 'Titrer 40,0 mL av en 0,10 M maursyre (HCOOH) med 0,10 M NaOH til ekvivalens. Velg riktig indikator.',
    acid: 'HCOOH',
    base: 'NaOH',
    Ca: 0.10,
    Cb: 0.10,
    Va: 0.040,
    expectedVolume: 0.040,
    indicator: 'Phenolphthalein',
    hint: 'Svak syre mot sterk base gir pH > 7 ved ekvivalens. Velg indikator som skifter i basisk område.',
    solution:
      'V_b = (0,10 * 0,040) / 0,10 = 0,040 L. Maursyre er svak syre ⇒ pH ved ekvivalens > 7. Fenolftalein (pH 8,2–10) er passende.',
  },
];

// A few general Kjemi 2 exam tasks (numeric and MCQ) to augment titration tasks.
const GENERAL_TASKS = [
  {
    type: 'numeric',
    question: 'Beregn pH for en buffer som inneholder 0,15 M CH₃COOH og 0,10 M CH₃COONa. (pKa(CH₃COOH) = 4,76)',
    answer: 4.62,
    tolerance: 0.05,
    hint: 'Bruk Henderson–Hasselbalch: pH = pKa + log([A⁻]/[HA]).',
    solution: 'pH = 4,76 + log(0,10/0,15) = 4,76 + log(0,667) = 4,62.',
  },
  {
    type: 'mcq',
    question: 'Hvilket utsagn beskriver best en katalysator?',
    options: ['Øker aktiveringsenergien', 'Senker aktiveringsenergien', 'Endrer reaksjonens ΔH', 'Forbrukes i reaksjonen'],
    answer: 1,
    hint: 'En katalysator påvirker energi‑barrieren, ikke ΔH.',
    solution: 'En katalysator senker aktiveringsenergien ved å tilby en alternativ reaksjonsvei og forbrukes ikke.',
  },
  {
    type: 'numeric',
    question: 'For en galvanisk celle med halvreaksjoner Zn²⁺/Zn (E° = −0,76 V) og Cu²⁺/Cu (E° = +0,34 V). Beregn E° for cellen.',
    answer: 1.10,
    tolerance: 0.05,
    hint: 'E°_celle = E°_katode − E°_anode. Den mest positive halvreaksjonen er katode.',
    solution: 'E° = 0,34 − (−0,76) = +1,10 V.',
  },
  {
    type: 'mcq',
    question: 'Hva kjennetegner en SN1‑reaksjon i organisk kjemi?',
    options: [
      'Mekanismer der nukleofilen angriper fra motsatt side og danner et enkelt produkt',
      'To‑trinns mekanisme med en karbokation mellomtilstand',
      'Mekanisme der to molekyler reagerer i ett steg (konsertert)',
      'Kjedereaksjon der radikaler dannes',
    ],
    answer: 1,
    hint: 'SN1‑reaksjonen inkluderer et karbokation mellomtrinn og ratebestemmende første steg.',
    solution: 'SN1: to trinn – først heterolytisk dissosiasjon til et karbokation (langsommest), deretter nukleofilt angrep.',
  },
];

// Step 3: Additional titration tasks to expand the exam bank.  Each task requires
// the student to perform a complete titration with correct reagents, volumes and indicator.
const ADDITIONAL_TITRATION_TASKS = [
  {
    type: 'titration',
    question: 'Titrer 25,0 mL av en 0,10 M HNO₃‑løsning med 0,10 M KOH til ekvivalens. Velg riktig indikator.',
    acid: 'HNO3',
    base: 'KOH',
    Ca: 0.10,
    Cb: 0.10,
    Va: 0.025,
    expectedVolume: 0.025,
    indicator: 'BromothymolBlue',
    hint: 'Sterk syre mot sterk base gir pH cirka 7 ved ekvivalens. Bromtymolblått skifter rundt pH 7.',
    solution:
      'HNO₃ er en sterk syre og KOH en sterk base. Ekvivalenspunktet nås når n(H⁺) = n(OH⁻): V_b = (C_a·V_a)/C_b = (0,10·0,025)/0,10 = 0,025 L. Ekvivalens pH ≈ 7, så Bromtymolblått (pH 6,0–7,6) er passende.',
  },
  {
    type: 'titration',
    question: 'Titrer 15,0 mL av en 0,05 M CH₃COOH‑løsning med 0,10 M NaOH til ekvivalens. Velg riktig indikator.',
    acid: 'CH3COOH',
    base: 'NaOH',
    Ca: 0.05,
    Cb: 0.10,
    Va: 0.015,
    expectedVolume: 0.0075,
    indicator: 'Phenolphthalein',
    hint: 'Svak syre titrert med sterk base gir pH over 7 ved ekvivalens. Fenolftalein skifter i basisk område.',
    solution:
      'Antall mol syre: 0,05·0,015 = 7,5·10⁻⁴ mol. Med 0,10 M NaOH kreves V_b = n/C_b = 7,5·10⁻⁴/0,10 = 7,5·10⁻³ L = 0,0075 L. Ved ekvivalens er pH > 7, så fenolftalein (pH 8,2–10) er riktig.',
  },
  {
    type: 'titration',
    question: 'Titrer 50,0 mL av en 0,08 M maursyre (HCOOH) med 0,12 M NaOH til ekvivalens. Velg riktig indikator.',
    acid: 'HCOOH',
    base: 'NaOH',
    Ca: 0.08,
    Cb: 0.12,
    Va: 0.050,
    expectedVolume: 0.0333,
    indicator: 'Phenolphthalein',
    hint: 'Svak syre titrert med sterk base gir basisk løsning ved ekvivalens. Indikator bør skifte over 8.',
    solution:
      'Mol syre = 0,08·0,050 = 4,0·10⁻³ mol. Med 0,12 M base: V_b = n/C_b = 4,0·10⁻³/0,12 = 0,0333 L. Ekvivalens pH > 7 fordi HCOOH er svak syre. Fenolftalein (pH 8,2–10) er egnet.',
  },
  {
    type: 'titration',
    question: 'Titrer 30,0 mL av en 0,10 M HCl‑løsning med 0,05 M NH₃ til ekvivalens. Velg riktig indikator.',
    acid: 'HCl',
    base: 'NH3',
    Ca: 0.10,
    Cb: 0.05,
    Va: 0.030,
    expectedVolume: 0.060,
    indicator: 'MethylOrange',
    hint: 'Sterk syre mot svak base gir surt ekvivalenspunkt (pH < 7). Velg en indikator som skifter i surt område.',
    solution:
      'Mol HCl = 0,10·0,030 = 3,0·10⁻³ mol. Med 0,05 M NH₃ kreves V_b = n/C_b = 3,0·10⁻³/0,05 = 0,060 L. EkvivalenspH < 7 (sterk syre + svak base), så metyloransje (pH 3,1–4,4) er best.',
  },
  {
    type: 'titration',
    question: 'Titrer 20,0 mL av en 0,12 M HCN‑løsning med 0,10 M NaOH til ekvivalens. Velg riktig indikator.',
    acid: 'HCN',
    base: 'NaOH',
    Ca: 0.12,
    Cb: 0.10,
    Va: 0.020,
    expectedVolume: 0.024,
    indicator: 'Phenolphthalein',
    hint: 'HCN er svært svak syre; ekvivalenspunktet vil være sterkt basisk (pH høyt). Trenger indikator som skifter ved høy pH.',
    solution:
      'Mol HCN = 0,12·0,020 = 2,4·10⁻³ mol. Med 0,10 M NaOH kreves V_b = n/C_b = 2,4·10⁻³/0,10 = 0,024 L. Ettersom HCN er en ekstremt svak syre, blir pH ved ekvivalens høyt (≈ 11), så fenolftalein er egnet.',
  },
  {
    type: 'titration',
    question: 'Titrer 10,0 mL av en 0,10 M CH₃COOH med 0,05 M KOH til ekvivalens. Velg riktig indikator.',
    acid: 'CH3COOH',
    base: 'KOH',
    Ca: 0.10,
    Cb: 0.05,
    Va: 0.010,
    expectedVolume: 0.020,
    indicator: 'Phenolphthalein',
    hint: 'Svak syre mot sterk base gir pH > 7 ved ekvivalens.',
    solution:
      'Mol CH₃COOH = 0,10·0,010 = 1,0·10⁻³ mol. Med 0,05 M KOH: V_b = n/C_b = 1,0·10⁻³/0,05 = 0,020 L. Ved ekvivalens er løsningen basisk; fenolftalein passer best.',
  },
];

// Step 3: Additional general Kjemi 2 tasks.  These cover a broad range of topics:
// acid–base, equilibrium, solubility, kinetics, thermodynamics and organic chemistry.
const ADDITIONAL_GENERAL_TASKS = [
  {
    type: 'numeric',
    question: 'Beregn pH for en 0,010 M HCl‑løsning.',
    answer: 2.00,
    tolerance: 0.05,
    hint: 'For sterk syre: [H⁺] = C. pH = −log([H⁺]).',
    solution: '0,010 M HCl gir [H⁺] = 0,010 M. pH = −log(0,010) = 2,00.',
  },
  {
    type: 'numeric',
    question: 'Beregn pH for 0,20 M NH₃ (Kb = 1,8×10⁻⁵).',
    answer: 11.28,
    tolerance: 0.05,
    hint: 'Svak base: bruk K_b = x²/(C − x); antatt x ≪ C.',
    solution: 'x = √(K_b·C) = √(1,8·10⁻⁵·0,20) = 0,00166 M. pOH = −log(0,00166) = 2,78 → pH = 14 − 2,78 = 11,22 (≈ 11,28).',
  },
  {
    type: 'numeric',
    question: 'Hvilket forhold [A⁻]/[HA] trengs for at en CH₃COOH/CH₃COONa‑buffer skal ha pH = 5,00? pKₐ(CH₃COOH) = 4,76.',
    answer: 1.74,
    tolerance: 0.10,
    hint: 'Henderson–Hasselbalch: pH = pKₐ + log([base]/[syre]).',
    solution: 'pH − pKₐ = log([base]/[syre]) → 5,00 − 4,76 = log(R). R = 10^(0,24) ≈ 1,74.',
  },
  {
    type: 'numeric',
    question: 'Løselighetsproduktet for CaF₂ er K_sp = 3,9×10⁻¹¹. Beregn løseligheten (s) av Ca²⁺ i ren løsning (M).',
    answer: 0.00021,
    tolerance: 0.00005,
    hint: 'K_sp = 4·s³ for CaF₂: CaF₂(s) ⇌ Ca²⁺ + 2 F⁻.',
    solution: 'K_sp = 4s³ → s = (K_sp/4)^(1/3) = (3,9×10⁻¹¹/4)^(1/3) ≈ 2,14×10⁻⁴ M.',
  },
  {
    type: 'numeric',
    question: 'Beregn standard cellepotensial for galvanisk celle Fe³⁺/Fe²⁺ (E° = +0,77 V) og Zn²⁺/Zn (E° = –0,76 V).',
    answer: 1.53,
    tolerance: 0.05,
    hint: 'E°_celle = E°_katode – E°_anode. Velg mer positiv som katode.',
    solution: 'E° = 0,77 – (–0,76) = 1,53 V.',
  },
  {
    type: 'numeric',
    question: 'For en reaksjon er k₁ = 0,015 s⁻¹ ved 298 K og k₂ = 0,045 s⁻¹ ved 308 K. Beregn aktiveringsenergien Eₐ (kJ/mol).',
    answer: 83.8,
    tolerance: 1.0,
    hint: 'Arrhenius: ln(k₂/k₁) = Eₐ/R·(1/T₁ − 1/T₂).',
    solution: 'ln(0,045/0,015) = Eₐ/8,314·(1/298 − 1/308). Løs for Eₐ: ≈ 83,8 kJ/mol.',
  },
  {
    type: 'numeric',
    question: 'En førsteordensreaksjon har ratekonstant k = 0,050 s⁻¹. Beregn halveringstiden t½ (s).',
    answer: 13.86,
    tolerance: 0.5,
    hint: 'For førsteorden: t½ = ln 2 / k.',
    solution: 't½ = ln(2)/0,050 ≈ 13,86 s.',
  },
  {
    type: 'mcq',
    question: 'Hva er pKₐ for en syre med Kₐ = 1,0×10⁻³?',
    options: ['1', '2', '3', '4'],
    answer: 3,
    hint: 'pKₐ = −log₁₀(Kₐ).',
    solution: 'pKₐ = −log₁₀(1,0×10⁻³) = 3.',
  },
  {
    type: 'mcq',
    question: 'Blandes 0,050 L av 0,10 M AgNO₃ med 0,050 L av 0,10 M NaCl. Vil det danne bunnfall? (K_sp(AgCl) = 1,8×10⁻¹⁰).',
    options: ['Ja', 'Nei'],
    answer: 0,
    hint: 'Beregn Q = [Ag⁺][Cl⁻] etter fortynning og sammenlign med K_sp.',
    solution: '[Ag⁺] = [Cl⁻] = (0,10·0,050)/(0,100) = 0,05 M. Q = 0,05² = 2,5×10⁻³ ≫ 1,8×10⁻¹⁰ ⇒ bunnfall dannes.',
  },
  {
    type: 'mcq',
    question: 'Hva beskriver best reaksjonsmekanismen for SN2?',
    options: [
      'Molekylær eliminasjon med to steg',
      'En‑trinns nukleofilt angrep fra motsatt side',
      'Radikal substitusjon',
      'Dannelse av karbokation mellomprodukt',
    ],
    answer: 1,
    hint: 'SN2 skjer i ett steg og gir inversjon av konfigurasjon.',
    solution: 'SN2 : en trinn, baksiden angrep, overgangstilstand, gir ofte inversjon av kiralt senter.',
  },
  {
    type: 'numeric',
    question: 'Beregn ΔG° (kJ) for en reaksjon med ΔH° = −125 kJ/mol og ΔS° = −150 J/(mol·K) ved 298 K.',
    answer: -80.3,
    tolerance: 2.0,
    hint: 'ΔG° = ΔH° − T·ΔS°. Husk å konvertere J til kJ.',
    solution: 'ΔG° = −125 kJ − 298·(−0,150 kJ/K) = −125 kJ + 44,7 kJ = −80,3 kJ.',
  },
  {
    type: 'numeric',
    question: 'Hvilket volum 0,10 M NaOH trengs for å titrere 0,025 L av en 0,12 M HCl fullstendig?',
    answer: 0.03,
    tolerance: 0.001,
    hint: 'n(HCl) = C·V. V_b = n/C_b.',
    solution: 'n(HCl) = 0,12·0,025 = 0,0030 mol. Med 0,10 M NaOH: V_b = 0,0030/0,10 = 0,030 L.',
  },
  {
    type: 'numeric',
    question: 'Beregn pH i ekvivalenspunket når 0,050 M CH₃COOH titreres med 0,050 M NaOH (pKₐ = 4,76).',
    answer: 8.90,
    tolerance: 0.10,
    hint: 'Ved ekvivalens: løsningen består av CH₃COO⁻. Bruk K_b = K_w/Kₐ.',
    solution: 'K_b = 10⁻¹⁴/10⁻⁴,⁷⁶ ≈ 5,75×10⁻¹⁰. [A⁻] = C = 0,050 M. [OH⁻] = √(K_b·C) ≈ √(5,75×10⁻¹⁰·0,050) = 5,36×10⁻⁶ M. pOH = 5,27 → pH = 8,90.',
  },
  {
    type: 'numeric',
    question: 'En løsning av Fe³⁺ har initialt [Fe³⁺]₀ = 0,20 M. Ved likevekt for Fe³⁺ + SCN⁻ ⇌ FeSCN²⁺ er [SCN⁻] = 0,15 M og [FeSCN²⁺] = 0,05 M. Beregn K_c.',
    answer: 1.67,
    tolerance: 0.05,
    hint: 'K_c = [FeSCN²⁺]/([Fe³⁺][SCN⁻]).',
    solution: '[Fe³⁺]_eq = 0,20 − 0,05 = 0,15 M. K_c = 0,05/(0,15·0,15) = 1,67.',
  },
  {
    type: 'mcq',
    question: 'Hvilken analysemetode er mest egnet for å separere og identifisere organiske komponenter i en blanding?',
    options: ['NMR-spektroskopi', 'TLC (tynnsjiktskromatografi)', 'UV–vis absorpsjon', 'Flamfotometri'],
    answer: 1,
    hint: 'TLC er en enkel og rask separasjonsmetode for organisk materiale.',
    solution: 'TLC brukes til å separere komponenter basert på polaritet. NMR gir struktur men ikke separasjon.',
  },
  {
    type: 'mcq',
    question: 'Hva er hovedproduktet når en tertiær alkohol dehydreres med syre?',
    options: ['Eter', 'Alken', 'Alkan', 'Ketol'],
    answer: 1,
    hint: 'Dehydrering av alkoholer gir ofte dobbeltbinding.',
    solution: 'Syrekatalysert eliminering av vann fra tertiær alkohol gir alken (E1‑mekanisme).',
  },
  {
    type: 'numeric',
    question: 'En reaksjon følger hastighetsloven v = k[A][B]². Hvis [A] dobles og [B] halveres, hvordan endres reaksjonshastigheten?',
    answer: 0.5,
    tolerance: 0.05,
    hint: 'v₂/v₁ = (k·(2[A])·(0,5[B])²)/(k·[A]·[B]²).',
    solution: 'v₂/v₁ = (2·(0,5)²)/(1·1²) = 2·0,25 = 0,5. Hastigheten halveres.',
  },
  {
    type: 'mcq',
    question: 'Hva er hovedårsaken til at K_sp for BaSO₄ er svært lav (1,1×10⁻¹⁰)?',
    options: ['Sterke ion–dipol‑krefter i vann', 'Høy lattice‑energi', 'Lav hydratiseringsenergi', 'Sterk oksidasjon'],
    answer: 1,
    hint: 'Lav løselighet skyldes stabilt krystallgitter.',
    solution: 'Lattice‑energien i BaSO₄ er høy, så det er energikrevende å løse opp ionene.',
  },
];

// Combine all exam tasks and shuffle them for variety.  We don't shuffle
// TITRATION_TASKS alone to preserve the order for demonstration, but we
// append the general tasks randomly.
function buildAllTasks() {
  const combined = [
    ...TITRATION_TASKS,
    ...ADDITIONAL_TITRATION_TASKS,
    ...GENERAL_TASKS,
    ...ADDITIONAL_GENERAL_TASKS,
  ];
  return combined.sort(() => Math.random() - 0.5);
}

export default function TitrationGame() {
  // View management: home, titration, exam, results
  const [view, setView] = useState('home');

  // Simulation state
  const [acidKey, setAcidKey] = useState('HCl');
  const [baseKey, setBaseKey] = useState('NaOH');
  const [Ca, setCa] = useState(0.10);
  const [Cb, setCb] = useState(0.10);
  const [Va, setVa] = useState(0.025);
  const [Vb, setVb] = useState(0);
  const [indicatorKey, setIndicatorKey] = useState('Phenolphthalein');

  const acid = ACIDS[acidKey];
  const base = BASES[baseKey];
  const indicator = INDICATORS[indicatorKey];

  // Exam state
  const [tasks, setTasks] = useState(() => buildAllTasks());
  const [taskIndex, setTaskIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [examScore, setExamScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [interactiveFeedback, setInteractiveFeedback] = useState('');

  // Helper: calculate equivalence volume (L)
  const equivalence = useMemo(() => {
    return Cb > 0 ? (Ca * Va) / Cb : Infinity;
  }, [Ca, Va, Cb]);

  // Current pH
  const pH = useMemo(() => {
    const value = computePH(acid, base, Ca, Va, Cb, Vb);
    return isNaN(value) ? 7 : value;
  }, [acid, base, Ca, Va, Cb, Vb]);

  // Indicator colour based on pH
  const solutionColour = useMemo(() => {
    const [start, end] = indicator.range;
    const [c1, c2] = indicator.colours;
    let t;
    if (pH <= start) t = 0;
    else if (pH >= end) t = 1;
    else t = (pH - start) / (end - start);
    return interpolateColour(c1, c2, Math.max(0, Math.min(1, t)));
  }, [indicator, pH]);

  // Helper to clamp values
  const clamp = (v, lo, hi) => {
    if (v < lo) return lo;
    if (v > hi) return hi;
    return v;
  };

  // Burette and flask fill levels (0–1)
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

  // Graph path for the titration curve
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

  // Instructional message for titration view
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (view !== 'titration') return;
    if (equivalence === Infinity) {
      setMessage('Angi en gyldig konsentrasjon for base.');
      return;
    }
    const diff = Vb - equivalence;
    if (diff < -0.0003) setMessage('Før ekvivalens: løsningen er syrerik.');
    else if (Math.abs(diff) <= 0.0003) setMessage('Ekvivalenspunkt: nøytralisering er fullført.');
    else setMessage('Etter ekvivalens: løsningen er baserik.');
  }, [view, Vb, equivalence]);

  // Reset titration state
  function resetTitration() {
    setVb(0);
    setMessage('Titreringen er nullstilt.');
  }

  // Add titrant volume (in litres)
  function addVolume(delta) {
    setVb(prev => {
      const next = prev + delta;
      const maxV = equivalence !== Infinity ? equivalence * 2 : (Cb > 0 ? (Ca * Va) / Cb * 2 : 0.05);
      return clamp(next, 0, maxV);
    });
  }

  // Toggle hint and solution flags
  const toggleHint = () => setShowHint(prev => !prev);
  const toggleSolution = () => setShowSolution(prev => !prev);

  // Evaluate interactive titration task; returns true if all criteria match.
  function evaluateInteractiveTask(task) {
    let feedbackParts = [];
    let correct = true;
    // Reagents
    if (acidKey !== task.acid) {
      correct = false;
      feedbackParts.push('Feil syre valgt.');
    }
    if (baseKey !== task.base) {
      correct = false;
      feedbackParts.push('Feil base valgt.');
    }
    // Indicator
    if (indicatorKey !== task.indicator) {
      correct = false;
      feedbackParts.push('Feil indikator.');
    }
    // Concentrations and volumes
    if (Math.abs(Ca - task.Ca) > 0.001) {
      correct = false;
      feedbackParts.push('Konsentrasjonen på syre er feil.');
    }
    if (Math.abs(Cb - task.Cb) > 0.001) {
      correct = false;
      feedbackParts.push('Konsentrasjonen på base er feil.');
    }
    if (Math.abs(Va - task.Va) > 1e-5) {
      correct = false;
      feedbackParts.push('Volumet av syren er feil.');
    }
    // Titrant volume: must match expectedVolume within ±0,0005 L
    if (Math.abs(Vb - task.expectedVolume) > 0.0005) {
      correct = false;
      feedbackParts.push(`Tilsatt volum (${(Vb * 1000).toFixed(2)} mL) er ikke nær forventet (${(task.expectedVolume * 1000).toFixed(2)} mL).`);
    }
    if (correct) {
      feedbackParts.push('Alt stemmer!');
    }
    setInteractiveFeedback(feedbackParts.join(' '));
    return correct;
  }

  // Submit answer (next question).  For titration tasks we evaluate interactive
  // criteria; for numeric and MCQ tasks we compare user input.
  function submitAnswer() {
    const task = tasks[taskIndex];
    let isCorrect = false;
    if (task.type === 'titration') {
      isCorrect = evaluateInteractiveTask(task);
    } else if (task.type === 'numeric') {
      const val = parseFloat(userInput);
      if (!isNaN(val)) {
        const tol = task.tolerance || 0;
        if (Math.abs(val - task.answer) <= tol) isCorrect = true;
      }
    } else if (task.type === 'mcq') {
      if (parseInt(userInput, 10) === task.answer) isCorrect = true;
    }
    if (isCorrect) setExamScore(prev => prev + 1);
    // Move to next or finish
    if (taskIndex + 1 < tasks.length) {
      setTaskIndex(prev => prev + 1);
      setUserInput('');
      setInteractiveFeedback('');
      setShowHint(false);
      setShowSolution(false);
    } else {
      setView('results');
    }
  }

  // Navigate tasks
  function prevTask() {
    if (taskIndex > 0) {
      setTaskIndex(prev => prev - 1);
      setUserInput('');
      setInteractiveFeedback('');
      setShowHint(false);
      setShowSolution(false);
    }
  }
  function randomTask() {
    const idx = Math.floor(Math.random() * tasks.length);
    setTaskIndex(idx);
    setUserInput('');
    setInteractiveFeedback('');
    setShowHint(false);
    setShowSolution(false);
  }

  // Restart exam
  function startExam() {
    setTasks(buildAllTasks());
    setTaskIndex(0);
    setExamScore(0);
    setUserInput('');
    setInteractiveFeedback('');
    setShowHint(false);
    setShowSolution(false);
    setView('exam');
  }

  // UI segments
  const HomeView = () => (
    <div className="home">
      <h2>Velkommen til SiU Magisk KjemiLab</h2>
      <p>Utforsk syre–base titreringer, juster indikatorer og konsentrasjoner, og test kunnskapen din i eksamensmodus.</p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
        <button className="button-primary" onClick={() => setView('titration')}>Gå til titrering</button>
        <button className="button-secondary" onClick={startExam}>Start eksamen</button>
      </div>
    </div>
  );

  const TitrationView = () => (
    <div className="titration-view">
      {/* Controls */}
      <div className="panel" style={{ marginBottom: '1rem' }}>
        <h3>Kontroller</h3>
        <div className="control-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
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
          <label>Ca (mol/L)
            <input type="number" step="0.01" value={Ca} onChange={e => setCa(parseFloat(e.target.value) || 0)} />
          </label>
          <label>Cb (mol/L)
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
      </div>
      {/* Lab and graph */}
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '1rem', alignItems: 'start' }}>
        {/* Lab illustration */}
        <div className="lab-view">
          <svg width="200" height="260" viewBox="0 0 700 320">
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
              {Array.from({ length: 10 }).map((_, i) => {
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
            {graphPath && <path d={graphPath} stroke="#2c7bb6" strokeWidth="2" fill="none" />}
            {(() => {
              if (Cb <= 0 || equivalence === Infinity) return null;
              const Vmax = equivalence * 1.5 || 0.05;
              const x = Math.min(1, Vb / Vmax) * 300;
              const y = 180 - (Math.max(0, Math.min(14, pH)) / 14) * 180;
              return <circle cx={x} cy={y} r="4" fill="#d73027" />;
            })()}
            {(() => {
              if (Cb <= 0 || equivalence === Infinity) return null;
              const Vmax = equivalence * 1.5 || 0.05;
              const xEq = Math.min(1, equivalence / Vmax) * 300;
              return <line x1={xEq} y1="0" x2={xEq} y2="180" stroke="#999" strokeDasharray="4,4" />;
            })()}
            {/* Y axis ticks */}
            {Array.from({ length: 8 }).map((_, i) => {
              const p = i * 2;
              const y = 180 - (p / 14) * 180;
              return (
                <g key={i}>
                  <line x1="0" x2="5" y1={y} y2={y} stroke="#475569" strokeWidth="0.6" />
                  <text x="-2" y={y + 3} fontSize="8" textAnchor="end" fill="#334155">{p}</text>
                  <line x1="5" x2="300" y1={y} y2={y} stroke="#e2e8f0" strokeWidth="0.3" />
                </g>
              );
            })}
            {/* X axis ticks */}
            {(() => {
              if (Cb <= 0 || equivalence === Infinity) return null;
              const Vmax = equivalence * 1.5 || 0.05;
              const xs = [0, 0.25 * Vmax, equivalence, 0.75 * Vmax, Vmax];
              return xs.map((vx, i) => {
                const x = (vx / Vmax) * 300;
                const label = i === 2 ? 'V_eq' : (vx * 1000).toFixed(1) + ' mL';
                return (
                  <g key={i}>
                    <line x1={x} x2={x} y1="180" y2="175" stroke="#475569" strokeWidth="0.6" />
                    <text x={x} y="190" fontSize="8" textAnchor="middle" fill="#334155">{label}</text>
                  </g>
                );
              });
            })()}
            {/* Axis labels */}
            <text x="-12" y="8" fontSize="8" fill="#334155">pH</text>
            <text x="150" y="198" fontSize="8" textAnchor="middle" fill="#334155">V_b (mL)</text>
          </svg>
          <div style={{ fontSize: '12px', marginTop: '0.3rem' }}>Tips: {indicator.use}</div>
        </div>
      </div>
      {/* Info panel */}
      <div className="panel" style={{ marginTop: '0.5rem' }}>
        <p>Volum tilsatt: {(Vb * 1000).toFixed(2)} mL {equivalence !== Infinity && `(ekvivalens ved ${(equivalence * 1000).toFixed(2)} mL)`}</p>
        <p>pH: {pH.toFixed(2)}</p>
        <p>{message}</p>
      </div>
    </div>
  );

  const ExamView = () => {
    const task = tasks[taskIndex];
    return (
      <div className="exam-view" style={{ display: 'grid', gridTemplateColumns: task.type === 'titration' ? '2fr 3fr' : '1fr', gap: '1rem' }}>
        {/* Tasks panel */}
        <div className="panel">
          <h3>Oppgave {taskIndex + 1} av {tasks.length}</h3>
          <p style={{ whiteSpace: 'pre-wrap' }}>{task.question}</p>
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
              <p>Still inn syre, base, konsentrasjoner, syrevolum, indikator og titrer til ekvivalens. Trykk deretter «Kontroller» for å se resultatet.</p>
              {interactiveFeedback && <div style={{ padding: '0.4rem', background: '#f5f5fa', border: '1px solid #e2e8f0', borderRadius: '6px', marginTop: '0.4rem' }}>{interactiveFeedback}</div>}
            </div>
          )}
          {showHint && <p style={{ marginTop: '0.5rem', fontStyle: 'italic', color: '#7058a5' }}>Hint: {task.hint}</p>}
          {showSolution && <p style={{ marginTop: '0.5rem', fontSize: '13px', whiteSpace: 'pre-wrap' }}><strong>Fasit:</strong> {task.solution}</p>}
          <div style={{ marginTop: '0.8rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {task.type === 'titration' && <button className="button-primary" onClick={() => evaluateInteractiveTask(task)}>Kontroller</button>}
            <button className="button-primary" onClick={submitAnswer}>{taskIndex + 1 === tasks.length ? 'Fullfør' : 'Neste'}</button>
            <button className="button-secondary" onClick={prevTask} disabled={taskIndex === 0}>Forrige</button>
            <button className="button-secondary" onClick={randomTask}>Tilfeldig</button>
            <button className="button-secondary" onClick={toggleHint}>{showHint ? 'Skjul hint' : 'Vis hint'}</button>
            <button className="button-secondary" onClick={toggleSolution}>{showSolution ? 'Skjul fasit' : 'Fasit'}</button>
            <button className="button-secondary" onClick={() => setView('home')}>Tilbake</button>
          </div>
          <p style={{ marginTop: '0.5rem' }}>Poeng: {examScore}</p>
        </div>
        {/* Simulation panel only for titration tasks */}
        {task.type === 'titration' && (
          <div>
            {/* We reuse the same controls, lab and graph as the titration view */}
            {TitrationView()}
          </div>
        )}
      </div>
    );
  };

  const ResultsView = () => (
    <div className="panel">
      <h3>Eksamen ferdig</h3>
      <p>Du fikk {examScore} av {tasks.length} riktige.</p>
      <button className="button-primary" onClick={startExam}>Prøv igjen</button>
      <button className="button-secondary" onClick={() => setView('home')} style={{ marginLeft: '0.5rem' }}>Tilbake</button>
    </div>
  );

  return (
    <div className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '1rem' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '1rem' }}>SiU Lab – Magisk KjemiLab</h1>
      {view === 'home' && <HomeView />}
      {view === 'titration' && <TitrationView />}
      {view === 'exam' && <ExamView />}
      {view === 'results' && <ResultsView />}
    </div>
  );
}
