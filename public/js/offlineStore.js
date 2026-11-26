import { createDefaultSnapshot, SUBJECT_LIST } from './defaultSeed.js';

const VAULT_KEY = 'itutor_offline_vault_v3';
const PERSONAL_KEY = 'itutor_personal_study_v3';
const OUTBOX_KEY = 'itutor_offline_outbox_v3';
const SESSION_KEY = 'itutor_session_v3';

export { SUBJECT_LIST };

function createDefaultPersonalState() {
  const seed = createDefaultSnapshot();
  return {
    dailyGoalTarget: 4,
    dailyCompleted: 2,
    streakDays: 5,
    focusMinutesToday: 25,
    subjectConfidence: {
      Mathematics: 78,
      'Physical Sciences': 72,
      Accounting: 85,
      'Life Sciences': 80,
      English: 76
    },
    flashcards: seed.flashcards,
    customQuizzes: [],
    bookmarkedNoteIds: ['note-trig', 'note-newton'],
    assignmentDrafts: {}, // { [assignmentId]: "saved offline work..." }
    scratchpad: 'sin(2x) = 2 sin x cos x\ncos(2x) = 1 - 2sin²x\nRemember to convert cm³ ÷ 1000 = dm³!',
    tasks: [
      { id: 'tk-1', title: 'Complete Trig Remote Worksheet 4', subject: 'Mathematics', done: false },
      { id: 'tk-2', title: 'Flip unmastered Mechanics Flashcards', subject: 'Physical Sciences', done: false },
      { id: 'tk-3', title: 'Review Year-End Adjustments Note', subject: 'Accounting', done: true },
      { id: 'tk-4', title: '25m Offline Focus Sprint', subject: 'Mathematics', done: true }
    ],
    exams: [
      { id: 'ex-1', title: 'Mathematics Paper 2', subject: 'Mathematics', daysAway: 12 },
      { id: 'ex-2', title: 'Physical Sciences Paper 1', subject: 'Physical Sciences', daysAway: 16 },
      { id: 'ex-3', title: 'Accounting Final', subject: 'Accounting', daysAway: 21 }
    ]
  };
}

export function loadVault() {
  const seed = createDefaultSnapshot();
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) {
      const fresh = { ...seed, lastDownloadedAt: new Date().toISOString() };
      saveVault(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw);
    return {
      ...seed,
      ...parsed,
      notes: parsed.notes?.length ? parsed.notes : seed.notes,
      quizzes: parsed.quizzes?.length ? parsed.quizzes : seed.quizzes,
      attendance: parsed.attendance?.length ? parsed.attendance : seed.attendance,
      tuitionInfo: parsed.tuitionInfo || seed.tuitionInfo
    };
  } catch {
    return { ...seed, lastDownloadedAt: new Date().toISOString() };
  }
}

export function saveVault(vault) {
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  } catch {
    // Ignore quota errors
  }
}

export function loadPersonal() {
  const def = createDefaultPersonalState();
  try {
    const raw = localStorage.getItem(PERSONAL_KEY);
    if (!raw) {
      savePersonal(def);
      return def;
    }
    const parsed = JSON.parse(raw);
    return {
      ...def,
      ...parsed,
      subjectConfidence: { ...def.subjectConfidence, ...(parsed.subjectConfidence || {}) },
      assignmentDrafts: parsed.assignmentDrafts || {}
    };
  } catch {
    return def;
  }
}

export function savePersonal(personal) {
  try {
    localStorage.setItem(PERSONAL_KEY, JSON.stringify(personal));
  } catch {
    // Ignore
  }
}

export function getOverallConfidence(personal) {
  const vals = Object.values(personal.subjectConfidence || {});
  if (!vals.length) return 78;
  return Math.round(vals.reduce((a, b) => a + Number(b || 0), 0) / vals.length);
}

export function getWeakestSubject(personal) {
  let weakest = 'Physical Sciences';
  let min = 101;
  for (const [sub, val] of Object.entries(personal.subjectConfidence || {})) {
    if (Number(val) < min) {
      min = Number(val);
      weakest = sub;
    }
  }
  return { subject: weakest, score: min };
}

