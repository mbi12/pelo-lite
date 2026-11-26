import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultSnapshot } from '../public/js/defaultSeed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.join(__dirname, '..', 'data', 'itutor-v4-local.json');

let resolvedMode = null; // 'supabase' | 'local'

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

async function sbFetch(tablePath, { method = 'GET', body = null, prefer = 'return=representation' } = {}) {
  const cfg = getSupabaseConfig();
  if (!cfg) throw new Error('Supabase env missing');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(`${cfg.url}/rest/v1/${tablePath}`, {
      method,
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
        Prefer: prefer
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Supabase ${method} ${tablePath} -> ${res.status}: ${txt}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } finally {
    clearTimeout(timer);
  }
}

async function detectMode() {
  if (resolvedMode) return resolvedMode;
  const cfg = getSupabaseConfig();
  if (!cfg) {
    resolvedMode = 'local';
    return resolvedMode;
  }
  try {
    await sbFetch('itutor_v2_profiles?select=id&limit=1');
    resolvedMode = 'supabase';
  } catch {
    resolvedMode = 'local';
  }
  return resolvedMode;
}

function normalizeQuiz(q) {
  const ci = Number(q.correct_index ?? q.correctIndex ?? 0);
  return {
    ...q,
    correct_index: ci,
    correctIndex: ci
  };
}

function readLocalDb() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
      const fallback = createDefaultSnapshot();
      return {
        ...fallback,
        ...parsed,
        tuitionInfo: {
          ...fallback.tuitionInfo,
          ...(parsed.tuitionInfo || {})
        }
      };
    }
  } catch {
    // Recreate on parse failure
  }
  const initial = createDefaultSnapshot();
  writeLocalDb(initial);
  return initial;
}

