function parseQuadratic(input) {
  const cleaned = input
    .replace(/\s+/g, '')
    .replace(/−/g, '-')
    .replace(/²/g, '^2')
    .toLowerCase();

  // Match ax^2 + bx + c = 0
  const quadRegex = /^([+-]?\d*)x\^2([+-]\d*)?x?([+-]\d+)?=0$/;
  const m = cleaned.match(quadRegex);
  if (!m) return null;

  const parseCoeff = (raw, fallback) => {
    if (raw === undefined || raw === '') return fallback;
    if (raw === '+') return 1;
    if (raw === '-') return -1;
    const n = Number(raw);
    return Number.isNaN(n) ? null : n;
  };

  // Simpler explicit parser for terms before =0
  const [lhs] = cleaned.split('=0');
  if (!lhs || !lhs.includes('x^2')) return null;

  let a = 0;
  let b = 0;
  let c = 0;
  const tokens = lhs.match(/[+-]?[^+-]+/g) || [];
  for (const tok of tokens) {
    if (tok.includes('x^2')) {
      const num = tok.replace('x^2', '');
      const val = parseCoeff(num, 1);
      if (val === null) return null;
      a += val;
    } else if (tok.includes('x')) {
      const num = tok.replace('x', '');
      const val = parseCoeff(num, 1);
      if (val === null) return null;
      b += val;
    } else {
      const val = Number(tok);
      if (Number.isNaN(val)) return null;
      c += val;
    }
  }
  if (a === 0) return null;
  return { a, b, c };
}

function parseLinear(input) {
  const cleaned = input.replace(/\s+/g, '').replace(/−/g, '-').toLowerCase();
  if (cleaned.includes('^2') || cleaned.includes('²') || !cleaned.includes('=')) return null;
  const parts = cleaned.split('=');
  if (parts.length !== 2) return null;

  const parseSide = (side) => {
    let xCoeff = 0;
    let constTerm = 0;
    const tokens = side.match(/[+-]?[^+-]+/g) || [];
    if (tokens.length === 0) return null;
    for (const tok of tokens) {
      if (tok.includes('x')) {
        const raw = tok.replace('x', '');
        const val = raw === '' || raw === '+' ? 1 : raw === '-' ? -1 : Number(raw);
        if (Number.isNaN(val)) return null;
        xCoeff += val;
      } else {
        const val = Number(tok);
        if (Number.isNaN(val)) return null;
        constTerm += val;
      }
    }
    return { xCoeff, constTerm };
  };

  const left = parseSide(parts[0]);
  const right = parseSide(parts[1]);
  if (!left || !right) return null;
  const netX = left.xCoeff - right.xCoeff;
  const netConst = right.constTerm - left.constTerm;
  if (netX === 0) return null;
  return { netX, netConst, leftRaw: parts[0], rightRaw: parts[1] };
}

const PRACTICE_BANK = {
  'sub-math': [
    {
      topic: 'Quadratic Equations & Inequalities',
      question: 'Solve for x and state the nature of the roots:  2x² - 5x - 3 = 0',
      steps: [
        'Identify coefficients: a = 2, b = -5, c = -3.',
        'Compute discriminant Δ = (-5)² - 4(2)(-3) = 25 + 24 = 49 (perfect square → real, rational, unequal roots).',
        'Factorise (2x + 1)(x - 3) = 0 → x = -1/2 or x = 3.'
      ]
    },
    {
      topic: 'Trigonometry & Identities',
      question: 'Prove without a calculator:  (1 - cos²θ) / sinθ + cosθ·tanθ = 2sinθ',
      steps: [
        'Start on LHS: replace 1 - cos²θ with sin²θ.',
        'Simplify first fraction: sin²θ / sinθ = sinθ.',
        'Rewrite tanθ as sinθ / cosθ → cosθ · (sinθ / cosθ) = sinθ.',
        'Add both terms: sinθ + sinθ = 2sinθ = RHS ✓.'
      ]
    }
  ],
  'sub-phys': [
    {
      topic: 'Newton’s Laws & Free-Body Diagrams',
      question: 'A 6 kg block is pulled across a horizontal surface by a 42 N force against a kinetic friction force of 12 N. Calculate its acceleration.',
      steps: [
        'Write Newton’s Second Law along the horizontal plane: F_net = m · a.',
        'Calculate net force: F_net = F_applied - f_k = 42 - 12 = 30 N forward.',
        'Divide by mass: a = 30 / 6 = 5 m·s⁻² in the direction of motion.'
      ]
    },
    {
      topic: 'Electric Circuits & Ohm’s Law',
      question: 'A battery with EMF ε = 12 V and internal resistance r = 1 Ω is connected to a 5 Ω resistor. Find total current I and terminal voltage V_ext.',
      steps: [
        'Use ε = I(R + r) → 12 = I(5 + 1) = 6I → I = 2 A.',
        'Terminal potential difference V_ext = I × R = 2 × 5 = 10 V (2 V are "lost volts" inside the battery).'
      ]
    }
  ],
  'sub-acct': [
    {
      topic: 'Year-End Adjustments',
      question: 'The Trial Balance shows Insurance = 14,000, which includes a 2,000 annual premium paid in advance for next year. Show the year-end adjustment.',
      steps: [
        'Identify adjustment type: Prepaid Expense (paid early for next financial period).',
        'Subtract 2,000 from Insurance expense → Income Statement shows 12,000.',
        'Record 2,000 under Current Assets (Prepaid Expenses / Trade & Other Receivables).'
      ]
    }
  ],
  'sub-eng': [
    {
      topic: 'PEEL Literature Essay Structure',
      question: 'Turn this plot sentence into an analytical Point sentence: "In Chapter 4 the protagonist hides the letter from his family."',
      steps: [
        'Ask WHY it matters thematically (secrecy, guilt, or self-protection).',
        'Model Point: "The protagonist’s decision to conceal the letter marks the moment fear overrides family loyalty, isolating him morally."'
      ]
    }
  ]
};

