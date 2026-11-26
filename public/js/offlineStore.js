import { createDefaultSnapshot, SUBJECT_LIST } from './defaultSeed.js';

const VAULT_KEY = 'itutor_offline_vault_v9';
const PERSONAL_KEY = 'itutor_personal_study_v4';
const OUTBOX_KEY = 'itutor_offline_outbox_v9';
const SESSION_KEY = 'itutor_session_v4';

const IDB_NAME = 'itutor_media_idb_v1';
const IDB_STORE = 'blobs';

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

/* ==========================================================================
   INDEXEDDB OFFLINE MEDIA VAULT (PHOTOS, PDFS & VIDEOS UP TO 50MB+)
   ========================================================================== */

function openMediaDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalMediaBlob(id, blob, meta = {}) {
  try {
    const db = await openMediaDb();
    if (!db) return false;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put({
        id,
        blob,
        mime: meta.mime || blob.type || 'application/octet-stream',
        name: meta.name || 'attachment',
        savedAt: Date.now()
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function getLocalMediaBlob(id) {
  try {
    const db = await openMediaDb();
    if (!db || !id) return null;
    return await new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function detectAttachmentKind(name = '', mime = '') {
  const m = String(mime || '').toLowerCase();
  const n = String(name || '').toLowerCase();
  if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (m.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(n)) return 'video';
  if (m.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg|bmp|heic)$/i.test(n)) return 'image';
  return 'file';
}

export function formatBytes(bytes = 0) {
  const n = Number(bytes || 0);
  if (!n || n < 1024) return `${Math.max(1, n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function createImageThumbDataUrl(file) {
  try {
    if (typeof document === 'undefined' || !file.type.startsWith('image/')) return '';
    if (file.type === 'image/svg+xml' && file.size < 32000) {
      return await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result || ''));
        r.onerror = () => res('');
        r.readAsDataURL(file);
      });
    }
    const bitmapUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = bitmapUrl;
      });
      const maxDim = 260;
      const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.68);
    } finally {
      URL.revokeObjectURL(bitmapUrl);
    }
  } catch {
    return '';
  }
}

async function uploadBlobToCloud(blob, fileName, contentType) {
  // 1. Try direct signed upload to Supabase Storage (supports up to 50MB Videos, PDFs & Photos on Vercel!)
  const signRes = await fetch('/api/upload-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, contentType })
  });

  if (signRes.ok) {
    const target = await signRes.json();
    if (target.mode === 'supabase' && target.signedUrl && target.publicUrl) {
      const putRes = await fetch(target.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType, 'x-upsert': 'true' },
        body: blob
      });
      if (putRes.ok) {
        return target.publicUrl;
      }
    }
  }

  // 2. Fallback to direct /api/upload endpoint
  const upRes = await fetch(`/api/upload?name=${encodeURIComponent(fileName)}`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'X-File-Name': encodeURIComponent(fileName)
    },
    body: blob
  });
  if (!upRes.ok) throw new Error(`Upload HTTP ${upRes.status}`);
  const data = await upRes.json();
  return data.url || '';
}

export async function uploadAndCacheMediaFile(file, { simulateOffline = false } = {}) {
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const mime = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
  const kind = detectAttachmentKind(file.name, mime);

  await saveLocalMediaBlob(id, file, { mime, name: file.name });
  const thumbUrl = kind === 'image' ? await createImageThumbDataUrl(file) : '';

  const offline = simulateOffline || (typeof navigator !== 'undefined' && navigator.onLine === false);
  if (!offline) {
    try {
      const cloudUrl = await uploadBlobToCloud(file, file.name, mime);
      if (cloudUrl) {
        return {
          id,
          name: file.name,
          kind,
          mime,
          size: file.size || 0,
          url: cloudUrl,
          thumbUrl,
          pendingUpload: false
        };
      }
    } catch {
      // Queue for auto-upload when connection stabilizes
    }
  }

  return {
    id,
    name: file.name,
    kind,
    mime,
    size: file.size || 0,
    url: thumbUrl || '',
    thumbUrl,
    pendingUpload: true
  };
}

export async function resolveAttachmentSource(att) {
  if (!att) return null;
  const kind = att.kind || detectAttachmentKind(att.name, att.mime);

  // 1. Check local IndexedDB cache first (instant offline open!)
  const cached = await getLocalMediaBlob(att.id);
  if (cached?.blob) {
    const objectUrl = URL.createObjectURL(cached.blob);
    const arrayBuffer = kind === 'pdf' ? await cached.blob.arrayBuffer() : null;
    return {
      objectUrl,
      arrayBuffer,
      revokeAfterClose: true,
      kind,
      mime: cached.mime || att.mime || '',
      name: att.name || 'Attachment'
    };
  }

  // 2. Fetch from URL (/samples/..., Supabase Storage URL, /api/media/..., or data: URL) and cache in IndexedDB
  if (att.url) {
    try {
      const res = await fetch(att.url);
      if (res.ok) {
        const blob = await res.blob();
        if (att.id) {
          await saveLocalMediaBlob(att.id, blob, { mime: att.mime || blob.type, name: att.name });
        }
        const objectUrl = URL.createObjectURL(blob);
        const arrayBuffer = kind === 'pdf' ? await blob.arrayBuffer() : null;
        return {
          objectUrl,
          arrayBuffer,
          revokeAfterClose: true,
          kind,
          mime: att.mime || blob.type || '',
          name: att.name || 'Attachment'
        };
      }
    } catch {
      // Fallback to direct URL if CORS/fetch restricted
    }
    return {
      objectUrl: att.url,
      arrayBuffer: null,
      revokeAfterClose: false,
      kind,
      mime: att.mime || '',
      name: att.name || 'Attachment'
    };
  }

  return null;
}

/* ==========================================================================
   VAULT, PERSONAL STATE & SYNC ENGINE
   ========================================================================== */

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
    // Ignore quota errors (binary blobs live in IndexedDB)
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
        currentUserId: null,
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

  const candidates = (vault.profiles || []).filter((p) => {
    return (
      (p.id || '').toLowerCase() === cleanId ||
      (p.email || '').toLowerCase() === cleanId ||
      (p.phone || '').replace(/\s+/g, '') === cleanId.replace(/\s+/g, '') ||
      (p.name || '').toLowerCase() === cleanId
    );
  });

  if (!candidates.length) {
    return { ok: false, error: 'Account not found. Check your email/name or Apply to Join first.' };
  }

  const match = candidates.find((p) => String(p.pin || '1234') === cleanPin) || candidates[0];

  if (String(match.pin || '1234') !== cleanPin) {
    return { ok: false, error: 'Incorrect password. Please check your password and try again.' };
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
        ...(p.registration_fee !== undefined ? { registration_fee: p.registration_fee } : {}),
        ...(p.promo_banner !== undefined ? { promo_banner: p.promo_banner } : {}),
        ...(p.plans !== undefined ? { plans: p.plans } : {}),
        ...(p.flyers !== undefined ? { flyers: p.flyers } : {}),
        ...(p.custom_subjects !== undefined ? { custom_subjects: p.custom_subjects } : {}),
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

async function flushQueuedBlobsInOutbox(outbox) {
  let changed = false;
  for (const act of outbox) {
    const attachmentTargets = [];
    if (Array.isArray(act?.payload?.attachments)) {
      attachmentTargets.push(...act.payload.attachments);
    }
    if (Array.isArray(act?.payload?.flyers)) {
      for (const fl of act.payload.flyers) {
        if (fl?.attachment) attachmentTargets.push(fl.attachment);
      }
    }
    if (act?.payload?.avatarAttachment?.pendingUpload) {
      const avAtt = act.payload.avatarAttachment;
      const cached = await getLocalMediaBlob(avAtt.id);
      if (cached?.blob) {
        try {
          const cloudUrl = await uploadBlobToCloud(cached.blob, avAtt.name || cached.name, avAtt.mime || cached.mime);
          if (cloudUrl) {
            act.payload.avatar = cloudUrl;
            avAtt.url = cloudUrl;
            avAtt.pendingUpload = false;
            changed = true;
          }
        } catch {
          // Retry next sync
        }
      }
    }
    for (const att of attachmentTargets) {
      if (!att.pendingUpload) continue;
      const cached = await getLocalMediaBlob(att.id);
      if (!cached?.blob) continue;
      try {
        const cloudUrl = await uploadBlobToCloud(cached.blob, att.name || cached.name, att.mime || cached.mime);
        if (cloudUrl) {
          att.url = cloudUrl;
          att.pendingUpload = false;
          changed = true;
        }
      } catch {
        // Retry next sync
      }
    }
  }
  if (changed) saveOutbox(outbox);
}

export async function syncWithServer({ simulateOffline = false } = {}) {
  if (simulateOffline || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { status: 'offline', vault: loadVault(), pendingCount: loadOutbox().length };
  }

  const outbox = loadOutbox();
  try {
    if (outbox.length > 0) {
      await flushQueuedBlobsInOutbox(outbox);
    }

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