function writeLocalDb(snapshot) {
  try {
    fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch {
    // Ignore read-only filesystem on serverless
  }
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

export async function getFullSnapshot() {
  const mode = await detectMode();
  const fallback = createDefaultSnapshot();

  if (mode === 'supabase') {
    try {
      const [
        profiles,
        timetables,
        assignments,
        submissions,
        attendance,
        notes,
        quizzes,
        flashcards,
        rooms,
        messages,
        broadcasts,
        tuitionRows,
        enquiries
      ] = await Promise.all([
        sbFetch('itutor_v2_profiles?select=*&order=created_at.asc'),
        sbFetch('itutor_v2_timetables?select=*&order=created_at.asc'),
        sbFetch('itutor_v2_assignments?select=*&order=created_at.desc'),
        sbFetch('itutor_v2_submissions?select=*&order=submitted_at.desc'),
        sbFetch('itutor_v2_attendance?select=*&order=created_at.desc'),
        sbFetch('itutor_v2_notes?select=*&order=created_at.desc'),
        sbFetch('itutor_v2_quizzes?select=*&order=created_at.asc'),
        sbFetch('itutor_v2_flashcards?select=*&order=created_at.asc'),
        sbFetch('itutor_v2_rooms?select=*&order=updated_at.desc'),
        sbFetch('itutor_v2_messages?select=*&order=created_at.asc'),
        sbFetch('itutor_v2_broadcasts?select=*&order=created_at.desc'),
        sbFetch('itutor_v2_tuition_info?select=*&id=eq.default&limit=1'),
        sbFetch('itutor_v2_enquiries?select=*&order=created_at.desc')
      ]);

      const tuitionRow = tuitionRows?.[0];

      return {
        backend: 'supabase',
        syncedAt: new Date().toISOString(),
        profiles: profiles?.length ? profiles : fallback.profiles,
        timetables: timetables || [],
        assignments: assignments || [],
        submissions: submissions || [],
        attendance: attendance || [],
        notes: notes || [],
        quizzes: (quizzes?.length ? quizzes : fallback.quizzes).map(normalizeQuiz),
        flashcards: flashcards?.length ? flashcards : fallback.flashcards,
        rooms: rooms || [],
        messages: messages || [],
        broadcasts: broadcasts || [],
        tuitionInfo: tuitionRow
          ? {
              headline: tuitionRow.headline || fallback.tuitionInfo.headline,
              intro: tuitionRow.intro || fallback.tuitionInfo.intro,
              registration_fee: tuitionRow.registration_fee || fallback.tuitionInfo.registration_fee || 'P100',
              promo_banner: tuitionRow.promo_banner || fallback.tuitionInfo.promo_banner || '',
              plans: tuitionRow.plans || fallback.tuitionInfo.plans,
              flyers: Array.isArray(tuitionRow.flyers) ? tuitionRow.flyers : fallback.tuitionInfo.flyers,
              contacts: tuitionRow.contacts || fallback.tuitionInfo.contacts
            }
          : fallback.tuitionInfo,
        enquiries: enquiries || []
      };
    } catch {
      resolvedMode = 'local';
    }
  }

  const local = readLocalDb();
  return {
    backend: 'local',
    syncedAt: new Date().toISOString(),
    ...local,
    quizzes: (local.quizzes || []).map(normalizeQuiz)
  };
}

export async function applyOutboxActions(actions = []) {
  const mode = await detectMode();

  if (mode === 'supabase') {
    for (const act of actions) {
      const p = act?.payload || {};
      switch (act?.type) {
        case 'UPSERT_ACCOUNT':
          await sbFetch('itutor_v2_profiles', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              name: p.name,
              role: ['student', 'parent', 'teacher', 'admissions', 'admin'].includes(p.role) ? p.role : 'student',
              subtitle: p.subtitle || '',
              grade: p.grade || '',
              pin: p.pin || '1234',
              email: p.email || '',
              phone: p.phone || '',
              status: ['active', 'pending', 'suspended', 'declined'].includes(p.status) ? p.status : 'active',
              subjects: Array.isArray(p.subjects) ? p.subjects : [],
              selected_plan: p.selected_plan || '',
              linked_student_id: p.linked_student_id || '',
              notes: p.notes || ''
            }
          });
          break;

        case 'DELETE_ACCOUNT':
          if (p.id) {
            await sbFetch(`itutor_v2_profiles?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'ADD_TIMETABLE':
        case 'UPSERT_TIMETABLE':
          await sbFetch('itutor_v2_timetables', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              day_of_week: p.day_of_week,
              start_time: p.start_time,
              end_time: p.end_time,
              subject: p.subject,
              topic: p.topic || '',
              teacher_name: p.teacher_name || '',
              location_mode: p.location_mode || 'Saved Offline',
              grade_group: p.grade_group || 'Grade 12',
              owner_id: p.owner_id || null,
              is_official: Boolean(p.is_official)
            }
          });
          break;

        case 'DELETE_TIMETABLE':
          if (p.id) {
            await sbFetch(`itutor_v2_timetables?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'CREATE_ASSIGNMENT':
        case 'UPSERT_ASSIGNMENT':
          await sbFetch('itutor_v2_assignments', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              title: p.title,
              subject: p.subject,
              grade_group: p.grade_group || 'Grade 12',
              teacher_id: p.teacher_id || 'tch-naledi',
              teacher_name: p.teacher_name || 'Educator',
              due_date: p.due_date,
              max_marks: Number(p.max_marks || 30),
              instructions: p.instructions || '',
              offline_pack_content: p.offline_pack_content || '',
              attachments: Array.isArray(p.attachments) ? p.attachments : []
            }
          });
          break;

        case 'DELETE_ASSIGNMENT':
          if (p.id) {
            await sbFetch(`itutor_v2_assignments?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'SUBMIT_ASSIGNMENT':
        case 'UPSERT_SUBMISSION':
          await sbFetch('itutor_v2_submissions', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              assignment_id: p.assignment_id,
              student_id: p.student_id,
              student_name: p.student_name,
              answer_text: p.answer_text,
              status: p.status === 'graded' ? 'graded' : 'submitted',
              marks_awarded: p.marks_awarded ?? null,
              teacher_feedback: p.teacher_feedback || '',
              attachments: Array.isArray(p.attachments) ? p.attachments : [],
              submitted_at: p.submitted_at || new Date().toISOString()
            }
          });
          break;

        case 'GRADE_SUBMISSION':
          if (p.id) {
            await sbFetch(`itutor_v2_submissions?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'PATCH',
              prefer: 'return=minimal',
              body: {
                status: 'graded',
                marks_awarded: Number(p.marks_awarded ?? 0),
                teacher_feedback: p.teacher_feedback || '',
                graded_at: new Date().toISOString()
              }
            });
          }
          break;

        case 'DELETE_SUBMISSION':
          if (p.id) {
            await sbFetch(`itutor_v2_submissions?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'LOG_ATTENDANCE':
        case 'UPSERT_ATTENDANCE':
          await sbFetch('itutor_v2_attendance', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              session_date: p.session_date,
              subject: p.subject,
              student_id: p.student_id,
              student_name: p.student_name,
              status: ['present', 'late', 'absent'].includes(p.status) ? p.status : 'present',
              teacher_name: p.teacher_name || 'Educator',
              lesson_note: p.lesson_note || ''
            }
          });
          break;

        case 'DELETE_ATTENDANCE':
          if (p.id) {
            await sbFetch(`itutor_v2_attendance?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'ADD_STUDY_NOTE':
        case 'UPSERT_STUDY_NOTE':
          await sbFetch('itutor_v2_notes', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              subject: p.subject || 'Mathematics',
              title: p.title,
              formulas: Array.isArray(p.formulas) ? p.formulas : [],
              summary: p.summary || '',
              author_name: p.author_name || 'Educator'
            }
          });
          break;

        case 'DELETE_STUDY_NOTE':
          if (p.id) {
            await sbFetch(`itutor_v2_notes?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'UPSERT_QUIZ':
          await sbFetch('itutor_v2_quizzes', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              subject: p.subject || 'Mathematics',
              topic: p.topic || 'Practice',
              question: p.question,
              options: Array.isArray(p.options) ? p.options : [],
              correct_index: Number(p.correct_index ?? p.correctIndex ?? 0),
              explanation: p.explanation || ''
            }
          });
          break;

        case 'DELETE_QUIZ':
          if (p.id) {
            await sbFetch(`itutor_v2_quizzes?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'UPSERT_FLASHCARD':
          await sbFetch('itutor_v2_flashcards', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              subject: p.subject || 'Mathematics',
              front: p.front,
              back: p.back
            }
          });
          break;

        case 'DELETE_FLASHCARD':
          if (p.id) {
            await sbFetch(`itutor_v2_flashcards?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'CREATE_STUDY_GROUP':
        case 'UPSERT_ROOM':
          await sbFetch('itutor_v2_rooms', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              room_type: p.room_type === 'direct' ? 'direct' : 'group',
              name: p.name,
              subject: p.subject || 'Study Group',
              participant_ids: Array.isArray(p.participant_ids) ? p.participant_ids : [],
              members_label: p.members_label || 'Study Channel',
              created_by_name: p.created_by_name || 'i-tutor',
              updated_at: new Date().toISOString()
            }
          });
          break;

        case 'DELETE_ROOM':
          if (p.id) {
            await sbFetch(`itutor_v2_rooms?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'SEND_MESSAGE':
        case 'UPSERT_MESSAGE':
          await sbFetch('itutor_v2_messages', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              room_id: p.room_id,
              sender_id: p.sender_id,
              sender_name: p.sender_name,
              sender_role: p.sender_role || 'student',
              body: p.body || '',
              attachments: Array.isArray(p.attachments) ? p.attachments : [],
              created_at: p.created_at || new Date().toISOString()
            }
          });
          if (p.room_id) {
            await sbFetch(`itutor_v2_rooms?id=eq.${encodeURIComponent(p.room_id)}`, {
              method: 'PATCH',
              prefer: 'return=minimal',
              body: { updated_at: new Date().toISOString() }
            });
          }
          break;

        case 'DELETE_MESSAGE':
          if (p.id) {
            await sbFetch(`itutor_v2_messages?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'SEND_BROADCAST':
        case 'UPSERT_BROADCAST':
          await sbFetch('itutor_v2_broadcasts', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              title: p.title,
              body: p.body,
              author_name: p.author_name,
              author_role: ['admin', 'admissions', 'teacher'].includes(p.author_role) ? p.author_role : 'admin',
              audience: p.audience || 'students_parents',
              priority: p.priority || 'important',
              created_at: p.created_at || new Date().toISOString()
            }
          });
          break;

        case 'DELETE_BROADCAST':
          if (p.id) {
            await sbFetch(`itutor_v2_broadcasts?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'SUBMIT_ENQUIRY':
        case 'UPSERT_ENQUIRY':
          await sbFetch('itutor_v2_enquiries', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              full_name: p.full_name,
              contact_detail: p.contact_detail,
              student_grade: p.student_grade || '',
              selected_plan: p.selected_plan || '',
              message: p.message || '',
              status: p.status || 'pending',
              role_requested: p.role_requested || 'student',
              subjects: p.subjects || '',
              created_at: p.created_at || new Date().toISOString()
            }
          });
          break;

        case 'DELETE_ENQUIRY':
          if (p.id) {
            await sbFetch(`itutor_v2_enquiries?id=eq.${encodeURIComponent(p.id)}`, {
              method: 'DELETE',
              prefer: 'return=minimal'
            });
          }
          break;

        case 'UPDATE_TUITION_INFO': {
          const patchBody = { updated_at: new Date().toISOString() };
          if (p.headline !== undefined) patchBody.headline = p.headline;
          if (p.intro !== undefined) patchBody.intro = p.intro;
          if (p.registration_fee !== undefined) patchBody.registration_fee = p.registration_fee;
          if (p.promo_banner !== undefined) patchBody.promo_banner = p.promo_banner;
          if (p.plans !== undefined) patchBody.plans = p.plans;
          if (p.flyers !== undefined) patchBody.flyers = p.flyers;
          if (p.contacts !== undefined) patchBody.contacts = p.contacts;
          await sbFetch('itutor_v2_tuition_info?id=eq.default', {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: patchBody
          });
          break;
        }

        default:
          break;
      }
    }

    return getFullSnapshot();
  }

  // Local file fallback (mirrors every single action identically)
  const db = readLocalDb();
  for (const act of actions) {
    const p = act?.payload || {};
    switch (act?.type) {
      case 'UPSERT_ACCOUNT':
        db.profiles = db.profiles || [];
        upsertInArray(db.profiles, p, false);
        break;
      case 'DELETE_ACCOUNT':
        db.profiles = (db.profiles || []).filter((u) => u.id !== p.id);
        break;
      case 'ADD_TIMETABLE':
      case 'UPSERT_TIMETABLE':
        upsertInArray(db.timetables, p, false);
        break;
      case 'DELETE_TIMETABLE':
        db.timetables = db.timetables.filter((t) => t.id !== p.id);
        break;
      case 'CREATE_ASSIGNMENT':
      case 'UPSERT_ASSIGNMENT':
        upsertInArray(db.assignments, p, true);
        break;
      case 'DELETE_ASSIGNMENT':
        db.assignments = db.assignments.filter((a) => a.id !== p.id);
        db.submissions = db.submissions.filter((s) => s.assignment_id !== p.id);
        break;
      case 'SUBMIT_ASSIGNMENT':
      case 'UPSERT_SUBMISSION':
        upsertInArray(db.submissions, p, true);
        break;
      case 'GRADE_SUBMISSION': {
        const sub = db.submissions.find((s) => s.id === p.id);
        if (sub) {
          sub.status = 'graded';
          sub.marks_awarded = Number(p.marks_awarded ?? 0);
          sub.teacher_feedback = p.teacher_feedback || '';
        }
        break;
      }
      case 'DELETE_SUBMISSION':
        db.submissions = db.submissions.filter((s) => s.id !== p.id);
        break;
      case 'LOG_ATTENDANCE':
      case 'UPSERT_ATTENDANCE':
        db.attendance = db.attendance || [];
        upsertInArray(db.attendance, p, true);
        break;
      case 'DELETE_ATTENDANCE':
        db.attendance = (db.attendance || []).filter((a) => a.id !== p.id);
        break;
      case 'ADD_STUDY_NOTE':
      case 'UPSERT_STUDY_NOTE':
        db.notes = db.notes || [];
        upsertInArray(db.notes, p, true);
        break;
      case 'DELETE_STUDY_NOTE':
        db.notes = (db.notes || []).filter((n) => n.id !== p.id);
        break;
      case 'UPSERT_QUIZ':
        db.quizzes = db.quizzes || [];
        upsertInArray(db.quizzes, normalizeQuiz(p), false);
        break;
      case 'DELETE_QUIZ':
        db.quizzes = (db.quizzes || []).filter((q) => q.id !== p.id);
        break;
      case 'UPSERT_FLASHCARD':
        db.flashcards = db.flashcards || [];
        upsertInArray(db.flashcards, p, false);
        break;
      case 'DELETE_FLASHCARD':
        db.flashcards = (db.flashcards || []).filter((f) => f.id !== p.id);
        break;
      case 'CREATE_STUDY_GROUP':
      case 'UPSERT_ROOM':
        upsertInArray(db.rooms, p, true);
        break;
      case 'DELETE_ROOM':
        db.rooms = db.rooms.filter((r) => r.id !== p.id);
        db.messages = db.messages.filter((m) => m.room_id !== p.id);
        break;
      case 'SEND_MESSAGE':
      case 'UPSERT_MESSAGE':
        upsertInArray(db.messages, p, false);
        break;
      case 'DELETE_MESSAGE':
        db.messages = db.messages.filter((m) => m.id !== p.id);
        break;
      case 'SEND_BROADCAST':
      case 'UPSERT_BROADCAST':
        upsertInArray(db.broadcasts, p, true);
        break;
      case 'DELETE_BROADCAST':
        db.broadcasts = db.broadcasts.filter((b) => b.id !== p.id);
        break;
      case 'SUBMIT_ENQUIRY':
      case 'UPSERT_ENQUIRY':
        db.enquiries = db.enquiries || [];
        upsertInArray(db.enquiries, p, true);
        break;
      case 'DELETE_ENQUIRY':
        db.enquiries = (db.enquiries || []).filter((e) => e.id !== p.id);
        break;
      case 'UPDATE_TUITION_INFO':
        db.tuitionInfo = {
          ...db.tuitionInfo,
          ...(p.headline !== undefined ? { headline: p.headline } : {}),
          ...(p.intro !== undefined ? { intro: p.intro } : {}),
          ...(p.registration_fee !== undefined ? { registration_fee: p.registration_fee } : {}),
          ...(p.promo_banner !== undefined ? { promo_banner: p.promo_banner } : {}),
          ...(p.plans !== undefined ? { plans: p.plans } : {}),
          ...(p.flyers !== undefined ? { flyers: p.flyers } : {}),
          ...(p.contacts !== undefined ? { contacts: p.contacts } : {})
        };
        break;
      default:
        break;
    }
  }
  writeLocalDb(db);
  return {
    backend: 'local',
    syncedAt: new Date().toISOString(),
    ...db
  };
}

