import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDefaultSnapshot } from '../public/js/defaultSeed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_DB_PATH = path.join(__dirname, '..', 'data', 'itutor-v2-local.json');

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

function readLocalDb() {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
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

export async function getFullSnapshot() {
  const mode = await detectMode();
  if (mode === 'supabase') {
    try {
      const [
        profiles,
        timetables,
        assignments,
        submissions,
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
        sbFetch('itutor_v2_rooms?select=*&order=updated_at.desc'),
        sbFetch('itutor_v2_messages?select=*&order=created_at.asc'),
        sbFetch('itutor_v2_broadcasts?select=*&order=created_at.desc'),
        sbFetch('itutor_v2_tuition_info?select=*&id=eq.default&limit=1'),
        sbFetch('itutor_v2_enquiries?select=*&order=created_at.desc')
      ]);

      const fallback = createDefaultSnapshot();
      const tuitionRow = tuitionRows?.[0];

      return {
        backend: 'supabase',
        syncedAt: new Date().toISOString(),
        profiles: profiles?.length ? profiles : fallback.profiles,
        timetables: timetables || [],
        assignments: assignments || [],
        submissions: submissions || [],
        rooms: rooms || [],
        messages: messages || [],
        broadcasts: broadcasts || [],
        tuitionInfo: tuitionRow
          ? { plans: tuitionRow.plans || fallback.tuitionInfo.plans, contacts: tuitionRow.contacts || fallback.tuitionInfo.contacts }
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
    ...local
  };
}

export async function applyOutboxActions(actions = []) {
  const mode = await detectMode();

  if (mode === 'supabase') {
    for (const act of actions) {
      const p = act?.payload || {};
      switch (act?.type) {
        case 'ADD_TIMETABLE':
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
              offline_pack_content: p.offline_pack_content || ''
            }
          });
          break;

        case 'SUBMIT_ASSIGNMENT':
          await sbFetch('itutor_v2_submissions', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              assignment_id: p.assignment_id,
              student_id: p.student_id,
              student_name: p.student_name,
              answer_text: p.answer_text,
              status: 'submitted',
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

        case 'CREATE_STUDY_GROUP':
          await sbFetch('itutor_v2_rooms', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              room_type: p.room_type || 'group',
              name: p.name,
              subject: p.subject || 'Study Group',
              participant_ids: p.participant_ids || [],
              members_label: p.members_label || 'Student Study Group',
              created_by_name: p.created_by_name || 'Student',
              updated_at: new Date().toISOString()
            }
          });
          break;

        case 'SEND_MESSAGE':
          await sbFetch('itutor_v2_messages', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              room_id: p.room_id,
              sender_id: p.sender_id,
              sender_name: p.sender_name,
              sender_role: p.sender_role || 'student',
              body: p.body,
              created_at: p.created_at || new Date().toISOString()
            }
          });
          await sbFetch(`itutor_v2_rooms?id=eq.${encodeURIComponent(p.room_id)}`, {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: { updated_at: new Date().toISOString() }
          });
          break;

        case 'SEND_BROADCAST':
          await sbFetch('itutor_v2_broadcasts', {
            method: 'POST',
            prefer: 'resolution=merge-duplicates,return=minimal',
            body: {
              id: p.id,
              title: p.title,
              body: p.body,
              author_name: p.author_name,
              author_role: p.author_role === 'admin' ? 'admin' : 'teacher',
              audience: p.audience || 'students_parents',
              priority: p.priority || 'important',
              created_at: p.created_at || new Date().toISOString()
            }
          });
          break;

        case 'SUBMIT_ENQUIRY':
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
              created_at: p.created_at || new Date().toISOString()
            }
          });
          break;

        case 'UPDATE_TUITION_INFO':
          await sbFetch('itutor_v2_tuition_info?id=eq.default', {
            method: 'PATCH',
            prefer: 'return=minimal',
            body: {
              plans: p.plans,
              contacts: p.contacts,
              updated_at: new Date().toISOString()
            }
          });
          break;

        default:
          break;
      }
    }

    return getFullSnapshot();
  }

  // Local file fallback inside firewalled sandbox
  const db = readLocalDb();
  for (const act of actions) {
    const p = act?.payload || {};
    switch (act?.type) {
      case 'ADD_TIMETABLE':
        if (!db.timetables.some((t) => t.id === p.id)) {
          db.timetables.push(p);
        }
        break;
      case 'DELETE_TIMETABLE':
        db.timetables = db.timetables.filter((t) => t.id !== p.id);
        break;
      case 'CREATE_ASSIGNMENT':
        if (!db.assignments.some((a) => a.id === p.id)) {
          db.assignments.unshift(p);
        }
        break;
      case 'SUBMIT_ASSIGNMENT': {
        const idx = db.submissions.findIndex((s) => s.id === p.id);
        if (idx >= 0) db.submissions[idx] = { ...db.submissions[idx], ...p };
        else db.submissions.unshift(p);
        break;
      }
      case 'GRADE_SUBMISSION': {
        const sub = db.submissions.find((s) => s.id === p.id);
        if (sub) {
          sub.status = 'graded';
          sub.marks_awarded = Number(p.marks_awarded ?? 0);
          sub.teacher_feedback = p.teacher_feedback || '';
        }
        break;
      }
      case 'CREATE_STUDY_GROUP':
        if (!db.rooms.some((r) => r.id === p.id)) {
          db.rooms.unshift(p);
        }
        break;
      case 'SEND_MESSAGE':
        if (!db.messages.some((m) => m.id === p.id)) {
          db.messages.push(p);
        }
        break;
      case 'SEND_BROADCAST':
        if (!db.broadcasts.some((b) => b.id === p.id)) {
          db.broadcasts.unshift(p);
        }
        break;
      case 'SUBMIT_ENQUIRY':
        db.enquiries = db.enquiries || [];
        if (!db.enquiries.some((e) => e.id === p.id)) {
          db.enquiries.unshift(p);
        }
        break;
      case 'UPDATE_TUITION_INFO':
        if (p.plans && p.contacts) {
          db.tuitionInfo = { plans: p.plans, contacts: p.contacts };
        }
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