export function generateCoachReply({ prompt, subjectId = 'sub-math', topic = '', mode = 'step_by_step', studentName = 'Learner' }) {
  const firstName = (studentName || 'Learner').split(' ')[0];
  const text = (prompt || '').trim();
  const lower = text.toLowerCase();

  // 1. Practice Problem Generator mode
  if (mode === 'practice' || lower.includes('practice problem') || lower.includes('quiz me') || lower.includes('test me')) {
    const pool = PRACTICE_BANK[subjectId] || PRACTICE_BANK['sub-math'];
    const match = pool.find((p) => topic && p.topic.toLowerCase() === topic.toLowerCase()) || pool[Math.floor(Math.random() * pool.length)];
    return {
      content: `Here is a fresh **i-tutor Confidence Challenge** on **${match.topic}**, ${firstName}:\n\n> **${match.question}**\n\nTry working it out on paper first! Reply with your answer (or ask me to check a step). I’ve tucked the method roadmap below for when you’re ready.`,
      steps: mode === 'hint_only' ? [match.steps[0]] : match.steps,
      follow_up_prompt: 'Reply with your working or tap "Socratic Hint" if you get stuck on Step 1!'
    };
  }

  // 2. Real Quadratic Equation Solver
  const quad = parseQuadratic(text);
  if (quad) {
    const { a, b, c } = quad;
    const disc = b * b - 4 * a * c;
    if (mode === 'hint_only') {
      return {
        content: `Great quadratic to tackle, ${firstName}! Instead of spoiling the final roots right away, let’s build your confidence step by step:`,
        steps: [
          `Step 1 (Coefficients): Your equation is already in standard form ax² + bx + c = 0 with a = ${a}, b = ${b}, and c = ${c}.`,
          `Step 2 (Discriminant Check): Calculate Δ = b² - 4ac = (${b})² - 4(${a})(${c}). What number do you get for Δ?`,
          `Step 3 (Your Move): Once you have Δ, substitute into x = (-b ± √Δ) / (2a). Reply with your two roots and I’ll verify them!`
        ],
        follow_up_prompt: `What value did you get for Δ = (${b})² - 4(${a})(${c})?`
      };
    }

    if (disc < 0) {
      return {
        content: `Let’s work through **${text}** step by step, ${firstName}:`,
        steps: [
          `1. Identify standard coefficients: a = ${a}, b = ${b}, c = ${c}.`,
          `2. Calculate the discriminant: Δ = b² - 4ac = (${b})² - 4(${a})(${c}) = ${disc}.`,
          `3. Interpret Δ < 0: Because ${disc} is negative, √Δ is not a real number — this equation has **no real roots** (non-real roots), meaning its parabola never crosses the x-axis.`
        ],
        follow_up_prompt: 'Want to see how to find the turning point of this parabola next?'
      };
    }

    const sqrtDisc = Math.sqrt(disc);
    const x1 = ((-b + sqrtDisc) / (2 * a));
    const x2 = ((-b - sqrtDisc) / (2 * a));
    const fmt = (n) => (Number.isInteger(n) ? String(n) : Number(n.toFixed(3)).toString());

    return {
      content: `Let’s solve **${text}** cleanly using the **i-tutor 4-Step Method**, ${firstName}:`,
      steps: [
        `1. Standard Form Coefficients: a = ${a},  b = ${b},  c = ${c}.`,
        `2. Discriminant (Δ): Δ = b² - 4ac = (${b})² - 4(${a})(${c}) = ${disc}. (${disc === 0 ? 'Real & equal roots' : Number.isInteger(sqrtDisc) ? 'Perfect square → real, rational, unequal roots' : 'Real, irrational, unequal roots'})`,
        `3. Quadratic Formula: x = [ -(${b}) ± √${disc} ] / (2 × ${a}) = [ ${-b} ± ${fmt(sqrtDisc)} ] / ${2 * a}.`,
        disc === 0
          ? `4. Final Solution: x = ${fmt(x1)} (repeated root).`
          : `4. Final Solutions: x = ${fmt(x1)}  or  x = ${fmt(x2)}. Quick check: substituting back satisfies LHS = 0 ✓.`
      ],
      follow_up_prompt: 'Try changing the "= 0" to "< 0" — can you tell what interval of x would solve the inequality?'
    };
  }

  // 3. Real Linear Equation Solver
  const lin = parseLinear(text);
  if (lin) {
    const sol = lin.netConst / lin.netX;
    const fmtSol = Number.isInteger(sol) ? String(sol) : Number(sol.toFixed(3)).toString();
    if (mode === 'hint_only') {
      return {
        content: `Nice linear equation, ${firstName}! Here is your Socratic nudge without giving away the final number:`,
        steps: [
          `1. Collect all x-terms on the left-hand side and constants on the right-hand side.`,
          `2. That simplifies your equation toward (${lin.netX})x = ${lin.netConst}.`,
          `3. Divide both sides by ${lin.netX} — what value of x do you get?`
        ],
        follow_up_prompt: 'Type your value for x to check it!'
      };
    }
    return {
      content: `Here is the clean step-by-step solution for **${text}**, ${firstName}:`,
      steps: [
        `1. Group variable terms on LHS and constants on RHS → ${lin.netX}x = ${lin.netConst}.`,
        `2. Isolate x by dividing both sides by ${lin.netX}: x = ${lin.netConst} / ${lin.netX}.`,
        `3. Final Answer: x = ${fmtSol} ✓.`
      ],
      follow_up_prompt: 'Ready for a tougher multi-step equation or inequality?'
    };
  }

  // 4. Trigonometry coaching
  if (lower.includes('trig') || lower.includes('sin') || lower.includes('cos') || lower.includes('tan') || lower.includes('identit')) {
    const steps =
      mode === 'hint_only'
        ? [
            'Hint 1: Work strictly on the more complex side (usually LHS) — never move terms across the "=" sign in a proof.',
            'Hint 2: Convert every tan(x) into sin(x)/cos(x), and watch for 1 - sin²x = cos²x or 1 - cos²x = sin²x.',
            'What happens to your numerator once you substitute those two identities?'
          ]
        : [
            '1. Lock onto ONE side (usually LHS) and rewrite tan(θ) = sin(θ) / cos(θ).',
            '2. Apply reduction formulae first using CAST quadrants: Quadrant II (180° - θ → sin +), Quadrant III (180° + θ → tan +), Quadrant IV (360° - θ → cos +).',
            '3. Use Pythagorean swaps: sin²θ + cos²θ = 1  ⇔  1 - cos²θ = sin²θ.',
            '4. Find a single Lowest Common Denominator (LCD), factorise the numerator, and cancel matching factors cleanly.'
          ];
    return {
      content: `Let’s build unshakeable confidence in **Trigonometry**, ${firstName}! ${
        mode === 'explain_concept'
          ? 'Think of trig identities like algebraic Lego blocks — almost every complex expression hides just two building blocks: **sin(θ)** and **cos(θ)**.'
          : 'Here is your structured i-tutor attack plan:'
      }`,
      steps,
      follow_up_prompt: 'Paste the exact LHS = RHS trig question from your worksheet and we’ll break down your specific expression!'
    };
  }

  // 5. Physics (Newton / Forces / Circuits / Motion)
  if (
    lower.includes('newton') ||
    lower.includes('force') ||
    lower.includes('incline') ||
    lower.includes('tension') ||
    lower.includes('circuit') ||
    lower.includes('ohm') ||
    lower.includes('resistor') ||
    lower.includes('velocity')
  ) {
    const isCircuit = lower.includes('circuit') || lower.includes('ohm') || lower.includes('resistor') || lower.includes('volt');
    return {
      content: isCircuit
        ? `Let’s demystify **Electric Circuits & Internal Resistance**, ${firstName}:`
        : `Let’s break down **Newton’s Laws & Force Diagrams** calmly, ${firstName}:`,
      steps: isCircuit
        ? mode === 'hint_only'
          ? [
              'Hint 1: Simplify all parallel resistor branches first using 1/R_p = 1/R_1 + 1/R_2.',
              'Hint 2: Use ε = I_total × (R_ext + r) to find the main-branch current before finding branch voltages!'
            ]
          : [
              '1. Collapse parallel branches first: R_p = (R₁ × R₂) / (R₁ + R₂) for two resistors.',
              '2. Find total circuit current using EMF: I_total = ε / (R_ext + r).',
              '3. Terminal voltage across the battery is V_terminal = ε - I_total · r (remember "lost volts" = I · r).',
              '4. Exam check: Parallel branches share identical voltage; series components share identical current.'
            ]
        : mode === 'hint_only'
          ? [
              'Hint 1: Draw a separate Free-Body Diagram for each object — never draw components AND the full weight arrow on the same assessed diagram.',
              'Hint 2: Along a slope of angle θ, gravity pulls down-slope with m·g·sin(θ) and into the slope with m·g·cos(θ).'
            ]
          : [
              '1. Sketch a clean Free-Body Diagram: Weight (F_g) straight down, Normal (N) perpendicular to surface, Friction opposing motion.',
              '2. On an incline θ: resolve Weight into F_g∥ = m·g·sin(θ) (down slope) and F_g⊥ = m·g·cos(θ).',
              '3. Choose the direction of acceleration as POSITIVE (+), then write F_net = m·a separately for each block.',
              '4. Add two-body equations together to eliminate internal Tension (T) immediately!'
            ],
      follow_up_prompt: 'Share the masses, forces, or resistances in your question and we’ll calculate it step by step!'
    };
  }

  // 6. Accounting coaching
  if (lower.includes('account') || lower.includes('debit') || lower.includes('credit') || lower.includes('ledger') || lower.includes('prepaid') || lower.includes('accrued') || lower.includes('asset')) {
    return {
      content: `Let’s lock in your **Accounting** reasoning using the **DEAD CLIC** framework, ${firstName}:`,
      steps: [
        '1. Classify the two accounts affected: D.E.A.D (Debits increase Expenses, Assets, Drawings) vs C.L.I.C (Credits increase Liabilities, Income, Capital).',
        '2. Check the Accounting Equation balance: ΔAssets = ΔOwner’s Equity + ΔLiabilities must hold on every transaction.',
        '3. Year-End Golden Rule: Match ONLY the 12 months belonging to the current financial year — strip out prepaids (Asset) and add in accruals (Liability/Receivable).'
      ],
      follow_up_prompt: 'Tell me the transaction you are adjusting and we’ll classify both accounts together!'
    };
  }

  // 7. English / Essays
  if (lower.includes('essay') || lower.includes('peel') || lower.includes('comprehension') || lower.includes('tone') || lower.includes('english')) {
    return {
      content: `Let’s sharpen your **English & Analytical Writing**, ${firstName}:`,
      steps: [
        '1. [P] Point: Answer the exact prompt verb in Sentence 1 — state an argument, never retell plot.',
        '2. [E] Evidence: Weave a short 3–6 word quotation smoothly inside your own grammar.',
        '3. [E] Explain: Zoom in on ONE specific word/image and explain what tone or reader effect it creates.',
        '4. [L] Link: Echo the essay question keywords in your closing line so markers tick relevance immediately.'
      ],
      follow_up_prompt: 'Paste a draft sentence or essay prompt here and I’ll help you elevate it!'
    };
  }

  // 8. General thoughtful Socratic coach response tailored to active topic
  const contextLabel = topic || 'your current study topic';
  return {
    content:
      mode === 'hint_only'
        ? `I’m right here with you on **${contextLabel}**, ${firstName}! In **Socratic Hint Mode**, let’s start with your first step:`
        : `Let’s break **${text || contextLabel}** down into calm, manageable steps, ${firstName}:`,
    steps:
      mode === 'hint_only'
        ? [
            'Step 1: Write down exactly what information/quantities the question gives you and what unknown it asks for.',
            'Step 2: Which core rule or formula from your Study Vault connects those two pieces?',
            'Tell me what you tried first — even a rough first line — and I’ll guide your very next move!'
          ]
        : [
            `1. Unpack the Prompt: Circle the command verb ("Calculate", "Prove", "Explain", or "Solve") in "${text.slice(0, 80)}".`,
            `2. Anchor Formula / Concept: Match the problem to the core principle in ${contextLabel} before substituting any numbers.`,
            '3. Show Every Intermediate Step: Exam markers award 60–75% of marks for method lines even before the final answer.',
            '4. Sanity-Check Units & Signs: Re-read the question once at the end to verify sign intervals, units, or rounding.'
          ],
    follow_up_prompt: 'Paste a specific equation (like 2x^2 - 5x - 3 = 0) or tap "Generate Practice Problem" to test yourself live!'
  };
}
