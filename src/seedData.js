import crypto from 'node:crypto';

export function hashPassword(plain) {
  return crypto.createHash('sha256').update(`itutor:${plain}`).digest('hex');
}

function isoOffsetHours(hours) {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}

export function createSeedData() {
  const defaultPass = hashPassword('itutor123');

  const users = [
    {
      id: 'stu-thabo',
      name: 'Thabo Mokoena',
      email: 'thabo@itutor.academy',
      password_hash: defaultPass,
      role: 'student',
      grade: 'Grade 11',
      bio: 'STEM & Accounting learner building exam confidence in Quadratics, Mechanics, and Financial Statements.',
      linked_student_id: null,
      streak_days: 9,
      confidence_mood: 'building'
    },
    {
      id: 'stu-amahle',
      name: 'Amahle Dlamini',
      email: 'amahle@itutor.academy',
      password_hash: defaultPass,
      role: 'student',
      grade: 'Grade 12',
      bio: 'Final-year distinction candidate focused on Calculus, Electrodynamics, and Essay Argumentation.',
      linked_student_id: null,
      streak_days: 14,
      confidence_mood: 'confident'
    },
    {
      id: 'stu-liam',
      name: 'Liam van der Merwe',
      email: 'liam@itutor.academy',
      password_hash: defaultPass,
      role: 'student',
      grade: 'Grade 10',
      bio: 'Building strong algebra and stoichiometry foundations step by step.',
      linked_student_id: null,
      streak_days: 4,
      confidence_mood: 'stuck'
    },
    {
      id: 'tut-naledi',
      name: 'Ms. Naledi Khumalo',
      email: 'naledi@itutor.academy',
      password_hash: defaultPass,
      role: 'tutor',
      grade: 'Lead Academic Tutor',
      bio: 'Senior Mathematics & Physical Sciences Specialist at i-tutor. Turning complex exam concepts into calm, repeatable steps.',
      linked_student_id: null,
      streak_days: 30,
      confidence_mood: 'confident'
    },
    {
      id: 'par-grace',
      name: 'Grace Mokoena',
      email: 'grace@itutor.academy',
      password_hash: defaultPass,
      role: 'parent',
      grade: 'Parent · Thabo Mokoena',
      bio: 'Supporting Thabo’s Grade 11 academic journey and staying connected with his i-tutor mentors.',
      linked_student_id: 'stu-thabo',
      streak_days: 1,
      confidence_mood: 'confident'
    }
  ];

  const subjects = [
    {
      id: 'sub-math',
      name: 'Mathematics',
      code: 'MATH-11',
      grade_level: 'Grades 10–12',
      tutor_name: 'Ms. Naledi Khumalo',
      description: 'Algebraic mastery, Quadratic Functions, Trigonometry, and Analytical Geometry with step-by-step exam methods.',
      icon: 'compass',
      topics: [
        { id: 'top-math-1', name: 'Quadratic Equations & Inequalities', summary: 'Factorisation, completing the square, discriminant nature of roots, and sign tables.' },
        { id: 'top-math-2', name: 'Functions & Parabolas', summary: 'Turning points, axes of symmetry, asymptotes, and sketching transformations.' },
        { id: 'top-math-3', name: 'Trigonometry & Identities', summary: 'Reduction formulae, general solutions, sine/cosine rules, and identity proofs.' },
        { id: 'top-math-4', name: 'Analytical Geometry', summary: 'Gradient, inclination angles, collinear points, and circle equations.' }
      ]
    },
    {
      id: 'sub-phys',
      name: 'Physical Sciences',
      code: 'PHYS-11',
      grade_level: 'Grades 10–12',
      tutor_name: 'Ms. Naledi Khumalo',
      description: 'Newtonian Mechanics, Kinematics, Electric Circuits, and Quantitative Chemical Change.',
      icon: 'atom',
      topics: [
        { id: 'top-phys-1', name: 'Newton’s Laws & Free-Body Diagrams', summary: 'Resolving forces on inclined planes, friction, tension, and two-body systems.' },
        { id: 'top-phys-2', name: 'Equations of Motion (Kinematics)', summary: 'Velocity-time graphs, projectile motion, and constant acceleration equations.' },
        { id: 'top-phys-3', name: 'Electric Circuits & Ohm’s Law', summary: 'Series-parallel resistors, internal resistance, EMF, and power calculations.' },
        { id: 'top-phys-4', name: 'Stoichiometry & Mole Concept', summary: 'Limiting reagents, molar gas volume, concentration, and percentage yield.' }
      ]
    },
    {
      id: 'sub-acct',
      name: 'Accounting',
      code: 'ACCT-11',
      grade_level: 'Grades 10–12',
      tutor_name: 'Mr. Sipho Ndlovu',
      description: 'General Ledger logic, Year-End Adjustments, Income Statements, and Financial Ratio interpretation.',
      icon: 'ledger',
      topics: [
        { id: 'top-acct-1', name: 'Accounting Equation & Double Entry', summary: 'Assets = Owner’s Equity + Liabilities and DEAD CLIC debit/credit mastery.' },
        { id: 'top-acct-2', name: 'Year-End Adjustments', summary: 'Prepaid expenses, accrued income, depreciation, and trading stock deficits.' },
        { id: 'top-acct-3', name: 'Income Statement & Balance Sheet', summary: 'Structured statement preparation from pre-adjustment trial balances.' },
        { id: 'top-acct-4', name: 'Financial Indicators & Liquidity', summary: 'Current ratio, acid-test ratio, solvency, and mark-up commentary.' }
      ]
    },
    {
      id: 'sub-eng',
      name: 'English & Exam Mastery',
      code: 'ENG-11',
      grade_level: 'Grades 10–12',
      tutor_name: 'Mrs. Claire Jacobs',
      description: 'Comprehension precision, PEEL Literature Essays, Visual Literacy, and Grammar editing.',
      icon: 'feather',
      topics: [
        { id: 'top-eng-1', name: 'Comprehension & Tone Analysis', summary: 'Decoding command verbs, diction, tone, irony, and implied meaning.' },
        { id: 'top-eng-2', name: 'PEEL Literature Essay Structure', summary: 'Crafting sharp thesis statements and evidence-backed body paragraphs.' },
        { id: 'top-eng-3', name: 'Summary & Synthesis Writing', summary: 'Extracting 7 core points accurately in own words within strict word limits.' },
        { id: 'top-eng-4', name: 'Language, Active/Passive & Editing', summary: 'Concord, reported speech, punctuation nuances, and common exam traps.' }
      ]
    }
  ];

  const sessions = [
    {
      id: 'ses-1',
      subject_id: 'sub-math',
      title: 'Trigonometry Reduction Formulae & General Solutions',
      topic: 'Trigonometry & Identities',
      tutor_name: 'Ms. Naledi Khumalo',
      session_type: 'group',
      mode: 'in_person',
      location_or_link: 'Studio Room B · Main i-tutor Campus',
      scheduled_at: isoOffsetHours(3),
      duration_mins: 75,
      status: 'upcoming',
      target_student_id: null,
      lesson_recap: '',
      key_takeaways: []
    },
    {
      id: 'ses-2',
      subject_id: 'sub-phys',
      title: '1-on-1 Focus: Inclined Planes & Tension Forces',
      topic: 'Newton’s Laws & Free-Body Diagrams',
      tutor_name: 'Ms. Naledi Khumalo',
      session_type: 'one_on_one',
      mode: 'online',
      location_or_link: 'https://meet.itutor.academy/naledi-thabo-mechanics',
      scheduled_at: isoOffsetHours(26),
      duration_mins: 45,
      status: 'upcoming',
      target_student_id: 'stu-thabo',
      lesson_recap: '',
      key_takeaways: []
    },
    {
      id: 'ses-3',
      subject_id: 'sub-acct',
      title: 'Mastering Year-End Adjustments Without Memorising',
      topic: 'Year-End Adjustments',
      tutor_name: 'Mr. Sipho Ndlovu',
      session_type: 'group',
      mode: 'online',
      location_or_link: 'https://meet.itutor.academy/accounting-cohort-11',
      scheduled_at: isoOffsetHours(50),
      duration_mins: 60,
      status: 'upcoming',
      target_student_id: null,
      lesson_recap: '',
      key_takeaways: []
    },
    {
      id: 'ses-4',
      subject_id: 'sub-math',
      title: 'Quadratic Inequalities & Nature of Roots Workshop',
      topic: 'Quadratic Equations & Inequalities',
      tutor_name: 'Ms. Naledi Khumalo',
      session_type: 'group',
      mode: 'in_person',
      location_or_link: 'Studio Room A · Main i-tutor Campus',
      scheduled_at: isoOffsetHours(-46),
      duration_mins: 75,
      status: 'completed',
      target_student_id: null,
      lesson_recap: 'Students mastered rewriting quadratics in standard form before factoring, sketching quick sign parabolas for inequalities, and using Δ = b² - 4ac to classify real, equal, or non-real roots.',
      key_takeaways: [
        'Never divide across an inequality by a variable x because its sign may be negative.',
        'Always sketch a mini parabola through the critical values to read > 0 (above axis) vs < 0 (below axis).',
        'Equal roots occur strictly when Δ = b² - 4ac = 0.'
      ]
    },
    {
      id: 'ses-5',
      subject_id: 'sub-phys',
      title: 'Electric Circuits & Internal Resistance Lab Walkthrough',
      topic: 'Electric Circuits & Ohm’s Law',
      tutor_name: 'Ms. Naledi Khumalo',
      session_type: 'group',
      mode: 'in_person',
      location_or_link: 'Science Studio 2 · Main i-tutor Campus',
      scheduled_at: isoOffsetHours(-94),
      duration_mins: 60,
      status: 'completed',
      target_student_id: null,
      lesson_recap: 'Worked through 3 past-paper circuit questions involving lost volts (Ir) and switch open/closed scenarios. Students improved significantly on identifying parallel branch voltage equality.',
      key_takeaways: [
        'When a switch is OPEN, no current flows through that branch; voltmeter across battery reads full EMF (ε).',
        'ε = I(R_ext + r) — always simplify parallel resistors first before finding total current.',
        'Lost volts = I × r increases whenever total circuit current increases.'
      ]
    },
    {
      id: 'ses-6',
      subject_id: 'sub-eng',
      title: 'PEEL Literature Essay Clinic',
      topic: 'PEEL Literature Essay Structure',
      tutor_name: 'Mrs. Claire Jacobs',
      session_type: 'group',
      mode: 'online',
      location_or_link: 'https://meet.itutor.academy/english-peel-clinic',
      scheduled_at: isoOffsetHours(-120),
      duration_mins: 60,
      status: 'completed',
      target_student_id: null,
      lesson_recap: 'Practised turning vague plot retelling into sharp analytical PEEL paragraphs anchored directly to the essay prompt.',
      key_takeaways: [
        'Point: state your argument in sentence 1 without retelling plot.',
        'Evidence + Explain: embed short 3–5 word quotes and unpack their effect.',
        'Link: tie the paragraph back to the central question stem.'
      ]
    }
  ];

  const attendance = [
    { id: 'att-1', session_id: 'ses-4', student_id: 'stu-thabo', status: 'present', confidence_checkin: 'confident', note: 'Solved all 3 discriminant problems accurately.' },
    { id: 'att-2', session_id: 'ses-4', student_id: 'stu-amahle', status: 'present', confidence_checkin: 'confident', note: 'Helped peers check inequality intervals.' },
    { id: 'att-3', session_id: 'ses-4', student_id: 'stu-liam', status: 'late', confidence_checkin: 'building', note: 'Needs extra practice on negative x² coefficient flips.' },
    { id: 'att-4', session_id: 'ses-5', student_id: 'stu-thabo', status: 'present', confidence_checkin: 'building', note: 'Good grasp of Ohm’s Law; revising parallel branch splits.' },
    { id: 'att-5', session_id: 'ses-5', student_id: 'stu-amahle', status: 'present', confidence_checkin: 'confident', note: 'Full marks on exit ticket.' },
    { id: 'att-6', session_id: 'ses-5', student_id: 'stu-liam', status: 'absent', confidence_checkin: 'stuck', note: 'Sent recorded recap + catch-up sheet.' },
    { id: 'att-7', session_id: 'ses-6', student_id: 'stu-thabo', status: 'present', confidence_checkin: 'confident', note: 'Strong thesis statement draft!' }
  ];

  const help_requests = [
    {
      id: 'hlp-1',
      student_id: 'stu-thabo',
      subject_id: 'sub-math',
      topic: 'Trigonometry & Identities',
      preferred_slot: 'Thursday Afternoon (16:00 – 17:00)',
      notes: 'I get stuck proving left-hand side = right-hand side when tan(x) and double angles appear together.',
      status: 'pending',
      tutor_response: ''
    },
    {
      id: 'hlp-2',
      student_id: 'stu-liam',
      subject_id: 'sub-phys',
      topic: 'Stoichiometry & Mole Concept',
      preferred_slot: 'Friday 15:30 Online',
      notes: 'Finding the limiting reagent when masses of both reactants are given.',
      status: 'scheduled',
      tutor_response: 'Booked for Friday 15:30! Bring your periodic table and calculator.'
    }
  ];

  const resources = [
    {
      id: 'res-1',
      subject_id: 'sub-math',
      topic: 'Quadratic Equations & Inequalities',
      title: 'Complete Quadratics & Discriminant Playbook',
      resource_type: 'formula_sheet',
      difficulty: 'Core',
      summary: 'Every method for solving ax² + bx + c = 0, completing the square, and reading quadratic inequalities without sign errors.',
      content_body: `### 1. Standard Form First
Before factoring or applying the quadratic formula, **always** rearrange the equation so that zero is on the right-hand side and the leading coefficient $a > 0$:
$$ax^2 + bx + c = 0$$

### 2. The 3-Step Inequality Method
Suppose you must solve $x^2 - 4x - 5 \\le 0$:
1. **Find Critical Values:** Factorise $(x - 5)(x + 1) = 0 \\Rightarrow x = 5$ or $x = -1$.
2. **Sketch a Mini Smiling Parabola:** Since $a = +1 > 0$, the parabola dips **below** the x-axis between $-1$ and $5$.
3. **Read the Interval:** Because we want $\\le 0$ (below or on the axis), the solution is:
$$-1 \\le x \\le 5$$

### 3. Nature of Roots via the Discriminant ($\\Delta$)
- $\\Delta > 0$ (and a perfect square): Real, **rational**, unequal roots
- $\\Delta > 0$ (not a perfect square): Real, **irrational**, unequal roots
- $\\Delta = 0$: Real, rational, **equal** roots (parabola touches x-axis once)
- $\\Delta < 0$: **Non-real** roots (parabola never crosses x-axis)`,
      key_formulas: [
        'x = (-b ± √(b² - 4ac)) / 2a',
        'Δ = b² - 4ac',
        'Turning Point x_TP = -b / (2a)'
      ],
      author_name: 'Ms. Naledi Khumalo'
    },
    {
      id: 'res-2',
      subject_id: 'sub-math',
      topic: 'Trigonometry & Identities',
      title: 'CAST Diagram & Trig Identity Proof Checklist',
      resource_type: 'notes',
      difficulty: 'Exam Prep',
      summary: 'A calm 5-rule checklist for proving any Grade 11/12 trigonometric identity from scratch.',
      content_body: `### The Golden 5-Step Trig Proof Routine
Whenever an exam asks you to **Prove that LHS = RHS**:

1. **Pick the More Complex Side** (usually the side with fractions or higher powers). Never move terms across the $=$ sign!
2. **Convert $\\tan\\theta$ to Sine & Cosine:** Replace $\\tan\\theta = \\frac{\\sin\\theta}{\\cos\\theta}$ unless the RHS itself is purely in $\\tan\\theta$.
3. **Spot Pythagorean Twins:** Look for $1 - \\sin^2\\theta = \\cos^2\\theta$ and $1 - \\cos^2\\theta = \\sin^2\\theta$.
4. **Combine Fractions with LCD:** Write a single clean denominator and factorise the numerator (difference of squares or trinomial).
5. **Peek at the Target Side:** Let the denominator of the RHS guide what factor needs to cancel!

### Worked Exam Mini-Example
Prove: $\\frac{1 - \\cos^2 x}{\\cos x \\cdot \\tan x} = \\sin x$
- **Step 1:** Numerator $1 - \\cos^2 x = \\sin^2 x$
- **Step 2:** Denominator $\\cos x \\cdot \\frac{\\sin x}{\\cos x} = \\sin x$
- **Step 3:** $\\frac{\\sin^2 x}{\\sin x} = \\sin x = \\text{RHS}$ ✓`,
      key_formulas: [
        'sin²θ + cos²θ = 1',
        'tan θ = sin θ / cos θ',
        'sin(180° - θ) = sin θ · cos(180° - θ) = -cos θ'
      ],
      author_name: 'Ms. Naledi Khumalo'
    },
    {
      id: 'res-3',
      subject_id: 'sub-phys',
      topic: 'Newton’s Laws & Free-Body Diagrams',
      title: 'Worked Past Paper: Two-Block Pulley & Inclined Plane',
      resource_type: 'worked_example',
      difficulty: 'Exam Prep',
      summary: 'Full annotated solution showing how to isolate each block, write F_net = ma equations, and eliminate tension T.',
      content_body: `### Exam Question Scenario
A $4\\text{ kg}$ block rests on a rough horizontal table ($f_k = 6\\text{ N}$) and is connected by a light inextensible string over a frictionless pulley to a hanging $2\\text{ kg}$ block. Calculate the **magnitude of acceleration** and **tension $T$**.

### Step-by-Step i-tutor Solution
1. **Choose Direction of Motion as Positive (+):** Rightwards for the $4\\text{ kg}$ block and downwards for the $2\\text{ kg}$ block.
2. **Equation for Block A ($4\\text{ kg}$ on table):**
   $$F_{\\text{net}} = ma \\implies T - f_k = 4a \\implies T - 6 = 4a \\quad \\text{(Eq. 1)}$$
3. **Equation for Block B ($2\\text{ kg}$ hanging):**
   $$F_{\\text{net}} = ma \\implies W_B - T = 2a \\implies (2)(9.8) - T = 2a \\implies 19.6 - T = 2a \\quad \\text{(Eq. 2)}$$
4. **Add Eq. 1 + Eq. 2 (Tension cancels cleanly!):**
   $$19.6 - 6 = 6a \\implies 13.6 = 6a \\implies a = 2.27\\text{ m·s}^{-2}$$
5. **Substitute back for Tension $T$:**
   $$T = 4(2.27) + 6 = 15.07\\text{ N}$$`,
      key_formulas: [
        'F_net = m · a',
        'f_k = μ_k · N',
        'W_parallel = m·g·sin θ · W_perp = m·g·cos θ'
      ],
      author_name: 'Ms. Naledi Khumalo'
    },
    {
      id: 'res-4',
      subject_id: 'sub-phys',
      topic: 'Electric Circuits & Ohm’s Law',
      title: 'Internal Resistance & Circuit Diagnostics Sheet',
      resource_type: 'formula_sheet',
      difficulty: 'Core',
      summary: 'Quick-reference sheet for EMF, terminal potential difference, parallel resistance, and power.',
      content_body: `### Core Circuit Rules That Never Change
- **Series Resistors:** Current $I$ is identical everywhere; voltage splits ($V_T = V_1 + V_2$).
- **Parallel Branches:** Voltage across parallel branches is identical; current splits inversely to resistance.
- **Internal Resistance ($r$):** Every real battery drops "lost volts" $V_{\\text{lost}} = I \\cdot r$ when current flows:
  $$V_{\\text{terminal}} = \\varepsilon - I \\cdot r$$

### Exam Trap Alert: "What happens when a parallel resistor burns out?"
1. Removing a parallel pathway **increases** total external resistance $R_{\\text{ext}}$.
2. Total current $I_{\\text{total}}$ **decreases**.
3. Lost volts $I \\cdot r$ **decreases**, so the voltmeter across the battery ($V_{\\text{ext}}$) **increases**!`,
      key_formulas: [
        'ε = I(R + r)',
        '1/R_p = 1/R_1 + 1/R_2',
        'P = V·I = I²·R = V²/R'
      ],
      author_name: 'Ms. Naledi Khumalo'
    },
    {
      id: 'res-5',
      subject_id: 'sub-acct',
      topic: 'Accounting Equation & Double Entry',
      title: 'DEAD CLIC & Year-End Adjustment Master Guide',
      resource_type: 'notes',
      difficulty: 'Core',
      summary: 'Never guess Debit vs Credit again — plus clean templates for Accrued & Prepaid adjustments.',
      content_body: `### The Unbreakable DEAD CLIC Rule
- **D.E.A.D — Debits Increase:** **E**xpenses, **A**ssets, **D**rawings
- **C.L.I.C — Credits Increase:** **L**iabilities, **I**ncome, **C**apital

### Year-End Adjustments Cheat Table
1. **Prepaid Expense** (paid for next financial year):
   - *Subtract* from Expense (Cr Expense) · *Create* Current Asset: Prepaid Expense (Dr).
2. **Accrued Expense** (used this year, not yet paid):
   - *Add* to Expense (Dr Expense) · *Create* Current Liability: Accrued Expense (Cr).
3. **Income Received in Advance** (received early):
   - *Subtract* from Income (Dr Income) · *Create* Current Liability: Deferred Income (Cr).`,
      key_formulas: [
        'Assets = Owner’s Equity + Liabilities',
        'Gross Profit = Sales - Cost of Sales',
        'Current Ratio = Current Assets : Current Liabilities'
      ],
      author_name: 'Mr. Sipho Ndlovu'
    },
    {
      id: 'res-6',
      subject_id: 'sub-eng',
      topic: 'PEEL Literature Essay Structure',
      title: 'Past Paper Model Literature Essay & Marker Rubric',
      resource_type: 'past_paper',
      difficulty: 'Distinction',
      summary: 'Annotated 88%-scoring student essay showing thesis framing, embedded quotes, and cohesive transitions.',
      content_body: `### What Separates an 85% Essay from a 58% Essay?
Markers reward **argument**, not plot summary. Assume the examiner already knows the story!

### Annotated Model PEEL Paragraph
- **[P] Point:** *Ambition initially elevates the protagonist’s courage, yet unchecked pride gradually erodes his moral compass.*
- **[E] Evidence:** *Even before acting, he admits to "vaulting ambition, which o’erleaps itself,"*
- **[E] Explanation:** *The equestrian metaphor of jumping too high and falling on the other side foreshadows that his downfall stems from internal excess rather than fate alone.*
- **[L] Link:** *Consequently, the text warns that ambition divorced from ethical restraint leads inevitably to isolation.*`,
      key_formulas: [
        'Thesis = Claim + 3 Analytical Pillars',
        'PEEL = Point · Evidence · Explanation · Link',
        'Quote Length ≤ 6 words embedded mid-sentence'
      ],
      author_name: 'Mrs. Claire Jacobs'
    }
  ];

  const resource_progress = [
    { id: 'rp-1', resource_id: 'res-1', student_id: 'stu-thabo', bookmarked: true, completed: true },
    { id: 'rp-2', resource_id: 'res-2', student_id: 'stu-thabo', bookmarked: true, completed: false },
    { id: 'rp-3', resource_id: 'res-3', student_id: 'stu-thabo', bookmarked: false, completed: true },
    { id: 'rp-4', resource_id: 'res-5', student_id: 'stu-thabo', bookmarked: true, completed: true }
  ];

  const quizzes = [
    {
      id: 'qz-math-quad',
      subject_id: 'sub-math',
      topic: 'Quadratic Equations & Inequalities',
      title: 'Quadratics, Roots & Inequalities Sprint',
      description: 'Test your confidence on factorising, discriminant nature of roots, and quadratic sign intervals.',
      time_limit_mins: 10,
      difficulty: 'Core',
      author_name: 'Ms. Naledi Khumalo',
      questions: [
        {
          id: 'q1',
          prompt: 'Solve for x:  x² - 5x - 14 = 0',
          options: ['x = 7 or x = -2', 'x = -7 or x = 2', 'x = 7 or x = 2', 'x = -7 or x = -2'],
          correct_index: 0,
          hint: 'Find two factors of -14 that add up to -5.',
          explanation: 'Factorise (x - 7)(x + 2) = 0, giving x = 7 or x = -2.'
        },
        {
          id: 'q2',
          prompt: 'What is the discriminant (Δ) of 2x² - 4x + 2 = 0, and what does it tell us about the roots?',
          options: [
            'Δ = 0; real and equal roots',
            'Δ = 32; real, irrational, unequal roots',
            'Δ = -16; non-real roots',
            'Δ = 16; real, rational, unequal roots'
          ],
          correct_index: 0,
          hint: 'Calculate Δ = b² - 4ac with a = 2, b = -4, c = 2.',
          explanation: 'Δ = (-4)² - 4(2)(2) = 16 - 16 = 0. When Δ = 0, the roots are real, rational, and equal (x = 1).'
        },
        {
          id: 'q3',
          prompt: 'Solve the inequality:  (x - 3)(x + 4) < 0',
          options: ['-4 < x < 3', 'x < -4 or x > 3', '-3 < x < 4', 'x ≤ -4 or x ≥ 3'],
          correct_index: 0,
          hint: 'Critical values are -4 and 3. A positive parabola is negative (< 0) BETWEEN its x-intercepts.',
          explanation: 'The roots are x = -4 and x = 3. Because the parabola opens upwards (a > 0), (x - 3)(x + 4) < 0 holds strictly between the roots: -4 < x < 3.'
        },
        {
          id: 'q4',
          prompt: 'Find the x-coordinate of the turning point of f(x) = -x² + 6x - 5.',
          options: ['x = 3', 'x = -3', 'x = 6', 'x = -5'],
          correct_index: 0,
          hint: 'Use x_TP = -b / (2a) carefully watching the negative sign on a = -1.',
          explanation: 'Here a = -1 and b = 6, so x_TP = -(6) / (2 × -1) = -6 / -2 = 3.'
        }
      ]
    },
    {
      id: 'qz-math-trig',
      subject_id: 'sub-math',
      topic: 'Trigonometry & Identities',
      title: 'Trig Reduction & Fundamental Identities Check',
      description: 'Sharpen CAST quadrant signs and core Pythagorean trig simplifications.',
      time_limit_mins: 10,
      difficulty: 'Exam Prep',
      author_name: 'Ms. Naledi Khumalo',
      questions: [
        {
          id: 't1',
          prompt: 'Simplify completely:  1 - cos²(θ)',
          options: ['sin²(θ)', 'tan²(θ)', '-sin²(θ)', 'cos(2θ)'],
          correct_index: 0,
          hint: 'Rearrange the fundamental identity sin²θ + cos²θ = 1.',
          explanation: 'Since sin²θ + cos²θ = 1, subtracting cos²θ from both sides gives 1 - cos²θ = sin²θ.'
        },
        {
          id: 't2',
          prompt: 'Using reduction formulae, cos(180° - θ) simplifies to:',
          options: ['-cos(θ)', 'cos(θ)', 'sin(θ)', '-sin(θ)'],
          correct_index: 0,
          hint: '180° - θ lies in Quadrant II where only Sine is positive.',
          explanation: '180° - θ is in Quadrant II. Cosine is negative in Quadrant II, so cos(180° - θ) = -cos(θ).'
        },
        {
          id: 't3',
          prompt: 'Simplify:  cos(θ) × tan(θ)',
          options: ['sin(θ)', '1 / sin(θ)', 'cos²(θ)', '1'],
          correct_index: 0,
          hint: 'Rewrite tan(θ) as sin(θ) / cos(θ).',
          explanation: 'cos(θ) × (sin(θ) / cos(θ)) cancels cos(θ), leaving sin(θ).'
        },
        {
          id: 't4',
          prompt: 'In which quadrant is sin(θ) < 0 AND tan(θ) > 0?',
          options: ['Quadrant III (180° to 270°)', 'Quadrant II (90° to 180°)', 'Quadrant IV (270° to 360°)', 'Quadrant I (0° to 90°)'],
          correct_index: 0,
          hint: 'Think CAST: where is Tangent positive while Sine is negative?',
          explanation: 'In Quadrant III (T in CAST), tan(θ) > 0 while both sin(θ) < 0 and cos(θ) < 0.'
        }
      ]
    },
    {
      id: 'qz-phys-newton',
      subject_id: 'sub-phys',
      topic: 'Newton’s Laws & Free-Body Diagrams',
      title: 'Newton’s Laws & Circuits Confidence Quiz',
      description: 'Core conceptual and calculation questions on net force, inertia, and Ohm’s Law.',
      time_limit_mins: 12,
      difficulty: 'Core',
      author_name: 'Ms. Naledi Khumalo',
      questions: [
        {
          id: 'p1',
          prompt: 'A 5 kg crate is pulled horizontally by a 30 N force against a 10 N frictional force. What is its acceleration?',
          options: ['4 m·s⁻²', '6 m·s⁻²', '8 m·s⁻²', '2 m·s⁻²'],
          correct_index: 0,
          hint: 'First find F_net = F_applied - f, then divide by mass m.',
          explanation: 'F_net = 30 - 10 = 20 N. By Newton’s Second Law, a = F_net / m = 20 / 5 = 4 m·s⁻².'
        },
        {
          id: 'p2',
          prompt: 'If a box slides at CONSTANT velocity across a rough floor, what is the net force acting on it?',
          options: ['0 N', 'Equal to its weight mg', 'Greater than friction', 'Equal to mass × velocity'],
          correct_index: 0,
          hint: 'Constant velocity means acceleration a = 0 m·s⁻².',
          explanation: 'Constant velocity implies zero acceleration (a = 0). Therefore F_net = m × 0 = 0 N.'
        },
        {
          id: 'p3',
          prompt: 'Two 6 Ω resistors are connected in parallel. What is their equivalent resistance?',
          options: ['3 Ω', '12 Ω', '6 Ω', '0.33 Ω'],
          correct_index: 0,
          hint: 'Use 1/R_p = 1/6 + 1/6, then invert!',
          explanation: '1/R_p = 1/6 + 1/6 = 2/6 = 1/3, so R_p = 3 Ω (two identical resistors in parallel always halve the resistance).'
        }
      ]
    },
    {
      id: 'qz-acct-core',
      subject_id: 'sub-acct',
      topic: 'Accounting Equation & Double Entry',
      title: 'Accounting Equation & Adjustments Check',
      description: 'Verify your grasp of double-entry impacts and year-end adjustments.',
      time_limit_mins: 8,
      difficulty: 'Core',
      author_name: 'Mr. Sipho Ndlovu',
      questions: [
        {
          id: 'a1',
          prompt: 'The business pays stationary of 800 by EFT. How does this affect Assets, Owner’s Equity, and Liabilities?',
          options: [
            'Assets decrease; Owner’s Equity decreases; Liabilities unchanged',
            'Assets increase; Owner’s Equity decreases; Liabilities unchanged',
            'Assets decrease; Owner’s Equity unchanged; Liabilities decrease',
            'Assets unchanged; Owner’s Equity decreases; Liabilities increase'
          ],
          correct_index: 0,
          hint: 'Bank (Asset) goes down, and Stationery is an Expense which reduces Owner’s Equity.',
          explanation: 'Cash in Bank decreases (Asset -), and Stationery expense reduces profit and therefore Owner’s Equity (OE -). Liabilities = 0.'
        },
        {
          id: 'a2',
          prompt: 'Insurance includes an amount paid in advance for the next financial year. At year-end this adjustment creates a:',
          options: ['Current Asset (Prepaid Expense)', 'Current Liability (Accrued Expense)', 'Fixed Asset', 'Owner’s Drawings entry'],
          correct_index: 0,
          hint: 'You have already paid for a future benefit owned by the business.',
          explanation: 'Prepaid expenses represent future economic benefit already paid for, classified under Trade & Other Receivables (Current Asset).'
        },
        {
          id: 'a3',
          prompt: 'If Current Assets = 90,000 and Current Liabilities = 45,000, what is the Current Ratio?',
          options: ['2 : 1', '1 : 2', '45 : 1', '0.5 : 1'],
          correct_index: 0,
          hint: 'Divide both sides of Current Assets : Current Liabilities by Current Liabilities.',
          explanation: '90,000 : 45,000 simplifies cleanly to 2 : 1.'
        }
      ]
    }
  ];

  const quiz_attempts = [
    {
      id: 'qa-1',
      quiz_id: 'qz-math-quad',
      student_id: 'stu-thabo',
      score_percent: 100,
      correct_count: 4,
      total_count: 4,
      answers: [0, 0, 0, 0],
      duration_secs: 265,
      confidence_after: 'confident',
      created_at: isoOffsetHours(-40)
    },
    {
      id: 'qa-2',
      quiz_id: 'qz-math-trig',
      student_id: 'stu-thabo',
      score_percent: 50,
      correct_count: 2,
      total_count: 4,
      answers: [0, 1, 0, 2],
      duration_secs: 380,
      confidence_after: 'stuck',
      created_at: isoOffsetHours(-22)
    },
    {
      id: 'qa-3',
      quiz_id: 'qz-phys-newton',
      student_id: 'stu-thabo',
      score_percent: 67,
      correct_count: 2,
      total_count: 3,
      answers: [0, 0, 1],
      duration_secs: 310,
      confidence_after: 'building',
      created_at: isoOffsetHours(-70)
    },
    {
      id: 'qa-4',
      quiz_id: 'qz-acct-core',
      student_id: 'stu-thabo',
      score_percent: 100,
      correct_count: 3,
      total_count: 3,
      answers: [0, 0, 0],
      duration_secs: 195,
      confidence_after: 'confident',
      created_at: isoOffsetHours(-60)
    },
    {
      id: 'qa-5',
      quiz_id: 'qz-math-quad',
      student_id: 'stu-amahle',
      score_percent: 100,
      correct_count: 4,
      total_count: 4,
      answers: [0, 0, 0, 0],
      duration_secs: 190,
      confidence_after: 'confident',
      created_at: isoOffsetHours(-30)
    },
    {
      id: 'qa-6',
      quiz_id: 'qz-math-quad',
      student_id: 'stu-liam',
      score_percent: 50,
      correct_count: 2,
      total_count: 4,
      answers: [0, 2, 1, 0],
      duration_secs: 420,
      confidence_after: 'stuck',
      created_at: isoOffsetHours(-18)
    }
  ];

  const assignments = [
    {
      id: 'asg-1',
      subject_id: 'sub-math',
      topic: 'Trigonometry & Identities',
      title: 'Trig Identity Proofs & General Solutions Set A',
      instructions: 'Complete all 3 questions showing every algebraic step:\n1. Simplify sin(180° - x)·cos(90° - x) + cos²(x).\n2. Prove that (1 - sin²x) / (cos x · sin x) = 1 / tan x.\n3. Determine the general solution of 2sin(x) - 1 = 0.',
      due_at: isoOffsetHours(28),
      max_marks: 20,
      author_name: 'Ms. Naledi Khumalo'
    },
    {
      id: 'asg-2',
      subject_id: 'sub-phys',
      topic: 'Newton’s Laws & Free-Body Diagrams',
      title: 'Inclined Plane Force Resolution Worksheet',
      instructions: 'A 10 kg crate is pulled up a 30° incline by an 80 N force parallel to the slope (kinetic friction = 12 N). Write out all horizontal-to-slope forces and calculate the crate’s acceleration.',
      due_at: isoOffsetHours(52),
      max_marks: 15,
      author_name: 'Ms. Naledi Khumalo'
    },
    {
      id: 'asg-3',
      subject_id: 'sub-math',
      topic: 'Quadratic Equations & Inequalities',
      title: 'Quadratic Inequalities & Nature of Roots Drill',
      instructions: 'Solve 2x² - 7x + 3 ≤ 0 using a critical-value sketch, and find the value(s) of k for which x² - 6x + k = 0 has equal real roots.',
      due_at: isoOffsetHours(-24),
      max_marks: 20,
      author_name: 'Ms. Naledi Khumalo'
    },
    {
      id: 'asg-4',
      subject_id: 'sub-eng',
      topic: 'PEEL Literature Essay Structure',
      title: 'Single PEEL Analytical Paragraph Practice',
      instructions: 'Write one polished 110–140 word PEEL body paragraph explaining how a character’s key decision reveals a central theme in your setwork.',
      due_at: isoOffsetHours(-48),
      max_marks: 15,
      author_name: 'Mrs. Claire Jacobs'
    }
  ];

  const submissions = [
    {
      id: 'subm-1',
      assignment_id: 'asg-3',
      student_id: 'stu-thabo',
      answer_text: '1) 2x² - 7x + 3 ≤ 0 → (2x - 1)(x - 3) ≤ 0. Critical values: x = 1/2 and x = 3. Parabola opens up, so 1/2 ≤ x ≤ 3.\n2) Equal roots require Δ = 0: (-6)² - 4(1)(k) = 0 → 36 - 4k = 0 → k = 9.',
      student_confidence: 'confident',
      status: 'graded',
      marks_awarded: 19,
      tutor_feedback: 'Spot-on working, Thabo! Your critical-value interval notation is crystal clear. Just state "for real equal roots, Δ = 0" as a full line in exams for the method mark.',
      submitted_at: isoOffsetHours(-32),
      graded_at: isoOffsetHours(-26)
    },
    {
      id: 'subm-2',
      assignment_id: 'asg-4',
      student_id: 'stu-thabo',
      answer_text: 'Point: Moral courage requires standing firm even when peers conform. Evidence: The narrator notes her "quiet refusal to sign" during the assembly. Explanation: The adjective "quiet" highlights that true conviction relies on principle rather than spectacle. Link: Thus, the moment cements integrity as the novel’s guiding moral anchor.',
      student_confidence: 'confident',
      status: 'graded',
      marks_awarded: 14,
      tutor_feedback: 'Excellent embedded quote and word-level analysis of "quiet"! You hit all 4 PEEL elements cleanly.',
      submitted_at: isoOffsetHours(-56),
      graded_at: isoOffsetHours(-49)
    },
    {
      id: 'subm-3',
      assignment_id: 'asg-2',
      student_id: 'stu-amahle',
      answer_text: 'W_parallel = 10 × 9.8 × sin(30°) = 49 N down slope. F_net = F_app - W_parallel - f_k = 80 - 49 - 12 = 19 N up slope. a = 19 / 10 = 1.9 m·s⁻² up the incline.',
      student_confidence: 'confident',
      status: 'submitted',
      marks_awarded: null,
      tutor_feedback: '',
      submitted_at: isoOffsetHours(-5),
      graded_at: null
    }
  ];

  const coach_messages = [
    {
      id: 'cm-1',
      student_id: 'stu-thabo',
      subject_id: 'sub-math',
      topic: 'Trigonometry & Identities',
      mode: 'step_by_step',
      sender: 'coach',
      content: 'Welcome back, Thabo! Your Quadratics & Accounting confidence are shining above 90%, while **Trigonometry & Identities** is your #1 growth opportunity before today’s class. Paste any equation, trig expression, physics problem, or essay prompt — I’ll walk through it step-by-step with you.',
      steps: [
        'Tip 1: Try typing an equation like "2x^2 - 7x + 3 = 0" for an instant algebraic walkthrough.',
        'Tip 2: Switch to "Socratic Hint Only" when doing homework so you build genuine exam muscle!',
        'Tip 3: Tap "Generate Practice Problem" anytime to test yourself.'
      ],
      follow_up_prompt: 'Want to warm up with a quick Trigonometry reduction problem before class?'
    }
  ];

  const announcements = [
    {
      id: 'ann-1',
      subject_id: 'sub-math',
      title: 'Term Exam Readiness Sprint Week — Past Paper Clinic',
      body: 'All Grade 10–12 learners are invited to Saturday’s guided Past Paper Clinic (09:00–11:30). Bring your scientific calculator and bookmark your Weak-Spot Radar topics inside the Study Vault beforehand!',
      author_name: 'Ms. Naledi Khumalo',
      audience: 'all',
      pinned: true,
      created_at: isoOffsetHours(-14)
    },
    {
      id: 'ann-2',
      subject_id: 'sub-phys',
      title: 'New Worked Pulley & Inclined Plane Guide Added',
      body: 'Just uploaded the step-by-step two-block pulley worked example into the Physical Sciences Study Vault. Review Steps 2–4 before tomorrow’s Mechanics session.',
      author_name: 'Ms. Naledi Khumalo',
      audience: 'students',
      pinned: false,
      created_at: isoOffsetHours(-8)
    }
  ];

  const messages = [
    {
      id: 'msg-1',
      student_id: 'stu-thabo',
      channel: 'tutor_parent',
      sender_id: 'tut-naledi',
      sender_name: 'Ms. Naledi Khumalo',
      sender_role: 'tutor',
      body: 'Good afternoon Ms. Mokoena! Quick update on Thabo: he scored 100% on his Quadratics quiz and 19/20 on his latest Maths assignment. This week we are doing a 1-on-1 push on Trigonometry identities and Newton’s inclined planes to lift those above 80% too.',
      created_at: isoOffsetHours(-20)
    },
    {
      id: 'msg-2',
      student_id: 'stu-thabo',
      channel: 'tutor_parent',
      sender_id: 'par-grace',
      sender_name: 'Grace Mokoena',
      sender_role: 'parent',
      body: 'Thank you so much Ms. Khumalo! Seeing his confidence grow in Maths at home has been wonderful. He is already reviewing his Trig checklist tonight.',
      created_at: isoOffsetHours(-16)
    },
    {
      id: 'msg-3',
      student_id: 'stu-thabo',
      channel: 'tutor_student',
      sender_id: 'stu-thabo',
      sender_name: 'Thabo Mokoena',
      sender_role: 'student',
      body: 'Hi Ms. Khumalo, for Question 2 on the Trig homework, should I convert 1/tan(x) on the RHS as well, or only work on the LHS?',
      created_at: isoOffsetHours(-6)
    },
    {
      id: 'msg-4',
      student_id: 'stu-thabo',
      channel: 'tutor_student',
      sender_id: 'tut-naledi',
      sender_name: 'Ms. Naledi Khumalo',
      sender_role: 'tutor',
      body: 'Great question, Thabo! Keep all your working strictly on the LHS: simplify 1 - sin²x to cos²x, cancel cos x, and remember cos x / sin x equals 1 / tan x!',
      created_at: isoOffsetHours(-5)
    }
  ];

  return {
    users,
    subjects,
    sessions,
    attendance,
    help_requests,
    resources,
    resource_progress,
    quizzes,
    quiz_attempts,
    assignments,
    submissions,
    coach_messages,
    announcements,
    messages
  };
}
