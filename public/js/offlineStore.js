import { createDefaultSnapshot, SUBJECT_LIST } from './defaultSeed.js';

const VAULT_KEY = 'itutor_offline_vault_v4';
const PERSONAL_KEY = 'itutor_personal_study_v4';
const OUTBOX_KEY = 'itutor_offline_outbox_v4';
const SESSION_KEY = 'itutor_session_v4';

export { SUBJECT_LIST };

function normalizeQuiz(q) {
  const ci = Number(q.correct_index ?? q.correctIndex ?? 0);
  return { ...q, correct_index: ci, correctIndex: ci };
}

function upsertInArray(arr, item, prepend = false) {
  const idx = arr.findIndex((x) => x.id === item.id);
  if (idx >= 0) {
    arr[idx] = { ...arr[idx], ...item };
  } else if (prepend) {
    arr.unshift(item);
  } else {
    arr.push(item);
  }
}

function createDefaultPersonalState() {
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
    masteredCardIds: ['fc-1', 'fc-4', 'fc-5', 'fc-6'],
    bookmarkedNoteIds: ['note-trig', 'note-newton'],
    assignmentDrafts: {},
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
      profiles: parsed.profiles?.length ? parsed.profiles : seed.profiles,
      notes: parsed.notes?.length ? parsed.notes : seed.notes,
      quizzes: (parsed.quizzes?.length ? parsed.quizzes : seed.quizzes).map(normalizeQuiz),
      flashcards: parsed.flashcards?.length ? parsed.flashcards : seed.flashcards,
      attendance: parsed.attendance?.length ? parsed.attendance : seed.attendance,
      tuitionInfo: {
        ...seed.tuitionInfo,
        ...(parsed.tuitionInfo || {})
      }
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
      masteredCardIds: Array.isArray(parsed.masteredCardIds) ? parsed.masteredCardIds : def.masteredCardIds,
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
        currentUserId: null, // null = show Account Sign-In / Join / Visitor Portal
        theme: 'light',
        simulateOffline: false
      };
    }
    return JSON.parse(raw);
  } catch {
    return {
      currentUserId: null,
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

export function authenticateAccount(vault, identifier, secret) {
  const cleanId = String(identifier || '').trim().toLowerCase();
  const cleanPin = String(secret || '').trim();
  if (!cleanId) return { ok: false, error: 'Please enter your email, phone, name, or account ID.' };

  const match = (vault.profiles || []).find((p) => {
    return (
      (p.id || '').toLowerCase() === cleanId ||
      (p.email || '').toLowerCase() === cleanId ||
      (p.phone || '').replace(/\s+/g, '') === cleanId.replace(/\s+/g, '') ||
      (p.name || '').toLowerCase() === cleanId
    );
  });

  if (!match) {
    return { ok: false, error: 'Account not found. Check your email/name or Apply to Join first.' };
  }

  if (String(match.pin || '1234') !== cleanPin) {
    return { ok: false, error: 'Incorrect password / PIN. (Demo accounts use PIN: 1234)' };
  }

  if (match.status === 'pending') {
    return {
      ok: false,
      status: 'pending',
      profile: match,
      error: 'Your application is awaiting Admissions approval. Admissions can accept your account in 1 click!'
    };
  }

  if (match.status === 'suspended' || match.status === 'declined') {
    return {
      ok: false,
      status: match.status,
      error: `This account is currently ${match.status}. Please contact Admissions.`
    };
  }

  return { ok: true, profile: match };
}

export function dispatchOfflineAction(vault, action) {
  const p = action.payload || {};

  switch (action.type) {
    case 'UPSERT_ACCOUNT':
      vault.profiles = vault.profiles || [];
      upsertInArray(vault.profiles, p, false);
      break;
    case 'DELETE_ACCOUNT':
      vault.profiles = (vault.profiles || []).filter((u) => u.id !== p.id);
      break;
    case 'ADD_TIMETABLE':
    case 'UPSERT_TIMETABLE':
      upsertInArray(vault.timetables, p, false);
      break;
    case 'DELETE_TIMETABLE':
      vault.timetables = vault.timetables.filter((t) => t.id !== p.id);
      break;
    case 'CREATE_ASSIGNMENT':
    case 'UPSERT_ASSIGNMENT':
      upsertInArray(vault.assignments, p, true);
      break;
    case 'DELETE_ASSIGNMENT':
      vault.assignments = vault.assignments.filter((a) => a.id !== p.id);
      vault.submissions = vault.submissions.filter((s) => s.assignment_id !== p.id);
      break;
    case 'SUBMIT_ASSIGNMENT':
    case 'UPSERT_SUBMISSION': {
      const idx = vault.submissions.findIndex(
        (s) => s.id === p.id || (s.assignment_id === p.assignment_id && s.student_id === p.student_id)
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
    case 'DELETE_SUBMISSION':
      vault.submissions = vault.submissions.filter((s) => s.id !== p.id);
      break;
    case 'LOG_ATTENDANCE':
    case 'UPSERT_ATTENDANCE':
      vault.attendance = vault.attendance || [];
      upsertInArray(vault.attendance, p, true);
      break;
    case 'DELETE_ATTENDANCE':
      vault.attendance = (vault.attendance || []).filter((a) => a.id !== p.id);
      break;
    case 'ADD_STUDY_NOTE':
    case 'UPSERT_STUDY_NOTE':
      vault.notes = vault.notes || [];
      upsertInArray(vault.notes, p, true);
      break;
    case 'DELETE_STUDY_NOTE':
      vault.notes = (vault.notes || []).filter((n) => n.id !== p.id);
      break;
    case 'UPSERT_QUIZ':
      vault.quizzes = vault.quizzes || [];
      upsertInArray(vault.quizzes, normalizeQuiz(p), false);
      break;
    case 'DELETE_QUIZ':
      vault.quizzes = (vault.quizzes || []).filter((q) => q.id !== p.id);
      break;
    case 'UPSERT_FLASHCARD':
      vault.flashcards = vault.flashcards || [];
      upsertInArray(vault.flashcards, p, false);
      break;
    case 'DELETE_FLASHCARD':
      vault.flashcards = (vault.flashcards || []).filter((f) => f.id !== p.id);
      break;
    case 'CREATE_STUDY_GROUP':
    case 'UPSERT_ROOM':
      upsertInArray(vault.rooms, p, true);
      break;
    case 'DELETE_ROOM':
      vault.rooms = vault.rooms.filter((r) => r.id !== p.id);
      vault.messages = vault.messages.filter((m) => m.room_id !== p.id);
      break;
    case 'SEND_MESSAGE':
    case 'UPSERT_MESSAGE':
      upsertInArray(vault.messages, p, false);
      break;
    case 'DELETE_MESSAGE':
      vault.messages = vault.messages.filter((m) => m.id !== p.id);
      break;
    case 'SEND_BROADCAST':
    case 'UPSERT_BROADCAST':
      upsertInArray(vault.broadcasts, p, true);
      break;
    case 'DELETE_BROADCAST':
      vault.broadcasts = vault.broadcasts.filter((b) => b.id !== p.id);
      break;
    case 'SUBMIT_ENQUIRY':
    case 'UPSERT_ENQUIRY':
      vault.enquiries = vault.enquiries || [];
      upsertInArray(vault.enquiries, p, true);
      break;
    case 'DELETE_ENQUIRY':
      vault.enquiries = (vault.enquiries || []).filter((e) => e.id !== p.id);
      break;
    case 'UPDATE_TUITION_INFO':
      vault.tuitionInfo = {
        ...vault.tuitionInfo,
        ...(p.headline !== undefined ? { headline: p.headline } : {}),
        ...(p.intro !== undefined ? { intro: p.intro } : {}),
        ...(p.plans !== undefined ? { plans: p.plans } : {}),
        ...(p.contacts !== undefined ? { contacts: p.contacts } : {})
      };
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
      attendance: remoteSnap.attendance || [],
      notes: remoteSnap.notes?.length ? remoteSnap.notes : seed.notes,
      quizzes: (remoteSnap.quizzes?.length ? remoteSnap.quizzes : seed.quizzes).map(normalizeQuiz),
      flashcards: remoteSnap.flashcards?.length ? remoteSnap.flashcards : seed.flashcards,
      rooms: remoteSnap.rooms || [],
      messages: remoteSnap.messages || [],
      broadcasts: remoteSnap.broadcasts || [],
      tuitionInfo: {
        ...seed.tuitionInfo,
        ...(remoteSnap.tuitionInfo || {})
      },
      enquiries: remoteSnap.enquiries || [],
      lastDownloadedAt: remoteSnap.syncedAt || new Date().toISOString()
    };

    saveVault(updatedVault);
    return { status: 'synced', vault: updatedVault, pendingCount: 0 };
  } catch {
    return { status: 'offline', vault: loadVault(), pendingCount: loadOutbox().length };
  }
}
