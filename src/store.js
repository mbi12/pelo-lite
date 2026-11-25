import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createSeedData, hashPassword } from './seedData.js';

function loadDotEnvIfPresent() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return;
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // Ignore in serverless environments where env vars are injected directly
  }
}

loadDotEnvIfPresent();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const FORCE_MEMORY = process.env.FORCE_MEMORY_STORE === '1';
const LOCAL_DB_FILE = path.resolve(process.cwd(), 'data', 'itutor-local.json');

const supabase =
  SUPABASE_URL && SUPABASE_KEY && !FORCE_MEMORY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
          fetch: (url, opts = {}) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 3500);
            return fetch(url, { ...opts, signal: opts.signal || controller.signal }).finally(() =>
              clearTimeout(timer)
            );
          }
        }
      })
    : null;

let memoryDb = null;
// 'unprobed' | 'supabase' | 'local'
let backendMode = supabase ? 'unprobed' : 'local';

function uid(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

function getLocalDb() {
  if (memoryDb) return memoryDb;
  if (!FORCE_MEMORY) {
    try {
      if (fs.existsSync(LOCAL_DB_FILE)) {
        memoryDb = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
        return memoryDb;
      }
    } catch {
      // Fall back to fresh seed
    }
  }
  memoryDb = createSeedData();
  persistLocalDb();
  return memoryDb;
}

function persistLocalDb() {
  if (FORCE_MEMORY || !memoryDb) return;
  try {
    fs.mkdirSync(path.dirname(LOCAL_DB_FILE), { recursive: true });
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(memoryDb, null, 2), 'utf8');
  } catch {
    // Ignore in read-only filesystems
  }
}

async function resolveBackend() {
  if (backendMode !== 'unprobed') return backendMode === 'supabase';
  if (!supabase) {
    backendMode = 'local';
    return false;
  }
  try {
    const { count, error } = await supabase
      .from('itutor_users')
      .select('id', { count: 'exact', head: true });

    if (error) {
      backendMode = 'local';
      return false;
    }

    if ((count ?? 0) === 0) {
      const seed = createSeedData();
      await supabase.from('itutor_users').upsert(seed.users);
      await supabase.from('itutor_subjects').upsert(seed.subjects);
      await supabase.from('itutor_sessions').upsert(seed.sessions);
      await supabase.from('itutor_attendance').upsert(seed.attendance);
      await supabase.from('itutor_help_requests').upsert(seed.help_requests);
      await supabase.from('itutor_resources').upsert(seed.resources);
      await supabase.from('itutor_resource_progress').upsert(seed.resource_progress);
      await supabase.from('itutor_quizzes').upsert(seed.quizzes);
      await supabase.from('itutor_quiz_attempts').upsert(seed.quiz_attempts);
      await supabase.from('itutor_assignments').upsert(seed.assignments);
      await supabase.from('itutor_submissions').upsert(seed.submissions);
      await supabase.from('itutor_coach_messages').upsert(seed.coach_messages);
      await supabase.from('itutor_announcements').upsert(seed.announcements);
      await supabase.from('itutor_messages').upsert(seed.messages);
    }

    backendMode = 'supabase';
    return true;
  } catch {
    backendMode = 'local';
    return false;
  }
}

function stripSensitiveUser(u) {
  if (!u) return null;
  const { password_hash, ...safe } = u;
  return safe;
}