export function loadOutbox() {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOutbox(queue) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
  } catch {
    // Ignore
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return {
        currentUserId: 'stu-thabo',
        theme: 'light',
        simulateOffline: false
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      currentUserId: 'stu-thabo',
      theme: 'light',
      simulateOffline: false
    };
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore
  }
}

export function dispatchOfflineAction(vault, action) {
  const p = action.payload || {};

  switch (action.type) {
    case 'ADD_TIMETABLE':
      vault.timetables.push(p);
      break;
    case 'DELETE_TIMETABLE':
      vault.timetables = vault.timetables.filter((t) => t.id !== p.id);
      break;
    case 'CREATE_ASSIGNMENT':
      vault.assignments.unshift(p);
      break;
    case 'SUBMIT_ASSIGNMENT': {
      const idx = vault.submissions.findIndex(
        (s) => s.assignment_id === p.assignment_id && s.student_id === p.student_id
      );
      if (idx >= 0) vault.submissions[idx] = { ...vault.submissions[idx], ...p };
      else vault.submissions.unshift(p);
      break;
    }
    case 'GRADE_SUBMISSION': {
      const sub = vault.submissions.find((s) => s.id === p.id);
      if (sub) {
        sub.status = 'graded';
        sub.marks_awarded = Number(p.marks_awarded ?? 0);
        sub.teacher_feedback = p.teacher_feedback || '';
      }
      break;
    }
    case 'LOG_ATTENDANCE':
      vault.attendance = vault.attendance || [];
      vault.attendance.unshift(p);
      break;
    case 'ADD_STUDY_NOTE':
      vault.notes = vault.notes || [];
      vault.notes.unshift(p);
      break;
    case 'CREATE_STUDY_GROUP':
      vault.rooms.unshift(p);
      break;
    case 'SEND_MESSAGE':
      vault.messages.push(p);
      break;
    case 'SEND_BROADCAST':
      vault.broadcasts.unshift(p);
      break;
    case 'SUBMIT_ENQUIRY':
      vault.enquiries = vault.enquiries || [];
      vault.enquiries.unshift(p);
      break;
    case 'UPDATE_TUITION_INFO':
      if (p.plans && p.contacts) {
        vault.tuitionInfo = { plans: p.plans, contacts: p.contacts };
      }
      break;
    default:
      break;
  }

  saveVault(vault);

  const outbox = loadOutbox();
  outbox.push({ ...action, queuedAt: new Date().toISOString() });
  saveOutbox(outbox);
}

export async function syncWithServer({ simulateOffline = false } = {}) {
  if (simulateOffline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { status: 'offline', vault: loadVault(), pendingCount: loadOutbox().length };
  }

  const outbox = loadOutbox();
  try {
    const res =
      outbox.length > 0
        ? await fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actions: outbox })
          })
        : await fetch('/api/sync', { method: 'GET' });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remoteSnap = await res.json();

    if (outbox.length > 0) saveOutbox([]);

    const seed = createDefaultSnapshot();
    const updatedVault = {
      profiles: remoteSnap.profiles?.length ? remoteSnap.profiles : seed.profiles,
      timetables: remoteSnap.timetables || [],
      assignments: remoteSnap.assignments || [],
      submissions: remoteSnap.submissions || [],
      attendance: remoteSnap.attendance?.length ? remoteSnap.attendance : seed.attendance,
      notes: remoteSnap.notes?.length ? remoteSnap.notes : seed.notes,
      quizzes: seed.quizzes,
      flashcards: seed.flashcards,
      rooms: remoteSnap.rooms || [],
      messages: remoteSnap.messages || [],
      broadcasts: remoteSnap.broadcasts || [],
      tuitionInfo: remoteSnap.tuitionInfo || seed.tuitionInfo,
      enquiries: remoteSnap.enquiries || [],
      lastDownloadedAt: remoteSnap.syncedAt || new Date().toISOString()
    };

    saveVault(updatedVault);
    return { status: 'synced', vault: updatedVault, pendingCount: 0 };
  } catch {
    return { status: 'offline', vault: loadVault(), pendingCount: loadOutbox().length };
  }
}