const LOCAL_UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');

function sanitizeStorageName(fileName = 'file.bin') {
  const clean = path
    .basename(String(fileName || 'file'))
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(-90);
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${clean || 'file'}`;
}

export async function createSignedUploadTarget({ fileName }) {
  const mode = await detectMode();
  const objectName = sanitizeStorageName(fileName);
  const cfg = getSupabaseConfig();

  if (mode === 'supabase' && cfg) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const res = await fetch(`${cfg.url}/storage/v1/object/upload/sign/itutor-media/${objectName}`, {
        method: 'POST',
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`
        },
        signal: controller.signal
      });
      if (res.ok) {
        const data = await res.json();
        const rel = String(data.url || '');
        const signedUrl = rel.startsWith('http') ? rel : `${cfg.url}/storage/v1${rel}`;
        const publicUrl = `${cfg.url}/storage/v1/object/public/itutor-media/${objectName}`;
        return { mode: 'supabase', signedUrl, publicUrl, objectName };
      }
    } catch {
      // Fall through to direct /api/upload
    } finally {
      clearTimeout(timer);
    }
  }

  return { mode: 'local', uploadUrl: `/api/upload?name=${encodeURIComponent(objectName)}`, objectName };
}

export async function uploadBinaryMedia({ fileName, contentType = 'application/octet-stream', buffer }) {
  const mode = await detectMode();
  const objectName = sanitizeStorageName(fileName);
  const cfg = getSupabaseConfig();

  if (mode === 'supabase' && cfg) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${cfg.url}/storage/v1/object/itutor-media/${objectName}`, {
        method: 'POST',
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': contentType,
          'x-upsert': 'true'
        },
        body: buffer,
        signal: controller.signal
      });
      if (res.ok) {
        return {
          ok: true,
          backend: 'supabase',
          url: `${cfg.url}/storage/v1/object/public/itutor-media/${objectName}`,
          objectName
        };
      }
    } catch {
      // Fall back to local storage or data URL
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, objectName), buffer);
    fs.writeFileSync(path.join(LOCAL_UPLOAD_DIR, `${objectName}.meta.json`), JSON.stringify({ contentType }), 'utf8');
    return {
      ok: true,
      backend: 'local',
      url: `/api/media/${encodeURIComponent(objectName)}`,
      objectName
    };
  } catch {
    const b64 = Buffer.from(buffer).toString('base64');
    return {
      ok: true,
      backend: 'inline',
      url: `data:${contentType};base64,${b64}`,
      objectName
    };
  }
}

export function readLocalUploadedMedia(objectName) {
  const safe = path.basename(String(objectName || ''));
  const filePath = path.join(LOCAL_UPLOAD_DIR, safe);
  if (!fs.existsSync(filePath)) return null;
  let contentType = 'application/octet-stream';
  try {
    const meta = JSON.parse(fs.readFileSync(`${filePath}.meta.json`, 'utf8'));
    if (meta.contentType) contentType = meta.contentType;
  } catch {
    // Default mime
  }
  return { buffer: fs.readFileSync(filePath), contentType };
}
