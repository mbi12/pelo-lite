const STORAGE_KEY = 'itutor_standalone_state_v1';

export const SUBJECTS = [
  { id: 'maths', name: 'Mathematics', short: 'Maths', symbol: '∑' },
  { id: 'science', name: 'Physical Sciences', short: 'Sciences', symbol: '⚛' },
  { id: 'accounting', name: 'Accounting', short: 'Accounting', symbol: '§' },
  { id: 'life', name: 'Life Sciences', short: 'Life Sci', symbol: '✦' },
  { id: 'english', name: 'English Mastery', short: 'English', symbol: '✒' }
];

function createInitialState() {
  return {
    theme: 'light', // 'light' | 'night'
    dailyGoalTarget: 4,
    dailyCompleted: 2,
    streakDays: 4,
    focusMinutesToday: 25,
    lastStudied: {
      type: 'note',
      id: 'note-trig',
      subjectId: 'maths',
      title: 'Mathematics — Trigonometry'
    },
    subjectConfidence: {
      maths: 78,
      science: 72,
      accounting: 84,
      life: 80,
      english: 76
    },
    notes: [
      {
        id: 'note-trig',
        subjectId: 'maths',
        title: 'Trigonometry Identities & Double Angles',
        topic: 'Trigonometry',
        keyFormulas: [
          'sin²θ + cos²θ = 1',
          'tan θ = sin θ / cos θ',
          'sin(2θ) = 2 sin θ cos θ',
          'cos(2θ) = cos²θ − sin²θ = 2cos²θ − 1 = 1 − 2sin²θ'
        ],
        summary:
          'When proving Left-Hand Side = Right-Hand Side, always convert tan θ into sin θ / cos θ first, factor common terms, and look for sin²θ + cos²θ = 1 before expanding brackets.',
        bookmarked: true
      },
      {
        id: 'note-quad',
        subjectId: 'maths',
        title: 'Quadratic Formula & Turning Points',
        topic: 'Algebra & Functions',
        keyFormulas: [
          'x = [ −b ± √(b² − 4ac) ] / 2a',
          'Turning point x = −b / (2a)',
          'Δ = b² − 4ac  (Δ > 0: two real roots)'
        ],
        summary:
          'Write every quadratic in standard form ax² + bx + c = 0 before reading a, b, and c. Check the discriminant Δ first to see the nature of roots.',
        bookmarked: false
      },
      {
        id: 'note-newton',
        subjectId: 'science',
        title: 'Newton’s Laws & Net Force',
        topic: 'Mechanics',
        keyFormulas: [
          'F_net = m · a',
          'w = m · g   (g = 9.8 m·s⁻²)',
          'f_k = μ_k · N'
        ],
        summary:
          'Always draw a labelled free-body diagram before writing F_net = ma. Resolve angled forces into parallel and perpendicular components first.',
        bookmarked: true
      },
      {
        id: 'note-mole',
        subjectId: 'science',
        title: 'Stoichiometry & Mole Ratios',
        topic: 'Chemical Change',
        keyFormulas: [
          'n = m / M',
          'c = n / V   (V in dm³)',
          'n = V / V_m   (STP V_m = 22.4 dm³·mol⁻¹)'
        ],
        summary:
          'Convert cm³ to dm³ by dividing by 1000. To find the limiting reagent, divide moles available by each reactant’s balanced equation coefficient.',
        bookmarked: false
      },
      {
        id: 'note-acc',
        subjectId: 'accounting',
        title: 'Accounting Equation & Year-End Adjustments',
        topic: 'Financial Statements',
        keyFormulas: [
          'Assets = Owner’s Equity + Liabilities',
          'Gross Profit = Sales − Cost of Sales',
          'Current Ratio = Current Assets : Current Liabilities'
        ],
        summary:
          'Prepaid expenses belong to the next financial year (deduct from expense, add to receivables). Accrued expenses must be added to both the expense and payables.',
        bookmarked: false
      },
      {
        id: 'note-dna',
        subjectId: 'life',
        title: 'DNA Replication vs Protein Synthesis',
        topic: 'Genetics',
        keyFormulas: [
          'Base pairing (DNA): A = T  and  C ≡ G',
          'Base pairing (RNA): A − U  and  C − G',
          'Transcription (Nucleus) → Translation (Ribosome)'
        ],
        summary:
          'DNA replication copies both strands during interphase using DNA polymerase. Transcription copies only one template strand into mRNA.',
        bookmarked: false
      },
      {
        id: 'note-essay',
        subjectId: 'english',
        title: 'PEEL Paragraph & Literary Analysis',
        topic: 'Essay Writing',
        keyFormulas: [
          'P — Point (Clear topic claim)',
          'E — Evidence (Short embedded quote)',
          'E — Explain (How diction/imagery creates meaning)',
          'L — Link (Tie back to essay question)'
        ],
        summary:
          'Avoid retelling the plot. Name the exact literary device (metaphor, irony, tone shift) and explain its effect on the reader.',
        bookmarked: false
      }
    ],
    quizzes: [
      {
        id: 'q-1',
        subjectId: 'maths',
        topic: 'Trigonometry',
        question: 'Which expression is always equal to sin²θ + cos²θ for any angle θ?',
        options: ['0', '1', '2 sin θ cos θ', 'tan²θ'],
        correctIndex: 1,
        explanation: 'By the fundamental Pythagorean identity, sin²θ + cos²θ = 1 for all real angles θ.'
      },
      {
        id: 'q-2',
        subjectId: 'maths',
        topic: 'Trigonometry',
        question: 'What is the simplified double-angle identity for sin(2θ)?',
        options: ['sin²θ − cos²θ', '2 sin θ cos θ', '2 cos²θ − 1', 'sin θ + cos θ'],
        correctIndex: 1,
        explanation: 'sin(2θ) expands directly to 2 sin θ cos θ.'
      },
      {
        id: 'q-3',
        subjectId: 'maths',
        topic: 'Algebra & Functions',
        question: 'For f(x) = 2x² − 8x + 5, what is the x-coordinate of the turning point?',
        options: ['x = −2', 'x = 2', 'x = 4', 'x = −4'],
        correctIndex: 1,
        explanation: 'Using x = −b / (2a) = −(−8) / (2 × 2) = 8 / 4 = 2.'
      },
      {
        id: 'q-4',
        subjectId: 'science',
        topic: 'Mechanics',
        question: 'A 4 kg block accelerates at 3 m·s⁻² on a frictionless surface. What is the net force?',
        options: ['0.75 N', '7 N', '12 N', '39.2 N'],
        correctIndex: 2,
        explanation: 'By Newton’s Second Law, F_net = m × a = 4 kg × 3 m·s⁻² = 12 N.'
      },
      {
        id: 'q-5',
        subjectId: 'science',
        topic: 'Chemical Change',
        question: 'How many dm³ are in 250 cm³ when calculating molar concentration c = n / V?',
        options: ['0.025 dm³', '0.25 dm³', '2.5 dm³', '25 dm³'],
        correctIndex: 1,
        explanation: 'Divide cm³ by 1000 to convert to dm³: 250 / 1000 = 0.25 dm³.'
      },
      {
        id: 'q-6',
        subjectId: 'accounting',
        topic: 'Financial Statements',
        question: 'If Assets = 150,000 and Liabilities = 45,000, what is Owner’s Equity?',
        options: ['195,000', '105,000', '45,000', '150,000'],
        correctIndex: 1,
        explanation: 'Owner’s Equity = Assets − Liabilities = 150,000 − 45,000 = 105,000.'
      },
      {
        id: 'q-7',
        subjectId: 'life',
        topic: 'Genetics',
        question: 'In mRNA, which nitrogenous base pairs with Adenine (A) on the DNA template?',
        options: ['Thymine (T)', 'Uracil (U)', 'Cytosine (C)', 'Guanine (G)'],
        correctIndex: 1,
        explanation: 'RNA contains Uracil (U) instead of Thymine, so DNA Adenine pairs with mRNA Uracil.'
      },
      {
        id: 'q-8',
        subjectId: 'english',
        topic: 'Essay Writing',
        question: 'In a PEEL body paragraph, what should immediately follow your embedded quotation?',
        options: [
          'A brand-new unrelated topic',
          'Explanation of how the language/device proves your point',
          'The bibliography',
          'Plot summary of Chapter 1'
        ],
        correctIndex: 1,
        explanation: 'After Evidence comes Explain: unpack how the quote’s diction or imagery supports your argument.'
      }
    ],
    flashcards: [
      {
        id: 'fc-1',
        subjectId: 'maths',
        front: 'How do you rewrite tan θ when proving trig identities?',
        back: 'tan θ = sin θ / cos θ   (valid where cos θ ≠ 0)',
        mastered: true
      },
      {
        id: 'fc-2',
        subjectId: 'maths',
        front: 'Three forms of cos(2θ)?',
        back: '1) cos²θ − sin²θ\n2) 2cos²θ − 1\n3) 1 − 2sin²θ',
        mastered: false
      },
      {
        id: 'fc-3',
        subjectId: 'science',
        front: 'State Newton’s Second Law in words & formula.',
        back: 'F_net = m · a — Net force is directly proportional to acceleration and in the same direction.',
        mastered: false
      },
      {
        id: 'fc-4',
        subjectId: 'accounting',
        front: 'How do you treat an Accrued Expense at year-end?',
        back: 'ADD to the expense in the Income Statement and record under Trade & Other Payables.',
        mastered: true
      },
      {
        id: 'fc-5',
        subjectId: 'life',
        front: 'Where does Translation occur during protein synthesis?',
        back: 'At the Ribosome in the cytoplasm (tRNA anticodons match mRNA codons).',
        mastered: true
      },
      {
        id: 'fc-6',
        subjectId: 'english',
        front: 'What does PEEL stand for in analytical essays?',
        back: 'Point · Evidence · Explain · Link',
        mastered: true
      }
    ],
    tasks: [
      { id: 't-1', title: 'Revise Trig double-angle proofs', subjectId: 'maths', done: true },
      { id: 't-2', title: 'Complete 5-question Quick Quiz', subjectId: 'science', done: true },
      { id: 't-3', title: 'Flip unmastered Flashcards (10 mins)', subjectId: 'maths', done: false },
      { id: 't-4', title: '25-min Focus Timer on Newton’s Laws', subjectId: 'science', done: false }
    ],
    exams: [
      { id: 'ex-1', subjectId: 'maths', title: 'Mathematics Paper 2', daysAway: 12 },
      { id: 'ex-2', subjectId: 'science', title: 'Physical Sciences Paper 1', daysAway: 16 },
      { id: 'ex-3', subjectId: 'accounting', title: 'Accounting Mid-Term', daysAway: 21 }
    ]
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = createInitialState();
      saveState(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw);
    return { ...createInitialState(), ...parsed };
  } catch {
    return createInitialState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in private windows
  }
}

export function resetState() {
  const fresh = createInitialState();
  saveState(fresh);
  return fresh;
}

export function getOverallConfidence(state) {
  const vals = Object.values(state.subjectConfidence || {});
  if (!vals.length) return 75;
  const avg = vals.reduce((a, b) => a + Number(b || 0), 0) / vals.length;
  return Math.round(avg);
}

export function getWeakestSubject(state) {
  let lowest = SUBJECTS[0];
  let minScore = 101;
  for (const sub of SUBJECTS) {
    const sc = Number(state.subjectConfidence?.[sub.id] ?? 75);
    if (sc < minScore) {
      minScore = sc;
      lowest = sub;
    }
  }
  return { subject: lowest, score: minScore };
}

export function getSubjectById(subjectId) {
  return SUBJECTS.find((s) => s.id === subjectId) || SUBJECTS[0];
}
