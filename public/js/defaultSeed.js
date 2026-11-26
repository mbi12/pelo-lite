export const SUBJECT_LIST = [
  'Mathematics',
  'Double Science',
  'Physical Sciences',
  'Setswana',
  'English',
  'Accounting',
  'Life Sciences'
];

export function createDefaultSnapshot() {
  return {
    profiles: [
      {
        id: 'admin-itutor',
        name: 'i-tutor Admin',
        role: 'admin',
        subtitle: 'Principal & Super Admin',
        grade: 'All Levels',
        pin: 'vinny@123',
        email: 'itutor@gmail.com',
        phone: '77 329 788',
        status: 'active',
        subjects: ['All Subjects'],
        selected_plan: 'Executive Admin',
        linked_student_id: '',
        notes: 'Primary i-tutor Owner & Super Admin account.'
      },
      {
        id: 'stu-thabo',
        name: 'Thabo Mokoena',
        role: 'student',
        subtitle: 'Grade 12 · STEM Stream',
        grade: 'Grade 12',
        pin: '1234',
        email: 'thabo@student.i-tutor.academy',
        phone: '+27 71 210 4401',
        status: 'active',
        subjects: ['Mathematics', 'Physical Sciences', 'Accounting'],
        selected_plan: '3-Subject Core Package',
        linked_student_id: '',
        notes: 'Prefers afternoon trigonometry & mechanics drills.'
      },
      {
        id: 'stu-amahle',
        name: 'Amahle Nkosi',
        role: 'student',
        subtitle: 'Grade 12 · Commerce & Maths',
        grade: 'Grade 12',
        pin: '1234',
        email: 'amahle@student.i-tutor.academy',
        phone: '+27 73 884 1920',
        status: 'active',
        subjects: ['Mathematics', 'Accounting', 'English'],
        selected_plan: '3-Subject Core Package',
        linked_student_id: '',
        notes: 'Top performer in Accounting adjustments.'
      },
      {
        id: 'stu-liam',
        name: 'Liam van der Merwe',
        role: 'student',
        subtitle: 'Grade 11 · Sciences',
        grade: 'Grade 11',
        pin: '1234',
        email: 'liam@student.i-tutor.academy',
        phone: '+27 82 419 7731',
        status: 'active',
        subjects: ['Mathematics', 'Physical Sciences', 'Life Sciences'],
        selected_plan: 'Full Exam Mastery (All Subjects)',
        linked_student_id: '',
        notes: 'Working on pulley free-body diagrams.'
      },
      {
        id: 'par-grace',
        name: 'Mrs. Grace Mokoena',
        role: 'parent',
        subtitle: 'Parent of Thabo Mokoena (Grade 12)',
        grade: 'Grade 12',
        pin: '1234',
        email: 'grace.mokoena@parent.co.za',
        phone: '+27 82 901 3340',
        status: 'active',
        subjects: ['Mathematics', 'Physical Sciences', 'Accounting'],
        selected_plan: '3-Subject Core Package',
        linked_student_id: 'stu-thabo',
        notes: 'Receives weekly attendance & assessment updates.'
      },
      {
        id: 'tch-naledi',
        name: 'Ms. Naledi Khumalo',
        role: 'teacher',
        subtitle: 'Mathematics Educator',
        grade: 'Grades 10–12',
        pin: '1234',
        email: 'naledi@i-tutor.academy',
        phone: '+27 72 511 0822',
        status: 'active',
        subjects: ['Mathematics'],
        selected_plan: 'Educator Staff',
        linked_student_id: '',
        notes: 'Senior FET Mathematics Tutor.'
      },
      {
        id: 'tch-sipho',
        name: 'Mr. Sipho Ndlovu',
        role: 'teacher',
        subtitle: 'Physical Sciences Educator',
        grade: 'Grades 10–12',
        pin: '1234',
        email: 'sipho@i-tutor.academy',
        phone: '+27 76 309 4418',
        status: 'active',
        subjects: ['Physical Sciences', 'Life Sciences'],
        selected_plan: 'Educator Staff',
        linked_student_id: '',
        notes: 'Leads Physics & Chemistry boot camps.'
      },
      {
        id: 'tch-claire',
        name: 'Mrs. Claire Jacobs',
        role: 'teacher',
        subtitle: 'Accounting & English Educator',
        grade: 'Grades 10–12',
        pin: '1234',
        email: 'claire@i-tutor.academy',
        phone: '+27 83 614 9021',
        status: 'active',
        subjects: ['Accounting', 'English'],
        selected_plan: 'Educator Staff',
        linked_student_id: '',
        notes: 'Commerce & English essay specialist.'
      },
      {
        id: 'adm-lerato',
        name: 'Lerato Sithole',
        role: 'admissions',
        subtitle: 'Head of Admissions & Enrolment',
        grade: 'Admissions Office',
        pin: '1234',
        email: 'admissions@i-tutor.academy',
        phone: '+27 72 640 1189',
        status: 'active',
        subjects: ['All Subjects'],
        selected_plan: 'Admissions Staff',
        linked_student_id: '',
        notes: 'Accepts anyone joining & manages all academy records.'
      },
      {
        id: 'admin-1',
        name: 'Kgomotso Dlamini',
        role: 'admin',
        subtitle: 'i-tutor Principal & Super Admin',
        grade: 'All Levels',
        pin: '1234',
        email: 'i-tutor@gmail.com',
        phone: '77 329 788',
        status: 'active',
        subjects: ['All Subjects'],
        selected_plan: 'Executive Admin',
        linked_student_id: '',
        notes: 'Full control over flyers, prices, admissions, accounts & academy content.'
      },
      {
        id: 'app-siphesihle',
        name: 'Siphesihle Zulu',
        role: 'student',
        subtitle: 'Grade 11 Applicant · STEM',
        grade: 'Grade 11',
        pin: '1234',
        email: 'siphesihle@gmail.com',
        phone: '+27 82 555 0192',
        status: 'pending',
        subjects: ['Mathematics', 'Physical Sciences'],
        selected_plan: '3-Subject Core Package',
        linked_student_id: '',
        notes: 'Applying for afternoon Maths & Physical Sciences classes.'
      },
      {
        id: 'app-bongani',
        name: 'Mr. Bongani Dube',
        role: 'parent',
        subtitle: 'Parent Applicant (Grade 10 Learner)',
        grade: 'Grade 10',
        pin: '1234',
        email: 'bongani.dube@gmail.com',
        phone: '+27 83 712 4409',
        status: 'pending',
        subjects: ['Mathematics', 'Accounting'],
        selected_plan: 'Single Subject Boost',
        linked_student_id: '',
        notes: 'Would like weekly Saturday & Wednesday support for my daughter.'
      }
    ],
    timetables: [
      {
        id: 'tt-1',
        day_of_week: 'Monday',
        start_time: '15:30',
        end_time: '17:00',
        subject: 'Mathematics',
        topic: 'Trigonometry Identities & Double Angles',
        teacher_name: 'Ms. Naledi Khumalo',
        location_mode: 'Studio A · Auto-Saved Offline',
        grade_group: 'Grade 12',
        owner_id: null,
        is_official: true
      },
      {
        id: 'tt-2',
        day_of_week: 'Tuesday',
        start_time: '15:30',
        end_time: '17:00',
        subject: 'Physical Sciences',
        topic: 'Newton’s Laws & Free-Body Diagrams',
        teacher_name: 'Mr. Sipho Ndlovu',
        location_mode: 'Lab 2 · Auto-Saved Offline',
        grade_group: 'Grade 12',
        owner_id: null,
        is_official: true
      },
      {
        id: 'tt-3',
        day_of_week: 'Wednesday',
        start_time: '16:00',
        end_time: '17:30',
        subject: 'Accounting',
        topic: 'Year-End Adjustments & Balance Sheet',
        teacher_name: 'Mrs. Claire Jacobs',
        location_mode: 'Room B1 · Auto-Saved Offline',
        grade_group: 'Grade 12',
        owner_id: null,
        is_official: true
      },
      {
        id: 'tt-4',
        day_of_week: 'Thursday',
        start_time: '15:30',
        end_time: '17:00',
        subject: 'Mathematics',
        topic: 'Analytical Geometry & Past Paper 2',
        teacher_name: 'Ms. Naledi Khumalo',
        location_mode: 'Remote Pack + Live Class',
        grade_group: 'Grade 12',
        owner_id: null,
        is_official: true
      },
      {
        id: 'tt-5',
        day_of_week: 'Friday',
        start_time: '15:00',
        end_time: '16:30',
        subject: 'Physical Sciences',
        topic: 'Stoichiometry & Limiting Reagents',
        teacher_name: 'Mr. Sipho Ndlovu',
        location_mode: 'Remote Pack + Live Class',
        grade_group: 'Grade 12',
        owner_id: null,
        is_official: true
      },
      {
        id: 'tt-6',
        day_of_week: 'Saturday',
        start_time: '09:00',
        end_time: '11:30',
        subject: 'Exam Boot Camp',
        topic: 'Mock Exam & Group Revision Clinic',
        teacher_name: 'All Educators',
        location_mode: 'Main Hall · Offline Pack Included',
        grade_group: 'Grade 11–12',
        owner_id: null,
        is_official: true
      }
    ],
    assignments: [
      {
        id: 'asg-1',
        title: 'Remote Worksheet 4: Proving Trig Identities',
        subject: 'Mathematics',
        grade_group: 'Grade 12',
        teacher_id: 'tch-naledi',
        teacher_name: 'Ms. Naledi Khumalo',
        due_date: '2026-11-28',
        max_marks: 30,
        instructions:
          'Complete Questions 1 to 3 even if you are studying offline at home. Show each step clearly from Left-Hand Side to Right-Hand Side.',
        offline_pack_content:
          'OFFLINE WORKSHEET PACK (Downloaded to device):\n1) Prove: (1 - cos 2x) / sin 2x = tan x  [8 marks]\n2) Simplify without a calculator: sin 75° · cos 15° + cos 75° · sin 15°  [10 marks]\n3) Determine general solution: 2 sin²x - sin x - 1 = 0  [12 marks]\nFormula Reminder: sin(2x) = 2 sin x cos x  |  cos(2x) = 1 - 2 sin²x',
        attachments: [
          {
            id: 'att-seed-pdf-1',
            name: 'Trig-Identities-Worksheet.pdf',
            kind: 'pdf',
            mime: 'application/pdf',
            size: 2940,
            url: '/samples/trig-identities-worksheet.pdf'
          }
        ]
      },
      {
        id: 'asg-2',
        title: 'Remote Practical Task: Two-Body Pulley Forces',
        subject: 'Physical Sciences',
        grade_group: 'Grade 12',
        teacher_id: 'tch-sipho',
        teacher_name: 'Mr. Sipho Ndlovu',
        due_date: '2026-11-30',
        max_marks: 40,
        instructions:
          'Read the downloaded scenario below, list all forces acting on Block A (4 kg) and Block B (6 kg), and calculate acceleration + rope tension.',
        offline_pack_content:
          'OFFLINE WORKSHEET PACK (Downloaded to device):\n• Block A (4 kg) rests on a rough horizontal table (μ_k = 0.25) connected over a light frictionless pulley to hanging Block B (6 kg).\n1) State Newton’s Second Law in words. [4 marks]\n2) Write separate F_net = ma equations for Block A and Block B. [16 marks]\n3) Calculate acceleration a and tension T in the string. [20 marks]',
        attachments: [
          {
            id: 'att-seed-img-1',
            name: 'Newton-Pulley-Diagram.svg',
            kind: 'image',
            mime: 'image/svg+xml',
            size: 2410,
            url: '/samples/newton-pulley-diagram.svg'
          }
        ]
      },
      {
        id: 'asg-3',
        title: 'Home Revision Exercise: Adjustments & Ratios',
        subject: 'Accounting',
        grade_group: 'Grade 12',
        teacher_id: 'tch-claire',
        teacher_name: 'Mrs. Claire Jacobs',
        due_date: '2026-12-02',
        max_marks: 25,
        instructions:
          'Complete the accrued expense and prepaid insurance adjustments offline and submit your final Net Profit calculation.',
        offline_pack_content:
          'OFFLINE WORKSHEET PACK (Downloaded to device):\n• Pre-adjustment Trial Balance shows Insurance = R15,600 (includes 1 month prepaid for next year) and Water & Electricity = R22,400 (December bill of R2,100 still unpaid).\n1) Calculate adjusted Insurance expense. [10 marks]\n2) Calculate adjusted Water & Electricity + Trade Payables impact. [15 marks]'
      }
    ],
    submissions: [
      {
        id: 'subm-1',
        assignment_id: 'asg-3',
        student_id: 'stu-thabo',
        student_name: 'Thabo Mokoena',
        answer_text:
          '1) Monthly insurance = 15,600 / 13 = R1,200 prepaid. Adjusted Insurance = R14,400.\n2) Water & Electricity = 22,400 + 2,100 = R24,500; Trade Payables increases by R2,100.',
        status: 'graded',
        marks_awarded: 24,
        teacher_feedback:
          'Excellent step-by-step working, Thabo! Dividing by 13 months for the 1-month prepayment was spot on.',
        submitted_at: '2026-11-25T10:15:00.000Z'
      }
    ],
    attendance: [
      {
        id: 'att-1',
        session_date: '2026-11-24',
        subject: 'Mathematics',
        student_id: 'stu-thabo',
        student_name: 'Thabo Mokoena',
        status: 'present',
        teacher_name: 'Ms. Naledi Khumalo',
        lesson_note: 'Strong participation on double-angle proofs.'
      },
      {
        id: 'att-2',
        session_date: '2026-11-24',
        subject: 'Mathematics',
        student_id: 'stu-amahle',
        student_name: 'Amahle Nkosi',
        status: 'present',
        teacher_name: 'Ms. Naledi Khumalo',
        lesson_note: 'Solved Q3 on the board cleanly.'
      },
      {
        id: 'att-3',
        session_date: '2026-11-25',
        subject: 'Physical Sciences',
        student_id: 'stu-thabo',
        student_name: 'Thabo Mokoena',
        status: 'present',
        teacher_name: 'Mr. Sipho Ndlovu',
        lesson_note: 'Completed free-body pulley diagram.'
      },
      {
        id: 'att-4',
        session_date: '2026-11-25',
        subject: 'Physical Sciences',
        student_id: 'stu-liam',
        student_name: 'Liam van der Merwe',
        status: 'late',
        teacher_name: 'Mr. Sipho Ndlovu',
        lesson_note: 'Arrived 10m late; caught up on tension calculations.'
      }
    ],
    notes: [
      {
        id: 'note-trig',
        subject: 'Mathematics',
        title: 'Trigonometry Identities & Double Angles',
        formulas: [
          'sin²θ + cos²θ = 1',
          'tan θ = sin θ / cos θ',
          'sin(2θ) = 2 sin θ cos θ',
          'cos(2θ) = cos²θ − sin²θ = 2cos²θ − 1 = 1 − 2sin²θ'
        ],
        summary:
          'Always convert tan θ into sin θ / cos θ first when proving identities, factor common terms, and look for sin²θ + cos²θ = 1 before expanding brackets.',
        author_name: 'Ms. Naledi Khumalo'
      },
      {
        id: 'note-quad',
        subject: 'Mathematics',
        title: 'Quadratic Formula & Turning Points',
        formulas: [
          'x = [ −b ± √(b² − 4ac) ] / (2a)',
          'Turning point x = −b / (2a)',
          'Δ = b² − 4ac'
        ],
        summary:
          'Write every quadratic in standard form ax² + bx + c = 0 before reading a, b, and c. Check the discriminant Δ first to determine the nature of roots.',
        author_name: 'Ms. Naledi Khumalo'
      },
      {
        id: 'note-newton',
        subject: 'Physical Sciences',
        title: 'Newton’s Laws & Net Force',
        formulas: ['F_net = m · a', 'w = m · g  (g = 9.8 m·s⁻²)', 'f_k = μ_k · N'],
        summary:
          'Draw a labelled free-body diagram before writing F_net = ma. Resolve angled forces into parallel and perpendicular components first.',
        author_name: 'Mr. Sipho Ndlovu'
      },
      {
        id: 'note-mole',
        subject: 'Physical Sciences',
        title: 'Stoichiometry & Mole Ratios',
        formulas: [
          'n = m / M',
          'c = n / V  (V in dm³)',
          'n = V / V_m  (STP V_m = 22.4 dm³·mol⁻¹)'
        ],
        summary:
          'Convert cm³ to dm³ by dividing by 1000. Divide moles available by balanced coefficients to identify the limiting reagent.',
        author_name: 'Mr. Sipho Ndlovu'
      },
      {
        id: 'note-acc',
        subject: 'Accounting',
        title: 'Accounting Equation & Year-End Adjustments',
        formulas: [
          'Assets = Owner’s Equity + Liabilities',
          'Gross Profit = Sales − Cost of Sales',
          'Current Ratio = Current Assets : Current Liabilities'
        ],
        summary:
          'Prepaid expenses belong to the next financial year (deduct from expense, add to receivables). Accrued expenses add to both the expense and payables.',
        author_name: 'Mrs. Claire Jacobs'
      },
      {
        id: 'note-essay',
        subject: 'English',
        title: 'PEEL Analytical Essay Structure',
        formulas: [
          'P — Point (Topic claim)',
          'E — Evidence (Embedded quote)',
          'E — Explain (Language & effect)',
          'L — Link (Tie to prompt)'
        ],
        summary:
          'Avoid retelling the plot. Name the exact literary device (metaphor, irony, tone shift) and unpack its effect on the reader.',
        author_name: 'Mrs. Claire Jacobs'
      }
    ],
    quizzes: [
      {
        id: 'q-1',
        subject: 'Mathematics',
        topic: 'Trigonometry',
        question: 'Which expression is always equal to sin²θ + cos²θ for any real angle θ?',
        options: ['0', '1', '2 sin θ cos θ', 'tan²θ'],
        correct_index: 1,
        correctIndex: 1,
        explanation: 'By the Pythagorean identity, sin²θ + cos²θ = 1 for all angles θ.'
      },
      {
        id: 'q-2',
        subject: 'Mathematics',
        topic: 'Trigonometry',
        question: 'What is the simplified double-angle expansion for sin(2θ)?',
        options: ['sin²θ − cos²θ', '2 sin θ cos θ', '2 cos²θ − 1', 'sin θ + cos θ'],
        correct_index: 1,
        correctIndex: 1,
        explanation: 'sin(2θ) expands directly to 2 sin θ cos θ.'
      },
      {
        id: 'q-3',
        subject: 'Mathematics',
        topic: 'Functions',
        question: 'For f(x) = 2x² − 8x + 5, what is the x-coordinate of the turning point?',
        options: ['x = −2', 'x = 2', 'x = 4', 'x = −4'],
        correct_index: 1,
        correctIndex: 1,
        explanation: 'Using x = −b / (2a) = −(−8) / (2 × 2) = 8 / 4 = 2.'
      },
      {
        id: 'q-4',
        subject: 'Physical Sciences',
        topic: 'Mechanics',
        question: 'A 4 kg block accelerates at 3 m·s⁻² on a frictionless surface. What is F_net?',
        options: ['0.75 N', '7 N', '12 N', '39.2 N'],
        correct_index: 2,
        correctIndex: 2,
        explanation: 'F_net = m × a = 4 kg × 3 m·s⁻² = 12 N.'
      },
      {
        id: 'q-5',
        subject: 'Physical Sciences',
        topic: 'Stoichiometry',
        question: 'How many dm³ are in 250 cm³ when calculating molar concentration c = n / V?',
        options: ['0.025 dm³', '0.25 dm³', '2.5 dm³', '25 dm³'],
        correct_index: 1,
        correctIndex: 1,
        explanation: 'Divide cm³ by 1000: 250 / 1000 = 0.25 dm³.'
      },
      {
        id: 'q-6',
        subject: 'Accounting',
        topic: 'Financial Statements',
        question: 'If Assets = 150,000 and Liabilities = 45,000, what is Owner’s Equity?',
        options: ['195,000', '105,000', '45,000', '150,000'],
        correct_index: 1,
        correctIndex: 1,
        explanation: 'Owner’s Equity = Assets − Liabilities = 150,000 − 45,000 = 105,000.'
      },
      {
        id: 'q-7',
        subject: 'Life Sciences',
        topic: 'Genetics',
        question: 'In mRNA, which base pairs with Adenine (A) on the DNA template strand?',
        options: ['Thymine (T)', 'Uracil (U)', 'Cytosine (C)', 'Guanine (G)'],
        correct_index: 1,
        correctIndex: 1,
        explanation: 'RNA uses Uracil (U) instead of Thymine, so DNA Adenine pairs with mRNA Uracil.'
      },
      {
        id: 'q-8',
        subject: 'English',
        topic: 'Essays',
        question: 'In a PEEL body paragraph, what comes immediately after your Evidence quote?',
        options: [
          'A brand-new unrelated topic',
          'Explanation of how the diction/device proves your point',
          'The bibliography',
          'A full plot summary'
        ],
        correct_index: 1,
        correctIndex: 1,
        explanation: 'Explain unpacks how the quote’s language or literary device supports your argument.'
      }
    ],
    flashcards: [
      {
        id: 'fc-1',
        subject: 'Mathematics',
        front: 'How do you rewrite tan θ when proving trig identities?',
        back: 'tan θ = sin θ / cos θ   (where cos θ ≠ 0)',
        mastered: true
      },
      {
        id: 'fc-2',
        subject: 'Mathematics',
        front: 'Three forms of cos(2θ)?',
        back: '1) cos²θ − sin²θ\n2) 2cos²θ − 1\n3) 1 − 2sin²θ',
        mastered: false
      },
      {
        id: 'fc-3',
        subject: 'Physical Sciences',
        front: 'State Newton’s Second Law in words & formula.',
        back: 'F_net = m · a — Net force equals mass times acceleration in the direction of the net force.',
        mastered: false
      },
      {
        id: 'fc-4',
        subject: 'Accounting',
        front: 'How do you adjust an Accrued Expense at year-end?',
        back: 'ADD to the expense in the Income Statement and record under Trade & Other Payables.',
        mastered: true
      },
      {
        id: 'fc-5',
        subject: 'Life Sciences',
        front: 'Where does Translation occur during protein synthesis?',
        back: 'At the Ribosome in the cytoplasm.',
        mastered: true
      },
      {
        id: 'fc-6',
        subject: 'English',
        front: 'What does PEEL stand for?',
        back: 'Point · Evidence · Explain · Link',
        mastered: true
      }
    ],
    rooms: [
      {
        id: 'room-tch-naledi',
        room_type: 'direct',
        name: 'Ms. Naledi Khumalo',
        subject: 'Mathematics Teacher',
        participant_ids: ['stu-thabo', 'par-grace', 'tch-naledi'],
        members_label: '1-on-1 Teacher Chat · Mathematics',
        created_by_name: 'Ms. Naledi Khumalo'
      },
      {
        id: 'room-tch-sipho',
        room_type: 'direct',
        name: 'Mr. Sipho Ndlovu',
        subject: 'Physical Sciences Teacher',
        participant_ids: ['stu-thabo', 'par-grace', 'tch-sipho'],
        members_label: '1-on-1 Teacher Chat · Physical Sciences',
        created_by_name: 'Mr. Sipho Ndlovu'
      },
      {
        id: 'room-tch-claire',
        room_type: 'direct',
        name: 'Mrs. Claire Jacobs',
        subject: 'Accounting & English Teacher',
        participant_ids: ['stu-thabo', 'par-grace', 'tch-claire'],
        members_label: '1-on-1 Teacher Chat · Accounting',
        created_by_name: 'Mrs. Claire Jacobs'
      },
      {
        id: 'room-grp-trig',
        room_type: 'group',
        name: 'Grade 12 Maths Trig Study Group',
        subject: 'Mathematics',
        participant_ids: ['stu-thabo', 'stu-amahle', 'stu-liam', 'tch-naledi'],
        members_label: '4 members · Thabo, Amahle, Liam, Ms. Khumalo',
        created_by_name: 'Thabo Mokoena'
      },
      {
        id: 'room-grp-sci',
        room_type: 'group',
        name: 'Physical Sciences Paper 1 Squad',
        subject: 'Physical Sciences',
        participant_ids: ['stu-thabo', 'stu-amahle', 'stu-liam'],
        members_label: '3 members · Student Study Group',
        created_by_name: 'Amahle Nkosi'
      }
    ],
    messages: [
      {
        id: 'msg-1',
        room_id: 'room-tch-naledi',
        sender_id: 'tch-naledi',
        sender_name: 'Ms. Naledi Khumalo',
        sender_role: 'teacher',
        body: 'Hi Thabo! I attached the 2-page Worksheet 4 PDF below — tap it to open right inside the app even offline.',
        attachments: [
          {
            id: 'att-msg-pdf-1',
            name: 'Trig-Identities-Worksheet.pdf',
            kind: 'pdf',
            mime: 'application/pdf',
            size: 2940,
            url: '/samples/trig-identities-worksheet.pdf'
          }
        ],
        created_at: '2026-11-25T13:10:00.000Z'
      },
      {
        id: 'msg-2',
        room_id: 'room-tch-naledi',
        sender_id: 'stu-thabo',
        sender_name: 'Thabo Mokoena',
        sender_role: 'student',
        body: 'Thank you Ma’am! It already downloaded to my app — I am working through Question 2 now.',
        created_at: '2026-11-25T13:14:00.000Z'
      },
      {
        id: 'msg-3',
        room_id: 'room-grp-trig',
        sender_id: 'stu-amahle',
        sender_name: 'Amahle Nkosi',
        sender_role: 'student',
        body: 'Hey squad! For Q1 on the Trig worksheet, did everyone replace cos 2x with 1 - 2sin²x?',
        created_at: '2026-11-25T14:05:00.000Z'
      },
      {
        id: 'msg-4',
        room_id: 'room-grp-trig',
        sender_id: 'stu-thabo',
        sender_name: 'Thabo Mokoena',
        sender_role: 'student',
        body: 'Yes! Then 1 - (1 - 2sin²x) becomes 2sin²x on top and cancels cleanly with 2sin x cos x!',
        created_at: '2026-11-25T14:08:00.000Z'
      },
      {
        id: 'msg-5',
        room_id: 'room-grp-sci',
        sender_id: 'stu-liam',
        sender_name: 'Liam van der Merwe',
        sender_role: 'student',
        body: 'Here is the free-body diagram for the pulley homework — tap to zoom in!',
        attachments: [
          {
            id: 'att-msg-img-1',
            name: 'Newton-Pulley-Diagram.svg',
            kind: 'image',
            mime: 'image/svg+xml',
            size: 2410,
            url: '/samples/newton-pulley-diagram.svg'
          }
        ],
        created_at: '2026-11-25T15:20:00.000Z'
      }
    ],
    broadcasts: [
      {
        id: 'bc-1',
        title: 'Saturday Mock Exam Clinic Starts at 09:00',
        body: 'Dear Students & Parents: Saturday’s Maths & Physical Sciences revision clinic begins at 09:00 sharp. All remote revision packs are now live and will auto-download to students’ phones as soon as they connect.',
        author_name: 'Kgomotso Dlamini (Admin)',
        author_role: 'admin',
        audience: 'students_parents',
        priority: 'important',
        created_at: '2026-11-25T11:00:00.000Z'
      },
      {
        id: 'bc-2',
        title: 'New Remote Trig & Mechanics Assignments Posted',
        body: 'Grade 12 students: Remote Worksheet 4 (Maths) and the Pulley Practical Task (Sciences) have been sent out. You can complete and save your answers offline at home.',
        author_name: 'Ms. Naledi Khumalo',
        author_role: 'teacher',
        audience: 'students_parents',
        priority: 'normal',
        created_at: '2026-11-25T12:30:00.000Z'
      }
    ],
    tuitionInfo: {
      headline: 'Students Improve Through Tutoring.',
      intro:
        'Better understanding. Better results. Brighter future. Free extra lessons & homework assistance included!',
      registration_fee: 'P100',
      promo_banner:
        'WE OFFER FREE EXTRA LESSONS! — Homework assistance included · Experienced & caring tutors · Personalized attention',
      plans: [
        {
          id: 'plan-breakthrough',
          name: 'Breakthrough Classes (Standard 4 – 6)',
          price: 'P500 / month',
          numericRate: 500,
          badge: 'Standard 4 – 6',
          features: [
            'Setswana | English | Mathematics | Homework Support',
            'Standard 4 – 6: P500 a month',
            'All Subjects Package: P600 a month',
            'P100 at registration · Free extra lessons included'
          ]
        },
        {
          id: 'plan-jce',
          name: 'JCE Level (Junior Certificate)',
          price: 'From P200 / month',
          numericRate: 600,
          badge: 'JCE Level',
          features: [
            '1 Subject: P200 / month',
            'Science & Mathematics: P250 each',
            'Science & Mathematics Combo: P400 / month',
            'Core Subjects (5): P600 / month',
            'Core Subjects + 1 Optional + 2 Practicals: P1,300 / month'
          ]
        },
        {
          id: 'plan-bgcse-best6',
          name: 'BGCSE / IGCSE — Form 4 (Best 6)',
          price: 'P750.00 / month',
          numericRate: 750,
          badge: 'Most Popular',
          features: [
            'Form 4 Students — Best 6 Subjects Package (P750.00)',
            'Free extra lessons & homework assistance included',
            'Experienced and caring tutors · Personalized attention',
            'P100 once-off registration fee'
          ]
        },
        {
          id: 'plan-bgcse-subjects',
          name: 'BGCSE / IGCSE Subject Rates',
          price: 'P200 – P450 / month',
          numericRate: 300,
          badge: 'Part-Time & Full-Time',
          features: [
            'Double Science — Part-time: P400  |  Full-time: P450',
            'Mathematics — Part-time: P250  |  Full-time: P300',
            'Other Subjects — Part-time: P200  |  Full-time: P250',
            'P100 once-off registration fee'
          ]
        }
      ],
      flyers: [
        {
          id: 'flyer-official-2026',
          title: 'Official i-tutor Tuition & Registration Flyer',
          subtitle: 'Breakthrough (Std 4–6) · JCE · BGCSE / IGCSE · Registration Fee P100',
          badge: 'Official Flyer',
          attachment: {
            id: 'att-flyer-official-2026',
            name: 'i-tutor-Official-Prices-Flyer.jpg',
            kind: 'image',
            mime: 'image/jpeg',
            size: 166700,
            url: '/assets/itutor-official-flyer.jpg'
          },
          created_at: '2026-11-26T04:32:00.000Z'
        }
      ],
      contacts: {
        phone: '77 329 788',
        whatsapp: '+267 77 329 788',
        email: 'i-tutor@gmail.com',
        address: 'Francistown, Minestone Plot No. 1589, Botswana',
        hours: 'Mon – Fri: Afternoon & Extra Lessons  |  Sat: Revision Sessions'
      }
    },
    enquiries: []
  };
}