export const store = {
  getStorageMode() {
    if (backendMode === 'supabase') return 'supabase';
    if (backendMode === 'unprobed' && supabase) return 'supabase';
    return FORCE_MEMORY ? 'memory' : 'local';
  },

  async fetchFullSnapshot() {
    const useSb = await resolveBackend();
    if (!useSb) {
      const db = getLocalDb();
      return {
        ...db,
        users: db.users.map(stripSensitiveUser)
      };
    }

    const [
      usersRes,
      subjectsRes,
      sessionsRes,
      attRes,
      helpRes,
      resourcesRes,
      resProgRes,
      quizzesRes,
      attemptsRes,
      assignmentsRes,
      submissionsRes,
      coachRes,
      announcementsRes,
      messagesRes
    ] = await Promise.all([
      supabase.from('itutor_users').select('*').order('created_at', { ascending: true }),
      supabase.from('itutor_subjects').select('*').order('created_at', { ascending: true }),
      supabase.from('itutor_sessions').select('*').order('scheduled_at', { ascending: true }),
      supabase.from('itutor_attendance').select('*'),
      supabase.from('itutor_help_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('itutor_resources').select('*').order('created_at', { ascending: false }),
      supabase.from('itutor_resource_progress').select('*'),
      supabase.from('itutor_quizzes').select('*').order('created_at', { ascending: true }),
      supabase.from('itutor_quiz_attempts').select('*').order('created_at', { ascending: false }),
      supabase.from('itutor_assignments').select('*').order('due_at', { ascending: true }),
      supabase.from('itutor_submissions').select('*').order('submitted_at', { ascending: false }),
      supabase.from('itutor_coach_messages').select('*').order('created_at', { ascending: true }),
      supabase.from('itutor_announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('itutor_messages').select('*').order('created_at', { ascending: true })
    ]);

    return {
      users: (usersRes.data || []).map(stripSensitiveUser),
      subjects: subjectsRes.data || [],
      sessions: sessionsRes.data || [],
      attendance: attRes.data || [],
      help_requests: helpRes.data || [],
      resources: resourcesRes.data || [],
      resource_progress: resProgRes.data || [],
      quizzes: quizzesRes.data || [],
      quiz_attempts: attemptsRes.data || [],
      assignments: assignmentsRes.data || [],
      submissions: submissionsRes.data || [],
      coach_messages: coachRes.data || [],
      announcements: announcementsRes.data || [],
      messages: messagesRes.data || []
    };
  },

  async authenticateUser({ email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const hashed = hashPassword(password || '');
    const useSb = await resolveBackend();
    if (!useSb) {
      const db = getLocalDb();
      const found = db.users.find((u) => u.email.toLowerCase() === cleanEmail && u.password_hash === hashed);
      return stripSensitiveUser(found || null);
    }
    const { data } = await supabase
      .from('itutor_users')
      .select('*')
      .ilike('email', cleanEmail)
      .maybeSingle();
    if (!data || data.password_hash !== hashed) return null;
    return stripSensitiveUser(data);
  },

  async registerUser({ name, email, password, role = 'student', grade = 'Grade 11', linked_student_id = null }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const newUser = {
      id: uid(role === 'tutor' ? 'tut' : role === 'parent' ? 'par' : 'stu'),
      name: name.trim(),
      email: cleanEmail,
      password_hash: hashPassword(password || 'itutor123'),
      role,
      grade: grade || (role === 'tutor' ? 'Academic Tutor' : role === 'parent' ? 'Parent' : 'Grade 11'),
      bio: `Member of i-tutor — Confidence in learning.`,
      linked_student_id: role === 'parent' ? linked_student_id || 'stu-thabo' : null,
      streak_days: 1,
      confidence_mood: 'building',
      created_at: new Date().toISOString()
    };

    const useSb = await resolveBackend();
    if (!useSb) {
      const db = getLocalDb();
      if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
        throw new Error('An account with this email already exists.');
      }
      db.users.push(newUser);
      persistLocalDb();
      return stripSensitiveUser(newUser);
    }

    const { data, error } = await supabase.from('itutor_users').insert(newUser).select('*').single();
    if (error) {
      if (error.message.includes('duplicate') || error.code === '23505') {
        throw new Error('An account with this email already exists.');
      }
      throw new Error(error.message);
    }
    return stripSensitiveUser(data);
  },

  async updateStudentMood({ studentId, mood }) {
    const useSb = await resolveBackend();
    if (!useSb) {
      const db = getLocalDb();
      const user = db.users.find((u) => u.id === studentId);
      if (!user) throw new Error('Student not found');
      user.confidence_mood = mood;
      persistLocalDb();
      return stripSensitiveUser(user);
    }
    const { data, error } = await supabase
      .from('itutor_users')
      .update({ confidence_mood: mood })
      .eq('id', studentId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return stripSensitiveUser(data);
  },

  async createSubject({ name, code, grade_level, tutor_name, description, topics = [] }) {
    const cleanTopics = (topics.length ? topics : ['Core Principles', 'Worked Applications', 'Exam Past Papers']).map(
      (t, i) =>
        typeof t === 'string'
          ? { id: uid(`top-${i}`), name: t.trim(), summary: `Structured mastery for ${t.trim()}.` }
          : t
    );
    const subject = {
      id: uid('sub'),
      name: name.trim(),
      code: (code || name.slice(0, 4).toUpperCase()).trim(),
      grade_level: grade_level || 'Grades 10–12',
      tutor_name: tutor_name || 'Ms. Naledi Khumalo',
      description: description || `Structured mastery and exam readiness in ${name.trim()}.`,
      icon: 'book',
      topics: cleanTopics,
      created_at: new Date().toISOString()
    };

    const useSb = await resolveBackend();
    if (!useSb) {
      getLocalDb().subjects.push(subject);
      persistLocalDb();
      return subject;
    }
    const { data, error } = await supabase.from('itutor_subjects').insert(subject).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async createSession(payload) {
    const session = {
      id: uid('ses'),
      subject_id: payload.subject_id,
      title: payload.title.trim(),
      topic: payload.topic.trim(),
      tutor_name: payload.tutor_name || 'Ms. Naledi Khumalo',
      session_type: payload.session_type || 'group',
      mode: payload.mode || 'in_person',
      location_or_link: payload.location_or_link || 'Studio Room A · Main i-tutor Campus',
      scheduled_at: payload.scheduled_at || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      duration_mins: Number(payload.duration_mins) || 60,
      status: 'upcoming',
      target_student_id: payload.target_student_id || null,
      lesson_recap: '',
      key_takeaways: [],
      created_at: new Date().toISOString()
    };

    const useSb = await resolveBackend();
    if (!useSb) {
      getLocalDb().sessions.push(session);
      persistLocalDb();
      return session;
    }
    const { data, error } = await supabase.from('itutor_sessions').insert(session).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateSessionRecap({ sessionId, status, lesson_recap, key_takeaways }) {
    const takeaways = Array.isArray(key_takeaways)
      ? key_takeaways
      : String(key_takeaways || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);

    const useSb = await resolveBackend();
    if (!useSb) {
      const db = getLocalDb();
      const ses = db.sessions.find((s) => s.id === sessionId);
      if (!ses) throw new Error('Session not found');
      if (status) ses.status = status;
      if (lesson_recap !== undefined) ses.lesson_recap = lesson_recap;
      if (key_takeaways !== undefined) ses.key_takeaways = takeaways;
      persistLocalDb();
      return ses;
    }
    const updates = {};
    if (status) updates.status = status;
    if (lesson_recap !== undefined) updates.lesson_recap = lesson_recap;
    if (key_takeaways !== undefined) updates.key_takeaways = takeaways;
    const { data, error } = await supabase
      .from('itutor_sessions')
      .update(updates)
      .eq('id', sessionId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async upsertAttendance({ sessionId, studentId, status, confidence_checkin, note }) {
    const useSb = await resolveBackend();
    if (!useSb) {
      const db = getLocalDb();
      let rec = db.attendance.find((a) => a.session_id === sessionId && a.student_id === studentId);
      if (rec) {
        if (status) rec.status = status;
        if (confidence_checkin) rec.confidence_checkin = confidence_checkin;
        if (note !== undefined) rec.note = note;
        rec.updated_at = new Date().toISOString();
        persistLocalDb();
        return rec;
      }
      rec = {
        id: uid('att'),
        session_id: sessionId,
        student_id: studentId,
        status: status || 'present',
        confidence_checkin: confidence_checkin || 'building',
        note: note || '',
        updated_at: new Date().toISOString()
      };
      db.attendance.push(rec);
      persistLocalDb();
      return rec;
    }

    const { data: existing } = await supabase
      .from('itutor_attendance')
      .select('*')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .maybeSingle();

    const record = {
      id: existing?.id || uid('att'),
      session_id: sessionId,
      student_id: studentId,
      status: status || existing?.status || 'present',
      confidence_checkin: confidence_checkin || existing?.confidence_checkin || 'building',
      note: note !== undefined ? note : existing?.note || '',
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('itutor_attendance')
      .upsert(record, { onConflict: 'session_id,student_id' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async createHelpRequest({ student_id, subject_id, topic, preferred_slot, notes }) {
    const reqItem = {
      id: uid('hlp'),
      student_id,
      subject_id,
      topic: topic.trim(),
      preferred_slot: preferred_slot.trim(),
      notes: (notes || '').trim(),
      status: 'pending',
      tutor_response: '',
      created_at: new Date().toISOString()
    };

    const useSb = await resolveBackend();
    if (!useSb) {
      getLocalDb().help_requests.unshift(reqItem);
      persistLocalDb();
      return reqItem;
    }
    const { data, error } = await supabase.from('itutor_help_requests').insert(reqItem).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async resolveHelpRequest({ requestId, status, tutor_response, create_session_payload = null }) {
    let createdSession = null;
    if (create_session_payload) {
      createdSession = await this.createSession(create_session_payload);
    }

    const useSb = await resolveBackend();
    if (!useSb) {
      const db = getLocalDb();
      const item = db.help_requests.find((h) => h.id === requestId);
      if (!item) throw new Error('Help request not found');
      item.status = status || 'scheduled';
      item.tutor_response = tutor_response || '';
      persistLocalDb();
      return { request: item, session: createdSession };
    }

    const { data, error } = await supabase
      .from('itutor_help_requests')
      .update({
        status: status || 'scheduled',
        tutor_response: tutor_response || ''
      })
      .eq('id', requestId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return { request: data, session: createdSession };
  },

  async createResource(payload) {
    const formulas = Array.isArray(payload.key_formulas)
      ? payload.key_formulas
      : String(payload.key_formulas || '')
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);

    const resItem = {
      id: uid('res'),
      subject_id: payload.subject_id,
      topic: payload.topic.trim(),
      title: payload.title.trim(),
      resource_type: payload.resource_type || 'notes',
      difficulty: payload.difficulty || 'Core',
      summary: (payload.summary || payload.title).trim(),
      content_body: payload.content_body.trim(),
      key_formulas: formulas,
      author_name: payload.author_name || 'Ms. Naledi Khumalo',
      created_at: new Date().toISOString()
    };

    const useSb = await resolveBackend();
    if (!useSb) {
      getLocalDb().resources.unshift(resItem);
      persistLocalDb();
      return resItem;
    }
    const { data, error } = await supabase.from('itutor_resources').insert(resItem).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async toggleResourceProgress({ resourceId, studentId, bookmarked, completed }) {
    const useSb = await resolveBackend();
    if (!useSb) {
      const db = getLocalDb();
      let rec = db.resource_progress.find((r) => r.resource_id === resourceId && r.student_id === studentId);
      if (!rec) {
        rec = {
          id: uid('rp'),
          resource_id: resourceId,
          student_id: studentId,
          bookmarked: Boolean(bookmarked),
          completed: Boolean(completed),
          updated_at: new Date().toISOString()
        };
        db.resource_progress.push(rec);
        persistLocalDb();
        return rec;
      }
      if (typeof bookmarked === 'boolean') rec.bookmarked = bookmarked;
      if (typeof completed === 'boolean') rec.completed = completed;
      rec.updated_at = new Date().toISOString();
      persistLocalDb();
      return rec;
    }

    const { data: existing } = await supabase
      .from('itutor_resource_progress')
      .select('*')
      .eq('resource_id', resourceId)
      .eq('student_id', studentId)
      .maybeSingle();

    const record = {
      id: existing?.id || uid('rp'),
      resource_id: resourceId,
      student_id: studentId,
      bookmarked: typeof bookmarked === 'boolean' ? bookmarked : existing?.bookmarked ?? false,
      completed: typeof completed === 'boolean' ? completed : existing?.completed ?? false,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('itutor_resource_progress')
      .upsert(record, { onConflict: 'resource_id,student_id' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async createQuiz(payload) {
    const quiz = {
      id: uid('qz'),
      subject_id: payload.subject_id,
      topic: payload.topic.trim(),
      title: payload.title.trim(),
      description: (payload.description || '').trim(),
      time_limit_mins: Number(payload.time_limit_mins) || 10,
      difficulty: payload.difficulty || 'Core',
      questions: payload.questions || [],
      author_name: payload.author_name || 'Ms. Naledi Khumalo',
      created_at: new Date().toISOString()
    };

    const useSb = await resolveBackend();
    if (!useSb) {
      getLocalDb().quizzes.push(quiz);
      persistLocalDb();
      return quiz;
    }
    const { data, error } = await supabase.from('itutor_quizzes').insert(quiz).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async submitQuizAttempt({ quizId, studentId, answers, durationSecs = 0, confidenceAfter = 'confident' }) {
    const useSb = await resolveBackend();
    let quiz;
    if (!useSb) {
      quiz = getLocalDb().quizzes.find((q) => q.id === quizId);
    } else {
      const { data } = await supabase.from('itutor_quizzes').select('*').eq('id', quizId).maybeSingle();
      quiz = data;
    }
    if (!quiz) throw new Error('Quiz not found');

    const questions = quiz.questions || [];
    let correctCount = 0;
    const review = questions.map((q, idx) => {
      const selected = Number(answers?.[idx] ?? -1);
      const isCorrect = selected === Number(q.correct_index);
      if (isCorrect) correctCount += 1;
      return {
        question_id: q.id,
        prompt: q.prompt,
        selected_index: selected,
        correct_index: Number(q.correct_index),
        is_correct: isCorrect,
        explanation: q.explanation
      };
    });

    const totalCount = Math.max(1, questions.length);
    const scorePercent = Math.round((correctCount / totalCount) * 100);

    const attempt = {
      id: uid('qa'),
      quiz_id: quizId,
      student_id: studentId,
      score_percent: scorePercent,
      correct_count: correctCount,
      total_count: questions.length,
      answers: answers || [],
      duration_secs: Number(durationSecs) || 0,
      confidence_after: confidenceAfter,
      created_at: new Date().toISOString()
    };

    if (!useSb) {
      getLocalDb().quiz_attempts.unshift(attempt);
      persistLocalDb();
      return { attempt, review };
    }

    const { data, error } = await supabase.from('itutor_quiz_attempts').insert(attempt).select('*').single();
    if (error) throw new Error(error.message);
    return { attempt: data, review };
  },

  async createAssignment(payload) {
    const asg = {
      id: uid('asg'),
      subject_id: payload.subject_id,
      topic: payload.topic.trim(),
      title: payload.title.trim(),
      instructions: payload.instructions.trim(),
      due_at: payload.due_at || new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      max_marks: Number(payload.max_marks) || 20,
      author_name: payload.author_name || 'Ms. Naledi Khumalo',
      created_at: new Date().toISOString()
    };

    const useSb = await resolveBackend();
    if (!useSb) {
      getLocalDb().assignments.push(asg);
      persistLocalDb();
      return asg;
    }
    const { data, error } = await supabase.from('itutor_assignments').insert(asg).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async submitHomework({ assignmentId, studentId, answerText, studentConfidence = 'building' }) {
    const useSb = await resolveBackend();
    if (!useSb) {
      const db = getLocalDb();
      let sub = db.submissions.find((s) => s.assignment_id === assignmentId && s.student_id === studentId);
      if (sub) {
        sub.answer_text = answerText.trim();
        sub.student_confidence = studentConfidence;
        sub.status = 'submitted';
        sub.submitted_at = new Date().toISOString();
        persistLocalDb();
        return sub;
      }
      sub = {
        id: uid('subm'),
        assignment_id: assignmentId,
        student_id: studentId,
        answer_text: answerText.trim(),
        student_confidence: studentConfidence,
        status: 'submitted',
        marks_awarded: null,
        tutor_feedback: '',
        submitted_at: new Date().toISOString(),
        graded_at: null
      };
      db.submissions.unshift(sub);
      persistLocalDb();
      return sub;
    }

    const { data: existing } = await supabase
      .from('itutor_submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .eq('student_id', studentId)
      .maybeSingle();

    const record = {
      id: existing?.id || uid('subm'),
      assignment_id: assignmentId,
      student_id: studentId,
      answer_text: answerText.trim(),
      student_confidence: studentConfidence,
      status: 'submitted',
      marks_awarded: existing?.marks_awarded ?? null,
      tutor_feedback: existing?.tutor_feedback ?? '',
      submitted_at: new Date().toISOString(),
      graded_at: existing?.graded_at ?? null
    };

    const { data, error } = await supabase
      .from('itutor_submissions')
      .upsert(record, { onConflict: 'assignment_id,student_id' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async gradeSubmission({ submissionId, marksAwarded, tutorFeedback }) {
    const useSb = await resolveBackend();
    if (!useSb) {
      const db = getLocalDb();
      const sub = db.submissions.find((s) => s.id === submissionId);
      if (!sub) throw new Error('Submission not found');
      sub.marks_awarded = Number(marksAwarded);
      sub.tutor_feedback = (tutorFeedback || '').trim();
      sub.status = 'graded';
      sub.graded_at = new Date().toISOString();
      persistLocalDb();
      return sub;
    }

    const { data, error } = await supabase
      .from('itutor_submissions')
      .update({
        marks_awarded: Number(marksAwarded),
        tutor_feedback: (tutorFeedback || '').trim(),
        status: 'graded',
        graded_at: new Date().toISOString()
      })
      .eq('id', submissionId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async saveCoachExchange({ studentId, subjectId, topic, mode, studentPrompt, coachReply }) {
    const now = Date.now();
    const userMsg = {
      id: uid('cm-u'),
      student_id: studentId,
      subject_id: subjectId || 'sub-math',
      topic: topic || '',
      mode: mode || 'step_by_step',
      sender: 'student',
      content: studentPrompt,
      steps: [],
      follow_up_prompt: '',
      created_at: new Date(now).toISOString()
    };
    const botMsg = {
      id: uid('cm-c'),
      student_id: studentId,
      subject_id: subjectId || 'sub-math',
      topic: topic || '',
      mode: mode || 'step_by_step',
      sender: 'coach',
      content: coachReply.content,
      steps: coachReply.steps || [],
      follow_up_prompt: coachReply.follow_up_prompt || '',
      created_at: new Date(now + 25).toISOString()
    };

    const useSb = await resolveBackend();
    if (!useSb) {
      const db = getLocalDb();
      db.coach_messages.push(userMsg, botMsg);
      persistLocalDb();
      return [userMsg, botMsg];
    }

    const { data, error } = await supabase
      .from('itutor_coach_messages')
      .insert([userMsg, botMsg])
      .select('*');
    if (error) throw new Error(error.message);
    return data;
  },

  async createAnnouncement({ subject_id, title, body, author_name, audience = 'all', pinned = false }) {
    const item = {
      id: uid('ann'),
      subject_id: subject_id || null,
      title: title.trim(),
      body: body.trim(),
      author_name: author_name || 'Ms. Naledi Khumalo',
      audience,
      pinned: Boolean(pinned),
      created_at: new Date().toISOString()
    };

    const useSb = await resolveBackend();
    if (!useSb) {
      getLocalDb().announcements.unshift(item);
      persistLocalDb();
      return item;
    }
    const { data, error } = await supabase.from('itutor_announcements').insert(item).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  },

  async sendMessage({ student_id, channel = 'tutor_parent', sender_id, sender_name, sender_role, body }) {
    const msg = {
      id: uid('msg'),
      student_id,
      channel,
      sender_id,
      sender_name,
      sender_role,
      body: body.trim(),
      created_at: new Date().toISOString()
    };

    const useSb = await resolveBackend();
    if (!useSb) {
      getLocalDb().messages.push(msg);
      persistLocalDb();
      return msg;
    }
    const { data, error } = await supabase.from('itutor_messages').insert(msg).select('*').single();
    if (error) throw new Error(error.message);
    return data;
  }
};
