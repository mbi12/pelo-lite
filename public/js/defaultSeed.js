export function createDefaultSnapshot() {
  return {
    profiles: [
      {
        id: 'stu-thabo',
        name: 'Thabo Mokoena',
        role: 'student',
        subtitle: 'Grade 12 · STEM Stream',
        grade: 'Grade 12',
        pin: '1234'
      },
      {
        id: 'stu-amahle',
        name: 'Amahle Nkosi',
        role: 'student',
        subtitle: 'Grade 12 · Commerce & Maths',
        grade: 'Grade 12',
        pin: '1234'
      },
      {
        id: 'stu-liam',
        name: 'Liam van der Merwe',
        role: 'student',
        subtitle: 'Grade 11 · Sciences',
        grade: 'Grade 11',
        pin: '1234'
      },
      {
        id: 'par-grace',
        name: 'Mrs. Grace Mokoena',
        role: 'parent',
        subtitle: 'Parent of Thabo Mokoena (Grade 12)',
        grade: 'Grade 12',
        pin: '1234'
      },
      {
        id: 'tch-naledi',
        name: 'Ms. Naledi Khumalo',
        role: 'teacher',
        subtitle: 'Mathematics Educator',
        grade: 'Grades 10–12',
        pin: '1234'
      },
      {
        id: 'tch-sipho',
        name: 'Mr. Sipho Ndlovu',
        role: 'teacher',
        subtitle: 'Physical Sciences Educator',
        grade: 'Grades 10–12',
        pin: '1234'
      },
      {
        id: 'tch-claire',
        name: 'Mrs. Claire Jacobs',
        role: 'teacher',
        subtitle: 'Accounting & English Educator',
        grade: 'Grades 10–12',
        pin: '1234'
      },
      {
        id: 'admin-1',
        name: 'Kgomotso Dlamini',
        role: 'admin',
        subtitle: 'i-tutor Academy Admin',
        grade: 'All Grades',
        pin: '1234'
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
        location_mode: 'Studio A · Saved Offline',
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
        location_mode: 'Lab 2 · Saved Offline',
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
        location_mode: 'Room B1 · Saved Offline',
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
          'OFFLINE WORKSHEET PACK (Downloaded to device):\n1) Prove: (1 - cos 2x) / sin 2x = tan x  [8 marks]\n2) Simplify without a calculator: sin 75° · cos 15° + cos 75° · sin 15°  [10 marks]\n3) Determine general solution: 2 sin²x - sin x - 1 = 0  [12 marks]\nFormula Reminder: sin(2x) = 2 sin x cos x  |  cos(2x) = 1 - 2 sin²x'
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
          'OFFLINE WORKSHEET PACK (Downloaded to device):\n• Block A (4 kg) rests on a rough horizontal table (μ_k = 0.25) connected over a light frictionless pulley to hanging Block B (6 kg).\n1) State Newton’s Second Law in words. [4 marks]\n2) Write separate F_net = ma equations for Block A and Block B. [16 marks]\n3) Calculate acceleration a and tension T in the string. [20 marks]'
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
        body: 'Hi Thabo! I uploaded Remote Worksheet 4 so it downloads straight to your phone for offline practice tonight.',
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
        body: 'Meeting here at 18:00 to compare free-body diagrams for the pulley assignment!',
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
      plans: [
        {
          id: 'plan-single',
          name: 'Single Subject Boost',
          price: 'R450 / month',
          badge: 'Grades 8 – 12',
          features: [
            '2 Afternoon Tuition Classes per week',
            'Offline Timetable & Remote Teacher Assignments',
            'Direct Teacher Chat & Student Study Groups'
          ]
        },
        {
          id: 'plan-bundle',
          name: '3-Subject Core Package',
          price: 'R1,100 / month',
          badge: 'Most Popular',
          features: [
            'Choose any 3 subjects (Maths, Sciences, Accounting, English)',
            'Saturday Exam Clinics & Full Offline Study Packs',
            'Marked Remote Assignments + Parent Broadcast Updates'
          ]
        },
        {
          id: 'plan-unlimited',
          name: 'Full Exam Mastery (All Subjects)',
          price: 'R1,550 / month',
          badge: 'Complete Support',
          features: [
            'Unlimited Subject Classes + Past-Paper Boot Camps',
            'Priority 1-on-1 Teacher Messaging & Homework Grading',
            'Dedicated Parent Progress & Attendance Alerts'
          ]
        },
        {
          id: 'plan-private',
          name: '1-on-1 Private Mentoring',
          price: 'R220 / hour',
          badge: 'Flexible',
          features: [
            'Personalised individual sessions (In-person or Remote)',
            'Custom offline worksheets tailored to weak topics',
            'Flexible weekday or weekend scheduling'
          ]
        }
      ],
      contacts: {
        phone: '+27 11 482 9104',
        whatsapp: '+27 72 640 1189',
        email: 'admissions@i-tutor.academy',
        address: 'Suite 14, Sunrise Learning House, 48 Oxford Road',
        hours: 'Mon – Fri: 13:00 – 18:30  |  Sat: 08:30 – 14:00'
      }
    },
    enquiries: []
  };
}
