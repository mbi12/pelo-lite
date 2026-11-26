import { createDefaultSnapshot } from './defaultSeed.js';

const VAULT_KEY = 'itutor_offline_vault_v2';
const OUTBOX_KEY = 'itutor_offline_outbox_v2';
const SESSION_KEY = 'itutor_session_v2';

export function loadVault() {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) {
      const seed = {
        ...createDefaultSnapshot(),
        lastDownloadedAt: new Date().toISOString()
      };
      saveVault(seed);
      return seed;
    }
    const parsed = JSON.parse(raw);
    const seed = createDefaultSnapshot();
    return {
      ...seed,
      ...parsed,
      tuitionInfo: parsed.tuitionInfo || seed.tuitionInfo
    };
  } catch {
    return {
      ...createDefaultSnapshot(),
      lastDownloadedAt: new Date().toISOString()
    };
  }
}

export function saveVault(vault) {
  try {
    localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
  } catch {
    // Ignore storage quota errors
  }
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
    // Ignore storage quota errors
  }
}

export function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) {
      return {
        // Default to Student view so user sees full layout immediately, with 1-tap switch to Visitor/Teacher/Parent/Admin
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

/**
 * Optimistically applies an action locally so it works 100% offline with instant feedback,
 * then queues it in the Offline Outbox for automatic cloud sync when online.
 */
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
      const existingIdx = vault.submissions.findIndex(
        (s) => s.assignment_id === p.assignment_id && s.student_id === p.student_id
      );
      if (existingIdx >= 0) vault.submissions[existingIdx] = { ...vault.submissions[existingIdx], ...p };
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
  outbox.push({
    ...action,
    queuedAt: new Date().toISOString()
  });
  saveOutbox(outbox);
}

/**
 * Flushes any queued offline actions and automatically downloads fresh timetables,
 * remote assignments, messages, study groups, broadcasts, and tuition info to local storage.
 */
export async function syncWithServer({ simulateOffline = false } = {}) {
  if (simulateOffline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { status: 'offline', vault: loadVault(), pendingCount: loadOutbox().length };
  }

  const outbox = loadOutbox();
  try {
    let res;
    if (outbox.length > 0) {
      res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actions: outbox })
      });
    } else {
      res = await fetch('/api/sync', { method: 'GET' });
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remoteSnap = await res.json();

    if (outbox.length > 0) {
      saveOutbox([]);
    }

    const updatedVault = {
      profiles: remoteSnap.profiles || [],
      timetables: remoteSnap.timetables || [],
      assignments: remoteSnap.assignments || [],
      submissions: remoteSnap.submissions || [],
      rooms: remoteSnap.rooms || [],
      messages: remoteSnap.messages || [],
      broadcasts: remoteSnap.broadcasts || [],
      tuitionInfo: remoteSnap.tuitionInfo || createDefaultSnapshot().tuitionInfo,
      enquiries: remoteSnap.enquiries || [],
      lastDownloadedAt: remoteSnap.syncedAt || new Date().toISOString()
    };

    saveVault(updatedVault);
    return { status: 'synced', vault: updatedVault, pendingCount: 0 };
  } catch {
    return { status: 'offline', vault: loadVault(), pendingCount: loadOutbox().length };
  }
}
